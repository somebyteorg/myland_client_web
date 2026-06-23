import {drawButterflies, drawGrassWind, drawTheftClues} from './renderEffects'
import {buildOwnerLabelClusters, drawTileLabels} from './renderLabels'
import {drawStaticTile} from './renderMapTiles'
import {drawHomeObject, drawScarecrowObject, drawWatchdogObject} from './renderObjects'
import {drawPlayerStatueObject} from './renderPlayerStatue'
import {drawLandChunkLoadingOverlays, drawOverlayHighlights} from './renderOverlays'
import {drawPlant} from './renderPlants'
import type {CameraState} from './mapCamera'
import {getVisibleTileBounds} from './mapCamera'
import type {Butterfly, PlantDefinitionMap, MapObject, OwnerLabelCluster, Tile} from './types'
import type {ClaimPreviewState} from './renderOverlays'

type TileLookup = (x: number, y: number) => Tile | null
type PlacementMode = 'pioneer' | 'deed' | null
const overviewStaticScale = 0.42
const highDetailStaticScale = 1.45
const maxStaticMapCanvasPixels = 96 * 1024 * 1024

export interface StaticMapResult {
    canvas: HTMLCanvasElement | null
    ownerLabelClusters: OwnerLabelCluster[]
}

export interface DrawSceneOptions {
    bounds: {
        width: number
        height: number
    }
    camera: CameraState
    claimPreview: ClaimPreviewState
    landPlacementMode: PlacementMode
    landPlacementSize: number
    loadingLandChunks: ReadonlySet<string>
    mapHeight: number
    mapObjects: MapObject[]
    mapWidth: number
    ownerLabelClusters: OwnerLabelCluster[]
    plantDefinitions: PlantDefinitionMap
    selectedMapObject: MapObject | null
    selectedTile: Tile | null
    staticCanvas: HTMLCanvasElement | null
    overviewCanvas: HTMLCanvasElement | null
    tileAt: TileLookup
    worldHeight: number
    worldWidth: number
    canClaimDeedTile: (tile: Tile) => boolean
    isTileCropActionPending: (tile: Tile) => boolean
    butterflies: Butterfly[]
    dog: MapObject | null
    home: MapObject | null
    requestDraw: () => void
}

export function buildStaticMapCanvas(
    tiles: Tile[],
    tileAt: TileLookup,
    mapWidth: number,
    mapHeight: number,
    worldWidth: number,
    worldHeight: number,
): StaticMapResult | null {
    const ownerLabelClusters = buildOwnerLabelClusters(tiles, tileAt, mapWidth, mapHeight)

    if (worldWidth * worldHeight > maxStaticMapCanvasPixels) {
        return {
            canvas: null,
            ownerLabelClusters,
        }
    }

    const canvas = document.createElement('canvas')
    canvas.width = worldWidth
    canvas.height = worldHeight

    const context = canvas.getContext('2d')
    if (!context) return null

    context.imageSmoothingEnabled = false
    context.fillStyle = '#78b766'
    context.fillRect(0, 0, worldWidth, worldHeight)

    for (const tile of tiles) {
        drawStaticTile(context, tile, tileAt, mapWidth)
    }

    return {
        canvas,
        ownerLabelClusters,
    }
}

export function drawMapScene(context: CanvasRenderingContext2D, timestamp: number, options: DrawSceneOptions) {
    drawBackdrop(context, options.bounds.width, options.bounds.height, options.landPlacementMode)
    drawStaticViewport(context, options)
    drawDynamicLayer(context, timestamp, options)
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number, landPlacementMode: PlacementMode) {
    context.fillStyle = landPlacementMode ? '#cfe7df' : '#d8eadc'
    context.fillRect(0, 0, width, height)
}

function drawStaticViewport(context: CanvasRenderingContext2D, options: DrawSceneOptions) {
    if (options.camera.scale >= highDetailStaticScale) {
        drawVisibleStaticViewport(context, options)
        return
    }

    const sourceCanvas = options.camera.scale < overviewStaticScale ? options.overviewCanvas : options.staticCanvas
    if (!sourceCanvas) {
        drawVisibleStaticViewport(context, options)
        return
    }

    drawCachedStaticViewport(context, sourceCanvas, options)
}

function drawCachedStaticViewport(context: CanvasRenderingContext2D, sourceCanvas: HTMLCanvasElement, options: DrawSceneOptions) {
    if (options.worldWidth <= 0 || options.worldHeight <= 0) return

    const sx = Math.max(0, -options.camera.x / options.camera.scale)
    const sy = Math.max(0, -options.camera.y / options.camera.scale)
    const sw = Math.min(options.bounds.width / options.camera.scale, options.worldWidth - sx)
    const sh = Math.min(options.bounds.height / options.camera.scale, options.worldHeight - sy)

    if (sw <= 0 || sh <= 0) return

    const sourceScaleX = sourceCanvas.width / options.worldWidth
    const sourceScaleY = sourceCanvas.height / options.worldHeight
    const dx = options.camera.x + sx * options.camera.scale
    const dy = options.camera.y + sy * options.camera.scale
    context.drawImage(
        sourceCanvas,
        sx * sourceScaleX,
        sy * sourceScaleY,
        sw * sourceScaleX,
        sh * sourceScaleY,
        dx,
        dy,
        sw * options.camera.scale,
        sh * options.camera.scale,
    )
}

