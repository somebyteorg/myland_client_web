<template>
  <Teleport to="body">
    <section class="inventory-modal-backdrop" aria-label="背包" @click.self="closeDialog">
      <div class="game-modal inventory-modal" role="dialog" aria-modal="true" :aria-busy="loading">
        <header class="inventory-modal-header">
          <div class="inventory-modal-heading">
            <span class="inventory-modal-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8.2 8V6.8a3.8 3.8 0 0 1 7.6 0V8"/>
                <path d="M6.1 8h11.8l1 11.2H5.1Z"/>
                <path d="M8.6 12.2h6.8"/>
                <path d="M8.6 15.4h4.2"/>
              </svg>
            </span>
            <div>
              <strong>背包</strong>
              <small>查看当前玩家库存</small>
            </div>
          </div>
          <div class="inventory-header-actions">
            <button
                class="inventory-refresh-button"
                type="button"
                :disabled="loading"
                aria-label="刷新背包"
                @click="loadFirstPage"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 7.5v4h-4"/>
                <path d="M4 16.5v-4h4"/>
                <path d="M18.4 11.1A6.3 6.3 0 0 0 7.3 7.2L4 12.5"/>
                <path d="M5.6 12.9a6.3 6.3 0 0 0 11.1 3.9L20 11.5"/>
              </svg>
            </button>
            <button
                class="inventory-close-button"
                type="button"
                aria-label="关闭背包"
                @click="closeDialog"
            >
              ×
            </button>
          </div>
        </header>

        <div class="inventory-filter-bar" role="tablist" aria-label="按物品类型筛选">
          <button
              v-for="option in inventoryTypeOptions"
              :key="option.value"
              type="button"
              role="tab"
              :aria-selected="selectedItemType === option.value"
              :class="{ 'is-active': selectedItemType === option.value }"
              @click="selectItemType(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="inventory-body">
          <div v-if="initialLoading" class="inventory-state">正在整理背包...</div>

          <div v-else-if="errorMessage && inventoryItems.length <= 0" class="inventory-state is-error">
            <span>{{ errorMessage }}</span>
            <button type="button" @click="loadFirstPage">重试</button>
          </div>

          <div v-else-if="inventoryRows.length <= 0" class="inventory-state">
            当前{{ selectedTypeLabel }}没有物品
          </div>

          <div v-else class="inventory-list">
            <article
                v-for="row in inventoryRows"
                :key="row.rowKey"
                class="inventory-item"
                :data-type="row.type"
            >
              <div class="inventory-item-cover" aria-hidden="true">
                <span>{{ row.emoji }}</span>
              </div>
              <div class="inventory-item-main">
                <div class="inventory-item-title">
                  <span class="inventory-item-type">{{ row.typeLabel }}</span>
                  <strong>{{ row.name }}</strong>
                  <small>#{{ row.itemId }}</small>
                </div>
                <p v-if="row.description">{{ row.description }}</p>
                <div v-if="row.detailTags.length > 0" class="inventory-item-tags">
                  <small
                      v-for="tag in row.detailTags"
                      :key="tag.key"
                      :class="tag.tone ? `is-${tag.tone}` : null"
                  >
                    {{ tag.label }}
                  </small>
                </div>
              </div>
              <div class="inventory-item-quantity">
                <span>数量</span>
                <strong>{{ row.quantityLabel }}</strong>
              </div>
            </article>
          </div>

          <p v-if="errorMessage && inventoryItems.length > 0" class="inventory-inline-error">
            {{ errorMessage }}
          </p>
        </div>

        <footer class="inventory-footer">
          <span>{{ footerLabel }}</span>
          <button
              type="button"
              :disabled="!canLoadMore || loading"
              @click="loadNextPage"
          >
            <svg v-if="loading && inventoryItems.length > 0" class="inventory-loading-spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="inventory-loading-track" cx="12" cy="12" r="8"/>
              <circle class="inventory-loading-arc" cx="12" cy="12" r="8"/>
            </svg>
            <span>{{ loadMoreLabel }}</span>
          </button>
        </footer>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import api from '@/utils/ky'
