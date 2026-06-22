import {
    getCropGrowsAtMs,
    getCropMaturesAtMs,
    getCropStatusLabel,
    isCropHarvestableStatus,
    normalizeSecondMature,
} from './cropLifecycle'
import type {LandCropPlantingResponse, PlantType, Tile, TilePatchValue} from './types'

export function createPlantingPatch(
    tile: Tile,
    plant: PlantType,
    response: LandCropPlantingResponse,
    options: {
        canFarmTile: (tile: Tile) => boolean
        getPlantLabel: (plant: PlantType) => string
    },
): TilePatchValue {
    const cropStatus = response.crop_status ?? 'seed'

    return {
        cropId: response.crop_id,
        cropStatus,
        cropPlantedAt: response.tick_planted_format,
        cropSecondMature: normalizeSecondMature(response.second_mature),
        cropMaturesAtMs: getCropMaturesAtMs(cropStatus, response.second_mature),
        cropGrowsAtMs: getCropGrowsAtMs(cropStatus, response.second_mature),
        cropYieldExpected: response.yield_expected,
        isCanStolen: false,
        plant,
        harvestable: tile.ownerType === 'player' && options.canFarmTile(tile) && isCropHarvestableStatus(cropStatus),
        status: getCropStatusLabel(cropStatus),
        crop: options.getPlantLabel(plant),
        yield: response.yield_expected,
        theft: null,
    }
}

export async function ensureTileLandLoaded(
    tile: Tile,
    loadTileLand: (tile: Tile) => Promise<void>,
    tileAt: (x: number, y: number) => Tile | null,
) {
    if (tile.landId) return tile

    await loadTileLand(tile)

    return tileAt(tile.x, tile.y)
}
