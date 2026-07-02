<template>
  <div class="max-w-2xl w-full glass-panel rounded-2xl p-8 border border-amber-500/20 shadow-2xl relative">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
            等待冒險者中
          </span>
        </div>
        <h2 class="font-serif text-2xl font-bold text-slate-100 tracking-wide mt-1">
          亞瑟王圓桌會議室
        </h2>
      </div>

      <!-- Room Code panel -->
      <div class="bg-slate-950/60 border border-amber-500/30 rounded-xl px-5 py-2.5 flex items-center justify-between gap-4">
        <div>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">房間號碼</p>
          <p class="font-serif text-xl font-bold tracking-widest text-amber-500 text-glow-gold">{{ state.roomCode }}</p>
        </div>
        <button
          @click="copyRoomCode"
          class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 p-2 rounded-lg transition-colors border border-amber-500/20 cursor-pointer text-xs"
          title="複製房號"
        >
          {{ copied ? '已複製 ✓' : '複製 📋' }}
        </button>
      </div>
    </div>

    <!-- Players Count Alert & Info -->
    <div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-2">
        <h3 class="font-bold text-slate-300 flex items-center gap-1.5 font-serif">
          ⚔️ 陣營配置規則 (5-10 人)
        </h3>
        <p class="text-slate-400">目前人數：<span class="text-amber-400 font-bold font-serif text-sm">{{ state.players.length }}</span> / 10</p>
        <div class="text-[11px] text-slate-500 space-y-1">
          <p v-if="state.players.length < 5" class="text-amber-500/80">⚠️ 最少需要 5 人才能開始遊戲！ (目前仍差 {{ 5 - state.players.length }} 人)</p>
          <p v-else class="text-emerald-500 font-semibold">✓ 已達到遊戲人數門檻，可開始分配陣營。</p>
          <div class="mt-2 p-2 bg-slate-950/60 border border-slate-900 rounded-lg">
            <span class="text-[9px] text-slate-500 block uppercase font-semibold mb-0.5">預計陣營與角色分佈：</span>
            <p class="text-[11px] text-amber-500/90 leading-relaxed font-serif">{{ currentRoleDistribution }}</p>
          </div>
        </div>
      </div>

      <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-2 flex flex-col justify-between">
        <div>
          <h3 class="font-bold text-slate-300 flex items-center gap-1.5 font-serif">
            💡 單人測試說明
          </h3>
          <p class="text-slate-400 leading-relaxed text-[11px]">
            您可以點擊「新增模擬玩家」按鈕隨機加入 Bot。當人數達到 5 人以上時，若您是房長即可啟動遊戲！
          </p>
        </div>
        <div class="flex gap-2 mt-2">
          <button
            @click="handleAddBot"
            :disabled="state.players.length >= 10"
            class="flex-1 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:hover:bg-amber-500/10 text-amber-400 font-serif text-xs font-semibold py-2 px-3 border border-amber-500/30 rounded-lg transition-colors cursor-pointer text-center"
          >
            + 加入模擬玩家
          </button>
        </div>
      </div>
    </div>

    <!-- Players List -->
    <div class="space-y-3 mb-8">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
        已進入城堡的冒險者 ({{ state.players.length }})
      </h3>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1 no-scrollbar">
        <div
          v-for="player in state.players"
          :key="player.id"
          class="flex items-center justify-between p-3 rounded-lg border transition-all duration-300"
          :class="[
            player.id === state.myPlayerId
              ? 'bg-amber-500/5 border-amber-500/30 shadow-md'
              : 'bg-slate-950/40 border-slate-900/80'
          ]"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-slate-800 border flex items-center justify-center text-sm font-bold"
              :class="player.id === state.myPlayerId ? 'border-amber-500 text-amber-500' : 'border-slate-700 text-slate-400'"
            >
              {{ player.name.substring(0, 1) }}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium" :class="player.id === state.myPlayerId ? 'text-amber-400 font-bold' : 'text-slate-200'">
                  {{ player.name }}
                </span>
                <span v-if="player.id === state.myPlayerId" class="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">我</span>
                <span v-if="player.isBot" class="text-[9px] bg-slate-800 text-slate-500 px-1 rounded border border-slate-700">BOT</span>
              </div>
              <p class="text-[10px] text-slate-500">{{ player.isHost ? '👑 圓桌房長' : '🛡️ 圓桌騎士' }}</p>
            </div>
          </div>

          <!-- Kick / Remove button -->
          <button
            v-if="isHost && player.id !== state.myPlayerId"
            @click="removePlayer(player.id)"
            class="text-xs text-red-500/60 hover:text-red-400 hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            踢除
          </button>
        </div>
      </div>
    </div>

    <!-- Error/Warning Toast in actions -->
    <div v-if="actionError" class="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-sm text-center">
      ⚠️ {{ actionError }}
    </div>

    <!-- Actions Footer -->
    <div class="flex items-center justify-between gap-4 border-t border-slate-800/80 pt-6">
      <button
        @click="leaveRoom"
        class="bg-transparent border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 font-serif text-sm px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
      >
        離開房間
      </button>

      <button
        v-if="isHost"
        @click="handleStartGame"
        :disabled="state.players.length < 5"
        class="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-slate-950 font-serif font-bold text-sm px-8 py-2.5 rounded-lg transition-all duration-300 shadow-lg cursor-pointer"
      >
        發牌 / 開始遊戲
      </button>
      <div v-else class="text-xs text-slate-500 italic">
        等待房長 {{ state.players.find(p => p.isHost)?.name }} 開始遊戲...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGame } from '../composables/useGame';

const { state, isHost, addBot, removePlayer, leaveRoom, startGame } = useGame();

const copied = ref(false);
const actionError = ref('');

const copyRoomCode = () => {
  navigator.clipboard.writeText(state.roomCode);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const handleAddBot = () => {
  actionError.value = '';
  const res = addBot();
  if (!res.success) {
    actionError.value = res.message;
  }
};

const handleStartGame = () => {
  actionError.value = '';
  const res = startGame();
  if (!res.success) {
    actionError.value = res.message;
  }
};

const currentRoleDistribution = computed(() => {
  const num = state.players.length < 5 ? 5 : state.players.length;
  
  let good = 3, evil = 2;
  if (num === 6) { good = 4; evil = 2; }
  else if (num === 7) { good = 4; evil = 3; }
  else if (num === 8) { good = 5; evil = 3; }
  else if (num === 9) { good = 6; evil = 3; }
  else if (num === 10) { good = 6; evil = 4; }
  
  if (num >= 9) {
    return `正義陣營 ${good} 人 (梅林 + 派西維爾 + 忠臣 x${good-2}) / 邪惡陣營 ${evil} 人 (刺客 + 莫甘娜 + 莫德雷德 + 爪牙 x${evil-3})`;
  }
  if (num >= 7) {
    return `正義陣營 ${good} 人 (梅林 + 派西維爾 + 忠臣 x${good-2}) / 邪惡陣營 ${evil} 人 (刺客 + 莫甘娜 + 爪牙 x${evil-2})`;
  }
  return `正義陣營 ${good} 人 (梅林 + 忠臣 x${good-1}) / 邪惡陣營 ${evil} 人 (刺客 + 爪牙 x${evil-1})`;
});
</script>
