import type {Ref} from 'vue'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import type {ToolCursorState} from '@/composables/game/useMapHoverState'
import {isNeighborHomeObject} from '@/game/objectRules'
import type {ContextMenuState, FarmTool, HomeHoverCardState, LandHoverCardState, MapObject, Tile} from '@/game/types'

interface PointedTileAndHome {
    homeObject: MapObject | null
    tile: Tile | null
}

interface MapNavigationLike {
    getPointedTileAndHome: (clientX: number, clientY: number) => PointedTileAndHome
    getTileFromClientPoint: (clientX: number, clientY: number) => Tile | null
    getHomeObjectFromClientPoint: (clientX: number, clientY: number) => MapObject | null
    getPlayerStatueObjectFromClientPoint: (clientX: number, clientY: number) => MapObject | null
    focusTile: (tile: Tile, center?: boolean) => void
    focusMapObject: (object: MapObject, center?: boolean) => void
}

interface HoverStateLike {
    toolCursor: ToolCursorState
    homeHoverCard: HomeHoverCardState
    landHoverCard: LandHoverCardState
    hideToolCursor: () => void
    showToolCursor: (clientX: number, clientY: number, valid: boolean) => void
    showHomeHoverCard: (object: MapObject, clientX: number, clientY: number) => void
    hideHomeHoverCard: () => void
    showLandHoverCard: (tile: Tile, clientX: number, clientY: number) => void
    hideLandHoverCard: () => void
    hideHoverCards: () => void
    hideAllHoverState: () => void
}

interface UseMapInteractionControllerOptions {
    activeFarmTool: Ref<FarmTool>
    landPlacementMode: Ref<LandPlacementMode | null>
    claimTokensAvailable: Ref<number>
    deedInventoryAvailable: Ref<number>
    claimMessage: { value: string }
    claimMessageTone: { value: 'info' | 'error' }
    contextMenu: ContextMenuState
    navigation: MapNavigationLike
    hoverState: HoverStateLike
    hideClaimPreview: () => void
    updateClaimPreview: (clientX: number, clientY: number) => void
    canSubmitLandPlacementAt: (tile: Tile) => boolean
    openClaimDialog: (tile: Tile) => void
    applyActiveFarmTool: (tile: Tile) => void
    isFarmToolValid: (tile: Tile) => boolean
    getContextActions: (tile: Tile, object: MapObject | null) => string[]
    refreshNeighborHomeInfo: (object: MapObject) => void
    requestDraw: () => void
}

export function useMapInteractionController(options: UseMapInteractionControllerOptions) {
    function clearPointerHoverState() {
        options.hoverState.hideAllHoverState()
        options.hideClaimPreview()
    }

    function updatePointerHoverState(clientX: number, clientY: number, dragging: boolean) {
        options.updateClaimPreview(clientX, clientY)
        updateToolCursor(clientX, clientY)
        updateHoverCards(clientX, clientY, dragging)
    }

    function selectTileAt(clientX: number, clientY: number) {
        const {homeObject, tile} = options.navigation.getPointedTileAndHome(clientX, clientY)

        if (!tile) return

        if (options.landPlacementMode.value) {
            options.navigation.focusTile(tile, false)
            if (options.canSubmitLandPlacementAt(tile)) options.openClaimDialog(tile)
            else if (options.landPlacementMode.value === 'pioneer' && options.claimTokensAvailable.value <= 0) {
                options.claimMessageTone.value = 'error'
                options.claimMessage.value = '没有可用开拓令'
            } else if (options.landPlacementMode.value === 'deed' && options.deedInventoryAvailable.value <= 0) {
                options.claimMessageTone.value = 'error'
                options.claimMessage.value = '没有可用地契'
            }
            return
        }

        if (homeObject) {
            options.navigation.focusMapObject(homeObject, false)
            updateToolCursor(clientX, clientY)
            return
        }

        options.navigation.focusTile(tile, false)
        options.applyActiveFarmTool(tile)
        updateToolCursor(clientX, clientY)
    }

    function updateToolCursor(clientX: number, clientY: number) {
        if (options.landPlacementMode.value || options.activeFarmTool.value === 'inspect') {
            options.hoverState.hideToolCursor()
            return
        }

        const tile = options.navigation.getTileFromClientPoint(clientX, clientY)
        options.hoverState.showToolCursor(clientX, clientY, Boolean(tile && options.isFarmToolValid(tile)))
    }

    function updateHoverCards(clientX: number, clientY: number, dragging: boolean) {
        if (options.landPlacementMode.value || options.activeFarmTool.value !== 'inspect' || dragging) {
            options.hoverState.hideHoverCards()
            return
        }

        const object = options.navigation.getHomeObjectFromClientPoint(clientX, clientY)
        if (object) {
            options.hoverState.showHomeHoverCard(object, clientX, clientY)
            options.hoverState.hideLandHoverCard()
            return
        }

        options.hoverState.hideHomeHoverCard()

        const statue = options.navigation.getPlayerStatueObjectFromClientPoint(clientX, clientY)
        if (statue) {
            options.hoverState.showHomeHoverCard(statue, clientX, clientY)
            options.hoverState.hideLandHoverCard()
            return
        }

        const tile = options.navigation.getTileFromClientPoint(clientX, clientY)
        if (!tile || !canShowLandHoverCard(tile)) {
            options.hoverState.hideLandHoverCard()
            return
        }

        options.hoverState.showLandHoverCard(tile, clientX, clientY)
    }

    function onCanvasContextMenu(event: MouseEvent) {
        if (options.landPlacementMode.value === 'pioneer') {
            hideContextMenu()
            return
        }

        const {homeObject, tile} = options.navigation.getPointedTileAndHome(event.clientX, event.clientY)
        if (!tile) return

        const actions = options.getContextActions(tile, homeObject)
        if (actions.length === 0) {
            hideContextMenu()
            return
        }

        options.contextMenu.tile = tile
        options.contextMenu.object = homeObject
        options.contextMenu.actions = actions
        options.contextMenu.x = event.clientX
        options.contextMenu.y = event.clientY
        options.contextMenu.visible = true
        if (isNeighborHomeObject(homeObject)) {
            options.refreshNeighborHomeInfo(homeObject)
        }
        options.requestDraw()
    }

    function hideContextMenu() {
        options.contextMenu.visible = false
        options.contextMenu.object = null
    }

    return {
        clearPointerHoverState,
        updatePointerHoverState,
        selectTileAt,
        updateToolCursor,
        updateHoverCards,
        onCanvasContextMenu,
        hideContextMenu,
    }
}

function canShowLandHoverCard(tile: Tile) {
    return Boolean(tile.plant) || tile.terrain === 'field'
}