import {resolveApiErrorMessage} from '@/utils/apiErrors'
import {
  ITEM_TYPE_BLUEPRINT,
  ITEM_TYPE_GRAIN_CROP,
  ITEM_TYPE_GRAIN_SEED,
  ITEM_TYPE_PROP,
  ITEM_TYPE_TOOL,
} from '@/game/itemCatalogData'
import type {GameItem, ItemInventoryEntry, ItemInventoryListResponse} from '@/game/types'

const PAGE_SIZE = 20

type InventoryFilterType =
    | 'all'
    | typeof ITEM_TYPE_GRAIN_SEED
    | typeof ITEM_TYPE_GRAIN_CROP
    | typeof ITEM_TYPE_PROP
    | typeof ITEM_TYPE_TOOL
    | typeof ITEM_TYPE_BLUEPRINT

interface InventoryFilterOption {
  value: InventoryFilterType
  label: string
}

interface InventoryRowTag {
  key: string
  label: string
  tone?: 'danger' | 'warning'
}

interface InventoryRow {
  rowKey: string
  itemId: number
  quantityLabel: string
  name: string
  description: string
  emoji: string
  type: string
  typeLabel: string
  detailTags: InventoryRowTag[]
}

const inventoryItemTypes = [
  ITEM_TYPE_GRAIN_SEED,
  ITEM_TYPE_GRAIN_CROP,
  ITEM_TYPE_PROP,
  ITEM_TYPE_TOOL,
  ITEM_TYPE_BLUEPRINT,
] as const

const inventoryTypeOptions = [
  {value: 'all', label: '全部'},
  {value: ITEM_TYPE_GRAIN_SEED, label: '种子'},
  {value: ITEM_TYPE_GRAIN_CROP, label: '作物'},
  {value: ITEM_TYPE_PROP, label: '道具'},
  {value: ITEM_TYPE_TOOL, label: '工具'},
  {value: ITEM_TYPE_BLUEPRINT, label: '图纸'},
] as const satisfies readonly InventoryFilterOption[]

const typeLabelByValue = new Map<string, string>(
    inventoryTypeOptions.map((option) => [option.value, option.label]),
)

