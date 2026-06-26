<template>
  <Teleport to="body">
    <section class="gather-backdrop" aria-label="采集" @click.self="closeDialog">
      <div class="game-modal gather-modal" role="dialog" aria-modal="true" :aria-busy="busy">
        <header class="gather-header">
          <div class="gather-heading">
            <span class="gather-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5.8 18.8c3.8-1.6 7.4-5 10.7-10.2"/>
                <path d="M16.5 8.6 18.9 5"/>
                <path d="M13.4 10.2c2.5.2 4.6 1.1 6.4 2.8"/>
                <path d="M7.2 15.7 4.6 20"/>
                <path d="M10.2 17.4c-1.6-1.7-2.4-3.7-2.4-6"/>
              </svg>
            </span>
            <div>
              <strong>采集</strong>
              <small>{{ headerSubtitle }}</small>
            </div>
          </div>
          <div class="gather-header-actions">
            <button
                class="gather-refresh"
                type="button"
                :disabled="busy"
                aria-label="刷新采集"
                @click="loadFirstPage"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 7.5v4h-4"/>
                <path d="M4 16.5v-4h4"/>
                <path d="M18.4 11.1A6.3 6.3 0 0 0 7.3 7.2L4 12.5"/>
                <path d="M5.6 12.9a6.3 6.3 0 0 0 11.1 3.9L20 11.5"/>
              </svg>
            </button>
            <button class="gather-close" type="button" aria-label="关闭采集" @click="closeDialog">×</button>
          </div>
        </header>

        <div class="gather-body">
          <section v-if="jobRows.length > 0" class="gather-current" aria-label="当前采集">
            <div class="gather-section-title">
              <strong>当前采集</strong>
              <small>完成前不能开始新的采集</small>
            </div>
            <div class="gather-job-list">
              <article v-for="job in jobRows" :key="job.jobId" class="gather-job">
                <div class="gather-job-main">
                  <span class="gather-job-cover" aria-hidden="true">{{ job.targetEmoji }}</span>
                  <div>
                    <strong>{{ job.resourceName }}</strong>
                    <small>携带 {{ job.costGrainLabel }} 粮食 · 预计 {{ job.gainExpectedLabel }} {{ job.targetName }}</small>
                  </div>
                </div>
                <div class="gather-job-status" :class="{ 'is-ready': job.ready }">
                  <span>{{ job.remainingLabel }}</span>
                  <button
                      type="button"
                      :class="{ 'is-loading': claimingJobId === job.jobId }"
                      :disabled="!job.ready || claimingJobId !== null || startingResourceId !== null"
                      @click="claimJob(job)"
                  >
                    <i v-if="claimingJobId === job.jobId" class="gather-spinner" aria-hidden="true"></i>
                    <span>{{ claimingJobId === job.jobId ? '领取中' : '领取' }}</span>
                  </button>
                </div>
              </article>
            </div>
          </section>

          <p v-if="claimResult" class="gather-result">
            领取成功，获得 {{ claimResult.gainActualLabel }} {{ claimResult.itemName }}
          </p>

          <div v-if="initialLoading" class="gather-state">正在查看资源...</div>

          <div v-else-if="resourceErrorMessage && resourceRows.length <= 0" class="gather-state is-error">
            <span>{{ resourceErrorMessage }}</span>
            <button type="button" @click="loadFirstPage">重试</button>
          </div>

          <div v-else-if="resourceRows.length <= 0" class="gather-state">当前没有可采集资源</div>

          <div v-else class="gather-resource-panel">
            <div class="gather-resource-tabs" role="tablist" aria-label="可采集资源">
              <button
                  v-for="row in resourceRows"
                  :key="row.resourceId"
                  class="gather-resource-tab"
                  type="button"
                  role="tab"
                  :aria-selected="selectedResourceRow?.resourceId === row.resourceId"
                  :class="{ 'is-active': selectedResourceRow?.resourceId === row.resourceId }"
                  @click="selectResource(row.resourceId)"
              >
                <span aria-hidden="true">{{ row.targetEmoji }}</span>
                <strong>{{ row.name }}</strong>
                <small>{{ row.capacityLabel }}</small>
              </button>
            </div>

            <div class="gather-resource-list">
              <article v-for="row in selectedResourceRows" :key="row.resourceId" class="gather-resource">
                <div class="gather-resource-cover" aria-hidden="true">{{ row.targetEmoji }}</div>

                <div class="gather-resource-main">
                  <div class="gather-resource-title">
                    <span>{{ row.typeLabel }}</span>
                    <strong>{{ row.name }}</strong>
                    <small>Lv.{{ row.levelLabel }}</small>
                  </div>
                  <div class="gather-resource-stats">
                    <span>
                      <small>人数</small>
                      <strong>{{ row.playerCountLabel }}</strong>
                    </span>
                    <span>
                      <small>剩余</small>
                      <strong>{{ row.capacityLabel }}</strong>
                    </span>
                    <span>
                      <small>恢复</small>
                      <strong>{{ row.recoveryLabel }}</strong>
                    </span>
                    <span>
                      <small>转换</small>
                      <strong>{{ row.conversionRateLabel }}</strong>
                    </span>
                    <span>
                      <small>效率</small>
                      <strong>{{ row.efficiencyLabel }}</strong>
                    </span>
                  </div>
                </div>

                <div class="gather-resource-controls">
                  <label v-if="row.requiresTool" class="gather-tool-field">
                    <span>{{ row.requiredItemName }}</span>
                    <select
                        :value="row.selectedToolInstanceId ?? ''"
                        :disabled="busy || row.toolOptions.length <= 0"
                        @change="handleToolSelect(row.resourceId, $event)"
                    >
                      <option v-if="row.toolOptions.length <= 0" value="">无可用工具</option>
                      <option
                          v-for="tool in row.toolOptions"
                          :key="tool.instanceId"
                          :value="tool.instanceId"
                      >
                        {{ tool.label }}
                      </option>
                    </select>
                  </label>

                  <label class="gather-grain-field">
                    <span>携带粮食</span>
                    <div>
                      <button
                          type="button"
                          :disabled="busy || row.grain <= 100"
                          aria-label="减少粮食"
                          @click="stepGrain(row.resourceId, -100)"
                      >
                        -
                      </button>
                      <input
                          :value="row.grain"
                          type="number"
                          min="100"
                          :max="maxGrainInput"
                          step="100"
                          inputmode="numeric"
                          :disabled="busy"
                          @input="handleGrainInput(row.resourceId, $event)"
                          @change="handleGrainInput(row.resourceId, $event)"
                      />
                      <button
                          type="button"
                          :disabled="busy || row.grain >= maxGrainInput"
                          aria-label="增加粮食"
                          @click="stepGrain(row.resourceId, 100)"
                      >
                        +
                      </button>
                    </div>
                  </label>

                  <div class="gather-estimate">
                    <span>
                      <small>时间</small>
                      <strong>{{ row.durationLabel }}</strong>
                    </span>
                    <span>
                      <small>预计产出</small>
                      <strong>{{ row.expectedGainLabel }} {{ row.targetName }}</strong>
                    </span>
                  </div>

                  <button
                      class="gather-start"
                      type="button"
                      :class="{ 'is-loading': startingResourceId === row.resourceId }"
                      :disabled="!row.canStart || startingResourceId !== null || claimingJobId !== null"
                      @click="startGather(row)"
                  >
                    <i v-if="startingResourceId === row.resourceId" class="gather-spinner" aria-hidden="true"></i>
                    <span>{{ startingResourceId === row.resourceId ? '开始中' : '开始采集' }}</span>
                  </button>

                  <small v-if="row.disabledReason" class="gather-disabled-reason">{{ row.disabledReason }}</small>
                </div>
              </article>
            </div>
          </div>

          <p v-if="jobErrorMessage" class="gather-inline-error">{{ jobErrorMessage }}</p>
          <p v-if="inventoryErrorMessage" class="gather-inline-error">{{ inventoryErrorMessage }}</p>
          <p v-if="actionErrorMessage" class="gather-inline-error">{{ actionErrorMessage }}</p>
        </div>

        <footer class="gather-footer">
          <span>{{ footerLabel }}</span>
          <button
              type="button"
              :disabled="!canLoadMore || resourceLoading || busy"
              @click="loadNextPage"
          >
            <svg v-if="resourceLoading && resources.length > 0" class="gather-spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="gather-spinner-track" cx="12" cy="12" r="8"/>
              <circle class="gather-spinner-arc" cx="12" cy="12" r="8"/>
            </svg>
            <span>{{ loadMoreLabel }}</span>
          </button>
        </footer>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import api from '@/utils/ky'
