import {drawButterflies, drawGrassWind, drawTheftClues} from './renderEffects'
import {drawTileLabels} from './renderLabels'
import {drawHomeObject, drawScarecrowObject, drawWatchdogObject} from './renderObjects'
import {drawPlayerStatueObject} from './renderPlayerStatue'
import {drawLandChunkLoadingOverlays, drawOverlayHighlights, drawOwnLandBoundaryHighlights} from './renderOverlays'
import {drawPlant} from './renderPlants'
import {tileSize} from './config'
import {getVisibleTileBounds} from './mapCamera'
import {getCameraDrawOffset} from './renderCamera'
import {canAnimateZoomProfile, canRenderDetailedObjects, getMapZoomProfile} from './mapZoomProfile'
import type {CameraState} from './mapCamera'
import type {Butterfly, PlantDefinitionMap, MapObject, OwnerLabelCluster, Tile} from './types'
import type {ClaimPreviewState} from './renderOverlays'
import type {PixiDrawContext} from './pixiDrawContext'
import type {PixiStaticMapCache} from './pixiMapCache'
import type {PixiMapRenderFrame} from './pixiRenderFrame'
import type {MapZoomProfile} from './mapZoomProfile'

type TileLookup = (x: number, y: number) => Tile | null
type PlacementMode = 'pioneer' | 'deed' | null

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
    loadingMapItemChunks: ReadonlySet<string>
    mapHeight: number
    mapObjects: MapObject[]
    mapWidth: number
    ownerLabelClusters: OwnerLabelCluster[]
    ownerLabelClusterTileKeys: ReadonlySet<string>
    plantDefinitions: PlantDefinitionMap
    selectedMapObject: MapObject | null
    selectedTile: Tile | null
    staticMapCache: PixiStaticMapCache
    staticMapVersion: number
    tileAt: TileLookup
    worldHeight: number
    canClaimDeedTile: (tile: Tile) => boolean
    isTileCropActionPending: (tile: Tile) => boolean
    butterflies: Butterfly[]
    dog: MapObject | null
    home: MapObject | null
    requestDraw: () => void
    requestSceneDraw: () => void
}

export interface DrawSceneFrameState {
    redrawAnimationLayers: boolean
    redrawLabelLayer: boolean
    redrawSceneLayers: boolean
}

export function drawMapScene(frame: PixiMapRenderFrame, timestamp: number, options: DrawSceneOptions, state: DrawSceneFrameState) {
    const profile = getMapZoomProfile(options.camera.scale)

    if (state.redrawSceneLayers) {
        drawBackdrop(frame.backdropContext, options.bounds.width, options.bounds.height, options.landPlacementMode)
        drawStaticViewport(frame, options)
        drawSceneLayer(frame.sceneContext, timestamp, options, profile)
    }
    if (state.redrawLabelLayer) {
        drawLabelLayer(frame.labelContext, options, profile)
    }
    if (state.redrawAnimationLayers) {
        drawCropAnimationLayer(frame.cropAnimationContext, timestamp, options, profile)
        drawObjectAnimationLayer(frame.objectAnimationContext, timestamp, options, profile)
        drawOverlayAnimationLayer(frame.overlayAnimationContext, timestamp, options, profile)
    }
}

function drawBackdrop(context: PixiDrawContext, width: number, height: number, landPlacementMode: PlacementMode) {
    context.fillStyle = landPlacementMode ? '#cfe7df' : '#d8eadc'
    context.fillRect(0, 0, width, height)
}

function drawStaticViewport(frame: PixiMapRenderFrame, options: DrawSceneOptions) {
    options.staticMapCache.sync(frame.layers.static, {
        bounds: options.bounds,
        camera: options.camera,
        mapHeight: options.mapHeight,
        mapVersion: options.staticMapVersion,
        mapWidth: options.mapWidth,
        requestDraw: options.requestSceneDraw,
        renderer: frame.renderer,
        tileAt: options.tileAt,
    })
}

function drawSceneLayer(context: PixiDrawContext, timestamp: number, options: DrawSceneOptions, profile: MapZoomProfile) {
    const bounds = getSceneTileBounds(options, profile)

    beginWorldLayer(context, options.camera)
    if (profile.showGrid) drawTileGridOverlay(context, bounds, options.camera.scale)
    drawOwnLandBoundaryHighlights(context, bounds, timestamp, {
        cameraScale: options.camera.scale,
        ownLandColor: options.home?.ownerData?.color ?? null,
        tileAt: options.tileAt,
    })
    drawStableMapObjects(context, bounds, timestamp, options, profile)
    context.restore()
}

function drawLabelLayer(context: PixiDrawContext, options: DrawSceneOptions, profile: MapZoomProfile) {
    const bounds = getSceneTileBounds(options, profile)

    beginWorldLayer(context, options.camera)
    drawTileLabels(context, bounds, {
        cameraScale: options.camera.scale,
        landPlacementMode: options.landPlacementMode,
        mapObjects: options.mapObjects,
        ownerLabelClusters: options.ownerLabelClusters,
        ownerLabelClusterTileKeys: options.ownerLabelClusterTileKeys,
        tileAt: options.tileAt,
        worldHeight: options.worldHeight,
    })
    context.restore()
}