const props = defineProps<{
  itemCatalog: GameItem[]
  playerId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const selectedItemType = ref<InventoryFilterType>('all')
const inventoryItems = ref<ItemInventoryEntry[]>([])
const page = ref(0)
const total = ref(0)
const loaded = ref(false)
const loading = ref(false)
const errorMessage = ref('')
let loadVersion = 0

const itemById = computed(() => new Map(props.itemCatalog.map((item) => [item.item_id, item])))
const selectedTypeLabel = computed(() => selectedItemType.value === 'all' ? '背包' : typeLabelByValue.get(selectedItemType.value) ?? '当前分类')
const initialLoading = computed(() => loading.value && inventoryItems.value.length <= 0)
const canLoadMore = computed(() => {
  if (!loaded.value || !props.playerId.trim()) return false

  return inventoryItems.value.length < total.value
})
const loadMoreLabel = computed(() => {
  if (loading.value && inventoryItems.value.length > 0) return '载入中'
  if (canLoadMore.value) return '加载更多'

  return '没有更多'
})
const footerLabel = computed(() => {
  if (!loaded.value && !loading.value) return '尚未载入'

  return `已载入 ${inventoryItems.value.length} / ${total.value} 条记录 · 当前显示 ${inventoryRows.value.length} 条库存`
})
const inventoryRows = computed<InventoryRow[]>(() => {
  return inventoryItems.value
      .map(createInventoryRow)
      .filter((row): row is InventoryRow => row !== null)
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void loadFirstPage()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.playerId, () => {
  void loadFirstPage()
})

watch(selectedItemType, () => {
  void loadFirstPage()
})

async function loadFirstPage() {
  const version = loadVersion + 1
  loadVersion = version
  inventoryItems.value = []
  page.value = 0
  total.value = 0
  loaded.value = false
  errorMessage.value = ''

  if (!props.playerId.trim()) {
    errorMessage.value = '缺少玩家身份'
    return
  }

  await loadInventoryPage(1, true, version)
}

async function loadNextPage() {
  if (!canLoadMore.value || loading.value) return

  await loadInventoryPage(page.value + 1, false, loadVersion)
}

async function loadInventoryPage(nextPage: number, reset: boolean, version: number) {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await api.get('api/item/inventory', {
      searchParams: createInventorySearchParams(nextPage),
    }).json<ItemInventoryListResponse>()

    if (version !== loadVersion) return

    const nextItems = Array.isArray(data.items) ? data.items : []
    inventoryItems.value = reset ? nextItems : inventoryItems.value.concat(nextItems)
    page.value = data.page || nextPage
    total.value = Math.max(0, Number(data.total) || 0)
    loaded.value = true
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '背包读取失败，请稍后再试')
    if (version !== loadVersion) return

    errorMessage.value = message
    if (reset) inventoryItems.value = []
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

function createInventorySearchParams(nextPage: number) {
  const searchParams = new URLSearchParams()
  searchParams.set('player_id', props.playerId.trim())
  searchParams.set('page', String(nextPage))
  searchParams.set('page_size', String(PAGE_SIZE))
  for (const itemType of getRequestItemTypes()) {
    searchParams.append('item_types[]', itemType)
  }

  return searchParams
}

function getRequestItemTypes() {
  if (selectedItemType.value === 'all') return inventoryItemTypes

  return [selectedItemType.value]
}

function selectItemType(type: InventoryFilterType) {
  if (selectedItemType.value === type) return

  selectedItemType.value = type
}

function createInventoryRow(entry: ItemInventoryEntry, index: number): InventoryRow | null {
  const itemId = Number(entry.item_id)
  const quantity = getPositiveQuantity(entry.quantity)
  if (!Number.isFinite(itemId) || quantity <= 0) return null

  const item = itemById.value.get(itemId) ?? null
  const type = getEntryType(item)
  const detailTags = createDetailTags(entry)

  return {
    rowKey: createInventoryRowKey(entry, index),
    itemId,
    quantityLabel: formatQuantity(quantity),
    name: getItemName(item, itemId),
    description: getItemDescription(item),
    emoji: getItemEmoji(item, type),
    type,
    typeLabel: getTypeLabel(type),
    detailTags,
  }
}

function createInventoryRowKey(entry: ItemInventoryEntry, index: number) {
  return [
    index,
    entry.location_type,
    entry.grid_index ?? 'none',
    entry.item_id,
    entry.tick_expired ?? 'none',
    entry.instance?.quality ?? 'none',
  ].join(':')
}

function createDetailTags(entry: ItemInventoryEntry) {
  const tags: InventoryRowTag[] = []
  const qualityLabel = entry.instance?.quality_string?.trim()
  if (qualityLabel) tags.push({key: 'quality', label: `品质: ${qualityLabel}`})

  const durabilityData = entry.instance?.durability_data
  const durabilityLabel = durabilityData?.string?.trim() || durabilityData?.code?.trim()
  if (durabilityLabel) tags.push({key: 'durability', label: `耐久: ${durabilityLabel}`})

  const creatorName = entry.instance?.creator_player_name?.trim()
  if (creatorName) tags.push({key: 'creator', label: `制造人: ${creatorName}`})

  const createdTime = entry.instance?.tick_created_format?.string?.trim()
  if (createdTime) tags.push({key: 'created', label: `制造时间: ${createdTime}`})

  if (entry.is_stolen) tags.push({key: 'stolen', label: '偷来的', tone: 'danger'})

  const expiredLabel = getExpiredLabel(entry)
  if (expiredLabel) tags.push({key: 'expired', label: `过期: ${expiredLabel}`, tone: 'warning'})

  return tags
}

function getEntryType(item: GameItem | null) {
  const itemType = item?.item_type?.trim()
  if (itemType) return itemType
  if (selectedItemType.value !== 'all') return selectedItemType.value

  return 'unknown'
}

function getTypeLabel(type: string) {
  return typeLabelByValue.get(type) ?? '未知'
}

function getItemName(item: GameItem | null, itemId: number) {
  return item?.item_name?.trim() || `物品 ${itemId}`
}

function getItemDescription(item: GameItem | null) {
  return item?.item_description?.trim() || ''
}

function getItemEmoji(item: GameItem | null, type: string) {
  const emoji = item?.item_emoji?.trim()
  if (emoji) return emoji

  if (type === ITEM_TYPE_GRAIN_SEED) return '种'
  if (type === ITEM_TYPE_GRAIN_CROP) return '作'
  if (type === ITEM_TYPE_PROP) return '道'
  if (type === ITEM_TYPE_TOOL) return '工'
  if (type === ITEM_TYPE_BLUEPRINT) return '图'

  return '物'
}

function getPositiveQuantity(value: number) {
  return Math.max(0, Number(value) || 0)
}

function formatQuantity(value: number) {
  return String(Math.max(0, Math.trunc(Number(value) || 0)))
}

function getExpiredLabel(entry: ItemInventoryEntry) {
  if (entry.tick_expired === null || entry.tick_expired === undefined) return ''

  const expiredFormat = entry.tick_expired_format
  if (typeof expiredFormat === 'string') return expiredFormat.trim()

  return expiredFormat?.string?.trim() || String(entry.tick_expired)
}

function closeDialog() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  event.preventDefault()
  closeDialog()
}
</script>

<style scoped>
.inventory-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  display: grid;
  place-items: center;
  background: rgb(54 61 38 / 18%);
  backdrop-filter: blur(3px);
}

