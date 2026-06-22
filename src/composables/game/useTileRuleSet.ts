import type {ComputedRef} from 'vue'
import type {LandPlacementMode} from '@/composables/game/useLandClaims'
import {
    canAbandonTile as canAbandonTileRule,
    canClearCrop as canClearCropRule,
    canClaimDeedTile as canClaimDeedTileRule,
    canFarmTile as canFarmTileRule,
    canGrantHomeTile as canGrantHomeTileRule,
    canBuildPlayerStatueTile as canBuildPlayerStatueTileRule,
    canHarvestCrop as canHarvestCropRule,
    canPlantTile as canPlantTileRule,
    canRequestPurchase as canRequestPurchaseRule,
    canStealCrop as canStealCropRule,
    objectsAtTile as getObjectsAtTile,
} from '@/game/tileRules'
import type {MapObject, Tile} from '@/game/types'

type TileLookup = (x: number, y: number) => Tile | null
type OccupiedRect = Pick<MapObject, 'x' | 'y' | 'width' | 'height'>

interface UseTileRuleSetOptions {
    hasOwnHomeOnCurrentMap: ComputedRef<boolean>
    landPlacementMode: ComputedRef<LandPlacementMode | null>
    canSubmitClaim: ComputedRef<boolean>
    tileAt: () => TileLookup
    getMapObjects: () => MapObject[]
    getOccupiedRects: () => OccupiedRect[]
    isRiverTile: (x: number, y: number) => boolean
}

export function useTileRuleSet(options: UseTileRuleSetOptions) {
    function objectsAtTile(tile: Tile) {
        return getObjectsAtTile(tile, options.getMapObjects())
    }

    function canClaimHomeTile(tile: Tile) {
        return canGrantHomeTileRule(tile, options.tileAt(), options.getOccupiedRects(), options.isRiverTile)
    }

    function canPlaceLandAt(tile: Tile) {
        if (options.landPlacementMode.value === 'pioneer') return canClaimHomeTile(tile)
        if (options.landPlacementMode.value === 'deed') return canClaimDeedTile(tile)

        return false
    }

    function canClaimDeedTile(tile: Tile) {
        return canClaimDeedTileRule(tile, {
            hasOwnHome: options.hasOwnHomeOnCurrentMap.value,
            tileAt: options.tileAt(),
            occupiedRects: options.getOccupiedRects(),
            mapObjects: options.getMapObjects(),
            isRiverTile: options.isRiverTile,
        })
    }

    function canSubmitLandPlacementAt(tile: Tile) {
        return options.canSubmitClaim.value && canPlaceLandAt(tile)
    }

    function canFarmTile(tile: Tile) {
        return canFarmTileRule(tile, options.getMapObjects())
    }

    function canPlantTile(tile: Tile) {
        return canPlantTileRule(tile, canFarmTile)
    }

    function canClearCrop(tile: Tile) {
        return canClearCropRule(tile, canFarmTile)
    }

    function canHarvestCrop(tile: Tile) {
        return canHarvestCropRule(tile, canFarmTile)
    }

    function canAbandonTile(tile: Tile) {
        return canAbandonTileRule(tile, options.tileAt())
    }

    function canRequestPurchase(tile: Tile) {
        return canRequestPurchaseRule(tile, options.tileAt())
    }

    function canStealCrop(tile: Tile) {
        return canStealCropRule(tile)
    }

    function canBuildPlayerStatueTile(tile: Tile) {
        return canBuildPlayerStatueTileRule(tile, {
            tileAt: options.tileAt(),
            occupiedRects: options.getOccupiedRects(),
            mapObjects: options.getMapObjects(),
            isRiverTile: options.isRiverTile,
        })
    }

    return {
        objectsAtTile,
        canClaimHomeTile,
        canPlaceLandAt,
        canClaimDeedTile,
        canSubmitLandPlacementAt,
        canFarmTile,
        canPlantTile,
        canClearCrop,
        canHarvestCrop,
        canAbandonTile,
        canRequestPurchase,
        canStealCrop,
        canBuildPlayerStatueTile,
    }
}
