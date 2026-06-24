import {getThemeStrokeColor, hexToRgba, mixHexColor, resolveThemeColor} from './colorUtils'
import {tileSize} from './config'
import type {MapObject} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

type StatueImageStatus = 'loading' | 'ready' | 'error'

interface StatueImageCacheEntry {
    image: CanvasImageSource | null
    sourceImage: HTMLImageElement
    status: StatueImageStatus
}

const statueImageCache = new Map<string, StatueImageCacheEntry>()

export function drawPlayerStatueObject(
    context: PixiDrawContext,
    object: MapObject,
    timestamp: number,
    requestDraw: () => void,
) {
    if (object.width <= 0 || object.height <= 0) return

    const width = object.width * tileSize
    const height = object.height * tileSize
    const centerX = object.x * tileSize + width / 2
    const themeColor = resolveThemeColor(object.ownerData?.color, '#8f8a70')
    const strokeColor = getThemeStrokeColor(themeColor)
    const image = getPlayerStatueImage(object.playerStatueUrl, requestDraw)
    const shimmer = 0.1 + ((Math.sin(timestamp / 1260 + object.x * 0.42 + object.y * 0.2) + 1) / 2) * 0.1

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    drawFreestandingStatue(context, object, image, {
        centerX,
        height,
        shimmer,
        strokeColor,
        themeColor,
        width,
    })
    context.restore()
}

function getPlayerStatueImage(url: string | null | undefined, requestDraw: () => void) {
    const source = url?.trim()
    if (!source) return null

    const cached = statueImageCache.get(source)
    if (cached) return cached.status === 'ready' ? cached.image : null

    const image = new Image()
    const entry: StatueImageCacheEntry = {
        image: null,
        sourceImage: image,
        status: 'loading',
    }
    statueImageCache.set(source, entry)
    image.crossOrigin = 'anonymous'
    image.onload = () => {
        entry.image = createHighResolutionStatueImage(image)
        entry.status = entry.image ? 'ready' : 'error'
        requestDraw()
    }
    image.onerror = () => {
        entry.status = 'error'
        requestDraw()
    }
    image.src = source

    return null
}

function drawFreestandingStatue(
    context: PixiDrawContext,
    object: MapObject,
    image: CanvasImageSource | null,
    options: {
        centerX: number
        height: number
        shimmer: number
        strokeColor: string
        themeColor: string
        width: number
    },
) {
    const {centerX, height, shimmer, strokeColor, themeColor, width} = options
    const drawWidth = width * 0.98
    const drawHeight = height * 0.98
    const drawSize = Math.min(drawWidth, drawHeight)
    const groundY = object.y * tileSize + height - drawSize * 0.01
    const drawLeft = centerX - drawWidth / 2
    const drawTop = groundY - drawHeight
    const shadowColor = mixHexColor(strokeColor, '#2d281f', 0.45)

    context.fillStyle = hexToRgba(shadowColor, 0.18)
    context.beginPath()
    context.ellipse(centerX + drawWidth * 0.03, groundY - drawHeight * 0.035, drawWidth * 0.3, drawSize * 0.065, 0, 0, Math.PI * 2)
    context.fill()

    if (image) {
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, drawLeft, drawTop, drawWidth, drawHeight)
    } else {
        context.save()
        context.translate(drawLeft, drawTop)
        context.scale(drawWidth / drawSize, drawHeight / drawSize)
        drawPlaceholderStatue(context, 0, 0, drawSize, {
            shimmer,
            strokeColor,
            themeColor,
        })
        context.restore()
    }

    context.fillStyle = hexToRgba(themeColor, 0.14)
    context.beginPath()
    context.ellipse(centerX, groundY - drawSize * 0.005, drawWidth * 0.23, drawSize * 0.03, 0, 0, Math.PI * 2)
    context.fill()
}

function drawPlaceholderStatue(
    context: PixiDrawContext,
    left: number,
    top: number,
    size: number,
    options: {
        shimmer: number
        strokeColor: string
        themeColor: string
    },
) {
    const {strokeColor, themeColor} = options
    const lightColor = mixHexColor(themeColor, '#f3ead7', 0.74)
    const midColor = mixHexColor(themeColor, '#b9aa8b', 0.5)
    const darkColor = mixHexColor(themeColor, '#6e6657', 0.32)
    const centerX = left + size / 2

    context.fillStyle = hexToRgba(darkColor, 0.26)
    context.beginPath()
    context.ellipse(centerX + size * 0.02, top + size * 0.87, size * 0.36, size * 0.075, 0, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = midColor
    context.strokeStyle = hexToRgba(strokeColor, 0.58)
    context.lineWidth = Math.max(1.2, size * 0.012)
    context.beginPath()
    context.moveTo(left + size * 0.31, top + size * 0.78)
    context.lineTo(left + size * 0.69, top + size * 0.78)
    context.lineTo(left + size * 0.75, top + size * 0.9)
    context.quadraticCurveTo(centerX, top + size * 0.93, left + size * 0.25, top + size * 0.9)
    context.closePath()
    context.fill()
    context.stroke()

    context.fillStyle = lightColor
    context.beginPath()
    context.ellipse(centerX, top + size * 0.75, size * 0.29, size * 0.055, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    context.fillStyle = mixHexColor(themeColor, '#d5cab1', 0.58)
    context.beginPath()
    context.moveTo(left + size * 0.27, top + size * 0.71)
    context.bezierCurveTo(left + size * 0.3, top + size * 0.56, left + size * 0.4, top + size * 0.53, left + size * 0.41, top + size * 0.45)
    context.bezierCurveTo(left + size * 0.32, top + size * 0.38, left + size * 0.35, top + size * 0.2, centerX, top + size * 0.19)
    context.bezierCurveTo(left + size * 0.65, top + size * 0.2, left + size * 0.68, top + size * 0.38, left + size * 0.59, top + size * 0.45)
    context.bezierCurveTo(left + size * 0.6, top + size * 0.53, left + size * 0.7, top + size * 0.56, left + size * 0.73, top + size * 0.71)
    context.quadraticCurveTo(left + size * 0.7, top + size * 0.8, centerX, top + size * 0.81)
    context.quadraticCurveTo(left + size * 0.3, top + size * 0.8, left + size * 0.27, top + size * 0.71)
    context.closePath()
    context.fill()
    context.stroke()

    context.strokeStyle = hexToRgba(strokeColor, 0.14)
    context.lineWidth = Math.max(1, size * 0.008)
    for (let index = 0; index < 5; index += 1) {
        const markX = left + size * (0.38 + (index % 2) * 0.14)
        const markY = top + size * (0.3 + index * 0.085)
        context.beginPath()
        context.moveTo(markX, markY)
        context.lineTo(markX + size * 0.07, markY + size * (index % 2 === 0 ? 0.014 : -0.012))
        context.stroke()
    }
}

function createHighResolutionStatueImage(image: HTMLImageElement) {
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (sourceWidth <= 0 || sourceHeight <= 0) return null

    const targetSize = Math.min(512, Math.max(192, sourceWidth, sourceHeight))
    const scale = Math.max(1, targetSize / Math.max(sourceWidth, sourceHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))

    const context = canvas.getContext('2d')
    if (!context) return null

    try {
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        context.getImageData(0, 0, 1, 1)
    } catch (error) {
        console.warn('Player statue image is not CORS-safe for WebGL texture upload.', error)
        return null
    }

    return canvas
}
