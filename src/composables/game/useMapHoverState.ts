import {reactive} from 'vue'
import type {HomeHoverCardState, LandHoverCardState, MapObject, Tile} from '@/game/types'

export interface ToolCursorState {
    visible: boolean
    x: number
    y: number
    valid: boolean
}

export function useMapHoverState() {
    const toolCursor = reactive<ToolCursorState>({
        visible: false,
        x: 0,
        y: 0,
        valid: false,
    })
    const homeHoverCard = reactive<HomeHoverCardState>({
        visible: false,
        x: 0,
        y: 0,
        home: null,
    })
    const landHoverCard = reactive<LandHoverCardState>({
        visible: false,
        x: 0,
        y: 0,
        tile: null,
    })

    function hideToolCursor() {
        toolCursor.visible = false
    }

    function showToolCursor(clientX: number, clientY: number, valid: boolean) {
        toolCursor.visible = true
        toolCursor.x = clientX
        toolCursor.y = clientY
        toolCursor.valid = valid
    }

    function showHomeHoverCard(object: MapObject, clientX: number, clientY: number) {
        homeHoverCard.visible = true
        homeHoverCard.x = clientX
        homeHoverCard.y = clientY
        homeHoverCard.home = object
    }

    function hideHomeHoverCard() {
        homeHoverCard.visible = false
        homeHoverCard.home = null
    }

    function showLandHoverCard(tile: Tile, clientX: number, clientY: number) {
        landHoverCard.visible = true
        landHoverCard.x = clientX
        landHoverCard.y = clientY
        landHoverCard.tile = tile
    }

    function hideLandHoverCard() {
        landHoverCard.visible = false
        landHoverCard.tile = null
    }

    function hideHoverCards() {
        hideHomeHoverCard()
        hideLandHoverCard()
    }

    function hideAllHoverState() {
        hideToolCursor()
        hideHoverCards()
    }

    return {
        toolCursor,
        homeHoverCard,
        landHoverCard,
        hideToolCursor,
        showToolCursor,
        showHomeHoverCard,
        hideHomeHoverCard,
        showLandHoverCard,
        hideLandHoverCard,
        hideHoverCards,
        hideAllHoverState,
    }
}
