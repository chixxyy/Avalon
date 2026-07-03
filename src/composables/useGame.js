import { reactive, computed } from 'vue';
import { supabase } from '../supabase';

// Generate a random local ID for the user
const localPlayerId = 'player-' + Math.random().toString(36).substring(2, 9);

// Global reactive state
const state = reactive({
  roomCode: '',
  myPlayerId: localPlayerId,
  myPlayerName: '',
  players: [],
  gameState: 'lobby', 
  speakingState: {
    active: false,
    teamIds: [],      
    currentIndex: 0,  
    direction: null,  
    timeLeft: 60,     
    isMuted: false,   
  },
  currentRound: 1,      
  leaderId: '',         
  failedProposals: 0,   
  proposedTeam: [],     
  votes: {},            
  questVotes: [],       
  questHistory: [],     
  questTeamsHistory: [], 
  roundVotesHistory: {}, 
  gamePhase: 'proposal', 
  winner: null,         
  assassinatedPlayerId: '', 
  proposalTimeLeft: 0,   // kept for compat, now aliased as actionTimeLeft
  actionTimeLeft: 0,    // shared countdown for current phase
});

let channel = null;

const ROLE_CONFIGS = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 }
};

const getQuestSizeForRound = (numPlayers, round) => {
  const mapping = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5]
  };
  const list = mapping[numPlayers] || [2, 3, 2, 3, 3];
  return list[round - 1];
};

// Helper: Broadcast game state to everyone in room
const broadcastState = () => {
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'state-change',
      payload: { ...state }
    });
  }
};

