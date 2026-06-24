import {maxOwnerLabelScale, tileSize} from './config'
import {DEFAULT_HOME_COLOR, getThemeStrokeColor, hexToRgba, normalizeHexColor} from './colorUtils'
import {parseLandChunkKey, rectIntersectsBounds} from './landChunks'
import type {TileBounds} from './landChunks'
import type {MapObject, Tile} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

type TileLookup = (x: number, y: number) => Tile | null
type PlacementMode = 'pioneer' | 'deed' | null

export interface ClaimPreviewState {
    visible: boolean
    x: number
    y: number
    valid: boolean
    tile: Tile | null
}

export interface DrawOverlayHighlightsOptions {
    cameraScale: number
    canClaimDeedTile: (tile: Tile) => boolean
    claimPreview: ClaimPreviewState
    isTileCropActionPending: (tile: Tile) => boolean
    landPlacementMode: PlacementMode
    landPlacementSize: number
    ownLandColor?: string | null
    selectedMapObject: MapObject | null
    selectedTile: Tile | null
    tileAt: TileLookup
}

export interface DrawOwnLandBoundaryHighlightsOptions {
    cameraScale: number
    ownLandColor?: string | null
    tileAt: TileLookup
}

export interface DrawLandChunkLoadingOverlaysOptions {
    cameraScale: number
    loadingLandChunks: ReadonlySet<string>
    loadingMapItemChunks: ReadonlySet<string>
}

export function drawOverlayHighlights(
    context: PixiDrawContext,
    bounds: TileBounds,
    timestamp: number,
    options: DrawOverlayHighlightsOptions,
) {
    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!tile) continue

            drawTileOverlay(context, tile, timestamp, options)
        }
    }

    drawClaimPreview(context, bounds, timestamp, options)
    drawSelectedMapObjectOverlay(context, bounds, options.selectedMapObject)
}

export function drawOwnLandBoundaryHighlights(
    context: PixiDrawContext,
    bounds: TileBounds,
    timestamp: number,
    options: DrawOwnLandBoundaryHighlightsOptions,
) {
    if (options.cameraScale < maxOwnerLabelScale) return

    const innerLineWidth = Math.max(1.8, 3.4 / options.cameraScale)
    const outerLineWidth = Math.max(innerLineWidth + 2.6 / options.cameraScale, 6 / options.cameraScale)
    const inset = outerLineWidth / 2
    const alpha = 0.68 + Math.sin(timestamp / 520) * 0.08
    const highlightColor = getOwnLandHighlightColor(bounds, options)
    const outlineColor = getThemeStrokeColor(highlightColor)

    context.save()
    context.lineJoin = 'round'
    context.lineCap = 'square'
    context.beginPath()

    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!isOwnLandTile(tile)) continue

            const left = tile.x * tileSize
            const top = tile.y * tileSize
            const right = left + tileSize
            const bottom = top + tileSize

            if (!isOwnLandTile(options.tileAt(tile.x, tile.y - 1))) {
                context.moveTo(left + inset, top + inset)
                context.lineTo(right - inset, top + inset)
            }
            if (!isOwnLandTile(options.tileAt(tile.x + 1, tile.y))) {
                context.moveTo(right - inset, top + inset)
                context.lineTo(right - inset, bottom - inset)
            }
            if (!isOwnLandTile(options.tileAt(tile.x, tile.y + 1))) {
                context.moveTo(right - inset, bottom - inset)
                context.lineTo(left + inset, bottom - inset)
            }
            if (!isOwnLandTile(options.tileAt(tile.x - 1, tile.y))) {
                context.moveTo(left + inset, bottom - inset)
                context.lineTo(left + inset, top + inset)
            }
        }
    }

    context.strokeStyle = hexToRgba(outlineColor, 0.88)
    context.lineWidth = outerLineWidth
    context.stroke()
    context.strokeStyle = hexToRgba(highlightColor, Math.min(1, alpha + 0.18))
    context.lineWidth = innerLineWidth
    context.stroke()
    context.restore()
}

function getOwnLandHighlightColor(bounds: TileBounds, options: DrawOwnLandBoundaryHighlightsOptions) {
    const explicitOwnerColor = normalizeHexColor(options.ownLandColor ?? '')
    if (explicitOwnerColor) return explicitOwnerColor

    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            const tileColor = normalizeHexColor(tile?.themeColor ?? '')
            if (isOwnLandTile(tile) && tileColor && tileColor !== DEFAULT_HOME_COLOR) return tileColor
        }
    }

    return '#2f8f83'
}

function isOwnLandTile(tile: Tile | null): tile is Tile {
    return Boolean(tile && tile.terrain !== 'home' && tile.ownerType === 'player')
}

