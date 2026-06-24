import {markRaw, shallowReactive} from 'vue'
import {buildMinimapStaticMapCanvas} from '@/game/renderMiniMap'
import {buildOwnerLabelClusters, buildOwnerLabelClusterTileKeys} from '@/game/renderLabels'
import type {OwnerLabelCluster, Tile} from '@/game/types'

interface UseRenderedMapCacheOptions {
    getTiles: () => Tile[]
    tileAt: () => (x: number, y: number) => Tile | null
    getMapWidth: () => number
    getMapHeight: () => number
    canBuild: () => boolean
}

export interface RenderedMapCacheState {
    minimapStaticCanvas: HTMLCanvasElement | null
    ownerLabelClusters: OwnerLabelCluster[]
    ownerLabelClusterTileKeys: Set<string>
    staticMapVersion: number
}

export function useRenderedMapCache(options: UseRenderedMapCacheOptions) {
    const cache = shallowReactive<RenderedMapCacheState>({
        minimapStaticCanvas: null,
        ownerLabelClusters: [],
        ownerLabelClusterTileKeys: markRaw(new Set<string>()),
        staticMapVersion: 0,
    })

    function rebuild() {
        if (!options.canBuild()) return

        const tiles = options.getTiles()
        const mapWidth = options.getMapWidth()
        const mapHeight = options.getMapHeight()

        cache.minimapStaticCanvas = markRawNullable(buildMinimapStaticMapCanvas(tiles, mapWidth, mapHeight))
        const ownerLabelClusters = markRaw(buildOwnerLabelClusters(tiles, options.tileAt(), mapWidth, mapHeight))

        cache.ownerLabelClusters = ownerLabelClusters
        cache.ownerLabelClusterTileKeys = markRaw(buildOwnerLabelClusterTileKeys(ownerLabelClusters))
        cache.staticMapVersion += 1
    }

    function reset() {
        cache.minimapStaticCanvas = null
        cache.ownerLabelClusters = []
        cache.ownerLabelClusterTileKeys = markRaw(new Set<string>())
        cache.staticMapVersion += 1
    }

    return {
        cache,
        rebuild,
        reset,
    }
}

function markRawNullable<T extends object>(value: T | null) {
    return value ? markRaw(value) : null
}
