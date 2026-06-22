import {
    canLoadLandChunks,
    getAlignedLandChunkRequests,
    getLandChunkTargetSize,
    getViewportChunkBounds
} from '@/game/landChunks'
import {tileSize} from '@/game/config'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import type {CameraState, ViewportRect} from '@/game/mapCamera'
import type {MapObject} from '@/game/types'

interface UseVisibleLandChunksOptions {
    camera: CameraState
    viewport: ViewportRect
    targetSize: number
    apiMaxSize: number
    padding: number
    isMapReady: () => boolean
    getMapWidth: () => number
    getMapHeight: () => number
    getHomeObject: () => MapObject | null
    getLandPlacementMode: () => LandPlacementMode | null
}

export function useVisibleLandChunks(options: UseVisibleLandChunksOptions) {
    function getRequests() {
        const bounds = getViewportBounds(options.padding)
        if (!bounds) return []

        return getAlignedLandChunkRequests(bounds, getTargetSize(), options.getMapWidth(), options.getMapHeight())
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

    return {
        getRequests,
        canLoad,
        getTargetSize,
        getViewportBounds,
    }
}
