import {tileSize} from './config'
import type {CropStatus, PlantDefinition, PlantDefinitionMap, PlantType, Tile} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

export function drawPlant(context: PixiDrawContext, tile: Tile, timestamp: number, plantDefinitions: PlantDefinitionMap) {
    if (!tile.plant || !tile.cropStatus) return

    const definition = plantDefinitions[tile.plant]
    if (!definition) return

    const left = tile.x * tileSize
    const top = tile.y * tileSize
    const centerX = left + tileSize / 2
    const baseY = top + 51
    const matureBaseY = tile.cropStatus === 'harvestable' && definition.kind === 'tree' ? top + 56 : baseY
    const time = timestamp / 1000
    const sway = Math.sin(time * 1.8 + tile.x * 0.4 + tile.y * 0.2) * getStageScale(tile.cropStatus) * 3.2
    const pulse = 1 + Math.sin(time * 3 + tile.x) * 0.06

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    drawPlantGroundShadow(context, centerX, baseY)

    if (tile.cropStatus === 'seed') {
        drawPlantSeed(context, definition, centerX, baseY, pulse)
    } else if (tile.cropStatus === 'growing') {
        drawPlantGrowing(context, definition, centerX, baseY, sway)
    } else if (tile.cropStatus === 'harvestable') {
        drawPlantMature(context, definition, centerX, matureBaseY, sway, tile.plant)
    } else {
        drawPlantWithered(context, centerX, baseY, sway)
    }

    context.restore()
}

function getStageScale(stage: CropStatus) {
    if (stage === 'seed') return 0.25
    if (stage === 'growing') return 0.72
    if (stage === 'harvestable') return 1

    return 0.78
}

function drawPlantSeed(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, pulse: number) {
    for (let i = -1; i <= 1; i += 1) {
        context.fillStyle = definition.seedColor
        context.strokeStyle = 'rgba(71, 48, 24, 0.34)'
        context.lineWidth = 1
        context.beginPath()
        context.ellipse(centerX + i * 10, baseY - 3, 4 * pulse, 2.8 * pulse, i * 0.2, 0, Math.PI * 2)
        context.fill()
        context.stroke()
    }
}

function drawPlantGrowing(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, sway: number) {
    for (let i = -1; i <= 1; i += 1) {
        const x = centerX + i * 11
        context.beginPath()
        context.moveTo(x, baseY)
        context.quadraticCurveTo(x + sway * 0.45, baseY - 16, x + sway, baseY - 30)
        strokeOutlined(context, definition.stemColor, 3.1, 'rgba(47, 68, 31, 0.28)')
        drawLeafPair(context, definition.leafColor, x + sway * 0.5, baseY - 21, 7)
    }
}

function drawPlantMature(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, sway: number, plant: PlantType) {
    if (definition.kind === 'tree') {
        context.beginPath()
        context.moveTo(centerX, baseY)
        context.quadraticCurveTo(centerX + sway * 0.2, baseY - 18, centerX + sway, baseY - 32)
        strokeOutlined(context, definition.stemColor, 4.6, 'rgba(62, 39, 19, 0.34)')
        context.fillStyle = definition.leafColor
        context.strokeStyle = 'rgba(43, 83, 37, 0.32)'
        context.lineWidth = 1.35
        context.beginPath()
        context.arc(centerX - 9 + sway, baseY - 35, 9.5, 0, Math.PI * 2)
        context.arc(centerX + 4 + sway, baseY - 39, 11.5, 0, Math.PI * 2)
        context.arc(centerX + 15 + sway, baseY - 30, 8.5, 0, Math.PI * 2)
        context.fill()
        context.stroke()
        drawFruitCluster(context, definition, centerX + sway, baseY - 34, plant)
        return
    }

    if (definition.kind === 'vine') {
        context.beginPath()
        context.moveTo(centerX - 18, baseY - 8)
        context.bezierCurveTo(centerX - 8, baseY - 33, centerX + 12, baseY - 18, centerX + 20, baseY - 40)
        strokeOutlined(context, definition.stemColor, 3.2, 'rgba(52, 62, 30, 0.3)')
        drawLeafPair(context, definition.leafColor, centerX - 4 + sway, baseY - 26, 8)
        drawFruitCluster(context, definition, centerX + 11 + sway, baseY - 29, plant)
        return
    }

    drawPlantGrowing(context, definition, centerX, baseY, sway)
    drawFruitCluster(context, definition, centerX + sway, baseY - 32, plant)
}

function drawPlantWithered(context: PixiDrawContext, centerX: number, baseY: number, sway: number) {
    for (let i = -1; i <= 1; i += 1) {
        const x = centerX + i * 11
        context.beginPath()
        context.moveTo(x, baseY)
        context.quadraticCurveTo(x + sway * 0.2, baseY - 14, x + 4 + sway, baseY - 24)
        strokeOutlined(context, '#8a7344', 3, 'rgba(73, 54, 27, 0.28)')
        context.fillStyle = '#a28c58'
        context.strokeStyle = 'rgba(83, 61, 30, 0.28)'
        context.lineWidth = 1
        context.beginPath()
        context.ellipse(x + 4 + sway, baseY - 21, 6, 2.5, 0.6, 0, Math.PI * 2)
        context.fill()
        context.stroke()
    }
}

function drawLeafPair(context: PixiDrawContext, color: string, x: number, y: number, size: number) {
    context.fillStyle = color
    context.strokeStyle = 'rgba(42, 83, 35, 0.32)'
    context.lineWidth = 1.15
    context.beginPath()
    context.ellipse(x - 5, y, size, size * 0.42, -0.55, 0, Math.PI * 2)
    context.ellipse(x + 6, y + 2, size, size * 0.42, 0.55, 0, Math.PI * 2)
    context.fill()
    context.stroke()
}

function drawFruitCluster(context: PixiDrawContext, definition: PlantDefinition, x: number, y: number, plant: PlantType) {
    const seed = hashNumber(plant)
    const count = definition.kind === 'vine' ? 7 : definition.kind === 'bush' ? 5 : Math.round(3 + seed * 2)
    const clusterRadius = definition.kind === 'vine' ? 6 : definition.kind === 'bush' ? 8 : 9
    const elongated = definition.kind === 'grain' && seed > 0.58

    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count
        const fx = x + Math.cos(angle) * clusterRadius * 0.7
        const fy = y + Math.sin(angle) * clusterRadius * 0.45
        context.fillStyle = definition.fruitColor
        context.strokeStyle = 'rgba(86, 65, 23, 0.3)'
        context.lineWidth = 1
        context.beginPath()
        context.ellipse(fx, fy, elongated ? 4.2 : 3.8, elongated ? 7.4 : 3.8, elongated ? 0.1 : 0, 0, Math.PI * 2)
        context.fill()
        context.stroke()
    }

    context.fillStyle = definition.accentColor
    context.beginPath()
    context.arc(x - 2, y - 2, 2, 0, Math.PI * 2)
    context.fill()
}

function drawPlantGroundShadow(context: PixiDrawContext, centerX: number, baseY: number) {
    context.fillStyle = 'rgba(72, 55, 22, 0.16)'
    context.beginPath()
    context.ellipse(centerX, baseY + 2, 17, 4.4, 0, 0, Math.PI * 2)
    context.fill()
}

function strokeOutlined(context: PixiDrawContext, color: string, lineWidth: number, outline: string) {
    context.strokeStyle = outline
    context.lineWidth = lineWidth + 1.8
    context.stroke()
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.stroke()
}

function hashNumber(value: number) {
    const next = Math.sin(value * 127.1 + 311.7) * 43758.5453123

    return next - Math.floor(next)
}
