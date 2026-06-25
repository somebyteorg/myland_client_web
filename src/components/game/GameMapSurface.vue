<template>
  <canvas
      ref="canvasRef"
      class="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
      :class="canvasClass"
      @pointerdown="$emit('pointerdown', $event)"
      @pointermove="$emit('pointermove', $event)"
      @pointerup="$emit('pointerup', $event)"
      @pointercancel="$emit('pointercancel', $event)"
      @pointerleave="$emit('pointerleave', $event)"
      @wheel.prevent="$emit('wheel', $event)"
      @contextmenu.prevent="$emit('contextmenu', $event)"
  />

  <div
      v-if="toolCursor.visible && activeFarmTool !== 'inspect'"
      class="tool-cursor"
      :class="{ 'is-invalid': !toolCursor.valid }"
      :style="{ left: `${toolCursor.x}px`, top: `${toolCursor.y}px` }"
  >
    <span v-if="activeFarmTool === 'shovel'" class="shovel-icon"></span>
    <span v-else>{{ activeToolIcon }}</span>
  </div>

  <section
      v-if="homeHoverCard.visible && homeHoverCard.home && isPlayerStatueHover"
      class="land-hover-card statue-hover-card"
      :style="statueHoverCardStyle"
  >
    <div class="land-hover-header">
      <strong>{{ statueHoverTitle }}</strong>
    </div>
    <div class="statue-hover-meta-row">
      <span>{{ statueHoverDescription }}</span>
      <small class="land-hover-coordinate">{{ statueHoverCoordinate }}</small>
    </div>
  </section>

  <section
      v-else-if="homeHoverCard.visible && homeHoverCard.home"
      class="home-hover-card"
      :style="hoverCardStyle"
  >
    <div class="home-hover-avatar" :style="{ borderColor: themeColor, background: avatarBackground }">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="`${ownerName}头像`"/>
      <span v-else>{{ ownerInitial }}</span>
    </div>
    <div class="home-hover-body">
      <strong class="home-hover-title">
        <span>{{ homeTitle }}</span>
        <svg
            v-if="neighborMeta.loading"
            class="inline-loading-spinner"
            viewBox="0 0 24 24"
            aria-label="邻居信息更新中"
        >
          <circle class="inline-loading-track" cx="12" cy="12" r="8"></circle>
          <path class="inline-loading-arc" d="M20 12a8 8 0 0 0-8-8"></path>
        </svg>
      </strong>
      <span>
        <span v-if="ownerGender">{{ ownerGender }}</span>
        <span v-if="ownerAge"> · {{ ownerAge }}</span>
      </span>
      <small v-if="createdAtText">{{ createdAtText }}</small>
      <div v-if="neighborMeta.visible" class="home-hover-meta">
        <small v-if="neighborMeta.visitViewCount">访客数 {{ neighborMeta.visitViewCount }}</small>
        <small v-if="neighborMeta.lastVisit">上次拜访 {{ neighborMeta.lastVisit }}</small>
      </div>
      <p v-if="manifesto">{{ manifesto }}</p>
    </div>
  </section>

  <section
      v-if="landHoverCard.visible && landHoverCard.tile"
      class="land-hover-card"
      :style="landHoverCardStyle"
  >
    <div class="land-hover-header">
      <strong>{{ landHoverTitle }}</strong>
      <small v-if="landHoverCoordinate" class="land-hover-coordinate">{{ landHoverCoordinate }}</small>
    </div>
    <span>{{ landHoverDescription }}</span>
  </section>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {getThemeStrokeColor, hexToRgba, resolveThemeColor} from '@/game/colorUtils'
import {isNeighborHomeObject} from '@/game/objectRules'
import type {FarmTool, HomeHoverCardState, LandHoverCardState} from '@/game/types'

interface ToolCursorState {
  visible: boolean
  x: number
  y: number
  valid: boolean
}

const props = defineProps<{
  activeFarmTool: FarmTool
  activeToolIcon: string
  claimMode: boolean
  homeHoverCard: HomeHoverCardState
  landHoverCard: LandHoverCardState
  toolCursor: ToolCursorState
}>()

