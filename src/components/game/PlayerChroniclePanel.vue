<template>
  <section class="chronicle-panel" aria-label="玩家编年历">
    <header class="chronicle-header">
      <div>
        <strong>编年史</strong>
      </div>
      <button class="chronicle-close" type="button" aria-label="关闭编年历" @click="$emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12"/>
          <path d="M18 6 6 18"/>
        </svg>
      </button>
    </header>

    <div class="chronicle-body" :aria-busy="loading">
      <div v-if="initialLoading" class="chronicle-state">正在翻阅编年历...</div>

      <div v-else-if="errorMessage && entries.length <= 0" class="chronicle-state is-error">
        {{ errorMessage }}
      </div>

      <div v-else-if="entries.length <= 0" class="chronicle-state">还没有留下记录</div>

      <ol v-else class="chronicle-list">
        <li v-for="entry in entries" :key="entry.event_id" class="chronicle-entry">
          <div class="chronicle-meta-row">
            <time class="chronicle-time">
              <span>地元{{ entry.tick_format.year }}年</span>
              <span>{{ entry.tick_format.season }}</span>
              <span>第{{ entry.tick_format.day }}日</span>
              <span>{{ entry.tick_format.hour }}</span>
            </time>
            <button
                v-if="canLocateEntry(entry)"
                class="chronicle-locate"
                type="button"
                :aria-label="`定位到 (${entry.x}, ${entry.y})`"
                @click="handleLocateEntry(entry)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="5.2"/>
                <path d="M12 3.6v3"/>
                <path d="M12 17.4v3"/>
                <path d="M3.6 12h3"/>
                <path d="M17.4 12h3"/>
              </svg>
            </button>
          </div>
          <p>{{ formatText(entry.text) }}</p>
        </li>
      </ol>

      <p v-if="errorMessage && entries.length > 0" class="chronicle-inline-error">{{ errorMessage }}</p>
    </div>

    <footer class="chronicle-footer">
      <span>{{ totalLabel }}</span>
      <button
          type="button"
          :disabled="!canLoadMore || loading"
          @click="loadNextPage"
      >
        <svg v-if="loading && entries.length > 0" class="inline-loading-spinner" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="inline-loading-track" cx="12" cy="12" r="8"/>
          <circle class="inline-loading-arc" cx="12" cy="12" r="8"/>
        </svg>
        <span>{{ loadMoreLabel }}</span>
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import api from '@/utils/ky'
import type {PlayerChronicleItem, PlayerChronicleLocation, PlayerChronicleResponse} from '@/game/homeTypes'

const PAGE_SIZE = 8

const props = defineProps<{
  playerId: string
}>()

const emit = defineEmits<{
  close: []
  locate: [location: PlayerChronicleLocation]
}>()

