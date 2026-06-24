import api from '@/utils/ky'
import {useSignStore} from '@/stores/sign'
import {MAP_FILE_ID_NAMELESS} from '@/constants'
import {createBaseMapJson, createBaseTerrainLookup} from './baseMapUtils'
import type {LandChunkRequest} from './landChunks'
import type {BaseTerrain, MapItemResponse, MapPlayerHomeItem, MapTerrainResponse} from './types'

let baseTerrainAt = (_x: number, _y: number): BaseTerrain => 'mountain'

export async function loadBaseMap(mapId: number = MAP_FILE_ID_NAMELESS) {
    const response = await api.get(`api/map/${mapId}/terrain`).json<MapTerrainResponse>()
    const nextBaseMap = createBaseMapJson(response)

    baseTerrainAt = createBaseTerrainLookup(nextBaseMap)

    return nextBaseMap
}

export async function loadMapItems(mapId: number = MAP_FILE_ID_NAMELESS, rect?: LandChunkRequest, signal?: AbortSignal) {
    const sign = useSignStore()
    const searchParams: Record<string, string> = {
        player_id: sign.player_id,
    }

    if (rect) {
        searchParams.x = String(rect.x)
        searchParams.y = String(rect.y)
        searchParams.w = String(rect.w)
        searchParams.h = String(rect.h)
    }

    return api.get(`api/map/${mapId}/item`, {
        searchParams,
        signal,
    }).json<MapItemResponse[]>()
}

export async function loadMapPlayerHome(playerId: string, mapId: number = MAP_FILE_ID_NAMELESS) {
    return api.get(`api/map/${encodeURIComponent(String(mapId))}/plyaer/${encodeURIComponent(playerId)}/home`)
        .json<MapPlayerHomeItem[]>()
}

export function isRiverTile(x: number, y: number) {
    return baseTerrainAt(x, y) === 'water'
}
