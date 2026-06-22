import type {Ref} from 'vue'
import type {LandPlacementMode} from './useLandClaims'

interface UseMapKeyboardShortcutsOptions {
    landPlacementMode: Ref<LandPlacementMode | null>
    claimSubmitting: Ref<boolean>
    pioneerPlacementActive: Ref<boolean>
    deedPlacementActive: Ref<boolean>
    setLandPlacementUi: (enabled: boolean) => void
    resetActiveTool: () => void
    hideClaimPreview: () => void
    closeAbandonDialog: () => void
    closeClaimDialog: () => void
    closeClearCropDialog: () => void
    hideHomeHoverCard: () => void
    hideLandHoverCard: () => void
    hideContextMenu: () => void
}

export function useMapKeyboardShortcuts(options: UseMapKeyboardShortcutsOptions) {
    function handleKeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape') return

        if (options.landPlacementMode.value && !options.claimSubmitting.value) {
            options.pioneerPlacementActive.value = false
            options.deedPlacementActive.value = false
            options.setLandPlacementUi(false)
            return
        }

        options.resetActiveTool()
        options.hideClaimPreview()
        options.closeAbandonDialog()
        options.closeClaimDialog()
        options.closeClearCropDialog()
        options.hideHomeHoverCard()
        options.hideLandHoverCard()
        options.hideContextMenu()
    }

    return {
        handleKeydown,
    }
}