.inventory-modal {
  display: grid;
  width: min(780px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 32px));
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(252 249 239 / 98%), rgb(241 247 230 / 98%));
  color: #3a3123;
}

.inventory-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgb(173 135 64 / 22%);
  padding-bottom: 12px;
}

.inventory-modal-heading {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.inventory-modal-heading div {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.inventory-modal-heading strong {
  font-size: 18px;
  line-height: 1;
}

.inventory-modal-heading small {
  color: #6b593c;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.inventory-modal-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(104 124 69 / 34%);
  border-radius: 8px;
  background: linear-gradient(145deg, #f6fadf, #d6e8a4);
  color: #506c38;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 48%);
}

.inventory-modal-icon svg,
.inventory-refresh-button svg {
  fill: rgb(255 249 223 / 12%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.inventory-modal-icon svg {
  width: 19px;
  height: 19px;
  stroke-width: 1.9;
}

.inventory-header-actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 8px;
}

.inventory-modal .inventory-refresh-button,
.inventory-modal .inventory-close-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 34%);
  border-radius: 8px;
  background: rgb(255 249 232 / 78%);
  color: #5b4828;
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
}

.inventory-refresh-button svg {
  width: 17px;
  height: 17px;
  stroke-width: 2;
}

.inventory-modal .inventory-refresh-button:hover:not(:disabled),
.inventory-modal .inventory-refresh-button:focus-visible,
.inventory-modal .inventory-close-button:hover,
.inventory-modal .inventory-close-button:focus-visible {
  border-color: rgb(104 124 69 / 58%);
  background: rgb(232 246 194 / 92%);
  outline: none;
}

.inventory-modal .inventory-refresh-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.inventory-filter-bar {
  display: flex;
  min-width: 0;
  gap: 7px;
  overflow-x: auto;
  border-bottom: 1px solid rgb(173 135 64 / 18%);
  padding: 12px 0;
  scrollbar-width: thin;
}

.inventory-filter-bar button {
  flex: 0 0 auto;
  min-height: 30px;
  border: 1px solid rgb(173 135 64 / 28%);
  border-radius: 8px;
  background: rgb(255 249 232 / 70%);
  padding: 0 12px;
  color: #5b4828;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.inventory-filter-bar button:hover,
.inventory-filter-bar button:focus-visible {
  border-color: rgb(104 124 69 / 58%);
  background: rgb(240 226 180 / 92%);
  outline: none;
}

.inventory-filter-bar button.is-active {
  border-color: #647f43;
  background: #6f8f50;
  color: #fff9df;
}

.inventory-body {
  min-height: 0;
  overflow-y: auto;
  padding: 14px 2px 6px;
  scrollbar-color: rgb(104 124 69 / 34%) transparent;
}

.inventory-list {
  display: grid;
  gap: 8px;
}

.inventory-item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) minmax(72px, auto);
  align-items: center;
  gap: 12px;
  min-height: 78px;
  border: 1px solid rgb(173 135 64 / 28%);
  border-radius: 8px;
  background: linear-gradient(180deg, rgb(255 252 242 / 94%), rgb(245 249 233 / 88%));
  padding: 9px 10px;
  box-shadow: 0 8px 18px rgb(72 61 36 / 8%);
}

.inventory-item-cover {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid rgb(104 124 69 / 28%);
  border-radius: 8px;
  background: rgb(250 255 232 / 88%);
  color: #506c38;
  font-size: 20px;
  font-weight: 900;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 56%);
}