import {resolveApiErrorMessage} from '@/utils/apiErrors'
import {ITEM_ID_CURRENCY_GRAIN} from '@/constants'
import {ITEM_TYPE_CURRENCY, ITEM_TYPE_GRAIN_SEED} from '@/game/itemCatalogData'
import {
  claimPlayerResourceJob,
  loadPlayerResourceJobs,
  loadResourceList,
  normalizeResourceJobs,
  startPlayerResourceJob,
  type ResourceItem,
  type ResourceJob,
} from '@/game/resources'
import type {GameItem, ItemInventoryEntry, ItemInventoryListResponse} from '@/game/types'

const PAGE_SIZE = 10
const CLAIM_REWARD_REFRESH_ITEM_TYPES = [
  ITEM_TYPE_CURRENCY,
  ITEM_TYPE_GRAIN_SEED,
] as const

interface GatherToolOption {
  instanceId: number
  itemId: number
  label: string
}

interface GatherResourceRow {
  resource: ResourceItem
  resourceId: number
  typeLabel: string
  name: string
  levelLabel: string
  playerCountLabel: string
  capacityLabel: string
  recoveryLabel: string
  conversionRateLabel: string
  efficiencyLabel: string
  targetName: string
  targetEmoji: string
  requiredItemName: string
  requiresTool: boolean
  toolOptions: GatherToolOption[]
  selectedToolInstanceId: number | null
  grain: number
  durationLabel: string
  expectedGainLabel: string
  canStart: boolean
  disabledReason: string
}

interface GatherJobRow {
  resourceId: number
  jobId: number
  resourceName: string
  targetName: string
  targetEmoji: string
  costGrainLabel: string
  gainExpectedLabel: string
  remainingSeconds: number
  remainingLabel: string
  ready: boolean
}

interface GatherClaimResult {
  itemName: string
  gainActualLabel: string
}

const props = defineProps<{
  availableGrain: number
  itemCatalog: GameItem[]
  mapId: number
  playerId: string
}>()

const emit = defineEmits<{
  close: []
  inventoryUpdated: []
}>()

