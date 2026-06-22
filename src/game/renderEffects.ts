import {canShowButterflyOnTile} from './butterflies'
import {tileSize} from './config'
import {getWatchdogPosition} from './renderObjects'
import type {TileBounds} from './landChunks'
import type {Butterfly, MapObject, Tile} from './types'

type TileLookup = (x: number, y: number) => Tile | null

export interface DrawGrassWindOptions {
    cameraScale: number
    tileAt: TileLookup
}

export interface DrawButterfliesOptions {
    butterflies: Butterfly[]
    cameraScale: number
    tileAt: TileLookup
}

export interface DrawTheftCluesOptions {
    cameraScale: number
    dog: MapObject | null
    home: MapObject | null
    tileAt: TileLookup
}

export function drawGrassWind(
    context: CanvasRenderingContext2D,
    bounds: TileBounds,
    timestamp: number,
    options: DrawGrassWindOptions,
) {
    if (options.cameraScale < 0.72) return

    const time = timestamp / 1000
    context.strokeStyle = 'rgba(214, 246, 151, 0.36)'
    context.lineWidth = 1.4

    for (let y = bounds.startY; y <= bounds.endY; y += 2) {
        let x = bounds.startX

        while (x <= bounds.endX) {
            const tile = options.tileAt(x, y)
            if (!tile || tile.terrain !== 'grass') {
                x += 1
                continue
            }

            const runStart = x
            while (x <= bounds.endX && options.tileAt(x, y)?.terrain === 'grass') {
                x += 1
            }

            const runEnd = x - 1
            if (runEnd - runStart < 1) continue

            const start = runStart * tileSize + 8
            const end = (runEnd + 1) * tileSize - 8
            const top = y * tileSize
            const mid = (start + end) / 2
            const wave = Math.sin(time * 1.6 + x * 0.45 + y * 0.32) * 5
            context.beginPath()
            context.moveTo(start, top + 34 + wave)
            context.bezierCurveTo(start + (mid - start) * 0.55, top + 24 + wave, mid, top + 44 - wave, end, top + 31 + wave)
            context.stroke()
        }
    }
}

export function drawButterflies(
    context: CanvasRenderingContext2D,
    bounds: TileBounds,
    timestamp: number,
    options: DrawButterfliesOptions,
) {
    if (options.cameraScale < 0.58) return

    const leftBound = bounds.startX * tileSize
    const topBound = bounds.startY * tileSize
    const rightBound = (bounds.endX + 1) * tileSize
    const bottomBound = (bounds.endY + 1) * tileSize

    for (const butterfly of options.butterflies) {
        const tile = options.tileAt(butterfly.tileX, butterfly.tileY)
        if (!canShowButterflyOnTile(tile)) continue
        if (butterfly.x < leftBound || butterfly.x > rightBound || butterfly.y < topBound || butterfly.y > bottomBound) continue

        const time = timestamp / 1000
        const x = butterfly.x + Math.sin(time * butterfly.speed + butterfly.phase) * 10
        const y = butterfly.y + Math.cos(time * butterfly.speed * 1.7 + butterfly.phase) * 7
        const flap = 3 + Math.abs(Math.sin(time * 8 + butterfly.phase)) * 3
        context.fillStyle = '#f6d85f'
        context.beginPath()
        context.ellipse(x - 3, y, flap, 3, -0.5, 0, Math.PI * 2)
        context.ellipse(x + 3, y, flap, 3, 0.5, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#5a4a2d'
        context.fillRect(x - 1, y - 2, 2, 5)
    }
}

export function drawTheftClues(
    context: CanvasRenderingContext2D,
    bounds: TileBounds,
    timestamp: number,
    options: DrawTheftCluesOptions,
) {
    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!tile?.theft) continue

            drawFootprints(context, tile, timestamp)
            if (options.dog && options.home) drawDogBarkAlert(context, tile, options.dog, timestamp, options.cameraScale)
        }
    }
}

function drawFootprints(context: CanvasRenderingContext2D, tile: Tile, timestamp: number) {
    const left = tile.x * tileSize
    const top = tile.y * tileSize
    const alpha = 0.45 + Math.sin(timestamp / 320 + tile.x) * 0.12

    context.save()
    context.fillStyle = `rgba(82, 57, 35, ${alpha})`
    for (let i = 0; i < 4; i += 1) {
        const x = left + 18 + i * 10
        const y = top + 20 + i * 7
        context.beginPath()
        context.ellipse(x, y, 3.5, 7, -0.55, 0, Math.PI * 2)
        context.fill()
        context.beginPath()
        context.ellipse(x + 8, y + 4, 3.5, 7, -0.55, 0, Math.PI * 2)
        context.fill()
    }
    context.strokeStyle = 'rgba(194, 77, 63, 0.55)'
    context.lineWidth = 3
    context.setLineDash([8, 6])
    context.strokeRect(left + 8, top + 8, tileSize - 16, tileSize - 16)
    context.setLineDash([])
    context.restore()
}

function drawDogBarkAlert(
    context: CanvasRenderingContext2D,
    tile: Tile,
    dog: MapObject,
    timestamp: number,
    cameraScale: number,
) {
    if (cameraScale < 0.46) return

    const dogPosition = getWatchdogPosition(dog)
    const targetX = (tile.x + 0.5) * tileSize
    const targetY = (tile.y + 0.5) * tileSize
    const pulse = Math.sin(timestamp / 160) * 4

    context.save()
    context.strokeStyle = 'rgba(196, 77, 63, 0.42)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(dogPosition.x, dogPosition.y)
    context.setLineDash([10, 8])
    context.lineTo(targetX, targetY)
    context.stroke()
    context.setLineDash([])

    context.strokeStyle = 'rgba(196, 77, 63, 0.7)'
    for (let i = 0; i < 3; i += 1) {
        context.beginPath()
        context.arc(targetX, targetY, 16 + i * 8 + pulse, 0, Math.PI * 2)
        context.stroke()
    }

    if (cameraScale >= 0.72) {
        context.fillStyle = 'rgba(255, 240, 189, 0.92)'
        context.strokeStyle = '#b95549'
        context.lineWidth = 2
        context.beginPath()
        context.roundRect(targetX - 21, targetY - 37, 42, 22, 6)
        context.fill()
        context.stroke()
        context.fillStyle = '#8a3029'
        context.font = '800 12px sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText('汪!', targetX, targetY - 26)
        context.textAlign = 'start'
        context.textBaseline = 'alphabetic'
    }
    context.restore()
}
