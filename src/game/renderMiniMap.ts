import {overviewCellSize, terrainColors} from './config'
import {hexToRgba, resolveThemeColor} from './colorUtils'
import {hash} from './mapData'
import type {CameraState, ViewportRect} from './mapCamera'
import type {Tile} from './types'

export interface BuildMinimapStaticMapOptions {
    claimableFilterEnabled: boolean
    canPlaceLandAt: (tile: Tile) => boolean
}

const maxOverviewCanvasSize = 2048

export function buildOverviewMapCanvas(tiles: Tile[], mapWidth: number, mapHeight: number) {
    const cellSize = getOverviewCellSize(mapWidth, mapHeight)
    const width = mapWidth * cellSize
    const height = mapHeight * cellSize
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return null

    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#9bd071')
    gradient.addColorStop(0.55, '#78bb60')
    gradient.addColorStop(1, '#609f59')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    for (const tile of tiles) {
        const left = tile.x * cellSize
        const top = tile.y * cellSize
        context.fillStyle = getOverviewColor(tile)
        context.fillRect(left, top, cellSize, cellSize)
    }

    return canvas
}

function getOverviewCellSize(mapWidth: number, mapHeight: number) {
    return Math.max(1, Math.min(overviewCellSize, Math.floor(maxOverviewCanvasSize / Math.max(mapWidth, mapHeight, 1))))
}

export function buildMinimapStaticMapCanvas(tiles: Tile[], mapWidth: number, mapHeight: number, options: BuildMinimapStaticMapOptions) {
    const canvas = document.createElement('canvas')
    canvas.width = mapWidth
    canvas.height = mapHeight

    const context = canvas.getContext('2d')
    if (!context) return null

    for (const tile of tiles) {
        context.fillStyle = getMiniMapColor(tile, options)
        context.fillRect(tile.x, tile.y, 1, 1)
    }

    return canvas
}

export function drawMiniMapViewport(
    context: CanvasRenderingContext2D,
    options: {
        camera: CameraState
        mainBounds: Pick<ViewportRect, 'width' | 'height'>
        minimapBounds: Pick<ViewportRect, 'width' | 'height'>
        staticCanvas: HTMLCanvasElement
        worldWidth: number
        worldHeight: number
    },
) {
    context.clearRect(0, 0, options.minimapBounds.width, options.minimapBounds.height)
    context.drawImage(options.staticCanvas, 0, 0, options.minimapBounds.width, options.minimapBounds.height)

    const viewX = Math.max(0, -options.camera.x / options.camera.scale)
    const viewY = Math.max(0, -options.camera.y / options.camera.scale)
    const viewW = Math.min(options.worldWidth, options.mainBounds.width / options.camera.scale)
    const viewH = Math.min(options.worldHeight, options.mainBounds.height / options.camera.scale)

    context.strokeStyle = '#fff2a7'
    context.lineWidth = 2
    context.strokeRect(
        (viewX / options.worldWidth) * options.minimapBounds.width,
        (viewY / options.worldHeight) * options.minimapBounds.height,
        (viewW / options.worldWidth) * options.minimapBounds.width,
        (viewH / options.worldHeight) * options.minimapBounds.height,
    )
}

function getOverviewColor(tile: Tile) {
    if (tile.themeColor) return tile.terrain === 'home' ? resolveThemeColor(tile.themeColor) : hexToRgba(tile.themeColor, 0.7)
    if (tile.ownerType === 'player') return '#e7c84f'
    if (tile.ownerType === 'neighbor') return '#967143'
    if (tile.ownerType === 'village') return '#d2bb86'
    if (tile.terrain === 'grass') return hash(tile.x, tile.y) > 0.54 ? '#82bd65' : '#77b65f'

    return terrainColors[tile.terrain]
}

function getMiniMapColor(tile: Tile, options: BuildMinimapStaticMapOptions) {
    if (tile.themeColor) return resolveThemeColor(tile.themeColor)
    if (tile.ownerType === 'player') return '#ffe26f'
    if (options.claimableFilterEnabled && options.canPlaceLandAt(tile)) return '#ffd657'
    if (tile.ownerType === 'neighbor') return '#9b6a38'
    if (tile.terrain === 'water') return '#42aeca'
    if (tile.terrain === 'mountain') return '#6d695d'
    if (tile.ownerType === 'village') return '#d5bc87'

    return terrainColors[tile.terrain]
}
