<template>
  <main
      class="game-view relative h-screen w-screen overflow-hidden bg-[#cfe7df] text-[#3a3123]"
      :style="gameViewStyle"
  >
    <GameMapSurface
        :active-farm-tool="activeFarmTool"
        :active-tool-icon="activeToolIcon"
        :claim-mode="Boolean(landPlacementMode)"
        :home-hover-card="homeHoverCard"
        :land-hover-card="landHoverCard"
        :tool-cursor="toolCursor"
        @contextmenu="mapInteraction.onCanvasContextMenu"
        @mounted="setMapCanvas"
        @pointercancel="mapPointer.onPointerCancel"
        @pointerdown="mapPointer.onPointerDown"
        @pointerleave="mapPointer.onPointerLeave"
        @pointermove="mapPointer.onPointerMove"
        @pointerup="mapPointer.onPointerUp"
        @wheel="mapPointer.onWheel"
    />

    <GameHomeHud
        :claim-item-info="claimItemInfo"
        :claim-inventory="claimInventory"
        :claim-loading="claimInventoryLoading"
        :claim-mode="claimMode || claimInventory.pioneerToken > 0 || claimInventory.landDeed > 0 || claimInventory.playerStatueToken > 0"
        :item-catalog="itemCatalog"
        :land-placement-mode="landPlacementMode"
        :player="playerInfo"
        :player-id="sign.player_id"
        :player-loading="playerLoading"
        :debug-panel-visible="showRenderDebugPanel"
        :debug-toggle-enabled="renderDebugPanelAvailable"
        :time="gameTime"
        :time-loading="timeLoading"
        @locate-chronicle-tile="locateChronicleTile"
        @locate-player-home="locatePlayerHomeById"
        @player-card-resize="updatePlayerCardHeight"
        @toggle-debug-panel="toggleRenderDebugPanel"
        @use-deed="toggleDeedPlacementMode"
        @use-pioneer="togglePioneerPlacementMode"
    />

    <MiniMapPanel
        :collapsed="miniMap.collapsed.value"
        :dragging="miniMap.dragging.value"
        :claim-mode="Boolean(landPlacementMode)"
        :map-name="mapName"
        :placement-mode="landPlacementMode"
        @collapse="miniMap.collapse"
        @expand="miniMap.expand"
        @locate-player="locatePlayerLand"
        @locate-claim="locateClaimableLand"
        @mounted="miniMap.setCanvas"
        @pointerdown="miniMap.onPointerDown"
        @pointermove="miniMap.onPointerMove"
        @pointerup="miniMap.onPointerUp"
        @toggle="miniMap.toggleCollapsed"
        @wheel="miniMap.onWheel"
    />

    <GameChatPanel :player-id="sign.player_id"/>

    <button
        v-if="showPioneerPlacementToggle"
        class="land-placement-toggle pioneer-placement-toggle"
        :class="{ 'is-active': pioneerPlacementActive }"
        type="button"
        :disabled="claimInventory.pioneerToken <= 0"
        @click="togglePioneerPlacementMode"
    >
      <span>{{ pioneerPlacementActive ? '退出开拓' : '开始开拓' }}</span>
    </button>

    <FarmToolBar
        v-if="!landPlacementMode && !claimMode"
        :collapsed="!farmToolBarOpen"
        :plants="plantCycle"
        :plant-definitions="plantDefinitions"
        :seed-inventory="seedInventory"
        :tool="activeFarmTool"
        @collapse="farmToolBarOpen = false"
        @expand="farmToolBarOpen = true"
        @select="selectFarmTool"
        @toggle="farmToolBarOpen = !farmToolBarOpen"
    />

    <TileContextMenu :menu="contextMenu" @select="tileActionController.handleContextAction"/>

    <LandActionDialogs
        :abandon-dialog="abandonDialog"
        :claim-dialog="claimDialog"
        :clear-crop-dialog="clearCropDialog"
        :pioneer-guide-dialog="pioneerGuideDialog"
        :purchase-dialog="purchaseDialog"
        @close-abandon="closeAbandonDialog"
        @close-claim="closeClaimDialog"
        @close-clear-crop="closeClearCropDialog"
        @close-pioneer-guide="closePioneerGuideDialog"
        @close-purchase="closePurchaseDialog"
        @confirm-abandon="confirmAbandonTile"
        @confirm-claim="confirmClaimHomeLand"
        @confirm-clear-crop="tileActionController.confirmClearTileCrop"
        @confirm-pioneer-guide="enterPioneerPlacementMode"
        @confirm-purchase="confirmPurchaseRequest"
        @update-purchase-price="setPurchasePrice"
    />

    <PlayerStatueDialog
        :error-message="playerStatue.dialog.errorMessage"
        :submitting="playerStatue.dialog.submitting"
        :tile="playerStatue.dialog.tile"
        :visible="playerStatue.dialog.visible"
        @close="playerStatue.closeDialog"
        @confirm="playerStatue.confirm"
    />

    <div v-if="showClaimBanner" class="claim-banner" :class="{ 'is-error': claimMessageTone === 'error' }">
      <strong>{{ claimBannerTitle }}</strong>
      <span>{{ claimBannerMessage }}</span>
    </div>

    <GameToastStack
        :toasts="toastStack.toasts"
        @dismiss="toastStack.removeToast"
    />

    <section v-if="showRenderDebugPanel" class="render-debug-panel" aria-label="地图性能调试">
      <strong>调试</strong>
      <dl>
        <template v-for="item in renderDebugStats" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </template>
      </dl>
    </section>
  </main>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import FarmToolBar from '@/components/game/FarmToolBar.vue'
