import type {PurchaseDialogState} from '@/composables/game/useGameDialogs'
import type {Tile} from '@/game/types'

interface UseTileRequestsOptions {
    purchaseDialog: PurchaseDialogState
    canRequestPurchase: (tile: Tile) => boolean
    closePurchaseDialog: () => void
    requestDraw: () => void
}

export function useTileRequests(options: UseTileRequestsOptions) {
    async function confirmPurchaseRequest() {
        const tile = options.purchaseDialog.tile
        const price = Number(options.purchaseDialog.price)
        if (!tile || !options.canRequestPurchase(tile) || !Number.isFinite(price) || price <= 0) return

        tile.status = `已向${tile.owner}发出买地申请`
        options.closePurchaseDialog()
        options.requestDraw()
    }

    return {
        confirmPurchaseRequest,
    }
}
