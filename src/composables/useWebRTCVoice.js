import { ref, reactive } from 'vue';
import { supabase } from '../supabase';

const peers = {}; // playerId -> RTCPeerConnection
const remoteStreams = reactive({}); // playerId -> MediaStream
const localStream = ref(null);
const isMuted = ref(false);

export function useWebRTCVoice(roomCode, myPlayerId, playersList) {
  let channel = null;

  const initLocalStream = async () => {
    try {
      if (localStream.value) return localStream.value;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.value = stream;
      isMuted.value = false;
      return stream;
    } catch (e) {
      console.warn('無法取得麥克風權限：', e);
      return null;
    }
  };

  const toggleLocalMute = () => {
    if (localStream.value) {
      isMuted.value = !isMuted.value;
      localStream.value.getAudioTracks().forEach(track => {
        track.enabled = !isMuted.value;
      });
    }
  };

  // Signalling setup using Supabase Broadcast Channel
  const startVoiceConference = async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    channel = supabase.channel(`webrtc:${roomCode}`);

    // Listen for WebRTC signals from other peers
    channel
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.to === myPlayerId) {
          await handleOffer(payload.offer, payload.from, stream);
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.to === myPlayerId) {
          await handleAnswer(payload.answer, payload.from);
        }
      })
      .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
        if (payload.to === myPlayerId) {
          await handleIceCandidate(payload.candidate, payload.from);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Connect to all other existing real players in the room
          playersList.forEach(player => {
            if (player.id !== myPlayerId && !player.isBot) {
              connectToPeer(player.id, stream);
            }
          });
        }
      });
  };

  const connectToPeer = async (targetPlayerId, stream) => {
    if (peers[targetPlayerId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peers[targetPlayerId] = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreams[targetPlayerId] = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-ice',
          payload: {
            candidate: event.candidate,
            from: myPlayerId,
            to: targetPlayerId
          }
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: {
            offer: offer,
            from: myPlayerId,
            to: targetPlayerId
          }
        });
      }
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  };

  const handleOffer = async (offer, fromPlayerId, stream) => {
    if (peers[fromPlayerId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peers[fromPlayerId] = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreams[fromPlayerId] = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-ice',
          payload: {
            candidate: event.candidate,
            from: myPlayerId,
            to: fromPlayerId
          }
        });
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: {
            answer: answer,
            from: myPlayerId,
            to: fromPlayerId
          }
        });
      }
    } catch (e) {
      console.error('Error handling WebRTC offer:', e);
    }
  };

  const handleAnswer = async (answer, fromPlayerId) => {
    const pc = peers[fromPlayerId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {
        console.error('Error setting remote answer:', e);
      }
    }
  };

  const handleIceCandidate = async (candidate, fromPlayerId) => {
    const pc = peers[fromPlayerId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE Candidate:', e);
      }
    }
  };

  const closePeers = () => {
    if (channel) {
      channel.unsubscribe();
      channel = null;
    }
    Object.keys(peers).forEach(id => {
      if (peers[id]) {
        peers[id].close();
        delete peers[id];
      }
      delete remoteStreams[id];
    });
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop());
      localStream.value = null;
    }
  };

  return {
    remoteStreams,
    localStream,
    isMuted,
    initLocalStream,
    toggleLocalMute,
    startVoiceConference,
    closePeers
  };
}
