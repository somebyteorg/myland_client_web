import api from '@/utils/ky'

export interface ResourceItem {
    resource_id: number
    resource_type: string
    resource_type_string: string
    resource_level: number
    player_max: number
    player_current: number
    capacity_current: number
    recovery_hour: number
    conversion_rate: number
    efficiency: number
    item_id_required: number | null
    item_id_target: number
}

export interface ResourceListResponse {
    page: number
    page_size: number
    total: number
    items: ResourceItem[]
}

export interface ResourceJob {
    resource_id: number
    job_id: number
    cost_grain: number
    gain_expected: number
    second_mature: number
}

export interface ResourceJobListResponse {
    page: number
    page_size: number
    total: number
    items: ResourceJob[]
}

export interface ResourceStartPayload {
    resource_id: number
    grain: number
    item_instance_id?: number
}

export interface ResourceStartResponse {
    job_id: number
    gain_expected: number
    second_mature: number
}

export interface ResourceClaimResponse {
    item_id: number
    gain_actual: number
}

export type ResourceJobPayload = ResourceJob | ResourceJob[] | ResourceJobListResponse | null

export function loadResourceList(mapId: number, page: number, pageSize: number) {
    return api.get('api/resource/list', {
        searchParams: {
            map_id: String(mapId),
            page: String(page),
            page_size: String(pageSize),
        },
    }).json<ResourceListResponse>()
}

export function loadPlayerResourceJobs(playerId: string, page: number, pageSize: number) {
    return api.get(`api/resource/player/${encodeURIComponent(playerId)}/job`, {
        searchParams: {
            page: String(page),
            page_size: String(pageSize),
        },
    }).json<ResourceJobPayload>()
}

export function startPlayerResourceJob(playerId: string, payload: ResourceStartPayload) {
    return api.post(`api/resource/player/${encodeURIComponent(playerId)}/start`, {
        json: payload,
    }).json<ResourceStartResponse>()
}

export function claimPlayerResourceJob(playerId: string, resourceId: number, jobId: number) {
    return api.post(`api/resource/player/${encodeURIComponent(playerId)}/claim`, {
        json: {
            resource_id: resourceId,
            job_id: jobId,
        },
    }).json<ResourceClaimResponse>()
}

export function normalizeResourceJobs(payload: ResourceJobPayload): ResourceJob[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload.filter(isResourceJob)
    if (isResourceJob(payload)) return [payload]
    if (Array.isArray(payload.items)) return payload.items.filter(isResourceJob)

    return []
}

function isResourceJob(value: unknown): value is ResourceJob {
    if (!isRecord(value)) return false

    return Number.isFinite(Number(value.resource_id)) && Number.isFinite(Number(value.job_id))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