function drawVisibleStaticViewport(context: CanvasRenderingContext2D, options: DrawSceneOptions) {
    const bounds = getVisibleTileBounds(
        options.camera,
        options.bounds.width,
        options.bounds.height,
        options.mapWidth,
        options.mapHeight,
        1,
    )
    const offset = getCameraDrawOffset(options.camera)

    context.save()
    context.translate(offset.x, offset.y)
    context.scale(options.camera.scale, options.camera.scale)
    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!tile) continue

            drawStaticTile(context, tile, options.tileAt, options.mapWidth)
        }
    }
    context.restore()
}

function drawDynamicLayer(context: CanvasRenderingContext2D, timestamp: number, options: DrawSceneOptions) {
    const bounds = getVisibleTileBounds(
        options.camera,
        options.bounds.width,
        options.bounds.height,
        options.mapWidth,
        options.mapHeight,
    )

    context.save()
    const offset = getCameraDrawOffset(options.camera)
    context.translate(offset.x, offset.y)
    context.scale(options.camera.scale, options.camera.scale)
    drawGrassWind(context, bounds, timestamp, {
        cameraScale: options.camera.scale,
        tileAt: options.tileAt,
    })
    drawPlants(context, bounds, timestamp, options)
    drawMapObjects(context, bounds, timestamp, options.mapObjects, options.requestDraw)
    drawButterflies(context, bounds, timestamp, {
        butterflies: options.butterflies,
        cameraScale: options.camera.scale,
        tileAt: options.tileAt,
    })
    drawTheftClues(context, bounds, timestamp, {
        cameraScale: options.camera.scale,
        dog: options.dog,
        home: options.home,
        tileAt: options.tileAt,
    })
    drawLandChunkLoadingOverlays(context, bounds, timestamp, {
        cameraScale: options.camera.scale,
        loadingLandChunks: options.loadingLandChunks,
    })
    drawOverlayHighlights(context, bounds, timestamp, {
        cameraScale: options.camera.scale,
        canClaimDeedTile: options.canClaimDeedTile,
        claimPreview: options.claimPreview,
        isTileCropActionPending: options.isTileCropActionPending,
        landPlacementMode: options.landPlacementMode,
        landPlacementSize: options.landPlacementSize,
        ownLandColor: options.home?.ownerData?.color ?? null,
        selectedMapObject: options.selectedMapObject,
        selectedTile: options.selectedTile,
        tileAt: options.tileAt,
    })
    drawTileLabels(context, bounds, {
        cameraScale: options.camera.scale,
        landPlacementMode: options.landPlacementMode,
        mapObjects: options.mapObjects,
        ownerLabelClusters: options.ownerLabelClusters,
        tileAt: options.tileAt,
        worldHeight: options.worldHeight,
    })
    context.restore()
}

function getCameraDrawOffset(camera: CameraState) {
    if (camera.scale < highDetailStaticScale) {
        return {
            x: camera.x,
            y: camera.y,
        }
    }

    return {
        x: Math.round(camera.x),
        y: Math.round(camera.y),
    }
}

function drawPlants(context: CanvasRenderingContext2D, bounds: ReturnType<typeof getVisibleTileBounds>, timestamp: number, options: DrawSceneOptions) {
    if (options.camera.scale < 0.38) return

    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!tile?.plant) continue

            drawPlant(context, tile, timestamp, options.plantDefinitions)
        }
    }
}

function drawMapObjects(
    context: CanvasRenderingContext2D,
    bounds: ReturnType<typeof getVisibleTileBounds>,
    timestamp: number,
    mapObjects: MapObject[],
    requestDraw: () => void,
) {
    for (const object of mapObjects) {
        if (!objectIntersectsBounds(object, bounds)) continue

        if (object.type === 'home') {
            drawHomeObject(context, object, timestamp)
        } else if (object.type === 'watchdog') {
            drawWatchdogObject(context, object, timestamp)
        } else if (object.type === 'player_statue') {
            drawPlayerStatueObject(context, object, timestamp, requestDraw)
        } else {
            drawScarecrowObject(context, object, timestamp)
        }
    }
}

function objectIntersectsBounds(object: MapObject, bounds: ReturnType<typeof getVisibleTileBounds>) {
    return object.x + object.width >= bounds.startX &&
        object.x <= bounds.endX &&
        object.y + object.height >= bounds.startY &&
        object.y <= bounds.endY
}
