<template>
  <div class="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left column: Players List & Game Round status -->
    <div class="lg:col-span-1 space-y-6">
      
      <!-- Quest Progress Board -->
      <div class="glass-panel rounded-2xl p-5 border border-slate-800/80 shadow-xl space-y-4">
        <h3 class="font-serif text-sm font-semibold uppercase tracking-wider text-amber-500 border-b border-slate-800 pb-2 flex items-center justify-between">
          <span>🏆 聖杯任務進度</span>
          <span class="text-[10px] text-slate-500 font-sans tracking-normal">第 {{ state.currentRound }} / 5 回合</span>
        </h3>
        
        <div class="grid grid-cols-5 gap-2">
          <div 
            v-for="r in 5" 
            :key="r"
            @click="viewRoundHistory(r)"
            class="flex flex-col items-center justify-between p-2 rounded-xl border text-center h-20 relative overflow-hidden transition-all duration-300 cursor-pointer active:scale-95 hover:border-amber-500/50"
            :class="[
              selectedRoundInfo === r ? 'ring-1 ring-amber-500 border-amber-500' : '',
              state.questHistory[r-1] === 'success'
                ? 'bg-blue-950/40 border-blue-500/40 text-blue-400'
                : state.questHistory[r-1] === 'fail'
                  ? 'bg-red-950/40 border-red-500/40 text-red-400'
                  : state.currentRound === r
                    ? 'bg-amber-500/5 border-amber-500/30 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.1)]'
                    : 'bg-slate-950/20 border-slate-900 text-slate-600'
            ]"
          >
            <span class="text-[9px] uppercase font-semibold">R{{ r }}</span>
            <div class="text-xl">
              <span v-if="state.questHistory[r-1] === 'success'">🏆</span>
              <span v-else-if="state.questHistory[r-1] === 'fail'">💀</span>
              <span v-else>⚔️</span>
            </div>
            <span class="text-[9px] font-mono opacity-80">
              {{ getQuestSizeTextForRound(r) }}人{{ r === 4 && state.players.length >= 7 ? '*' : '' }}
            </span>
          </div>
        </div>

        <!-- Selected Round Proposal History Detail Card -->
        <div v-if="selectedRoundInfo && getTeamForRound(selectedRoundInfo)" class="p-3.5 bg-slate-950/70 border border-slate-900 rounded-xl space-y-3 animate-fadeIn">
          <div>
            <p class="text-[10px] text-amber-500/80 font-serif font-bold uppercase tracking-wider">
              📜 第 {{ selectedRoundInfo }} 回合出征歷史隊伍：
            </p>
            <div class="flex flex-wrap gap-1.5 pt-1.5">
              <span 
                v-for="id in getTeamForRound(selectedRoundInfo)" 
                :key="'hist-member-'+id" 
                class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] rounded-lg text-slate-300 font-medium"
              >
                🛡️ {{ getPlayerNameById(id) }}
              </span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px]">
            <span class="text-slate-500">出征結果：</span>
            <span class="font-serif font-bold" :class="state.questHistory[selectedRoundInfo-1] === 'success' ? 'text-blue-400' : 'text-red-400'">
              {{ state.questHistory[selectedRoundInfo-1] === 'success' ? '🏆 任務成功' : '💀 任務失敗' }}
            </span>
          </div>
        </div>
        <div v-else-if="selectedRoundInfo" class="p-3 bg-slate-950/30 border border-slate-900/60 rounded-xl text-center text-[10px] text-slate-600 italic">
          第 {{ selectedRoundInfo }} 回合尚未指派並完成出征任務。
        </div>

        <p class="text-[10px] text-slate-500 italic mt-1 leading-relaxed">
          * 註：7人以上遊戲之第 4 回合需 2 張失敗票才算失敗。
        </p>

        <!-- Proposal Rejects Counter (0 to 5) -->
        <div class="bg-slate-950/40 p-3.5 border border-slate-900 rounded-xl space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 font-serif">當前回合否決次數：</span>
            <span class="font-bold font-mono text-glow-gold" :class="state.failedProposals >= 4 ? 'text-red-500' : 'text-amber-500'">
              {{ state.failedProposals }} / 5
            </span>
          </div>
          <!-- Progress dots -->
          <div class="flex gap-1.5 justify-center">
            <div 
              v-for="d in 5" 
              :key="d"
              class="h-2 rounded-full transition-all duration-300"
              :class="[
                d <= state.failedProposals
                  ? 'w-6 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)]'
                  : 'w-2 bg-slate-800'
              ]"
            ></div>
          </div>
          <p class="text-[9px] text-slate-500 text-center leading-relaxed">
            * 若否決累計達到第 5 次，邪惡陣營將直接贏得該任務回合！
          </p>
        </div>
      </div>

      <!-- Players Directory -->
      <div class="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-xl">
        <div class="border-b border-slate-800 pb-3 mb-4">
          <h3 class="font-serif text-sm font-semibold uppercase tracking-wider text-amber-500 flex items-center justify-between">
            <span>🛡️ 圓桌會議成員 ({{ state.players.length }})</span>
          </h3>
          <span class="text-[10px] text-slate-500 font-sans tracking-normal block mt-1">點擊玩家可快速切換除錯視角</span>
        </div>
        
        <div class="space-y-2.5">
          <div
            v-for="p in state.players"
            :key="p.id"
            @click="testPerspectiveId = p.id"
            class="flex items-center justify-between p-3 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden"
            :class="[
              state.speakingState.active && state.speakingState.teamIds[state.speakingState.currentIndex] === p.id
                ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse'
                : testPerspectiveId === p.id
                  ? 'bg-amber-500/10 border-amber-500/30 shadow-md'
                  : 'bg-slate-950/40 border-slate-900/60 hover:bg-slate-900/40 hover:border-slate-800'
            ]"
          >
            <!-- Highlight bar for active speaker -->
            <div v-if="state.speakingState.active && state.speakingState.teamIds[state.speakingState.currentIndex] === p.id" 
                 class="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>

            <div class="flex items-center gap-3">
              <!-- Avatar Circle -->
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors duration-300"
                :class="[
                  state.speakingState.active && state.speakingState.teamIds[state.speakingState.currentIndex] === p.id
                    ? 'border-amber-500 text-amber-400 bg-amber-950/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : p.id === state.myPlayerId 
                      ? 'border-amber-500/40 text-amber-500 bg-slate-900/60' 
                      : 'border-slate-800 text-slate-400 bg-slate-950/80'
                ]"
              >
                {{ p.name.substring(0, 1) }}
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-semibold" :class="state.speakingState.active && state.speakingState.teamIds[state.speakingState.currentIndex] === p.id ? 'text-amber-300 text-glow-gold' : 'text-slate-200'">
                  {{ p.name }}
                </span>
                <span class="text-[9px] text-slate-500 mt-0.5">
                  座次: #{{ state.players.findIndex(x => x.id === p.id) + 1 }}
                </span>
              </div>
            </div>
            
            <!-- Badges aligned right -->
            <div class="flex items-center flex-wrap justify-end gap-1.5 max-w-[60%] shrink-0">
              <!-- Proposal team selection indicator -->
              <span v-if="state.proposedTeam.includes(p.id)" class="text-[9px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-md font-medium tracking-wide whitespace-nowrap">
                出征
              </span>

              <!-- Leader badge -->
              <span v-if="p.id === state.leaderId" class="text-[9px] bg-amber-500/10 border border-amber-500/40 text-amber-400 font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm whitespace-nowrap">
                👑 領袖
              </span>

              <!-- Speaking Indicator -->
              <span v-if="state.speakingState.active && state.speakingState.teamIds[state.speakingState.currentIndex] === p.id" 
                    class="text-[9px] bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 animate-bounce whitespace-nowrap">
                🎙️ 發言
              </span>
              <span v-else-if="state.speakingState.active && state.speakingState.teamIds.includes(p.id)"
                    class="text-[9px] bg-slate-900 border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                候發
              </span>
              
              <span v-if="p.id === state.myPlayerId" class="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium whitespace-nowrap">我</span>
              <span v-if="p.isBot" class="text-[9px] bg-slate-950 text-slate-600 px-1.5 py-0.5 rounded border border-slate-900 whitespace-nowrap">BOT</span>
            </div>
          </div>
        </div>

        <div class="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-[11px] text-slate-400 leading-relaxed">
          <p class="font-serif font-semibold text-amber-500 mb-1">🔮 單機開發除錯面板</p>
          <p>點擊上方任一玩家，即可在右側**切換成該玩家的身分視角**，方便驗證各陣營投票與刺殺決策！</p>
          <div class="mt-2 text-glow-gold text-[10px] text-amber-500/80 font-mono">
            當前視角：{{ activeTestPlayer?.name }}
          </div>
        </div>
      </div>

      <!-- Quick Reset Card -->
      <div class="glass-panel rounded-2xl p-5 border border-slate-800/80 shadow-md flex flex-col justify-between">
        <p class="text-xs text-slate-500 mb-4 leading-relaxed">
          房長可以隨時點擊下方按鈕，結束本局並返回等待大廳。
        </p>
        <button
          @click="handleReset"
          class="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-serif text-xs py-2 px-4 rounded-lg transition-colors cursor-pointer"
        >
          返回等待大廳 (重新發牌)
        </button>
      </div>
    </div>

    <!-- Right column: Stage Controller Panels -->
    <div class="lg:col-span-2 space-y-6">
      
      <!-- MAIN GAME STAGE PANEL -->
      <div class="glass-panel rounded-2xl p-6 border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div class="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-500/20"></div>
        <div class="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-500/20"></div>
        
        <!-- Headers based on Phase -->
        <div class="mb-4 pb-3 border-b border-slate-900 flex justify-between items-center">
          <h3 class="font-serif text-sm font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-2">
            ⚔️ 圓桌會議現場
          </h3>
          <span class="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25">
            {{ getPhaseTitleText(state.gamePhase) }}
          </span>
        </div>

        <!-- 1. Proposal Phase (隊伍指派階段) -->
        <div v-if="state.gamePhase === 'proposal'" class="space-y-4 py-2">
          <div class="p-4 bg-slate-950/60 border border-slate-900 rounded-xl relative overflow-hidden">
            <h4 class="font-serif text-slate-200 text-sm font-semibold flex items-center gap-2 mb-2">
              👑 任務指派：等待隊伍提議
            </h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              當前領袖為 <span class="text-amber-400 font-bold font-serif text-sm">【{{ getPlayerNameById(state.leaderId) }}】</span>。
              本回合需要挑選出 <span class="text-amber-400 font-bold font-serif text-sm">{{ currentRoundQuestSize }}</span> 位冒險者出征任務。
            </p>
          </div>

          <!-- Leader Action Proposal Block -->
          <div class="bg-slate-950/30 p-4 border border-slate-900 rounded-xl space-y-4">
            <p class="text-xs font-bold text-slate-300 font-serif">
              {{ isPerspectiveLeader ? '👉 你是本回合領袖！請挑選出征成員：' : '⏳ 正在等待領袖挑选隊伍，當前挑選隊列：' }}
            </p>
            
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in state.players"
                :key="'proposal-btn-'+p.id"
                @click="toggleProposedMember(p.id)"
                :disabled="!isPerspectiveLeader"
                class="px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer flex items-center gap-1"
                :class="[
                  localProposedIds.includes(p.id)
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold shadow-sm'
                    : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700'
                ]"
              >
                🛡️ {{ p.name }}
              </button>
            </div>

            <!-- Submit proposal -->
            <button
              v-if="isPerspectiveLeader"
              @click="submitProposal"
              :disabled="localProposedIds.length !== currentRoundQuestSize"
              class="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-slate-950 font-serif font-bold text-xs py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            >
              確定出征隊伍並啟動全員發言討論 ({{ localProposedIds.length }} / {{ currentRoundQuestSize }}人)
            </button>
            
            <div v-else-if="state.players.find(p => p.id === state.leaderId)?.isBot" class="text-[10px] text-slate-500 italic mt-2 animate-pulse">
              🤖 Bot 領袖正在研擬指派名單... (將在 {{ botProposalTimer }} 秒後自動宣佈)
            </div>
            
            <div v-else class="text-[10px] text-amber-500/70 italic mt-2">
              💡 當前除錯視角切換至領袖 {{ getPlayerNameById(state.leaderId) }} 即可指派隊伍並前進！
            </div>
          </div>
        </div>

        <!-- 2. Discussion Phase (全員語音討論階段) -->
        <div v-else-if="state.gamePhase === 'discussion'" class="space-y-4">
          <!-- Active Speaker Card -->
          <div class="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-900 rounded-xl relative overflow-hidden">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-amber-500/10 border border-amber-500/30 animate-pulse text-amber-400">
                🎙️
              </div>
              <div>
                <p class="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">當前發言玩家</p>
                <h4 class="font-serif text-lg font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                  {{ currentSpeaker?.name }}
                  <span v-if="currentSpeaker?.isBot" class="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-sans font-normal">BOT</span>
                  <span v-else class="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded font-sans font-normal">玩家</span>
                </h4>
              </div>
            </div>

            <!-- Timer / Countdown -->
            <div class="text-right">
              <p class="text-[10px] text-slate-500 uppercase font-semibold">剩餘時間</p>
              <p class="font-serif text-2xl font-bold font-mono text-glow-gold"
                 :class="state.speakingState.timeLeft <= 10 ? 'text-red-500 text-glow-red animate-pulse' : 'text-amber-500'">
                {{ state.speakingState.timeLeft }}s
              </p>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
            <div 
              class="h-full transition-all duration-1000 bg-amber-500"
              :style="{ width: `${(state.speakingState.timeLeft / 60) * 100}%` }"
            ></div>
          </div>

          <!-- Direction Selection Panel (only shown when first speaker has not chosen direction) -->
          <div v-if="state.speakingState.direction === null" class="p-4 bg-slate-950/60 border border-slate-900 rounded-xl text-center space-y-3">
            <p class="text-xs text-slate-300 font-serif">
              📢 領袖 <b>【{{ firstSpeaker?.name }}】</b> 請決定順逆時針發言順序：
            </p>
            
            <div class="grid grid-cols-2 gap-4">
              <button
                @click="chooseDirection('cw')"
                :disabled="!isPerspectiveFirstSpeaker"
                class="bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 border border-amber-500/30 text-amber-400 py-3 rounded-xl transition-all cursor-pointer text-xs font-serif font-semibold flex flex-col items-center justify-center gap-1"
              >
                <span>➡️ 順時針發言</span>
                <span class="text-[9px] text-slate-500 font-sans font-normal">依座位順序發言</span>
              </button>
              <button
                @click="chooseDirection('ccw')"
                :disabled="!isPerspectiveFirstSpeaker"
                class="bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 border border-amber-500/30 text-amber-400 py-3 rounded-xl transition-all cursor-pointer text-xs font-serif font-semibold flex flex-col items-center justify-center gap-1"
              >
                <span>⬅️ 逆時針發言</span>
                <span class="text-[9px] text-slate-500 font-sans font-normal">依反座序輪流發言</span>
              </button>
            </div>
            
            <div v-if="firstSpeaker?.isBot" class="text-[10px] text-slate-500 italic mt-2 animate-pulse">
              🤖 Bot 正在決定發言方向... (將在 {{ botDecisionTimer }} 秒後自動選擇)
            </div>
            <div v-else-if="!isPerspectiveFirstSpeaker" class="text-[10px] text-amber-500/70 italic mt-2">
              💡 當前除錯視角切換至 {{ firstSpeaker?.name }} 即可替他做出方向決定！
            </div>
          </div>

          <!-- Speaking Flow active content -->
          <div v-else class="space-y-4">
            <!-- Voice wave visualizer -->
            <div class="h-16 bg-slate-950/80 rounded-xl border border-slate-900/50 flex items-center justify-center overflow-hidden relative">
              <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none"></div>
              <div v-if="!isMutedOrBotSilent" class="flex items-center gap-0.5 h-full px-4 w-full justify-center">
                <div 
                  v-for="(barHeight, i) in waveformBars" 
                  :key="i"
                  class="w-1 bg-amber-500/80 rounded-full transition-all duration-75"
                  :style="{ height: `${barHeight}%` }"
                ></div>
              </div>
              <div v-else class="text-xs text-slate-600 font-serif italic">
                🔇 麥克風已關閉 / 靜音中
              </div>
            </div>

            <!-- Queue timeline -->
            <div class="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar border-t border-slate-900 pt-4 text-[11px]">
              <span class="text-[10px] text-slate-500 uppercase font-semibold shrink-0">發言序列:</span>
              <div class="flex items-center gap-1">
                <div 
                  v-for="(id, idx) in state.speakingState.teamIds" 
                  :key="'queue-'+id"
                  class="flex items-center"
                >
                  <span 
                    class="px-2 py-0.5 rounded-md border font-serif"
                    :class="[
                      idx === state.speakingState.currentIndex
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                        : idx < state.speakingState.currentIndex
                          ? 'bg-slate-950/80 border-slate-900 text-slate-600 line-through'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    ]"
                  >
                    {{ getPlayerNameById(id) }}
                  </span>
                  <span v-if="idx < state.speakingState.teamIds.length - 1" class="text-slate-700 px-0.5">➡️</span>
                </div>
              </div>
            </div>

            <!-- Speech controls -->
            <div class="flex items-center justify-between gap-4 border-t border-slate-900 pt-4">
              <!-- Mute / Unmute -->
              <button
                v-if="!currentSpeaker?.isBot && testPerspectiveId === currentSpeaker?.id"
                @click="handleToggleMute"
                class="flex-1 py-2 px-3 border rounded-lg transition-colors cursor-pointer text-xs font-serif flex items-center justify-center gap-1"
                :class="[
                  isMuted
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                ]"
              >
                <span>{{ isMuted ? '🎤 開啟麥克風' : '🔇 靜音麥克風' }}</span>
              </button>
              <div v-else class="flex-1 text-[10px] text-slate-500 italic flex items-center justify-center">
                🤖 Bot {{ currentSpeaker?.name }} 正在陳述意見... (5秒後自動 Pass)
              </div>

              <!-- Pass -->
              <button
                @click="handlePass"
                class="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-serif font-bold text-xs py-2 px-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>Pass 下一位 ➡️</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Team Proposal Voting Phase (公開隊伍投票表決階段) -->
        <div v-else-if="state.gamePhase === 'voting'" class="space-y-4 py-2">
          <div class="p-4 bg-slate-950/60 border border-slate-900 rounded-xl">
            <h4 class="font-serif text-slate-200 text-sm font-semibold flex items-center gap-2 mb-2">
              🗳️ 公開表決隊伍是否出征？
            </h4>
            <p class="text-xs text-slate-400 leading-relaxed mb-3">
              提議的出征隊伍為：
              <span class="flex flex-wrap gap-1 mt-1.5">
                <span v-for="id in state.proposedTeam" :key="'vote-team-'+id" class="px-2 py-0.5 bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg">
                  🛡️ {{ getPlayerNameById(id) }}
                </span>
              </span>
            </p>
          </div>

          <!-- Show individual vote statuses -->
          <div class="bg-slate-950/40 p-4 border border-slate-900 rounded-xl space-y-3">
            <h5 class="text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-900 pb-1.5">玩家投票狀態</h5>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div 
                v-for="p in state.players" 
                :key="'voter-'+p.id"
                class="p-2 border rounded-lg text-center text-xs"
                :class="[
                  state.votes[p.id]
                    ? state.votes[p.id] === 'approve'
                      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                      : 'border-red-500/30 bg-red-950/20 text-red-400'
                    : 'border-slate-800 bg-slate-900/40 text-slate-500 animate-pulse'
                ]"
              >
                <div class="font-semibold truncate">{{ p.name }}</div>
                <div class="text-[10px] mt-1">
                  {{ state.votes[p.id] ? (state.votes[p.id] === 'approve' ? '👍 同意' : '👎 反對') : '⏳ 投票中' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Voter Action Area -->
          <div v-if="!state.votes[testPerspectiveId]" class="p-4 bg-slate-900/20 border border-slate-800 rounded-xl text-center space-y-3">
            <p class="text-xs text-slate-300 font-serif">
              請為當前視角 <b>【{{ activeTestPlayer?.name }}】</b> 做出公開表決投票：
            </p>
            <div class="grid grid-cols-2 gap-4">
              <button
                @click="voteProposal(testPerspectiveId, 'approve')"
                class="bg-emerald-600 hover:bg-emerald-500 text-white font-serif font-bold text-xs py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                👍 同意 (Approve)
              </button>
              <button
                @click="voteProposal(testPerspectiveId, 'reject')"
                class="bg-red-600 hover:bg-red-500 text-white font-serif font-bold text-xs py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                👎 反對 (Reject)
              </button>
            </div>
          </div>

          <!-- Waiting for Bot voters message -->
          <div v-else class="text-center p-3 text-[11px] text-slate-500 italic animate-pulse">
            🤖 其他 Bot 玩家正在抉擇與投票中... (將在 2 秒內完成)
          </div>
        </div>

        <!-- 4. Quest Execution Phase (任務秘密投票階段) -->
        <div v-else-if="state.gamePhase === 'quest'" class="space-y-4 py-2">
          <div class="p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-2">
            <h4 class="font-serif text-slate-200 text-sm font-semibold flex items-center gap-2">
              ✨ 任務秘密執行中
            </h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              投票已被批准！出征成員已出發前往尋找聖杯。
              請秘密投下「任務成功」或「任務失敗」票。
            </p>
            <div class="text-[10px] text-amber-500/80 mt-1 leading-relaxed bg-amber-500/5 p-2 rounded border border-amber-500/10">
              * 提示：好人玩家出征只能投票「成功」；邪惡玩家出征可以任意投票「成功」或「失敗」。
            </div>
          </div>

          <!-- Secret Vote count progress -->
          <div class="bg-slate-950/40 p-4 border border-slate-900 rounded-xl text-center space-y-3">
            <h5 class="text-xs text-slate-400 font-serif font-semibold">秘密投票箱提交進度：</h5>
            <div class="flex items-center justify-center gap-2">
              <div 
                v-for="idx in state.proposedTeam.length" 
                :key="'quest-vote-'+idx"
                class="w-8 h-10 border rounded-lg flex items-center justify-center font-bold text-lg"
                :class="[
                  idx <= state.questVotes.length
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-slate-800 text-slate-700 animate-pulse'
                ]"
              >
                {{ idx <= state.questVotes.length ? '📜' : '?' }}
              </div>
            </div>
            <p class="text-[10px] text-slate-500">已收取 {{ state.questVotes.length }} / {{ state.proposedTeam.length }} 張秘密選票</p>
          </div>

          <!-- Active Proposal Member Vote Actions -->
          <div v-if="state.proposedTeam.includes(testPerspectiveId) && !hasPerspectiveVotedInQuest" class="p-4 bg-slate-900/20 border border-slate-800 rounded-xl text-center space-y-3">
            <p class="text-xs text-slate-300 font-serif">
              當前出征隊員 <b>【{{ activeTestPlayer?.name }}】</b> 請秘密提交任務卡：
            </p>
            <div class="grid grid-cols-2 gap-4">
              <button
                @click="voteQuest('success')"
                class="bg-blue-600 hover:bg-blue-500 text-white font-serif font-bold text-xs py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                🛡️ 任務成功 (SUCCESS)
              </button>
              <button
                @click="voteQuest('fail')"
                :disabled="activeTestPlayer?.alignment === 'good'"
                class="bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-red-700 text-white font-serif font-bold text-xs py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                👿 任務失敗 (FAIL)
              </button>
            </div>
            <p v-if="activeTestPlayer?.alignment === 'good'" class="text-[10px] text-blue-500/80">
              * 正義陣營玩家無法投下失敗票。
            </p>
          </div>

          <!-- Waiting for Bot / other perspectives message -->
          <div v-else-if="state.proposedTeam.includes(testPerspectiveId)" class="text-center p-3 text-[11px] text-slate-500 italic animate-pulse">
            👍 你已提交選票！等待其他隊員投票中...
          </div>
          
          <div v-else class="text-center p-4 bg-slate-950/20 border border-slate-900 rounded-xl space-y-2">
            <p class="text-xs text-slate-400">你本次並未參與出征，正在外面為隊伍祈禱...</p>
            <div v-if="hasBotInProposedTeam" class="text-[10px] text-slate-500 italic animate-pulse">
              🤖 其他出征 Bot 正在秘密投票中...
            </div>
            <div v-else class="text-[10px] text-amber-500/80 italic">
              💡 切換至出征名單內的其他好人或壞人玩家視角以替其提交選票！
            </div>
          </div>
        </div>

        <!-- 5. Assassination Phase (刺客指認梅林階段) -->
        <div v-else-if="state.gamePhase === 'assassination'" class="space-y-4 py-2">
          <div class="p-4 bg-red-950/20 border border-red-500/30 rounded-xl space-y-1.5">
            <h4 class="font-serif text-red-400 text-sm font-semibold flex items-center gap-2">
              🔥 邪惡的最後反撲：刺客刺殺梅林
            </h4>
            <p class="text-xs text-slate-300 leading-relaxed">
              好人陣營已成功完成了 3 次任務！但邪惡勢力仍有最後一次機會。
              刺客必須指認出圓桌會議中誰是「梅林」。
            </p>
          </div>

          <div class="bg-slate-950/40 p-4 border border-slate-900 rounded-xl space-y-3">
            <p class="text-xs font-bold text-slate-300 font-serif">
              {{ isPerspectiveAssassin ? '👉 你是刺客！請點擊刺殺目標：' : '⏳ 正在等待刺客選擇刺殺目標...' }}
            </p>

            <!-- Show only good players as target choice for assassin -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="p in goodPlayers"
                :key="'assassinate-'+p.id"
                @click="performAssassination(p.id)"
                :disabled="!isPerspectiveAssassin"
                class="p-2 border rounded-xl font-serif text-xs transition-all cursor-pointer"
                :class="[
                  isPerspectiveAssassin
                    ? 'border-red-500/30 hover:border-red-500 bg-red-950/10 text-red-200'
                    : 'border-slate-800 text-slate-600 bg-slate-900/10'
                ]"
              >
                💀 刺殺 {{ p.name }}
              </button>
            </div>

            <div v-if="assassinPlayer?.isBot" class="text-[10px] text-slate-500 italic mt-2 animate-pulse">
              🤖 Bot 刺客正在排查並準備致命一擊... (將在 3 秒後指指認)
            </div>
            <div v-else-if="!isPerspectiveAssassin" class="text-[10px] text-amber-500/70 italic mt-2">
              💡 當前除錯視角切換至刺客 【{{ assassinPlayer?.name }}】 即可指認梅林！
            </div>
          </div>
        </div>

        <!-- 6. Game Over Phase (遊戲結束勝負判定面板) -->
        <div v-else-if="state.gamePhase === 'gameover'" class="space-y-6 py-4 text-center">
          <div class="relative py-4 overflow-hidden rounded-2xl border"
               :class="[
                 state.winner === 'good'
                   ? 'bg-blue-950/30 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                   : 'bg-red-950/30 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
               ]">
            <span class="text-xs uppercase tracking-widest text-slate-500 font-bold">GAME RESULT</span>
            <h2 class="font-serif text-3xl font-black tracking-widest uppercase mt-2"
                :class="state.winner === 'good' ? 'text-blue-400 text-glow-blue' : 'text-red-400 text-glow-red'">
              {{ state.winner === 'good' ? '🛡️ 正義陣營勝利 🛡️' : '💀 邪惡陣營勝利 💀' }}
            </h2>
            <p class="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed px-4">
              {{ getWinnerExplanationText() }}
            </p>
          </div>

          <!-- Identity Disclosure Board -->
          <div class="glass-panel p-5 border border-slate-900 rounded-xl text-left space-y-3">
            <h4 class="font-serif text-xs font-bold text-amber-500 uppercase border-b border-slate-800 pb-2">
              🔍 所有人真實身分揭露
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div 
                v-for="p in state.players" 
                :key="'reveal-all-'+p.id"
                class="p-2.5 border rounded-lg flex items-center justify-between text-xs"
                :class="[
                  p.alignment === 'good'
                    ? 'border-blue-950/60 bg-blue-950/20 text-blue-200'
                    : 'border-red-950/60 bg-red-950/20 text-red-200'
                ]"
              >
                <span class="font-semibold">{{ p.name }}</span>
                <span class="font-serif text-[11px] font-bold px-1.5 py-0.5 rounded"
                      :class="p.alignment === 'good' ? 'bg-blue-500/20' : 'bg-red-500/20'">
                  {{ p.roleName }} ({{ p.alignment === 'good' ? '好人' : '壞人' }})
                </span>
              </div>
            </div>
          </div>

          <button
            @click="handleRestartGame"
            class="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-serif font-bold text-sm py-3 px-6 rounded-lg transition-colors cursor-pointer shadow-lg shadow-amber-950/20"
          >
            重回圓桌重新發牌 / 再來一局
          </button>
        </div>

      </div>

      <!-- Identity reveal panel (信箋) -->
      <div class="glass-panel rounded-2xl p-8 border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <!-- Medieval Corner Ornaments -->
        <div class="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-500/20"></div>
        <div class="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-500/20"></div>
        <div class="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-500/20"></div>
        <div class="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-500/20"></div>

        <div class="text-center mb-8">
          <span class="text-xs uppercase tracking-widest text-slate-500 font-semibold">
            ROUND TABLE SECRETS
          </span>
          <h2 class="font-serif text-3xl font-extrabold tracking-wide text-slate-100 mt-1">
            冒險者身分信箋
          </h2>
          <div class="h-[1px] w-24 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent mx-auto mt-3"></div>
        </div>

        <!-- Identity Card Reveal Area -->
        <div class="flex flex-col items-center justify-center py-6">
          <div
            @click="isRevealed = !isRevealed"
            class="relative w-64 h-96 rounded-2xl cursor-pointer transition-all duration-700 preserve-3d"
            :class="{ '[transform:rotateY(180deg)]': isRevealed }"
          >
            <!-- Card Front (Hidden State) -->
            <div class="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-amber-500/40 p-6 flex flex-col items-center justify-between backface-hidden shadow-2xl">
              <div class="w-full flex justify-between text-amber-500/30 font-serif text-lg">
                <span>🛡️</span>
                <span>🔮</span>
              </div>
              <div class="text-center my-auto">
                <div class="w-20 h-20 mx-auto rounded-full bg-slate-900 border-2 border-dashed border-amber-500/20 flex items-center justify-center mb-4">
                  <span class="text-3xl text-amber-500/40">⚔️</span>
                </div>
                <h4 class="font-serif text-lg font-bold text-amber-500 tracking-wider">機密身分</h4>
                <p class="text-slate-500 text-[11px] mt-2">點擊或觸摸以揭曉身分</p>
              </div>
              <div class="w-full flex justify-between text-amber-500/30 font-serif text-lg">
                <span>🔮</span>
                <span>🛡️</span>
              </div>
            </div>

            <!-- Card Back (Revealed State) -->
            <div class="absolute inset-0 w-full h-full rounded-2xl border-2 p-6 flex flex-col items-center justify-between [transform:rotateY(180deg)] backface-hidden shadow-2xl"
              :class="[
                activeTestPlayer?.alignment === 'good'
                  ? 'bg-gradient-to-br from-slate-950 to-blue-950/80 border-blue-500/40'
                  : 'bg-gradient-to-br from-slate-950 to-red-950/80 border-red-500/40'
              ]"
            >
              <div class="w-full flex justify-between font-serif text-xs"
                :class="activeTestPlayer?.alignment === 'good' ? 'text-blue-400/50' : 'text-red-400/50'"
              >
                <span>{{ activeTestPlayer?.alignment === 'good' ? '正義陣營' : '邪惡陣營' }}</span>
                <span>{{ activeTestPlayer?.roleName }}</span>
              </div>

              <!-- Role Illustration / Icon -->
              <div class="text-center my-auto space-y-4">
                <div class="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl shadow-lg border-2"
                  :class="[
                    activeTestPlayer?.alignment === 'good'
                      ? 'bg-blue-950/60 border-blue-500/40 text-blue-400'
                      : 'bg-red-950/60 border-red-500/40 text-red-400'
                  ]"
                >
                  <span v-if="activeTestPlayer?.role === 'Merlin'">🧙‍♂️</span>
                  <span v-else-if="activeTestPlayer?.role === 'Percival'">🔮</span>
                  <span v-else-if="activeTestPlayer?.role === 'Loyalist'">🛡️</span>
                  <span v-else-if="activeTestPlayer?.role === 'Assassin'">🗡️</span>
                  <span v-else-if="activeTestPlayer?.role === 'Morgana'">🧙‍♀️</span>
                  <span v-else>😈</span>
                </div>
                <div>
                  <h3 class="font-serif text-2xl font-black tracking-widest uppercase"
                    :class="activeTestPlayer?.alignment === 'good' ? 'text-blue-400 text-glow-blue' : 'text-red-400 text-glow-red'"
                  >
                    {{ activeTestPlayer?.roleName }}
                  </h3>
                  <p class="text-[11px] font-semibold tracking-wider mt-1"
                    :class="activeTestPlayer?.alignment === 'good' ? 'text-blue-500/80' : 'text-red-500/80'"
                  >
                    {{ activeTestPlayer?.alignment === 'good' ? '亞瑟王的忠臣派系' : '莫德雷德的叛黨派系' }}
                  </p>
                </div>
              </div>

              <div class="text-center w-full">
                <div class="h-[1px] w-full bg-slate-800 mb-3"></div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  {{ revealedInfo.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Information Disclosure Section -->
        <div class="mt-8 pt-6 border-t border-slate-800/80 space-y-4" v-if="isRevealed">
          <h3 class="font-serif text-xs font-bold uppercase tracking-wider text-slate-400">
            👁️ 信箋揭露機密資訊
          </h3>

          <!-- Percival Info -->
          <div v-if="activeTestPlayer?.role === 'Percival'" class="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
            <h4 class="text-xs font-bold text-blue-400 flex items-center gap-1 font-serif">
              🔮 雙星預言名單 (派西維爾視野)
            </h4>
            <p class="text-[11px] text-slate-400">你看到了以下兩位玩家（一位是真梅林，另一位是假冒的莫甘娜）：</p>
            <div class="flex flex-wrap gap-2 pt-1">
              <span v-for="name in revealedInfo.candidates" :key="name" class="px-2.5 py-1 bg-blue-950/60 border border-blue-500/20 text-blue-300 text-xs font-semibold rounded-lg">
                ❓ {{ name }}
              </span>
            </div>
          </div>

          <!-- Merlin Info -->
          <div v-else-if="activeTestPlayer?.role === 'Merlin'" class="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2">
            <h4 class="text-xs font-bold text-red-400 flex items-center gap-1 font-serif">
              🔥 邪惡爪牙名單 (梅林天眼)
            </h4>
            <p class="text-[11px] text-slate-400">以下玩家為邪惡陣營（刺客/爪牙/莫甘娜），請小心指引好人走向勝利，切勿暴露身分：</p>
            <div class="flex flex-wrap gap-2 pt-1">
              <span v-for="name in revealedInfo.evilPlayers" :key="name" class="px-2.5 py-1 bg-red-950/60 border border-red-500/20 text-red-300 text-xs font-semibold rounded-lg">
                💀 {{ name }}
              </span>
            </div>
          </div>

          <!-- Evil Teammate Info -->
          <div v-else-if="activeTestPlayer?.alignment === 'evil'" class="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2">
            <h4 class="text-xs font-bold text-red-400 flex items-center gap-1 font-serif">
              👥 邪惡同夥夥伴
            </h4>
            <p class="text-[11px] text-slate-400" v-if="revealedInfo.teammates.length">
              以下為你的邪惡同盟，共同在出任務時暗中投下「失敗票」，或者欺騙好人：
            </p>
            <p class="text-[11px] text-slate-500" v-else>
              （本局沒有其他邪惡同夥夥伴）
            </p>
            <div class="flex flex-wrap gap-2 pt-1" v-if="revealedInfo.teammates.length">
              <span v-for="name in revealedInfo.teammates" :key="name" class="px-2.5 py-1 bg-red-950/60 border border-red-500/20 text-red-300 text-xs font-semibold rounded-lg">
                😈 {{ name }}
              </span>
            </div>
          </div>

          <!-- Ordinary Loyalist Info -->
          <div v-else class="p-4 rounded-xl bg-blue-950/10 border border-blue-500/20 space-y-1.5">
            <h4 class="text-xs font-bold text-blue-400 flex items-center gap-1 font-serif">
              🛡️ 好人無瑕信仰
            </h4>
            <p class="text-[11px] text-slate-400">
              身為忠臣，你沒有任何特殊視野。請專注觀察任務投票與出征人選，找出你的同盟梅林，並保護他躲過刺客的最終一擊。
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden Remote WebRTC Audio Elements -->
    <div class="hidden">
      <audio
        v-for="(stream, playerId) in remoteStreams"
        :key="'remote-audio-' + playerId"
        autoplay
        playsinline
        :ref="(el) => { if (el) el.srcObject = stream; }"
      ></audio>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGame } from '../composables/useGame';
import { useWebRTCVoice } from '../composables/useWebRTCVoice';

const { 
  state, 
  resetGame, 
  getRevealedInfoForPlayer,
  setSpeakingDirection,
  passSpeaking,
  toggleMute,
  tickSpeakingTimer,
  proposeTeam,
  submitTeamVote,
  submitQuestVote,
  assassinatePlayer,
  startGame,
  currentRoundQuestSize
} = useGame();

const {
  remoteStreams,
  startVoiceConference,
  closePeers,
  toggleLocalMute,
  isMuted
} = useWebRTCVoice(state.roomCode, state.myPlayerId, state.players);

const testPerspectiveId = ref(state.myPlayerId);
const isRevealed = ref(false);
const selectedRoundInfo = ref(1); // Default to view Round 1

// Local voice system config / mock details
const localProposedIds = ref([]);
const botDecisionTimer = ref(3);
const botProposalTimer = ref(4);
const waveformBars = ref(Array.from({ length: 30 }, () => 15));

let timerInterval = null;
let animFrame = null;
let botTimeout = null;

const viewRoundHistory = (round) => {
  selectedRoundInfo.value = round;
};

const getTeamForRound = (round) => {
  if (state.questTeamsHistory && state.questTeamsHistory[round - 1]) {
    return state.questTeamsHistory[round - 1];
  }
  return null;
};

const activeTestPlayer = computed(() => {
  return state.players.find(p => p.id === testPerspectiveId.value) || null;
});

// Watch perspective change to hide the card first
watch(testPerspectiveId, () => {
  isRevealed.value = false;
});

const revealedInfo = computed(() => {
  return getRevealedInfoForPlayer(activeTestPlayer.value);
});

// Reset local proposal whenever round changes
watch(() => state.currentRound, () => {
  localProposedIds.value = [];
  triggerBotProposalDecision();
});

watch(() => state.gamePhase, (newPhase) => {
  if (newPhase === 'proposal') {
    localProposedIds.value = [];
    triggerBotProposalDecision();
  } else if (newPhase === 'voting') {
    triggerBotProposalVoting();
  } else if (newPhase === 'quest') {
    triggerBotQuestVoting();
  } else if (newPhase === 'assassination') {
    triggerBotAssassinationChoice();
  }
});

onMounted(() => {
  // Start WebRTC voice conference
  startVoiceConference();

  // Timer setup
  timerInterval = setInterval(() => {
    if (state.speakingState.active && state.speakingState.direction !== null) {
      tickSpeakingTimer();
    }
  }, 1000);

  // Audio wave animation simulator
  const animateWaveform = () => {
    if (state.speakingState.active && state.speakingState.direction !== null && !isMutedOrBotSilent.value) {
      waveformBars.value = waveformBars.value.map(() => {
        return Math.floor(Math.random() * 70) + 15;
      });
    }
    animFrame = requestAnimationFrame(animateWaveform);
  };
  animateWaveform();
  
  // Initial check
  triggerBotProposalDecision();
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (animFrame) cancelAnimationFrame(animFrame);
  if (botTimeout) clearTimeout(botTimeout);
  closePeers();
});

// Watchers for Speaking Phase to handle Bot automations
const firstSpeaker = computed(() => {
  if (!state.speakingState.active || state.speakingState.teamIds.length === 0) return null;
  return state.players.find(p => p.id === state.speakingState.teamIds[0]) || null;
});

const currentSpeaker = computed(() => {
  if (!state.speakingState.active || state.speakingState.teamIds.length === 0) return null;
  const currentSpeakerId = state.speakingState.teamIds[state.speakingState.currentIndex];
  return state.players.find(p => p.id === currentSpeakerId) || null;
});

const isMutedOrBotSilent = computed(() => {
  if (!state.speakingState.active) return true;
  if (!currentSpeaker.value) return true;
  return currentSpeaker.value.isBot ? false : isMuted.value;
});

// Watch for changes in active status to trigger Bot decisions
watch(() => state.speakingState.active, (active) => {
  if (active) {
    triggerBotFirstSpeakerDecision();
  }
});

// Watch current index changes to auto-pass bots
watch(() => state.speakingState.currentIndex, () => {
  triggerBotSpeechSimulation();
});

watch(() => state.speakingState.direction, (dir) => {
  if (dir !== null) {
    triggerBotSpeechSimulation();
  }
});

const isPerspectiveLeader = computed(() => {
  return state.leaderId === testPerspectiveId.value;
});

const isPerspectiveFirstSpeaker = computed(() => {
  return firstSpeaker.value?.id === testPerspectiveId.value;
});

const goodPlayers = computed(() => {
  return state.players.filter(p => p.alignment === 'good');
});

const assassinPlayer = computed(() => {
  return state.players.find(p => p.role === 'Assassin') || null;
});

const isPerspectiveAssassin = computed(() => {
  return assassinPlayer.value?.id === testPerspectiveId.value;
});

const hasPerspectiveVotedInQuest = computed(() => {
  // Mock simplicity: check if we already contributed to state.questVotes length.
  // In our simple local mock, we can just check if state.questVotes matches how many bot votes + our vote.
  return false; // Allow multi-click for testing/switching perspectives
});

const hasBotInProposedTeam = computed(() => {
  return state.proposedTeam.some(id => state.players.find(p => p.id === id)?.isBot);
});

// Helper for UI text formatting
const getQuestSizeTextForRound = (round) => {
  const mapping = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5]
  };
  const list = mapping[state.players.length] || [2, 3, 2, 3, 3];
  return list[round - 1];
};

