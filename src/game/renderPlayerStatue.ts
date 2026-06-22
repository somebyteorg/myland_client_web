import {getThemeStrokeColor, hexToRgba, mixHexColor, resolveThemeColor} from './colorUtils'
import {tileSize} from './config'
import type {MapObject} from './types'

type StatueImageStatus = 'loading' | 'ready' | 'error'

interface StatueImageCacheEntry {
    image: HTMLImageElement
    status: StatueImageStatus
}

interface CircularStatueOptions {
    centerX: number
    centerY: number
    image: HTMLImageElement | null
    radius: number
    shimmer: number
    strokeColor: string
    themeColor: string
}

const statueImageCache = new Map<string, StatueImageCacheEntry>()

export function drawPlayerStatueObject(
    context: CanvasRenderingContext2D,
    object: MapObject,
    timestamp: number,
    requestDraw: () => void,
) {
    if (object.width <= 0 || object.height <= 0) return

    const width = object.width * tileSize
    const height = object.height * tileSize
    const centerX = object.x * tileSize + width / 2
    const centerY = object.y * tileSize + height / 2
    const radius = Math.min(width, height) * 0.42
    const themeColor = resolveThemeColor(object.ownerData?.color, '#8f8a70')
    const strokeColor = getThemeStrokeColor(themeColor)
    const image = getPlayerStatueImage(object.playerStatueUrl, requestDraw)
    const shimmer = 0.1 + ((Math.sin(timestamp / 1260 + object.x * 0.42 + object.y * 0.2) + 1) / 2) * 0.1

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    drawCircularStatue(context, {
        centerX,
        centerY,
        image,
        radius,
        shimmer,
        strokeColor,
        themeColor,
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
        image,
        status: 'loading',
    }
    statueImageCache.set(source, entry)
    image.onload = () => {
        entry.status = 'ready'
        requestDraw()
    }
    image.onerror = () => {
        entry.status = 'error'
        requestDraw()
    }
    image.src = source

    return null
}

function drawCircularStatue(context: CanvasRenderingContext2D, options: CircularStatueOptions) {
    const {centerX, centerY, image, radius, shimmer, strokeColor, themeColor} = options
    const outlineColor = mixHexColor(strokeColor, '#3a3123', 0.58)
    const stoneLight = mixHexColor(themeColor, '#f2ecdc', 0.78)
    const stoneMid = mixHexColor(themeColor, '#c7b899', 0.5)
    const stoneDark = mixHexColor(themeColor, '#837462', 0.2)
    const innerRadius = radius * 0.74
    const depthX = radius * 0.12
    const depthY = radius * 0.14

    drawCircularDepth(context, centerX, centerY, radius, depthX, depthY, outlineColor, stoneDark, themeColor)

    const outerGradient = context.createRadialGradient(
        centerX - radius * 0.32,
        centerY - radius * 0.38,
        radius * 0.12,
        centerX,
        centerY,
        radius,
    )
    outerGradient.addColorStop(0, stoneLight)
    outerGradient.addColorStop(0.62, stoneMid)
    outerGradient.addColorStop(1, stoneDark)

    context.fillStyle = outerGradient
    context.strokeStyle = hexToRgba(outlineColor, 0.88)
    context.lineWidth = Math.max(2, radius * 0.06)
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    context.strokeStyle = hexToRgba(outlineColor, 0.32)
    context.lineWidth = Math.max(1.6, radius * 0.045)
    context.beginPath()
    context.arc(centerX, centerY, radius * 0.96, 0.05, 1.42)
    context.stroke()

    context.strokeStyle = hexToRgba('#fff8e6', 0.34 + shimmer)
    context.lineWidth = Math.max(1.4, radius * 0.035)
    context.beginPath()
    context.arc(centerX, centerY, radius * 0.86, -2.7, -0.68)
    context.stroke()

    context.strokeStyle = hexToRgba(outlineColor, 0.26)
    context.lineWidth = Math.max(1, radius * 0.025)
    context.beginPath()
    context.arc(centerX, centerY, innerRadius + radius * 0.09, 0, Math.PI * 2)
    context.stroke()

    drawCircularRelief(context, {
        centerX,
        centerY,
        image,
        radius: innerRadius,
        shimmer,
        strokeColor: outlineColor,
        themeColor,
    })

    drawCircularMarks(context, centerX, centerY, radius, outlineColor, themeColor)
}

function drawCircularDepth(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    depthX: number,
    depthY: number,
    outlineColor: string,
    sideColor: string,
    themeColor: string,
) {
    const layerCount = 6
    const sideLight = mixHexColor(themeColor, '#d5c29c', 0.28)
    const sideDark = mixHexColor(outlineColor, '#4e4030', 0.62)

    for (let index = layerCount; index >= 1; index -= 1) {
        const ratio = index / layerCount
        const layerX = centerX + depthX * ratio
        const layerY = centerY + depthY * ratio
        const layerGradient = context.createRadialGradient(
            layerX - radius * 0.28,
            layerY - radius * 0.34,
            radius * 0.12,
            layerX,
            layerY,
            radius,
        )

        layerGradient.addColorStop(0, sideLight)
        layerGradient.addColorStop(0.58, sideColor)
        layerGradient.addColorStop(1, sideDark)
        context.fillStyle = layerGradient
        context.strokeStyle = hexToRgba(outlineColor, 0.18 + ratio * 0.18)
        context.lineWidth = Math.max(1, radius * 0.03)
        context.beginPath()
        context.arc(layerX, layerY, radius, 0, Math.PI * 2)
        context.fill()
        context.stroke()
    }

    context.strokeStyle = hexToRgba('#fff7df', 0.18)
    context.lineWidth = Math.max(1, radius * 0.025)
    context.beginPath()
    context.arc(centerX + depthX * 0.36, centerY + depthY * 0.36, radius * 0.98, -2.68, -0.78)
    context.stroke()

    context.strokeStyle = hexToRgba(sideDark, 0.3)
    context.lineWidth = Math.max(1.2, radius * 0.035)
    context.beginPath()
    context.arc(centerX + depthX, centerY + depthY, radius * 0.99, 0.16, 1.48)
    context.stroke()
}

function drawCircularRelief(
    context: CanvasRenderingContext2D,
    options: {
        centerX: number
        centerY: number
        image: HTMLImageElement | null
        radius: number
        shimmer: number
        strokeColor: string
        themeColor: string
    },
) {
    const {centerX, centerY, image, radius, shimmer, strokeColor, themeColor} = options
    const stoneTint = mixHexColor(themeColor, '#b4a588', 0.28)

    context.save()
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.clip()

    context.fillStyle = mixHexColor(themeColor, '#e6dcc6', 0.72)
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)

    if (image) {
        context.save()
        context.globalAlpha = 0.78
        drawStatueImageCover(context, image, centerX - radius, centerY - radius, radius * 2, radius * 2)
        context.restore()
    } else {
        drawReliefFallback(context, centerX, centerY, radius, strokeColor, stoneTint)
    }

    const tintGradient = context.createRadialGradient(
        centerX - radius * 0.34,
        centerY - radius * 0.38,
        radius * 0.1,
        centerX,
        centerY,
        radius,
    )
    tintGradient.addColorStop(0, hexToRgba('#fffaf0', 0.28 + shimmer))
    tintGradient.addColorStop(0.58, hexToRgba(stoneTint, image ? 0.2 : 0.1))
    tintGradient.addColorStop(1, hexToRgba(strokeColor, 0.28))
    context.fillStyle = tintGradient
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
    context.restore()

    context.strokeStyle = hexToRgba(strokeColor, 0.5)
    context.lineWidth = Math.max(1.4, radius * 0.06)
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.stroke()
}

