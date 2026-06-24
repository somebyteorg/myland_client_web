import {tileSize} from './config'
import type {CropStatus, PlantDefinition, PlantDefinitionMap, PlantType, Tile} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

type PlantDetail = 0 | 1 | 2

interface PlantMotion {
    detail: PlantDetail
    flutter: number
    lean: number
    lift: number
    phase: number
    pulse: number
    size: number
    sparkle: number
    sway: number
    time: number
    variant: number
}

export function drawPlant(
    context: PixiDrawContext,
    tile: Tile,
    timestamp: number,
    plantDefinitions: PlantDefinitionMap,
    cameraScale = 1,
) {
    if (!tile.plant || !tile.cropStatus) return

    const definition = plantDefinitions[tile.plant]
    if (!definition) return

    const left = tile.x * tileSize
    const top = tile.y * tileSize
    const centerX = left + tileSize / 2
    const baseY = top + 51
    const matureBaseY = tile.cropStatus === 'harvestable' && definition.kind === 'tree' ? top + 56 : baseY
    const plant = tile.plant
    const motion = createPlantMotion(tile, plant, timestamp, tile.cropStatus, cameraScale)

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    drawPlantGroundShadow(context, centerX, matureBaseY, tile.cropStatus, definition.kind, motion)

    if (tile.cropStatus === 'seed') {
        drawPlantSeed(context, definition, centerX, baseY, motion)
    } else if (tile.cropStatus === 'growing') {
        drawPlantGrowing(context, definition, centerX, baseY + motion.lift, motion)
    } else if (tile.cropStatus === 'harvestable') {
        drawPlantMature(context, definition, centerX, matureBaseY + motion.lift, plant, motion)
    } else {
        drawPlantWithered(context, centerX, baseY, motion)
    }

    context.restore()
}

function createPlantMotion(tile: Tile, plant: PlantType, timestamp: number, stage: CropStatus, cameraScale: number): PlantMotion {
    const time = timestamp / 1000
    const phase = tile.x * 0.47 + tile.y * 0.31 + plant * 0.07
    const variant = hashNumber(tile.x * 37.7 + tile.y * 91.3 + plant * 17.9)
    const stageScale = getStageScale(stage)
    const swaySpeed = stage === 'harvestable' ? 1.46 : 1.75
    const sway = Math.sin(time * swaySpeed + phase) * stageScale * (2.25 + variant * 1.1)
    const flutter = Math.sin(time * 4.2 + phase * 1.33) * (0.55 + variant * 0.4)
    const pulse = 1 + Math.sin(time * 2.35 + phase) * (stage === 'seed' ? 0.065 : 0.04)

    return {
        detail: getPlantDetail(cameraScale),
        flutter,
        lean: (variant - 0.5) * 2.2,
        lift: Math.sin(time * 1.18 + phase) * stageScale * 0.65,
        phase,
        pulse,
        size: 0.94 + variant * 0.12,
        sparkle: Math.sin(time * 2.9 + phase * 0.8),
        sway,
        time,
        variant,
    }
}

function getPlantDetail(cameraScale: number): PlantDetail {
    if (cameraScale < 0.82) return 0
    if (cameraScale < 1.08) return 1

    return 2
}

function getStageScale(stage: CropStatus) {
    if (stage === 'seed') return 0.24
    if (stage === 'growing') return 0.7
    if (stage === 'harvestable') return 1

    return 0.76
}

function drawPlantSeed(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, motion: PlantMotion) {
    context.fillStyle = 'rgba(82, 58, 27, 0.16)'
    context.beginPath()
    addEllipse(context, centerX, baseY - 1, 24, 6, -0.04)
    context.fill()

    const offsets = motion.detail === 0 ? [-7, 7] : [-11, 0, 11]
    for (let i = 0; i < offsets.length; i += 1) {
        const offset = offsets[i]
        const x = centerX + offset
        const y = baseY - 3 + Math.sin(motion.phase + i) * 0.65
        const rotation = offset * 0.024 + motion.flutter * 0.04

        context.fillStyle = definition.seedColor
        context.strokeStyle = 'rgba(71, 48, 24, 0.34)'
        context.lineWidth = 1
        context.beginPath()
        addEllipse(context, x, y, 4.3 * motion.pulse, 3 * motion.pulse, rotation)
        context.fill()
        context.stroke()

        if (motion.detail > 0) {
            context.fillStyle = 'rgba(255, 244, 188, 0.38)'
            context.beginPath()
            addEllipse(context, x - 1.2, y - 0.7, 1.35 * motion.pulse, 0.75 * motion.pulse, rotation)
            context.fill()
        }
    }

    if (motion.detail === 2) {
        drawSeedSprout(context, definition, centerX + motion.lean * 0.3, baseY, motion)
    }
}