const entries = ref<PlayerChronicleItem[]>([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)
const errorMessage = ref('')

const initialLoading = computed(() => loading.value && entries.value.length <= 0)
const canLoadMore = computed(() => {
  if (!props.playerId) return false
  if (!loaded.value) return true

  return entries.value.length < total.value
})
const totalLabel = computed(() => {
  if (!loaded.value && !loading.value) return '尚未载入'
  if (total.value <= 0) return '共 0 条'

  return `已载入 ${entries.value.length} / ${total.value} 条`
})
const loadMoreLabel = computed(() => {
  if (loading.value && entries.value.length > 0) return '载入中'
  if (canLoadMore.value) return entries.value.length > 0 ? '加载更多' : '重新加载'

  return '没有更多'
})

onMounted(() => {
  void loadFirstPage()
})

watch(() => props.playerId, () => {
  void loadFirstPage()
})

async function loadFirstPage() {
  entries.value = []
  page.value = 0
  total.value = 0
  loaded.value = false
  errorMessage.value = ''

  if (!props.playerId) {
    errorMessage.value = '缺少玩家身份'
    return
  }

  await loadPage(1)
}

async function loadNextPage() {
  if (!canLoadMore.value || loading.value) return

  await loadPage(page.value + 1)
}

async function loadPage(nextPage: number) {
  if (!props.playerId || loading.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const data = await api.get(`api/player/${encodeURIComponent(props.playerId)}/chronicle`, {
      searchParams: {
        page: nextPage,
        page_size: PAGE_SIZE,
      },
    }).json<PlayerChronicleResponse>()

    const nextItems = Array.isArray(data.items) ? data.items : []
    entries.value = nextPage === 1 ? nextItems : entries.value.concat(nextItems)
    page.value = data.page || nextPage
    total.value = Math.max(0, Number(data.total) || 0)
    loaded.value = true
  } catch {
    errorMessage.value = '编年历读取失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

function formatText(value: string | null | undefined) {
  const text = value?.trim()

  return text || '无记录内容'
}

function canLocateEntry(entry: PlayerChronicleItem) {
  return getCoordinate(entry.x) !== null && getCoordinate(entry.y) !== null
}

function handleLocateEntry(entry: PlayerChronicleItem) {
  const x = getCoordinate(entry.x)
  const y = getCoordinate(entry.y)

  if (x === null || y === null) return

  emit('locate', {
    village_id: typeof entry.village_id === 'number' && Number.isFinite(entry.village_id)
        ? entry.village_id
        : null,
    x,
    y,
  })
}

function getCoordinate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
</script>

<style>
.chronicle-panel {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  z-index: 92;
  display: grid;
  width: 100%;
  max-height: min(520px, calc(100vh - 124px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 96%);
  box-shadow: 0 18px 42px rgb(72 61 36 / 24%);
  color: #3a3123;
  backdrop-filter: blur(14px);
}

.chronicle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgb(216 193 141 / 62%);
  padding: 12px 12px 10px;
}

.chronicle-header div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.chronicle-header strong {
  overflow: hidden;
  font-size: 16px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chronicle-close {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 34%);
  border-radius: 8px;
  background: rgb(255 242 204 / 72%);
  color: #5b4828;
}

.chronicle-close:hover,
.chronicle-close:focus-visible {
  border-color: rgb(104 124 69 / 58%);
  background: rgb(240 226 180 / 92%);
  outline: none;
}

.chronicle-close svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.chronicle-body {
  min-height: 160px;
  overflow-y: auto;
  padding: 10px 12px;
  scrollbar-width: thin;
}

.chronicle-state {
  display: grid;
  min-height: 144px;
  place-items: center;
  border: 1px dashed rgb(173 135 64 / 36%);
  border-radius: 8px;
  background: rgb(255 249 232 / 56%);
  color: #806b48;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.chronicle-state.is-error,
.chronicle-inline-error {
  color: #91372f;
}

.chronicle-state.is-error {
  border-color: rgb(195 107 85 / 42%);
  background: rgb(255 239 225 / 74%);
}

.chronicle-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chronicle-entry {
  position: relative;
  display: grid;
  gap: 5px;
  padding: 0 0 14px 18px;
}

.chronicle-entry::before {
  position: absolute;
  left: 2px;
  top: 3px;
  width: 8px;
  height: 8px;
  border: 2px solid #fff7df;
  border-radius: 50%;
  background: #7f9b59;
  box-shadow: 0 0 0 1px rgb(104 124 69 / 44%);
  content: '';
}

.chronicle-entry::after {
  position: absolute;
  left: 6px;
  top: 14px;
  bottom: 2px;
  width: 1px;
  background: rgb(173 135 64 / 34%);
  content: '';
}

.chronicle-entry:last-child {
  padding-bottom: 2px;
}

.chronicle-entry:last-child::after {
  display: none;
}

.chronicle-meta-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
}

.chronicle-time {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chronicle-time span {
  display: inline-grid;
  min-height: 20px;
  align-items: center;
  border: 1px solid rgb(173 135 64 / 26%);
  border-radius: 6px;
  background: rgb(255 242 204 / 72%);
  padding: 0 6px;
  color: #806b48;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.chronicle-locate {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid rgb(104 124 69 / 42%);
  border-radius: 8px;
  background: rgb(247 255 226 / 82%);
  color: #5f7d43;
  box-shadow: 0 3px 8px rgb(72 61 36 / 10%);
}

.chronicle-locate:hover,
.chronicle-locate:focus-visible {
  border-color: rgb(104 124 69 / 72%);
  background: rgb(232 246 194 / 96%);
  color: #3f5f2d;
  outline: none;
}

.chronicle-locate svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.chronicle-entry p {
  margin: 0;
  color: #443721;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.chronicle-inline-error {
  margin: 10px 0 0;
  border: 1px solid rgb(195 107 85 / 38%);
  border-radius: 8px;
  background: rgb(255 239 225 / 72%);
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 800;
}

.chronicle-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid rgb(216 193 141 / 62%);
  padding: 10px 12px;
}

.chronicle-footer span {
  min-width: 0;
  overflow: hidden;
  color: #806b48;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chronicle-footer button {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #b99d62;
  border-radius: 8px;
  background: #fff2cc;
  padding: 0 12px;
  color: #443721;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.chronicle-footer button:hover:not(:disabled) {
  background: #f5dfaa;
}

.chronicle-footer button:disabled {
  cursor: not-allowed;
  opacity: 0.54;
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
