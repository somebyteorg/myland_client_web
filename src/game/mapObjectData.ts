import {toOwnerType} from './ownerTypes'
import {PLAYER_STATUE_MIN_FOOTPRINT_SIZE} from './playerStatueConfig'
import type {MapItemOwnerData, MapItemResponse, MapObject, NeighborInfoResponse, Tile} from './types'

export interface MapItemOccupiedRect {
    x: number
    y: number
    width: number
    height: number
}

export function createHomeObjectFromItem(item: MapItemResponse, index: number, currentPlayerId?: string | null): MapObject {
    return {
        id: `map-item-home-${item.x}-${item.y}-${index}`,
        type: 'home',
        x: item.x,
        y: item.y,
        width: Math.max(1, item.width),
        height: Math.max(1, item.height),
        level: Math.max(1, item.level),
        ownerType: toOwnerType(item.owner_type, item.owner_data?.player_id, currentPlayerId),
        ownerData: createMapItemOwnerData(item),
        createdAtString: formatMapItemCreatedAt(item),
    }
}

export function createPlayerStatueObjectFromItem(item: MapItemResponse, index: number, currentPlayerId?: string | null): MapObject {
    return {
        id: `map-item-player-statue-${item.x}-${item.y}-${index}`,
        type: 'player_statue',
        x: item.x,
        y: item.y,
        width: normalizePlayerStatueDimension(item.width),
        height: normalizePlayerStatueDimension(item.height),
        level: Math.max(1, item.level),
        ownerType: toOwnerType(item.owner_type, item.owner_data?.player_id, currentPlayerId),
        ownerData: createMapItemOwnerData(item),
        createdAtString: formatMapItemCreatedAt(item),
        playerStatueName: getPlayerStatueName(item),
        playerStatueUrl: getPlayerStatueUrl(item),
    }
}

export function createMapObjectsFromItems(items: MapItemResponse[], currentPlayerId?: string | null) {
    const objects: MapObject[] = []

    for (const [index, item] of items.entries()) {
        if (item.item_type === 'home') {
            objects.push(createHomeObjectFromItem(item, index, currentPlayerId))
        } else if (item.item_type === 'player_statue') {
            objects.push(createPlayerStatueObjectFromItem(item, index, currentPlayerId))
        }
    }

    return objects
}

export function createOccupiedRectsFromItems(items: MapItemResponse[]): MapItemOccupiedRect[] {
    return items
        .filter((item) => item.item_type === 'player_statue' || (item.width > 0 && item.height > 0))
        .map((item) => ({
            x: item.x,
            y: item.y,
            width: item.item_type === 'player_statue' ? normalizePlayerStatueDimension(item.width) : normalizeMapItemDimension(item.width),
            height: item.item_type === 'player_statue' ? normalizePlayerStatueDimension(item.height) : normalizeMapItemDimension(item.height),
        }))
}

export function createMapItemOwnerData(item: MapItemResponse): MapItemOwnerData {
    return {
        ...item.owner_data,
        count_visit: Number(item.count_visit ?? item.owner_data.count_visit),
    }
}

export function createOwnerDataFromNeighborInfo(info: NeighborInfoResponse): MapItemOwnerData {
    return {
        player_id: info.player_id,
        name: info.name,
        gender: info.gender,
        gender_string: info.gender_string,
        avatar: info.avatar,
        tick_age: info.tick_age,
        tick_age_string: info.tick_age_string,
        color: info.color,
        manifesto: info.manifesto,
        count_visit: info.count_visit,
        tick_last_visit: info.tick_last_visit,
        count_visit_view: info.count_visit_view,
        count_land: info.count_land,
    }
}

export function mergeMapObjectOwnerData(object: MapObject, patch: Partial<MapItemOwnerData>) {
    const affectsMap = 'name' in patch || 'color' in patch
    const nextPatch = {...patch}

    if (nextPatch.count_visit === null || nextPatch.count_visit === undefined) {
        delete nextPatch.count_visit
    }

    object.ownerData = {
        ...object.ownerData,
        ...nextPatch,
    }

    return {affectsMap}
}

export function getHomeObjectAtTile(mapObjects: MapObject[], tileX: number, tileY: number) {
    return mapObjects.find((object) => {
        return object.type === 'home' &&
            tileX >= object.x &&
            tileX < object.x + object.width &&
            tileY >= object.y &&
            tileY < object.y + object.height
    }) ?? null
}

export function getPlayerStatueObjectAtTile(mapObjects: MapObject[], tileX: number, tileY: number) {
    return mapObjects.find((object) => {
        return object.type === 'player_statue' &&
            tileX >= object.x &&
            tileX < object.x + object.width &&
            tileY >= object.y &&
            tileY < object.y + object.height
    }) ?? null
}

export function getObjectAnchorTile(object: MapObject, tileAt: (x: number, y: number) => Tile | null) {
    return tileAt(object.x, object.y)
}

function formatMapItemCreatedAt(item: MapItemResponse) {
    const time = item.tick_created_format
    if (!time) return null

    if (time.string?.trim()) return time.string.trim()

    return `地元${time.year}年${time.season} · 第${time.day}日 · ${time.hour}`
}

function getPlayerStatueName(item: MapItemResponse) {
    return item.item_data?.player_statue_name?.trim() || item.item_name?.trim() || null
}

function getPlayerStatueUrl(item: MapItemResponse) {
    return item.item_data?.player_statue_url?.trim() || null
}

function normalizeMapItemDimension(value: number) {
    return Number.isFinite(value) ? Math.max(1, value) : 1
}

function normalizePlayerStatueDimension(value: number) {
    return Math.max(PLAYER_STATUE_MIN_FOOTPRINT_SIZE, normalizeMapItemDimension(value))
}
