import {computed, reactive, ref, watch} from 'vue'
import {getPlantActionLabel as createPlantActionLabel} from '@/game/contextActions'
import {applyFarmTool, isFarmToolValid as isFarmToolValidRule} from '@/game/tileActions'
import type {FarmTool, PlantDefinitionMap, PlantType, Tile} from '@/game/types'

interface UseFarmToolsOptions {
    getLandPlacementActive: () => boolean
    canClearCrop: (tile: Tile) => boolean
    canPlantTile: (tile: Tile) => boolean
    getSeedQuantity: (plant: PlantType) => number
    hideContextMenu: () => void
    hideToolCursor: () => void
    openClearCropDialog: (tile: Tile) => void
    plantCropOnTile: (tile: Tile, plant: PlantType) => void
}

export function useFarmTools(options: UseFarmToolsOptions) {
    const activeFarmTool = ref<FarmTool>('inspect')
    const farmToolBarOpen = ref(false)
    const plantCycle = ref<PlantType[]>([])
    const plantDefinitions = reactive<PlantDefinitionMap>({})
    const plantActionLookup = computed(() => {
        return new Map(plantCycle.value.map((plant) => [getPlantActionLabel(plant), plant]))
    })
    const activeToolIcon = computed(() => {
        const tool = activeFarmTool.value

        return tool === 'inspect' || tool === 'shovel' ? '' : plantDefinitions[tool]?.item.item_emoji ?? '🌱'
    })

    function replacePlantCatalog(nextPlantCycle: PlantType[], nextPlantDefinitions: PlantDefinitionMap) {
        plantCycle.value = [...nextPlantCycle]
        for (const key of Object.keys(plantDefinitions)) {
            delete plantDefinitions[Number(key)]
        }
        Object.assign(plantDefinitions, nextPlantDefinitions)
    }

    function selectFarmTool(tool: FarmTool) {
        if (tool !== 'inspect' && tool !== 'shovel' && !canUsePlantTool(tool)) return

        activeFarmTool.value = tool
        if (tool === 'inspect') options.hideToolCursor()
        options.hideContextMenu()
    }

    function applyActiveFarmTool(tile: Tile) {
        applyFarmTool(tile, activeFarmTool.value, {
            landPlacementActive: options.getLandPlacementActive(),
            plantDefinitions,
            canClearCrop: options.canClearCrop,
            canPlantTile: options.canPlantTile,
            getSeedQuantity: options.getSeedQuantity,
            hideContextMenu: options.hideContextMenu,
            openClearCropDialog: options.openClearCropDialog,
            plantCropOnTile: options.plantCropOnTile,
        })
    }

    function isActiveFarmToolValid(tile: Tile) {
        return isFarmToolValidRule(activeFarmTool.value, tile, {
            plantDefinitions,
            canClearCrop: options.canClearCrop,
            canPlantTile: options.canPlantTile,
            getSeedQuantity: options.getSeedQuantity,
        })
    }

    function getPlantTypeFromAction(action: string) {
        return plantActionLookup.value.get(action) ?? null
    }

    function getPlantActionLabel(plant: PlantType) {
        return createPlantActionLabel(getPlantLabel(plant))
    }

    function getPlantLabel(plant: PlantType) {
        return plantDefinitions[plant]?.item.item_name ?? `作物${plant}`
    }

    function canUsePlantTool(plant: PlantType) {
        return Boolean(plantDefinitions[plant]) && options.getSeedQuantity(plant) > 0
    }

    watch(
        () => {
            const tool = activeFarmTool.value
            if (tool === 'inspect' || tool === 'shovel') return null

            return options.getSeedQuantity(tool)
        },
        (quantity) => {
            if (quantity === null || quantity > 0) return

            resetActiveTool()
        },
        {flush: 'sync'},
    )

    function resetActiveTool() {
        activeFarmTool.value = 'inspect'
        options.hideToolCursor()
    }

    function closeToolBar() {
        farmToolBarOpen.value = false
    }

    return {
        activeFarmTool,
        farmToolBarOpen,
        plantCycle,
        plantDefinitions,
        activeToolIcon,
        replacePlantCatalog,
        selectFarmTool,
        applyActiveFarmTool,
        isActiveFarmToolValid,
        canUsePlantTool,
        getSeedQuantity: options.getSeedQuantity,
        getPlantTypeFromAction,
        getPlantActionLabel,
        getPlantLabel,
        resetActiveTool,
        closeToolBar,
    }
}
