import {computed, type Ref} from 'vue'
import type {LandPlacementMode} from './useLandClaims'

interface ClaimDialogLike {
    visible: boolean
    errorMessage: string
}

interface UseClaimBannerOptions {
    landPlacementMode: Ref<LandPlacementMode | null>
    claimSubmitting: Ref<boolean>
    claimInventoryLoading: Ref<boolean>
    claimMessage: Ref<string>
    claimDialog: ClaimDialogLike
    claimTokensAvailable: Ref<number>
    deedInventoryAvailable: Ref<number>
}

export function useClaimBanner(options: UseClaimBannerOptions) {
    const showClaimBanner = computed(() => {
        if (!options.landPlacementMode.value) return false

        return !(options.claimDialog.visible && Boolean(options.claimDialog.errorMessage))
    })

    const claimBannerTitle = computed(() => {
        if (options.claimSubmitting.value) return options.landPlacementMode.value === 'deed' ? '正在扩张' : '正在开拓'

        return options.landPlacementMode.value === 'deed' ? '地契扩张' : '开拓模式'
    })

    const claimBannerMessage = computed(() => {
        if (options.claimMessage.value) return options.claimMessage.value
        if (options.claimInventoryLoading.value) return '正在读取开拓令和地契'
        if (options.landPlacementMode.value === 'pioneer' && options.claimTokensAvailable.value <= 0) return '没有可用开拓令，无法设置家园'
        if (options.landPlacementMode.value === 'deed' && options.deedInventoryAvailable.value <= 0) return '没有可用地契，无法扩张领地'
        if (options.landPlacementMode.value === 'deed') return '选择家园周围，或九宫格内有 2 块以上自有土地的空地'

        return '移动房子选择 2x2 空地，点击后确认开拓'
    })

    return {
        showClaimBanner,
        claimBannerTitle,
        claimBannerMessage,
    }
}
