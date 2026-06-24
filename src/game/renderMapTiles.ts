import {tileSize, terrainBrightColors, terrainColors, terrainDarkColors} from './config'
import {getThemeStrokeColor, hexToRgba, resolveThemeColor} from './colorUtils'
import {hash} from './mapData'
import {getOverviewTileColor} from './tileColor'
import type {Tile} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

type TileLookup = (x: number, y: number) => Tile | null

export function drawStaticTile(
    context: PixiDrawContext,
    tile: Tile,
    tileAt: TileLookup,
    mapWidth: number,
    cameraScale = 1,
) {
    const left = tile.x * tileSize
    const top = tile.y * tileSize

    if (tile.terrain === 'mountain') {
        drawStaticMountainRidge(context, tile, left, top, mapWidth)
        drawStaticTileGrid(context, left, top)
        return
    }

    const gradient = context.createLinearGradient(left, top, left + tileSize, top + tileSize)
    gradient.addColorStop(0, terrainBrightColors[tile.terrain])
    gradient.addColorStop(0.62, terrainColors[tile.terrain])
    gradient.addColorStop(1, terrainDarkColors[tile.terrain])

    context.fillStyle = gradient
    context.fillRect(left, top, tileSize, tileSize)

    if (tile.themeColor) {
        drawThemeColorWash(context, tile, left, top)
    }

    if (tile.terrain === 'grass') drawStaticGrass(context, tile, left, top)
    if (tile.terrain === 'field') drawStaticFieldBase(context, tile, left, top)
    if (tile.terrain === 'home') drawStaticHomeGround(context, tile, left, top)
    if (tile.terrain === 'water') drawStaticWater(context, tile, left, top, tileAt)
    drawHighZoomTileDetail(context, tile, left, top, cameraScale)
    drawStaticTileGrid(context, left, top)
}

export function drawOverviewStaticTile(context: PixiDrawContext, tile: Tile) {
    const left = tile.x * tileSize
    const top = tile.y * tileSize

    context.fillStyle = getOverviewTileColor(tile)
    context.fillRect(left, top, tileSize, tileSize)

    if (tile.terrain === 'water') {
        context.fillStyle = 'rgba(170, 239, 232, 0.22)'
        context.fillRect(left + 5, top + 5, tileSize - 10, tileSize - 10)
    } else if (tile.terrain === 'field') {
        context.strokeStyle = tile.ownerType === 'player' ? 'rgba(255, 239, 150, 0.24)' : 'rgba(255, 235, 172, 0.18)'
        context.lineWidth = 1.4
        context.beginPath()
        context.moveTo(left + 9, top + 23)
        context.lineTo(left + tileSize - 9, top + 19)
        context.moveTo(left + 9, top + 43)
        context.lineTo(left + tileSize - 9, top + 39)
        context.stroke()
    }

    drawStaticTileGrid(context, left, top, 0.11)
}

function drawStaticTileGrid(context: PixiDrawContext, left: number, top: number, alpha = 0.08) {
    context.strokeStyle = `rgba(58, 49, 35, ${alpha})`
    context.lineWidth = 1
    context.strokeRect(left + 0.5, top + 0.5, tileSize - 1, tileSize - 1)
}

function drawHighZoomTileDetail(context: PixiDrawContext, tile: Tile, left: number, top: number, cameraScale: number) {
    if (cameraScale < 1.35) return

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    if (tile.terrain === 'grass') {
        drawHighZoomGrassDetail(context, tile, left, top)
    } else if (tile.terrain === 'field') {
        drawHighZoomFieldDetail(context, tile, left, top)
    } else if (tile.terrain === 'home') {
        drawHighZoomHomeGroundDetail(context, left, top)
    } else if (tile.terrain === 'water') {
        drawHighZoomWaterDetail(context, tile, left, top)
    }

    context.strokeStyle = 'rgba(50, 42, 30, 0.12)'
    context.lineWidth = 1 / cameraScale
    context.strokeRect(left + 1, top + 1, tileSize - 2, tileSize - 2)
    context.restore()
}

function drawHighZoomGrassDetail(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    for (let index = 0; index < 5; index += 1) {
        const seed = hash(tile.x + index * 23, tile.y + index * 29)
        const x = left + 9 + seed * 46
        const y = top + 12 + hash(tile.x + index * 31, tile.y + index * 37) * 38

        drawGrassBlade(context, x, y, 7 + seed * 4, 2 + seed * 2, 'rgba(34, 104, 39, 0.28)', 0.9)
    }
}