import GameChatPanel from '@/components/game/GameChatPanel.vue'
import GameHomeHud from '@/components/game/GameHomeHud.vue'
import GameMapSurface from '@/components/game/GameMapSurface.vue'
import GameToastStack from '@/components/game/GameToastStack.vue'
import LandActionDialogs from '@/components/game/LandActionDialogs.vue'
import MiniMapPanel from '@/components/game/MiniMapPanel.vue'
import PlayerStatueDialog from '@/components/game/PlayerStatueDialog.vue'
import TileContextMenu from '@/components/game/TileContextMenu.vue'
import {useFarmTools} from '@/composables/game/useFarmTools'
import {useGameHomeData} from '@/composables/useGameHomeData'
import {useCropActions} from '@/composables/game/useCropActions'
import {useGameDialogs} from '@/composables/game/useGameDialogs'
import {useLandChunkLoader} from '@/composables/game/useLandChunkLoader'
import {useLandOperations} from '@/composables/game/useLandOperations'
import {useMapDataController} from '@/composables/game/useMapDataController'
import {useMapHoverState} from '@/composables/game/useMapHoverState'
import {useMapInteractionController} from '@/composables/game/useMapInteractionController'
import {useMapPointerController} from '@/composables/game/useMapPointerController'
import {useMapNavigation} from '@/composables/game/useMapNavigation'
import {useMiniMapController} from '@/composables/game/useMiniMapController'
import {useNeighborHomes} from '@/composables/game/useNeighborHomes'
import {useRenderedMapCache} from '@/composables/game/useRenderedMapCache'
import {useMapRenderLoop} from '@/composables/game/useMapRenderLoop'
import type {MapRenderFrameState} from '@/composables/game/useMapRenderLoop'
import {useTileActionController} from '@/composables/game/useTileActionController'
import {useTileRequests} from '@/composables/game/useTileRequests'
import {useTileRuleSet} from '@/composables/game/useTileRuleSet'
import {useVisibleLandChunks} from '@/composables/game/useVisibleLandChunks'
import {useLandClaims} from '@/composables/game/useLandClaims'
import {useClaimBanner} from '@/composables/game/useClaimBanner'
import {useMapKeyboardShortcuts} from '@/composables/game/useMapKeyboardShortcuts'
import {useMapLocator} from '@/composables/game/useMapLocator'
import {usePlayerStatueController} from '@/composables/game/usePlayerStatueController'
import {useGameEventListener} from '@/composables/useGameEventBus'
import {useToastStack} from '@/composables/useToastStack'
import {useSignStore} from '@/stores/sign'
import {MAP_FILE_ID_NAMELESS} from '@/constants'
import {
  maxPixelRatio,
  maxScale,
  minScale,
  tileSize,
} from '@/game/config'
import {isRiverTile as isBaseRiverTile} from '@/game/baseMap'
import {loadMapItems, loadMapPlayerHome} from '@/game/baseMap'
import {loadMapLandChunk} from '@/game/landData'
import {createUnclaimedGrassPatch} from '@/game/tileState'
import {
  canShowHarvestActionStatus,
  updateLocalCropLifecycle,
} from '@/game/cropLifecycle'
import {getTileContextActions} from '@/game/contextActions'
import {drawMapScene} from '@/game/renderScene'
import {PixiStaticMapCache} from '@/game/pixiMapCache'
import {destroyPixiTextureCache, getPixiTextureCacheStats} from '@/game/pixiDrawContext'
import {canAnimateZoomProfile, getMapZoomProfile} from '@/game/mapZoomProfile'
import type {PixiMapRenderFrame} from '@/game/pixiRenderFrame'
import type {PlayerChronicleLocation} from '@/game/homeTypes'
import type {GameToastEvent} from '@/composables/useGameEventBus'
import type {LandChunkRequest} from '@/game/landChunks'
import type {
  ContextMenuState,
  GameItem,
  MapItemResponse,
  MapLandChunkItem,
  MapObject,
  MapPlayerHomeItem,
  Tile,
} from '@/game/types'

const HOME_GRANT_SIZE = 2
const LAND_CHUNK_API_MAX_SIZE = 100
const LAND_CHUNK_TARGET_SIZE = 20
let mapInitializeVersion = 0
const queuedMapLandChunks = new Map<string, MapLandChunkItem>()
let queuedMapLandChunkFrame: number | null = null
let mapCanvasResizeFrame: number | null = null
let mapCanvasResizeObserver: ResizeObserver | null = null
let requestMiniMapDraw: (() => void) | null = null

interface MapItemRefreshEvent {
  map_file_id: number
  x: number
  y: number
  width: number
  height: number
}

interface MapLandChunkEvent {
  map_file_id: number
  chunk: MapLandChunkItem
}

interface MapLandAbandonedEvent {
  map_file_id: number
  data: {
    x: number
    y: number
  }
}

const sign = useSignStore()
const {
  playerInfo,
  gameTime,
  playerLoading,
  timeLoading,
  refreshHomeData,
} = useGameHomeData()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const itemCatalog = ref<GameItem[]>([])
const playerCardHeight = ref(76)
const renderDebugPanelOpen = ref(false)
const gameViewStyle = computed(() => ({
  '--game-player-card-height': `${playerCardHeight.value}px`,
}))
const contextMenu = reactive<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  tile: null,
  object: null,
  actions: [],
})
const toastStack = useToastStack()

function showToast(message: string) {
  toastStack.pushToast(message, {autoClose: true})
}

function showErrorToast(message: string) {
  toastStack.pushToast(message, {autoClose: true, tone: 'error'})
}

function updatePlayerCardHeight(height: number) {
  if (height <= 0) return

  playerCardHeight.value = height
}

useGameEventListener<GameToastEvent>('game_toast', handleGameToastEvent)
useGameEventListener<MapItemRefreshEvent>('map_item', handleMapItemEvent)
useGameEventListener<MapLandChunkEvent>('map_land_chunk', handleMapLandChunkEvent)
useGameEventListener<MapLandAbandonedEvent>('map_land_abandoned', handleMapLandAbandonedEvent)

function handleGameToastEvent(event: GameToastEvent) {
  toastStack.pushToast(event.message, {
    autoClose: event.autoClose ?? true,
    durationMs: event.durationMs,
    tone: event.tone ?? 'info',
  })
}

async function handleMapItemEvent(event: MapItemRefreshEvent) {
  if (!mapReady.value) return

  const mapId = mapInfo.id || MAP_FILE_ID_NAMELESS
  if (event.map_file_id !== mapId) return

  const rect = getMapItemRefreshRect(event)

  try {
    await refreshMapItems(mapId, rect)
    renderedMap.rebuild()
    requestDraw()
  } catch (error) {
    console.error(error)
  }
}

function getMapItemRefreshRect(event: MapItemRefreshEvent): LandChunkRequest {
  return {
    x: event.x,
    y: event.y,
    w: event.width,
    h: event.height,
  }
}

function handleMapLandChunkEvent(event: MapLandChunkEvent) {
  if (!isCurrentMapEvent(event.map_file_id)) return

  queueMapLandChunk(event.chunk)
}