function drawSeedSprout(context: PixiDrawContext, definition: PlantDefinition, x: number, baseY: number, motion: PlantMotion) {
    const tipX = x + motion.sway * 0.22
    const tipY = baseY - 11

    context.beginPath()
    context.moveTo(x, baseY - 3)
    context.quadraticCurveTo(x + motion.sway * 0.1, baseY - 8, tipX, tipY)
    strokeOutlined(context, definition.stemColor, 1.6, 'rgba(44, 69, 32, 0.22)')
    drawLeafPair(context, definition.leafColor, tipX, tipY + 2, 3.8, motion.flutter * 0.1, motion.detail)
}

function drawPlantGrowing(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, motion: PlantMotion) {
    for (let i = -1; i <= 1; i += 1) {
        const x = centerX + i * 10.6 * motion.size + motion.lean * Math.abs(i) * 0.25
        const height = (27 + motion.pulse * 3 + (i === 0 ? 4 : 0)) * motion.size
        const localSway = motion.sway * (0.82 + Math.abs(i) * 0.12)
        const tipX = x + localSway + motion.lean * 0.22
        const tipY = baseY - height

        context.beginPath()
        context.moveTo(x, baseY)
        context.quadraticCurveTo(x + localSway * 0.38, baseY - height * 0.54, tipX, tipY)
        strokeOutlined(context, definition.stemColor, i === 0 ? 3.2 : 2.7, 'rgba(47, 68, 31, 0.28)')
        drawLeafPair(
            context,
            definition.leafColor,
            x + localSway * 0.5,
            baseY - height * 0.64,
            7.2 + motion.pulse * 0.8,
            motion.flutter * 0.08,
            motion.detail,
        )
        if (motion.detail > 0 && i === 0) {
            drawLeafPair(
                context,
                definition.leafColor,
                x + localSway * 0.28,
                baseY - height * 0.36,
                5.4 + motion.pulse * 0.5,
                -motion.flutter * 0.07,
                motion.detail,
            )
            drawGrowingBud(context, definition, tipX, tipY, motion)
        }
    }
}

function drawGrowingBud(context: PixiDrawContext, definition: PlantDefinition, x: number, y: number, motion: PlantMotion) {
    context.fillStyle = definition.accentColor
    context.strokeStyle = 'rgba(75, 89, 36, 0.26)'
    context.lineWidth = 0.9
    context.beginPath()
    addEllipse(context, x, y - 1.5, 2.3 * motion.pulse, 3.4 * motion.pulse, motion.flutter * 0.08)
    context.fill()
    context.stroke()
}

function drawPlantMature(
    context: PixiDrawContext,
    definition: PlantDefinition,
    centerX: number,
    baseY: number,
    plant: PlantType,
    motion: PlantMotion,
) {
    if (definition.kind === 'tree') {
        drawTreePlant(context, definition, centerX, baseY, plant, motion)
        return
    }

    if (definition.kind === 'vine') {
        drawVinePlant(context, definition, centerX, baseY, plant, motion)
        return
    }

    if (definition.kind === 'bush') {
        drawBushPlant(context, definition, centerX, baseY, plant, motion)
        return
    }

    drawGrainPlant(context, definition, centerX, baseY, motion)
}