const resources = ref<ResourceItem[]>([])
const jobs = ref<ResourceJob[]>([])
const inventoryItems = ref<ItemInventoryEntry[]>([])
const page = ref(0)
const total = ref(0)
const loaded = ref(false)
const jobsLoaded = ref(false)
const inventoryLoaded = ref(false)
const resourceLoading = ref(false)
const jobLoading = ref(false)
const inventoryLoading = ref(false)
const resourceErrorMessage = ref('')
const jobErrorMessage = ref('')
const inventoryErrorMessage = ref('')
const actionErrorMessage = ref('')
const startingResourceId = ref<number | null>(null)
const claimingJobId = ref<number | null>(null)
const claimResult = ref<GatherClaimResult | null>(null)
const activeResourceId = ref<number | null>(null)
const nowMs = ref(Date.now())
const jobsLoadedAtMs = ref(Date.now())
const grainByResource = reactive<Record<number, number>>({})
const selectedToolByResource = reactive<Record<number, number>>({})
let loadVersion = 0
let countdownTimer: number | null = null

const itemById = computed(() => new Map(props.itemCatalog.map((item) => [item.item_id, item])))
const requiredItemIds = computed(() => Array.from(new Set(
    resources.value
        .map((resource) => Number(resource.item_id_required))
        .filter((itemId) => Number.isFinite(itemId) && itemId > 0),
)))
const requiresInventory = computed(() => requiredItemIds.value.length > 0)
const busy = computed(() => Boolean(
    resourceLoading.value
    || jobLoading.value
    || inventoryLoading.value
    || startingResourceId.value !== null
    || claimingJobId.value !== null,
))
const initialLoading = computed(() => resourceLoading.value && resources.value.length <= 0)
const canLoadMore = computed(() => loaded.value && resources.value.length < total.value)
const activeJobs = computed(() => jobs.value.filter((job) => Number.isFinite(Number(job.job_id))))
const hasActiveJob = computed(() => activeJobs.value.length > 0)
const inventoryReady = computed(() => !requiresInventory.value || inventoryLoaded.value)
const availableGrain = computed(() => {
  if (!inventoryLoaded.value) return Math.max(0, Math.trunc(Number(props.availableGrain) || 0))

  return getInventoryQuantity(ITEM_ID_CURRENCY_GRAIN)
})
const maxGrainInput = computed(() => {
  const max = Math.floor(availableGrain.value / 100) * 100

  return Math.max(100, max)
})
const headerSubtitle = computed(() => {
  if (jobRows.value.length > 0) return `${jobRows.value.length} 个采集任务进行中`
  if (availableGrain.value > 0) return `可用粮食 ${formatQuantity(availableGrain.value)}`

  return '选择资源并携带粮食'
})
const loadMoreLabel = computed(() => {
  if (resourceLoading.value && resources.value.length > 0) return '载入中'
  if (canLoadMore.value) return '加载更多'

  return '没有更多'
})
const footerLabel = computed(() => {
  if (!loaded.value && !resourceLoading.value) return '尚未载入资源'

  return `已载入 ${resources.value.length} / ${total.value} 个资源`
})
const resourceRows = computed<GatherResourceRow[]>(() => resources.value.map(createResourceRow))
const selectedResourceRow = computed(() => {
  if (resourceRows.value.length <= 0) return null

  return resourceRows.value.find((row) => row.resourceId === activeResourceId.value) ?? resourceRows.value[0] ?? null
})
const selectedResourceRows = computed(() => selectedResourceRow.value ? [selectedResourceRow.value] : [])
const jobRows = computed<GatherJobRow[]>(() => activeJobs.value.map(createJobRow))
const toolOptionsByItemId = computed(() => {
  const result = new Map<number, GatherToolOption[]>()

  for (const entry of inventoryItems.value) {
    const option = createToolOption(entry)
    if (!option) continue

    const options = result.get(option.itemId) ?? []
    options.push(option)
    result.set(option.itemId, options)
  }

  for (const options of result.values()) {
    options.sort((left, right) => right.instanceId - left.instanceId)
  }

  return result
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  countdownTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
  void loadFirstPage()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (countdownTimer !== null) window.clearInterval(countdownTimer)
})

watch(() => [props.playerId, props.mapId] as const, () => {
  void loadFirstPage()
})

async function loadFirstPage() {
  const version = loadVersion + 1
  loadVersion = version
  resources.value = []
  jobs.value = []
  inventoryItems.value = []
  page.value = 0
  total.value = 0
  loaded.value = false
  jobsLoaded.value = false
  inventoryLoaded.value = false
  resourceErrorMessage.value = ''
  jobErrorMessage.value = ''
  inventoryErrorMessage.value = ''
  actionErrorMessage.value = ''
  claimResult.value = null
  activeResourceId.value = null

  const playerId = props.playerId.trim()
  const mapId = Number(props.mapId)
  if (!playerId || !Number.isFinite(mapId) || mapId <= 0) {
    resourceErrorMessage.value = '缺少玩家或地图信息'
    return
  }

  await loadResourcePage(1, true, version)
  if (version !== loadVersion || resourceErrorMessage.value) return

  await Promise.all([
    refreshJobs(version),
    refreshInventory(version),
  ])
}

async function loadNextPage() {
  if (!canLoadMore.value || resourceLoading.value) return

  const version = loadVersion
  await loadResourcePage(page.value + 1, false, version)
  if (version !== loadVersion || resourceErrorMessage.value) return

  await refreshInventory(version)
}

async function loadResourcePage(nextPage: number, reset: boolean, version: number) {
  resourceLoading.value = true
  resourceErrorMessage.value = ''

  try {
    const data = await loadResourceList(props.mapId, nextPage, PAGE_SIZE)
    if (version !== loadVersion) return

    const nextItems = Array.isArray(data.items) ? data.items : []
    resources.value = reset ? nextItems : resources.value.concat(nextItems)
    page.value = data.page || nextPage
    total.value = Math.max(0, Number(data.total) || 0)
    loaded.value = true
    seedResourceInputs(nextItems)
    ensureActiveResource()
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '资源列表读取失败，请稍后再试')
    if (version !== loadVersion) return

    resourceErrorMessage.value = message
    if (reset) resources.value = []
    ensureActiveResource()
  } finally {
    if (version === loadVersion) resourceLoading.value = false
  }
}

