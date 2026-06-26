<template>
  <Teleport to="body">
    <section class="tool-craft-backdrop" aria-label="制作" @click.self="closeDialog">
      <div class="game-modal tool-craft-modal" role="dialog" aria-modal="true" :aria-busy="loading || inventoryLoading || makingItemId !== null">
        <header class="tool-craft-header">
          <div class="tool-craft-heading">
            <span class="tool-craft-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M14.8 5.2 19 9.4"/>
                <path d="M13.3 6.7 8.6 11.4"/>
                <path d="M6.5 13.5 4.2 19.8l6.3-2.3 7.9-7.9-4-4Z"/>
                <path d="M7.2 16.8 9 18.6"/>
              </svg>
            </span>
            <div>
              <strong>制作</strong>
              <small>制作可用工具</small>
            </div>
          </div>
          <div class="tool-craft-header-actions">
            <button
                class="tool-craft-refresh"
                type="button"
                :disabled="loading || inventoryLoading || makingItemId !== null"
                aria-label="刷新制作列表"
                @click="loadFirstPage"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 7.5v4h-4"/>
                <path d="M4 16.5v-4h4"/>
                <path d="M18.4 11.1A6.3 6.3 0 0 0 7.3 7.2L4 12.5"/>
                <path d="M5.6 12.9a6.3 6.3 0 0 0 11.1 3.9L20 11.5"/>
              </svg>
            </button>
            <button class="tool-craft-close" type="button" aria-label="关闭制作" @click="closeDialog">×</button>
          </div>
        </header>

        <div class="tool-craft-body">
          <div v-if="initialLoading" class="tool-craft-state">正在查看工坊...</div>

          <div v-else-if="errorMessage && craftRows.length <= 0" class="tool-craft-state is-error">
            <span>{{ errorMessage }}</span>
            <button type="button" @click="loadFirstPage">重试</button>
          </div>

          <div v-else-if="craftRows.length <= 0" class="tool-craft-state">当前没有可制作工具</div>

          <div v-else class="tool-craft-list">
            <article v-for="row in craftRows" :key="row.itemId" class="tool-craft-item">
              <div class="tool-craft-cover" aria-hidden="true">{{ row.emoji }}</div>

              <div class="tool-craft-main">
                <div class="tool-craft-title">
                  <span>工具</span>
                  <strong>{{ row.name }}</strong>
                  <small>#{{ row.itemId }}</small>
                </div>
                <p v-if="row.description">{{ row.description }}</p>
                <div class="tool-craft-materials">
                  <span
                      v-for="material in row.materials"
                      :key="material.itemId"
                      class="tool-craft-material"
                      :class="{ 'is-missing': !material.enough }"
                  >
                    <b aria-hidden="true">{{ material.emoji }}</b>
                    <span>{{ material.name }}</span>
                    <strong>{{ material.availableQuantityLabel }} / {{ material.requiredQuantityLabel }}</strong>
                  </span>
                </div>
              </div>

              <div class="tool-craft-controls">
                <label class="tool-craft-number">
                  <span>数量</span>
                  <div>
                    <button
                        type="button"
                        :disabled="row.number <= 1 || makingItemId !== null"
                        aria-label="减少制作数量"
                        @click="stepCraftNumber(row.itemId, -1)"
                    >
                      -
                    </button>
                    <input
                        :value="row.number"
                        type="number"
                        min="1"
                        :max="MAX_CRAFT_NUMBER"
                        step="1"
                        inputmode="numeric"
                        :disabled="makingItemId !== null"
                        @input="handleCraftNumberInput(row.itemId, $event)"
                        @change="handleCraftNumberInput(row.itemId, $event)"
                    />
                    <button
                        type="button"
                        :disabled="row.number >= MAX_CRAFT_NUMBER || makingItemId !== null"
                        aria-label="增加制作数量"
                        @click="stepCraftNumber(row.itemId, 1)"
                    >
                      +
                    </button>
                  </div>
                </label>

                <button
                    class="tool-craft-submit"
                    type="button"
                    :class="{ 'is-loading': makingItemId === row.itemId }"
                    :disabled="!row.canMake || makingItemId !== null"
                    @click="submitMake(row)"
                >
                  <i v-if="makingItemId === row.itemId" class="tool-craft-spinner" aria-hidden="true"></i>
                  <span>{{ makingItemId === row.itemId ? '制作中' : '制作' }}</span>
                </button>
              </div>
            </article>
          </div>

          <p v-if="errorMessage && craftRows.length > 0" class="tool-craft-inline-error">{{ errorMessage }}</p>
          <p v-if="makeErrorMessage" class="tool-craft-inline-error">{{ makeErrorMessage }}</p>
        </div>

        <footer class="tool-craft-footer">
          <span>{{ footerLabel }}</span>
          <button
              type="button"
              :disabled="!canLoadMore || loading || makingItemId !== null"
              @click="loadNextPage"
          >
            <svg v-if="loading && tools.length > 0" class="tool-craft-spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="tool-craft-spinner-track" cx="12" cy="12" r="8"/>
              <circle class="tool-craft-spinner-arc" cx="12" cy="12" r="8"/>
            </svg>
            <span>{{ loadMoreLabel }}</span>
          </button>
        </footer>

        <section v-if="craftResult" class="tool-craft-result-backdrop" aria-label="制作结果" @click.self="closeCraftResult">
          <div class="tool-craft-result" role="dialog" aria-modal="true">
            <header>
              <strong>制作完成</strong>
              <button type="button" aria-label="关闭制作结果" @click="closeCraftResult">×</button>
            </header>
            <p>{{ craftResult.name }} × {{ craftResult.number }}</p>
            <div v-if="craftResult.instances.length > 0" class="tool-craft-result-list">
              <article v-for="(instance, index) in craftResult.instances" :key="index">
                <span>{{ craftResult.emoji }}</span>
                <div>
                  <strong>{{ craftResult.name }}</strong>
                  <small v-if="getInstanceLabel(instance)">{{ getInstanceLabel(instance) }}</small>
                </div>
              </article>
            </div>
            <footer>
              <button type="button" @click="closeCraftResult">知道了</button>
            </footer>
          </div>
        </section>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import api from '@/utils/ky'
