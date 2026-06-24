import {maxOwnerLabelScale, tileSize} from './config'
import {formatRemain, getPlantRemainingMs} from './tileRules'
import type {TileBounds} from './landChunks'
import type {MapObject, OwnerLabelCluster, Tile} from './types'
import type {PixiDrawContext} from './pixiDrawContext'

type TileLookup = (x: number, y: number) => Tile | null
type PlacementMode = 'pioneer' | 'deed' | null

interface TileMapLabel {
    text: string
}

interface OwnerClusterLabelScale {
    height: number
    maxFontSize: number
    maxRadius: number
    maxScreenWidth: {
        normal: number
        playerId: number
    }
    minFontSize: number
    minScreenWidth: {
        normal: number
        playerId: number
    }
    paddingX: number
    radius: number
    screenFontSize: number
    strokeWidth: number
}

export interface DrawTileLabelsOptions {
    cameraScale: number
    landPlacementMode: PlacementMode
    mapObjects: MapObject[]
    ownerLabelClusters: OwnerLabelCluster[]
    ownerLabelClusterTileKeys: ReadonlySet<string>
    tileAt: TileLookup
    worldHeight: number
}

export function buildOwnerLabelClusters(
    tiles: Tile[],
    tileAt: TileLookup,
    mapWidth: number,
    mapHeight: number,
) {
    const visited = new Set<string>()
    const clusters: OwnerLabelCluster[] = []

    for (const tile of tiles) {
        if (visited.has(tile.id) || !canTileJoinOwnerLabelCluster(tile)) continue

        const queue = [tile]
        const group: Tile[] = []
        let queueIndex = 0
        visited.add(tile.id)

        while (queueIndex < queue.length) {
            const current = queue[queueIndex]
            queueIndex += 1

            group.push(current)
            for (const neighbor of getOwnerLabelNeighbors(current, tileAt)) {
                if (visited.has(neighbor.id)) continue
                if (!canTileJoinOwnerLabelCluster(neighbor)) continue
                if (neighbor.ownerType !== tile.ownerType || neighbor.owner !== tile.owner) continue

                visited.add(neighbor.id)
                queue.push(neighbor)
            }
        }

        if (group.length < 2) continue

        const sum = group.reduce(
            (result, item) => {
                result.x += item.x
                result.y += item.y
                result.minX = Math.min(result.minX, item.x)
                result.maxX = Math.max(result.maxX, item.x)
                result.minY = Math.min(result.minY, item.y)
                result.maxY = Math.max(result.maxY, item.y)

                return result
            },
            {x: 0, y: 0, minX: mapWidth, maxX: 0, minY: mapHeight, maxY: 0},
        )

        clusters.push({
            id: `${tile.ownerType}-${tile.owner}-${group[0].id}`,
            ownerType: tile.ownerType,
            owner: tile.owner,
            count: group.length,
            centerX: sum.x / group.length,
            centerY: sum.y / group.length,
            minX: sum.minX,
            maxX: sum.maxX,
            minY: sum.minY,
            maxY: sum.maxY,
            tileKeys: new Set(group.map(getTileClusterKey)),
        })
    }

    return clusters
}

export function buildOwnerLabelClusterTileKeys(ownerLabelClusters: OwnerLabelCluster[]) {
    const tileKeys = new Set<string>()

    for (const cluster of ownerLabelClusters) {
        for (const tileKey of cluster.tileKeys) {
            tileKeys.add(tileKey)
        }
    }

    return tileKeys
}

export function drawTileLabels(context: PixiDrawContext, bounds: TileBounds, options: DrawTileLabelsOptions) {
    const compactLabelsOnly = options.cameraScale < 0.74
    const ownershipLabelsVisible = options.cameraScale < maxOwnerLabelScale

    context.font = '700 10px sans-serif'
    context.textBaseline = 'top'
    if (ownershipLabelsVisible) drawOwnerClusterLabels(context, bounds, options)
    drawPioneerOccupiedHomeLabels(context, bounds, options)

    if (compactLabelsOnly) return

    context.font = '700 10px sans-serif'
    context.textBaseline = 'top'
    context.textAlign = 'start'

    for (let y = bounds.startY; y <= bounds.endY; y += 1) {
        for (let x = bounds.startX; x <= bounds.endX; x += 1) {
            const tile = options.tileAt(x, y)
            if (!tile) continue

            const left = tile.x * tileSize
            const top = tile.y * tileSize
            const label = getTileMapLabel(tile, options.cameraScale, options.ownerLabelClusterTileKeys)
            if (!label) continue
            drawCenteredTileLabel(context, label.text, left, top, options.cameraScale)
        }
    }
}

