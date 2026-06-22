import api from '@/utils/ky'
import type {NeighborInfoResponse, NeighborVisitResponse} from './types'

export function loadNeighborInfo(playerId: string, neighborPlayerId: string) {
    return api.get(
        `api/player/${encodeURIComponent(playerId)}/neighbor/${encodeURIComponent(neighborPlayerId)}/info`,
    ).json<NeighborInfoResponse>()
}

export function visitNeighbor(playerId: string, neighborPlayerId: string) {
    return api.post(
        `api/player/${encodeURIComponent(playerId)}/neighbor/${encodeURIComponent(neighborPlayerId)}/visit`,
    ).json<NeighborVisitResponse>()
}