function drawTreePlant(
    context: PixiDrawContext,
    definition: PlantDefinition,
    centerX: number,
    baseY: number,
    plant: PlantType,
    motion: PlantMotion,
) {
    const crownX = centerX + motion.sway + motion.lean * 0.3
    const crownY = baseY - 38 * motion.size

    context.beginPath()
    context.moveTo(centerX, baseY)
    context.quadraticCurveTo(centerX + motion.sway * 0.18, baseY - 21, crownX, baseY - 34)
    strokeOutlined(context, definition.stemColor, 5.2, 'rgba(62, 39, 19, 0.34)')

    if (motion.detail > 0) {
        drawTreeBranch(context, definition, centerX + motion.sway * 0.08, baseY - 23, crownX - 12, crownY + 8)
        drawTreeBranch(context, definition, centerX + motion.sway * 0.1, baseY - 27, crownX + 12, crownY + 6)
        context.strokeStyle = 'rgba(255, 232, 168, 0.18)'
        context.lineWidth = 1.4
        context.beginPath()
        context.moveTo(centerX - 1, baseY - 5)
        context.quadraticCurveTo(centerX + motion.sway * 0.1, baseY - 20, crownX - 1, baseY - 31)
        context.stroke()
    }

    drawCanopyBlob(context, definition.leafColor, 'rgba(43, 83, 37, 0.3)', 1.25, [
        {x: crownX - 13, y: crownY + 3, radius: 10.6 + motion.pulse},
        {x: crownX - 3, y: crownY - 6, radius: 11.7 + motion.pulse},
        {x: crownX + 10, y: crownY - 4, radius: 10.2 + motion.pulse * 0.8},
        {x: crownX + 14, y: crownY + 6, radius: 9.5},
        {x: crownX, y: crownY + 8, radius: 10.5},
    ])

    if (motion.detail > 0) {
        drawLeafHighlight(context, crownX - 7, crownY - 10, 9, -0.35)
        drawLeafHighlight(context, crownX + 7, crownY - 4, 6.5, 0.35)
    }

    drawFruitCluster(context, definition, crownX, crownY + 1, plant, motion)
}

function drawTreeBranch(
    context: PixiDrawContext,
    definition: PlantDefinition,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
) {
    context.beginPath()
    context.moveTo(startX, startY)
    context.quadraticCurveTo((startX + endX) / 2, startY - 4, endX, endY)
    strokeOutlined(context, definition.stemColor, 2, 'rgba(62, 39, 19, 0.22)')
}

function drawVinePlant(
    context: PixiDrawContext,
    definition: PlantDefinition,
    centerX: number,
    baseY: number,
    plant: PlantType,
    motion: PlantMotion,
) {
    const fruitX = centerX + 11 + motion.sway
    const fruitY = baseY - 29

    drawVineGroundCurl(context, definition, centerX, baseY, motion)
    context.beginPath()
    context.moveTo(centerX - 18, baseY - 8)
    context.bezierCurveTo(
        centerX - 8,
        baseY - 33,
        centerX + 12 + motion.sway * 0.28,
        baseY - 18,
        centerX + 20 + motion.sway * 0.5,
        baseY - 40,
    )
    strokeOutlined(context, definition.stemColor, 3.2, 'rgba(52, 62, 30, 0.3)')
    drawLeafPair(context, definition.leafColor, centerX - 4 + motion.sway, baseY - 26, 8, motion.flutter * 0.08, motion.detail)
    drawLeafPair(context, definition.leafColor, centerX + 12 + motion.sway * 0.4, baseY - 15, 5.8, -motion.flutter * 0.07, motion.detail)

    if (motion.detail > 0) {
        drawVineTendril(context, definition, centerX + 15 + motion.sway * 0.4, baseY - 29, motion)
    }

    drawFruitCluster(context, definition, fruitX, fruitY, plant, motion)
}

function drawGrainPlant(
    context: PixiDrawContext,
    definition: PlantDefinition,
    centerX: number,
    baseY: number,
    motion: PlantMotion,
) {
    const stalkCount = motion.detail === 0 ? 3 : 5
    const start = -(stalkCount - 1) / 2

    if (motion.detail > 0) {
        drawBaseBlades(context, definition, centerX, baseY, motion)
    }

    for (let index = 0; index < stalkCount; index += 1) {
        const i = start + index
        const distanceFromCenter = Math.abs(i)
        const x = centerX + i * 7.5
        const height = 31 + (2 - Math.min(distanceFromCenter, 2)) * 3
        const bend = motion.sway * (0.55 + distanceFromCenter * 0.12) + motion.lean * 0.18
        const tipX = x + bend
        const tipY = baseY - height * motion.size

        context.beginPath()
        context.moveTo(x, baseY)
        context.quadraticCurveTo(x + bend * 0.35, baseY - height * 0.55, tipX, tipY)
        strokeOutlined(context, definition.stemColor, index === Math.floor(stalkCount / 2) ? 3.1 : 2.35, 'rgba(52, 70, 28, 0.24)')
        drawGrainHead(context, definition, tipX, tipY, 4.6 + motion.pulse, i * 0.18 + motion.phase * 0.08, motion)
    }
}