function drawCenteredTileLabel(context: PixiDrawContext, text: string, left: number, top: number, cameraScale: number) {
    const fontSize = clamp(11.5 / cameraScale, 9.5, 16)
    const paddingX = clamp(5.5 / cameraScale, 4.5, 8)
    const labelHeight = clamp(19 / cameraScale, 18, 26)
    const maxLabelWidth = tileSize * 0.9

    context.save()
    const fittedLabel = fitLabelText(context, text, maxLabelWidth - paddingX * 2, fontSize, 8.5)
    const labelWidth = Math.min(maxLabelWidth, fittedLabel.width + paddingX * 2)
    const labelLeft = left + (tileSize - labelWidth) / 2
    const labelTop = top + 6

    context.fillStyle = 'rgba(255, 248, 220, 0.86)'
    context.fillRect(labelLeft, labelTop, labelWidth, labelHeight)
    context.fillStyle = '#3b3120'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(fittedLabel.text, left + tileSize / 2, labelTop + labelHeight / 2)
    context.restore()
}

function canTileJoinOwnerLabelCluster(tile: Tile) {
    if (tile.terrain === 'home') return false

    return tile.ownerType === 'player' || tile.ownerType === 'neighbor'
}

function getOwnerLabelNeighbors(tile: Tile, tileAt: TileLookup) {
    const neighbors = [
        tileAt(tile.x - 1, tile.y),
        tileAt(tile.x + 1, tile.y),
        tileAt(tile.x, tile.y - 1),
        tileAt(tile.x, tile.y + 1),
    ]

    return neighbors.filter((neighbor): neighbor is Tile => Boolean(neighbor))
}

function drawPioneerOccupiedHomeLabels(context: PixiDrawContext, bounds: TileBounds, options: DrawTileLabelsOptions) {
    if (options.landPlacementMode !== 'pioneer') return

    for (const object of options.mapObjects) {
        if (object.type !== 'home' || object.ownerType === 'player' || !mapObjectIntersectsBounds(object, bounds)) continue

        const centerX = (object.x + object.width / 2) * tileSize
        const centerY = (object.y + object.height / 2) * tileSize
        const ownerName = object.ownerData?.name?.trim() || '已占用'
        const compact = options.cameraScale < 0.9
        const fontScale = options.cameraScale < 1 ? 1 / options.cameraScale : 1
        const label = ownerName
        const detail = compact ? '' : getHomeOwnerDetailLabel(object)
        const fontSize = (compact ? 11 : 12) * fontScale
        const detailFontSize = 10 * fontScale
        const paddingX = (compact ? 8 : 9) * fontScale
        const lineHeight = (compact ? 16 : 15) * fontScale
        const height = detail ? lineHeight * 2 + 8 * fontScale : lineHeight + 8 * fontScale
        const homeScreenWidth = object.width * tileSize * options.cameraScale
        const maxScreenWidth = Math.max(44, Math.min(compact ? 72 : 112, homeScreenWidth - 10))
        const maxWidth = maxScreenWidth / options.cameraScale

        context.save()
        context.font = `900 ${fontSize}px sans-serif`
        const labelWidth = context.measureText(label).width
        context.font = `800 ${detailFontSize}px sans-serif`
        const detailWidth = detail ? context.measureText(detail).width : 0
        const width = Math.min(maxWidth, Math.max(labelWidth, detailWidth) + paddingX * 2)
        const innerWidth = Math.max(0, width - paddingX * 2)
        const left = centerX - width / 2
        const top = centerY - height / 2

        context.fillStyle = 'rgba(255, 247, 223, 0.92)'
        context.strokeStyle = '#9b6a38'
        context.lineWidth = 2 * fontScale
        context.beginPath()
        context.roundRect(left, top, width, height, 6 * fontScale)
        context.fill()
        context.stroke()
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillStyle = '#3b3120'
        context.font = `900 ${fontSize}px sans-serif`
        context.fillText(fitCanvasText(context, label, innerWidth), centerX, detail ? top + lineHeight : centerY)
        if (detail) {
            context.fillStyle = '#725733'
            context.font = `800 ${detailFontSize}px sans-serif`
            context.fillText(fitCanvasText(context, detail, innerWidth), centerX, top + lineHeight * 2)
        }
        context.restore()
    }
}