const getPhaseTitleText = (phase) => {
  const map = {
    'proposal': '隊伍指派',
    'discussion': '全員討論',
    'voting': '公開投票',
    'quest': '任務執行',
    'assassination': '刺殺梅林',
    'gameover': '遊戲結束'
  };
  return map[phase] || phase;
};

const getPlayerNameById = (id) => {
  return state.players.find(p => p.id === id)?.name || id;
};

// Toggle proposed member locally
const toggleProposedMember = (playerId) => {
  if (!isPerspectiveLeader.value) return;
  const questSize = useGame().currentRoundQuestSize.value;
  
  if (localProposedIds.value.includes(playerId)) {
    localProposedIds.value = localProposedIds.value.filter(id => id !== playerId);
  } else {
    if (localProposedIds.value.length < questSize) {
      localProposedIds.value.push(playerId);
    }
  }
};

const submitProposal = () => {
  proposeTeam(localProposedIds.value);
};

const voteProposal = (playerId, vote) => {
  submitTeamVote(playerId, vote);
};

const voteQuest = (vote) => {
  submitQuestVote(vote);
};

const performAssassination = (targetId) => {
  assassinatePlayer(targetId);
};

const handleRestartGame = () => {
  startGame();
};

const triggerBotProposalDecision = () => {
  if (botTimeout) clearTimeout(botTimeout);
  if (state.gamePhase === 'proposal') {
    const leader = state.players.find(p => p.id === state.leaderId);
    if (leader && leader.isBot) {
      botProposalTimer.value = 4;
      const propInterval = setInterval(() => {
        if (botProposalTimer.value > 1) {
          botProposalTimer.value--;
        } else {
          clearInterval(propInterval);
          // Pick random players for proposed team
          const pool = [...state.players];
          const questSize = useGame().currentRoundQuestSize.value;
          const chosen = [];
          
          // Shuffle to select random
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          for (let i = 0; i < questSize; i++) {
            chosen.push(pool[i].id);
          }
          proposeTeam(chosen);
        }
      }, 1000);
    }
  }
};

