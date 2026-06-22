export interface LandChunkRequest {
    x: number
    y: number
    w: number
    h: number
}

export interface TileBounds {
    startX: number
    startY: number
    endX: number
    endY: number
}

export interface ChunkAnchorRect {
    x: number
    y: number
    width: number
    height: number
}

export interface ViewportChunkBoundsOptions {
    mapReady: boolean
    mapWidth: number
    mapHeight: number
    tileSize: number
    camera: {
        x: number
        y: number
        scale: number
    }
    viewport: {
        width: number
        height: number
    }
    padding?: number
    fallbackAnchor?: ChunkAnchorRect | null
}

interface TileRange {
    start: number
    length: number
}

export function getLandChunkTargetSize(targetSize: number, apiMaxSize: number) {
    return Math.min(targetSize, apiMaxSize)
}

export function getAlignedLandChunkRequests(bounds: TileBounds, chunkSize: number, mapWidth: number, mapHeight: number): LandChunkRequest[] {
    const xRanges = splitAlignedTileRange(bounds.startX, bounds.endX, chunkSize, mapWidth)
    const yRanges = splitAlignedTileRange(bounds.startY, bounds.endY, chunkSize, mapHeight)
    const chunks: LandChunkRequest[] = []

    for (const yRange of yRanges) {
        for (const xRange of xRanges) {
            chunks.push({
                x: xRange.start,
                y: yRange.start,
                w: xRange.length,
                h: yRange.length,
            })
        }
    }

    return chunks
}

export function canLoadLandChunks(mapReady: boolean, homeAnchor: ChunkAnchorRect | null, placementMode: 'pioneer' | 'deed' | null) {
    return mapReady && (Boolean(homeAnchor) || placementMode === 'pioneer')
}

export function getViewportChunkBounds(options: ViewportChunkBoundsOptions): TileBounds | null {
    if (!options.mapReady || options.mapWidth <= 0 || options.mapHeight <= 0) return null

    const padding = options.padding ?? 0
    if (options.viewport.width <= 0 || options.viewport.height <= 0) {
        return getFallbackChunkBounds(options.mapWidth, options.mapHeight, padding, options.fallbackAnchor)
    }

    const left = Math.floor((-options.camera.x / options.camera.scale) / options.tileSize) - padding
    const top = Math.floor((-options.camera.y / options.camera.scale) / options.tileSize) - padding
    const right = Math.ceil(((options.viewport.width - options.camera.x) / options.camera.scale) / options.tileSize) + padding
    const bottom = Math.ceil(((options.viewport.height - options.camera.y) / options.camera.scale) / options.tileSize) + padding

    return clampTileBounds({
        startX: left,
        startY: top,
        endX: right,
        endY: bottom,
    }, options.mapWidth, options.mapHeight)
}

export function getFallbackChunkBounds(mapWidth: number, mapHeight: number, padding = 0, anchor?: ChunkAnchorRect | null): TileBounds | null {
    if (mapWidth <= 0 || mapHeight <= 0) return null
    if (anchor) {
        return clampTileBounds({
            startX: anchor.x - padding,
            startY: anchor.y - padding,
            endX: anchor.x + anchor.width - 1 + padding,
            endY: anchor.y + anchor.height - 1 + padding,
        }, mapWidth, mapHeight)
    }

    const centerX = Math.floor(mapWidth / 2)
    const centerY = Math.floor(mapHeight / 2)

    return clampTileBounds({
        startX: centerX - padding,
        startY: centerY - padding,
        endX: centerX + padding,
        endY: centerY + padding,
    }, mapWidth, mapHeight)
}

function clampTileBounds(bounds: TileBounds, mapWidth: number, mapHeight: number): TileBounds {
    return {
        startX: Math.max(0, bounds.startX),
        startY: Math.max(0, bounds.startY),
        endX: Math.min(mapWidth - 1, bounds.endX),
        endY: Math.min(mapHeight - 1, bounds.endY),
    }
}

function splitAlignedTileRange(start: number, end: number, maxLength: number, mapLength: number): TileRange[] {
    const ranges: TileRange[] = []
    const firstSegment = Math.floor(start / maxLength)
    const lastSegment = Math.floor(end / maxLength)

    for (let segment = firstSegment; segment <= lastSegment; segment += 1) {
        const segmentStart = segment * maxLength
        ranges.push({
            start: segmentStart,
            length: Math.min(maxLength, mapLength - segmentStart),
        })
    }

    return ranges.filter((range) => range.length > 0)
}

export function getLandChunkKey(chunk: LandChunkRequest) {
    return `${chunk.x},${chunk.y},${chunk.w},${chunk.h}`
}

export function parseLandChunkKey(key: string): LandChunkRequest | null {
    const [x, y, w, h] = key.split(',').map(Number)
    if (![x, y, w, h].every(Number.isFinite)) return null

    return {x, y, w, h}
}

export function rectIntersectsBounds(rect: LandChunkRequest, bounds: TileBounds) {
    return rect.x + rect.w - 1 >= bounds.startX &&
        rect.x <= bounds.endX &&
        rect.y + rect.h - 1 >= bounds.startY &&
        rect.y <= bounds.endY
}
