import type {FarmTool, ObjectType, PlantDefinitionMap, PlantType, Tile} from './types'

interface TileActionDispatcherOptions {
    tile: Tile | null
    hideContextMenu: () => void
    getPlantTypeFromAction: (action: string) => PlantType | null
    canFarmTile: (tile: Tile) => boolean
    canHarvestCrop: (tile: Tile) => boolean
    canClearCrop: (tile: Tile) => boolean
    canPlantTile: (tile: Tile) => boolean
    canAbandonTile: (tile: Tile) => boolean
    canRequestPurchase: (tile: Tile) => boolean
    canStealCrop: (tile: Tile) => boolean
    canUseDeedAt: (tile: Tile) => boolean
    upgradeObject: (type: ObjectType) => void
    harvestTile: (tile: Tile) => void | Promise<void>
    openClearCropDialog: (tile: Tile) => void
    plantCrop: (plant: PlantType) => void
    openAbandonDialog: (tile: Tile) => void
    openPurchaseDialog: (tile: Tile) => void
    requestStealCrop: (tile: Tile) => void | Promise<void>
    openDeedClaimDialog: (tile: Tile) => void
}

interface FarmToolValidityOptions {
    plantDefinitions: PlantDefinitionMap
    canClearCrop: (tile: Tile) => boolean
    canPlantTile: (tile: Tile) => boolean
    getSeedQuantity: (plant: PlantType) => number
}

interface FarmToolApplyOptions extends FarmToolValidityOptions {
    landPlacementActive: boolean
    hideContextMenu: () => void
    openClearCropDialog: (tile: Tile) => void
    plantCropOnTile: (tile: Tile, plant: PlantType) => void
}

export async function dispatchTileAction(action: string, options: TileActionDispatcherOptions) {
    const tile = options.tile
    if (!tile) return

    if (!shouldKeepContextMenuOpen(action)) options.hideContextMenu()

    if (action.startsWith('升级')) {
        const objectType = getObjectTypeByUpgradeAction(action)
        if (objectType) options.upgradeObject(objectType)
        return
    }

    if (action === '收获' && options.canHarvestCrop(tile)) {
        await options.harvestTile(tile)
        return
    }

    if (action === '铲除作物' && options.canClearCrop(tile)) {
        options.openClearCropDialog(tile)
        return
    }

    const plant = options.getPlantTypeFromAction(action)
    if (plant && options.canPlantTile(tile)) {
        options.plantCrop(plant)
        return
    }

    if (action === '荒废土地' && options.canAbandonTile(tile)) {
        options.openAbandonDialog(tile)
        return
    }

    if (action === '购买土地' && options.canRequestPurchase(tile)) {
        options.openPurchaseDialog(tile)
        return
    }

    if (action === '偷取作物' && options.canStealCrop(tile)) {
        await options.requestStealCrop(tile)
        return
    }

    if (action === '扩张' && options.canUseDeedAt(tile)) {
        options.openDeedClaimDialog(tile)
    }
}

function shouldKeepContextMenuOpen(action: string) {
    return action === '收获' || action === '偷取作物'
}

export function applyFarmTool(tile: Tile, tool: FarmTool, options: FarmToolApplyOptions) {
    if (options.landPlacementActive || tool === 'inspect') return

    options.hideContextMenu()

    if (tool === 'shovel') {
        if (isFarmToolValid(tool, tile, options)) options.openClearCropDialog(tile)
        return
    }

    if (isFarmToolValid(tool, tile, options)) {
        options.plantCropOnTile(tile, tool)
    }
}

export function isFarmToolValid(tool: FarmTool, tile: Tile, options: FarmToolValidityOptions) {
    if (tool === 'inspect') return true
    if (tool === 'shovel') return options.canClearCrop(tile)

    return Boolean(options.plantDefinitions[tool]) && options.getSeedQuantity(tool) > 0 && options.canPlantTile(tile)
}

export function getObjectTypeByUpgradeAction(action: string): ObjectType | null {
    if (action === '升级住宅') return 'home'
    if (action === '升级看门狗') return 'watchdog'
    if (action === '升级稻草人') return 'scarecrow'

    return null
}