function drawCropAnimationLayer(context: PixiDrawContext, timestamp: number, options: DrawSceneOptions, profile: MapZoomProfile) {
    const bounds = getSceneTileBounds(options, profile)

    beginWorldLayer(context, options.camera)
    if (canAnimateZoomProfile(profile)) {
        if (profile.showAmbientEffects) {
            drawGrassWind(context, bounds, timestamp, {
                cameraScale: options.camera.scale,
                tileAt: options.tileAt,
            })
        }
        drawPlants(context, bounds, timestamp, options, profile)
    }
    context.restore()
}

function drawObjectAnimationLayer(context: PixiDrawContext, timestamp: number, options: DrawSceneOptions, profile: MapZoomProfile) {
    const bounds = getSceneTileBounds(options, profile)

    beginWorldLayer(context, options.camera)
    if (canAnimateZoomProfile(profile)) {
        drawAnimatedMapObjects(context, bounds, timestamp, options.mapObjects)
        if (profile.showAmbientEffects) {
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
        }
    }
    context.restore()
}

function drawOverlayAnimationLayer(context: PixiDrawContext, timestamp: number, options: DrawSceneOptions, profile: MapZoomProfile) {
    const bounds = getSceneTileBounds(options, profile)

    beginWorldLayer(context, options.camera)
    drawLandChunkLoadingOverlays(context, bounds, timestamp, {
        cameraScale: options.camera.scale,
        loadingLandChunks: options.loadingLandChunks,
        loadingMapItemChunks: options.loadingMapItemChunks,
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
    context.restore()
}

function getSceneTileBounds(options: DrawSceneOptions, profile: MapZoomProfile) {
    return getVisibleTileBounds(
        options.camera,
        options.bounds.width,
        options.bounds.height,
        options.mapWidth,
        options.mapHeight,
        profile.renderPadding,
    )
}

function beginWorldLayer(context: PixiDrawContext, camera: CameraState) {
    const offset = getCameraDrawOffset(camera)

    context.save()
    context.translate(offset.x, offset.y)
    context.scale(camera.scale, camera.scale)
}

function drawPlants(
    context: PixiDrawContext,
    bounds: ReturnType<typeof getVisibleTileBounds>,
    timestamp: number,
    options: DrawSceneOptions,
    profile: MapZoomProfile,
) {
    if (!profile.showPlants) return

    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!tile?.plant) continue

            drawPlant(context, tile, timestamp, options.plantDefinitions)
        }
    }
}

function drawStableMapObjects(
    context: PixiDrawContext,
    bounds: ReturnType<typeof getVisibleTileBounds>,
    timestamp: number,
    options: DrawSceneOptions,
    profile: MapZoomProfile,
) {
    const detailedObjects = canRenderDetailedObjects(profile)

    for (const object of options.mapObjects) {
        if (!objectIntersectsBounds(object, bounds)) continue

        if (object.type === 'home') {
            if (!canAnimateZoomProfile(profile)) drawHomeObject(context, object, timestamp)
        } else if (object.type === 'watchdog') {
            if (!detailedObjects) continue
            drawWatchdogObject(context, object, timestamp)
        } else if (object.type === 'player_statue') {
            drawPlayerStatueObject(context, object, timestamp, options.requestSceneDraw)
        } else {
            if (!detailedObjects) continue
            drawScarecrowObject(context, object, timestamp)
        }
    }
}

function drawAnimatedMapObjects(
    context: PixiDrawContext,
    bounds: ReturnType<typeof getVisibleTileBounds>,
    timestamp: number,
    mapObjects: MapObject[],
) {
    for (const object of mapObjects) {
        if (object.type !== 'home' || !objectIntersectsBounds(object, bounds)) continue

        drawHomeObject(context, object, timestamp)
    }
}

function objectIntersectsBounds(object: MapObject, bounds: ReturnType<typeof getVisibleTileBounds>) {
    return object.x + object.width >= bounds.startX &&
        object.x <= bounds.endX &&
        object.y + object.height >= bounds.startY &&
        object.y <= bounds.endY
}

function drawTileGridOverlay(context: PixiDrawContext, bounds: ReturnType<typeof getVisibleTileBounds>, cameraScale: number) {
    if (cameraScale <= 0) return

    const left = bounds.startX * tileSize
    const top = bounds.startY * tileSize
    const right = (bounds.endX + 1) * tileSize
    const bottom = (bounds.endY + 1) * tileSize
    const alpha = cameraScale < 0.5 ? 0.17 : cameraScale < 0.9 ? 0.12 : 0.08

    context.save()
    context.strokeStyle = `rgba(58, 49, 35, ${alpha})`
    context.lineWidth = 1 / cameraScale
    context.beginPath()
    for (let x = bounds.startX; x <= bounds.endX + 1; x += 1) {
        const lineX = x * tileSize
        context.moveTo(lineX, top)
        context.lineTo(lineX, bottom)
    }
    for (let y = bounds.startY; y <= bounds.endY + 1; y += 1) {
        const lineY = y * tileSize
        context.moveTo(left, lineY)
        context.lineTo(right, lineY)
    }
    context.stroke()
    context.restore()
}
