import {computed, reactive, ref, shallowReactive, type Ref} from 'vue'
import {removeButterfliesFromTileIfNeeded} from '@/game/butterflies'
import {resolveThemeColor} from '@/game/colorUtils'
import {applyLandChunkTilePatches} from '@/game/landTilePatch'
import {loadInitialMapData} from '@/game/mapBootstrap'
import {createButterflies} from '@/game/mapData'
import type {LandChunkRequest} from '@/game/landChunks'
import type {ChunkAnchorRect} from '@/game/landChunks'
import {
    createMapEventApplier,
    mapRealtimeEventNeedsRenderedMapRebuild,
    tilePatchNeedsRenderedMapRebuild,
} from '@/game/mapEventApplier'
import {
    createMapObjectsFromItems,
    createOccupiedRectsFromItems,
} from '@/game/mapObjectData'
import {createTileLookup} from '@/game/tileRules'
import {loadMapItems} from '@/game/baseMap'
import type {
    Butterfly,
    MapItemResponse,
    MapJson,
    MapLandChunkItem,
    MapObject,
    MapRealtimeEvent,
    PlantType,
    Tile,
} from '@/game/types'

const reactiveArrayBatchSize = 2048

interface UseMapDataControllerOptions {
    selectedTile: Ref<Tile | null>
    selectedMapObject: Ref<MapObject | null>
    getCurrentPlayerId: () => string | null | undefined
    getCurrentPlayerName: () => string | null | undefined
    getPlantLabel: (plant: PlantType) => string
    rebuildRenderedMaps: () => void
    requestDraw: () => void
}

