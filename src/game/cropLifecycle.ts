import type {CropStatus, Tile} from './types'

export const seedGrowDelayMs = 10 * 60 * 1000

export interface LocalCropState {
    cropStatus: CropStatus
    harvestable: boolean
    status: string
}

export function isCropHarvestableStatus(status: CropStatus | null | undefined) {
    return status === 'harvestable'
}

export function canShowHarvestActionStatus(status: CropStatus | null | undefined) {
    return isCropHarvestableStatus(status) || status === 'withered'
}

export function isCropFinalStatus(status: CropStatus | null | undefined) {
    return isCropHarvestableStatus(status) || status === 'withered'
}

export function normalizeSecondMature(value: number) {
    const seconds = Number(value)

    return Number.isFinite(seconds) ? Math.max(0, seconds) : null
}

export function getCropMaturesAtMs(status: CropStatus, secondMature: number, now = Date.now()) {
    if (isCropFinalStatus(status)) return null

    const seconds = normalizeSecondMature(secondMature)

    return seconds === null ? null : now + seconds * 1000
}

export function getCropGrowsAtMs(status: CropStatus, secondMature: number, now = Date.now()) {
    if (status !== 'seed') return null

    const seconds = normalizeSecondMature(secondMature)
    const delay = seconds === null ? seedGrowDelayMs : Math.min(seedGrowDelayMs, seconds * 1000)

    return now + delay
}

export function getCropStatusLabel(status: CropStatus) {
    if (status === 'seed') return '种子'
    if (status === 'growing') return '生长期'
    if (status === 'harvestable') return '可收获'

    return '已枯萎'
}

export function getLocalCropStatus(tile: Pick<Tile, 'cropStatus' | 'cropMaturesAtMs' | 'cropGrowsAtMs'>, now = Date.now()): CropStatus | null {
    if (!tile.cropStatus) return null
    if (isCropFinalStatus(tile.cropStatus)) return tile.cropStatus

    if (tile.cropMaturesAtMs && now >= tile.cropMaturesAtMs) return 'harvestable'
    if (tile.cropStatus === 'seed' && tile.cropGrowsAtMs && now >= tile.cropGrowsAtMs) return 'growing'

    return tile.cropStatus
}

export function getLocalCropState(
    tile: Pick<Tile, 'cropStatus' | 'cropMaturesAtMs' | 'cropGrowsAtMs'>,
    canHarvest: (status: CropStatus) => boolean,
    now = Date.now(),
): LocalCropState | null {
    const cropStatus = getLocalCropStatus(tile, now)
    if (!cropStatus) return null

    return {
        cropStatus,
        harvestable: canHarvest(cropStatus),
        status: getCropStatusLabel(cropStatus),
    }
}

export function updateLocalCropLifecycle(
    tiles: Tile[],
    canHarvest: (tile: Tile, status: CropStatus) => boolean,
    now = Date.now(),
) {
    let changed = false

    for (const tile of tiles) {
        if (!tile.plant || !tile.cropStatus) continue

        const nextState = getLocalCropState(tile, (status) => canHarvest(tile, status), now)
        if (!nextState) continue

        if (tile.cropStatus !== nextState.cropStatus ||
            tile.harvestable !== nextState.harvestable ||
            tile.status !== nextState.status
        ) {
            tile.cropStatus = nextState.cropStatus
            tile.harvestable = nextState.harvestable
            tile.status = nextState.status
            if (nextState.cropStatus !== 'seed') tile.cropGrowsAtMs = null
            if (isCropFinalStatus(nextState.cropStatus)) tile.cropMaturesAtMs = null
            changed = true
        }
    }

    return changed
}