function drawBushPlant(
    context: PixiDrawContext,
    definition: PlantDefinition,
    centerX: number,
    baseY: number,
    plant: PlantType,
    motion: PlantMotion,
) {
    drawCanopyBlob(context, definition.leafColor, 'rgba(43, 83, 37, 0.3)', 1.2, [
        {x: centerX - 12 + motion.sway * 0.26, y: baseY - 19, radius: 10 + motion.pulse},
        {x: centerX - 3 + motion.sway * 0.36, y: baseY - 27, radius: 11.3 + motion.pulse},
        {x: centerX + 8 + motion.sway * 0.48, y: baseY - 26, radius: 10.4 + motion.pulse * 0.8},
        {x: centerX + 15 + motion.sway * 0.58, y: baseY - 18, radius: 9.4},
        {x: centerX + 1, y: baseY - 14, radius: 10.2},
    ])

    if (motion.detail > 0) {
        drawLeafHighlight(context, centerX - 6 + motion.sway * 0.34, baseY - 31, 8.5, -0.42)
        drawLeafHighlight(context, centerX + 9 + motion.sway * 0.42, baseY - 28, 6.4, 0.36)
        drawBaseBlades(context, definition, centerX, baseY, motion)
    }

    drawFruitCluster(context, definition, centerX + motion.sway * 0.55, baseY - 22, plant, motion)
}

function drawPlantWithered(context: PixiDrawContext, centerX: number, baseY: number, motion: PlantMotion) {
    const count = motion.detail === 0 ? 2 : 3
    const start = -(count - 1) / 2

    for (let index = 0; index < count; index += 1) {
        const i = start + index
        const x = centerX + i * 11
        const droop = Math.sin(motion.phase + i) * 1.2

        context.beginPath()
        context.moveTo(x, baseY)
        context.quadraticCurveTo(x + motion.sway * 0.18, baseY - 13, x + 5 + motion.sway, baseY - 22 + droop)
        strokeOutlined(context, '#8a7344', 3, 'rgba(73, 54, 27, 0.28)')
        context.fillStyle = '#a28c58'
        context.strokeStyle = 'rgba(83, 61, 30, 0.28)'
        context.lineWidth = 1
        context.beginPath()
        addEllipse(context, x + 5 + motion.sway, baseY - 20 + droop, 6.5, 2.4, 0.72)
        context.fill()
        context.stroke()
    }

    if (motion.detail > 0) {
        context.fillStyle = 'rgba(214, 184, 105, 0.18)'
        context.beginPath()
        addEllipse(context, centerX + 4, baseY - 13, 7, 1.6, -0.35)
        context.fill()
    }

    context.fillStyle = 'rgba(96, 67, 32, 0.2)'
    context.beginPath()
    addEllipse(context, centerX, baseY + 1, 18, 3.6, 0)
    context.fill()
}

function drawLeafPair(
    context: PixiDrawContext,
    color: string,
    x: number,
    y: number,
    size: number,
    flutter: number,
    detail: PlantDetail,
) {
    const leftRotation = -0.56 + flutter
    const rightRotation = 0.56 + flutter * 0.7

    context.fillStyle = color
    context.strokeStyle = 'rgba(42, 83, 35, 0.32)'
    context.lineWidth = 1.1
    context.beginPath()
    addEllipse(context, x - 5, y, size, size * 0.42, leftRotation)
    addEllipse(context, x + 6, y + 2, size, size * 0.42, rightRotation)
    context.fill()
    context.stroke()

    if (detail > 0) {
        drawLeafHighlight(context, x - 6, y - 1, size * 0.54, leftRotation)
    }
    if (detail === 2) {
        drawLeafHighlight(context, x + 5, y + 1, size * 0.42, rightRotation)
        drawLeafVein(context, x - 5, y, size, leftRotation)
        drawLeafVein(context, x + 6, y + 2, size, rightRotation)
    }
}

