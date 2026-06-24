export type MapObjectRenderMode = 'landmarks' | 'all'

export interface MapZoomProfile {
    animationFrameInterval: number
    chunkPadding: number
    objectMode: MapObjectRenderMode
    renderPadding: number
    sceneFrameInterval: number
    showAmbientEffects: boolean
    showGrid: boolean
    showPlants: boolean
}

export function getMapZoomProfile(scale: number): MapZoomProfile {
    if (scale < 0.52) {
        return {
            animationFrameInterval: Number.POSITIVE_INFINITY,
            chunkPadding: 0,
            objectMode: 'landmarks',
            renderPadding: 0,
            sceneFrameInterval: Number.POSITIVE_INFINITY,
            showAmbientEffects: false,
            showGrid: false,
            showPlants: false,
        }
    }

    if (scale < 0.82) {
        return {
            animationFrameInterval: 1000 / 18,
            chunkPadding: 1,
            objectMode: 'all',
            renderPadding: 1,
            sceneFrameInterval: Number.POSITIVE_INFINITY,
            showAmbientEffects: false,
            showGrid: true,
            showPlants: scale >= 0.68,
        }
    }

    if (scale < 1.16) {
        return {
            animationFrameInterval: 1000 / 24,
            chunkPadding: 2,
            objectMode: 'all',
            renderPadding: 2,
            sceneFrameInterval: 1000,
            showAmbientEffects: true,
            showGrid: true,
            showPlants: true,
        }
    }

    return {
        animationFrameInterval: 1000 / 30,
        chunkPadding: 3,
        objectMode: 'all',
        renderPadding: 3,
        sceneFrameInterval: 1000,
        showAmbientEffects: true,
        showGrid: true,
        showPlants: true,
    }
}

export function canAnimateZoomProfile(profile: MapZoomProfile) {
    return Number.isFinite(profile.animationFrameInterval)
}

export function canRenderDetailedObjects(profile: MapZoomProfile) {
    return profile.objectMode === 'all'
}
