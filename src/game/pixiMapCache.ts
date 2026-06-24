import {Container, Rectangle, Sprite} from 'pixi.js'
import type {Renderer, Texture} from 'pixi.js'
import {tileSize} from './config'
import type {CameraState} from './mapCamera'
import {getVisibleTileBounds} from './mapCamera'
import {getCameraDrawOffset} from './renderCamera'
import {getMapZoomProfile} from './mapZoomProfile'
import {drawOverviewStaticTile, drawStaticTile} from './renderMapTiles'
import {PixiDrawContext} from './pixiDrawContext'
import type {Tile} from './types'

type TileLookup = (x: number, y: number) => Tile | null
type StaticChunkDetail = 'detail' | 'high' | 'overview'

export interface PixiStaticMapCacheStats {
    builtLastFrame: number
    cachedChunks: number
    currentDetail: StaticChunkDetail | 'none'
    mapVersion: number
    pendingChunks: number
    prunedLastFrame: number
    texturePixels: number
    visibleChunks: number
}

interface SyncPixiStaticMapOptions {
    bounds: {
        width: number
        height: number
    }
    camera: CameraState
    mapHeight: number
    mapVersion: number
    mapWidth: number
    requestDraw: () => void
    renderer: Renderer
    tileAt: TileLookup
}

interface CachedStaticChunk {
    key: string
    lastUsed: number
    mapVersion: number
    sprite: Sprite
    texture: Texture
    texturePixels: number
}

interface PendingStaticChunk {
    chunkSize: number
    chunkX: number
    chunkY: number
    detail: StaticChunkDetail
    key: string
    mapVersion: number
}

const overviewStaticScale = 0.62
const detailChunkSize = 16
const overviewChunkSize = 32
const highMinimumCachedChunks = 10
const detailMinimumCachedChunks = 20
const overviewMinimumCachedChunks = 24
const highMaxBuildChunksPerFrame = 2
const detailMaxBuildChunksPerFrame = 3
const overviewMaxBuildChunksPerFrame = 5
const staticChunkBuildBudgetMs = 8
const highMaxCachedChunks = 18
const detailMaxCachedChunks = 32
const overviewMaxCachedChunks = 36

export class PixiStaticMapCache {
    private chunks = new Map<string, CachedStaticChunk>()
    private frame = 0
    private layer: Container | null = null
    private lastBuiltChunks = 0
    private lastPrunedChunks = 0
    private mapHeight = 0
    private mapVersion = -1
    private mapWidth = 0
    private pendingChunks = new Map<string, PendingStaticChunk>()
    private stats: PixiStaticMapCacheStats = {
        builtLastFrame: 0,
        cachedChunks: 0,
        currentDetail: 'none',
        mapVersion: -1,
        pendingChunks: 0,
        prunedLastFrame: 0,
        texturePixels: 0,
        visibleChunks: 0,
    }