async function refreshJobs(version = loadVersion) {
  const playerId = props.playerId.trim()
  if (!playerId) return false

  jobLoading.value = true
  jobErrorMessage.value = ''

  try {
    const data = await loadPlayerResourceJobs(playerId, 1, PAGE_SIZE)
    if (version !== loadVersion) return false

    jobs.value = normalizeResourceJobs(data)
    jobsLoaded.value = true
    jobsLoadedAtMs.value = Date.now()

    return true
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '当前采集任务读取失败，请稍后再试')
    if (version !== loadVersion) return false

    jobsLoaded.value = false
    jobs.value = []
    jobErrorMessage.value = message

    return false
  } finally {
    if (version === loadVersion) jobLoading.value = false
  }
}

async function refreshInventory(version = loadVersion) {
  const playerId = props.playerId.trim()
  if (!playerId) return false

  const itemIds = Array.from(new Set([ITEM_ID_CURRENCY_GRAIN, ...requiredItemIds.value]))
  if (itemIds.length <= 0) {
    inventoryItems.value = []
    inventoryLoaded.value = true
    return true
  }

  inventoryLoading.value = true
  inventoryErrorMessage.value = ''

  try {
    const searchParams = new URLSearchParams()
    searchParams.set('player_id', playerId)
    searchParams.set('page_size', '1000')
    for (const itemId of itemIds) {
      searchParams.append('item_ids[]', String(itemId))
    }

    const data = await api.get('api/item/inventory', {searchParams}).json<ItemInventoryListResponse>()
    if (version !== loadVersion) return false

    inventoryItems.value = data.items ?? []
    inventoryLoaded.value = true

    return true
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '采集工具读取失败，请稍后再试')
    if (version !== loadVersion) return false

    inventoryLoaded.value = false
    inventoryItems.value = []
    inventoryErrorMessage.value = message

    return false
  } finally {
    if (version === loadVersion) inventoryLoading.value = false
  }
}

async function refreshClaimRewardInventory(version = loadVersion) {
  const playerId = props.playerId.trim()
  if (!playerId) return false

  inventoryLoading.value = true
  inventoryErrorMessage.value = ''

  try {
    const searchParams = new URLSearchParams()
    searchParams.set('player_id', playerId)
    searchParams.set('page_size', '1000')
    for (const itemType of CLAIM_REWARD_REFRESH_ITEM_TYPES) {
      searchParams.append('item_types[]', itemType)
    }

    const data = await api.get('api/item/inventory', {searchParams}).json<ItemInventoryListResponse>()
    if (version !== loadVersion) return false

    inventoryItems.value = mergeInventoryByItemTypes(inventoryItems.value, data.items ?? [], CLAIM_REWARD_REFRESH_ITEM_TYPES)
    inventoryLoaded.value = true

    return true
  } catch (error) {
    console.error(error)
    const message = await resolveApiErrorMessage(error, '采集奖励库存刷新失败，请稍后再试')
    if (version !== loadVersion) return false

    inventoryErrorMessage.value = message

    return false
  } finally {
    if (version === loadVersion) inventoryLoading.value = false
  }
}

function seedResourceInputs(items: ResourceItem[]) {
  for (const resource of items) {
    const resourceId = Number(resource.resource_id)
    if (!Number.isFinite(resourceId) || grainByResource[resourceId]) continue

    grainByResource[resourceId] = 100
  }
}

function ensureActiveResource() {
  const resourceIds = resources.value
      .map((resource) => Number(resource.resource_id))
      .filter((resourceId) => Number.isFinite(resourceId) && resourceId > 0)

  if (resourceIds.length <= 0) {
    activeResourceId.value = null
    return
  }

  if (!activeResourceId.value || !resourceIds.includes(activeResourceId.value)) {
    activeResourceId.value = resourceIds[0]
  }
}

function selectResource(resourceId: number) {
  activeResourceId.value = resourceId
}

function createResourceRow(resource: ResourceItem): GatherResourceRow {
  const resourceId = Number(resource.resource_id)
  const grain = getResourceGrain(resourceId)
  const requiredItemId = getRequiredItemId(resource)
  const targetItem = itemById.value.get(resource.item_id_target) ?? null
  const typeLabel = resource.resource_type_string?.trim() || resource.resource_type?.trim() || '资源'
  const toolOptions = requiredItemId ? toolOptionsByItemId.value.get(requiredItemId) ?? [] : []
  const selectedToolInstanceId = requiredItemId ? getSelectedToolInstanceId(resourceId, toolOptions) : null
  const expectedGain = calculateExpectedGain(grain, resource)
  const disabledReason = getStartDisabledReason(resource, grain, requiredItemId, selectedToolInstanceId)

  return {
    resource,
    resourceId,
    typeLabel,
    name: typeLabel,
    levelLabel: formatQuantity(resource.resource_level),
    playerCountLabel: `${formatQuantity(resource.player_current)} / ${formatQuantity(resource.player_max)}`,
    capacityLabel: formatQuantity(resource.capacity_current),
    recoveryLabel: `${formatQuantity(resource.recovery_hour)} / 时`,
    conversionRateLabel: formatPercent(resource.conversion_rate),
    efficiencyLabel: formatPercent(resource.efficiency),
    targetName: getItemName(targetItem, resource.item_id_target),
    targetEmoji: getItemEmoji(targetItem, typeLabel.slice(0, 1) || '采'),
    requiredItemName: requiredItemId ? getItemName(itemById.value.get(requiredItemId) ?? null, requiredItemId) : '无需工具',
    requiresTool: Boolean(requiredItemId),
    toolOptions,
    selectedToolInstanceId,
    grain,
    durationLabel: formatGatherHours(grain),
    expectedGainLabel: formatNumber(expectedGain),
    canStart: !disabledReason,
    disabledReason,
  }
}

