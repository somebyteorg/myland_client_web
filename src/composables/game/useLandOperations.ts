import type {Ref} from 'vue'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import type {AbandonDialogState, ClaimDialogState} from '@/composables/game/useGameDialogs'
import {
    createCurrentPlayerOwnerData,
    createGrantedHomeObject,
    createPlayerFieldPatch,
    getCreatedAtString,
    normalizeGrantCount,
    requestLandAbandon,
    requestLandDeed,
    requestLandGrant,
} from '@/game/landOperations'
import {createUnclaimedGrassPatch} from '@/game/tileState'
import {resolveApiError} from '@/utils/apiErrors'
import type {GameTimeInfo, PlayerInfo} from '@/game/homeTypes'
import type {MapObject, MapRealtimeEvent, Tile} from '@/game/types'

interface ClaimInventoryState {
    pioneerToken: number
    landDeed: number
}

interface UseLandOperationsOptions {
    homeGrantSize: number
    claimDialog: ClaimDialogState
    abandonDialog: AbandonDialogState
    claimInventory: ClaimInventoryState
    claimSubmitting: Ref<boolean>
    claimMessage: Ref<string>
    claimMessageTone: Ref<'info' | 'error'>
    deedPlacementActive: Ref<boolean>
    getPlayerId: () => string | null | undefined
    getCurrentPlayerName: () => string | null | undefined
    getPlayerInfo: () => PlayerInfo | null | undefined
    getGameTime: () => GameTimeInfo | null | undefined
    getHomeObject: () => MapObject | null
    getGrantPath: () => string
    getDeedPath: () => string
    getAbandonPath: () => string
    tileAt: () => (x: number, y: number) => Tile | null
    canClaimHomeTile: (tile: Tile) => boolean
    canClaimDeedTile: (tile: Tile) => boolean
    canSubmitClaim: () => boolean
    canAbandonTile: (tile: Tile) => boolean
    applyMapRealtimeEvent: (event: MapRealtimeEvent) => void
    focusMapObject: (object: MapObject) => void
    focusTile: (tile: Tile, center?: boolean) => void
    refreshHomeData: () => Promise<void>
    refreshClaimInventory: () => Promise<void>
    loadLandChunk: (chunk: { x: number; y: number; w: number; h: number }) => Promise<void>
    completePioneerClaim: () => void
    resetClaimDialog: () => void
    closeAbandonDialog: () => void
    onError: (message: string) => void
    requestDraw: () => void
}