function drawHighZoomFieldDetail(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    const ridgeColor = tile.ownerType === 'player' ? 'rgba(255, 244, 166, 0.36)' : 'rgba(255, 240, 190, 0.26)'

    context.strokeStyle = ridgeColor
    context.lineWidth = 1.1
    for (let index = 0; index < 5; index += 1) {
        const y = top + 11 + index * 10

        context.beginPath()
        context.moveTo(left + 7, y)
        context.quadraticCurveTo(left + 30, y - 4, left + 57, y + 1)
        context.stroke()
    }

    context.strokeStyle = 'rgba(86, 63, 27, 0.08)'
    context.lineWidth = 0.55
    for (let index = 0; index < 4; index += 1) {
        const x = left + 12 + index * 13

        context.beginPath()
        context.moveTo(x, top + 9)
        context.lineTo(x + 4, top + 55)
        context.stroke()
    }
}

function drawHighZoomHomeGroundDetail(context: PixiDrawContext, left: number, top: number) {
    context.strokeStyle = 'rgba(255, 248, 220, 0.34)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(left + 14, top + 32)
    context.lineTo(left + 50, top + 32)
    context.moveTo(left + 32, top + 14)
    context.lineTo(left + 32, top + 50)
    context.stroke()
}

function drawHighZoomWaterDetail(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    context.strokeStyle = 'rgba(236, 255, 247, 0.4)'
    context.lineWidth = 0.95
    for (let index = 0; index < 4; index += 1) {
        const x = left + 10 + hash(tile.x + index * 17, tile.y + 3) * 42
        const y = top + 13 + hash(tile.x + 5, tile.y + index * 19) * 38

        context.beginPath()
        context.ellipse(x, y, 7 + index * 0.7, 1.8, hash(tile.x + index, tile.y) * 0.6 - 0.3, 0, Math.PI * 1.2)
        context.stroke()
    }
}

function drawThemeColorWash(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    const themeColor = resolveThemeColor(tile.themeColor, '#d8b85b')
    const wash = hexToRgba(themeColor, tile.terrain === 'home' ? 0.78 : 0.26)
    const edge = hexToRgba(getThemeStrokeColor(themeColor), tile.terrain === 'home' ? 0.9 : 0.5)

    context.fillStyle = wash
    context.fillRect(left, top, tileSize, tileSize)
    context.strokeStyle = edge
    context.lineWidth = tile.terrain === 'home' ? 2 : 1.2
    context.strokeRect(left + 1, top + 1, tileSize - 2, tileSize - 2)
}

function drawStaticGrass(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    const count = (tile.x + tile.y) % 2 === 0 ? 4 : 2

    context.save()
    context.lineCap = 'round'
    for (let i = 0; i < count; i += 1) {
        const seed = hash(tile.x + i * 3, tile.y + i * 5)
        const x = left + 8 + seed * 47
        const y = top + 11 + hash(tile.x + i * 7, tile.y + i * 9) * 42
        const height = 6 + hash(tile.x + i * 11, tile.y + i * 13) * 5
        const bend = 2 + hash(tile.x + i * 17, tile.y + i * 19) * 4

        drawGrassBlade(context, x, y, height, bend, 'rgba(42, 111, 40, 0.2)', 1.35)
        drawGrassBlade(context, x + 2, y + 1, height * 0.78, -bend * 0.72, 'rgba(221, 247, 157, 0.22)', 1)
    }

    if ((tile.x + tile.y) % 3 === 0) {
        context.fillStyle = 'rgba(255, 241, 152, 0.2)'
        context.fillRect(left + 17 + hash(tile.x, tile.y) * 26, top + 18 + hash(tile.y, tile.x) * 26, 2, 2)
    }
    context.restore()
}

function drawStaticFieldBase(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    const shadow = tile.ownerType === 'player' ? 'rgba(110, 88, 25, 0.78)' : 'rgba(92, 74, 34, 0.68)'
    const highlight = tile.ownerType === 'player' ? 'rgba(255, 239, 150, 0.38)' : 'rgba(255, 235, 172, 0.3)'

    context.save()
    context.lineCap = 'round'
    for (let i = 0; i < 4; i += 1) {
        const y = top + 17 + i * 10
        context.strokeStyle = highlight
        context.lineWidth = 2.4
        context.beginPath()
        context.moveTo(left + 8, y - 1)
        context.quadraticCurveTo(left + 29, y - 7, left + 56, y)
        context.stroke()

        context.strokeStyle = shadow
        context.lineWidth = 1.45
        context.beginPath()
        context.moveTo(left + 9, y)
        context.quadraticCurveTo(left + 29, y - 5, left + 55, y + 2)
        context.stroke()
    }

    context.strokeStyle = 'rgba(93, 72, 25, 0.06)'
    context.lineWidth = 0.7
    for (let i = 0; i < 3; i += 1) {
        const x = left + 16 + i * 16 + hash(tile.x + i, tile.y) * 4
        context.beginPath()
        context.moveTo(x, top + 13)
        context.lineTo(x + 4, top + 53)
        context.stroke()
    }
    context.restore()
}