function createJobRow(job: ResourceJob): GatherJobRow {
  const resource = resources.value.find((item) => Number(item.resource_id) === Number(job.resource_id)) ?? null
  const targetItem = resource ? itemById.value.get(resource.item_id_target) ?? null : null
  const resourceName = resource?.resource_type_string?.trim() || resource?.resource_type?.trim() || `资源 ${job.resource_id}`
  const remainingSeconds = getJobRemainingSeconds(job)
  const ready = remainingSeconds <= 0

  return {
    resourceId: Number(job.resource_id),
    jobId: Number(job.job_id),
    resourceName,
    targetName: resource ? getItemName(targetItem, resource.item_id_target) : '资源',
    targetEmoji: getItemEmoji(targetItem, resourceName.slice(0, 1) || '采'),
    costGrainLabel: formatQuantity(job.cost_grain),
    gainExpectedLabel: formatNumber(job.gain_expected),
    remainingSeconds,
    remainingLabel: ready ? '可领取' : formatRemainingTime(remainingSeconds),
    ready,
  }
}

function getStartDisabledReason(
    resource: ResourceItem,
    grain: number,
    requiredItemId: number | null,
    selectedToolInstanceId: number | null,
) {
  if (!jobsLoaded.value || jobLoading.value) return '正在确认采集任务'
  if (hasActiveJob.value) return '已有采集任务'
  if (resourceLoading.value || inventoryLoading.value) return '资源数据载入中'
  if (!inventoryReady.value) return '采集工具尚未载入'
  if (Math.max(0, Number(resource.capacity_current) || 0) <= 0) return '资源已耗尽'
  if (Math.max(0, Number(resource.player_max) || 0) > 0
      && Math.max(0, Number(resource.player_current) || 0) >= Math.max(0, Number(resource.player_max) || 0)) {
    return '采集人数已满'
  }
  if (!Number.isFinite(grain) || grain < 100 || grain % 100 !== 0) return '粮食需为100的整数倍'
  if (availableGrain.value < grain) return '粮食不足'
  if (requiredItemId && !selectedToolInstanceId) return `缺少${getItemName(itemById.value.get(requiredItemId) ?? null, requiredItemId)}`

  return ''
}

async function startGather(row: GatherResourceRow) {
  if (!row.canStart || startingResourceId.value !== null || claimingJobId.value !== null) return

  const version = loadVersion
  const playerId = props.playerId.trim()
  if (!playerId) return

  startingResourceId.value = row.resourceId
  actionErrorMessage.value = ''
  claimResult.value = null

  try {
    const jobsOk = await refreshJobs(version)
    if (version !== loadVersion || !jobsOk) return
    if (hasActiveJob.value) {
      actionErrorMessage.value = '已有采集任务，不能开始新的采集'
      return
    }

    const payload = {
      resource_id: row.resourceId,
      grain: row.grain,
      ...(row.selectedToolInstanceId ? {item_instance_id: row.selectedToolInstanceId} : {}),
    }
    const data = await startPlayerResourceJob(playerId, payload)
    if (version !== loadVersion) return

    jobs.value = [{
      resource_id: row.resourceId,
      job_id: data.job_id,
      cost_grain: row.grain,
      gain_expected: data.gain_expected,
      second_mature: data.second_mature,
    }]
    jobsLoaded.value = true
    jobsLoadedAtMs.value = Date.now()
    emit('inventoryUpdated')
    await refreshInventory(version)
  } catch (error) {
    console.error(error)
    actionErrorMessage.value = await resolveApiErrorMessage(error, '开始采集失败，请稍后再试')
  } finally {
    if (version === loadVersion) startingResourceId.value = null
  }
}

async function claimJob(job: GatherJobRow) {
  if (!job.ready || claimingJobId.value !== null || startingResourceId.value !== null) return

  const version = loadVersion
  const playerId = props.playerId.trim()
  if (!playerId) return

  claimingJobId.value = job.jobId
  actionErrorMessage.value = ''

  try {
    const data = await claimPlayerResourceJob(playerId, job.resourceId, job.jobId)
    if (version !== loadVersion) return

    const item = itemById.value.get(data.item_id) ?? null
    claimResult.value = {
      itemName: getItemName(item, data.item_id),
      gainActualLabel: formatNumber(data.gain_actual),
    }
    jobs.value = jobs.value.filter((item) => Number(item.job_id) !== job.jobId)
    emit('inventoryUpdated')
    await Promise.all([
      refreshJobs(version),
      refreshClaimRewardInventory(version),
    ])
  } catch (error) {
    console.error(error)
    actionErrorMessage.value = await resolveApiErrorMessage(error, '领取采集奖励失败，请稍后再试')
  } finally {
    if (version === loadVersion) claimingJobId.value = null
  }
}

function handleGrainInput(resourceId: number, event: Event) {
  setResourceGrain(resourceId, Number((event.target as HTMLInputElement).value))
}

function stepGrain(resourceId: number, delta: number) {
  setResourceGrain(resourceId, getResourceGrain(resourceId) + delta)
}