function drawLeafHighlight(context: PixiDrawContext, x: number, y: number, size: number, rotation: number) {
    context.fillStyle = 'rgba(232, 255, 189, 0.22)'
    context.beginPath()
    addEllipse(context, x, y, size, size * 0.2, rotation)
    context.fill()
}

function drawLeafVein(context: PixiDrawContext, x: number, y: number, size: number, rotation: number) {
    const dx = Math.cos(rotation) * size * 0.6
    const dy = Math.sin(rotation) * size * 0.6

    context.strokeStyle = 'rgba(246, 255, 211, 0.24)'
    context.lineWidth = 0.7
    context.beginPath()
    context.moveTo(x - dx, y - dy)
    context.lineTo(x + dx, y + dy)
    context.stroke()
}

function drawGrainHead(
    context: PixiDrawContext,
    definition: PlantDefinition,
    x: number,
    y: number,
    size: number,
    rotation: number,
    motion: PlantMotion,
) {
    context.fillStyle = definition.fruitColor
    context.strokeStyle = 'rgba(105, 82, 28, 0.28)'
    context.lineWidth = 0.9
    context.beginPath()
    addEllipse(context, x, y, size * 0.66, size * 1.3, rotation)
    context.fill()
    context.stroke()

    if (motion.detail === 0) return

    context.strokeStyle = 'rgba(255, 241, 163, 0.42)'
    context.lineWidth = 0.8
    context.beginPath()
    context.moveTo(x - size * 0.16, y - size * 0.72)
    context.lineTo(x + size * 0.12, y + size * 0.62)
    context.stroke()

    if (motion.detail === 2) {
        context.fillStyle = 'rgba(255, 249, 189, 0.34)'
        context.beginPath()
        addEllipse(context, x - 1.3, y - 2, size * 0.22, size * 0.42, rotation)
        context.fill()
    }
}

function drawBaseBlades(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, motion: PlantMotion) {
    context.strokeStyle = 'rgba(45, 82, 32, 0.25)'
    context.lineWidth = 5
    context.beginPath()
    context.moveTo(centerX - 16, baseY - 2)
    context.quadraticCurveTo(centerX - 8, baseY - 12, centerX - 4 + motion.sway * 0.18, baseY - 19)
    context.moveTo(centerX + 16, baseY - 2)
    context.quadraticCurveTo(centerX + 8, baseY - 12, centerX + 4 + motion.sway * 0.18, baseY - 18)
    context.stroke()

    context.strokeStyle = definition.leafColor
    context.lineWidth = 2.2
    context.beginPath()
    context.moveTo(centerX - 16, baseY - 3)
    context.quadraticCurveTo(centerX - 8, baseY - 13, centerX - 4 + motion.sway * 0.18, baseY - 20)
    context.moveTo(centerX + 16, baseY - 3)
    context.quadraticCurveTo(centerX + 8, baseY - 13, centerX + 4 + motion.sway * 0.18, baseY - 19)
    context.stroke()
}

function drawVineGroundCurl(context: PixiDrawContext, definition: PlantDefinition, centerX: number, baseY: number, motion: PlantMotion) {
    context.strokeStyle = 'rgba(56, 76, 33, 0.22)'
    context.lineWidth = 5
    context.beginPath()
    context.moveTo(centerX - 20, baseY - 4)
    context.bezierCurveTo(centerX - 7, baseY - 12, centerX + 11, baseY + 2, centerX + 22, baseY - 7)
    context.stroke()

    context.strokeStyle = definition.stemColor
    context.lineWidth = 2.4
    context.beginPath()
    context.moveTo(centerX - 20, baseY - 5)
    context.bezierCurveTo(centerX - 7, baseY - 13, centerX + 11 + motion.sway * 0.2, baseY + 1, centerX + 22, baseY - 8)
    context.stroke()
}

function drawVineTendril(context: PixiDrawContext, definition: PlantDefinition, x: number, y: number, motion: PlantMotion) {
    const curl = 2.5 + motion.sparkle * 0.6

    context.strokeStyle = definition.accentColor
    context.lineWidth = 1.15
    context.beginPath()
    context.moveTo(x, y)
    context.bezierCurveTo(x + 5, y - 5, x + 9 + curl, y + 2, x + 3, y + 5)
    context.stroke()
}