    sync(layer: Container, options: SyncPixiStaticMapOptions) {
        this.lastBuiltChunks = 0
        this.lastPrunedChunks = 0
        if (this.layer && this.layer !== layer) this.clear()
        this.layer = layer

        const mapShapeChanged = this.mapWidth !== options.mapWidth || this.mapHeight !== options.mapHeight
        if (mapShapeChanged) {
            this.clear()
        }
        this.mapWidth = options.mapWidth
        this.mapHeight = options.mapHeight
        if (this.mapVersion !== options.mapVersion) {
            this.pendingChunks.clear()
            this.mapVersion = options.mapVersion
        }

        if (options.mapWidth <= 0 || options.mapHeight <= 0) {
            this.clear()
            return
        }

        const detail = getStaticChunkDetail(options.camera.scale)
        const profile = getMapZoomProfile(options.camera.scale)
        const chunkSize = getChunkSize(detail)
        const bounds = getVisibleTileBounds(
            options.camera,
            options.bounds.width,
            options.bounds.height,
            options.mapWidth,
            options.mapHeight,
            Math.min(1, profile.renderPadding),
        )
        const startChunkX = Math.floor(bounds.startX / chunkSize)
        const startChunkY = Math.floor(bounds.startY / chunkSize)
        const endChunkX = Math.floor(bounds.endX / chunkSize)
        const endChunkY = Math.floor(bounds.endY / chunkSize)
        const visibleKeys = new Set<string>()
        const offset = getCameraDrawOffset(options.camera)

        layer.position.set(offset.x, offset.y)
        layer.scale.set(options.camera.scale)

        for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
            for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
                const key = getChunkKey(detail, chunkX, chunkY)
                visibleKeys.add(key)

                const chunk = this.chunks.get(key)
                if (chunk?.mapVersion === options.mapVersion) {
                    chunk.lastUsed = ++this.frame
                    if (chunk.sprite.parent !== layer) layer.addChild(chunk.sprite)
                } else {
                    if (chunk) {
                        chunk.lastUsed = ++this.frame
                        if (chunk.sprite.parent !== layer) layer.addChild(chunk.sprite)
                    }

                    const pendingChunk = this.pendingChunks.get(key)
                    if (pendingChunk?.mapVersion === options.mapVersion) continue

                    this.pendingChunks.set(key, {
                        chunkSize,
                        chunkX,
                        chunkY,
                        detail,
                        key,
                        mapVersion: options.mapVersion,
                    })
                }
            }
        }

        this.dropStalePendingChunks(visibleKeys)
        const hasPendingVisibleChunks = this.buildPendingVisibleChunks(layer, visibleKeys, options)
        if (!hasPendingVisibleChunks) {
            this.detachHiddenChunks(layer, visibleKeys)
            this.pruneChunks(visibleKeys, detail)
        }
        this.updateStats(detail, visibleKeys.size)
        if (hasPendingVisibleChunks) {
            options.requestDraw()
        }
    }

    destroy() {
        this.clear()
        this.layer = null
    }

    getStats() {
        return {...this.stats}
    }

    private clear() {
        this.pendingChunks.clear()
        this.mapHeight = 0
        this.mapWidth = 0
        for (const chunk of this.chunks.values()) {
            destroyStaticChunk(chunk)
        }
        this.chunks.clear()
        this.detachLayerChildren(this.layer)
        this.updateStats('none', 0)
    }

    private detachLayerChildren(layer: Container | null) {
        if (!layer) return

        layer.removeChildren()
    }

    private detachHiddenChunks(layer: Container, visibleKeys: Set<string>) {
        for (const chunk of this.chunks.values()) {
            if (visibleKeys.has(chunk.key) || chunk.sprite.parent !== layer) continue

            layer.removeChild(chunk.sprite)
        }
    }

    private pruneChunks(visibleKeys: Set<string>, detail: StaticChunkDetail) {
        const maxChunks = getMaxCachedChunks(detail, visibleKeys.size)
        if (this.chunks.size <= maxChunks) return

        const removable = Array.from(this.chunks.values())
            .filter((chunk) => !visibleKeys.has(chunk.key))
            .sort((left, right) => {
                const leftVersionRank = left.mapVersion === this.mapVersion ? 1 : 0
                const rightVersionRank = right.mapVersion === this.mapVersion ? 1 : 0

                return leftVersionRank - rightVersionRank || left.lastUsed - right.lastUsed
            })

        for (const chunk of removable) {
            if (this.chunks.size <= maxChunks) return

            destroyStaticChunk(chunk)
            this.chunks.delete(chunk.key)
            this.lastPrunedChunks += 1
        }
    }

    private buildChunk(
        key: string,
        detail: StaticChunkDetail,
        chunkX: number,
        chunkY: number,
        chunkSize: number,
        options: SyncPixiStaticMapOptions,
    ): CachedStaticChunk {
        const startX = chunkX * chunkSize
        const startY = chunkY * chunkSize
        const endX = Math.min(options.mapWidth - 1, startX + chunkSize - 1)
        const endY = Math.min(options.mapHeight - 1, startY + chunkSize - 1)
        const width = (endX - startX + 1) * tileSize
        const height = (endY - startY + 1) * tileSize
        const resolution = getStaticTextureResolution(detail)
        const container = new Container()
        const context = new PixiDrawContext(container)

        context.beginFrame(container)
        context.save()
        context.translate(-startX * tileSize, -startY * tileSize)

        for (let y = startY; y <= endY; y += 1) {
            for (let x = startX; x <= endX; x += 1) {
                const tile = options.tileAt(x, y)
                if (!tile) continue

                if (detail === 'overview') drawOverviewStaticTile(context, tile)
                else drawStaticTile(context, tile, options.tileAt, options.mapWidth, options.camera.scale)
            }
        }

        context.restore()
        const texture = options.renderer.generateTexture({
            target: container,
            frame: new Rectangle(0, 0, width, height),
            resolution,
            antialias: detail !== 'overview',
            textureSourceOptions: {
                scaleMode: detail === 'high' ? 'linear' : 'nearest',
            },
        })
        texture.source.scaleMode = detail === 'high' ? 'linear' : 'nearest'
        texture.source.antialias = detail !== 'overview'
        context.destroy()

        const sprite = new Sprite(texture)
        sprite.position.set(startX * tileSize, startY * tileSize)
        sprite.roundPixels = detail !== 'high'

        return {
            key,
            lastUsed: this.frame,
            mapVersion: options.mapVersion,
            sprite,
            texture,
            texturePixels: getTexturePixelCount(width, height, resolution),
        }
    }

    private dropStalePendingChunks(visibleKeys: Set<string>) {
        for (const [key, pendingChunk] of this.pendingChunks) {
            const cachedChunk = this.chunks.get(key)
            if (!visibleKeys.has(key) || pendingChunk.mapVersion !== this.mapVersion || cachedChunk?.mapVersion === pendingChunk.mapVersion) {
                this.pendingChunks.delete(key)
            }
        }
    }

    private buildPendingVisibleChunks(layer: Container, visibleKeys: Set<string>, options: SyncPixiStaticMapOptions) {
        const pendingChunks = Array.from(this.pendingChunks.values())
            .filter((chunk) => visibleKeys.has(chunk.key) && chunk.mapVersion === options.mapVersion)
            .sort((left, right) => getChunkDistanceToViewportCenter(left, options) - getChunkDistanceToViewportCenter(right, options))
        if (pendingChunks.length === 0) return false

        const startTime = getNow()
        let builtChunks = 0

        for (const pendingChunk of pendingChunks) {
            if (builtChunks >= getMaxBuildChunksPerFrame(pendingChunk.detail)) break
            if (builtChunks > 0 && getNow() - startTime >= staticChunkBuildBudgetMs) break

            const chunk = this.buildChunk(
                pendingChunk.key,
                pendingChunk.detail,
                pendingChunk.chunkX,
                pendingChunk.chunkY,
                pendingChunk.chunkSize,
                options,
            )
            chunk.lastUsed = ++this.frame
            this.replaceChunk(layer, pendingChunk.key, chunk)
            this.pendingChunks.delete(pendingChunk.key)
            builtChunks += 1
            this.lastBuiltChunks += 1
        }

        return this.hasPendingVisibleChunks(visibleKeys, options.mapVersion)
    }

    private replaceChunk(layer: Container, key: string, nextChunk: CachedStaticChunk) {
        const previousChunk = this.chunks.get(key)

        this.chunks.set(key, nextChunk)
        if (previousChunk?.sprite.parent === layer) {
            const previousIndex = layer.getChildIndex(previousChunk.sprite)
            layer.addChildAt(nextChunk.sprite, previousIndex)
            layer.removeChild(previousChunk.sprite)
            destroyStaticChunk(previousChunk)
            return
        }

        if (nextChunk.sprite.parent !== layer) layer.addChild(nextChunk.sprite)
        if (previousChunk) {
            destroyStaticChunk(previousChunk)
        }
    }

    private hasPendingVisibleChunks(visibleKeys: Set<string>, mapVersion: number) {
        for (const pendingChunk of this.pendingChunks.values()) {
            if (pendingChunk.mapVersion === mapVersion && visibleKeys.has(pendingChunk.key)) return true
        }

        return false
    }

    private updateStats(detail: StaticChunkDetail | 'none', visibleChunks: number) {
        this.stats = {
            builtLastFrame: this.lastBuiltChunks,
            cachedChunks: this.chunks.size,
            currentDetail: detail,
            mapVersion: this.mapVersion,
            pendingChunks: this.pendingChunks.size,
            prunedLastFrame: this.lastPrunedChunks,
            texturePixels: getCachedTexturePixels(this.chunks),
            visibleChunks,
        }
    }
}