export function drawLandChunkLoadingOverlays(
    context: PixiDrawContext,
    bounds: TileBounds,
    timestamp: number,
    options: DrawLandChunkLoadingOverlaysOptions,
) {
    if ((options.loadingLandChunks.size === 0 && options.loadingMapItemChunks.size === 0) || options.cameraScale < 0.28) return

    const pulse = 0.16 + Math.sin(timestamp / 260) * 0.05

    context.save()
    drawChunkLoadingOverlayPass(context, bounds, options.loadingLandChunks, {
        cameraScale: options.cameraScale,
        fill: `rgba(255, 248, 220, ${pulse})`,
        inset: 3,
        stroke: 'rgba(255, 242, 167, 0.58)',
    })
    drawChunkLoadingOverlayPass(context, bounds, options.loadingMapItemChunks, {
        cameraScale: options.cameraScale,
        fill: `rgba(218, 239, 255, ${Math.max(0.1, pulse - 0.02)})`,
        inset: 8,
        stroke: 'rgba(143, 199, 232, 0.5)',
    })
    context.restore()
}

interface ChunkLoadingOverlayPassOptions {
    cameraScale: number
    fill: string
    inset: number
    stroke: string
}

function drawChunkLoadingOverlayPass(
    context: PixiDrawContext,
    bounds: TileBounds,
    chunkKeys: ReadonlySet<string>,
    options: ChunkLoadingOverlayPassOptions,
) {
    for (const key of chunkKeys) {
        const chunk = parseLandChunkKey(key)
        if (!chunk || !rectIntersectsBounds(chunk, bounds)) continue

        const left = chunk.x * tileSize
        const top = chunk.y * tileSize
        const width = chunk.w * tileSize
        const height = chunk.h * tileSize
        const inset = Math.min(options.inset / options.cameraScale, Math.max(0, width / 2 - 2), Math.max(0, height / 2 - 2))

        context.fillStyle = options.fill
        context.fillRect(left, top, width, height)
        context.strokeStyle = options.stroke
        context.lineWidth = Math.max(1.5, 2 / options.cameraScale)
        context.setLineDash([10 / options.cameraScale, 8 / options.cameraScale])
        context.strokeRect(left + inset, top + inset, width - inset * 2, height - inset * 2)
        context.setLineDash([])
    }
}

function drawTileOverlay(
    context: PixiDrawContext,
    tile: Tile,
    timestamp: number,
    options: DrawOverlayHighlightsOptions,
) {
    const left = tile.x * tileSize
    const top = tile.y * tileSize
    const selected = !options.selectedMapObject && options.selectedTile?.id === tile.id
    const cropActionPending = options.isTileCropActionPending(tile)

    if (options.landPlacementMode === 'deed' && options.canClaimDeedTile(tile)) {
        const pulse = 0.22 + Math.sin(timestamp / 420) * 0.09
        context.fillStyle = `rgba(255, 214, 87, ${pulse + 0.08})`
        context.fillRect(left + 7, top + 7, tileSize - 14, tileSize - 14)
        context.strokeStyle = '#ffe68a'
        context.lineWidth = 3
        context.setLineDash([12, 8])
        context.strokeRect(left + 7, top + 7, tileSize - 14, tileSize - 14)
        context.setLineDash([])
    }

    if (selected) {
        context.fillStyle = 'rgba(255, 246, 177, 0.16)'
        context.fillRect(left + 4, top + 4, tileSize - 8, tileSize - 8)
        context.strokeStyle = '#fff2a7'
        context.lineWidth = 5
        context.strokeRect(left + 3, top + 3, tileSize - 6, tileSize - 6)
    }

    if (cropActionPending) {
        drawTileLoadingOverlay(context, tile, timestamp)
    }
}

function drawTileLoadingOverlay(context: PixiDrawContext, tile: Tile, timestamp: number) {
    const left = tile.x * tileSize
    const top = tile.y * tileSize
    const centerX = left + tileSize / 2
    const centerY = top + tileSize / 2
    const angle = timestamp / 180

    context.save()
    context.fillStyle = 'rgba(255, 248, 220, 0.5)'
    context.fillRect(left + 6, top + 6, tileSize - 12, tileSize - 12)
    context.strokeStyle = '#7f9b59'
    context.lineWidth = 4
    context.lineCap = 'round'
    context.beginPath()
    context.arc(centerX, centerY, 12, angle, angle + Math.PI * 1.35)
    context.stroke()
    context.restore()
}