const emit = defineEmits<{
  contextmenu: [event: MouseEvent]
  mounted: [canvas: HTMLCanvasElement]
  pointercancel: [event: PointerEvent]
  pointerdown: [event: PointerEvent]
  pointerleave: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  wheel: [event: WheelEvent]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasClass = computed(() => ({
  'tool-cursor-active': props.activeFarmTool !== 'inspect',
  'claim-cursor-active': props.claimMode,
}))

onMounted(() => {
  if (canvasRef.value) emit('mounted', canvasRef.value)
})

watch(canvasRef, (canvas) => {
  if (canvas) emit('mounted', canvas)
})

const hoverObject = computed(() => props.homeHoverCard.home)
const isPlayerStatueHover = computed(() => hoverObject.value?.type === 'player_statue')
const homeOwner = computed(() => hoverObject.value?.ownerData ?? null)
const ownerName = computed(() => homeOwner.value?.name)
const homeTitle = computed(() => hoverObject.value?.ownerType === 'player' ? '我的家' : ownerName.value)
const ownerGender = computed(() => homeOwner.value?.gender_string)
const ownerAge = computed(() => homeOwner.value?.tick_age_string)
const ownerInitial = computed(() => ownerName.value?.slice(0, 1) || '像')
const createdAtString = computed(() => hoverObject.value?.createdAtString?.trim() || '')
const createdAtText = computed(() => createdAtString.value ? `建造于 ${createdAtString.value}` : '')
const manifesto = computed(() => isPlayerStatueHover.value ? '' : homeOwner.value?.manifesto?.trim() || '')
const neighborMeta = computed(() => {
  const home = props.homeHoverCard.home
  const owner = home?.ownerData
  const isNeighborHome = isNeighborHomeObject(home)

  if (!isNeighborHome || !owner) {
    return {
      visible: false,
      loading: false,
      lastVisit: '',
      visitViewCount: '',
      visitCount: '',
    }
  }

  const lastVisit = owner.tick_last_visit?.string?.trim() || ''
  const visitViewCount = owner.count_visit_view
  const visitCount = owner.count_visit

  return {
    visible: Boolean(lastVisit || visitViewCount || visitCount),
    loading: Boolean(home.neighborInfoLoading),
    lastVisit,
    visitViewCount,
    visitCount,
  }
})
const themeColor = computed(() => resolveThemeColor(homeOwner.value?.color))
const themeStrokeColor = computed(() => getThemeStrokeColor(themeColor.value))
const avatarBackground = computed(() => `linear-gradient(145deg, ${hexToRgba(themeColor.value, 0.22)}, ${hexToRgba(themeColor.value, 0.82)})`)
const avatarUrl = computed(() => {
  const avatar = homeOwner.value?.avatar?.trim()

  return avatar || ''
})
const statueHoverTitle = computed(() => hoverObject.value?.playerStatueName?.trim() || '未命名雕像')
const statueHoverTitleLength = computed(() => Array.from(statueHoverTitle.value).length)
const statueHoverCoordinate = computed(() => {
  const statue = hoverObject.value
  if (!statue) return ''

  return `(${statue.x},${statue.y})`
})
const statueHoverDescription = computed(() => {
  const owner = ownerName.value?.trim() || '未知玩家'
  const createdAt = createdAtString.value || '时间未知'

  return `${owner} · ${createdAt}`
})
const hoverCardStyle = computed(() => {
  const margin = 12
  const width = 286
  const neighborHeight = neighborMeta.value.visible ? 58 : 0
  const height = (manifesto.value ? 188 : 86) + neighborHeight
  const x = Math.min(window.innerWidth - width - margin, Math.max(margin, props.homeHoverCard.x + 16))
  const y = Math.min(window.innerHeight - height - margin, Math.max(margin, props.homeHoverCard.y + 16))

  return {
    borderColor: themeStrokeColor.value,
    left: `${x}px`,
    top: `${y}px`,
  }
})
const landHoverTitle = computed(() => {
  const tile = props.landHoverCard.tile
  if (!tile) return '未知地块'

  return tile.crop || '未知作物'
})
const landHoverCoordinate = computed(() => {
  const tile = props.landHoverCard.tile
  if (!tile) return ''
  if (tile.terrain === 'grass' && tile.ownerType === 'none' && !tile.plant) return ''

  return `(${tile.x},${tile.y})`
})
const landHoverDescription = computed(() => {
  const tile = props.landHoverCard.tile
  if (!tile) return ''

  const owner = tile.ownerType === 'player' ? '我的地' : tile.owner || '无主'

  return `${owner} · ${tile.status}`
})
const landHoverCardStyle = computed(() => {
  const margin = 12
  const width = 212
  const height = 90
  const x = Math.min(window.innerWidth - width - margin, Math.max(margin, props.landHoverCard.x + 16))
  const y = Math.min(window.innerHeight - height - margin, Math.max(margin, props.landHoverCard.y + 16))
  const themeColor = resolveThemeColor(props.landHoverCard.tile?.themeColor)

  return {
    borderColor: getThemeStrokeColor(themeColor),
    left: `${x}px`,
    top: `${y}px`,
  }
})
const statueHoverCardStyle = computed(() => {
  const margin = 12
  const width = Math.min(360, Math.max(286, 178 + statueHoverTitleLength.value * 6))
  const titleLines = Math.max(1, Math.ceil(statueHoverTitleLength.value / 16))
  const height = 82 + titleLines * 20
  const x = Math.min(window.innerWidth - width - margin, Math.max(margin, props.homeHoverCard.x + 16))
  const y = Math.min(window.innerHeight - height - margin, Math.max(margin, props.homeHoverCard.y + 16))

  return {
    borderColor: themeStrokeColor.value,
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
  }
})
</script>

<style>
.tool-cursor-active {
  cursor: none !important;
}

.claim-cursor-active {
  cursor: crosshair !important;
}

.tool-cursor {
  position: fixed;
  z-index: 80;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 2px solid #6d9b50;
  border-radius: 50%;
  background: rgb(255 249 223 / 86%);
  color: #3f5f2d;
  font-size: 21px;
  font-weight: 900;
  pointer-events: none;
  box-shadow: 0 8px 18px rgb(56 70 36 / 22%);
  transform: translate(12px, 12px);
  backdrop-filter: blur(8px);
}

.tool-cursor.is-invalid {
  border-color: #c94d3f;
  color: #9d3028;
  background: rgb(255 235 221 / 90%);
}

.tool-cursor.is-invalid::after {
  position: absolute;
  width: 32px;
  height: 3px;
  border-radius: 999px;
  background: #c94d3f;
  content: '';
  transform: rotate(-42deg);
}

.shovel-icon {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
  transform: rotate(-35deg);
}

.shovel-icon::before {
  position: absolute;
  left: 8px;
  top: 1px;
  width: 3px;
  height: 17px;
  border-radius: 999px;
  background: currentColor;
  content: '';
}

.shovel-icon::after {
  position: absolute;
  left: 4px;
  bottom: -1px;
  width: 11px;
  height: 9px;
  border: 2px solid currentColor;
  border-top: 0;
  border-radius: 0 0 8px 8px;
  background: rgb(255 249 223 / 42%);
  content: '';
}

.home-hover-card {
  position: fixed;
  z-index: 58;
  display: flex;
  width: 286px;
  min-height: 86px;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 94%);
  padding: 10px;
  color: #3a3123;
  pointer-events: none;
  box-shadow: 0 14px 32px rgb(72 61 36 / 18%);
  backdrop-filter: blur(10px);
}

