<template>
  <div class="min-h-screen bg-[#0d0e12] bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-slate-900/60 via-slate-950/80 to-[#050608] py-12 px-4 flex flex-col items-center justify-between gap-12 relative overflow-hidden">
    <!-- Overlay grid lines for tech/fantasy feel -->
    <div class="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>
    
    <!-- Top Nav / Info -->
    <header class="w-full max-w-4xl flex items-center justify-between relative z-10 border-b border-slate-800/40 pb-4">
      <div class="flex items-center gap-2">
        <span class="text-xl">🏆</span>
        <span class="font-serif font-black tracking-widest text-sm uppercase text-slate-400">
          Avalon Arena
        </span>
      </div>
      
      <div class="flex items-center gap-4 text-xs">
        <span v-if="state.roomCode" class="text-slate-400">
          目前房間: <strong class="text-amber-500 font-mono tracking-wider">{{ state.roomCode }}</strong>
        </span>
        <span v-if="state.myPlayerName" class="text-slate-400">
          暱稱: <strong class="text-slate-200">{{ state.myPlayerName }}</strong>
        </span>
      </div>
    </header>

    <!-- Main Content Stage -->
    <main class="w-full flex justify-center items-center flex-1 relative z-10 py-6">
      <Transition name="fade" mode="out-in">
        <Lobby v-if="state.gameState === 'lobby'" />
        <WaitingRoom v-else-if="state.gameState === 'waiting'" />
        <GameScreen v-else-if="state.gameState === 'playing'" />
      </Transition>
    </main>

    <!-- Footer -->
    <footer class="w-full max-w-4xl text-center border-t border-slate-800/40 pt-4 text-slate-600 text-xs relative z-10 space-y-1">
      <p>阿瓦隆桌遊線上版 • 前端連線邏輯模擬測試器</p>
      <p class="text-[10px] text-slate-700">Powered by Vue 3 + Tailwind CSS v4</p>
    </footer>
  </div>
</template>

<script setup>
import Lobby from './components/Lobby.vue';
import WaitingRoom from './components/WaitingRoom.vue';
import GameScreen from './components/GameScreen.vue';
import { useGame } from './composables/useGame';

const { state } = useGame();
</script>

<style>
/* Page transition styles */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