import {resolveApiErrorMessage} from '@/utils/apiErrors'
import {
  loadToolCraftItems,
  makeTool,
  normalizeToolMakeInstances,
  type ToolCraftItem,
} from '@/game/toolCraft'
import type {GameItem, ItemInventoryEntry, ItemInventoryInstanceData, ItemInventoryListResponse} from '@/game/types'

const PAGE_SIZE = 20
const MAX_CRAFT_NUMBER = 10

interface CraftMaterialRow {
  itemId: number
  name: string
  emoji: string
  availableQuantity: number
  requiredQuantity: number
  availableQuantityLabel: string
  requiredQuantityLabel: string
  enough: boolean
}

interface CraftRow {
  itemId: number
  name: string
  description: string
  emoji: string
  number: number
  maxMakeQuantityLabel: string
  canMake: boolean
  materials: CraftMaterialRow[]
}

interface CraftResult {
  itemId: number
  name: string
  emoji: string
  number: number
  instances: ItemInventoryInstanceData[]
}

const props = defineProps<{
  itemCatalog: GameItem[]
  playerId: string
}>()

const emit = defineEmits<{
  close: []
  inventoryUpdated: []
}>()

const tools = ref<ToolCraftItem[]>([])
const materialInventory = ref<Record<number, number>>({})
const craftNumbers = reactive<Record<number, number>>({})
const page = ref(0)
const total = ref(0)
const loaded = ref(false)
const loading = ref(false)
const inventoryLoading = ref(false)
const errorMessage = ref('')
const makeErrorMessage = ref('')
const makingItemId = ref<number | null>(null)
const craftResult = ref<CraftResult | null>(null)
let loadVersion = 0