function setResourceGrain(resourceId: number, value: number) {
  const nextValue = Number.isFinite(value) ? Math.round(value / 100) * 100 : 100
  const maxValue = maxGrainInput.value

  grainByResource[resourceId] = Math.min(maxValue, Math.max(100, nextValue))
}

function getResourceGrain(resourceId: number) {
  const value = Number(grainByResource[resourceId])
  if (!Number.isFinite(value) || value < 100) {
    grainByResource[resourceId] = 100
    return 100
  }

  const normalized = Math.min(maxGrainInput.value, Math.max(100, Math.round(value / 100) * 100))
  if (normalized !== value) grainByResource[resourceId] = normalized

  return normalized
}

function handleToolSelect(resourceId: number, event: Event) {
  const instanceId = Number((event.target as HTMLSelectElement).value)
  if (!Number.isFinite(instanceId) || instanceId <= 0) {
    delete selectedToolByResource[resourceId]
    return
  }

  selectedToolByResource[resourceId] = instanceId
}

function getSelectedToolInstanceId(resourceId: number, options: GatherToolOption[]) {
  if (options.length <= 0) return null

  const selected = Number(selectedToolByResource[resourceId])
  if (options.some((option) => option.instanceId === selected)) return selected

  return options[0]?.instanceId ?? null
}

function createToolOption(entry: ItemInventoryEntry): GatherToolOption | null {
  const instanceId = Number(entry.instance?.instance_id)
  const itemId = Number(entry.item_id)
  if (!Number.isFinite(instanceId) || instanceId <= 0 || !Number.isFinite(itemId) || itemId <= 0) return null
  if (entry.is_stolen || Number(entry.tick_expired) > 0) return null

  const item = itemById.value.get(itemId) ?? null
  const labels = [
    `${getItemName(item, itemId)} #${instanceId}`,
    entry.instance?.quality_string?.trim(),
    entry.instance?.durability_data?.string?.trim(),
  ].filter((label): label is string => Boolean(label))

  return {
    instanceId,
    itemId,
    label: labels.join(' · '),
  }
}

function getInventoryQuantity(itemId: number) {
  return inventoryItems.value.reduce((totalQuantity, entry) => {
    if (Number(entry.item_id) !== itemId) return totalQuantity

    return totalQuantity + Math.max(0, Number(entry.quantity) || 0)
  }, 0)
}

function mergeInventoryByItemTypes(
    currentItems: ItemInventoryEntry[],
    nextItems: ItemInventoryEntry[],
    itemTypes: readonly string[],
) {
  const nextItemTypes = new Set(itemTypes)

  return currentItems
      .filter((entry) => !nextItemTypes.has(getInventoryEntryItemType(entry)))
      .concat(nextItems)
}

function getInventoryEntryItemType(entry: ItemInventoryEntry) {
  return itemById.value.get(Number(entry.item_id))?.item_type?.trim() ?? ''
}

function getRequiredItemId(resource: ResourceItem) {
  const itemId = Number(resource.item_id_required)

  return Number.isFinite(itemId) && itemId > 0 ? itemId : null
}

function calculateExpectedGain(grain: number, resource: ResourceItem) {
  const conversionRate = Math.max(0, Number(resource.conversion_rate) || 0) / 100
  const efficiency = Math.max(0, Number(resource.efficiency) || 0) / 100

  return grain * conversionRate * efficiency
}

function getJobRemainingSeconds(job: ResourceJob) {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs.value - jobsLoadedAtMs.value) / 1000))

  return Math.max(0, Math.ceil(Math.max(0, Number(job.second_mature) || 0) - elapsedSeconds))
}

function getItemName(item: GameItem | null, itemId: number) {
  return item?.item_name?.trim() || `物品 ${itemId}`
}

function getItemEmoji(item: GameItem | null, fallback: string) {
  return item?.item_emoji?.trim() || fallback
}

function formatQuantity(value: number | string | null | undefined) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '--'

  return String(Math.max(0, Math.trunc(numberValue)))
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '--'
  if (Number.isInteger(numberValue)) return String(numberValue)

  return numberValue.toFixed(2).replace(/\.?0+$/, '')
}

function formatPercent(value: number | string | null | undefined) {
  return `${formatNumber(value)}%`
}

function formatGatherHours(grain: number) {
  const hours = Math.max(1, grain / 100)

  return `${formatNumber(hours)}小时`
}

function formatRemainingTime(seconds: number) {
  const nextSeconds = Math.max(0, Math.trunc(seconds))
  const days = Math.floor(nextSeconds / 86400)
  const hours = Math.floor((nextSeconds % 86400) / 3600)
  const minutes = Math.floor((nextSeconds % 3600) / 60)
  const restSeconds = nextSeconds % 60

  if (days > 0) return `${days}天 ${hours}小时`
  if (hours > 0) return `${hours}小时 ${minutes}分`
  if (minutes > 0) return `${minutes}分 ${restSeconds}秒`

  return `${restSeconds}秒`
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
.gather-backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  display: grid;
  place-items: center;
  background: rgb(43 62 52 / 18%);
  backdrop-filter: blur(3px);
}

.gather-modal {
  display: grid;
  width: min(880px, calc(100vw - 32px));
  height: min(780px, calc(100vh - 32px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(249 250 241 / 98%), rgb(238 246 232 / 98%));
  color: #2f3529;
}

.gather-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgb(91 122 86 / 22%);
  padding-bottom: 12px;
}