function queueMapLandChunk(chunk: MapLandChunkItem) {
  queuedMapLandChunks.set(`${chunk.x},${chunk.y}`, chunk)
  if (queuedMapLandChunkFrame !== null) return

  queuedMapLandChunkFrame = window.requestAnimationFrame(flushQueuedMapLandChunks)
}

function flushQueuedMapLandChunks() {
  queuedMapLandChunkFrame = null
  if (!mapReady.value) {
    queuedMapLandChunks.clear()
    return
  }

  const chunks = Array.from(queuedMapLandChunks.values())
  queuedMapLandChunks.clear()
  if (chunks.length === 0) return

  applyMapLandChunk(chunks)
}

function resetQueuedMapLandChunks() {
  if (queuedMapLandChunkFrame !== null) {
    window.cancelAnimationFrame(queuedMapLandChunkFrame)
    queuedMapLandChunkFrame = null
  }
  queuedMapLandChunks.clear()
}

function handleMapLandAbandonedEvent(event: MapLandAbandonedEvent) {
  if (!isCurrentMapEvent(event.map_file_id)) return

  const tile = tileAt(event.data.x, event.data.y)
  if (!tile) return

  applyMapRealtimeEvent({
    type: 'land.abandoned',
    patch: {
      x: event.data.x,
      y: event.data.y,
      tile: createUnclaimedGrassPatch(tile),
    },
  })
}

function isCurrentMapEvent(mapFileId: number) {
  if (!mapReady.value) return false

  return mapFileId === (mapInfo.id || MAP_FILE_ID_NAMELESS)
}

const {
  abandonDialog,
  claimDialog,
  clearCropDialog,
  purchaseDialog,
  openAbandonDialog,
  closeAbandonDialog,
  openClearCropDialog: showClearCropDialog,
  closeClearCropDialog,
  openPurchaseDialog,
  closePurchaseDialog,
  setPurchasePrice,
  openClaimDialog: showClaimDialog,
  closeClaimDialog,
  resetClaimDialog,
  resetLandActionDialogs,
} = useGameDialogs({
  onDialogOpen: hideContextMenu,
})

const camera = reactive({
  x: 0,
  y: 0,
  scale: 0.80,
  ready: false,
})

const claimPreview = reactive({
  visible: false,
  x: 0,
  y: 0,
  valid: false,
  tile: null as Tile | null,
})
const mapHoverState = useMapHoverState()
const {
  toolCursor,
  homeHoverCard,
  landHoverCard,
  hideHomeHoverCard,
  hideLandHoverCard,
} = mapHoverState

const {
  activeFarmTool,
  farmToolBarOpen,
  plantCycle,
  plantDefinitions,
  activeToolIcon,
  replacePlantCatalog,
  selectFarmTool,
  applyActiveFarmTool,
  isActiveFarmToolValid,
  canUsePlantTool,
  getSeedQuantity,
  getPlantTypeFromAction,
  getPlantLabel,
  resetActiveTool,
  closeToolBar,
} = useFarmTools({
  getLandPlacementActive: () => Boolean(landPlacementMode.value),
  canClearCrop: (tile) => canClearCrop(tile),
  canPlantTile: (tile) => canPlantTile(tile),
  getSeedQuantity: (plant) => seedInventory[plant] ?? 0,
  hideContextMenu,
  hideToolCursor: () => {
    toolCursor.visible = false
  },
  openClearCropDialog: (tile) => tileActionController.openClearCropDialog(tile),
  plantCropOnTile: (tile, plant) => void plantCropOnTile(tile, plant),
})

