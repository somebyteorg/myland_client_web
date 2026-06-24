<template>
  <button v-if="collapsed" class="minimap-toggle" type="button" @mouseenter="$emit('expand')" @focus="$emit('expand')"
          @click="$emit('toggle')">地图
  </button>

  <section v-if="!collapsed" class="minimap-panel" @mouseleave="handleMouseLeave">
    <GameTooltip :tooltip="tooltip" @update-element="setTooltipElement"/>
    <div class="minimap-head">
      <span>{{ mapName }}</span>
      <button
          v-if="!claimMode"
          class="minimap-locate"
          type="button"
          aria-label="定位到我的地"
          @click="handleLocatePlayer"
          @focus="showLocatePlayerTooltip"
          @blur="hideTooltip"
          @mouseenter="showLocatePlayerTooltip"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
      >
        <i></i>
      </button>
      <button
          v-if="claimMode"
          class="minimap-locate claim-locate"
          type="button"
          :aria-label="locateClaimTitle"
          @click="handleLocateClaim"
          @focus="showLocateClaimTooltip"
          @blur="hideTooltip"
          @mouseenter="showLocateClaimTooltip"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
      >
        <i></i>
      </button>
    </div>
    <canvas
        ref="canvasRef"
        class="minimap-canvas"
        @pointerdown="$emit('pointerdown', $event)"
        @pointermove="$emit('pointermove', $event)"
        @pointerup="$emit('pointerup', $event)"
        @pointercancel="$emit('pointerup', $event)"
        @wheel.prevent="$emit('wheel', $event)"
    ></canvas>
  </section>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import GameTooltip from '@/components/game/GameTooltip.vue'
import {useFloatingTooltip} from '@/composables/useFloatingTooltip'

const props = defineProps<{
  collapsed: boolean
  claimMode: boolean
  dragging: boolean
  mapName?: string
  placementMode: 'pioneer' | 'deed' | null
}>()

const emit = defineEmits<{
  collapse: []
  expand: []
  locateClaim: []
  locatePlayer: []
  mounted: [canvas: HTMLCanvasElement]
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  toggle: []
  wheel: [event: WheelEvent]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const {tooltip, showTooltip, moveTooltip, hideTooltip, setTooltipElement} = useFloatingTooltip()
const claimFilterLabel = computed(() => props.placementMode === 'deed' ? '可扩张地块' : '可开拓地块')
const locateClaimTitle = computed(() => `定位到${claimFilterLabel.value}`)

onMounted(() => {
  if (canvasRef.value) emit('mounted', canvasRef.value)
})

watch(canvasRef, (canvas) => {
  if (canvas) emit('mounted', canvas)
})

function handleMouseLeave() {
  if (!props.dragging) emit('collapse')
}

function handleLocatePlayer() {
  hideTooltip()
  emit('locatePlayer')
}

function handleLocateClaim() {
  hideTooltip()
  emit('locateClaim')
}

function showLocatePlayerTooltip(event: MouseEvent | FocusEvent) {
  showTooltip('定位到我的地', '将视角移动到你的家园或当前领地中心', event)
}

function showLocateClaimTooltip(event: MouseEvent | FocusEvent) {
  const description = props.placementMode === 'deed'
      ? '将视角移动到可扩张的相邻空地'
      : '将视角移动到可开拓的空白区域'

  showTooltip(locateClaimTitle.value, description, event)
}
</script>

<style>
.minimap-toggle {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 24;
  min-height: 34px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 91%);
  padding: 0 12px;
  color: #59482e;
  font-weight: 800;
  box-shadow: 0 10px 24px rgb(72 61 36 / 16%);
  backdrop-filter: blur(10px);
}

.minimap-panel {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 24;
  width: 260px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 91%);
  padding: 12px;
  box-shadow: 0 14px 32px rgb(72 61 36 / 18%);
  backdrop-filter: blur(10px);
}

.minimap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #806b48;
  font-size: 13px;
}

.minimap-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 900;
}

.minimap-locate {
  position: relative;
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #b99d62;
  border-radius: 8px;
  background: rgb(255 242 204 / 88%);
  color: #59482e;
}

.minimap-locate:hover {
  background: #efd28b;
}

.claim-locate {
  color: #725417;
}

.minimap-locate.claim-locate i {
  border-radius: 3px;
  background: rgb(255 214 87 / 22%);
}

.minimap-locate.claim-locate i::before,
.minimap-locate.claim-locate i::after {
  display: none;
}

.minimap-locate i {
  position: relative;
  display: block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-radius: 50%;
}

.minimap-locate i::before,
.minimap-locate i::after {
  position: absolute;
  background: currentColor;
  content: '';
}

.minimap-locate i::before {
  left: 50%;
  top: -5px;
  width: 2px;
  height: 20px;
  transform: translateX(-50%);
}

.minimap-locate i::after {
  left: -5px;
  top: 50%;
  width: 20px;
  height: 2px;
  transform: translateY(-50%);
}

.minimap-canvas {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  margin-top: 10px;
  border: 1px solid #b99d62;
  border-radius: 6px;
  background: #8fc86a;
  cursor: crosshair;
}

@media (max-width: 900px) {
  .minimap-panel {
    right: 12px;
    bottom: 12px;
    width: 220px;
  }

  .minimap-toggle {
    right: 12px;
    bottom: 12px;
  }
}

@media (max-width: 640px) {
  .minimap-panel {
    width: 150px;
    padding: 9px;
  }

}
</style>
