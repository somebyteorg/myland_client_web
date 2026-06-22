import type {OwnerType, Tile, TilePatchValue} from './types'

type EmptyCropPatch = Pick<
    Tile,
    | 'crop'
    | 'cropId'
    | 'cropStatus'
    | 'cropPlantedAt'
    | 'cropSecondMature'
    | 'cropMaturesAtMs'
    | 'cropGrowsAtMs'
    | 'cropYieldExpected'
    | 'isCanStolen'
    | 'plant'
    | 'harvestable'
    | 'status'
    | 'yield'
    | 'theft'
>

interface HomeTilePatchOptions {
    ownerType: OwnerType
    owner: string
    ownerPlayerId?: string | null
    themeColor?: string | null
    name?: string
}

export function createEmptyCropPatch(status: string, crop = '未种植'): EmptyCropPatch {
    return {
        cropId: null,
        cropStatus: null,
        cropPlantedAt: null,
        cropSecondMature: null,
        cropMaturesAtMs: null,
        cropGrowsAtMs: null,
        cropYieldExpected: null,
        isCanStolen: false,
        plant: null,
        crop,
        harvestable: false,
        status,
        yield: 0,
        theft: null,
    }
}

export function createHomeTilePatch(tile: Pick<Tile, 'id'>, options: HomeTilePatchOptions): TilePatchValue {
    return {
        terrain: 'home',
        ownerType: options.ownerType,
        owner: options.owner,
        ownerPlayerId: options.ownerPlayerId ?? null,
        themeColor: options.themeColor,
        name: options.name ?? `住宅 ${tile.id}`,
        ...createEmptyCropPatch('住宅', '住宅'),
    }
}

export function createUnclaimedGrassPatch(tile: Pick<Tile, 'id'>): TilePatchValue {
    return {
        terrain: 'grass',
        ownerType: 'none',
        owner: '无主',
        ownerPlayerId: null,
        themeColor: null,
        landId: null,
        landName: null,
        landQuality: null,
        name: `草地 ${tile.id}`,
        ...createEmptyCropPatch('未开拓', '未开拓草地'),
    }
}