const selectedTile = ref<Tile | null>(null)
const selectedMapObject = ref<MapObject | null>(null)
const {
  mapInfo,
  tiles,
  mapObjects,
  occupiedMapRects,
  butterflyAnchors,
  tileAt,
  homeObject,
  homeAnchor,
  hasOwnHomeOnCurrentMap,
  watchdogObject,
  homeTile,
  mapName,
  mapWidth,
  mapHeight,
  mapReady,
  loadInitialMap,
  refreshMapItems,
  applyMapItemChunk,
  setPlayerHomeAnchor,
  applyMapLandChunk,
  applyMapRealtimeEvent,
  applyHomeObjectOwnerData,
} = useMapDataController({
  selectedTile,
  selectedMapObject,
  getCurrentPlayerId: () => sign.player_id,
  getCurrentPlayerName: () => playerInfo.value?.name,
  getPlantLabel,
  rebuildRenderedMaps,
  requestDraw,
})
const worldWidth = computed(() => mapWidth.value * tileSize)
const worldHeight = computed(() => mapHeight.value * tileSize)
const pixiStaticMapCache = new PixiStaticMapCache()
const renderLoop = useMapRenderLoop({
  getCanvas: () => canvasRef.value,
  maxPixelRatio,
  getAnimationFrameInterval: getMapAnimationFrameInterval,
  getSceneFrameInterval: getMapSceneFrameInterval,
  drawFrame: drawMapFrame,
  onResize: handleCanvasResize,
  onDrawRequest: queueVisibleChunkLoads,
})
const mainCanvasBounds = renderLoop.bounds
const visibleLandChunks = useVisibleLandChunks({
  camera,
  viewport: mainCanvasBounds,
  targetSize: LAND_CHUNK_TARGET_SIZE,
  apiMaxSize: LAND_CHUNK_API_MAX_SIZE,
  padding: getVisibleChunkPadding,
  isMapReady: () => mapReady.value,
  getMapWidth: () => mapWidth.value,
  getMapHeight: () => mapHeight.value,
  getHomeObject: () => homeAnchor.value,
  getLandPlacementMode: () => landPlacementMode.value,
})
const {
  getStats: getLandChunkLoaderStats,
  loadingLandChunks,
  queueVisibleLandChunkLoad,
  loadLandChunk,
  resetLandChunkLoader,
} = useLandChunkLoader<MapLandChunkItem>({
  canLoad: visibleLandChunks.canLoad,
  getRequests: visibleLandChunks.getRequests,
  fetchChunk: (chunk, signal) => loadMapLandChunk(mapInfo.id || MAP_FILE_ID_NAMELESS, chunk, signal),
  applyChunk: applyMapLandChunk,
  maxConcurrentLoads: 6,
  onLoadingChange: requestAnimationDraw,
})
const {
  getStats: getMapItemChunkLoaderStats,
  loadingLandChunks: loadingMapItemChunks,
  queueVisibleLandChunkLoad: queueVisibleMapItemChunkLoad,
  resetLandChunkLoader: resetMapItemChunkLoader,
} = useLandChunkLoader<MapItemResponse>({
  canLoad: visibleLandChunks.canLoad,
  getRequests: visibleLandChunks.getRequests,
  fetchChunk: (chunk, signal) => loadMapItems(mapInfo.id || MAP_FILE_ID_NAMELESS, chunk, signal),
  applyChunk: applyMapItemChunk,
  maxConcurrentLoads: 6,
  onLoadingChange: requestAnimationDraw,
})
const {
  submitNeighborVisit,
  refreshNeighborHomeInfo,
} = useNeighborHomes({
  getPlayerId: () => sign.player_id,
  onOwnerDataAffectsMap: (object) => {
    applyHomeObjectOwnerData(object)
  },
  onOwnerDataUpdated: requestDraw,
  onError: showErrorToast,
})
const {
  pioneerGuideDialog,
  claimInventory,
  seedInventory,
  claimItemInfo,
  claimInventoryLoading,
  claimSubmitting,
  claimMessage,
  claimMessageTone,
  pioneerPlacementActive,
  deedPlacementActive,
  claimMode,
  landPlacementMode,
  claimTokensAvailable,
  deedInventoryAvailable,
  playerStatueInventoryAvailable,
  canSubmitClaim,
  showPioneerPlacementToggle,
  resetForPlayerChange: resetLandClaimsForPlayerChange,
  togglePioneerPlacementMode,
  toggleDeedPlacementMode,
  enterPioneerPlacementMode,
  closePioneerGuideDialog,
  completePioneerClaim,
  updateClaimItemInfo,
  setSeedInventoryQuantity,
  setPlayerStatueInventoryQuantity,
  addCurrencyQuantity,
  refreshClaimInventory,
} = useLandClaims({
  mapReady,
  hasOwnHomeOnCurrentMap,
  getPlayerId: () => sign.player_id,
  getSeedItemIds: () => plantCycle.value,
  onPlacementUiChange: setLandPlacementUi,
  onError: showErrorToast,
})
const {
  objectsAtTile,
  canClaimHomeTile,
  canPlaceLandAt,
  canClaimDeedTile,
  canSubmitLandPlacementAt,
  canFarmTile,
  canPlantTile,
  canClearCrop,
  canHarvestCrop,
  canAbandonTile,
  canRequestPurchase,
  canStealCrop,
  canBuildPlayerStatueTile,
} = useTileRuleSet({
  hasOwnHomeOnCurrentMap,
  landPlacementMode,
  canSubmitClaim,
  tileAt: () => tileAt,
  getMapObjects: () => mapObjects,
  getOccupiedRects: () => occupiedMapRects,
  isRiverTile,
})
const {
  isTileCropActionPending,
  plantCropOnTile,
  clearCropOnTile,
  harvestCropOnTile,
  stealCropOnTile,
  resetCropActions,
} = useCropActions({
  plantDefinitions,
  getPlayerId: () => sign.player_id,
  getSeedQuantity,
  tileAt: () => tileAt,
  canPlantTile,
  canClearCrop,
  canHarvestCrop,
  canFarmTile,
  canStealCrop,
  getPlantLabel,
  loadTileLand: (tile) => loadLandChunk({x: tile.x, y: tile.y, w: 1, h: 1}),
  applyMapRealtimeEvent,
  setSeedInventoryQuantity,
  addCurrencyQuantity,
  onError: showErrorToast,
  onReward: showToast,
  requestDraw,
})
const landPlacementSize = computed(() => landPlacementMode.value === 'pioneer' ? HOME_GRANT_SIZE : 1)
const mapLandGrantPath = computed(() => `api/map/${encodeURIComponent(String(mapInfo.id || MAP_FILE_ID_NAMELESS))}/land/grant`)
const mapLandDeedPath = computed(() => `api/map/${encodeURIComponent(String(mapInfo.id || MAP_FILE_ID_NAMELESS))}/land/deed`)
const mapLandAbandonPath = computed(() => `api/map/${encodeURIComponent(String(mapInfo.id || MAP_FILE_ID_NAMELESS))}/land/abandon`)
const {
  confirmPurchaseRequest,
} = useTileRequests({
  purchaseDialog,
  canRequestPurchase,
  closePurchaseDialog,
  requestDraw,
})
const {
  showClaimBanner,
  claimBannerTitle,
  claimBannerMessage,
} = useClaimBanner({
  landPlacementMode,
  claimSubmitting,
  claimInventoryLoading,
  claimMessage,
  claimDialog,
  claimTokensAvailable,
  deedInventoryAvailable,
})

function setLandPlacementUi(enabled: boolean) {
  claimMessage.value = ''
  if (enabled) {
    resetActiveTool()
    closeToolBar()
  } else {
    hideClaimPreview()
    resetClaimDialog()
  }
  requestDraw()
}

const renderedMap = useRenderedMapCache({
  getTiles: () => tiles,
  tileAt: () => tileAt,
  getMapWidth: () => mapWidth.value,
  getMapHeight: () => mapHeight.value,
  canBuild: () => mapReady.value,
})
const renderDebugPanelAvailable = computed(() => import.meta.env.DEV)
const showRenderDebugPanel = computed(() => renderDebugPanelAvailable.value && renderDebugPanelOpen.value)
const renderDebugStats = computed(() => {
  const landChunkStats = getLandChunkLoaderStats()
  const itemChunkStats = getMapItemChunkLoaderStats()
  const staticStats = pixiStaticMapCache.getStats()
  const textureStats = getPixiTextureCacheStats()
  const renderStats = renderLoop.stats

  return [
    {label: '缩放', value: camera.scale.toFixed(2)},
    {label: '视窗', value: `${Math.round(mainCanvasBounds.width)}x${Math.round(mainCanvasBounds.height)}`},
    {label: '当前帧', value: `${renderStats.lastFrameMs.toFixed(1)}ms`},
    {label: '平均帧', value: `${renderStats.averageFrameMs.toFixed(1)}ms`},
    {label: '最慢帧', value: `${renderStats.peakFrameMs.toFixed(1)}ms`},
    {label: '节点数', value: String(renderStats.pixiChildren)},
    {label: '地块缓存', value: `${staticStats.cachedChunks}/${staticStats.visibleChunks}+${staticStats.pendingChunks}`},
    {label: '构建/清理', value: `${staticStats.builtLastFrame}/${staticStats.prunedLastFrame}`},
    {label: '清晰度', value: getStaticDetailLabel(staticStats.currentDetail)},
    {label: '显存估算', value: `${formatTextureMemory(staticStats.texturePixels)} MB`},
    {label: '土地加载', value: `${landChunkStats.activeLoadCount}/${landChunkStats.pendingChunks}/${landChunkStats.loadingChunks}`},
    {label: '物件加载', value: `${itemChunkStats.activeLoadCount}/${itemChunkStats.pendingChunks}/${itemChunkStats.loadingChunks}`},
    {label: '图片缓存', value: `${textureStats.imageTextures}/${textureStats.skippedUnsafeImages}`},
  ]
})