function getStaticChunkDetail(scale: number): StaticChunkDetail {
    if (scale >= 1.35) return 'high'

    return scale < overviewStaticScale ? 'overview' : 'detail'
}

function getChunkSize(detail: StaticChunkDetail) {
    return detail === 'overview' ? overviewChunkSize : detailChunkSize
}

function getMaxBuildChunksPerFrame(detail: StaticChunkDetail) {
    if (detail === 'high') return highMaxBuildChunksPerFrame

    return detail === 'overview' ? overviewMaxBuildChunksPerFrame : detailMaxBuildChunksPerFrame
}

function getMaxCachedChunks(detail: StaticChunkDetail, visibleChunkCount: number) {
    const minimumCachedChunks = detail === 'overview'
        ? overviewMinimumCachedChunks
        : detail === 'high'
            ? highMinimumCachedChunks
            : detailMinimumCachedChunks
    const cacheSlack = detail === 'overview' ? 10 : detail === 'high' ? 4 : 8
    const hardLimit = detail === 'overview'
        ? overviewMaxCachedChunks
        : detail === 'high'
            ? highMaxCachedChunks
            : detailMaxCachedChunks

    return Math.max(visibleChunkCount, Math.min(hardLimit, Math.max(minimumCachedChunks, visibleChunkCount + cacheSlack)))
}