export function useLandOperations(options: UseLandOperationsOptions) {
    function confirmClaimLand() {
        const tile = options.claimDialog.tile
        const mode = options.claimDialog.mode
        if (!tile || !mode || options.claimDialog.submitting) return

        options.claimDialog.submitting = true
        options.claimDialog.errorMessage = ''
        void submitLandPlacement(tile, mode)
    }

    async function submitLandPlacement(tile: Tile, mode: LandPlacementMode) {
        if (mode === 'pioneer') {
            await grantHomeLand(tile)
            return
        }

        await grantDeedLand(tile)
    }

    async function grantHomeLand(tile: Tile) {
        const playerId = options.getPlayerId()
        if (!playerId || !options.canClaimHomeTile(tile)) {
            setClaimErrorMessage('当前地块不可开拓，请换一块空地再试')
            options.claimDialog.submitting = false
            return
        }
        if (options.claimSubmitting.value) return

        if (!options.canSubmitClaim()) {
            setClaimErrorMessage('没有可用开拓令')
            options.claimDialog.submitting = false
            return
        }

        options.claimSubmitting.value = true
        options.claimMessageTone.value = 'info'
        options.claimMessage.value = `正在开拓 (${tile.x}, ${tile.y})`

        try {
            const response = await requestLandGrant(options.getGrantPath(), tile, playerId)
            const home = createGrantedHomeObject(tile, {
                size: options.homeGrantSize,
                ownerData: createCurrentPlayerOwnerData(playerId, options.getPlayerInfo()),
                createdAtString: getCreatedAtString(options.getGameTime()),
            })
            options.applyMapRealtimeEvent({
                type: 'home.built',
                object: home,
            })

            const grantedTile = options.tileAt()(tile.x, tile.y)
            if (grantedTile && response.land_id) grantedTile.landId = response.land_id
            options.focusMapObject(home)
            options.claimInventory.pioneerToken = Math.max(0, options.claimInventory.pioneerToken - 1)
            options.claimMessage.value = '家园设置完成'
            options.completePioneerClaim()
            options.resetClaimDialog()
            await Promise.all([
                options.loadLandChunk({x: tile.x, y: tile.y, w: options.homeGrantSize, h: options.homeGrantSize}),
                options.refreshHomeData(),
                options.refreshClaimInventory(),
            ])
        } catch (error) {
            console.error(error)
            const apiError = await resolveApiError(error, '开拓失败，请换一块空地再试')
            setClaimErrorMessage(apiError.message)
            if (apiError.isValidationError) options.onError(apiError.message)
            options.claimDialog.submitting = false
            options.requestDraw()
        } finally {
            options.claimSubmitting.value = false
        }
    }

    async function grantDeedLand(tile: Tile) {
        const playerId = options.getPlayerId()
        if (!playerId || !options.canClaimDeedTile(tile)) {
            setClaimErrorMessage('当前地块不可扩张，请选择相邻空地')
            options.claimDialog.submitting = false
            return
        }
        if (options.claimSubmitting.value) return

        if (options.claimInventory.landDeed <= 0) {
            setClaimErrorMessage('没有可用地契')
            options.claimDialog.submitting = false
            return
        }

        options.claimSubmitting.value = true
        options.claimMessageTone.value = 'info'
        options.claimMessage.value = `正在扩张 (${tile.x}, ${tile.y})`

        try {
            const response = await requestLandDeed(options.getDeedPath(), tile, playerId)
            options.applyMapRealtimeEvent({
                type: 'land.deeded',
                patch: {
                    x: tile.x,
                    y: tile.y,
                    tile: createPlayerFieldPatch(tile, {
                        landId: response.land_id,
                        currentPlayerId: playerId,
                        currentPlayerName: options.getCurrentPlayerName(),
                        homeObject: options.getHomeObject(),
                    }),
                },
            })
            options.claimInventory.landDeed = normalizeGrantCount(response.count_deed, options.claimInventory.landDeed - 1)
            options.claimMessage.value = '领地扩张完成'
            const currentTile = options.tileAt()(tile.x, tile.y) ?? tile
            options.focusTile(currentTile, false)
            options.resetClaimDialog()
            if (options.claimInventory.landDeed <= 0) options.deedPlacementActive.value = false
            void syncGrantedDeedLand(tile)
        } catch (error) {
            console.error(error)
            const apiError = await resolveApiError(error, '扩张失败，请换一块相邻空地再试')
            setClaimErrorMessage(apiError.message)
            if (apiError.isValidationError) options.onError(apiError.message)
            options.claimDialog.submitting = false
            options.requestDraw()
        } finally {
            options.claimSubmitting.value = false
        }
    }

    async function syncGrantedDeedLand(tile: Tile) {
        try {
            await Promise.all([
                options.refreshClaimInventory(),
                options.loadLandChunk({x: tile.x, y: tile.y, w: 1, h: 1}),
            ])
            if (options.claimInventory.landDeed <= 0) options.deedPlacementActive.value = false
        } catch (error) {
            console.error(error)
        }
    }

    function setClaimErrorMessage(message: string) {
        options.claimMessageTone.value = 'error'
        options.claimMessage.value = message
        if (options.claimDialog.visible) options.claimDialog.errorMessage = message
    }

    function confirmAbandonTile() {
        const tile = options.abandonDialog.tile
        if (!tile || options.abandonDialog.submitting) return

        options.abandonDialog.submitting = true
        options.abandonDialog.errorMessage = ''
        void submitAbandonTile(tile)
    }

    async function submitAbandonTile(tile: Tile) {
        const playerId = options.getPlayerId()
        if (!playerId || !options.canAbandonTile(tile)) {
            options.abandonDialog.errorMessage = '当前土地不可荒废'
            options.abandonDialog.submitting = false
            return
        }

        try {
            const response = await requestLandAbandon(options.getAbandonPath(), tile, playerId)
            if (!response.is_success) throw new Error('abandon land failed')

            options.applyMapRealtimeEvent({
                type: 'land.abandoned',
                patch: {
                    x: tile.x,
                    y: tile.y,
                    tile: createUnclaimedGrassPatch(tile),
                },
            })
            options.abandonDialog.submitting = false
            options.closeAbandonDialog()
        } catch (error) {
            console.error(error)
            const apiError = await resolveApiError(error, '荒废失败，请稍后再试')
            options.abandonDialog.errorMessage = apiError.message
            if (apiError.isValidationError) options.onError(apiError.message)
            options.abandonDialog.submitting = false
        }
    }

    return {
        confirmClaimLand,
        confirmAbandonTile,
        grantHomeLand,
        grantDeedLand,
        syncGrantedDeedLand,
        submitAbandonTile,
        setClaimErrorMessage,
    }
}