export function useMapDataController(options: UseMapDataControllerOptions) {
    const mapInfo = reactive({
        id: 0,
        code: '',
        name: '',
        width: 0,
        height: 0,
    })
    const tiles = shallowReactive<Tile[]>([])
    const mapObjects = shallowReactive<MapObject[]>([])
    const occupiedMapRects = shallowReactive<Array<{ x: number; y: number; width: number; height: number }>>([])
    const butterflyAnchors = shallowReactive<Butterfly[]>([])
    const mapDataVersion = ref(0)
    const playerHomeAnchor = reactive<ChunkAnchorRect>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    })
    let tileAtLookup = createTileLookup(tiles, 0, 0)

    const tileAt = (x: number, y: number) => tileAtLookup(x, y)
    const homeObject = computed(() => {
        mapDataVersion.value

        return mapObjects.find((object) => object.type === 'home' && object.ownerType === 'player') ?? null
    })
    const homeAnchor = computed<ChunkAnchorRect | null>(() => {
        if (homeObject.value) return homeObject.value
        if (playerHomeAnchor.width > 0 && playerHomeAnchor.height > 0) return playerHomeAnchor

        return null
    })
    const hasOwnHomeOnCurrentMap = computed(() => Boolean(homeAnchor.value))
    const watchdogObject = computed(() => {
        mapDataVersion.value

        return mapObjects.find((object) => object.type === 'watchdog' && object.ownerType === 'player') ?? null
    })
    const homeTile = computed(() => {
        mapDataVersion.value

        if (homeObject.value) return tileAt(homeObject.value.x, homeObject.value.y)
        if (homeAnchor.value) return tileAt(homeAnchor.value.x, homeAnchor.value.y)

        return tiles.find((tile) => tile.ownerType === 'player') ?? null
    })
    const mapName = computed(() => mapInfo.name || mapInfo.code || '地图')
    const mapWidth = computed(() => mapInfo.width)
    const mapHeight = computed(() => mapInfo.height)
    const mapReady = computed(() => {
        mapDataVersion.value

        return tiles.length > 0 && mapInfo.width > 0 && mapInfo.height > 0
    })

    const mapEventApplier = createMapEventApplier({
        tileAt: () => tileAt,
        tiles,
        mapObjects,
        occupiedMapRects,
        butterflyAnchors,
        selectedTile: options.selectedTile,
        selectedMapObject: options.selectedMapObject,
        getPlantLabel: options.getPlantLabel,
        getObjectThemeColor,
    })

    async function loadInitialMap(mapId: number) {
        const initialData = await loadInitialMapData(mapId)
        applyInitialMapJson(initialData.mapJson)
        replaceReactiveArray(butterflyAnchors, createButterflies(tiles))
        bumpMapDataVersion()

        return {
            itemList: initialData.itemList,
            plantCatalog: initialData.plantCatalog,
        }
    }

    function applyInitialMapJson(mapJson: MapJson) {
        mapInfo.id = mapJson.id ?? 0
        mapInfo.code = mapJson.code
        mapInfo.name = mapJson.name
        mapInfo.width = mapJson.width
        mapInfo.height = mapJson.height

        replaceReactiveArray(tiles, mapJson.tiles)
        replaceReactiveArray(mapObjects, mapJson.objects)
        tileAtLookup = createTileLookup(tiles, mapJson.width, mapJson.height)
        bumpMapDataVersion()
    }

    function applyMapLandChunk(items: MapLandChunkItem[]) {
        const result = applyLandChunkTilePatches(items, {
            currentPlayerId: options.getCurrentPlayerId(),
            currentPlayerName: options.getCurrentPlayerName(),
            homeObject: homeObject.value,
            mapObjects,
            getPlantLabel: options.getPlantLabel,
            tileAt,
            shouldRebuildRenderedMap: tilePatchNeedsRenderedMapRebuild,
            onTilePatched: (tile) => {
                removeButterfliesFromTileIfNeeded(butterflyAnchors, tile)
                if (options.selectedTile.value?.x === tile.x && options.selectedTile.value.y === tile.y) {
                    options.selectedTile.value = tile
                }
            },
        })
        bumpMapDataVersion()

        if (result.needsRenderedMapRebuild) {
            options.rebuildRenderedMaps()
        } else {
            options.requestDraw()
        }
    }

    async function refreshMapItems(mapId: number, rect?: LandChunkRequest) {
        const items = await loadMapItems(mapId, rect)
        const needsRenderedMapRebuild = rect ? applyMapItemsInRect(items, rect) : applyMapItems(items)
        if (needsRenderedMapRebuild) options.rebuildRenderedMaps()
        else options.requestDraw()

        return items
    }

    function applyMapItemChunk(items: MapItemResponse[], rect: LandChunkRequest) {
        const needsRenderedMapRebuild = applyMapItemsInRect(items, rect)
        if (needsRenderedMapRebuild || items.some((item) => item.item_type === 'home')) {
            options.rebuildRenderedMaps()
        } else {
            options.requestDraw()
        }
    }

    function setPlayerHomeAnchor(anchor: ChunkAnchorRect | null) {
        Object.assign(playerHomeAnchor, anchor ?? {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        })
    }

    function applyMapItems(items: MapItemResponse[]) {
        const objects = createMapObjectsFromItems(items, options.getCurrentPlayerId())
        const occupiedRects = createOccupiedRectsFromItems(items)

        occupiedMapRects.splice(0, occupiedMapRects.length)
        for (const rect of occupiedRects) {
            mapEventApplier.rememberOccupiedRect(rect)
        }

        for (const object of objects) {
            if (object.type === 'home') mapEventApplier.markHomeObjectTiles(object)
        }

        replaceReactiveArray(mapObjects, objects)
        const needsRenderedMapRebuild = mapEventApplier.applyHomeLinkedLandColors(objects)
        bumpMapDataVersion()

        return needsRenderedMapRebuild
    }

    function applyMapItemsInRect(items: MapItemResponse[], rect: LandChunkRequest) {
        const objects = createMapObjectsFromItems(items, options.getCurrentPlayerId())
        const incomingKeys = new Set(objects.map(getMapObjectMergeKey))
        const nextObjects = mapObjects.filter((object) => {
            if (incomingKeys.has(getMapObjectMergeKey(object))) return false

            return !isMapObjectAnchorInRect(object, rect)
        })

        pushReactiveArray(nextObjects, objects)
        replaceReactiveArray(mapObjects, nextObjects)
        rebuildOccupiedMapRects()
        bumpMapDataVersion()

        for (const object of objects) {
            if (object.type === 'home') mapEventApplier.markHomeObjectTiles(object)
        }
        const needsRenderedMapRebuild = mapEventApplier.applyHomeLinkedLandColors(objects)

        if (options.selectedMapObject.value) {
            const selectedKey = getMapObjectMergeKey(options.selectedMapObject.value)
            const selectedObject = mapObjects.find((object) => getMapObjectMergeKey(object) === selectedKey)
            if (selectedObject) options.selectedMapObject.value = selectedObject
            else selectLoadedPlayerHomeObjectIfNeeded()
        } else {
            selectLoadedPlayerHomeObjectIfNeeded()
        }

        return needsRenderedMapRebuild
    }

    function selectLoadedPlayerHomeObjectIfNeeded() {
        const anchor = homeAnchor.value
        const selectedTile = options.selectedTile.value
        if (!anchor || selectedTile?.x !== anchor.x || selectedTile.y !== anchor.y) return

        const home = mapObjects.find((object) => {
            return object.type === 'home' &&
                object.ownerType === 'player' &&
                object.x === anchor.x &&
                object.y === anchor.y
        })
        if (home) options.selectedMapObject.value = home
    }

    function applyMapRealtimeEvent(event: MapRealtimeEvent) {
        mapEventApplier.applyEvent(event)
        bumpMapDataVersion()

        if (mapRealtimeEventNeedsRenderedMapRebuild(event)) {
            options.rebuildRenderedMaps()
        } else {
            options.requestDraw()
        }
    }

    function applyHomeObjectOwnerData(object: MapObject) {
        mapEventApplier.markHomeObjectTiles(object)
        mapEventApplier.applyHomeLinkedLandColors([object])
        bumpMapDataVersion()
        options.rebuildRenderedMaps()
    }

    function getObjectThemeColor(object: MapObject) {
        return resolveThemeColor(object.ownerData?.color)
    }

    function rebuildOccupiedMapRects() {
        occupiedMapRects.splice(0, occupiedMapRects.length)

        for (const object of mapObjects) {
            if (object.width > 0 && object.height > 0) mapEventApplier.rememberOccupiedObject(object)
        }
    }

    function bumpMapDataVersion() {
        mapDataVersion.value += 1
    }

    function getMapObjectMergeKey(object: MapObject) {
        return `${object.type}:${object.x}:${object.y}`
    }

    function isMapObjectAnchorInRect(object: MapObject, rect: LandChunkRequest) {
        return object.x >= rect.x &&
            object.x < rect.x + rect.w &&
            object.y >= rect.y &&
            object.y < rect.y + rect.h
    }

    return {
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
    }
}

function replaceReactiveArray<T>(target: T[], items: T[]) {
    target.splice(0, target.length)
    pushReactiveArray(target, items)
}

function pushReactiveArray<T>(target: T[], items: T[]) {
    for (let index = 0; index < items.length; index += reactiveArrayBatchSize) {
        target.push(...items.slice(index, index + reactiveArrayBatchSize))
    }
}
