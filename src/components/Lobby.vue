<template>
  <div class="max-w-md w-full glass-panel rounded-2xl p-8 border border-amber-500/30 pulse-gold shadow-2xl relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute -top-16 -right-16 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
    <div class="absolute -bottom-16 -left-16 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>

    <div class="text-center mb-8 relative z-10">
      <h1 class="font-serif text-4xl font-extrabold tracking-widest text-amber-500 text-glow-gold uppercase">
        Avalon
      </h1>
      <p class="font-serif text-xs text-amber-500/60 uppercase tracking-widest mt-1">
        聖杯傳奇 • 線上連線版
      </p>
      <div class="h-[1px] w-24 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mx-auto mt-4"></div>
    </div>

    <!-- Error Toast -->
    <div v-if="errorMsg" class="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-sm text-center">
      🛡️ {{ errorMsg }}
    </div>

    <div class="space-y-6 relative z-10">
      <!-- Player Nickname -->
      <div>
        <label for="nickname" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          冒險者暱稱
        </label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">👑</span>
          <input
            id="nickname"
            v-model="name"
            type="text"
            placeholder="請輸入你的暱稱..."
            maxlength="12"
            class="w-full bg-slate-950/50 border border-slate-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-lg py-2.5 pl-10 pr-4 text-slate-100 placeholder-slate-600 outline-none transition-all duration-300 text-sm"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 pt-2">
        <!-- Create Room Tab Button -->
        <button
          @click="activeTab = 'create'"
          :class="[
            'py-2 px-4 rounded-lg font-serif text-sm tracking-wider uppercase border transition-all duration-300',
            activeTab === 'create'
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold'
              : 'bg-transparent border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          ]"
        >
          建立房間
        </button>
        <!-- Join Room Tab Button -->
        <button
          @click="activeTab = 'join'"
          :class="[
            'py-2 px-4 rounded-lg font-serif text-sm tracking-wider uppercase border transition-all duration-300',
            activeTab === 'join'
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold'
              : 'bg-transparent border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          ]"
        >
          加入房間
        </button>
      </div>

      <!-- Action Fields -->
      <div class="space-y-4 pt-2 border-t border-slate-800/60">
        <!-- Create Room Mode -->
        <div v-if="activeTab === 'create'" class="space-y-4">
          <p class="text-xs text-slate-400 text-center leading-relaxed">
            建立一個新的亞瑟王圓桌會議。你將作為房長，可以邀請其他玩家或加入模擬 Bot 來開啟遊戲。
          </p>
          <button
            @click="handleCreate"
            class="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-serif font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-amber-950/20 active:scale-[0.98] text-sm uppercase tracking-widest cursor-pointer"
          >
            開啟圓桌會議
          </button>
        </div>

        <!-- Join Room Mode -->
        <div v-else class="space-y-4">
          <div>
            <label for="roomCode" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              房間代碼 (6位英文/數字)
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">🔑</span>
              <input
                id="roomCode"
                v-model="code"
                type="text"
                placeholder="例如: AB3CDE"
                maxlength="6"
                class="w-full bg-slate-950/50 border border-slate-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-lg py-2.5 pl-10 pr-4 text-slate-100 placeholder-slate-600 outline-none transition-all duration-300 text-sm uppercase"
              />
            </div>
          </div>
          <button
            @click="handleJoin"
            class="w-full bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-slate-100 font-serif font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg shadow-blue-950/20 active:scale-[0.98] text-sm uppercase tracking-widest cursor-pointer"
          >
            進入城堡
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useGame } from '../composables/useGame';

const { createRoom, joinRoom } = useGame();

const name = ref(localStorage.getItem('avalon_name') || '');
const code = ref('');
const activeTab = ref('create');
const errorMsg = ref('');

const handleCreate = () => {
  errorMsg.value = '';
  if (!name.value.trim()) {
    errorMsg.value = '請填寫您的暱稱以建立房間';
    return;
  }
  localStorage.setItem('avalon_name', name.value.trim());
  const res = createRoom(name.value.trim());
  if (!res.success) {
    errorMsg.value = res.message;
  }
};

const handleJoin = () => {
  errorMsg.value = '';
  if (!name.value.trim()) {
    errorMsg.value = '請填寫您的暱稱以加入房間';
    return;
  }
  if (!code.value.trim()) {
    errorMsg.value = '請輸入房間代碼';
    return;
  }
  localStorage.setItem('avalon_name', name.value.trim());
  const res = joinRoom(code.value.trim(), name.value.trim());
  if (!res.success) {
    errorMsg.value = res.message;
  }
};
</script>