function formatTextureMemory(texturePixels: number) {
  return `${(texturePixels * 4 / 1024 / 1024).toFixed(1)}`
}

function getStaticDetailLabel(detail: string) {
  if (detail === 'high') return '高'
  if (detail === 'detail') return '中'
  if (detail === 'overview') return '低'

  return '无'
}

function toggleRenderDebugPanel() {
  if (!renderDebugPanelAvailable.value) return

  renderDebugPanelOpen.value = !renderDebugPanelOpen.value
}
const mapNavigation = useMapNavigation({
  camera,
  selectedTile,
  selectedMapObject,
  getCanvas: () => canvasRef.value,
  getMainBounds: () => mainCanvasBounds,
  getWorldWidth: () => worldWidth.value,
  getWorldHeight: () => worldHeight.value,
  isMapReady: () => mapReady.value,
  tileAt: () => tileAt,
  getMapObjects: () => mapObjects,
  minScale,
  maxScale,
  requestDraw,
})
const playerStatue = usePlayerStatueController({
  getMapId: () => mapInfo.id || MAP_FILE_ID_NAMELESS,
  getPlayerId: () => sign.player_id,
  getPlayerStatueInventoryAvailable: () => playerStatueInventoryAvailable.value,
  canBuildPlayerStatueTile,
  hideContextMenu,
  hideHomeHoverCard,
  hideLandHoverCard,
  focusTile: mapNavigation.focusTile,
  focusMapObject: mapNavigation.focusMapObject,
  getMapObjects: () => mapObjects,
  refreshMapItems,
  refreshClaimInventory,
  setPlayerStatueInventoryQuantity,
  showToast,
  showErrorToast,
  requestDraw,
})

watch(
    () => sign.player_id,
    () => {
      resetLandClaimsForPlayerChange()
      resetCropActions()
      resetLandActionDialogs()
      playerStatue.resetDialog()
      void initializeMap()
    },
)

const tileActionController = useTileActionController({
  selectedTile,
  selectedMapObject,
  contextTile: () => contextMenu.tile,
  contextObject: () => contextMenu.object,
  clearCropDialog,
  landPlacementMode,
  claimTokensAvailable,
  deedInventoryAvailable,
  claimSubmitting,
  claimMessage,
  claimMessageTone,
  getMapObjects: () => mapObjects,
  objectsAtTile,
  canFarmTile,
  canHarvestCrop,
  canClearCrop,
  canPlantTile,
  canAbandonTile,
  canRequestPurchase,
  canStealCrop,
  canBuildPlayerStatueTile: playerStatue.canUseAt,
  canClaimHomeTile,
  canClaimDeedTile,
  canUseDeedAt,
  getPlantTypeFromAction,
  hideContextMenu,
  focusTile: mapNavigation.focusTile,
  focusMapObject: mapNavigation.focusMapObject,
  openAbandonDialog,
  openPurchaseDialog,
  openPlayerStatueDialog: playerStatue.openDialog,
  openClaimDialog: showClaimDialog,
  openClearCropDialog: showClearCropDialog,
  closeClearCropDialog,
  plantCropOnTile,
  harvestCropOnTile,
  clearCropOnTile: (tile, dialog, onCleared) => void clearCropOnTile(tile, dialog, onCleared),
  stealCropOnTile,
  submitNeighborVisit: (object) => void submitNeighborVisit(object),
  applyMapRealtimeEvent,
})
const mapInteraction = useMapInteractionController({
  activeFarmTool,
  landPlacementMode,
  claimTokensAvailable,
  deedInventoryAvailable,
  claimMessage,
  claimMessageTone,
  contextMenu,
  navigation: mapNavigation,
  hoverState: mapHoverState,
  hideClaimPreview,
  updateClaimPreview,
  canSubmitLandPlacementAt,
  openClaimDialog: tileActionController.openClaimDialog,
  applyActiveFarmTool,
  isFarmToolValid,
  getContextActions,
  refreshNeighborHomeInfo: (object) => void refreshNeighborHomeInfo(object),
  requestDraw,
})
const {
  locatePlayerLand,
  locateClaimableLand,
} = useMapLocator({
  camera,
  viewport: mainCanvasBounds,
  navigation: mapNavigation,
  tileAt,
  getTiles: () => tiles,
  getHomeObject: () => homeObject.value,
  getHomeTile: () => homeTile.value,
  isMapReady: () => mapReady.value,
  canPlaceLandAt,
})
const {
  confirmClaimLand: confirmClaimHomeLand,
  confirmAbandonTile,
} = useLandOperations({
  homeGrantSize: HOME_GRANT_SIZE,
  claimDialog,
  abandonDialog,
  claimInventory,
  claimSubmitting,
  claimMessage,
  claimMessageTone,
  deedPlacementActive,
  getPlayerId: () => sign.player_id,
  getCurrentPlayerName: () => playerInfo.value?.name,
  getPlayerInfo: () => playerInfo.value,
  getGameTime: () => gameTime.value,
  getHomeObject: () => homeObject.value,
  getGrantPath: () => mapLandGrantPath.value,
  getDeedPath: () => mapLandDeedPath.value,
  getAbandonPath: () => mapLandAbandonPath.value,
  tileAt: () => tileAt,
  canClaimHomeTile,
  canClaimDeedTile,
  canSubmitClaim: () => canSubmitClaim.value,
  canAbandonTile,
  applyMapRealtimeEvent,
  focusMapObject: mapNavigation.focusMapObject,
  focusTile: mapNavigation.focusTile,
  refreshHomeData,
  refreshClaimInventory,
  loadLandChunk,
  completePioneerClaim,
  resetClaimDialog,
  closeAbandonDialog,
  onError: showErrorToast,
  requestDraw,
})
const miniMap = useMiniMapController({
  camera,
  getMainCanvas: () => canvasRef.value,
  getMainBounds: () => mainCanvasBounds,
  getStaticCanvas: () => renderedMap.cache.minimapStaticCanvas,
  getWorldWidth: () => worldWidth.value,
  getWorldHeight: () => worldHeight.value,
  isMapReady: () => mapReady.value,
  clampCamera: mapNavigation.clampCamera,
  zoomAt: mapNavigation.zoomAt,
  hideContextMenu,
  requestDraw,
})
requestMiniMapDraw = miniMap.requestDraw
const mapPointer = useMapPointerController({
  camera,
  getCanvas: () => canvasRef.value,
  isMapReady: () => mapReady.value,
  hideContextMenu,
  updateHoverState: mapInteraction.updatePointerHoverState,
  handleClick: mapInteraction.selectTileAt,
  handleLeave: mapInteraction.clearPointerHoverState,
  handleWheelZoom: (clientX, clientY, factor) => {
    hideHomeHoverCard()
    hideLandHoverCard()
    mapNavigation.zoomAt(clientX, clientY, factor)
  },
  clampToCanvas: mapNavigation.clampToCanvas,
  requestDraw,
})
const {handleKeydown} = useMapKeyboardShortcuts({
  landPlacementMode,
  claimSubmitting,
  pioneerPlacementActive,
  deedPlacementActive,
  setLandPlacementUi,
  resetActiveTool,
  hideClaimPreview,
  closeAbandonDialog,
  closeClaimDialog,
  closeClearCropDialog,
  hideHomeHoverCard,
  hideLandHoverCard,
  hideContextMenu,
})

