import {findNearestTile, getViewportCenterTile} from '@/game/mapCamera'
import type {CameraState, ViewportRect} from '@/game/mapCamera'
import type {MapObject, Tile} from '@/game/types'

interface MapNavigationLike {
    focusMapObject: (object: MapObject, center?: boolean) => void
    focusTile: (tile: Tile, center?: boolean) => void
}

interface UseMapLocatorOptions {
    camera: CameraState
    viewport: ViewportRect
    navigation: MapNavigationLike
    tileAt: (x: number, y: number) => Tile | null
    getTiles: () => Tile[]
    getHomeObject: () => MapObject | null
    getHomeTile: () => Tile | null
    isMapReady: () => boolean
    canPlaceLandAt: (tile: Tile) => boolean
}

export function useMapLocator(options: UseMapLocatorOptions) {
    function locatePlayerLand() {
        const homeObject = options.getHomeObject()
        if (homeObject) {
            options.navigation.focusMapObject(homeObject)
            return
        }

        const tile = options.getHomeTile() ?? options.getTiles().find((item) => item.ownerType === 'player')
        if (!tile) return

        options.navigation.focusTile(tile)
    }

    function locateClaimableLand() {
        const tile = getFirstPlaceableTile()
        if (!tile) return

        options.navigation.focusTile(tile)
    }

    function getFirstPlaceableTile() {
        const center = options.isMapReady() ? getViewportCenterTile(options.tileAt, options.camera, options.viewport) : null

        return findNearestTile(options.getTiles().filter((item) => options.canPlaceLandAt(item)), center)
    }

    return {
        locatePlayerLand,
        locateClaimableLand,
        getFirstPlaceableTile,
    }
}
