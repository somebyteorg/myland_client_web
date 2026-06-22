<template>
  <Teleport to="body">
    <div
        v-if="tooltip.visible"
        ref="rootRef"
        class="game-tooltip"
        :style="{
          left: `${tooltip.x}px`,
          top: `${tooltip.y}px`,
          '--tooltip-arrow-left': `${tooltip.arrowX}px`,
        }"
        role="tooltip"
    >
      <strong>{{ tooltip.title }}</strong>
      <small v-if="tooltip.description">{{ tooltip.description }}</small>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {onBeforeUnmount, ref, watch} from 'vue'
import type {FloatingTooltipState} from '@/composables/useFloatingTooltip'

defineProps<{
  tooltip: FloatingTooltipState
}>()

const emit = defineEmits<{
  updateElement: [element: HTMLElement | null]
}>()

const rootRef = ref<HTMLElement | null>(null)

watch(rootRef, (element) => {
  emit('updateElement', element)
}, {immediate: true})

onBeforeUnmount(() => {
  emit('updateElement', null)
})
</script>

<style>
.game-tooltip {
  position: fixed;
  z-index: 120;
  display: grid;
  width: max-content;
  max-width: min(260px, calc(100vw - 24px));
  gap: 5px;
  border: 1px solid rgb(176 139 73 / 52%);
  border-radius: 8px;
  background: rgb(255 249 232 / 98%);
  box-shadow: 0 14px 30px rgb(72 61 36 / 20%);
  padding: 9px 10px;
  color: #4c3c22;
  pointer-events: none;
  text-align: left;
}

.game-tooltip::before {
  position: absolute;
  left: var(--tooltip-arrow-left, 14px);
  top: -5px;
  width: 9px;
  height: 9px;
  border-left: 1px solid rgb(176 139 73 / 52%);
  border-top: 1px solid rgb(176 139 73 / 52%);
  background: rgb(255 249 232 / 98%);
  content: '';
  transform: rotate(45deg);
}

.game-tooltip strong {
  font-size: 12px;
  line-height: 1;
}

.game-tooltip small {
  color: #6b5734;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