function drawGrassBlade(
    context: PixiDrawContext,
    x: number,
    y: number,
    height: number,
    bend: number,
    color: string,
    lineWidth: number,
) {
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.beginPath()
    context.moveTo(x, y + height)
    context.quadraticCurveTo(x + bend * 0.45, y + height * 0.45, x + bend, y)
    context.stroke()
}

function drawStaticHomeGround(context: PixiDrawContext, tile: Tile, left: number, top: number) {
    const color = resolveThemeColor(tile.themeColor)
    const strokeColor = getThemeStrokeColor(color)

    context.save()
    context.fillStyle = hexToRgba(color, 0.2)
    context.beginPath()
    context.roundRect(left + 8, top + 8, tileSize - 16, tileSize - 16, 5)
    context.fill()
    context.strokeStyle = hexToRgba(color, 0.58)
    context.lineWidth = 1.6
    context.stroke()

    context.strokeStyle = hexToRgba(strokeColor, 0.24)
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(left + 16, top + 18)
    context.lineTo(left + 48, top + 18)
    context.moveTo(left + 16, top + 46)
    context.lineTo(left + 48, top + 46)
    context.moveTo(left + 18, top + 16)
    context.lineTo(left + 18, top + 48)
    context.moveTo(left + 46, top + 16)
    context.lineTo(left + 46, top + 48)
    context.stroke()
    context.restore()
}

function drawStaticWater(context: PixiDrawContext, tile: Tile, left: number, top: number, tileAt: TileLookup) {
    const north = tileAt(tile.x, tile.y - 1)?.terrain === 'water'
    const south = tileAt(tile.x, tile.y + 1)?.terrain === 'water'
    const west = tileAt(tile.x - 1, tile.y)?.terrain === 'water'
    const east = tileAt(tile.x + 1, tile.y)?.terrain === 'water'
    const glowX = left + 22 + hash(tile.x + 19, tile.y + 7) * 20
    const glowY = top + 20 + hash(tile.x + 5, tile.y + 31) * 22
    const gradient = context.createRadialGradient(glowX, glowY, 4, left + tileSize / 2, top + tileSize / 2, 48)

    gradient.addColorStop(0, 'rgba(170, 239, 232, 0.64)')
    gradient.addColorStop(0.58, 'rgba(74, 179, 198, 0.3)')
    gradient.addColorStop(1, 'rgba(34, 108, 146, 0.24)')
    context.fillStyle = gradient
    context.fillRect(left + 2, top + 2, tileSize - 4, tileSize - 4)

    context.save()
    context.lineCap = 'round'
    context.strokeStyle = 'rgba(14, 83, 116, 0.2)'
    context.lineWidth = 1.2
    context.strokeRect(left + 2.5, top + 2.5, tileSize - 5, tileSize - 5)
    context.strokeStyle = 'rgba(226, 249, 218, 0.52)'
    context.lineWidth = 5
    if (!north) drawWaterBank(context, left, top, 'north', hash(tile.x, tile.y))
    if (!south) drawWaterBank(context, left, top, 'south', hash(tile.x + 2, tile.y + 3))
    if (!west) drawWaterBank(context, left, top, 'west', hash(tile.x + 5, tile.y + 7))
    if (!east) drawWaterBank(context, left, top, 'east', hash(tile.x + 11, tile.y + 13))

    context.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    context.lineWidth = 1.5
    for (let i = 0; i < 3; i += 1) {
        const x = left + 14 + hash(tile.x + i * 7, tile.y + 17) * 36
        const y = top + 18 + hash(tile.x + i * 11, tile.y + 23) * 28
        context.beginPath()
        context.ellipse(x, y, 9 + i * 1.6, 2.4 + i * 0.35, hash(tile.x + i, tile.y + 9) * 0.8 - 0.4, 0, Math.PI * 1.18)
        context.stroke()
    }

    context.fillStyle = 'rgba(233, 255, 248, 0.34)'
    context.fillRect(left + 20 + hash(tile.x + 13, tile.y) * 22, top + 14 + hash(tile.x, tile.y + 13) * 22, 2, 2)
    context.restore()
}

