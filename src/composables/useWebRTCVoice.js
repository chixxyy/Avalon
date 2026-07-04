import { ref, reactive } from 'vue';
import { supabase } from '../supabase';

const peers = {}; // playerId -> RTCPeerConnection
const remoteStreams = reactive({}); // playerId -> MediaStream
const activeSpeakers = reactive({}); // playerId -> boolean (speaking state)
const iceQueue = {}; // playerId -> RTCIceCandidate[] (buffered until remote desc is set)
const localStream = ref(null);
const isMuted = ref(false);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export function useWebRTCVoice(roomCode, myPlayerId) {
  let channel = null;

  const initLocalStream = async () => {
    try {
      if (localStream.value) return localStream.value;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.value = stream;
      isMuted.value = false;
      console.log('[WebRTC] Got local microphone stream');
      return stream;
    } catch (e) {
      console.warn('[WebRTC] 無法取得麥克風權限：', e);
      return null;
    }
  };

  const toggleLocalMute = () => {
    if (localStream.value) {
      isMuted.value = !isMuted.value;
      localStream.value.getAudioTracks().forEach(track => {
        track.enabled = !isMuted.value;
      });
      console.log('[WebRTC] Muted:', isMuted.value);
    }
  };

  const setMicEnabled = (enabled) => {
    if (localStream.value) {
      localStream.value.getAudioTracks().forEach(track => {
        // Only enable track if not manually muted
        track.enabled = enabled ? !isMuted.value : false;
      });
      console.log('[WebRTC] Dynamic Mic Enabled:', enabled && !isMuted.value);
      
      // Update local state and broadcast
      const currentlySpeaking = enabled && !isMuted.value;
      activeSpeakers[myPlayerId] = currentlySpeaking;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-speaking-state',
          payload: { from: myPlayerId, isSpeaking: currentlySpeaking }
        });
      }
    }
  };

  const createPeerConnection = (targetPlayerId) => {
    if (peers[targetPlayerId]) return peers[targetPlayerId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers[targetPlayerId] = pc;
    iceQueue[targetPlayerId] = [];

    // Add local tracks
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => {
        pc.addTrack(track, localStream.value);
      });
    }

    // When we receive remote audio
    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack from', targetPlayerId, event.streams);
      if (event.streams && event.streams[0]) {
        remoteStreams[targetPlayerId] = event.streams[0];
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-ice',
          payload: {
            candidate: event.candidate.toJSON(),
            from: myPlayerId,
            to: targetPlayerId
          }
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection to ${targetPlayerId}:`, pc.connectionState);
    };

    return pc;
  };

  const flushIceQueue = async (targetPlayerId) => {
    const queue = iceQueue[targetPlayerId] || [];
    const pc = peers[targetPlayerId];
    if (!pc) return;
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] ICE flush error:', e);
      }
    }
    iceQueue[targetPlayerId] = [];
  };

  // Caller side: initiate offer to a peer
  const connectToPeer = async (targetPlayerId) => {
    if (peers[targetPlayerId]) return;
    console.log('[WebRTC] Connecting to peer:', targetPlayerId);

    const pc = createPeerConnection(targetPlayerId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({
        type: 'broadcast',
        event: 'webrtc-offer',
        payload: { offer: pc.localDescription.toJSON(), from: myPlayerId, to: targetPlayerId }
      });
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
    }
  };

  // Callee side: respond to an offer
  const handleOffer = async (offer, fromPlayerId) => {
    if (peers[fromPlayerId]) return;
    console.log('[WebRTC] Got offer from:', fromPlayerId);

    const pc = createPeerConnection(fromPlayerId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIceQueue(fromPlayerId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channel.send({
        type: 'broadcast',
        event: 'webrtc-answer',
        payload: { answer: pc.localDescription.toJSON(), from: myPlayerId, to: fromPlayerId }
      });
    } catch (e) {
      console.error('[WebRTC] Error handling offer:', e);
    }
  };

  const handleAnswer = async (answer, fromPlayerId) => {
    const pc = peers[fromPlayerId];
    if (!pc) return;
    console.log('[WebRTC] Got answer from:', fromPlayerId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushIceQueue(fromPlayerId);
    } catch (e) {
      console.error('[WebRTC] Error setting answer:', e);
    }
  };

  const handleIceCandidate = async (candidate, fromPlayerId) => {
    const pc = peers[fromPlayerId];
    if (!pc) return;

    if (pc.remoteDescription && pc.remoteDescription.type) {
      // Remote desc already set, add directly
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] ICE candidate error:', e);
      }
    } else {
      // Buffer it until remote desc is ready
      if (!iceQueue[fromPlayerId]) iceQueue[fromPlayerId] = [];
      iceQueue[fromPlayerId].push(candidate);
    }
  };

  // Signalling setup using Supabase Broadcast Channel
  const startVoiceConference = async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    // Clean up old channel if any
    if (channel) {
      channel.unsubscribe();
      channel = null;
    }

    channel = supabase.channel(`webrtc:${roomCode}`, {
      config: { broadcast: { self: false } }
    });

    channel
      // KEY FIX: Hello mechanism. When someone joins, they broadcast hello.
      // All others who receive it initiate an offer TO them.
      .on('broadcast', { event: 'webrtc-hello' }, async ({ payload }) => {
        const peerId = payload.from;
        if (peerId && peerId !== myPlayerId && !payload.isBot) {
          console.log('[WebRTC] Received hello from:', peerId, '- initiating offer');
          // Small delay to ensure both sides are subscribed
          setTimeout(() => connectToPeer(peerId), 300);
        }
      })
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.to === myPlayerId) {
          await handleOffer(payload.offer, payload.from);
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
      .on('broadcast', { event: 'webrtc-speaking-state' }, ({ payload }) => {
        if (payload.from) {
          activeSpeakers[payload.from] = payload.isSpeaking;
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[WebRTC] Subscribed to signalling channel, broadcasting hello');
          // Broadcast our presence - everyone else will offer us
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'webrtc-hello',
              payload: { from: myPlayerId, isBot: false }
            });
          }, 500);
        }
      });
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
      delete iceQueue[id];
      delete activeSpeakers[id];
    });
    delete activeSpeakers[myPlayerId];
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop());
      localStream.value = null;
    }
    isMuted.value = false;
  };

  return {
    remoteStreams,
    activeSpeakers,
    localStream,
    isMuted,
    initLocalStream,
    toggleLocalMute,
    setMicEnabled,
    startVoiceConference,
    closePeers
  };
}
