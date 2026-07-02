import { reactive, computed } from 'vue';

// Global reactive state
const state = reactive({
  roomCode: '',
  myPlayerId: '',
  myPlayerName: '',
  players: [],
  gameState: 'lobby', // 'lobby' | 'waiting' | 'playing'
  speakingState: {
    active: false,
    teamIds: [],      // 參與發言的玩家 ID 列表 (出征成員)
    currentIndex: 0,  // 當前發言玩家在 teamIds 中的 index
    direction: null,  // 'cw' (順時針) | 'ccw' (逆時針) | null (未決定)
    timeLeft: 60,     // 剩餘發言時間 (秒)
    isMuted: false,   // 本地真實玩家是否麥克風靜音
  },
  // Full game flow states
  currentRound: 1,      // 1 to 5
  leaderId: '',         // Current round leader ID
  failedProposals: 0,   // Number of failed team proposals in current round (0 to 5)
  proposedTeam: [],     // Player IDs proposed for the mission
  votes: {},            // Team proposal votes: { playerId: 'approve' | 'reject' }
  questVotes: [],       // Secret votes from quest team: Array of 'success' | 'fail'
  questHistory: [],     // Results of each of the 5 rounds: Array of 'success' | 'fail' (max 5)
  questTeamsHistory: [], // Proposed team IDs for each round: Array of arrays (e.g. [['player-1', 'bot-1'], ...])
  roundVotesHistory: {}, // Proposal votes record for each round: { roundNumber: { playerId: 'approve' | 'reject' } }
  gamePhase: 'proposal', // 'proposal' | 'discussion' | 'voting' | 'quest' | 'assassination' | 'gameover'
  winner: null,         // 'good' | 'evil' | null
  assassinatedPlayerId: '', // Assassin's target ID
});

const BOT_NAMES = [
  '蘭斯洛特 (Bot)',
  '加拉哈德 (Bot)',
  '高文 (Bot)',
  '崔斯坦 (Bot)',
  '珀西瓦里 (Bot)',
  '凱 (Bot)',
  '貝德維爾 (Bot)',
  '鮑斯 (Bot)',
  '杰拉恩特 (Bot)',
];