function drawOwnerClusterLabels(context: PixiDrawContext, bounds: TileBounds, options: DrawTileLabelsOptions) {
    const minClusterCount = options.cameraScale < 0.45 ? 12 : options.cameraScale < 0.62 ? 6 : 4
    const maxVisibleLabels = options.cameraScale < 0.45 ? 90 : options.cameraScale < 0.62 ? 140 : 260
    let drawnLabels = 0

    for (const cluster of options.ownerLabelClusters) {
        if (cluster.maxX < bounds.startX || cluster.minX > bounds.endX || cluster.maxY < bounds.startY || cluster.minY > bounds.endY) continue
        if (options.cameraScale < 0.74 && cluster.count < minClusterCount) continue
        if (drawnLabels >= maxVisibleLabels) continue

        const zoomedOut = options.cameraScale < 0.74
        const label = zoomedOut
            ? cluster.ownerType === 'player'
                ? '我的地'
                : cluster.owner
            : cluster.ownerType === 'player'
                ? `我的地 x${cluster.count}`
                : `${getOwnerLabelText(cluster.owner)} x${cluster.count}`
        const compact = options.cameraScale < 1.02
        const x = compact ? (cluster.centerX + 0.5) * tileSize : (cluster.minX + cluster.maxX + 1) * tileSize / 2
        const outerBottomY = (cluster.maxY + 1) * tileSize + 15
        const y = compact ? (cluster.centerY + 0.5) * tileSize : Math.min(options.worldHeight - 14, outerBottomY)
        const metrics = getOwnerClusterLabelMetrics(cluster, options.cameraScale, zoomedOut)
        const fittedLabel = fitLabelText(context, label, metrics.maxWidth - metrics.paddingX * 2, metrics.fontSize, metrics.minFontSize)
        const width = Math.min(metrics.maxWidth, fittedLabel.width + metrics.paddingX * 2)

        context.fillStyle = cluster.ownerType === 'player'
            ? metrics.emphasis ? 'rgba(255, 229, 104, 0.96)' : 'rgba(255, 226, 111, 0.9)'
            : metrics.emphasis ? 'rgba(255, 241, 212, 0.96)' : 'rgba(255, 238, 204, 0.9)'
        context.strokeStyle = cluster.ownerType === 'player' ? '#9b7c22' : '#8f6030'
        context.lineWidth = metrics.lineWidth
        context.beginPath()
        context.roundRect(x - width / 2, y - metrics.height / 2, width, metrics.height, metrics.radius)
        context.fill()
        context.stroke()
        context.fillStyle = '#3b3120'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(fittedLabel.text, x, y)
        context.textAlign = 'start'
        context.textBaseline = 'top'
        drawnLabels += 1
    }
}

function getTileMapLabel(tile: Tile, cameraScale: number, ownerLabelClusterTileKeys: ReadonlySet<string>): TileMapLabel | null {
    const remaining = getPlantRemainingMs(tile)
    if (remaining > 0 && cameraScale > 0.92) {
        return {
            text: formatRemain(remaining),
        }
    }

    if (cameraScale >= maxOwnerLabelScale) return null

    if (
        tile.terrain !== 'home' &&
        (tile.ownerType === 'player' || tile.ownerType === 'neighbor') &&
        !ownerLabelClusterTileKeys.has(getTileClusterKey(tile))
    ) {
        return {
            text: tile.ownerType === 'player' ? '我的地' : getOwnerLabelText(tile.owner),
        }
    }

    return null
}

function getTileClusterKey(tile: Pick<Tile, 'x' | 'y'>) {
    return `${tile.x},${tile.y}`
}

function getOwnerLabelText(owner: string) {
    return isPlayerIdLabel(owner) ? owner : owner.slice(0, 3)
}

function getOwnerClusterLabelMetrics(cluster: OwnerLabelCluster, cameraScale: number, zoomedOut: boolean) {
    const scale = getOwnerClusterLabelScale(cameraScale, zoomedOut)
    const emphasis = scale !== normalOwnerClusterLabelScale
    const clusterWidth = Math.max(tileSize, (cluster.maxX - cluster.minX + 1) * tileSize)
    const playerIdLabel = isPlayerIdLabel(cluster.owner)
    const maxScreenWidth = playerIdLabel ? scale.maxScreenWidth.playerId : scale.maxScreenWidth.normal
    const minScreenWidth = playerIdLabel ? scale.minScreenWidth.playerId : scale.minScreenWidth.normal
    const fontSize = scaleScreenSize(scale.screenFontSize, cameraScale, 11, scale.maxFontSize)
    const minFontSize = scaleScreenSize(scale.minFontSize, cameraScale, 8.8, fontSize)
    const paddingX = scaleScreenSize(scale.paddingX, cameraScale, 7, scale.paddingX * 4)
    const height = scaleScreenSize(scale.height, cameraScale, 22, scale.height * 4)
    const maxWidth = Math.max(
        tileSize * 0.72,
        minScreenWidth / cameraScale,
        Math.min(clusterWidth * 0.94, maxScreenWidth / cameraScale),
    )

    return {
        emphasis,
        fontSize,
        height,
        lineWidth: scaleScreenSize(scale.strokeWidth, cameraScale, 2, scale.strokeWidth * 3),
        maxWidth,
        minFontSize,
        paddingX,
        radius: scaleScreenSize(scale.radius, cameraScale, 5.5, scale.maxRadius),
    }
}