const itemById = computed(() => new Map(props.itemCatalog.map((item) => [item.item_id, item])))
const initialLoading = computed(() => loading.value && tools.value.length <= 0)
const canLoadMore = computed(() => loaded.value && tools.value.length < total.value)
const loadMoreLabel = computed(() => {
  if (loading.value && tools.value.length > 0) return '载入中'
  if (canLoadMore.value) return '加载更多'

  return '没有更多'
})
const footerLabel = computed(() => {
  if (!loaded.value && !loading.value) return '尚未载入'

  return `已载入 ${tools.value.length} / ${total.value} 个工具`
})
const craftRows = computed<CraftRow[]>(() => tools.value.map(createCraftRow))

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

async function loadFirstPage() {
  const version = loadVersion + 1
  loadVersion = version
  tools.value = []
  materialInventory.value = {}
  page.value = 0
  total.value = 0
  loaded.value = false
  errorMessage.value = ''
  makeErrorMessage.value = ''

  if (!props.playerId.trim()) {
    errorMessage.value = '缺少玩家身份'
    return
  }

  await loadToolPage(1, true, version)
}

async function loadNextPage() {
  if (!canLoadMore.value || loading.value) return

  await loadToolPage(page.value + 1, false, loadVersion)
}

async function loadToolPage(nextPage: number, reset: boolean, version: number) {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await loadToolCraftItems(props.playerId.trim(), nextPage, PAGE_SIZE)
    if (version !== loadVersion) return

    const nextItems = Array.isArray(data.items) ? data.items : []
    tools.value = reset ? nextItems : tools.value.concat(nextItems)
    page.value = data.page || nextPage
    total.value = Math.max(0, Number(data.total) || 0)
    loaded.value = true
    await refreshMaterialInventory(version)
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '制作列表读取失败，请稍后再试')
    if (version !== loadVersion) return

    errorMessage.value = message
    if (reset) tools.value = []
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function refreshMaterialInventory(version = loadVersion) {
  const searchParams = createMaterialInventorySearchParams()
  if (!searchParams) {
    materialInventory.value = {}
    return
  }

  inventoryLoading.value = true

  try {
    const data = await api.get('api/item/inventory', {
      searchParams,
    }).json<ItemInventoryListResponse>()
    if (version !== loadVersion) return

    materialInventory.value = createInventoryQuantityMap(data.items ?? [])
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '材料库存读取失败，请稍后再试')
    if (version !== loadVersion) return

    errorMessage.value = message
    materialInventory.value = {}
  } finally {
    if (version === loadVersion) inventoryLoading.value = false
  }
}

function createMaterialInventorySearchParams() {
  const playerId = props.playerId.trim()
  const needItemIds = getNeedItemIds()
  if (!playerId || needItemIds.length <= 0) return null

  const itemTypes = new Set<string>()
  const fallbackItemIds: number[] = []
  for (const itemId of needItemIds) {
    const itemType = itemById.value.get(itemId)?.item_type?.trim()
    if (itemType) itemTypes.add(itemType)
    else fallbackItemIds.push(itemId)
  }

  const searchParams = new URLSearchParams()
  searchParams.set('player_id', playerId)
  searchParams.set('page_size', '1000')
  for (const itemType of itemTypes) {
    searchParams.append('item_types[]', itemType)
  }
  for (const itemId of fallbackItemIds) {
    searchParams.append('item_ids[]', String(itemId))
  }

  return searchParams
}

function getNeedItemIds() {
  return Array.from(new Set(
      tools.value.flatMap((tool) => tool.recipes.map((recipe) => Number(recipe.need_item_id)))
          .filter((itemId) => Number.isFinite(itemId) && itemId > 0),
  ))
}

function createInventoryQuantityMap(entries: ItemInventoryEntry[]) {
  const result: Record<number, number> = {}

  for (const entry of entries) {
    const itemId = Number(entry.item_id)
    if (!Number.isFinite(itemId)) continue

    result[itemId] = (result[itemId] ?? 0) + Math.max(0, Number(entry.quantity) || 0)
  }

  return result
}