onMounted(() => {
  void refreshHomeData()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  handleResize()
  void initializeMap()
  renderLoop.start()
})

onBeforeUnmount(() => {
  mapInitializeVersion += 1
  resetMapCanvasResizeObserver()
  resetQueuedMapLandChunks()
  resetLandChunkLoader()
  resetMapItemChunkLoader()
  requestMiniMapDraw = null
  miniMap.destroy()
  toastStack.clearToasts()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  pixiStaticMapCache.destroy()
  renderLoop.stop()
  destroyPixiTextureCache()
})

function setMapCanvas(canvas: HTMLCanvasElement) {
  canvasRef.value = canvas
  observeMapCanvasSize(canvas)
  queueMapCanvasResize()
}

async function initializeMap() {
  const version = mapInitializeVersion + 1
  mapInitializeVersion = version

  try {
    resetLandChunkState()
    const {
      itemList,
      plantCatalog,
    } = await loadInitialMap(MAP_FILE_ID_NAMELESS)
    if (version !== mapInitializeVersion) return

    itemCatalog.value = itemList.items
    updateClaimItemInfo(itemList.items)
    replacePlantCatalog(plantCatalog.plantCycle, plantCatalog.plantDefinitions)
    await loadPlayerHomeAnchor(MAP_FILE_ID_NAMELESS)
    if (version !== mapInitializeVersion) return

    renderedMap.rebuild()
    await refreshClaimInventory()
    if (version !== mapInitializeVersion) return

    focusInitialMapPosition()
    queueVisibleChunkLoads()
  } catch (error) {
    if (version !== mapInitializeVersion) return

    console.error(error)
    requestDraw()
  }
}

async function loadPlayerHomeAnchor(mapId: number) {
  const playerId = sign.player_id
  if (!playerId) {
    setPlayerHomeAnchor(null)
    return
  }

  try {
    const homes = await loadMapPlayerHome(playerId, mapId)
    setPlayerHomeAnchor(getPrimaryHomeAnchor(homes))
  } catch (error) {
    console.error(error)
    setPlayerHomeAnchor(null)
  }
}

function getPrimaryHomeAnchor(homes: MapPlayerHomeItem[]) {
  const home = homes[0]
  if (!home) return null

  return {
    x: home.x,
    y: home.y,
    width: Math.max(1, home.width),
    height: Math.max(1, home.height),
  }
}

function focusInitialMapPosition() {
  selectedMapObject.value = null
  selectedTile.value = homeTile.value ?? null

  if (homeObject.value) {
    focusInitialHomeObject(homeObject.value)
    return
  }

  if (homeAnchor.value) {
    focusInitialHomeAnchor(homeAnchor.value)
    return
  }

  if (homeTile.value) {
    mapNavigation.focusTile(homeTile.value)
    return
  }

  centerInitialMapFallback()
}

function focusInitialHomeObject(object: MapObject) {
  mapNavigation.focusMapObject(object)
  requestAnimationFrame(() => {
    if (!mapReady.value || !mapObjects.includes(object)) return

    mapNavigation.focusMapObject(object)
  })
}

function centerInitialMapFallback() {
  if (mainCanvasBounds.width > 0 && mainCanvasBounds.height > 0) {
    mapNavigation.centerOnMapCenter()
    camera.ready = true
    mapNavigation.clampCamera(mainCanvasBounds.width, mainCanvasBounds.height)
  }
  requestDraw()
}

function focusInitialHomeAnchor(anchor: { x: number; y: number; width: number; height: number }) {
  const tile = tileAt(anchor.x, anchor.y)
  if (tile) selectedTile.value = tile
  selectedMapObject.value = createHomeAnchorSelection(anchor)

  if (mainCanvasBounds.width > 0 && mainCanvasBounds.height > 0) {
    camera.x = mainCanvasBounds.width / 2 - (anchor.x + anchor.width / 2) * tileSize * camera.scale
    camera.y = mainCanvasBounds.height / 2 - (anchor.y + anchor.height / 2) * tileSize * camera.scale
    camera.ready = true
    mapNavigation.clampCamera(mainCanvasBounds.width, mainCanvasBounds.height)
  }
  requestDraw()
}

function createHomeAnchorSelection(anchor: { x: number; y: number; width: number; height: number }): MapObject {
  return {
    id: `player-home-anchor-${anchor.x}-${anchor.y}`,
    type: 'home',
    x: anchor.x,
    y: anchor.y,
    width: anchor.width,
    height: anchor.height,
    level: 1,
    ownerType: 'player',
    ownerData: {
      player_id: sign.player_id ?? '',
      name: playerInfo.value?.name ?? '',
      avatar: playerInfo.value?.avatar ?? null,
      gender: playerInfo.value?.gender,
      gender_string: playerInfo.value?.gender_string,
      tick_age: playerInfo.value?.tick_age,
      tick_age_string: playerInfo.value?.tick_age_string,
    },
    createdAtString: null,
  }
}