const triggerBotFirstSpeakerDecision = () => {
  if (botTimeout) clearTimeout(botTimeout);
  if (state.speakingState.active && state.speakingState.direction === null) {
    if (firstSpeaker.value?.isBot) {
      botDecisionTimer.value = 3;
      const decTimer = setInterval(() => {
        if (botDecisionTimer.value > 1) {
          botDecisionTimer.value--;
        } else {
          clearInterval(decTimer);
          chooseDirection(Math.random() > 0.5 ? 'cw' : 'ccw');
        }
      }, 1000);
    }
  }
};

const triggerBotSpeechSimulation = () => {
  if (botTimeout) clearTimeout(botTimeout);
  if (state.speakingState.active && state.speakingState.direction !== null) {
    if (currentSpeaker.value?.isBot) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (e) {}

      // Keep track of the index when this timeout was created
      const expectedIndex = state.speakingState.currentIndex;
      botTimeout = setTimeout(() => {
        // Only pass if we are still on the same speaker (prevent double-jump)
        if (state.speakingState.active && state.speakingState.currentIndex === expectedIndex) {
          passSpeaking();
        }
      }, 5000);
    }
  }
};

const triggerBotProposalVoting = () => {
  if (state.gamePhase === 'voting') {
    // Delay slightly to look realistic, then all bots submit their votes
    setTimeout(() => {
      state.players.forEach(p => {
        if (p.isBot) {
          // Bad guys approve bad teammates, Good guys randomly vote or approve
          // To make it simple, bots randomly vote approve (70% chance) or reject (30%)
          const vote = Math.random() > 0.3 ? 'approve' : 'reject';
          submitTeamVote(p.id, vote);
        }
      });
    }, 2000);
  }
};