function createCraftRow(tool: ToolCraftItem): CraftRow {
  const item = itemById.value.get(tool.item_id) ?? null
  const number = getCraftNumber(tool.item_id)
  const materials = tool.recipes.map((recipe) => createMaterialRow(recipe, number))
  const maxMakeQuantity = getMaxMakeQuantity(tool)

  return {
    itemId: tool.item_id,
    name: getItemName(item, tool.item_id),
    description: getItemDescription(item),
    emoji: getItemEmoji(item),
    number,
    maxMakeQuantityLabel: formatQuantity(maxMakeQuantity),
    canMake: materials.length > 0 && number <= maxMakeQuantity,
    materials,
  }
}

function createMaterialRow(recipe: ToolCraftItem['recipes'][number], number: number): CraftMaterialRow {
  const itemId = Number(recipe.need_item_id)
  const needQuantity = Math.max(0, Number(recipe.need_quantity) || 0)
  const requiredQuantity = needQuantity * number
  const availableQuantity = Math.max(0, Number(materialInventory.value[itemId]) || 0)
  const item = itemById.value.get(itemId) ?? null

  return {
    itemId,
    name: getItemName(item, itemId),
    emoji: getItemEmoji(item),
    availableQuantity,
    requiredQuantity,
    availableQuantityLabel: formatQuantity(availableQuantity),
    requiredQuantityLabel: formatQuantity(requiredQuantity),
    enough: availableQuantity >= requiredQuantity,
  }
}

function getMaxMakeQuantity(tool: ToolCraftItem) {
  if (tool.recipes.length <= 0) return 0

  const maxQuantity = Math.min(...tool.recipes.map((recipe) => {
    const itemId = Number(recipe.need_item_id)
    const needQuantity = Math.max(0, Number(recipe.need_quantity) || 0)
    const availableQuantity = Math.max(0, Number(materialInventory.value[itemId]) || 0)
    if (needQuantity <= 0) return MAX_CRAFT_NUMBER

    return Math.floor(availableQuantity / needQuantity)
  }))

  return Math.min(MAX_CRAFT_NUMBER, Math.max(0, maxQuantity))
}

async function submitMake(row: CraftRow) {
  if (!row.canMake || makingItemId.value !== null) return

  const number = getCraftNumber(row.itemId)
  makingItemId.value = row.itemId
  makeErrorMessage.value = ''

  try {
    const payload = await makeTool(props.playerId.trim(), row.itemId, number)
    const instances = normalizeToolMakeInstances(payload)
    craftResult.value = {
      itemId: row.itemId,
      name: row.name,
      emoji: row.emoji,
      number,
      instances,
    }
    emit('inventoryUpdated')
    await refreshMaterialInventory()
  } catch (error) {
    console.error(error)
    makeErrorMessage.value = await resolveApiErrorMessage(error, '制作失败，请稍后再试')
  } finally {
    makingItemId.value = null
  }
}

function getCraftNumber(itemId: number) {
  const value = Number(craftNumbers[itemId])
  if (!Number.isFinite(value)) {
    craftNumbers[itemId] = 1
    return 1
  }

  const nextValue = clampCraftNumber(value)
  if (nextValue !== value) craftNumbers[itemId] = nextValue

  return nextValue
}

function handleCraftNumberInput(itemId: number, event: Event) {
  setCraftNumber(itemId, Number((event.target as HTMLInputElement).value))
}

function stepCraftNumber(itemId: number, delta: number) {
  setCraftNumber(itemId, getCraftNumber(itemId) + delta)
}

function setCraftNumber(itemId: number, value: number) {
  craftNumbers[itemId] = clampCraftNumber(value)
}

function clampCraftNumber(value: number) {
  const nextValue = Number.isFinite(value) ? Math.trunc(value) : 1

  return Math.min(MAX_CRAFT_NUMBER, Math.max(1, nextValue))
}