.gather-heading {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.gather-heading div {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.gather-heading strong {
  font-size: 18px;
  line-height: 1;
}

.gather-heading small {
  color: #617056;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.gather-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(91 122 86 / 32%);
  border-radius: 8px;
  background: linear-gradient(145deg, #eef5df, #cbdc9b);
  color: #49623b;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 50%);
}

.gather-icon svg,
.gather-refresh svg {
  fill: rgb(255 255 255 / 12%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.gather-icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 1.9;
}

.gather-header-actions {
  display: inline-flex;
  gap: 8px;
}

.gather-modal .gather-refresh,
.gather-modal .gather-close {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgb(91 122 86 / 32%);
  border-radius: 8px;
  background: rgb(255 250 236 / 80%);
  color: #49623b;
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
}

.gather-refresh svg {
  width: 17px;
  height: 17px;
  stroke-width: 2;
}

.gather-modal .gather-refresh:hover:not(:disabled),
.gather-modal .gather-refresh:focus-visible,
.gather-modal .gather-close:hover,
.gather-modal .gather-close:focus-visible {
  border-color: rgb(82 124 63 / 54%);
  background: rgb(230 240 210 / 94%);
  outline: none;
}

.gather-modal .gather-refresh:disabled {
  cursor: wait;
  opacity: 0.56;
}

.gather-body {
  min-height: 0;
  overflow-y: auto;
  padding: 14px 2px 6px;
  scrollbar-color: rgb(82 124 63 / 34%) transparent;
}

.gather-current {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  border: 1px solid rgb(91 122 86 / 26%);
  border-radius: 8px;
  background: rgb(246 252 232 / 74%);
  padding: 10px;
}

.gather-section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.gather-section-title strong {
  color: #34422d;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}

.gather-section-title small {
  color: #69765e;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.2;
}

.gather-job-list,
.gather-resource-list {
  display: grid;
  gap: 10px;
}

.gather-resource-panel {
  display: grid;
  gap: 10px;
}

.gather-resource-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  border: 1px solid rgb(91 122 86 / 22%);
  border-radius: 8px;
  background: rgb(246 252 232 / 62%);
  padding: 8px;
  scrollbar-color: rgb(82 124 63 / 34%) transparent;
}

.gather-resource-tab {
  display: grid;
  min-width: 116px;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 7px;
  border: 1px solid rgb(91 122 86 / 26%);
  border-radius: 8px;
  background: rgb(255 252 242 / 88%);
  padding: 8px 10px;
  color: #34422d;
  text-align: left;
  outline: none;
}

.gather-resource-tab span {
  grid-row: span 2;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid rgb(91 122 86 / 20%);
  border-radius: 7px;
  background: rgb(236 247 220 / 88%);
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

.gather-resource-tab strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gather-resource-tab small {
  color: #66745d;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.gather-resource-tab:hover,
.gather-resource-tab:focus-visible,
.gather-resource-tab.is-active {
  border-color: rgb(82 124 63 / 58%);
  background: rgb(231 244 209 / 92%);
}

.gather-resource-tab.is-active {
  box-shadow: inset 0 0 0 1px rgb(82 124 63 / 28%);
}

.gather-job {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border: 1px solid rgb(91 122 86 / 24%);
  border-radius: 8px;
  background: rgb(255 252 242 / 86%);
  padding: 9px;
}

.gather-job-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.gather-job-main div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.gather-job-main strong {
  overflow: hidden;
  color: #303a2d;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gather-job-main small {
  overflow: hidden;
  color: #64705c;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gather-job-cover,
.gather-resource-cover {
  display: grid;
  place-items: center;
  border: 1px solid rgb(91 122 86 / 26%);
  border-radius: 8px;
  background: rgb(236 247 220 / 88%);
  color: #49623b;
  font-weight: 900;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 56%);
}

.gather-job-cover {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  font-size: 19px;
}

.gather-job-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.gather-job-status > span {
  min-width: 74px;
  border: 1px solid rgb(111 130 91 / 22%);
  border-radius: 7px;
  background: rgb(236 241 226 / 82%);
  padding: 6px 8px;
  color: #5d6954;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}

.gather-job-status.is-ready > span {
  border-color: rgb(82 124 63 / 42%);
  background: rgb(224 244 210 / 90%);
  color: #3d6c2a;
}

.gather-job-status button,
.gather-start,
.gather-state button,
.gather-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #9fac80;
  border-radius: 8px;
  background: #eef5df;
  color: #34422d;
  font-size: 12px;
  font-weight: 900;
  outline: none;
}

.gather-job-status button {
  min-height: 30px;
  padding: 0 12px;
}

.gather-job-status button:hover:not(:disabled),
.gather-start:hover:not(:disabled),
.gather-state button:hover,
.gather-state button:focus-visible,
.gather-footer button:hover:not(:disabled),
.gather-footer button:focus-visible {
  background: #dfeeca;
  outline: none;
}

.gather-job-status button:disabled,
.gather-start:disabled,
.gather-footer button:disabled {
  cursor: not-allowed;
  opacity: 0.54;
}

.gather-result {
  margin: 0 0 12px;
  border: 1px solid rgb(82 124 63 / 34%);
  border-radius: 8px;
  background: rgb(229 248 214 / 78%);
  padding: 8px 10px;
  color: #3d6c2a;
  font-size: 12px;
  font-weight: 900;
}

.gather-resource {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) minmax(214px, 254px);
  align-items: center;
  gap: 12px;
  min-height: 146px;
  border: 1px solid rgb(91 122 86 / 24%);
  border-radius: 8px;
  background: linear-gradient(180deg, rgb(255 252 242 / 94%), rgb(241 248 232 / 88%));
  padding: 10px;
  box-shadow: 0 8px 18px rgb(61 72 36 / 8%);
}

.gather-resource-cover {
  width: 48px;
  height: 48px;
  font-size: 24px;
}

.gather-resource-main {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.gather-resource-title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.gather-resource-title span {
  border: 1px solid rgb(91 122 86 / 24%);
  border-radius: 6px;
  background: rgb(229 244 216 / 80%);
  padding: 2px 6px;
  color: #4b6d3a;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.gather-resource-title strong {
  min-width: 0;
  overflow: hidden;
  color: #303a2d;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gather-resource-title small {
  color: #816e4d;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.gather-resource-stats,
.gather-estimate {
  display: grid;
  gap: 6px;
}

.gather-resource-stats {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.gather-resource-stats span,
.gather-estimate span {
  display: grid;
  min-width: 0;
  gap: 4px;
  border: 1px solid rgb(91 122 86 / 18%);
  border-radius: 7px;
  background: rgb(255 250 236 / 68%);
  padding: 7px 8px;
}

.gather-resource-stats small,
.gather-estimate small,
.gather-tool-field > span,
.gather-grain-field > span,
.gather-disabled-reason {
  color: #66745d;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
}

.gather-resource-stats strong,
.gather-estimate strong {
  min-width: 0;
  overflow: hidden;
  color: #34422d;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gather-resource-controls {
  display: grid;
  gap: 8px;
  border-left: 1px solid rgb(91 122 86 / 20%);
  padding-left: 12px;
}

.gather-tool-field,
.gather-grain-field {
  display: grid;
  gap: 5px;
}

.gather-tool-field select {
  width: 100%;
  min-height: 32px;
  border: 1px solid rgb(91 122 86 / 28%);
  border-radius: 8px;
  background: rgb(255 253 246 / 90%);
  color: #303a2d;
  font-size: 12px;
  font-weight: 850;
  outline: none;
}

.gather-tool-field select:focus-visible {
  border-color: rgb(82 124 63 / 54%);
  box-shadow: 0 0 0 2px rgb(82 124 63 / 14%);
}

.gather-grain-field div {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  overflow: hidden;
  border: 1px solid rgb(91 122 86 / 28%);
  border-radius: 8px;
  background: rgb(255 250 236 / 80%);
}

.gather-grain-field button,
.gather-grain-field input {
  min-height: 32px;
  border: 0;
  color: #303a2d;
  font-size: 12px;
  font-weight: 900;
}

.gather-grain-field button {
  display: grid;
  place-items: center;
  background: rgb(232 240 226 / 92%);
}

.gather-grain-field button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.gather-grain-field input {
  width: 100%;
  border-right: 1px solid rgb(91 122 86 / 22%);
  border-left: 1px solid rgb(91 122 86 / 22%);
  background: rgb(255 253 246 / 88%);
  text-align: center;
}

.gather-grain-field input:focus-visible,
.gather-grain-field button:focus-visible {
  outline: 2px solid rgb(82 124 63 / 18%);
  outline-offset: 1px;
}

.gather-estimate {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.gather-start {
  min-height: 34px;
  border-color: rgb(130 149 74 / 60%);
  background: linear-gradient(180deg, #f2f0d1, #cadb93);
  color: #34422d;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 46%),
  0 4px 10px rgb(61 72 36 / 8%);
}

.gather-start:hover:not(:disabled),
.gather-start:focus-visible {
  border-color: rgb(88 125 48 / 62%);
  background: linear-gradient(180deg, #f7f4d7, #d5e59b);
  color: #283320;
}

.gather-disabled-reason {
  text-align: center;
}

.gather-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  border: 1px dashed rgb(91 122 86 / 42%);
  border-radius: 8px;
  background: rgb(255 250 236 / 58%);
  color: #64705c;
  font-size: 14px;
  font-weight: 850;
  text-align: center;
}

.gather-state.is-error {
  gap: 10px;
  border-color: rgb(195 107 85 / 46%);
  background: rgb(255 239 225 / 72%);
  color: #91372f;
}

.gather-state button {
  min-height: 32px;
  padding: 0 12px;
}

.gather-inline-error {
  margin: 10px 0 0;
  border: 1px solid rgb(195 107 85 / 38%);
  border-radius: 8px;
  background: rgb(255 239 225 / 72%);
  padding: 8px 10px;
  color: #91372f;
  font-size: 12px;
  font-weight: 850;
}

.gather-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid rgb(91 122 86 / 22%);
  padding-top: 12px;
}

.gather-footer span {
  min-width: 0;
  color: #66745d;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.gather-footer button {
  min-height: 32px;
  flex: 0 0 auto;
  padding: 0 12px;
  white-space: nowrap;
}

.gather-spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: currentColor;
  animation: gather-spin 560ms linear infinite;
}

.gather-spinner-track,
.gather-spinner-arc {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
}

.gather-spinner-track {
  opacity: 0.2;
  stroke-width: 3;
}

.gather-spinner-arc {
  opacity: 0.95;
  stroke-dasharray: 15 38;
  stroke-width: 3.6;
}

.gather-start .gather-spinner,
.gather-job-status .gather-spinner {
  border: 2px solid rgb(32 57 38 / 18%);
  border-top-color: currentColor;
  border-radius: 999px;
}

@keyframes gather-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .gather-modal {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
  }

  .gather-job,
  .gather-resource {
    grid-template-columns: 1fr;
  }

  .gather-resource-tab {
    min-width: 104px;
  }

  .gather-resource-cover {
    display: none;
  }

  .gather-resource-controls {
    border-left: 0;
    border-top: 1px solid rgb(91 122 86 / 20%);
    padding-top: 10px;
    padding-left: 0;
  }

  .gather-resource-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gather-job-status {
    justify-content: space-between;
  }
}
</style>