// Round size config based on player count
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

  // Check if round 4 requires 2 fail votes (7 players or more)
  const isRound4TwoFailsRequired = computed(() => {
    return state.currentRound === 4 && state.players.length >= 7;
  });

  // Generate a random room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Create room
  const createRoom = (playerName) => {
    if (!playerName.trim()) return { success: false, message: '請輸入暱稱' };
    
    const code = generateRoomCode();
    const myId = 'player-1';
    
    state.roomCode = code;
    state.myPlayerId = myId;
    state.myPlayerName = playerName;
    state.gameState = 'waiting';
    state.players = [
      {
        id: myId,
        name: playerName,
        isHost: true,
        isBot: false,
        role: '',
        alignment: '',
      }
    ];

    // Auto-add 4 bots to quickly satisfy the 5-player minimum for convenience
    addBot();
    addBot();
    addBot();
    addBot();

    return { success: true };
  };

  // Join room
  const joinRoom = (code, playerName) => {
    if (!code.trim() || code.length !== 6) return { success: false, message: '請輸入 6 位數房間代碼' };
    if (!playerName.trim()) return { success: false, message: '請輸入暱稱' };

    const myId = 'player-1';
    state.roomCode = code.toUpperCase();
    state.myPlayerId = myId;
    state.myPlayerName = playerName;
    state.gameState = 'waiting';

    // Mock other players already in the room
    const hostName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    state.players = [
      {
        id: 'player-host',
        name: `${hostName} (房長)`,
        isHost: true,
        isBot: true,
        role: '',
        alignment: '',
      },
      {
        id: myId,
        name: playerName,
        isHost: false,
        isBot: false,
        role: '',
        alignment: '',
      }
    ];

    // Add 3 more bots to make it 5 players
    while (state.players.length < 5) {
      addBot();
    }

    return { success: true };
  };

  // Add a Bot player
  const addBot = () => {
    if (state.players.length >= 10) return { success: false, message: '房間已滿 (上限 10 人)' };

    // Find unused bot names
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

    return { success: true };
  };

  // Remove a player (either Bot or host kick)
  const removePlayer = (playerId) => {
    if (playerId === state.myPlayerId) {
      // Leave room
      leaveRoom();
      return;
    }
    state.players = state.players.filter(p => p.id !== playerId);
  };



  // Start the game and allocate roles
  const startGame = () => {
    const numPlayers = state.players.length;
    if (numPlayers < 5 || numPlayers > 10) {
      return { success: false, message: '人數必須在 5 到 10 人之間才能開始遊戲' };
    }

    // Role count rules
    let goodCount = 3;
    let evilCount = 2;
    if (numPlayers === 6) { goodCount = 4; evilCount = 2; }
    else if (numPlayers === 7) { goodCount = 4; evilCount = 3; }
    else if (numPlayers === 8) { goodCount = 5; evilCount = 3; }
    else if (numPlayers === 9) { goodCount = 6; evilCount = 3; }
    else if (numPlayers === 10) { goodCount = 6; evilCount = 4; }

    // Roles definition
    // Good: Merlin (梅林), Loyalist (亞瑟的忠臣)
    // Evil: Assassin (刺客), Minion (莫德雷德的爪牙)
    const goodRoles = [{ role: 'Merlin', name: '梅林', alignment: 'good' }];
    for (let i = 0; i < goodCount - 1; i++) {
      goodRoles.push({ role: 'Loyalist', name: '亞瑟的忠臣', alignment: 'good' });
    }

    const evilRoles = [{ role: 'Assassin', name: '刺客', alignment: 'evil' }];
    for (let i = 0; i < evilCount - 1; i++) {
      evilRoles.push({ role: 'Minion', name: '莫德雷德的爪牙', alignment: 'evil' });
    }

    const pool = [...goodRoles, ...evilRoles];

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Assign roles to players
    state.players.forEach((player, idx) => {
      player.role = pool[idx].role;
      player.roleName = pool[idx].name;
      player.alignment = pool[idx].alignment;
    });

    // Reset game progression states
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
    
    // Choose first leader randomly
    const leaderIndex = Math.floor(Math.random() * state.players.length);
    state.leaderId = state.players[leaderIndex].id;

    state.gameState = 'playing';
    return { success: true };
  };

  // Reset back to waiting room
  const resetGame = () => {
    state.players.forEach(p => {
      p.role = '';
      p.roleName = '';
      p.alignment = '';
    });
    state.gameState = 'waiting';
    state.questTeamsHistory = [];
    state.roundVotesHistory = {};
    endSpeakingPhase();
  };
 
  // Leave room
  const leaveRoom = () => {
    state.roomCode = '';
    state.myPlayerId = '';
    state.myPlayerName = '';
    state.players = [];
    state.gameState = 'lobby';
    state.questTeamsHistory = [];
    state.roundVotesHistory = {};
    endSpeakingPhase();
  };

  // Start speaking phase (all players participate, starting with leader/host)
  const startSpeakingPhase = () => {
    const currentLeader = state.players.find(p => p.id === state.leaderId) || state.players[0];
    if (!currentLeader) return;
    
    // Put leader first, followed by others in normal room order
    const otherPlayers = state.players.filter(p => p.id !== currentLeader.id);
    const initialSpeechOrder = [currentLeader.id, ...otherPlayers.map(p => p.id)];
    
    state.speakingState.active = true;
    state.speakingState.teamIds = initialSpeechOrder;
    state.speakingState.currentIndex = 0;
    state.speakingState.direction = null;
    state.speakingState.timeLeft = 60;
    state.speakingState.isMuted = false;
    state.gamePhase = 'discussion';
  };

  // Set direction and begin speaking phase for all players
  const setSpeakingDirection = (direction) => {
    state.speakingState.direction = direction;
    state.speakingState.timeLeft = 60;
    
    if (state.players.length <= 1) return;

    // Get the first speaker (who made the decision, usually leader)
    const firstSpeakerId = state.speakingState.teamIds[0];
    const roomPlayerIds = state.players.map(p => p.id);
    const firstSpeakerRoomIndex = roomPlayerIds.indexOf(firstSpeakerId);
    
    let sortedPlayerIds = [];
    if (direction === 'cw') {
      // Clockwise order starting from firstSpeaker
      for (let i = 0; i < roomPlayerIds.length; i++) {
        const idx = (firstSpeakerRoomIndex + i) % roomPlayerIds.length;
        sortedPlayerIds.push(roomPlayerIds[idx]);
      }
    } else {
      // Counter-clockwise order starting from firstSpeaker
      for (let i = 0; i < roomPlayerIds.length; i++) {
        const idx = (firstSpeakerRoomIndex - i + roomPlayerIds.length) % roomPlayerIds.length;
        sortedPlayerIds.push(roomPlayerIds[idx]);
      }
    }
    state.speakingState.teamIds = sortedPlayerIds;
    state.speakingState.currentIndex = 0;
  };

  // Pass speaking to next player
  const passSpeaking = () => {
    if (state.speakingState.currentIndex < state.speakingState.teamIds.length - 1) {
      state.speakingState.currentIndex++;
      state.speakingState.timeLeft = 60;
    } else {
      // All players spoken, close discussion phase and move to voting phase
      endSpeakingPhase();
      state.gamePhase = 'voting';
      state.votes = {};
    }
  };

  // Toggle my mute status
  const toggleMute = () => {
    state.speakingState.isMuted = !state.speakingState.isMuted;
  };

  // End speaking phase
  const endSpeakingPhase = () => {
    state.speakingState.active = false;
    state.speakingState.teamIds = [];
    state.speakingState.currentIndex = 0;
    state.speakingState.direction = null;
    state.speakingState.timeLeft = 60;
  };

  // Tick timer
  const tickSpeakingTimer = () => {
    if (!state.speakingState.active || state.speakingState.direction === null) return;
    if (state.speakingState.timeLeft > 0) {
      state.speakingState.timeLeft--;
    } else {
      passSpeaking();
    }
  };

  // Actions for Proposal Phase
  const proposeTeam = (teamIds) => {
    if (teamIds.length !== currentRoundQuestSize.value) return { success: false, message: '指派人數不符合規定' };
    state.proposedTeam = [...teamIds];
    startSpeakingPhase(); // Automatically move to speaking phase
    return { success: true };
  };

  // Actions for Proposal Voting Phase
  const submitTeamVote = (playerId, vote) => {
    state.votes[playerId] = vote;
    
    // Check if everyone voted
    if (Object.keys(state.votes).length === state.players.length) {
      // Record proposal votes for this round (save a snapshot)
      state.roundVotesHistory[state.currentRound] = { ...state.votes };

      // Process votes
      const approves = Object.values(state.votes).filter(v => v === 'approve').length;
      const rejects = state.players.length - approves;
      
      if (approves > rejects) {
        // Team proposal approved! Transition to secret quest voting
        state.gamePhase = 'quest';
        state.questVotes = [];
      } else {
        // Proposal rejected! Move leader to next player, increment failed count
        state.failedProposals++;
        
        if (state.failedProposals >= 5) {
          // 5th fail means Evil automatically wins this round
          state.questHistory.push('fail');
          state.questTeamsHistory.push([...state.proposedTeam]); // Record the last proposed team that was forced/failed
          checkGameCompletion();
        } else {
          // Pass leader to next player clockwise
          const currentLeaderIndex = state.players.findIndex(p => p.id === state.leaderId);
          const nextLeaderIndex = (currentLeaderIndex + 1) % state.players.length;
          state.leaderId = state.players[nextLeaderIndex].id;
          state.gamePhase = 'proposal';
          state.proposedTeam = [];
        }
      }
    }
  };

  // Actions for Quest Execution Phase
  const submitQuestVote = (vote) => {
    state.questVotes.push(vote);
    
    // If all mission members voted
    if (state.questVotes.length === state.proposedTeam.length) {
      const failsCount = state.questVotes.filter(v => v === 'fail').length;
      const isTwoFailsRequired = isRound4TwoFailsRequired.value;
      const roundFailed = isTwoFailsRequired ? failsCount >= 2 : failsCount >= 1;
      
      state.questTeamsHistory.push([...state.proposedTeam]); // Record the actual quest proposal team members
      
      if (roundFailed) {
        state.questHistory.push('fail');
      } else {
        state.questHistory.push('success');
      }
      
      checkGameCompletion();
    }
  };

  const checkGameCompletion = () => {
    const successCount = state.questHistory.filter(h => h === 'success').length;
    const failCount = state.questHistory.filter(h => h === 'fail').length;
    
    if (failCount >= 3) {
      // Evil wins!
      state.winner = 'evil';
      state.gamePhase = 'gameover';
    } else if (successCount >= 3) {
      // Good wins 3 quests, transition to Assassin target choice phase
      state.gamePhase = 'assassination';
    } else {
      // Next round setup
      state.currentRound++;
      state.failedProposals = 0;
      state.proposedTeam = [];
      // Pass leader to next player clockwise
      const currentLeaderIndex = state.players.findIndex(p => p.id === state.leaderId);
      const nextLeaderIndex = (currentLeaderIndex + 1) % state.players.length;
      state.leaderId = state.players[nextLeaderIndex].id;
      state.gamePhase = 'proposal';
    }
  };

  // Assassin kill action
  const assassinatePlayer = (targetPlayerId) => {
    state.assassinatedPlayerId = targetPlayerId;
    const targetPlayer = state.players.find(p => p.id === targetPlayerId);
    
    if (targetPlayer && targetPlayer.role === 'Merlin') {
      // Successfully assassinated Merlin! Evil wins!
      state.winner = 'evil';
    } else {
      // Failed to assassinate Merlin! Good wins!
      state.winner = 'good';
    }
    state.gamePhase = 'gameover';
  };

  // Get info revealed to a specific player
  // Merlin: Sees all evil players (but doesn't know who is Assassin vs Minion)
  // Evil: Sees all other evil players
  // Loyalist: Sees nothing
  const getRevealedInfoForPlayer = (player) => {
    if (!player) return { evilPlayers: [], teammates: [] };

    const evilPlayers = state.players
      .filter(p => p.alignment === 'evil')
      .map(p => p.name);

    if (player.role === 'Merlin') {
      return {
        role: 'Merlin',
        evilPlayers: evilPlayers,
        description: '你看到了所有邪惡陣營的爪牙，但不知道他們的具體身份，且你必須保護自己不被刺客認出。',
      };
    }

    if (player.alignment === 'evil') {
      const teammates = state.players
        .filter(p => p.alignment === 'evil' && p.id !== player.id)
        .map(p => p.name);
      
      return {
        role: player.role,
        teammates: teammates,
        description: player.role === 'Assassin' 
          ? '你是刺客！在遊戲結束時，若好人任務成功，你可以指認梅林，若指認正確邪惡陣營將逆轉獲勝。' 
          : '你是莫德雷德的爪牙，配合刺客隱藏身分，並破壞好人的任務！',
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
    startSpeakingPhase,
    setSpeakingDirection,
    passSpeaking,
    toggleMute,
    endSpeakingPhase,
    tickSpeakingTimer,
    proposeTeam,
    submitTeamVote,
    submitQuestVote,
    assassinatePlayer,
  };
}
