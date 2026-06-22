import {tileSize} from './config'
import type {TileBounds} from './landChunks'
import type {MapObject, Tile} from './types'

export interface CameraState {
    x: number
    y: number
    scale: number
}

export interface ViewportRect {
    left: number
    top: number
    width: number
    height: number
}

export interface WorldPoint {
    x: number
    y: number
}

export function getVisibleTileBounds(
    camera: CameraState,
    viewportWidth: number,
    viewportHeight: number,
    mapWidth: number,
    mapHeight: number,
    padding = 2,
): TileBounds {
    return {
        startX: Math.max(0, Math.floor((-camera.x / camera.scale) / tileSize) - padding),
        startY: Math.max(0, Math.floor((-camera.y / camera.scale) / tileSize) - padding),
        endX: Math.min(mapWidth - 1, Math.ceil(((viewportWidth - camera.x) / camera.scale) / tileSize) + padding),
        endY: Math.min(mapHeight - 1, Math.ceil(((viewportHeight - camera.y) / camera.scale) / tileSize) + padding),
    }
}

export function getWorldPointFromClientPoint(clientX: number, clientY: number, camera: CameraState, bounds: ViewportRect): WorldPoint {
    return {
        x: (clientX - bounds.left - camera.x) / camera.scale,
        y: (clientY - bounds.top - camera.y) / camera.scale,
    }
}

export function getTilePointFromClientPoint(clientX: number, clientY: number, camera: CameraState, bounds: ViewportRect) {
    const worldPoint = getWorldPointFromClientPoint(clientX, clientY, camera, bounds)

    return {
        x: Math.floor(worldPoint.x / tileSize),
        y: Math.floor(worldPoint.y / tileSize),
    }
}

export function getViewportCenterTile(tileAt: (x: number, y: number) => Tile | null, camera: CameraState, bounds: Pick<ViewportRect, 'width' | 'height'>) {
    if (bounds.width <= 0 || bounds.height <= 0) return null

    const worldX = (bounds.width / 2 - camera.x) / camera.scale
    const worldY = (bounds.height / 2 - camera.y) / camera.scale

    return tileAt(Math.floor(worldX / tileSize), Math.floor(worldY / tileSize))
}

export function findNearestTile(tiles: Tile[], anchor: Tile | null) {
    if (!anchor) return tiles[0] ?? null

    return tiles.reduce<Tile | null>((nearest, tile) => {
        if (!nearest) return tile

        return getTileDistanceScore(tile, anchor) < getTileDistanceScore(nearest, anchor) ? tile : nearest
    }, null)
}

function getTileDistanceScore(tile: Tile, anchor: Tile) {
    const dx = tile.x - anchor.x
    const dy = tile.y - anchor.y

    return dx * dx + dy * dy
}

export function getTileCenterCameraPosition(tile: Tile, viewportWidth: number, viewportHeight: number, cameraScale: number) {
    return {
        x: viewportWidth / 2 - (tile.x + 0.5) * tileSize * cameraScale,
        y: viewportHeight / 2 - (tile.y + 0.5) * tileSize * cameraScale,
    }
}

export function getObjectCenterCameraPosition(object: MapObject, viewportWidth: number, viewportHeight: number, cameraScale: number) {
    return {
        x: viewportWidth / 2 - (object.x + object.width / 2) * tileSize * cameraScale,
        y: viewportHeight / 2 - (object.y + object.height / 2) * tileSize * cameraScale,
    }
}

export function getMapCenterCameraPosition(worldWidth: number, worldHeight: number, viewportWidth: number, viewportHeight: number, cameraScale: number) {
    return {
        x: viewportWidth / 2 - worldWidth * cameraScale / 2,
        y: viewportHeight / 2 - worldHeight * cameraScale / 2,
    }
}

export function clampCameraToWorld(camera: CameraState, worldWidth: number, worldHeight: number, viewportWidth: number, viewportHeight: number, padding = 180) {
    const scaledMapWidth = worldWidth * camera.scale
    const scaledMapHeight = worldHeight * camera.scale
    const nextPosition = {x: camera.x, y: camera.y}

    if (scaledMapWidth < viewportWidth) {
        nextPosition.x = (viewportWidth - scaledMapWidth) / 2
    } else {
        nextPosition.x = Math.min(padding, Math.max(viewportWidth - scaledMapWidth - padding, camera.x))
    }

    if (scaledMapHeight < viewportHeight) {
        nextPosition.y = (viewportHeight - scaledMapHeight) / 2
    } else {
        nextPosition.y = Math.min(padding, Math.max(viewportHeight - scaledMapHeight - padding, camera.y))
    }

    return nextPosition
}

export function getZoomedCameraState(
    camera: CameraState,
    clientX: number,
    clientY: number,
    factor: number,
    bounds: ViewportRect,
    minScale: number,
    maxScale: number,
): CameraState {
    const nextScale = Math.min(maxScale, Math.max(minScale, camera.scale * factor))
    const worldX = (clientX - bounds.left - camera.x) / camera.scale
    const worldY = (clientY - bounds.top - camera.y) / camera.scale

    return {
        x: clientX - bounds.left - worldX * nextScale,
        y: clientY - bounds.top - worldY * nextScale,
        scale: nextScale,
    }
}

export function getCameraPositionFromMinimapPoint(
    clientX: number,
    clientY: number,
    cameraScale: number,
    minimapBounds: ViewportRect,
    mainBounds: Pick<ViewportRect, 'width' | 'height'>,
    worldWidth: number,
    worldHeight: number,
) {
    const x = ((clientX - minimapBounds.left) / minimapBounds.width) * worldWidth
    const y = ((clientY - minimapBounds.top) / minimapBounds.height) * worldHeight

    return {
        x: mainBounds.width / 2 - x * cameraScale,
        y: mainBounds.height / 2 - y * cameraScale,
    }
}
