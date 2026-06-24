import {getLandChunkKey} from '@/game/landChunks'
import type {LandChunkRequest} from '@/game/landChunks'

interface UseLandChunkLoaderOptions<T> {
    canLoad: () => boolean
    getRequests: () => LandChunkRequest[]
    fetchChunk: (chunk: LandChunkRequest, signal: AbortSignal) => Promise<T[]>
    applyChunk: (items: T[], chunk: LandChunkRequest) => void
    maxConcurrentLoads?: number
    onLoadingChange: () => void
}

interface PendingLandChunkLoad {
    controller: AbortController
    chunk: LandChunkRequest
    force: boolean
    key: string
    promise: Promise<void>
    resolve: () => void
    version: number
}

interface ActiveLandChunkLoad extends PendingLandChunkLoad {}

const defaultMaxConcurrentLoads = 6

export function useLandChunkLoader<T>(options: UseLandChunkLoaderOptions<T>) {
    const loadedLandChunks = new Set<string>()
    const loadingLandChunks = new Set<string>()
    const activeLandChunks = new Map<string, ActiveLandChunkLoad>()
    const pendingLandChunks = new Map<string, PendingLandChunkLoad>()
    const maxConcurrentLoads = Math.max(1, Math.min(defaultMaxConcurrentLoads, Math.floor(options.maxConcurrentLoads ?? defaultMaxConcurrentLoads)))
    let loadFrame: number | null = null
    let requestVersion = 0

    function queueVisibleLandChunkLoad() {
        if (!options.canLoad() || loadFrame !== null) return

        loadFrame = window.requestAnimationFrame(() => {
            loadFrame = null
            void loadVisibleLandChunks()
        })
    }

    async function loadVisibleLandChunks() {
        if (!options.canLoad()) return

        const version = requestVersion
        const visibleChunks = options.getRequests()
        const visibleKeys = new Set(visibleChunks.map(getLandChunkKey))
        dropInvisiblePendingLoads(visibleKeys)
        abortInvisibleActiveLoads(visibleKeys)

        const chunks = visibleChunks
            .filter((chunk) => {
                const key = getLandChunkKey(chunk)

                return !loadedLandChunks.has(key) && !loadingLandChunks.has(key)
            })

        if (chunks.length === 0) return

        await Promise.all(chunks.map((chunk) => queueLandChunkLoad(chunk, version, false)))
    }

    function dropInvisiblePendingLoads(visibleKeys: Set<string>) {
        for (const [key, pendingLoad] of pendingLandChunks) {
            if (pendingLoad.force || visibleKeys.has(key)) continue

            pendingLandChunks.delete(key)
            pendingLoad.controller.abort()
            finishQueuedLandChunkLoad(pendingLoad)
        }
    }

    async function loadLandChunk(chunk: LandChunkRequest, version = requestVersion) {
        await queueLandChunkLoad(chunk, version, true)
    }

    function queueLandChunkLoad(chunk: LandChunkRequest, version: number, force: boolean) {
        const key = getLandChunkKey(chunk)
        if (!force && loadedLandChunks.has(key)) return Promise.resolve()

        const pendingLoad = pendingLandChunks.get(key)
        if (pendingLoad) return pendingLoad.promise

        const activeLoad = activeLandChunks.get(key)
        if (activeLoad) return activeLoad.promise

        const controller = new AbortController()
        let resolveLoad = () => {}
        const promise = new Promise<void>((resolve) => {
            resolveLoad = resolve
        })
        loadingLandChunks.add(key)
        pendingLandChunks.set(key, {
            controller,
            chunk,
            force,
            key,
            promise,
            resolve: resolveLoad,
            version,
        })
        options.onLoadingChange()
        pumpChunkLoads()

        return promise
    }

    function pumpChunkLoads() {
        while (activeLandChunks.size < maxConcurrentLoads && pendingLandChunks.size > 0) {
            const pendingLoad = pendingLandChunks.values().next().value
            if (!pendingLoad) return

            pendingLandChunks.delete(pendingLoad.key)
            if (pendingLoad.version !== requestVersion) {
                pendingLoad.controller.abort()
                finishQueuedLandChunkLoad(pendingLoad)
                continue
            }
            if (!pendingLoad.force && loadedLandChunks.has(pendingLoad.key)) {
                pendingLoad.controller.abort()
                finishQueuedLandChunkLoad(pendingLoad)
                continue
            }

            startLandChunkLoad(pendingLoad)
        }
    }

    function startLandChunkLoad(pendingLoad: PendingLandChunkLoad) {
        activeLandChunks.set(pendingLoad.key, pendingLoad)

        void runLandChunkLoad(pendingLoad)
    }

    function abortInvisibleActiveLoads(visibleKeys: Set<string>) {
        for (const [key, activeLoad] of activeLandChunks) {
            if (activeLoad.force || visibleKeys.has(key)) continue

            activeLoad.controller.abort()
        }
    }

    async function runLandChunkLoad(pendingLoad: PendingLandChunkLoad) {
        try {
            const items = await options.fetchChunk(pendingLoad.chunk, pendingLoad.controller.signal)
            if (pendingLoad.version !== requestVersion) return

            options.applyChunk(items, pendingLoad.chunk)
            loadedLandChunks.add(pendingLoad.key)
        } catch (error) {
            if (!isAbortError(error)) console.error(error)
        } finally {
            finishActiveLandChunkLoad(pendingLoad)
            pumpChunkLoads()
        }
    }

    function finishQueuedLandChunkLoad(pendingLoad: PendingLandChunkLoad) {
        if (!activeLandChunks.has(pendingLoad.key) && !pendingLandChunks.has(pendingLoad.key)) {
            loadingLandChunks.delete(pendingLoad.key)
        }
        pendingLoad.resolve()
        options.onLoadingChange()
    }

    function finishActiveLandChunkLoad(pendingLoad: PendingLandChunkLoad) {
        if (activeLandChunks.get(pendingLoad.key)?.promise === pendingLoad.promise) {
            activeLandChunks.delete(pendingLoad.key)
            if (!pendingLandChunks.has(pendingLoad.key)) {
                loadingLandChunks.delete(pendingLoad.key)
            }
        } else if (!activeLandChunks.has(pendingLoad.key) && !pendingLandChunks.has(pendingLoad.key)) {
            loadingLandChunks.delete(pendingLoad.key)
        }

        pendingLoad.resolve()
        options.onLoadingChange()
    }

    function resetLandChunkLoader() {
        requestVersion += 1
        loadedLandChunks.clear()
        loadingLandChunks.clear()
        for (const activeLoad of activeLandChunks.values()) {
            activeLoad.controller.abort()
        }
        activeLandChunks.clear()
        for (const pendingLoad of pendingLandChunks.values()) {
            pendingLoad.controller.abort()
            pendingLoad.resolve()
        }
        pendingLandChunks.clear()
        if (loadFrame !== null) {
            window.cancelAnimationFrame(loadFrame)
            loadFrame = null
        }
        options.onLoadingChange()
    }

    function getStats() {
        return {
            activeLoadCount: activeLandChunks.size,
            loadedChunks: loadedLandChunks.size,
            loadingChunks: loadingLandChunks.size,
            maxConcurrentLoads,
            pendingChunks: pendingLandChunks.size,
        }
    }

    return {
        getStats,
        loadedLandChunks,
        loadingLandChunks,
        queueVisibleLandChunkLoad,
        loadVisibleLandChunks,
        loadLandChunk,
        resetLandChunkLoader,
    }
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError' ||
        error instanceof Error && error.name === 'AbortError'
}