function drawReliefFallback(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    strokeColor: string,
    stoneTint: string,
) {
    context.fillStyle = hexToRgba(stoneTint, 0.5)
    context.beginPath()
    context.ellipse(centerX, centerY - radius * 0.25, radius * 0.26, radius * 0.33, 0, 0, Math.PI * 2)
    context.fill()

    context.beginPath()
    context.moveTo(centerX - radius * 0.38, centerY + radius * 0.42)
    context.quadraticCurveTo(centerX, centerY + radius * 0.02, centerX + radius * 0.38, centerY + radius * 0.42)
    context.quadraticCurveTo(centerX + radius * 0.2, centerY + radius * 0.62, centerX, centerY + radius * 0.62)
    context.quadraticCurveTo(centerX - radius * 0.2, centerY + radius * 0.62, centerX - radius * 0.38, centerY + radius * 0.42)
    context.fill()

    context.strokeStyle = hexToRgba(strokeColor, 0.44)
    context.lineWidth = Math.max(1.2, radius * 0.045)
    context.beginPath()
    context.moveTo(centerX - radius * 0.2, centerY + radius * 0.1)
    context.quadraticCurveTo(centerX, centerY + radius * 0.22, centerX + radius * 0.2, centerY + radius * 0.1)
    context.moveTo(centerX, centerY - radius * 0.47)
    context.quadraticCurveTo(centerX - radius * 0.08, centerY - radius * 0.24, centerX, centerY - radius * 0.04)
    context.stroke()
}

function drawCircularMarks(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    outlineColor: string,
    themeColor: string,
) {
    context.fillStyle = hexToRgba(themeColor, 0.42)

    for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI * 0.86 + index * (Math.PI * 1.72 / 9)
        const x = centerX + Math.cos(angle) * radius * 0.9
        const y = centerY + Math.sin(angle) * radius * 0.9

        context.beginPath()
        context.arc(x, y, Math.max(1.1, radius * 0.035), 0, Math.PI * 2)
        context.fill()
    }

    context.strokeStyle = hexToRgba(outlineColor, 0.18)
    context.lineWidth = Math.max(1, radius * 0.024)
    context.beginPath()
    context.arc(centerX, centerY, radius * 0.55, 0.18, Math.PI - 0.18)
    context.stroke()
}

function drawStatueImageCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    left: number,
    top: number,
    width: number,
    height: number,
) {
    const scale = Math.max(width / image.width, height / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    const drawLeft = left + (width - drawWidth) / 2
    const drawTop = top + (height - drawHeight) / 2

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, drawLeft, drawTop, drawWidth, drawHeight)
}
