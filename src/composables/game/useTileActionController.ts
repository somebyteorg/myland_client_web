import type {Ref} from 'vue'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import type {ClearCropDialogState} from '@/composables/game/useGameDialogs'
import {isNeighborHomeObject} from '@/game/objectRules'
import {BUILD_PLAYER_STATUE_ACTION} from '@/game/contextActions'
import {dispatchTileAction} from '@/game/tileActions'
import type {MapObject, MapRealtimeEvent, ObjectType, PlantType, Tile} from '@/game/types'

interface UseTileActionControllerOptions {
    selectedTile: Ref<Tile | null>
    selectedMapObject: Ref<MapObject | null>
    contextTile: () => Tile | null
    contextObject: () => MapObject | null
    clearCropDialog: ClearCropDialogState
    landPlacementMode: Ref<LandPlacementMode | null>
    claimTokensAvailable: Ref<number>
    deedInventoryAvailable: Ref<number>
    claimSubmitting: Ref<boolean>
    claimMessage: Ref<string>
    claimMessageTone: Ref<'info' | 'error'>
    getMapObjects: () => MapObject[]
    objectsAtTile: (tile: Tile) => MapObject[]
    canFarmTile: (tile: Tile) => boolean
    canHarvestCrop: (tile: Tile) => boolean
    canClearCrop: (tile: Tile) => boolean
    canPlantTile: (tile: Tile) => boolean
    canAbandonTile: (tile: Tile) => boolean
    canRequestPurchase: (tile: Tile) => boolean
    canStealCrop: (tile: Tile) => boolean
    canBuildPlayerStatueTile: (tile: Tile) => boolean
    canClaimHomeTile: (tile: Tile) => boolean
    canClaimDeedTile: (tile: Tile) => boolean
    canUseDeedAt: (tile: Tile) => boolean
    getPlantTypeFromAction: (action: string) => PlantType | null
    hideContextMenu: () => void
    focusTile: (tile: Tile, center?: boolean) => void
    focusMapObject: (object: MapObject, center?: boolean) => void
    openAbandonDialog: (tile: Tile) => void
    openPurchaseDialog: (tile: Tile) => void
    openPlayerStatueDialog: (tile: Tile) => void
    openClaimDialog: (tile: Tile, mode: LandPlacementMode) => void
    openClearCropDialog: (tile: Tile) => void
    closeClearCropDialog: () => void
    plantCropOnTile: (tile: Tile, plant: PlantType) => Promise<void>
    harvestCropOnTile: (tile: Tile) => Promise<boolean>
    clearCropOnTile: (tile: Tile, dialog: ClearCropDialogState, onCleared: () => void) => void
    stealCropOnTile: (tile: Tile) => Promise<boolean>
    submitNeighborVisit: (object: MapObject) => void
    applyMapRealtimeEvent: (event: MapRealtimeEvent) => void
}

export function useTileActionController(options: UseTileActionControllerOptions) {
    async function handleContextAction(action: string) {
        const tile = options.contextTile()
        if (!tile) return

        const object = options.contextObject()
        if (object) options.focusMapObject(object, false)
        else options.focusTile(tile, false)

        if (action === '拜访邻居') {
            if (isNeighborHomeObject(object)) {
                options.submitNeighborVisit(object)
            }
            return
        }

        if (action === BUILD_PLAYER_STATUE_ACTION) {
            if (options.canBuildPlayerStatueTile(tile)) {
                options.hideContextMenu()
                options.openPlayerStatueDialog(tile)
            }
            return
        }

        await handleTileAction(action)
    }

    async function handleTileAction(action: string) {
        await dispatchTileAction(action, {
            tile: options.selectedTile.value,
            hideContextMenu: options.hideContextMenu,
            getPlantTypeFromAction: options.getPlantTypeFromAction,
            canFarmTile: options.canFarmTile,
            canHarvestCrop: options.canHarvestCrop,
            canClearCrop: options.canClearCrop,
            canPlantTile: options.canPlantTile,
            canAbandonTile: options.canAbandonTile,
            canRequestPurchase: options.canRequestPurchase,
            canStealCrop: options.canStealCrop,
            canUseDeedAt: options.canUseDeedAt,
            upgradeObject,
            harvestTile,
            openClearCropDialog,
            plantCrop: plantSelectedCrop,
            openAbandonDialog: options.openAbandonDialog,
            openPurchaseDialog: options.openPurchaseDialog,
            requestStealCrop: stealCrop,
            openDeedClaimDialog,
        })
    }

    function upgradeObject(type: ObjectType) {
        const object = findSelectedObject(type) ?? options.getMapObjects().find((item) => item.type === type)
        if (!object || object.level >= 5) return

        options.applyMapRealtimeEvent({
            type: 'object.updated',
            patch: {
                id: object.id,
                object: {
                    level: Math.min(5, object.level + 1),
                    state: type === 'watchdog' ? 'alert' : object.state,
                },
            },
        })
    }

    function findSelectedObject(type: ObjectType) {
        if (options.selectedMapObject.value?.type === type) return options.selectedMapObject.value

        return options.selectedTile.value ? options.objectsAtTile(options.selectedTile.value).find((item) => item.type === type) ?? null : null
    }

    async function harvestTile(tile: Tile) {
        if (await options.harvestCropOnTile(tile)) {
            options.hideContextMenu()
        }
    }

    async function stealCrop(tile: Tile) {
        if (await options.stealCropOnTile(tile)) {
            options.hideContextMenu()
        }
    }

    function openClaimDialog(tile: Tile) {
        const mode = options.landPlacementMode.value
        if (!mode) return

        openClaimDialogForMode(tile, mode)
    }

    function openClaimDialogForMode(tile: Tile, mode: LandPlacementMode) {
        const canSubmit = mode === 'pioneer'
            ? options.canClaimHomeTile(tile) && options.claimTokensAvailable.value > 0 && !options.claimSubmitting.value
            : options.canClaimDeedTile(tile) && options.deedInventoryAvailable.value > 0 && !options.claimSubmitting.value

        if (!canSubmit) {
            if (mode === 'pioneer' && options.claimTokensAvailable.value <= 0) {
                options.claimMessageTone.value = 'error'
                options.claimMessage.value = '没有可用开拓令'
            } else if (mode === 'deed' && options.deedInventoryAvailable.value <= 0) {
                options.claimMessageTone.value = 'error'
                options.claimMessage.value = '没有可用地契'
            }
            return
        }

        options.openClaimDialog(tile, mode)
    }

    function openDeedClaimDialog(tile: Tile) {
        if (!options.canUseDeedAt(tile)) return

        openClaimDialogForMode(tile, 'deed')
    }

    async function plantSelectedCrop(plant: PlantType) {
        if (!options.selectedTile.value) return

        await options.plantCropOnTile(options.selectedTile.value, plant)
    }

    function openClearCropDialog(tile: Tile) {
        if (!options.canClearCrop(tile)) return

        options.openClearCropDialog(tile)
    }

    function confirmClearTileCrop() {
        const tile = options.clearCropDialog.tile
        if (!tile || options.clearCropDialog.submitting) return

        options.clearCropDialog.submitting = true
        options.clearCropDialog.errorMessage = ''
        options.clearCropOnTile(tile, options.clearCropDialog, options.closeClearCropDialog)
    }

    return {
        handleContextAction,
        handleTileAction,
        upgradeObject,
        harvestTile,
        openClaimDialog,
        openClaimDialogForMode,
        openDeedClaimDialog,
        plantSelectedCrop,
        openClearCropDialog,
        confirmClearTileCrop,
    }
}
