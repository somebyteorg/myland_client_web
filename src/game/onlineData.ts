import api from '@/utils/ky'
import type {OnlineCountResponse, OnlinePlayerListResponse} from '@/game/onlineTypes'

export function loadOnlineCount() {
    return api.get('api/common/online/count').json<OnlineCountResponse>()
}

export function loadOnlinePlayers(options: { playerId?: string | null; pageSize?: number } = {}) {
    const searchParams: Record<string, string | number> = {
        page_size: options.pageSize ?? 20,
    }
    const playerId = options.playerId?.trim()

    if (playerId) searchParams.player_id = playerId

    return api.get('api/common/online/list', {searchParams}).json<OnlinePlayerListResponse>()
}