.inventory-item-cover span {
  display: block;
  max-width: 100%;
  line-height: 1;
  overflow-wrap: anywhere;
}

.inventory-item-main {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.inventory-item-title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.inventory-item-title strong {
  min-width: 0;
  overflow: hidden;
  color: #3f3321;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-item-type {
  flex: 0 0 auto;
  border: 1px solid rgb(104 124 69 / 24%);
  border-radius: 6px;
  background: rgb(236 247 209 / 78%);
  padding: 2px 6px;
  color: #55723d;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.inventory-item-title small {
  min-width: 44px;
  color: #9a7e4d;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-align: right;
  white-space: nowrap;
}

.inventory-item-main p {
  margin: 0;
  color: #6b593c;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.inventory-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.inventory-item-tags small {
  display: inline-flex;
  min-height: 19px;
  align-items: center;
  border: 1px solid rgb(173 135 64 / 22%);
  border-radius: 6px;
  background: rgb(255 249 232 / 70%);
  padding: 0 6px;
  color: #806b48;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
}

.inventory-item-tags small.is-danger {
  border-color: rgb(181 74 61 / 32%);
  background: rgb(255 235 225 / 78%);
  color: #9a352c;
}

.inventory-item-tags small.is-warning {
  border-color: rgb(184 130 42 / 34%);
  background: rgb(255 241 198 / 78%);
  color: #7c5518;
}

.inventory-item-quantity {
  display: grid;
  min-width: 0;
  justify-items: end;
  gap: 4px;
  border-left: 1px solid rgb(173 135 64 / 20%);
  padding-left: 12px;
}

.inventory-item-quantity span {
  color: #806b48;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.inventory-item-quantity strong {
  max-width: 132px;
  color: #3f5f2d;
  font-size: 19px;
  font-weight: 950;
  line-height: 1.05;
  overflow-wrap: anywhere;
  text-align: right;
}

.inventory-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  border: 1px dashed rgb(173 135 64 / 42%);
  border-radius: 8px;
  background: rgb(255 249 232 / 58%);
  color: #6b593c;
  font-size: 14px;
  font-weight: 850;
  text-align: center;
}

.inventory-state.is-error {
  gap: 10px;
  border-color: rgb(195 107 85 / 46%);
  background: rgb(255 239 225 / 72%);
  color: #91372f;
}

.inventory-state button {
  min-height: 32px;
  border: 1px solid #b99d62;
  border-radius: 8px;
  background: #fff2cc;
  padding: 0 12px;
  color: #443721;
  font-weight: 900;
}

.inventory-inline-error {
  margin: 10px 0 0;
  border: 1px solid rgb(195 107 85 / 38%);
  border-radius: 8px;
  background: rgb(255 239 225 / 72%);
  padding: 8px 10px;
  color: #91372f;
  font-size: 12px;
  font-weight: 850;
}

.inventory-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid rgb(173 135 64 / 22%);
  padding-top: 12px;
}

.inventory-footer span {
  min-width: 0;
  color: #806b48;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.inventory-footer button {
  display: inline-flex;
  min-height: 32px;
  flex: 0 0 auto;
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

.inventory-footer button:hover:not(:disabled),
.inventory-state button:hover,
.inventory-state button:focus-visible {
  background: #f5dfaa;
  outline: none;
}

.inventory-footer button:disabled {
  cursor: not-allowed;
  opacity: 0.54;
}

.inventory-loading-spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #8f5f2f;
  animation: inventory-spin 560ms linear infinite;
}

.inventory-loading-track,
.inventory-loading-arc {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
}

.inventory-loading-track {
  opacity: 0.2;
  stroke-width: 3;
}

.inventory-loading-arc {
  opacity: 0.95;
  stroke-dasharray: 15 38;
  stroke-width: 3.6;
}

@keyframes inventory-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .inventory-modal {
    width: min(100vw - 20px, 520px);
    height: calc(100vh - 20px);
  }

  .inventory-list {
    grid-template-columns: 1fr;
  }

  .inventory-item {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .inventory-item-quantity {
    grid-column: 1 / -1;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    justify-items: start;
    border-top: 1px solid rgb(173 135 64 / 20%);
    border-left: 0;
    padding-top: 8px;
    padding-left: 0;
  }

  .inventory-item-quantity strong {
    max-width: 100%;
    text-align: left;
  }
}
</style>