function getItemName(item: GameItem | null, itemId: number) {
  return item?.item_name?.trim() || `物品 ${itemId}`
}

function getItemDescription(item: GameItem | null) {
  return item?.item_description?.trim() || ''
}

function getItemEmoji(item: GameItem | null) {
  return item?.item_emoji?.trim() || '工'
}

function formatQuantity(value: number) {
  return String(Math.max(0, Math.trunc(Number(value) || 0)))
}

function getInstanceLabel(instance: ItemInventoryInstanceData) {
  const labels = [
    instance.quality_string?.trim(),
    instance.durability_data?.string?.trim(),
  ].filter((label): label is string => Boolean(label))

  return labels.join(' · ')
}

function closeCraftResult() {
  craftResult.value = null
}

function closeDialog() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  event.preventDefault()
  if (craftResult.value) {
    closeCraftResult()
    return
  }

  closeDialog()
}
</script>

<style scoped>
.tool-craft-backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  display: grid;
  place-items: center;
  background: rgb(54 61 38 / 18%);
  backdrop-filter: blur(3px);
}

.tool-craft-modal {
  position: relative;
  display: grid;
  width: min(820px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 32px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(250 248 240 / 98%), rgb(239 246 242 / 98%));
  color: #3a3123;
}

.tool-craft-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgb(117 130 104 / 22%);
  padding-bottom: 12px;
}