function getStaticTextureResolution(detail: StaticChunkDetail) {
    if (detail === 'high') return 1.5
    if (detail === 'overview') return 0.5

    return 1
}

function getTexturePixelCount(width: number, height: number, resolution: number) {
    return Math.ceil(width * resolution) * Math.ceil(height * resolution)
}

function getCachedTexturePixels(chunks: Map<string, CachedStaticChunk>) {
    let pixels = 0
    for (const chunk of chunks.values()) pixels += chunk.texturePixels

    return pixels
}

function getChunkKey(detail: StaticChunkDetail, chunkX: number, chunkY: number) {
    return `${detail}:${chunkX}:${chunkY}`
}

function getChunkDistanceToViewportCenter(chunk: PendingStaticChunk, options: SyncPixiStaticMapOptions) {
    const centerTileX = ((options.bounds.width / 2 - options.camera.x) / options.camera.scale) / tileSize
    const centerTileY = ((options.bounds.height / 2 - options.camera.y) / options.camera.scale) / tileSize
    const chunkCenterX = chunk.chunkX * chunk.chunkSize + chunk.chunkSize / 2
    const chunkCenterY = chunk.chunkY * chunk.chunkSize + chunk.chunkSize / 2
    const dx = chunkCenterX - centerTileX
    const dy = chunkCenterY - centerTileY

    return dx * dx + dy * dy
}

function getNow() {
    return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function destroyStaticChunk(chunk: CachedStaticChunk) {
    if (chunk.sprite.parent) chunk.sprite.parent.removeChild(chunk.sprite)
    if (!chunk.sprite.destroyed) {
        chunk.sprite.destroy({
            children: true,
        })
    }
    if (!chunk.texture.destroyed) chunk.texture.destroy(true)
}
