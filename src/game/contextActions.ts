import type {MapObject, PlantType, Tile} from './types'

type ActionObject = Pick<MapObject, 'type' | 'level'>

export function getPlantActionLabel(plantLabel: string) {
    return `播种${plantLabel}`
}

export const BUILD_PLAYER_STATUE_ACTION = '建立雕像'

export function getTileContextActions(
    tile: Tile,
    object: MapObject | null,
    options: {
        landPlacementMode: boolean
        plantCycle: PlantType[]
        canUseDeedAt: (tile: Tile) => boolean
        canFarmTile: (tile: Tile) => boolean
        canHarvestCrop: (tile: Tile) => boolean
        canClearCrop: (tile: Tile) => boolean
        canPlantTile: (tile: Tile) => boolean
        canUsePlantSeed: (plant: PlantType) => boolean
        canAbandonTile: (tile: Tile) => boolean
        canStealCrop: (tile: Tile) => boolean
        canRequestPurchase: (tile: Tile) => boolean
        canBuildPlayerStatueTile: (tile: Tile) => boolean
        getObjectsAtTile: (tile: Tile) => ActionObject[]
        getPlantLabel: (plant: PlantType) => string
    },
) {
    if (tile.terrain === 'mountain' || tile.terrain === 'water') return []

    const actions: string[] = []

    if (options.landPlacementMode) {
        if (options.canUseDeedAt(tile)) return ['扩张']

        return actions
    }

    if (options.canUseDeedAt(tile)) actions.push('扩张')
    if (!object && options.canBuildPlayerStatueTile(tile)) actions.push(BUILD_PLAYER_STATUE_ACTION)
    if (object?.type === 'player_statue') return actions

    if (tile.ownerType === 'player') {
        // const actionObjects = object ? [object] : options.getObjectsAtTile(tile)
        // for (const actionObject of actionObjects) {
        //     if (!upgradableObjectTypes.has(actionObject.type)) continue
        //     if (actionObject.level < 5) actions.push(`升级${objectLabels[actionObject.type]}`)
        // }

        if (options.canFarmTile(tile)) {
            if (options.canHarvestCrop(tile)) actions.push('收获')
            if (options.canClearCrop(tile)) actions.push('铲除作物')
            if (options.canPlantTile(tile)) {
                for (const plant of options.plantCycle) {
                    if (options.canUsePlantSeed(plant)) {
                        actions.push(getPlantActionLabel(options.getPlantLabel(plant)))
                    }
                }
            }
        }
        if (options.canAbandonTile(tile)) actions.push('荒废土地')

        return actions
    }

    if (tile.ownerType === 'neighbor') {
        if (options.canStealCrop(tile)) actions.push('偷取作物')
        // if (options.canRequestPurchase(tile)) actions.push('申请购买土地')
        if (tile.terrain === 'home') actions.push('拜访邻居')
    }

    return actions
}
