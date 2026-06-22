import api from '@/utils/ky'
import type {
    LandCropClearResponse,
    LandCropHarvestResponse,
    LandCropPlantingResponse,
    LandCropStealResponse,
    MapLandChunkItem,
} from './types'

export function loadMapLandChunk(mapId: number, chunk: { x: number; y: number; w: number; h: number }) {
    return api.get(`api/map/${encodeURIComponent(String(mapId))}/land/chunk`, {
        searchParams: {
            x: String(chunk.x),
            y: String(chunk.y),
            w: String(chunk.w),
            h: String(chunk.h),
        },
    }).json<MapLandChunkItem[]>()
}

export function sowLandCrop(playerId: string, landId: number, itemId: number) {
    return api.post(`api/land/crop/${encodeURIComponent(playerId)}/${encodeURIComponent(String(landId))}/sow`, {
        json: {
            item_id: itemId,
            quantity: 1,
        },
    }).json<LandCropPlantingResponse>()
}

export function clearLandCrop(playerId: string, landId: number) {
    return api.delete(`api/land/crop/${encodeURIComponent(playerId)}/${encodeURIComponent(String(landId))}/clear`)
        .json<LandCropClearResponse>()
}

export function harvestLandCrop(playerId: string, landId: number, cropId: number) {
    return api.post(`api/land/crop/${encodeURIComponent(playerId)}/${encodeURIComponent(String(landId))}/harvest`, {
        json: {
            crop_id: cropId,
        },
    }).json<LandCropHarvestResponse>()
}

export function stealLandCrop(playerId: string, landId: number, cropId: number) {
    return api.post(`api/land/crop/${encodeURIComponent(playerId)}/${encodeURIComponent(String(landId))}/steal`, {
        json: {
            crop_id: cropId,
        },
    }).json<LandCropStealResponse>()
}