.home-hover-avatar {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 2px solid #ad8740;
  border-radius: 50%;
  background: linear-gradient(145deg, #ffe593, #c59243);
  color: #4a3512;
  font-size: 18px;
  font-weight: 900;
}

.home-hover-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.home-hover-body {
  display: grid;
  min-width: 0;
  gap: 5px;
  flex: 1;
}

.home-hover-body strong,
.home-hover-body span,
.home-hover-body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-hover-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.home-hover-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-hover-body strong {
  font-size: 15px;
  line-height: 1;
}

.home-hover-body span {
  color: #806b48;
  font-size: 12px;
  font-weight: 800;
}

.home-hover-body small {
  color: #6d5b3d;
  font-size: 12px;
  font-weight: 700;
}

.home-hover-body p {
  max-height: 92px;
  overflow: auto;
  margin: 2px 0 0;
  color: #4f452f;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
  scrollbar-width: thin;
  white-space: normal;
  word-break: break-word;
}

.home-hover-meta {
  display: grid;
  gap: 3px;
  padding-top: 2px;
}

.home-hover-meta small {
  color: #6d5b3d;
}

.land-hover-card {
  position: fixed;
  z-index: 57;
  display: grid;
  width: 212px;
  min-height: 58px;
  gap: 6px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 249 232 / 96%);
  padding: 10px 11px;
  color: #3a3123;
  pointer-events: none;
  box-shadow: 0 12px 28px rgb(72 61 36 / 18%);
  backdrop-filter: blur(10px);
}

.statue-hover-card {
  min-height: 74px;
  gap: 8px;
  background:
      linear-gradient(180deg, rgb(255 250 232 / 98%), rgb(244 233 203 / 96%));
  padding: 11px 12px;
}

.statue-hover-card .land-hover-header {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

.land-hover-card.statue-hover-card strong,
.land-hover-card.statue-hover-card span {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.land-hover-card.statue-hover-card strong {
  font-size: 15px;
  line-height: 1.25;
}

.land-hover-card.statue-hover-card span {
  color: #665136;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.statue-hover-meta-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.statue-hover-meta-row span {
  min-width: 0;
  flex: 1;
}

.statue-hover-meta-row .land-hover-coordinate {
  flex: 0 0 auto;
  border-radius: 6px;
  padding: 2px 6px;
}

.land-hover-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.land-hover-card strong,
.land-hover-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.land-hover-card strong {
  min-width: 0;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.land-hover-coordinate {
  display: inline-flex;
  width: max-content;
  min-width: 0;
  height: 17px;
  align-items: center;
  justify-content: center;
  place-items: center;
  border: 1px solid rgb(154 118 58 / 34%);
  border-radius: 5px;
  background: rgb(255 238 184 / 68%);
  color: #6b4d1f;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.land-hover-card span {
  color: #6d5b3d;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
}

.inline-loading-spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #8f5f2f;
  filter: drop-shadow(0 1px 1px rgb(72 61 36 / 18%));
  animation: spin 560ms linear infinite;
}

.inline-loading-track,
.inline-loading-arc {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
}

.inline-loading-track {
  opacity: 0.2;
  stroke-width: 3;
}

.inline-loading-arc {
  opacity: 0.95;
  stroke-dasharray: 15 38;
  stroke-linecap: round;
  stroke-width: 3.6;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