const normalOwnerClusterLabelScale: OwnerClusterLabelScale = {
    height: 22,
    maxFontSize: 11,
    maxRadius: 6,
    maxScreenWidth: {
        normal: 96,
        playerId: 190,
    },
    minFontSize: 9,
    minScreenWidth: {
        normal: 0,
        playerId: 0,
    },
    paddingX: 7,
    radius: 6,
    screenFontSize: 11,
    strokeWidth: 2,
}

function getOwnerClusterLabelScale(cameraScale: number, zoomedOut: boolean): OwnerClusterLabelScale {
    if (cameraScale < 0.45) {
        return {
            height: 32,
            maxFontSize: 64,
            maxRadius: 32,
            maxScreenWidth: {
                normal: 190,
                playerId: 280,
            },
            minFontSize: 12,
            minScreenWidth: {
                normal: 76,
                playerId: 116,
            },
            paddingX: 12,
            radius: 9,
            screenFontSize: 16,
            strokeWidth: 3,
        }
    }

    if (zoomedOut) {
        return {
            height: 24,
            maxFontSize: 30,
            maxRadius: 12,
            maxScreenWidth: {
                normal: 166,
                playerId: 230,
            },
            minFontSize: 9.6,
            minScreenWidth: {
                normal: 0,
                playerId: 0,
            },
            paddingX: 8,
            radius: 6,
            screenFontSize: 13.2,
            strokeWidth: 2.4,
        }
    }

    if (cameraScale < 1) {
        return {
            height: 28,
            maxFontSize: 34,
            maxRadius: 14,
            maxScreenWidth: {
                normal: cameraScale >= 0.8 ? 176 : 148,
                playerId: cameraScale >= 0.8 ? 240 : 190,
            },
            minFontSize: cameraScale >= 0.8 ? 12 : 9.6,
            minScreenWidth: {
                normal: 0,
                playerId: 0,
            },
            paddingX: cameraScale >= 0.8 ? 10 : 8,
            radius: cameraScale >= 0.8 ? 7 : 6,
            screenFontSize: cameraScale >= 0.8 ? 15.5 : 14,
            strokeWidth: cameraScale >= 0.8 ? 2.8 : 2.4,
        }
    }

    return normalOwnerClusterLabelScale
}

function scaleScreenSize(screenSize: number, cameraScale: number, min: number, max: number) {
    return clamp(screenSize / cameraScale, min, max)
}

function isPlayerIdLabel(owner: string) {
    return /^\d+$/.test(owner) || /^[0-9a-f]{12,}$/i.test(owner) || owner.includes('_')
}

function getHomeOwnerDetailLabel(object: MapObject) {
    const owner = object.ownerData
    const gender = owner?.gender_string?.trim()
    const age = owner?.tick_age_string === undefined || owner.tick_age_string === null || owner.tick_age_string === ''
        ? ''
        : `${owner.tick_age_string}岁`
    return [gender, age, `L${object.level}`].filter(Boolean).join(' · ')
}

function fitCanvasText(context: PixiDrawContext, text: string, maxWidth: number) {
    if (maxWidth <= 0) return ''
    if (context.measureText(text).width <= maxWidth) return text

    const suffix = '..'
    if (context.measureText(suffix).width > maxWidth) return ''

    let result = text
    while (result.length > 0 && context.measureText(`${result}${suffix}`).width > maxWidth) {
        result = result.slice(0, -1)
    }

    return result ? `${result}${suffix}` : ''
}

function fitLabelText(context: PixiDrawContext, text: string, maxWidth: number, fontSize: number, minFontSize: number) {
    let nextFontSize = fontSize

    context.font = `900 ${nextFontSize}px sans-serif`
    while (nextFontSize > minFontSize && context.measureText(text).width > maxWidth) {
        nextFontSize = Math.max(minFontSize, nextFontSize - 0.5)
        context.font = `900 ${nextFontSize}px sans-serif`
    }

    const fittedText = fitCanvasText(context, text, maxWidth)

    return {
        text: fittedText,
        width: Math.ceil(context.measureText(fittedText).width),
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

function mapObjectIntersectsBounds(object: MapObject, bounds: TileBounds) {
    return object.x + object.width - 1 >= bounds.startX &&
        object.x <= bounds.endX &&
        object.y + object.height - 1 >= bounds.startY &&
        object.y <= bounds.endY
}
