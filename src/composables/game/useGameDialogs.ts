import {reactive} from 'vue'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import type {Tile} from '@/game/types'

interface UseGameDialogsOptions {
    onDialogOpen?: () => void
}

export interface AbandonDialogState {
    visible: boolean
    tile: Tile | null
    submitting: boolean
    errorMessage: string
}

export interface ClearCropDialogState {
    visible: boolean
    tile: Tile | null
    submitting: boolean
    errorMessage: string
}

export interface PurchaseDialogState {
    visible: boolean
    tile: Tile | null
    price: number
}

export interface ClaimDialogState {
    visible: boolean
    tile: Tile | null
    submitting: boolean
    mode: LandPlacementMode | null
    errorMessage: string
}

export function useGameDialogs(options: UseGameDialogsOptions = {}) {
    const abandonDialog = reactive<AbandonDialogState>({
        visible: false,
        tile: null,
        submitting: false,
        errorMessage: '',
    })
    const clearCropDialog = reactive<ClearCropDialogState>({
        visible: false,
        tile: null,
        submitting: false,
        errorMessage: '',
    })
    const purchaseDialog = reactive<PurchaseDialogState>({
        visible: false,
        tile: null,
        price: 100,
    })
    const claimDialog = reactive<ClaimDialogState>({
        visible: false,
        tile: null,
        submitting: false,
        mode: null,
        errorMessage: '',
    })

    function openAbandonDialog(tile: Tile) {
        abandonDialog.tile = tile
        abandonDialog.visible = true
        abandonDialog.submitting = false
        abandonDialog.errorMessage = ''
        options.onDialogOpen?.()
    }

    function closeAbandonDialog() {
        if (abandonDialog.submitting) return

        resetAbandonDialog()
    }

    function resetAbandonDialog() {
        abandonDialog.visible = false
        abandonDialog.tile = null
        abandonDialog.submitting = false
        abandonDialog.errorMessage = ''
    }

    function openClearCropDialog(tile: Tile) {
        clearCropDialog.tile = tile
        clearCropDialog.visible = true
        clearCropDialog.submitting = false
        clearCropDialog.errorMessage = ''
        options.onDialogOpen?.()
    }

    function closeClearCropDialog() {
        if (clearCropDialog.submitting) return

        resetClearCropDialog()
    }

    function resetClearCropDialog() {
        clearCropDialog.visible = false
        clearCropDialog.tile = null
        clearCropDialog.submitting = false
        clearCropDialog.errorMessage = ''
    }

    function openPurchaseDialog(tile: Tile) {
        purchaseDialog.tile = tile
        purchaseDialog.price = 100
        purchaseDialog.visible = true
        options.onDialogOpen?.()
    }

    function closePurchaseDialog() {
        purchaseDialog.visible = false
        purchaseDialog.tile = null
    }

    function setPurchasePrice(price: number) {
        purchaseDialog.price = price
    }

    function openClaimDialog(tile: Tile, mode: LandPlacementMode) {
        claimDialog.tile = tile
        claimDialog.visible = true
        claimDialog.submitting = false
        claimDialog.mode = mode
        claimDialog.errorMessage = ''
        options.onDialogOpen?.()
    }

    function closeClaimDialog() {
        if (claimDialog.submitting) return

        resetClaimDialog()
    }

    function resetClaimDialog() {
        claimDialog.visible = false
        claimDialog.tile = null
        claimDialog.submitting = false
        claimDialog.mode = null
        claimDialog.errorMessage = ''
    }

    function setClaimDialogError(message: string) {
        if (claimDialog.visible) claimDialog.errorMessage = message
    }

    function resetLandActionDialogs() {
        resetAbandonDialog()
        resetClearCropDialog()
        closePurchaseDialog()
        resetClaimDialog()
    }

    return {
        abandonDialog,
        claimDialog,
        clearCropDialog,
        purchaseDialog,
        openAbandonDialog,
        closeAbandonDialog,
        resetAbandonDialog,
        openClearCropDialog,
        closeClearCropDialog,
        resetClearCropDialog,
        openPurchaseDialog,
        closePurchaseDialog,
        setPurchasePrice,
        openClaimDialog,
        closeClaimDialog,
        resetClaimDialog,
        setClaimDialogError,
        resetLandActionDialogs,
    }
}
