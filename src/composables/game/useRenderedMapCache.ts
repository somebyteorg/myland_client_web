import {reactive} from 'vue'
import {buildOverviewMapCanvas, buildMinimapStaticMapCanvas} from '@/game/renderMiniMap'
import {buildStaticMapCanvas} from '@/game/renderScene'
import type {BuildMinimapStaticMapOptions} from '@/game/renderMiniMap'
import type {OwnerLabelCluster, Tile} from '@/game/types'

interface UseRenderedMapCacheOptions {
    getTiles: () => Tile[]
    tileAt: () => (x: number, y: number) => Tile | null
    getMapWidth: () => number
    getMapHeight: () => number
    getWorldWidth: () => number
    getWorldHeight: () => number
    canBuild: () => boolean
    getMinimapOptions: () => BuildMinimapStaticMapOptions
}

export interface RenderedMapCacheState {
    staticCanvas: HTMLCanvasElement | null
    overviewCanvas: HTMLCanvasElement | null
    minimapStaticCanvas: HTMLCanvasElement | null
    ownerLabelClusters: OwnerLabelCluster[]
}

export function useRenderedMapCache(options: UseRenderedMapCacheOptions) {
    const cache = reactive<RenderedMapCacheState>({
        staticCanvas: null,
        overviewCanvas: null,
        minimapStaticCanvas: null,
        ownerLabelClusters: [],
    })

    function rebuild() {
        if (!options.canBuild()) return

        const tiles = options.getTiles()
        const mapWidth = options.getMapWidth()
        const mapHeight = options.getMapHeight()
        const staticMap = buildStaticMapCanvas(
            tiles,
            options.tileAt(),
            mapWidth,
            mapHeight,
            options.getWorldWidth(),
            options.getWorldHeight(),
        )
        if (!staticMap) return

        cache.staticCanvas = staticMap.canvas
        cache.overviewCanvas = buildOverviewMapCanvas(tiles, mapWidth, mapHeight)
        cache.minimapStaticCanvas = buildMinimapStaticMapCanvas(tiles, mapWidth, mapHeight, options.getMinimapOptions())
        cache.ownerLabelClusters = staticMap.ownerLabelClusters
    }

    function rebuildMiniMap() {
        if (!options.canBuild()) return

        cache.minimapStaticCanvas = buildMinimapStaticMapCanvas(
            options.getTiles(),
            options.getMapWidth(),
            options.getMapHeight(),
            options.getMinimapOptions(),
        )
    }

    function reset() {
        cache.staticCanvas = null
        cache.overviewCanvas = null
        cache.minimapStaticCanvas = null
        cache.ownerLabelClusters = []
    }

    return {
        cache,
        rebuild,
        rebuildMiniMap,
        reset,
    }
}
