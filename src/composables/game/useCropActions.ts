import {clearLandCrop, harvestLandCrop, sowLandCrop, stealLandCrop} from '@/game/landData'
import {createEmptyCropPatch} from '@/game/tileState'
import {createPlantingPatch, ensureTileLandLoaded} from '@/game/cropActions'
import {ITEM_ID_CURRENCY_GRAIN} from '@/constants'
import {resolveApiError} from '@/utils/apiErrors'
import type {PlantDefinitionMap, PlantType, Tile} from '@/game/types'
import type {MapRealtimeEvent} from '@/game/types'

interface ClearCropDialogLike {
    submitting: boolean
    errorMessage: string
}

interface UseCropActionsOptions {
    plantDefinitions: PlantDefinitionMap
    getPlayerId: () => string | null | undefined
    getSeedQuantity: (plant: PlantType) => number
    tileAt: () => (x: number, y: number) => Tile | null
    canPlantTile: (tile: Tile) => boolean
    canClearCrop: (tile: Tile) => boolean
    canHarvestCrop: (tile: Tile) => boolean
    canFarmTile: (tile: Tile) => boolean
    canStealCrop: (tile: Tile) => boolean
    getPlantLabel: (plant: PlantType) => string
    loadTileLand: (tile: Tile) => Promise<void>
    applyMapRealtimeEvent: (event: MapRealtimeEvent) => void
    setSeedInventoryQuantity: (itemId: number, quantity: number) => void
    addCurrencyQuantity: (itemId: number, quantity: number) => void
    onError: (message: string) => void
    onReward: (message: string) => void
    requestDraw: () => void
}

