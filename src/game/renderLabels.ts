import {maxOwnerLabelScale, tileSize} from './config'
import {formatRemain, getNeighbors, getPlantRemainingMs} from './tileRules'
import type {TileBounds} from './landChunks'
import type {MapObject, OwnerLabelCluster, Tile} from './types'

type TileLookup = (x: number, y: number) => Tile | null
type PlacementMode = 'pioneer' | 'deed' | null

interface TileMapLabel {
    text: string
    centered: boolean
}

export interface DrawTileLabelsOptions {
    cameraScale: number
    landPlacementMode: PlacementMode
    mapObjects: MapObject[]
    ownerLabelClusters: OwnerLabelCluster[]
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
        visited.add(tile.id)

        while (queue.length) {
            const current = queue.shift()
            if (!current) continue

            group.push(current)
            for (const neighbor of getNeighbors(current, tileAt)) {
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
        })
    }

    return clusters
}

export function drawTileLabels(context: CanvasRenderingContext2D, bounds: TileBounds, options: DrawTileLabelsOptions) {
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
            const label = getTileMapLabel(tile, options.cameraScale, options.ownerLabelClusters)
            if (!label) continue
            context.font = label.centered ? '700 8px sans-serif' : '700 10px sans-serif'
            const labelWidth = label.centered ? tileSize * 0.9 : Math.min(58, Math.ceil(context.measureText(label.text).width) + 8)
            const labelLeft = label.centered ? left + (tileSize - labelWidth) / 2 : left + 7
            const text = label.text
            const textWidth = Math.ceil(context.measureText(text).width)
            const textLeft = label.centered ? labelLeft + (labelWidth - textWidth) / 2 : labelLeft + 4
            const labelTop = top + 7
            const labelHeight = 17

            context.fillStyle = 'rgba(255, 248, 220, 0.82)'
            context.fillRect(labelLeft, labelTop, labelWidth, labelHeight)
            context.fillStyle = '#3b3120'
            context.textBaseline = label.centered ? 'middle' : 'top'
            context.fillText(text, textLeft, label.centered ? labelTop + labelHeight / 2 : top + 10)
            context.textBaseline = 'top'
        }
    }
}

function canTileJoinOwnerLabelCluster(tile: Tile) {
    if (tile.terrain === 'home') return false

    return tile.ownerType === 'player' || tile.ownerType === 'neighbor'
}

function drawPioneerOccupiedHomeLabels(context: CanvasRenderingContext2D, bounds: TileBounds, options: DrawTileLabelsOptions) {
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
        context.beginPath()
        context.rect(left + paddingX, top + 2 * fontScale, innerWidth, height - 4 * fontScale)
        context.clip()
        context.fillText(fitCanvasText(context, label, innerWidth), centerX, detail ? top + lineHeight : centerY)
        if (detail) {
            context.fillStyle = '#725733'
            context.font = `800 ${detailFontSize}px sans-serif`
            context.fillText(fitCanvasText(context, detail, innerWidth), centerX, top + lineHeight * 2)
        }
        context.restore()
    }
}

function drawOwnerClusterLabels(context: CanvasRenderingContext2D, bounds: TileBounds, options: DrawTileLabelsOptions) {
    for (const cluster of options.ownerLabelClusters) {
        if (cluster.maxX < bounds.startX || cluster.minX > bounds.endX || cluster.maxY < bounds.startY || cluster.minY > bounds.endY) continue
        if (options.cameraScale < 0.74 && cluster.count < 4) continue

        const zoomedOut = options.cameraScale < 0.74
        const label = zoomedOut
            ? cluster.ownerType === 'player'
                ? '我的地'
                : cluster.owner
            : cluster.ownerType === 'player'
                ? `我的地 x${cluster.count}`
                : `${cluster.owner.slice(0, 3)} x${cluster.count}`
        const compact = options.cameraScale < 1.02
        const x = compact ? (cluster.centerX + 0.5) * tileSize : (cluster.minX + cluster.maxX + 1) * tileSize / 2
        const outerBottomY = (cluster.maxY + 1) * tileSize + 15
        const y = compact ? (cluster.centerY + 0.5) * tileSize : Math.min(options.worldHeight - 14, outerBottomY)
        const fontSize = zoomedOut ? 12 / options.cameraScale : 10
        const paddingX = zoomedOut ? 7 / options.cameraScale : 7
        const height = zoomedOut ? 22 / options.cameraScale : 22

        context.font = `800 ${fontSize}px sans-serif`
        const width = Math.min(zoomedOut ? 112 / options.cameraScale : 86, context.measureText(label).width + paddingX * 2)

        context.fillStyle = cluster.ownerType === 'player' ? 'rgba(255, 226, 111, 0.9)' : 'rgba(255, 238, 204, 0.9)'
        context.strokeStyle = cluster.ownerType === 'player' ? '#9b7c22' : '#8f6030'
        context.lineWidth = zoomedOut ? 2 / options.cameraScale : 2
        context.beginPath()
        context.roundRect(x - width / 2, y - height / 2, width, height, zoomedOut ? 6 / options.cameraScale : 6)
        context.fill()
        context.stroke()
        context.fillStyle = '#3b3120'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(label, x, y)
        context.textAlign = 'start'
        context.textBaseline = 'top'
    }
}

function getTileMapLabel(tile: Tile, cameraScale: number, ownerLabelClusters: OwnerLabelCluster[]): TileMapLabel | null {
    const remaining = getPlantRemainingMs(tile)
    if (remaining > 0 && cameraScale > 0.92) {
        return {
            text: formatRemain(remaining),
            centered: true,
        }
    }

    if (cameraScale >= maxOwnerLabelScale) return null

    if (tile.terrain !== 'home' && (tile.ownerType === 'player' || tile.ownerType === 'neighbor') && !isTileInMultiCluster(tile, ownerLabelClusters)) {
        return {
            text: tile.ownerType === 'player' ? '我的地' : tile.owner.slice(0, 3),
            centered: false,
        }
    }

    return null
}

function isTileInMultiCluster(tile: Tile, ownerLabelClusters: OwnerLabelCluster[]) {
    return ownerLabelClusters.some((cluster) => {
        return (
            cluster.ownerType === tile.ownerType &&
            cluster.owner === tile.owner &&
            tile.x >= cluster.minX &&
            tile.x <= cluster.maxX &&
            tile.y >= cluster.minY &&
            tile.y <= cluster.maxY
        )
    })
}

function getHomeOwnerDetailLabel(object: MapObject) {
    const owner = object.ownerData
    const gender = owner?.gender_string?.trim()
    const age = owner?.tick_age_string === undefined || owner.tick_age_string === null || owner.tick_age_string === ''
        ? ''
        : `${owner.tick_age_string}岁`
    return [gender, age, `L${object.level}`].filter(Boolean).join(' · ')
}

function fitCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
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

function mapObjectIntersectsBounds(object: MapObject, bounds: TileBounds) {
    return object.x + object.width - 1 >= bounds.startX &&
        object.x <= bounds.endX &&
        object.y + object.height - 1 >= bounds.startY &&
        object.y <= bounds.endY
}
