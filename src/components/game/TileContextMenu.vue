<template>
  <section
      v-if="menu.visible"
      ref="menuRef"
      class="tile-context-menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
  >
    <header>
      <div class="land-hover-header context-menu-header-main">
        <strong class="context-menu-title">
          <span>{{ title }}</span>
          <svg
              v-if="neighborHomeMeta.loading"
              class="inline-loading-spinner"
              viewBox="0 0 24 24"
              aria-label="邻居信息更新中"
          >
            <circle class="inline-loading-track" cx="12" cy="12" r="8"></circle>
            <path class="inline-loading-arc" d="M20 12a8 8 0 0 0-8-8"></path>
          </svg>
        </strong>
        <small v-if="coordinate">{{ coordinate }}</small>
      </div>
      <span v-if="neighborHomeMeta.visitCount">我拜访了 {{ neighborHomeMeta.visitCount }} 次</span>
      <span v-if="neighborHomeMeta.lastVisit">上次拜访 {{ neighborHomeMeta.lastVisit }}</span>
    </header>
    <button
        v-for="action in menu.actions"
        :key="action"
        type="button"
        :disabled="isActionDisabled(action)"
        @click="$emit('select', action)"
    >
      {{ getActionLabel(action) }}
    </button>
  </section>
</template>

<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue'
import {isNeighborHomeObject} from '@/game/objectRules'
import type {ContextMenuState} from '@/game/types'

const props = defineProps<{
  menu: ContextMenuState
}>()

defineEmits<{
  select: [action: string]
}>()

const menuRef = ref<HTMLElement | null>(null)
const menuSize = ref({width: 190, height: 220})
const title = computed(() => {
  const tile = props.menu.tile
  if (!tile) return ''

  return getTileClassName(tile.name)
})
const coordinate = computed(() => {
  const tile = props.menu.tile
  if (!tile) return ''

  return `(${tile.x},${tile.y})`
})
const neighborHomeMeta = computed(() => {
  const object = props.menu.object
  const owner = object?.ownerData
  const isNeighborHome = isNeighborHomeObject(object)

  if (!isNeighborHome || !owner) {
    return {
      loading: false,
      lastVisit: '',
      visitViewCount: '',
      visitCount: '',
    }
  }

  return {
    loading: Boolean(object.neighborInfoLoading),
    lastVisit: owner.tick_last_visit?.string?.trim() || '',
    visitViewCount: owner.count_visit_view,
    visitCount: owner.count_visit,
  }
})
const position = computed(() => {
  const margin = 12
  const width = menuSize.value.width
  const height = menuSize.value.height

  return {
    x: Math.min(window.innerWidth - width - margin, Math.max(margin, props.menu.x)),
    y: Math.min(window.innerHeight - height - margin, Math.max(margin, props.menu.y)),
  }
})
const tileActionMeta = computed(() => {
  return {
    submitting: Boolean(props.menu.tile?.cropActionSubmitting),
  }
})

watch(
    () => [
      props.menu.visible,
      props.menu.actions.length,
      tileActionMeta.value.submitting,
      neighborHomeMeta.value.loading,
      neighborHomeMeta.value.lastVisit,
      neighborHomeMeta.value.visitViewCount,
      neighborHomeMeta.value.visitCount,
    ],
    async () => {
      if (!props.menu.visible) return

      await nextTick()
      const rect = menuRef.value?.getBoundingClientRect()
      if (!rect) return

      menuSize.value = {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      }
    },
    {flush: 'post'},
)

function getTileClassName(name: string) {
  return name.trim().replace(/\s+\d+$/, '') || '土地'
}

function isActionDisabled(action: string) {
  if (isCropAction(action) && tileActionMeta.value.submitting) return true

  return action === '拜访邻居' && Boolean(props.menu.object?.neighborVisitSubmitting)
}

function getActionLabel(action: string) {
  if (action === '收获' && tileActionMeta.value.submitting) return '收获中...'
  if (action === '偷取作物' && tileActionMeta.value.submitting) return '偷取中...'
  if (action === '拜访邻居' && props.menu.object?.neighborVisitSubmitting) return '拜访中...'

  return action
}

function isCropAction(action: string) {
  return action === '收获' || action === '偷取作物'
}
</script>

<style>
.tile-context-menu {
  position: absolute;
  z-index: 60;
  display: grid;
  min-width: 216px;
  max-height: calc(100vh - 24px);
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid #c8ac72;
  border-radius: 8px;
  background: rgb(255 247 223 / 96%);
  box-shadow: 0 16px 36px rgb(72 61 36 / 24%);
  backdrop-filter: blur(10px);
}

.tile-context-menu header {
  display: grid;
  gap: 2px;
  border-bottom: 1px solid #d8c18d;
  padding: 9px 10px;
  color: #3a3123;
}

.land-hover-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.context-menu-header-main {
  min-width: 0;
}

.context-menu-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.context-menu-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-context-menu header strong {
  max-width: none;
  font-size: 13px;
}

.tile-context-menu header span {
  color: #806b48;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
}

.tile-context-menu header span.is-error {
  color: #a44136;
}

.tile-context-menu button {
  min-height: 34px;
  border: 0;
  border-bottom: 1px solid #ead8a7;
  background: transparent;
  padding: 0 12px;
  color: #443721;
  text-align: left;
  font-weight: 700;
}

.tile-context-menu button:hover {
  background: #f8e4ad;
}

.tile-context-menu button:disabled:hover {
  background: transparent;
}

.tile-context-menu button:disabled {
  cursor: wait;
  opacity: 0.62;
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