function drawWaterBank(context: PixiDrawContext, left: number, top: number, edge: 'north' | 'south' | 'west' | 'east', seed: number) {
    const wave = seed * 5 - 2.5

    context.beginPath()
    if (edge === 'north') {
        const y = top + 6 + wave
        context.moveTo(left + 2, y)
        context.bezierCurveTo(left + 18, y - 4, left + 38, y + 4, left + tileSize - 2, y - 1)
    } else if (edge === 'south') {
        const y = top + tileSize - 6 + wave
        context.moveTo(left + 2, y)
        context.bezierCurveTo(left + 18, y + 4, left + 38, y - 4, left + tileSize - 2, y + 1)
    } else if (edge === 'west') {
        const x = left + 6 + wave
        context.moveTo(x, top + 2)
        context.bezierCurveTo(x - 4, top + 18, x + 4, top + 38, x - 1, top + tileSize - 2)
    } else {
        const x = left + tileSize - 6 + wave
        context.moveTo(x, top + 2)
        context.bezierCurveTo(x + 4, top + 18, x - 4, top + 38, x + 1, top + tileSize - 2)
    }
    context.stroke()
}

function drawStaticMountainRidge(context: PixiDrawContext, tile: Tile, left: number, top: number, mapWidth: number) {
    const edge = tile.x === 0 ? 'west' : tile.x === mapWidth - 1 ? 'east' : tile.y === 0 ? 'north' : 'south'
    const inner = 8
    const ridge = 18

    context.fillStyle = '#8f8a7c'
    context.fillRect(left, top, tileSize, tileSize)

    const gradient = context.createLinearGradient(left, top, left + tileSize, top + tileSize)
    gradient.addColorStop(0, 'rgba(255, 251, 237, 0.24)')
    gradient.addColorStop(0.5, 'rgba(120, 114, 99, 0.08)')
    gradient.addColorStop(1, 'rgba(47, 45, 40, 0.22)')
    context.fillStyle = gradient
    context.fillRect(left + 2, top + 2, tileSize - 4, tileSize - 4)

    context.fillStyle = 'rgba(71, 66, 58, 0.24)'
    if (edge === 'west') context.fillRect(left + tileSize - ridge, top + inner, ridge, tileSize - inner * 2)
    else if (edge === 'east') context.fillRect(left, top + inner, ridge, tileSize - inner * 2)
    else if (edge === 'north') context.fillRect(left + inner, top + tileSize - ridge, tileSize - inner * 2, ridge)
    else context.fillRect(left + inner, top, tileSize - inner * 2, ridge)

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    drawMountainFacet(context, left, top, edge)

    context.strokeStyle = 'rgba(50, 46, 41, 0.32)'
    context.lineWidth = 1.7
    context.beginPath()

    if (edge === 'west' || edge === 'east') {
        const x = edge === 'west' ? left + tileSize - 20 : left + 20
        context.moveTo(x, top + 10)
        context.lineTo(x - 6, top + 22)
        context.lineTo(x + 4, top + 34)
        context.lineTo(x - 3, top + 46)
        context.lineTo(x + 5, top + 56)
    } else {
        const y = edge === 'north' ? top + tileSize - 20 : top + 20
        context.moveTo(left + 10, y)
        context.lineTo(left + 22, y - 6)
        context.lineTo(left + 34, y + 4)
        context.lineTo(left + 46, y - 3)
        context.lineTo(left + 56, y + 5)
    }

    context.stroke()
    context.restore()
}

function drawMountainFacet(context: PixiDrawContext, left: number, top: number, edge: 'north' | 'south' | 'west' | 'east') {
    const centerX = left + tileSize / 2
    const centerY = top + tileSize / 2

    context.fillStyle = 'rgba(255, 251, 237, 0.12)'
    context.strokeStyle = 'rgba(52, 48, 42, 0.18)'
    context.lineWidth = 1
    context.beginPath()
    if (edge === 'north') {
        context.moveTo(left + 12, top + 55)
        context.lineTo(centerX, top + 18)
        context.lineTo(left + 52, top + 55)
    } else if (edge === 'south') {
        context.moveTo(left + 12, top + 9)
        context.lineTo(centerX, top + 46)
        context.lineTo(left + 52, top + 9)
    } else if (edge === 'west') {
        context.moveTo(left + 55, top + 12)
        context.lineTo(left + 18, centerY)
        context.lineTo(left + 55, top + 52)
    } else {
        context.moveTo(left + 9, top + 12)
        context.lineTo(left + 46, centerY)
        context.lineTo(left + 9, top + 52)
    }
    context.closePath()
    context.fill()
    context.stroke()
}
