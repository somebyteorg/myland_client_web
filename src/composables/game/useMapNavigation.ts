import {
    getHomeObjectAtTile,
    getObjectAnchorTile as getMapObjectAnchorTile,
    getPlayerStatueObjectAtTile,
} from '@/game/mapObjectData'
import {
    clampCameraToWorld,
    getMapCenterCameraPosition,
    getObjectCenterCameraPosition,
    getTileCenterCameraPosition,
    getTilePointFromClientPoint,
    getZoomedCameraState,
    type CameraState,
    type ViewportRect,
} from '@/game/mapCamera'
import type {MapObject, Tile} from '@/game/types'

interface SelectedTileRef {
    value: Tile | null
}

interface SelectedObjectRef {
    value: MapObject | null
}

interface UseMapNavigationOptions {
    camera: CameraState
    selectedTile: SelectedTileRef
    selectedMapObject: SelectedObjectRef
    getCanvas: () => HTMLCanvasElement | null
    getMainBounds: () => ViewportRect
    getWorldWidth: () => number
    getWorldHeight: () => number
    isMapReady: () => boolean
    tileAt: () => (x: number, y: number) => Tile | null
    getMapObjects: () => MapObject[]
    minScale: number
    maxScale: number
    requestDraw: () => void
}

export function useMapNavigation(options: UseMapNavigationOptions) {
    function getTileFromClientPoint(clientX: number, clientY: number) {
        if (!options.getCanvas() || !options.isMapReady()) return null

        const tilePoint = getTilePointFromClientPoint(clientX, clientY, options.camera, options.getMainBounds())

        return options.tileAt()(tilePoint.x, tilePoint.y)
    }

    function getHomeObjectFromClientPoint(clientX: number, clientY: number) {
        if (!options.getCanvas() || !options.isMapReady()) return null

        const {
            x: tileX,
            y: tileY
        } = getTilePointFromClientPoint(clientX, clientY, options.camera, options.getMainBounds())

        return getHomeObjectAtTile(options.getMapObjects(), tileX, tileY)
    }

    function getPlayerStatueObjectFromClientPoint(clientX: number, clientY: number) {
        if (!options.getCanvas() || !options.isMapReady()) return null

        const {
            x: tileX,
            y: tileY
        } = getTilePointFromClientPoint(clientX, clientY, options.camera, options.getMainBounds())

        return getPlayerStatueObjectAtTile(options.getMapObjects(), tileX, tileY)
    }

    function getObjectAnchorTile(object: MapObject) {
        return getMapObjectAnchorTile(object, options.tileAt())
    }

    function getPointedTileAndHome(clientX: number, clientY: number) {
        const homeObject = getHomeObjectFromClientPoint(clientX, clientY) ?? getPlayerStatueObjectFromClientPoint(clientX, clientY)
        const tile = homeObject ? getObjectAnchorTile(homeObject) : getTileFromClientPoint(clientX, clientY)

        return {homeObject, tile}
    }

    function zoomAt(clientX: number, clientY: number, factor: number) {
        const canvas = options.getCanvas()
        if (!canvas || !options.isMapReady()) return

        const mainBounds = options.getMainBounds()
        const nextCamera = getZoomedCameraState(options.camera, clientX, clientY, factor, mainBounds, options.minScale, options.maxScale)

        options.camera.scale = nextCamera.scale
        options.camera.x = nextCamera.x
        options.camera.y = nextCamera.y
        clampCamera(mainBounds.width, mainBounds.height)
        options.requestDraw()
    }

    function focusTile(tile: Tile, center = true) {
        options.selectedTile.value = tile
        options.selectedMapObject.value = null

        const canvas = options.getCanvas()
        if (!canvas) {
            options.requestDraw()
            return
        }

        if (center) {
            centerOnTile(tile)
            const mainBounds = options.getMainBounds()
            clampCamera(mainBounds.width, mainBounds.height)
        }

        options.requestDraw()
    }

    function focusMapObject(object: MapObject, center = true) {
        const tile = getObjectAnchorTile(object)
        if (tile) options.selectedTile.value = tile
        options.selectedMapObject.value = object

        const canvas = options.getCanvas()
        if (!canvas) {
            options.requestDraw()
            return
        }

        if (center) {
            centerOnObject(object)
            const mainBounds = options.getMainBounds()
            clampCamera(mainBounds.width, mainBounds.height)
        }

        options.requestDraw()
    }

    function centerOnTile(tile: Tile) {
        const mainBounds = options.getMainBounds()
        const nextPosition = getTileCenterCameraPosition(tile, mainBounds.width, mainBounds.height, options.camera.scale)
        options.camera.x = nextPosition.x
        options.camera.y = nextPosition.y
    }

    function centerOnObject(object: MapObject) {
        const mainBounds = options.getMainBounds()
        const nextPosition = getObjectCenterCameraPosition(object, mainBounds.width, mainBounds.height, options.camera.scale)
        options.camera.x = nextPosition.x
        options.camera.y = nextPosition.y
    }

    function centerOnMapCenter() {
        const mainBounds = options.getMainBounds()
        const nextPosition = getMapCenterCameraPosition(options.getWorldWidth(), options.getWorldHeight(), mainBounds.width, mainBounds.height, options.camera.scale)
        options.camera.x = nextPosition.x
        options.camera.y = nextPosition.y
    }

    function clampToCanvas() {
        const canvas = options.getCanvas()
        if (!canvas) return

        const mainBounds = options.getMainBounds()
        clampCamera(mainBounds.width, mainBounds.height)
    }

    function clampCamera(width: number, height: number) {
        if (!options.isMapReady()) return

        const nextPosition = clampCameraToWorld(options.camera, options.getWorldWidth(), options.getWorldHeight(), width, height)
        options.camera.x = nextPosition.x
        options.camera.y = nextPosition.y
    }

    return {
        getTileFromClientPoint,
        getHomeObjectFromClientPoint,
        getPlayerStatueObjectFromClientPoint,
        getObjectAnchorTile,
        getPointedTileAndHome,
        zoomAt,
        focusTile,
        focusMapObject,
        centerOnTile,
        centerOnObject,
        centerOnMapCenter,
        clampToCanvas,
        clampCamera,
    }
}
