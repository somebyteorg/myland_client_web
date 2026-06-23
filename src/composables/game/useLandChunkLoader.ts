import {getLandChunkKey} from '@/game/landChunks'
import type {LandChunkRequest} from '@/game/landChunks'

interface UseLandChunkLoaderOptions<T> {
    canLoad: () => boolean
    getRequests: () => LandChunkRequest[]
    fetchChunk: (chunk: LandChunkRequest) => Promise<T[]>
    applyChunk: (items: T[], chunk: LandChunkRequest) => void
    onLoadingChange: () => void
}

export function useLandChunkLoader<T>(options: UseLandChunkLoaderOptions<T>) {
    const loadedLandChunks = new Set<string>()
    const loadingLandChunks = new Set<string>()
    let loadTimer: ReturnType<typeof window.setTimeout> | null = null
    let requestVersion = 0

    function queueVisibleLandChunkLoad() {
        if (!options.canLoad() || loadTimer) return

        loadTimer = window.setTimeout(() => {
            loadTimer = null
            void loadVisibleLandChunks()
        }, 120)
    }

    async function loadVisibleLandChunks() {
        if (!options.canLoad()) return

        const version = requestVersion
        const chunks = options.getRequests()
            .filter((chunk) => {
                const key = getLandChunkKey(chunk)

                return !loadedLandChunks.has(key) && !loadingLandChunks.has(key)
            })

        if (chunks.length === 0) return

        await Promise.all(chunks.map((chunk) => loadLandChunk(chunk, version)))
    }

    async function loadLandChunk(chunk: LandChunkRequest, version = requestVersion) {
        const key = getLandChunkKey(chunk)
        loadingLandChunks.add(key)
        options.onLoadingChange()

        try {
            const items = await options.fetchChunk(chunk)
            if (version !== requestVersion) return

            options.applyChunk(items, chunk)
            loadedLandChunks.add(key)
        } catch (error) {
            console.error(error)
        } finally {
            loadingLandChunks.delete(key)
            options.onLoadingChange()
        }
    }

    function resetLandChunkLoader() {
        requestVersion += 1
        loadedLandChunks.clear()
        loadingLandChunks.clear()
        if (loadTimer) {
            window.clearTimeout(loadTimer)
            loadTimer = null
        }
    }

    return {
        loadedLandChunks,
        loadingLandChunks,
        queueVisibleLandChunkLoad,
        loadVisibleLandChunks,
        loadLandChunk,
        resetLandChunkLoader,
    }
}
