<template>
  <TransitionGroup
      v-if="toasts.length"
      name="toast-stack"
      tag="div"
      class="game-toast-stack"
      aria-live="polite"
      aria-atomic="false"
  >
    <div
        v-for="toast in toasts"
        :key="toast.id"
        class="game-toast-item"
        :class="{ 'is-error': toast.tone === 'error' }"
    >
      <span class="game-toast-icon" aria-hidden="true">
        <svg v-if="toast.tone === 'error'" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 7.5v5.5"></path>
          <circle cx="12" cy="16.75" r="0.75" class="game-toast-icon-dot"></circle>
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path
              d="M12 4.5a4 4 0 0 0-4 4v2.1c0 .62-.2 1.21-.58 1.69L6.1 14.1a1 1 0 0 0 .8 1.6h10.2a1 1 0 0 0 .8-1.6l-1.32-1.8a2.76 2.76 0 0 1-.58-1.69V8.5a4 4 0 0 0-4-4Z"></path>
          <path d="M10.25 17.5a1.75 1.75 0 0 0 3.5 0"></path>
        </svg>
      </span>
      <span class="game-toast-message">{{ toast.message }}</span>
      <button
          class="game-toast-close"
          type="button"
          aria-label="关闭提示"
          @click="$emit('dismiss', toast.id)"
      >
        ×
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import type {ToastItem} from '@/composables/useToastStack'

defineProps<{
  toasts: ToastItem[]
}>()

defineEmits<{
  dismiss: [id: number]
}>()
</script>

<style>
.game-toast-stack {
  position: absolute;
  left: 50%;
  top: 86px;
  z-index: 82;
  display: grid;
  gap: 8px;
  width: min(360px, calc(100vw - 36px));
  transform: translateX(-50%);
  pointer-events: auto;
}

.game-toast-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  border: 1px solid rgb(104 124 69 / 62%);
  border-radius: 8px;
  background: rgb(247 255 226 / 94%);
  box-shadow: 0 16px 34px rgb(72 61 36 / 20%);
  padding: 0 16px;
  color: #3f5f2d;
  font-size: 14px;
  font-weight: 900;
  backdrop-filter: blur(10px);
}

.game-toast-item.is-error {
  border-color: rgb(195 107 85 / 58%);
  background: rgb(255 239 225 / 96%);
  color: #8e3a31;
}

.game-toast-icon {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 999px;
  background: rgb(104 124 69 / 12%);
  color: currentColor;
}

.game-toast-item.is-error .game-toast-icon {
  background: rgb(195 107 85 / 14%);
}

.game-toast-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.game-toast-icon-dot {
  fill: currentColor;
  stroke: none;
}

.game-toast-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-toast-close {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(104 124 69 / 26%);
  border-radius: 6px;
  background: rgb(255 249 223 / 78%);
  color: #5f7d43;
  font-size: 16px;
  font-weight: 900;
  line-height: 1;
}

.game-toast-item.is-error .game-toast-close {
  border-color: rgb(195 107 85 / 28%);
  background: rgb(255 248 244 / 82%);
  color: #9e4a40;
}

.game-toast-close:hover {
  background: rgb(240 226 180 / 92%);
}

.game-toast-item.is-error .game-toast-close:hover {
  background: rgb(255 225 214 / 92%);
}

.toast-stack-enter-active,
.toast-stack-leave-active {
  transition: opacity 180ms ease, transform 180ms ease, max-height 180ms ease, margin 180ms ease;
}

.toast-stack-enter-from,
.toast-stack-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-stack-move {
  transition: transform 180ms ease;
}

@media (max-width: 900px) {
  .game-toast-stack {
    top: 206px;
    width: min(420px, calc(100vw - 24px));
  }
}

@media (max-width: 640px) {
  .game-toast-stack {
    left: 12px;
    top: 194px;
    width: calc(100vw - 24px);
    transform: none;
  }

  .game-toast-message {
    white-space: normal;
  }
}
</style>