function drawClaimPreview(
    context: PixiDrawContext,
    bounds: TileBounds,
    timestamp: number,
    options: DrawOverlayHighlightsOptions,
) {
    const mode = options.landPlacementMode
    const claimPreview = options.claimPreview
    if (!mode || !claimPreview.visible || !claimPreview.tile) return

    const placementSize = options.landPlacementSize
    if (claimPreview.x + placementSize - 1 < bounds.startX || claimPreview.x > bounds.endX) return
    if (claimPreview.y + placementSize - 1 < bounds.startY || claimPreview.y > bounds.endY) return

    const left = claimPreview.x * tileSize
    const top = claimPreview.y * tileSize
    const size = tileSize * placementSize
    const valid = claimPreview.valid
    const pulse = 0.22 + Math.sin(timestamp / 260) * 0.07
    const fill = valid ? `rgba(97, 171, 94, ${pulse + 0.16})` : `rgba(204, 77, 63, ${pulse + 0.12})`
    const stroke = valid ? '#e8ffd6' : '#ffd0c8'

    context.save()
    context.fillStyle = fill
    context.fillRect(left + 4, top + 4, size - 8, size - 8)
    context.strokeStyle = stroke
    context.lineWidth = 4
    context.setLineDash(valid ? [] : [10, 8])
    context.strokeRect(left + 5, top + 5, size - 10, size - 10)
    context.setLineDash([])

    if (mode === 'deed') {
        drawDeedPreviewIcon(context, left, top, size, valid)
        context.restore()
        return
    }

    const roof = valid ? '#9f6a3a' : '#9a4c42'
    const wall = valid ? 'rgba(255, 242, 204, 0.88)' : 'rgba(255, 223, 209, 0.86)'
    const houseLeft = left + size * 0.27
    const houseTop = top + size * 0.33
    const houseWidth = size * 0.46
    const houseHeight = size * 0.36
    context.fillStyle = roof
    triangle(context, houseLeft - 9, houseTop + 8, houseLeft + houseWidth / 2, houseTop - 17, houseLeft + houseWidth + 9, houseTop + 8)
    context.fillStyle = wall
    context.strokeStyle = valid ? '#7f5c35' : '#8e3f38'
    context.lineWidth = 2.5
    context.beginPath()
    context.roundRect(houseLeft, houseTop + 6, houseWidth, houseHeight, 6)
    context.fill()
    context.stroke()
    context.fillStyle = valid ? '#6a8f45' : '#b95549'
    context.fillRect(houseLeft + houseWidth * 0.42, houseTop + houseHeight * 0.46, houseWidth * 0.16, houseHeight * 0.52)
    drawPioneerPreviewCoordinateLabel(context, left, top, size, claimPreview.x, claimPreview.y, options.cameraScale)
    context.restore()
}

function drawPioneerPreviewCoordinateLabel(
    context: PixiDrawContext,
    left: number,
    top: number,
    size: number,
    x: number,
    y: number,
    cameraScale: number,
) {
    if (cameraScale < 0.46) return

    const label = `${x},${y}`
    const centerX = left + size / 2
    const inverseScale = 1 / Math.min(1, cameraScale)
    const fontSize = cameraScale < 0.86 ? 10 * inverseScale : 11
    const paddingX = 7 * inverseScale
    const height = 20 * inverseScale

    context.font = `900 ${fontSize}px sans-serif`
    const width = Math.min(size - 10, context.measureText(label).width + paddingX * 2)
    const labelLeft = centerX - width / 2
    const labelTop = top - height - 4 * inverseScale

    context.fillStyle = 'rgba(255, 247, 223, 0.94)'
    context.strokeStyle = '#9b6a38'
    context.lineWidth = 2 * inverseScale
    context.beginPath()
    context.roundRect(labelLeft, labelTop, width, height, 6 * inverseScale)
    context.fill()
    context.stroke()
    context.fillStyle = '#3b3120'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, centerX, labelTop + height / 2)
}

function drawDeedPreviewIcon(context: PixiDrawContext, left: number, top: number, size: number, valid: boolean) {
    const paperLeft = left + size * 0.25
    const paperTop = top + size * 0.2
    const paperWidth = size * 0.5
    const paperHeight = size * 0.6

    context.fillStyle = valid ? 'rgba(255, 245, 206, 0.92)' : 'rgba(255, 225, 214, 0.9)'
    context.strokeStyle = valid ? '#8c6a35' : '#8e3f38'
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(paperLeft, paperTop, paperWidth, paperHeight, 5)
    context.fill()
    context.stroke()
    context.strokeStyle = valid ? '#b68a45' : '#b95549'
    context.lineWidth = 2
    for (let i = 0; i < 3; i += 1) {
        const y = paperTop + paperHeight * (0.32 + i * 0.18)
        context.beginPath()
        context.moveTo(paperLeft + paperWidth * 0.2, y)
        context.lineTo(paperLeft + paperWidth * 0.8, y)
        context.stroke()
    }
}

function drawSelectedMapObjectOverlay(context: PixiDrawContext, bounds: TileBounds, object: MapObject | null) {
    if (!object || !objectIntersectsBounds(object, bounds)) return

    const left = object.x * tileSize
    const top = object.y * tileSize
    const width = object.width * tileSize
    const height = object.height * tileSize

    context.fillStyle = 'rgba(255, 246, 177, 0.16)'
    context.fillRect(left + 5, top + 5, width - 10, height - 10)
    context.strokeStyle = '#fff2a7'
    context.lineWidth = 5
    context.strokeRect(left + 4, top + 4, width - 8, height - 8)
}

function objectIntersectsBounds(object: MapObject, bounds: TileBounds) {
    return object.x + object.width >= bounds.startX &&
        object.x <= bounds.endX &&
        object.y + object.height >= bounds.startY &&
        object.y <= bounds.endY
}

function triangle(
    context: PixiDrawContext,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
) {
    context.beginPath()
    context.moveTo(ax, ay)
    context.lineTo(bx, by)
    context.lineTo(cx, cy)
    context.closePath()
    context.fill()
}
