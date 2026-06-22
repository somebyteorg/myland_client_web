import api from '@/utils/ky'
import type {MapItemResponse} from '@/game/types'

export interface CreatePlayerStatuePayload {
    player_id: string
    x: number
    y: number
    statue_name: string
    statue_url: string
}

export interface CreatePlayerStatueResponse {
    count_statue: number
    item_data?: MapItemResponse
}

export function createPlayerStatue(mapId: number, payload: CreatePlayerStatuePayload) {
    return api.post(`api/map/${encodeURIComponent(String(mapId))}/land/playerStatue`, {
        json: payload,
    }).json<CreatePlayerStatueResponse>()
}
