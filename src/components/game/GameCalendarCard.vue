<template>
  <section
      class="calendar-card"
      :class="{ 'is-debug-active': debugPanelVisible }"
      :aria-busy="loading"
      :aria-pressed="debugToggleEnabled ? debugPanelVisible : undefined"
      :role="debugToggleEnabled ? 'button' : undefined"
      :tabindex="debugToggleEnabled ? 0 : undefined"
      @click="handleClick"
      @keydown.enter.prevent="handleToggle"
      @keydown.space.prevent="handleToggle"
  >
    <span>{{ timeLabel }}</span>
  </section>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import type {GameTimeInfo} from '@/game/homeTypes'

const props = defineProps<{
  time: GameTimeInfo | null
  loading: boolean
  debugPanelVisible?: boolean
  debugToggleEnabled?: boolean
}>()

const emit = defineEmits<{
  toggleDebugPanel: []
}>()

const timeLabel = computed(() => {
  if (props.loading && !props.time) return '时间同步中'
  if (!props.time) return '地元历'

  return `地元${props.time.year}年 · ${props.time.season} · 第${props.time.day}日 · ${props.time.hour}`
})

function handleClick() {
  handleToggle()
}

function handleToggle() {
  if (!props.debugToggleEnabled) return

  emit('toggleDebugPanel')
}
</script>

<style>
.calendar-card {
  display: flex;
  max-width: 420px;
  min-height: 32px;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  border: 1px solid rgb(216 193 141 / 36%);
  border-radius: 8px;
  background: rgb(255 247 223 / 54%);
  opacity: 0.82;
  padding: 6px 8px;
  transition: opacity 160ms ease,
  border-color 160ms ease,
  background 160ms ease;
  backdrop-filter: blur(8px);
}

.calendar-card[role='button'] {
  cursor: pointer;
}

.calendar-card:hover,
.calendar-card:focus-within {
  border-color: rgb(216 193 141 / 52%);
  background: rgb(255 247 223 / 72%);
  opacity: 0.96;
}

.calendar-card.is-debug-active {
  border-color: rgb(99 127 67 / 68%);
  background: rgb(238 248 213 / 82%);
  opacity: 1;
}

.calendar-card span {
  overflow: hidden;
  color: rgb(58 49 35 / 92%);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .calendar-card {
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .calendar-card {
    min-height: 28px;
    padding: 5px 6px;
  }

  .calendar-card span {
    font-size: 11px;
  }
}
</style>