const triggerBotQuestVoting = () => {
  if (state.gamePhase === 'quest') {
    setTimeout(() => {
      state.proposedTeam.forEach(id => {
        const p = state.players.find(x => x.id === id);
        if (p && p.isBot) {
          // Good bots must vote success. Evil bots randomly choose success or fail
          if (p.alignment === 'good') {
            submitQuestVote('success');
          } else {
            const vote = Math.random() > 0.5 ? 'fail' : 'success';
            submitQuestVote(vote);
          }
        }
      });
    }, 2000);
  }
};

const triggerBotAssassinationChoice = () => {
  if (state.gamePhase === 'assassination') {
    const assassin = assassinPlayer.value;
    if (assassin && assassin.isBot) {
      setTimeout(() => {
        // Randomly assassinate a good player
        const goods = goodPlayers.value;
        const target = goods[Math.floor(Math.random() * goods.length)];
        if (target) {
          assassinatePlayer(target.id);
        }
      }, 3000);
    }
  }
};

const chooseDirection = (dir) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch(e) {}
  setSpeakingDirection(dir);
};

const handlePass = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(330, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch(e) {}
  passSpeaking();
};

const handleToggleMute = () => {
  toggleLocalMute();
};

const getWinnerExplanationText = () => {
  if (state.winner === 'good') {
    return '正義陣營成功完成了三次聖杯任務，且梅林成功躲避了刺客的刺殺，將亞瑟王的光輝播撒至大不列顛！';
  } else {
    // Evil wins
    if (state.assassinatedPlayerId) {
      const merlin = state.players.find(p => p.role === 'Merlin');
      return `邪惡勢力指認成功！刺客精準地刺殺了梅林【${merlin?.name}】，正義的力量頓時分崩離析...`;
    } else if (state.questHistory.filter(h => h === 'fail').length >= 3) {
      return '莫德雷德的爪牙成功破壞了三個聖杯任務，好人陣營的信念被徹底粉碎！';
    } else {
      return '由於提案被多次否決，圓桌會議陷入癱瘓，邪惡勢力趁虛而入！';
    }
  }
};

const handleReset = () => {
  resetGame();
};
</script>

<style scoped>
/* Card flip 3D styles */
.preserve-3d {
  transform-style: preserve-3d;
}
.backface-hidden {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
</style>