function drawFruitCluster(
    context: PixiDrawContext,
    definition: PlantDefinition,
    x: number,
    y: number,
    plant: PlantType,
    motion: PlantMotion,
) {
    const seed = hashNumber(plant)
    const baseCount = definition.kind === 'vine' ? 7 : definition.kind === 'bush' ? 5 : Math.round(3 + seed * 2)
    const count = motion.detail === 0 ? Math.min(3, baseCount) : baseCount
    const clusterRadius = definition.kind === 'vine' ? 6 : definition.kind === 'bush' ? 8 : 9
    const elongated = definition.kind === 'grain' && seed > 0.58

    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + seed * 0.3
        const sparkle = 1 + Math.sin(motion.time * 3 + motion.phase + i * 0.7) * (motion.detail === 0 ? 0.02 : 0.075)
        const fx = x + Math.cos(angle) * clusterRadius * 0.74
        const fy = y + Math.sin(angle) * clusterRadius * 0.48

        context.fillStyle = definition.fruitColor
        context.strokeStyle = 'rgba(86, 65, 23, 0.3)'
        context.lineWidth = 1
        context.beginPath()
        addEllipse(context, fx, fy, (elongated ? 4.2 : 3.8) * sparkle, (elongated ? 7.4 : 3.8) * sparkle, elongated ? 0.1 : 0)
        context.fill()
        context.stroke()

        if (motion.detail > 0) {
            context.fillStyle = 'rgba(255, 246, 196, 0.38)'
            context.beginPath()
            addCircle(context, fx - 1.1, fy - 1.2, 1.05)
            context.fill()
        }
    }

    if (motion.detail === 2) {
        context.fillStyle = definition.accentColor
        context.beginPath()
        addCircle(context, x - 2, y - 2, 2.2)
        context.fill()
    }
}

function drawCanopyBlob(
    context: PixiDrawContext,
    fillColor: string,
    strokeColor: string,
    lineWidth: number,
    lobes: Array<{ x: number; y: number; radius: number }>,
) {
    context.fillStyle = fillColor
    context.strokeStyle = strokeColor
    context.lineWidth = lineWidth
    context.beginPath()
    for (const lobe of lobes) {
        addCircle(context, lobe.x, lobe.y, lobe.radius)
    }
    context.fill()
    context.stroke()
}

function drawPlantGroundShadow(
    context: PixiDrawContext,
    centerX: number,
    baseY: number,
    stage: CropStatus,
    kind: PlantDefinition['kind'],
    motion: PlantMotion,
) {
    const width = stage === 'harvestable'
        ? kind === 'tree' ? 28 : kind === 'vine' ? 25 : 22
        : stage === 'growing' ? 18 : 14
    const alpha = stage === 'withered' ? 0.2 : 0.14
    const stretch = width * motion.pulse * (0.96 + motion.variant * 0.08)

    context.fillStyle = `rgba(72, 55, 22, ${alpha})`
    context.beginPath()
    addEllipse(context, centerX, baseY + 2, stretch, 4.4, 0)
    context.fill()

    if (motion.detail > 0) {
        context.fillStyle = 'rgba(255, 236, 154, 0.08)'
        context.beginPath()
        addEllipse(context, centerX - 2, baseY - 1, width * 0.76, 2.4, 0)
        context.fill()
    }
}

function strokeOutlined(context: PixiDrawContext, color: string, lineWidth: number, outline: string) {
    context.strokeStyle = outline
    context.lineWidth = lineWidth + 1.8
    context.stroke()
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.stroke()
}

function addCircle(context: PixiDrawContext, x: number, y: number, radius: number) {
    context.moveTo(x + radius, y)
    context.arc(x, y, radius, 0, Math.PI * 2)
}

function addEllipse(context: PixiDrawContext, x: number, y: number, radiusX: number, radiusY: number, rotation: number) {
    context.moveTo(x + Math.cos(rotation) * radiusX, y + Math.sin(rotation) * radiusX)
    context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2)
}

function hashNumber(value: number) {
    const next = Math.sin(value * 127.1 + 311.7) * 43758.5453123

    return next - Math.floor(next)
}
