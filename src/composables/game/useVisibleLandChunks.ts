import {
    type ChunkAnchorRect,
    canLoadLandChunks,
    getAlignedLandChunkRequests,
    getLandChunkTargetSize,
    getViewportChunkBounds
} from '@/game/landChunks'
import {tileSize} from '@/game/config'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import type {CameraState, ViewportRect} from '@/game/mapCamera'

interface UseVisibleLandChunksOptions {
    camera: CameraState
    viewport: ViewportRect
    targetSize: number
    apiMaxSize: number
    padding: number | (() => number)
    isMapReady: () => boolean
    getMapWidth: () => number
    getMapHeight: () => number
    getHomeObject: () => ChunkAnchorRect | null
    getLandPlacementMode: () => LandPlacementMode | null
}

export function useVisibleLandChunks(options: UseVisibleLandChunksOptions) {
    function getRequests() {
        const bounds = getViewportBounds(resolvePadding())
        if (!bounds) return []

        return sortChunksByViewportCenter(
            getAlignedLandChunkRequests(bounds, getTargetSize(), options.getMapWidth(), options.getMapHeight()),
        )
    }

    function canLoad() {
        return canLoadLandChunks(options.isMapReady(), options.getHomeObject(), options.getLandPlacementMode())
    }

    function getTargetSize() {
        return getLandChunkTargetSize(options.targetSize, options.apiMaxSize)
    }

    function getViewportBounds(padding = 0) {
        return getViewportChunkBounds({
            mapReady: options.isMapReady(),
            mapWidth: options.getMapWidth(),
            mapHeight: options.getMapHeight(),
            tileSize,
            camera: options.camera,
            viewport: options.viewport,
            padding,
            fallbackAnchor: options.getHomeObject(),
        })
    }

    function resolvePadding() {
        return typeof options.padding === 'function' ? options.padding() : options.padding
    }

    function sortChunksByViewportCenter(chunks: ReturnType<typeof getAlignedLandChunkRequests>) {
        const centerTileX = ((options.viewport.width / 2 - options.camera.x) / options.camera.scale) / tileSize
        const centerTileY = ((options.viewport.height / 2 - options.camera.y) / options.camera.scale) / tileSize

        return chunks.sort((left, right) => {
            return getChunkDistanceToPoint(left, centerTileX, centerTileY) - getChunkDistanceToPoint(right, centerTileX, centerTileY)
        })
    }

    return {
        getRequests,
        canLoad,
        getTargetSize,
        getViewportBounds,
    }
}

function getChunkDistanceToPoint(chunk: { x: number; y: number; w: number; h: number }, x: number, y: number) {
    const centerX = chunk.x + chunk.w / 2
    const centerY = chunk.y + chunk.h / 2
    const dx = centerX - x
    const dy = centerY - y

    return dx * dx + dy * dy
}