function resetLandChunkState() {
  resetQueuedMapLandChunks()
  resetLandChunkLoader()
  resetMapItemChunkLoader()
  setPlayerHomeAnchor(null)
  resetCropActions()
}

function isRiverTile(x: number, y: number) {
  return isBaseRiverTile(x, y)
}

function updateClaimPreview(clientX: number, clientY: number) {
  if (!landPlacementMode.value || !mapReady.value) {
    hideClaimPreview()
    return
  }

  const tile = mapNavigation.getTileFromClientPoint(clientX, clientY)
  claimPreview.visible = Boolean(tile)
  claimPreview.x = tile?.x ?? 0
  claimPreview.y = tile?.y ?? 0
  claimPreview.tile = tile
  claimPreview.valid = Boolean(tile && canSubmitLandPlacementAt(tile))
  requestDraw()
}

function hideClaimPreview() {
  claimPreview.visible = false
  claimPreview.tile = null
  claimPreview.valid = false
  requestDraw()
}

function getContextActions(tile: Tile, object: MapObject | null = null) {
  return getTileContextActions(tile, object, {
    landPlacementMode: Boolean(landPlacementMode.value),
    plantCycle: plantCycle.value,
    canUseDeedAt,
    canFarmTile,
    canHarvestCrop,
    canClearCrop,
    canPlantTile,
    canUsePlantSeed: canUsePlantTool,
    canAbandonTile,
    canStealCrop,
    canRequestPurchase,
    canBuildPlayerStatueTile: playerStatue.canUseAt,
    getObjectsAtTile: objectsAtTile,
    getPlantLabel,
  })
}

function canUseDeedAt(tile: Tile) {
  return deedInventoryAvailable.value > 0 &&
      !claimSubmitting.value &&
      canClaimDeedTile(tile)
}

function hideContextMenu() {
  contextMenu.visible = false
  contextMenu.object = null
}

async function locateChronicleTile(location: PlayerChronicleLocation) {
  if (!mapReady.value) {
    showErrorToast('地图尚未载入')
    return
  }

  const currentVillageId = mapInfo.id || MAP_FILE_ID_NAMELESS
  if (location.village_id !== null && location.village_id !== currentVillageId) {
    showErrorToast('这条记录不在当前地图')
    return
  }

  const tile = tileAt(location.x, location.y)
  if (!tile) {
    showErrorToast('没有找到对应地块')
    return
  }

  hideContextMenu()
  hideHomeHoverCard()
  hideLandHoverCard()
  mapNavigation.focusTile(tile)
  queueVisibleChunkLoads()
}

function locatePlayerHomeById(playerId: string) {
  const normalizedPlayerId = playerId.trim()
  if (!normalizedPlayerId) return

  if (!mapReady.value) {
    showErrorToast('地图尚未载入')
    return
  }

  const home = mapObjects.find((object) => {
    return object.type === 'home' && object.ownerData?.player_id === normalizedPlayerId
  })

  if (!home) {
    showErrorToast('没有找到该玩家住宅')
    return
  }

  hideContextMenu()
  hideHomeHoverCard()
  hideLandHoverCard()
  mapNavigation.focusMapObject(home)
  queueVisibleChunkLoads()
}

function isFarmToolValid(tile: Tile) {
  return isActiveFarmToolValid(tile)
}

function rebuildRenderedMaps() {
  renderedMap.rebuild()
  requestDraw()
}

function handleResize() {
  queueMapCanvasResize()
}

function queueMapCanvasResize() {
  if (mapCanvasResizeFrame !== null) return

  mapCanvasResizeFrame = window.requestAnimationFrame(() => {
    mapCanvasResizeFrame = null
    resizeMapCanvasNow()
  })
}

function resizeMapCanvasNow() {
  renderLoop.resize()
}

function observeMapCanvasSize(canvas: HTMLCanvasElement) {
  resetMapCanvasResizeObserver()
  if (typeof ResizeObserver === 'undefined') return

  mapCanvasResizeObserver = new ResizeObserver(queueMapCanvasResize)
  mapCanvasResizeObserver.observe(canvas)
}

function resetMapCanvasResizeObserver() {
  if (mapCanvasResizeFrame !== null) {
    window.cancelAnimationFrame(mapCanvasResizeFrame)
    mapCanvasResizeFrame = null
  }
  mapCanvasResizeObserver?.disconnect()
  mapCanvasResizeObserver = null
}

function handleCanvasResize() {
  if (!camera.ready && mapReady.value) {
    if (homeTile.value) mapNavigation.centerOnTile(homeTile.value)
    else mapNavigation.centerOnMapCenter()
    camera.ready = true
  }

  miniMap.updateBounds()
  miniMap.requestDraw()
  mapNavigation.clampCamera(mainCanvasBounds.width, mainCanvasBounds.height)
}

function requestDraw() {
  renderLoop.requestDraw()
  requestMiniMapDraw?.()
}

function requestSceneDraw() {
  renderLoop.requestSceneDraw()
  requestMiniMapDraw?.()
}

function requestAnimationDraw() {
  renderLoop.requestAnimationDraw()
}

function queueVisibleChunkLoads() {
  queueVisibleLandChunkLoad()
  queueVisibleMapItemChunkLoad()
}

function getVisibleChunkPadding() {
  return getMapZoomProfile(camera.scale).chunkPadding
}

function getMapAnimationFrameInterval() {
  if (!mapReady.value) return Number.POSITIVE_INFINITY

  const profile = getMapZoomProfile(camera.scale)
  if (loadingLandChunks.size > 0 || loadingMapItemChunks.size > 0) return Math.min(profile.animationFrameInterval, 1000 / 18)
  if (!canAnimateZoomProfile(profile)) return Number.POSITIVE_INFINITY

  return profile.animationFrameInterval
}

function getMapSceneFrameInterval() {
  if (!mapReady.value) return Number.POSITIVE_INFINITY

  return getMapZoomProfile(camera.scale).sceneFrameInterval
}