.tool-craft-heading {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.tool-craft-heading div {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.tool-craft-heading strong {
  font-size: 18px;
  line-height: 1;
}

.tool-craft-heading small {
  color: #66715f;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.tool-craft-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(86 106 116 / 32%);
  border-radius: 8px;
  background: linear-gradient(145deg, #eef5f2, #c7dad5);
  color: #405c60;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 50%);
}

.tool-craft-icon svg,
.tool-craft-refresh svg {
  fill: rgb(255 255 255 / 12%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tool-craft-icon svg {
  width: 19px;
  height: 19px;
  stroke-width: 1.9;
}

.tool-craft-header-actions {
  display: inline-flex;
  gap: 8px;
}

.tool-craft-modal .tool-craft-refresh,
.tool-craft-modal .tool-craft-close {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgb(117 130 104 / 32%);
  border-radius: 8px;
  background: rgb(255 250 236 / 78%);
  color: #405c60;
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
}

.tool-craft-refresh svg {
  width: 17px;
  height: 17px;
  stroke-width: 2;
}

.tool-craft-modal .tool-craft-refresh:hover:not(:disabled),
.tool-craft-modal .tool-craft-refresh:focus-visible,
.tool-craft-modal .tool-craft-close:hover,
.tool-craft-modal .tool-craft-close:focus-visible {
  border-color: rgb(74 118 120 / 52%);
  background: rgb(224 240 235 / 92%);
  outline: none;
}

.tool-craft-modal .tool-craft-refresh:disabled {
  cursor: wait;
  opacity: 0.55;
}

.tool-craft-body {
  min-height: 0;
  overflow-y: auto;
  padding: 14px 2px 6px;
  scrollbar-color: rgb(74 118 120 / 34%) transparent;
}

.tool-craft-list {
  display: grid;
  gap: 10px;
}

.tool-craft-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) minmax(132px, auto);
  align-items: center;
  gap: 12px;
  min-height: 108px;
  border: 1px solid rgb(117 130 104 / 26%);
  border-radius: 8px;
  background: linear-gradient(180deg, rgb(255 252 242 / 94%), rgb(239 247 244 / 88%));
  padding: 10px;
  box-shadow: 0 8px 18px rgb(72 61 36 / 8%);
}

.tool-craft-cover {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid rgb(74 118 120 / 26%);
  border-radius: 8px;
  background: rgb(237 248 245 / 88%);
  color: #405c60;
  font-size: 22px;
  font-weight: 900;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 56%);
}

.tool-craft-main {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.tool-craft-title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.tool-craft-title span {
  border: 1px solid rgb(74 118 120 / 24%);
  border-radius: 6px;
  background: rgb(229 244 240 / 78%);
  padding: 2px 6px;
  color: #456e70;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.tool-craft-title strong {
  min-width: 0;
  overflow: hidden;
  color: #2f3e3f;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-craft-title small {
  color: #8a7452;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-align: right;
  white-space: nowrap;
}

.tool-craft-main p {
  margin: 0;
  color: #64705c;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.tool-craft-materials {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-craft-material {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 5px;
  border: 1px solid rgb(117 130 104 / 22%);
  border-radius: 7px;
  background: rgb(255 250 236 / 70%);
  padding: 0 7px 0 5px;
  color: #52624e;
  font-size: 11px;
  font-weight: 850;
}

.tool-craft-material.is-missing {
  border-color: rgb(181 74 61 / 34%);
  background: rgb(255 235 225 / 78%);
  color: #9a352c;
}

.tool-craft-material b {
  font-size: 13px;
  line-height: 1;
}

.tool-craft-material strong {
  color: currentColor;
  font: inherit;
}

.tool-craft-controls {
  display: grid;
  gap: 9px;
  border-left: 1px solid rgb(117 130 104 / 22%);
  padding-left: 12px;
}

.tool-craft-number {
  display: grid;
  gap: 5px;
}

.tool-craft-number > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: #66715f;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.tool-craft-number > span small {
  color: #8a7452;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.tool-craft-number div {
  display: grid;
  grid-template-columns: 28px 42px 28px;
  overflow: hidden;
  border: 1px solid rgb(117 130 104 / 28%);
  border-radius: 8px;
  background: rgb(255 250 236 / 80%);
}

.tool-craft-number button,
.tool-craft-number input,
.tool-craft-submit {
  min-height: 30px;
  border: 0;
  color: #2f3e3f;
  font-size: 12px;
  font-weight: 900;
}

.tool-craft-number button {
  background: rgb(232 240 226 / 92%);
}

.tool-craft-number button:disabled,
.tool-craft-submit:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.tool-craft-number input {
  width: 100%;
  border-right: 1px solid rgb(117 130 104 / 24%);
  border-left: 1px solid rgb(117 130 104 / 24%);
  background: rgb(255 253 246 / 88%);
  text-align: center;
}

.tool-craft-number input:focus-visible,
.tool-craft-number button:focus-visible,
.tool-craft-submit:focus-visible {
  outline: 2px solid rgb(159 124 61 / 24%);
  outline-offset: 1px;
}

.tool-craft-submit {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgb(169 137 82 / 56%);
  border-radius: 8px;
  background: linear-gradient(180deg, #f7efd9, #d9c492);
  color: #4b3d25;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 46%),
  0 4px 10px rgb(72 61 36 / 8%);
}

.tool-craft-submit:hover:not(:disabled),
.tool-craft-submit:focus-visible {
  border-color: rgb(126 98 45 / 62%);
  background: linear-gradient(180deg, #fbf4df, #dfc986);
  color: #3f321d;
}

.tool-craft-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  border: 1px dashed rgb(117 130 104 / 42%);
  border-radius: 8px;
  background: rgb(255 250 236 / 58%);
  color: #64705c;
  font-size: 14px;
  font-weight: 850;
  text-align: center;
}

.tool-craft-state.is-error {
  gap: 10px;
  border-color: rgb(195 107 85 / 46%);
  background: rgb(255 239 225 / 72%);
  color: #91372f;
}

.tool-craft-state button {
  min-height: 32px;
  border: 1px solid #9eb2a6;
  border-radius: 8px;
  background: #edf6f1;
  padding: 0 12px;
  color: #2f3e3f;
  font-weight: 900;
}

.tool-craft-inline-error {
  margin: 10px 0 0;
  border: 1px solid rgb(195 107 85 / 38%);
  border-radius: 8px;
  background: rgb(255 239 225 / 72%);
  padding: 8px 10px;
  color: #91372f;
  font-size: 12px;
  font-weight: 850;
}

.tool-craft-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid rgb(117 130 104 / 22%);
  padding-top: 12px;
}

.tool-craft-footer span {
  min-width: 0;
  color: #66715f;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.tool-craft-footer button {
  display: inline-flex;
  min-height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #9eb2a6;
  border-radius: 8px;
  background: #edf6f1;
  padding: 0 12px;
  color: #2f3e3f;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.tool-craft-footer button:hover:not(:disabled),
.tool-craft-state button:hover,
.tool-craft-state button:focus-visible {
  background: #dcefe8;
  outline: none;
}

.tool-craft-footer button:disabled {
  cursor: not-allowed;
  opacity: 0.54;
}

.tool-craft-spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: currentColor;
  animation: tool-craft-spin 560ms linear infinite;
}

.tool-craft-spinner-track,
.tool-craft-spinner-arc {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
}

.tool-craft-spinner-track {
  opacity: 0.2;
  stroke-width: 3;
}

.tool-craft-spinner-arc {
  opacity: 0.95;
  stroke-dasharray: 15 38;
  stroke-width: 3.6;
}

.tool-craft-submit .tool-craft-spinner {
  border: 2px solid rgb(32 57 58 / 18%);
  border-top-color: currentColor;
  border-radius: 999px;
}

.tool-craft-result-backdrop {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  background: rgb(46 57 50 / 22%);
  backdrop-filter: blur(2px);
}

.tool-craft-result {
  display: grid;
  width: min(420px, calc(100% - 28px));
  max-height: calc(100% - 28px);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgb(117 130 104 / 32%);
  border-radius: 8px;
  background: rgb(255 253 246 / 98%);
  box-shadow: 0 18px 42px rgb(72 61 36 / 24%);
}

.tool-craft-result header,
.tool-craft-result footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
}

.tool-craft-result header {
  border-bottom: 1px solid rgb(117 130 104 / 22%);
}

.tool-craft-result header strong {
  font-size: 16px;
}

.tool-craft-result header button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid rgb(117 130 104 / 28%);
  border-radius: 8px;
  background: #edf6f1;
  color: #2f3e3f;
  font-size: 17px;
  font-weight: 900;
}