export function useCropActions(options: UseCropActionsOptions) {
    const pendingCropActionTiles = new Set<string>()

    function getTileActionKey(tile: Tile) {
        return `${tile.x},${tile.y}`
    }

    function setTileCropActionPending(tile: Tile, pending: boolean) {
        const key = getTileActionKey(tile)
        if (pending) pendingCropActionTiles.add(key)
        else pendingCropActionTiles.delete(key)
        tile.cropActionSubmitting = pending
        options.requestDraw()
    }

    function isTileCropActionPending(tile: Tile) {
        return pendingCropActionTiles.has(getTileActionKey(tile))
    }

    function resetCropActions() {
        for (const key of pendingCropActionTiles) {
            const [x, y] = key.split(',').map(Number)
            const tile = Number.isFinite(x) && Number.isFinite(y) ? options.tileAt()(x, y) : null
            if (tile) tile.cropActionSubmitting = false
        }
        pendingCropActionTiles.clear()
    }

    async function ensureCurrentTileLandLoaded(tile: Tile) {
        return ensureTileLandLoaded(tile, options.loadTileLand, options.tileAt())
    }

    async function plantCropOnTile(tile: Tile, plant: PlantType) {
        if (!options.plantDefinitions[plant]) return
        if (options.getSeedQuantity(plant) <= 0) return
        if (isTileCropActionPending(tile)) return

        setTileCropActionPending(tile, true)
        const currentTile = await ensureCurrentTileLandLoaded(tile)
        const playerId = options.getPlayerId()
        const landId = currentTile?.landId
        if (!currentTile || !playerId || !landId || !options.canPlantTile(currentTile)) {
            setTileCropActionPending(tile, false)
            return
        }

        if (currentTile !== tile) {
            setTileCropActionPending(tile, false)
            if (isTileCropActionPending(currentTile)) return
            setTileCropActionPending(currentTile, true)
        }
        currentTile.status = '播种中'
        options.requestDraw()

        try {
            const response = await sowLandCrop(playerId, landId, plant)
            options.setSeedInventoryQuantity(plant, response.count_seed)
            options.applyMapRealtimeEvent({
                type: 'plant.updated',
                patch: {
                    x: currentTile.x,
                    y: currentTile.y,
                    tile: createPlantingPatch(currentTile, plant, response, {
                        canFarmTile: options.canFarmTile,
                        getPlantLabel: options.getPlantLabel,
                    }),
                },
            })
        } catch (error) {
            console.error(error)
            currentTile.status = '播种失败'
            const apiError = await resolveApiError(error, '播种失败，请稍后再试')
            options.onError(apiError.message)
            options.requestDraw()
        } finally {
            setTileCropActionPending(currentTile, false)
        }
    }

    async function clearCropOnTile(tile: Tile, dialog: ClearCropDialogLike, onCleared: () => void) {
        if (isTileCropActionPending(tile)) {
            dialog.submitting = false
            return
        }

        setTileCropActionPending(tile, true)
        const currentTile = await ensureCurrentTileLandLoaded(tile)
        const playerId = options.getPlayerId()
        const landId = currentTile?.landId
        if (!currentTile || !playerId || !landId || !options.canClearCrop(currentTile)) {
            setTileCropActionPending(tile, false)
            dialog.errorMessage = '当前作物不可铲除'
            dialog.submitting = false
            return
        }

        if (currentTile !== tile) {
            setTileCropActionPending(tile, false)
            if (isTileCropActionPending(currentTile)) {
                dialog.submitting = false
                return
            }
            setTileCropActionPending(currentTile, true)
        }
        currentTile.status = '铲除中'
        options.requestDraw()

        try {
            const response = await clearLandCrop(playerId, landId)
            if (!response.is_success) throw new Error('clear crop failed')

            options.applyMapRealtimeEvent({
                type: 'plant.updated',
                patch: {
                    x: currentTile.x,
                    y: currentTile.y,
                    tile: createEmptyCropPatch('待播种'),
                },
            })
            dialog.submitting = false
            onCleared()
        } catch (error) {
            console.error(error)
            const apiError = await resolveApiError(error, '铲除失败，请稍后再试')
            dialog.errorMessage = apiError.message
            if (apiError.isValidationError) options.onError(apiError.message)
            currentTile.status = '铲除失败'
            options.requestDraw()
        } finally {
            dialog.submitting = false
            setTileCropActionPending(currentTile, false)
        }
    }

    async function harvestCropOnTile(tile: Tile) {
        if (isTileCropActionPending(tile)) return false

        setTileCropActionPending(tile, true)
        const currentTile = await ensureCurrentTileLandLoaded(tile)
        const playerId = options.getPlayerId()
        const landId = currentTile?.landId
        const cropId = currentTile?.cropId
        if (!currentTile || !playerId || !landId || !cropId || !options.canHarvestCrop(currentTile)) {
            setTileCropActionPending(tile, false)
            return false
        }

        if (currentTile !== tile) {
            setTileCropActionPending(tile, false)
            if (isTileCropActionPending(currentTile)) return false
            setTileCropActionPending(currentTile, true)
        }
        currentTile.status = '收获中'
        options.requestDraw()

        try {
            const response = await harvestLandCrop(playerId, landId, cropId)
            options.addCurrencyQuantity(ITEM_ID_CURRENCY_GRAIN, response.yield_harvested)
            options.onReward(`获得 ${response.yield_harvested} 粮食`)
            options.applyMapRealtimeEvent({
                type: 'plant.updated',
                patch: {
                    x: currentTile.x,
                    y: currentTile.y,
                    tile: {
                        ...createEmptyCropPatch('已收获'),
                    },
                },
            })
            await options.loadTileLand(currentTile)
            return true
        } catch (error) {
            console.error(error)
            currentTile.status = '收获失败'
            const apiError = await resolveApiError(error, '收获失败，请稍后再试')
            options.onError(apiError.message)
            options.requestDraw()
            return false
        } finally {
            setTileCropActionPending(currentTile, false)
        }
    }

    async function stealCropOnTile(tile: Tile) {
        if (isTileCropActionPending(tile)) return false

        setTileCropActionPending(tile, true)
        const currentTile = await ensureCurrentTileLandLoaded(tile)
        const playerId = options.getPlayerId()
        const landId = currentTile?.landId
        const cropId = currentTile?.cropId
        if (!currentTile || !playerId || !landId || !cropId || !options.canStealCrop(currentTile)) {
            setTileCropActionPending(tile, false)
            return false
        }

        if (currentTile !== tile) {
            setTileCropActionPending(tile, false)
            if (isTileCropActionPending(currentTile)) return false
            setTileCropActionPending(currentTile, true)
        }
        currentTile.status = '偷取中'
        options.requestDraw()

        try {
            const response = await stealLandCrop(playerId, landId, cropId)
            options.addCurrencyQuantity(ITEM_ID_CURRENCY_GRAIN, response.player_stolen)
            options.onReward(`获得 ${response.player_stolen} 粮食`)
            options.applyMapRealtimeEvent({
                type: 'plant.updated',
                patch: {
                    x: currentTile.x,
                    y: currentTile.y,
                    tile: {
                        isCanStolen: false,
                        status: `已偷取 ${response.player_stolen}`,
                    },
                },
            })
            await options.loadTileLand(currentTile)
            return true
        } catch (error) {
            console.error(error)
            currentTile.status = '偷取失败'
            const apiError = await resolveApiError(error, '偷取失败，请稍后再试')
            options.onError(apiError.message)
            options.requestDraw()
            return false
        } finally {
            setTileCropActionPending(currentTile, false)
        }
    }

    return {
        isTileCropActionPending,
        plantCropOnTile,
        clearCropOnTile,
        harvestCropOnTile,
        stealCropOnTile,
        resetCropActions,
    }
}