function drawMapFrame(frame: PixiMapRenderFrame, timestamp: number, bounds: { width: number; height: number }, state: MapRenderFrameState) {
  if (!mapReady.value) {
    if (!state.redrawSceneLayers) return

    pixiStaticMapCache.destroy()
    const context = frame.backdropContext
    context.fillStyle = landPlacementMode.value ? '#cfe7df' : '#d8eadc'
    context.fillRect(0, 0, bounds.width, bounds.height)
    return
  }

  if (state.redrawSceneLayers) updatePlantGrowth()
  drawMapScene(frame, timestamp, {
    bounds,
    butterflies: butterflyAnchors,
    camera,
    canClaimDeedTile,
    claimPreview,
    dog: watchdogObject.value,
    home: homeObject.value,
    landPlacementMode: landPlacementMode.value,
    landPlacementSize: landPlacementSize.value,
    loadingLandChunks,
    loadingMapItemChunks,
    mapHeight: mapHeight.value,
    mapObjects,
    mapWidth: mapWidth.value,
    ownerLabelClusters: renderedMap.cache.ownerLabelClusters,
    ownerLabelClusterTileKeys: renderedMap.cache.ownerLabelClusterTileKeys,
    plantDefinitions,
    selectedMapObject: selectedMapObject.value,
    selectedTile: selectedTile.value,
    staticMapCache: pixiStaticMapCache,
    staticMapVersion: renderedMap.cache.staticMapVersion,
    tileAt,
    worldHeight: worldHeight.value,
    isTileCropActionPending,
    requestDraw,
    requestSceneDraw,
  }, state)
  if (state.redrawSceneLayers) miniMap.requestDraw()
}

function updatePlantGrowth() {
  if (!mapReady.value) return

  const changed = updateLocalCropLifecycle(
      tiles,
      (tile, status) => tile.ownerType === 'player' && canFarmTile(tile) && canShowHarvestActionStatus(status),
  )

  if (changed) {
    requestDraw()
  }
}

</script>

<style>
.game-view {
  --game-player-card-top: 18px;
  --game-left-control-gap: 12px;
  --game-left-control-top: calc(var(--game-player-card-top) + var(--game-player-card-height, 76px) + var(--game-left-control-gap));
}

.render-debug-panel {
  position: absolute;
  right: 18px;
  top: 62px;
  z-index: 25;
  display: grid;
  width: 204px;
  gap: 6px;
  border: 1px solid rgb(95 76 42 / 34%);
  border-radius: 8px;
  background: rgb(36 31 23 / 84%);
  padding: 9px 10px;
  color: #fff6d8;
  font-size: 11px;
  line-height: 1;
  pointer-events: none;
  box-shadow: 0 14px 30px rgb(28 23 16 / 22%);
  backdrop-filter: blur(10px);
}

.render-debug-panel strong {
  color: #ffe27a;
  font-size: 12px;
  font-weight: 900;
}

.render-debug-panel dl {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 4px 8px;
  margin: 0;
}

.render-debug-panel dt,
.render-debug-panel dd {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.render-debug-panel dt {
  color: rgb(255 246 216 / 62%);
  font-weight: 800;
}

.render-debug-panel dd {
  color: #fff9e8;
  font-weight: 900;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.land-placement-toggle {
  position: absolute;
  left: 18px;
  top: var(--game-left-control-top, 106px);
  z-index: 29;
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 10px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 92%);
  padding: 0 10px 0 13px;
  color: #59482e;
  font-size: 13px;
  font-weight: 900;
  box-shadow: 0 10px 24px rgb(72 61 36 / 16%);
  backdrop-filter: blur(10px);
}

.land-placement-toggle:hover {
  background: rgb(255 242 204 / 96%);
}

.land-placement-toggle.is-active {
  border-color: #647f43;
  background: #6f8f50;
  color: #fff9df;
  box-shadow: 0 10px 24px rgb(72 61 36 / 18%),
  inset 0 0 0 2px rgb(255 249 223 / 32%);
}

.land-placement-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  filter: saturate(0.4);
}

.land-placement-toggle b {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid rgb(143 112 55 / 68%);
  border-radius: 999px;
  background: #fff8de;
  color: #4a3717;
  font-size: 11px;
  line-height: 1;
}

.land-placement-toggle.is-active b {
  border-color: rgb(255 249 223 / 62%);
  background: rgb(255 249 223 / 22%);
  color: #fff9df;
}

.pioneer-placement-toggle {
  left: 50%;
  top: auto;
  bottom: 22px;
  min-height: 44px;
  gap: 12px;
  padding: 0 16px 0 18px;
  font-size: 14px;
  box-shadow: 0 16px 34px rgb(72 61 36 / 20%);
  transform: translateX(-50%);
}

.claim-banner {
  position: absolute;
  left: 50%;
  top: 18px;
  z-index: 27;
  display: grid;
  max-width: min(420px, calc(100vw - 376px));
  min-height: 54px;
  align-content: center;
  gap: 4px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 91%);
  padding: 10px 14px;
  color: #4d3d21;
  box-shadow: 0 14px 32px rgb(72 61 36 / 16%);
  transform: translateX(-50%);
  backdrop-filter: blur(10px);
}

.claim-banner strong {
  font-size: 15px;
  line-height: 1;
}

.claim-banner span {
  color: #6b5734;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
}

.claim-banner.is-error {
  border-color: #c36b55;
  background: rgb(255 239 225 / 94%);
}

.claim-banner.is-error strong {
  color: #91372f;
}

@media (max-width: 900px) {
  .game-view {
    --game-player-card-top: 12px;
    --game-left-control-gap: 10px;
  }

  .land-placement-toggle {
    left: 12px;
  }

  .render-debug-panel {
    right: 12px;
    top: 56px;
  }

  .pioneer-placement-toggle {
    left: 50%;
    top: auto;
    bottom: 18px;
    transform: translateX(-50%);
  }

  .claim-banner {
    top: 142px;
    max-width: min(420px, calc(100vw - 24px));
  }
}

@media (max-width: 640px) {
  .game-view {
    --game-left-control-gap: 8px;
  }

  .land-placement-toggle {
    min-height: 34px;
    gap: 7px;
    padding: 0 8px 0 10px;
    font-size: 12px;
  }

  .render-debug-panel {
    right: 12px;
    top: 50px;
    width: min(204px, calc(100vw - 24px));
  }

  .pioneer-placement-toggle {
    left: 50%;
    top: auto;
    bottom: 12px;
    min-height: 40px;
    max-width: calc(100vw - 24px);
    padding: 0 13px 0 15px;
    font-size: 13px;
    transform: translateX(-50%);
  }

  .land-placement-toggle b {
    min-width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .claim-banner {
    left: 12px;
    top: 134px;
    max-width: calc(100vw - 24px);
    min-height: 48px;
    transform: none;
  }
}
</style>