.tool-craft-result p {
  margin: 0;
  padding: 12px 12px 4px;
  color: #405c60;
  font-size: 14px;
  font-weight: 900;
}

.tool-craft-result-list {
  display: grid;
  gap: 8px;
  overflow-y: auto;
  padding: 8px 12px 12px;
}

.tool-craft-result-list article {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 1px solid rgb(117 130 104 / 20%);
  border-radius: 8px;
  background: rgb(239 247 244 / 78%);
  padding: 8px;
}

.tool-craft-result-list article > span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 8px;
  background: #fffdf6;
  font-size: 18px;
}

.tool-craft-result-list div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.tool-craft-result-list strong,
.tool-craft-result-list small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-craft-result-list strong {
  color: #2f3e3f;
  font-size: 13px;
  font-weight: 900;
}

.tool-craft-result-list small {
  color: #66715f;
  font-size: 12px;
  font-weight: 800;
}

.tool-craft-result footer {
  justify-content: flex-end;
  border-top: 1px solid rgb(117 130 104 / 22%);
}

.tool-craft-result footer button {
  min-height: 32px;
  border: 1px solid #789185;
  border-radius: 8px;
  background: #dcefe8;
  padding: 0 14px;
  color: #20393a;
  font-size: 12px;
  font-weight: 900;
}

@keyframes tool-craft-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 680px) {
  .tool-craft-modal {
    width: min(100vw - 20px, 540px);
    height: calc(100vh - 20px);
  }

  .tool-craft-item {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .tool-craft-controls {
    grid-column: 1 / -1;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    border-top: 1px solid rgb(117 130 104 / 22%);
    border-left: 0;
    padding-top: 9px;
    padding-left: 0;
  }
}
</style>
