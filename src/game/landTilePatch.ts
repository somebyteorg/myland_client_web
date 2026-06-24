import {resolveThemeColor} from './colorUtils'
import {toOwnerType} from './ownerTypes'
import {
    getCropGrowsAtMs,
    getCropMaturesAtMs,
    getCropStatusLabel,
    isCropHarvestableStatus,
    normalizeSecondMature,
} from './cropLifecycle'
import {objectsAtTile} from './tileRules'
import {createEmptyCropPatch, createHomeTilePatch} from './tileState'
import type {MapLandChunkItem, MapObject, OwnerType, PlantType, Tile, TilePatchValue} from './types'

export interface LandTilePatchOptions {
    currentPlayerId?: string | null
    currentPlayerName?: string | null
    homeObject?: MapObject | null
    mapObjects: MapObject[]
    getPlantLabel: (plant: PlantType) => string
}

export interface ApplyLandChunkOptions extends LandTilePatchOptions {
    tileAt: (x: number, y: number) => Tile | null
    shouldRebuildRenderedMap: (patch: { x: number; y: number; tile: TilePatchValue }) => boolean
    onTilePatched?: (tile: Tile) => void
}

export function applyLandChunkTilePatches(items: MapLandChunkItem[], options: ApplyLandChunkOptions) {
    let needsRenderedMapRebuild = false
    const patchedTiles: Tile[] = []

    for (const item of items) {
        const tile = options.tileAt(item.x, item.y)
        if (!tile) continue

        const patch = createTilePatchFromMapLand(item, tile, options)
        if (options.shouldRebuildRenderedMap({x: tile.x, y: tile.y, tile: patch})) {
            needsRenderedMapRebuild = true
        }
        Object.assign(tile, patch)
        patchedTiles.push(tile)
        options.onTilePatched?.(tile)
    }

    return {
        needsRenderedMapRebuild,
        patchedTiles,
    }
}

export function createTilePatchFromMapLand(item: MapLandChunkItem, tile: Tile, options: LandTilePatchOptions): TilePatchValue {
    const ownerType = toOwnerType(item.owner_type, item.owner_data?.player_id, options.currentPlayerId)
    const owner = getLandOwnerName(item, ownerType, options)
    const ownerPlayerId = item.owner_data?.player_id ?? null
    const isHomeTile = tile.terrain === 'home' || objectsAtTile(tile, options.mapObjects).some((object) => object.type === 'home')
    const themeColor = getLandThemeColor(item, ownerType, tile, options)
    const name = item.land_name?.trim() || getLandTileName(tile, ownerType, owner, isHomeTile)
    const basePatch = {
        landId: item.land_id,
        landName: item.land_name,
        landQuality: item.land_quality,
        ownerPlayerId,
        ownerType,
        owner,
        themeColor,
        name,
        fertility: Math.max(tile.fertility, ownerType === 'player' ? 58 : 46),
        security: Math.max(tile.security, ownerType === 'player' ? 60 : 42),
    }

    if (isHomeTile) {
        return {
            ...basePatch,
            ...createHomeTilePatch(tile, {
                ownerType,
                owner,
                ownerPlayerId,
                themeColor,
                name,
            }),
        }
    }

    return {
        ...basePatch,
        terrain: 'field',
        ...createCropPatchFromMapLandCrop(item.crop, ownerType, options.getPlantLabel),
    }
}

function createCropPatchFromMapLandCrop(
    crop: MapLandChunkItem['crop'],
    ownerType: OwnerType,
    getPlantLabel: (plant: PlantType) => string,
): TilePatchValue {
    if (!crop) return createEmptyCropPatch('待播种')

    return {
        cropId: crop.crop_id,
        cropStatus: crop.crop_status,
        cropPlantedAt: crop.tick_planted_format,
        cropSecondMature: normalizeSecondMature(crop.second_mature),
        cropMaturesAtMs: getCropMaturesAtMs(crop.crop_status, crop.second_mature),
        cropGrowsAtMs: getCropGrowsAtMs(crop.crop_status, crop.second_mature),
        cropYieldExpected: crop.yield_expected,
        isCanStolen: crop.is_can_stolen,
        plant: crop.item_id,
        crop: getPlantLabel(crop.item_id),
        harvestable: ownerType === 'player' && isCropHarvestableStatus(crop.crop_status),
        status: getCropStatusLabel(crop.crop_status),
        yield: crop.yield_expected,
        theft: null,
    }
}

function getLandOwnerName(item: MapLandChunkItem, ownerType: OwnerType, options: LandTilePatchOptions) {
    const explicitName = item.owner_data?.name?.trim()
    if (explicitName) return explicitName
    if (ownerType === 'player') return options.currentPlayerName ?? '我'
    if (ownerType === 'village') return '村落'
    if (ownerType === 'none') return '无主'

    const playerId = item.owner_data?.player_id?.trim()
    const knownName = getKnownPlayerName(playerId, options.mapObjects)
    if (knownName) return knownName

    return playerId || '邻居'
}

function getKnownPlayerName(playerId: string | null | undefined, mapObjects: MapObject[]) {
    if (!playerId) return ''

    return mapObjects.find((object) => object.ownerData?.player_id === playerId)?.ownerData?.name?.trim() ?? ''
}

function getLandThemeColor(item: MapLandChunkItem, ownerType: OwnerType, tile: Tile, options: LandTilePatchOptions) {
    if (item.owner_data?.color) return resolveThemeColor(item.owner_data.color)
    if (ownerType === 'player' && options.homeObject) return getObjectThemeColor(options.homeObject)

    const playerId = item.owner_data?.player_id
    const knownOwnerObject = playerId ? options.mapObjects.find((object) => object.ownerData?.player_id === playerId) : null

    return knownOwnerObject ? getObjectThemeColor(knownOwnerObject) : tile.themeColor
}

function getObjectThemeColor(object: MapObject) {
    return resolveThemeColor(object.ownerData?.color)
}

function getLandTileName(tile: Tile, ownerType: OwnerType, owner: string, isHomeTile: boolean) {
    if (isHomeTile) return `住宅 ${tile.id}`
    if (ownerType === 'player') return `我的地 ${tile.id}`
    if (ownerType === 'neighbor') return `${owner}的田地 ${tile.id}`
    if (ownerType === 'village') return `村落土地 ${tile.id}`

    return `土地 ${tile.id}`
}
