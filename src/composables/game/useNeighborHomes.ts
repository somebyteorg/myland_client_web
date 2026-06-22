import {loadNeighborInfo, visitNeighbor} from '@/game/neighborData'
import {
    createOwnerDataFromNeighborInfo,
    mergeMapObjectOwnerData,
} from '@/game/mapObjectData'
import {resolveApiError} from '@/utils/apiErrors'
import type {MapItemOwnerData, MapObject} from '@/game/types'

interface UseNeighborHomesOptions {
    getPlayerId: () => string | null | undefined
    onOwnerDataAffectsMap: (object: MapObject) => void
    onOwnerDataUpdated: () => void
    onError: (message: string) => void
}

export function useNeighborHomes(options: UseNeighborHomesOptions) {
    async function submitNeighborVisit(object: MapObject) {
        const playerId = options.getPlayerId()
        const neighborPlayerId = object.ownerData?.player_id?.trim()
        if (!playerId || !neighborPlayerId || object.neighborVisitSubmitting) return

        object.neighborVisitSubmitting = true

        try {
            const response = await visitNeighbor(playerId, neighborPlayerId)
            mergeNeighborOwnerData(object, {
                count_visit: response.count_visit,
            })
            await refreshNeighborHomeInfo(object, {silent: true})
        } catch (error) {
            console.error(error)
            const apiError = await resolveApiError(error, '拜访失败，请稍后再试')
            options.onError(apiError.message)
        } finally {
            object.neighborVisitSubmitting = false
        }
    }

    async function refreshNeighborHomeInfo(object: MapObject, refreshOptions: { silent?: boolean } = {}) {
        const playerId = options.getPlayerId()
        const neighborPlayerId = object.ownerData?.player_id?.trim()
        if (!playerId || !neighborPlayerId) return

        const requestId = (object.neighborInfoRequestId ?? 0) + 1
        object.neighborInfoRequestId = requestId
        object.neighborInfoLoading = true

        try {
            const response = await loadNeighborInfo(playerId, neighborPlayerId)
            if (object.neighborInfoRequestId !== requestId) return

            mergeNeighborOwnerData(object, createOwnerDataFromNeighborInfo(response))
        } catch (error) {
            console.error(error)
            if (object.neighborInfoRequestId === requestId) {
                const apiError = await resolveApiError(error, '邻居信息刷新失败')
                if (!refreshOptions.silent || apiError.isValidationError) {
                    options.onError(apiError.message)
                }
            }
        } finally {
            if (object.neighborInfoRequestId === requestId) {
                object.neighborInfoLoading = false
            }
        }
    }

    function mergeNeighborOwnerData(object: MapObject, patch: Partial<MapItemOwnerData>) {
        const {affectsMap} = mergeMapObjectOwnerData(object, patch)

        if (affectsMap && object.type === 'home') {
            options.onOwnerDataAffectsMap(object)
            return
        }

        options.onOwnerDataUpdated()
    }

    return {
        submitNeighborVisit,
        refreshNeighborHomeInfo,
        mergeNeighborOwnerData,
    }
}
