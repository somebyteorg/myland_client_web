import api from '@/utils/ky'
import type {ItemInventoryInstanceData} from './types'

export interface ToolCraftRecipe {
    need_item_id: number
    need_quantity: number
}

export interface ToolCraftItem {
    item_id: number
    recipes: ToolCraftRecipe[]
}

export interface ToolCraftListResponse {
    page: number
    page_size: number
    total: number
    items: ToolCraftItem[]
}

export function loadToolCraftItems(playerId: string, page: number, pageSize: number) {
    return api.get('api/item/tool/list', {
        searchParams: {
            player_id: playerId,
            page: String(page),
            page_size: String(pageSize),
        },
    }).json<ToolCraftListResponse>()
}

export function makeTool(playerId: string, makeItemId: number, number: number) {
    return api.post('api/item/tool/make', {
        json: {
            player_id: playerId,
            make_item_id: makeItemId,
            number,
        },
    }).json<unknown>()
}

export function normalizeToolMakeInstances(payload: unknown): ItemInventoryInstanceData[] {
    if (Array.isArray(payload)) return payload as ItemInventoryInstanceData[]
    if (!isRecord(payload)) return []

    for (const key of ['items', 'instances', 'instance', 'data']) {
        const value = payload[key]
        if (Array.isArray(value)) return value as ItemInventoryInstanceData[]
    }

    return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