export function useGame() {
  const myPlayer = computed(() => {
    return state.players.find(p => p.id === state.myPlayerId) || null;
  });

  const isHost = computed(() => {
    return myPlayer.value?.isHost || false;
  });

  const currentRoundQuestSize = computed(() => {
    return getQuestSizeForRound(state.players.length, state.currentRound);
  });

  const isRound4TwoFailsRequired = computed(() => {
    return state.currentRound === 4 && state.players.length >= 7;
  });

  // Subscribe to room channel and setup listeners
  const subscribeToRoom = (roomCode) => {
    if (channel) {
      channel.unsubscribe();
    }

    channel = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true } // receive own broadcasts to update state
      }
    });

    channel
      .on('broadcast', { event: 'state-change' }, ({ payload }) => {
        // Sync states except identity details to other players unless revealed
        state.gameState = payload.gameState;
        state.speakingState = payload.speakingState;
        state.currentRound = payload.currentRound;
        state.leaderId = payload.leaderId;
        state.failedProposals = payload.failedProposals;
        state.proposedTeam = payload.proposedTeam;
        state.votes = payload.votes;
        state.questVotes = payload.questVotes;
        state.questHistory = payload.questHistory;
        state.questTeamsHistory = payload.questTeamsHistory || [];
        state.roundVotesHistory = payload.roundVotesHistory || {};
        state.gamePhase = payload.gamePhase;
        state.winner = payload.winner;
        state.assassinatedPlayerId = payload.assassinatedPlayerId;
        state.actionTimeLeft = payload.actionTimeLeft ?? payload.proposalTimeLeft ?? 0;
        state.proposalTimeLeft = state.actionTimeLeft; // alias
        
        // Sync players list safely
        state.players = payload.players;
      })
      .on('broadcast', { event: 'player-joined' }, ({ payload }) => {
        if (isHost.value) {
          const exists = state.players.some(p => p.id === payload.id);
          if (!exists) {
            state.players.push(payload);
            broadcastState();
          }
        }
      })
      .on('broadcast', { event: 'player-left' }, ({ payload }) => {
        if (isHost.value) {
          state.players = state.players.filter(p => p.id !== payload.id);
          broadcastState();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!isHost.value) {
            channel.send({
              type: 'broadcast',
              event: 'player-joined',
              payload: {
                id: state.myPlayerId,
                name: state.myPlayerName,
                isHost: false,
                isBot: false,
                role: '',
                roleName: '',
                alignment: ''
              }
            });
          }
        }
      });
  };

  // Create room
  const createRoom = (playerName) => {
    if (!playerName.trim()) return { success: false, message: '請輸入暱稱' };
    
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.roomCode = roomCode;
    state.myPlayerName = playerName;
    state.gameState = 'waiting';
    state.players = [
      {
        id: state.myPlayerId,
        name: playerName,
        isHost: true,
        isBot: false,
        role: '',
        roleName: '',
        alignment: ''
      }
    ];

    subscribeToRoom(roomCode);
    
    // Auto-add 4 bots to quickly satisfy the 5-player minimum for convenience
    addBot();
    addBot();
    addBot();
    addBot();

    setTimeout(() => {
      broadcastState();
    }, 500);

    return { success: true };
  };

  // Join room
  const joinRoom = (code, playerName) => {
    if (!code.trim() || code.length !== 6) return { success: false, message: '請輸入 6 位數房間代碼' };
    if (!playerName.trim()) return { success: false, message: '請輸入暱稱' };

    state.roomCode = code.toUpperCase();
    state.myPlayerName = playerName;
    state.gameState = 'waiting';
    state.players = [];

    subscribeToRoom(state.roomCode);

    return { success: true };
  };

  // Add a Bot player
  const addBot = () => {
    if (!isHost.value) return { success: false, message: '只有房長能新增 Bot' };
    if (state.players.length >= 10) return { success: false, message: '房間已滿 (上限 10 人)' };

    const BOT_NAMES = ['蘭斯洛特 (Bot)', '加拉哈德 (Bot)', '高文 (Bot)', '崔斯坦 (Bot)', '珀西瓦里 (Bot)', '凱 (Bot)', '貝德維爾 (Bot)', '鮑斯 (Bot)', '傑拉恩特 (Bot)'];
    const currentNames = state.players.map(p => p.name);
    const availableNames = BOT_NAMES.filter(name => !currentNames.includes(name));
    
    if (availableNames.length === 0) return { success: false, message: '沒有更多可用角色名稱' };
    
    const botName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const botId = `bot-${Math.random().toString(36).substring(2, 9)}`;

    state.players.push({
      id: botId,
      name: botName,
      isHost: false,
      isBot: true,
      role: '',
      alignment: '',
    });

    broadcastState();
    return { success: true };
  };

  // Remove a player (either Bot or host kick)
  const removePlayer = (playerId) => {
    if (playerId === state.myPlayerId) {
      leaveRoom();
      return;
    }
    if (isHost.value) {
      state.players = state.players.filter(p => p.id !== playerId);
      broadcastState();
    }
  };

  // Start the game and allocate roles
  const startGame = () => {
    if (!isHost.value) return { success: false };
    const numPlayers = state.players.length;
    if (numPlayers < 5 || numPlayers > 10) {
      return { success: false, message: '人數必須在 5 到 10 人之間才能開始遊戲' };
    }

    const config = ROLE_CONFIGS[numPlayers];
    
    // Base roles setup
    const goodRoles = [{ role: 'Merlin', name: '梅林', alignment: 'good' }];
    const evilRoles = [{ role: 'Assassin', name: '刺客', alignment: 'evil' }];

    // If 7 players or more, add advanced roles: Percival (好人) & Morgana (壞人)
    const isAdvancedMode = numPlayers >= 7;
    
    let goodToAssign = config.good - 1;
    let evilToAssign = config.evil - 1;

    if (isAdvancedMode) {
      goodRoles.push({ role: 'Percival', name: '派西維爾', alignment: 'good' });
      goodToAssign--;
      
      evilRoles.push({ role: 'Morgana', name: '莫甘娜', alignment: 'evil' });
      evilToAssign--;
    }

    // If 9 players or more, add Mordred (who is hidden from Merlin)
    const isMordredMode = numPlayers >= 9;
    if (isMordredMode) {
      evilRoles.push({ role: 'Mordred', name: '莫德雷德', alignment: 'evil' });
      evilToAssign--;
    }

    // Fill remaining spots with Loyalists and Minions
    for (let i = 0; i < goodToAssign; i++) {
      goodRoles.push({ role: 'Loyalist', name: '亞瑟的忠臣', alignment: 'good' });
    }
    for (let i = 0; i < evilToAssign; i++) {
      evilRoles.push({ role: 'Minion', name: '莫德雷德的爪牙', alignment: 'evil' });
    }

    const pool = [...goodRoles, ...evilRoles];
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    state.players.forEach((player, idx) => {
      player.role = pool[idx].role;
      player.roleName = pool[idx].name;
      player.alignment = pool[idx].alignment;
    });

    state.currentRound = 1;
    state.failedProposals = 0;
    state.proposedTeam = [];
    state.votes = {};
    state.questVotes = [];
    state.questHistory = [];
    state.questTeamsHistory = [];
    state.roundVotesHistory = {};
    state.winner = null;
    state.assassinatedPlayerId = '';
    state.gamePhase = 'proposal';
    
    const leaderIndex = Math.floor(Math.random() * state.players.length);
    state.leaderId = state.players[leaderIndex].id;
    state.gameState = 'playing';

    resetActionTimer('proposal');
    return { success: true };
  };

  // ─── Unified per-phase action countdown ──────────────────────────────────
  const PHASE_TIMEOUTS = {
    proposal:     20,
    discussion:   20,  // speaking direction choice
    voting:       30,
    quest:        30,
    assassination: 60,
    gameover:      0,
  };

  // Reset timer at phase start — only host calls this
  const resetActionTimer = (phase) => {
    if (!isHost.value) return;
    const secs = PHASE_TIMEOUTS[phase] ?? 0;
    state.actionTimeLeft = secs;
    state.proposalTimeLeft = secs; // alias
    broadcastState();
  };

  // Called by host's setInterval every second
  const tickActionTimer = () => {
    if (!isHost.value) return;

    // 如果在討論階段且已經選定方向（開始輪流發言），改由 tickSpeakingTimer 驅動
    if (state.gamePhase === 'discussion' && state.speakingState.direction !== null) {
      return;
    }

    if (state.actionTimeLeft <= 0) return;
    state.actionTimeLeft--;
    state.proposalTimeLeft = state.actionTimeLeft; // alias
    broadcastState();

    if (state.actionTimeLeft === 0) {
      handlePhaseTimeout(state.gamePhase);
    }
  };

  // Auto-action when timer expires — host only
  const handlePhaseTimeout = (phase) => {
    if (!isHost.value) return;

    if (phase === 'proposal') {
      // Auto-propose: leader + random others
      const questSize = currentRoundQuestSize.value;
      const leader = state.players.find(p => p.id === state.leaderId);
      if (!leader || leader.isBot) return; // bots handle themselves
      const others = state.players.filter(p => p.id !== state.leaderId);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const autoTeam = [state.leaderId, ...others.slice(0, questSize - 1).map(p => p.id)];
      proposeTeam(autoTeam);

    } else if (phase === 'discussion') {
      // Auto-choose random speaking direction
      const dir = Math.random() < 0.5 ? 'cw' : 'ccw';
      setSpeakingDirection(dir);

    } else if (phase === 'voting') {
      // Auto-approve for all players who haven't voted yet
      state.players.forEach(p => {
        if (!state.votes[p.id]) {
          submitTeamVote(p.id, 'approve');
        }
      });

    } else if (phase === 'quest') {
      // Auto-fill missing quest votes with 'pass'
      const needed = state.proposedTeam.length - state.questVotes.length;
      for (let i = 0; i < needed; i++) {
        submitQuestVote('pass');
      }

    } else if (phase === 'assassination') {
      // Auto-assassinate: pick a random good player
      const goodPlayers = state.players.filter(p => p.alignment === 'good' && p.role !== 'Merlin');
      const merlin = state.players.find(p => p.role === 'Merlin');
      // 30% chance to pick Merlin (slightly favor evil to make timeout not too advantageous)
      const pool = merlin ? [...goodPlayers, merlin] : goodPlayers;
      if (pool.length > 0) {
        const target = pool[Math.floor(Math.random() * pool.length)];
        assassinatePlayer(target.id);
      }
    }
  };

  const proposeTeam = (teamIds) => {
    if (teamIds.length !== currentRoundQuestSize.value) return { success: false };
    
    state.proposedTeam = [...teamIds];
    const leader = state.players.find(p => p.id === state.leaderId) || state.players[0];
    const otherPlayers = state.players.filter(p => p.id !== leader.id);
    const order = [leader.id, ...otherPlayers.map(p => p.id)];

    state.speakingState = {
      active: true,
      teamIds: order,
      currentIndex: 0,
      direction: null,
      timeLeft: 60,
      isMuted: false
    };
    state.gamePhase = 'discussion';

    broadcastState();
    resetActionTimer('discussion');
    return { success: true };
  };

  const setSpeakingDirection = (direction) => {
    state.speakingState.direction = direction;
    state.speakingState.timeLeft = 60;

    const firstSpeakerId = state.speakingState.teamIds[0];
    const roomPlayerIds = state.players.map(p => p.id);
    const firstSpeakerIndex = roomPlayerIds.indexOf(firstSpeakerId);

    let sorted = [];
    if (direction === 'cw') {
      for (let i = 0; i < roomPlayerIds.length; i++) {
        sorted.push(roomPlayerIds[(firstSpeakerIndex + i) % roomPlayerIds.length]);
      }
    } else {
      for (let i = 0; i < roomPlayerIds.length; i++) {
        sorted.push(roomPlayerIds[(firstSpeakerIndex - i + roomPlayerIds.length) % roomPlayerIds.length]);
      }
    }
    state.speakingState.teamIds = sorted;
    state.speakingState.currentIndex = 0;

    broadcastState();
    resetActionTimer('voting'); // speaking direction chosen → move to discussion+voting flow
  };

  const passSpeaking = () => {
    if (state.speakingState.currentIndex < state.speakingState.teamIds.length - 1) {
      state.speakingState.currentIndex++;
      state.speakingState.timeLeft = 60;
    } else {
      state.speakingState.active = false;
      state.gamePhase = 'voting';
      state.votes = {};
    }
    broadcastState();
  };

  const tickSpeakingTimer = () => {
    if (!isHost.value || !state.speakingState.active || state.speakingState.direction === null) return;

    if (state.speakingState.timeLeft > 0) {
      state.speakingState.timeLeft--;
    } else {
      if (state.speakingState.currentIndex < state.speakingState.teamIds.length - 1) {
        state.speakingState.currentIndex++;
        state.speakingState.timeLeft = 60;
      } else {
        state.speakingState.active = false;
        state.gamePhase = 'voting';
        state.votes = {};
      }
    }
    broadcastState();
  };

  // Proposal phase countdown — called by host's setInterval every second
  // Remove old proposal-only timer functions (now handled by tickActionTimer/resetActionTimer)
  // kept for backward compat shim
  const tickProposalTimer = () => tickActionTimer();
  const resetProposalTimer = () => resetActionTimer(state.gamePhase);

  const submitTeamVote = (playerId, vote) => {
    state.votes[playerId] = vote;

    if (Object.keys(state.votes).length === state.players.length) {
      state.roundVotesHistory[state.currentRound] = { ...state.votes };

      const approves = Object.values(state.votes).filter(v => v === 'approve').length;
      const rejects = state.players.length - approves;

      if (approves > rejects) {
        state.gamePhase = 'quest';
        state.questVotes = [];
        resetActionTimer('quest');
      } else {
        state.failedProposals++;
        if (state.failedProposals >= 5) {
          state.questHistory.push('fail');
          state.questTeamsHistory.push([...state.proposedTeam]);
          checkGameCompletion();
        } else {
          const currentLeaderIdx = state.players.findIndex(p => p.id === state.leaderId);
          state.leaderId = state.players[(currentLeaderIdx + 1) % state.players.length].id;
          state.gamePhase = 'proposal';
          state.proposedTeam = [];
          resetActionTimer('proposal');
        }
      }
    } else {
      // 重置當前投票階段的秒數，避免有人投票時秒數快用完導致其他人來不及投
      resetActionTimer('voting');
    }
    broadcastState();
  };

  const submitQuestVote = (vote) => {
    state.questVotes.push(vote);

    if (state.questVotes.length === state.proposedTeam.length) {
      const failsCount = state.questVotes.filter(v => v === 'fail').length;
      const isRound4 = state.currentRound === 4;
      const requiresTwoFails = isRound4 && state.players.length >= 7;
      const roundFailed = requiresTwoFails ? failsCount >= 2 : failsCount >= 1;

      state.questTeamsHistory.push([...state.proposedTeam]);

      if (roundFailed) {
        state.questHistory.push('fail');
      } else {
        state.questHistory.push('success');
      }

      checkGameCompletion();
    } else {
      // 每次有隊員遞交出征秘密卡，就為剩下的隊員重置 30 秒倒數，防斷線/輪候過久卡住
      resetActionTimer('quest');
    }
    broadcastState();
  };

  const assassinatePlayer = (targetPlayerId) => {
    state.assassinatedPlayerId = targetPlayerId;
    const target = state.players.find(p => p.id === targetPlayerId);

    if (target && target.role === 'Merlin') {
      state.winner = 'evil';
    } else {
      state.winner = 'good';
    }
    state.gamePhase = 'gameover';

    broadcastState();
  };

  const checkGameCompletion = () => {
    const successCount = state.questHistory.filter(h => h === 'success').length;
    const failCount = state.questHistory.filter(h => h === 'fail').length;

    if (failCount >= 3) {
      state.winner = 'evil';
      state.gamePhase = 'gameover';
    } else if (successCount >= 3) {
      state.gamePhase = 'assassination';
      resetActionTimer('assassination');
    } else {
      state.currentRound++;
      state.failedProposals = 0;
      state.proposedTeam = [];
      const currentLeaderIdx = state.players.findIndex(p => p.id === state.leaderId);
      state.leaderId = state.players[(currentLeaderIdx + 1) % state.players.length].id;
      state.gamePhase = 'proposal';
      resetActionTimer('proposal');
    }
  };

  const resetGame = () => {
    state.players.forEach(p => {
      p.role = '';
      p.roleName = '';
      p.alignment = '';
    });
    state.gameState = 'waiting';
    state.questTeamsHistory = [];
    state.roundVotesHistory = {};
    state.speakingState.active = false;
    broadcastState();
  };

  const leaveRoom = () => {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'player-left',
        payload: { id: state.myPlayerId }
      });
      channel.unsubscribe();
      channel = null;
    }
    state.roomCode = '';
    state.players = [];
    state.gameState = 'lobby';
    state.questTeamsHistory = [];
    state.roundVotesHistory = {};
  };

  const toggleMute = () => {
    state.speakingState.isMuted = !state.speakingState.isMuted;
  };

  const getRevealedInfoForPlayer = (player) => {
    if (!player) return { evilPlayers: [], teammates: [] };

    // Merlin sees all evil EXCEPT Mordred
    const evilPlayers = state.players
      .filter(p => p.alignment === 'evil' && p.role !== 'Mordred')
      .map(p => p.name);

    if (player.role === 'Merlin') {
      return {
        role: 'Merlin',
        evilPlayers: evilPlayers,
        description: '你看到了所有邪惡陣營的爪牙（包含莫甘娜），但莫德雷德對你隱身，你無法看見他。同時你必須保護自己不被刺客認出。',
      };
    }

    if (player.role === 'Percival') {
      // Sees Merlin and Morgana as candidates (cannot distinguish who is who)
      const candidates = state.players
        .filter(p => p.role === 'Merlin' || p.role === 'Morgana')
        .map(p => p.name);
      return {
        role: 'Percival',
        candidates: candidates,
        description: `你看到了真正的梅林與假冒梅林的邪惡莫甘娜：【${candidates.join('、')}】。你必須設法查明真相，引導好人，同時保護真梅林。`
      };
    }

    if (player.alignment === 'evil') {
      const teammates = state.players
        .filter(p => p.alignment === 'evil' && p.id !== player.id)
        .map(p => p.name);
      
      let roleDesc = '';
      if (player.role === 'Assassin') {
        roleDesc = '你是刺客！在遊戲結束時，若好人任務成功，你可以指認梅林，若指認正確邪惡陣營將逆轉獲勝。';
      } else if (player.role === 'Morgana') {
        roleDesc = '你是莫甘娜！你的任務是假冒梅林以迷惑派西維爾的法眼，並配合爪牙阻礙任務。';
      } else if (player.role === 'Mordred') {
        roleDesc = '你是莫德雷德！你是邪惡陣營的隱形首領。你的特殊能力是對梅林隱身（梅林無法看見你），請利用此優勢誤導好人！';
      } else {
        roleDesc = '你是莫德雷德的爪牙，配合刺客與莫甘娜隱藏身分，並破壞好人的任務！';
      }

      return {
        role: player.role,
        teammates: teammates,
        description: roleDesc
      };
    }

    return {
      role: 'Loyalist',
      description: '你是亞瑟的忠臣！協助梅林並確保任務成功，同時要注意保護梅林不被刺客發現。',
    };
  };

  return {
    state,
    myPlayer,
    isHost,
    currentRoundQuestSize,
    isRound4TwoFailsRequired,
    createRoom,
    joinRoom,
    addBot,
    removePlayer,
    leaveRoom,
    startGame,
    resetGame,
    getRevealedInfoForPlayer,
    setSpeakingDirection,
    passSpeaking,
    toggleMute,
    tickSpeakingTimer,
    tickProposalTimer,
    resetProposalTimer,
    proposeTeam,
    submitTeamVote,
    submitQuestVote,
    assassinatePlayer,
  };
}
