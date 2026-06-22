import {canShowHarvestActionStatus, isCropFinalStatus} from './cropLifecycle'
import type {MapObject, Tile} from './types'

type TileRect = Pick<MapObject, 'x' | 'y' | 'width' | 'height' | 'type' | 'level' | 'id' | 'state' | 'ownerType'>
type TileLookup = (x: number, y: number) => Tile | null

export function createTileLookup(tiles: Tile[], width: number, height: number) {
    return (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return null

        return tiles[y * width + x] ?? null
    }
}

export function getNeighbors(tile: Tile, tileAt: TileLookup) {
    return [
        tileAt(tile.x - 1, tile.y),
        tileAt(tile.x + 1, tile.y),
        tileAt(tile.x, tile.y - 1),
        tileAt(tile.x, tile.y + 1),
    ].filter((neighbor): neighbor is Tile => Boolean(neighbor))
}

export function objectsAtTile<T extends Pick<TileRect, 'x' | 'y' | 'width' | 'height'>>(tile: Tile, mapObjects: T[]) {
    return mapObjects.filter((object) => {
        return (
            tile.x >= object.x &&
            tile.x < object.x + object.width &&
            tile.y >= object.y &&
            tile.y < object.y + object.height
        )
    })
}

export function canGrantHomeTile(
    tile: Tile,
    tileAt: TileLookup,
    occupiedObjects: Array<Pick<TileRect, 'x' | 'y' | 'width' | 'height'>>,
    isRiverTile: (x: number, y: number) => boolean,
    rejectMapEdge = true,
) {
    for (let y = tile.y; y < tile.y + 2; y += 1) {
        for (let x = tile.x; x < tile.x + 2; x += 1) {
            const target = tileAt(x, y)
            if (rejectMapEdge && isMapEdgeTile(target, tileAt)) return false
            if (!target || target.terrain !== 'grass' || target.ownerType !== 'none' || isRiverTile(x, y)) return false
            if (objectsAtTile(target, occupiedObjects).length > 0) return false
        }
    }

    return true
}

export function isMapEdgeTile(tile: Tile | null, tileAt: TileLookup) {
    if (!tile) return true

    return (
        !tileAt(tile.x - 1, tile.y) ||
        !tileAt(tile.x + 1, tile.y) ||
        !tileAt(tile.x, tile.y - 1) ||
        !tileAt(tile.x, tile.y + 1)
    )
}

export function canFarmTile(tile: Tile, mapObjects: MapObject[]) {
    return tile.ownerType === 'player' && tile.terrain === 'field' && !objectsAtTile(tile, mapObjects).some((object) => object.type === 'home')
}

export function isTileOccupiedByRect(tile: Tile, rects: Array<Pick<TileRect, 'x' | 'y' | 'width' | 'height'>>) {
    return rects.some((rect) => {
        return tile.x >= rect.x &&
            tile.x < rect.x + rect.width &&
            tile.y >= rect.y &&
            tile.y < rect.y + rect.height
    })
}

export function isAdjacentToOwner(tile: Tile, tileAt: TileLookup, ownerType: Tile['ownerType']) {
    return getNeighbors(tile, tileAt).some((neighbor) => neighbor.ownerType === ownerType)
}

export function canClaimDeedTile(
    tile: Tile,
    options: {
        hasOwnHome: boolean
        tileAt: TileLookup
        occupiedRects: Array<Pick<TileRect, 'x' | 'y' | 'width' | 'height'>>
        mapObjects: TileRect[]
        isRiverTile: (x: number, y: number) => boolean
    },
) {
    if (!options.hasOwnHome) return false
    if (!isAdjacentToOwner(tile, options.tileAt, 'player')) return false
    if (isMapEdgeTile(tile, options.tileAt)) return false
    if (tile.terrain !== 'grass' || tile.ownerType !== 'none' || options.isRiverTile(tile.x, tile.y)) return false
    if (isTileOccupiedByRect(tile, options.occupiedRects)) return false

    return objectsAtTile(tile, options.mapObjects).length === 0
}

export function canBuildPlayerStatueTile(
    tile: Tile,
    options: {
        tileAt: TileLookup
        occupiedRects: Array<Pick<TileRect, 'x' | 'y' | 'width' | 'height'>>
        mapObjects: TileRect[]
        isRiverTile: (x: number, y: number) => boolean
    },
) {
    const target = options.tileAt(tile.x, tile.y)
    if (!target) return false
    if (target.terrain !== 'grass' || target.ownerType !== 'none' || target.plant || target.landId) return false
    if (options.isRiverTile(target.x, target.y)) return false
    if (isTileOccupiedByRect(target, options.occupiedRects)) return false
    if (objectsAtTile(target, options.mapObjects).length > 0) return false

    return true
}

export function canPlantTile(tile: Tile, canFarm: (tile: Tile) => boolean) {
    return canFarm(tile) && !tile.plant && Boolean(tile.landId)
}

export function canClearCrop(tile: Tile, canFarm: (tile: Tile) => boolean) {
    return canFarm(tile) && Boolean(tile.plant) && Boolean(tile.landId)
}

export function canHarvestCrop(tile: Tile, canFarm: (tile: Tile) => boolean) {
    return canFarm(tile) && Boolean(tile.plant) && Boolean(tile.landId) && canShowHarvestActionStatus(tile.cropStatus)
}

export function canAbandonTile(tile: Tile, tileAt: TileLookup) {
    return tile.ownerType === 'player' && tile.terrain === 'field' && isAdjacentToOwner(tile, tileAt, 'player')
}

export function canRequestPurchase(tile: Tile, tileAt: TileLookup) {
    return tile.ownerType === 'neighbor' && tile.terrain === 'field' && isAdjacentToOwner(tile, tileAt, 'player')
}

export function canStealCrop(tile: Tile) {
    return tile.ownerType !== 'player' && tile.isCanStolen
}

export function getPlantRemainingMs(tile: Tile, now = Date.now()) {
    if (!tile.plant || !tile.cropStatus) return 0
    if (isCropFinalStatus(tile.cropStatus)) return 0
    if (!tile.cropMaturesAtMs) return 0

    return Math.max(0, tile.cropMaturesAtMs - now)
}

export function formatRemain(ms: number) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`
}
