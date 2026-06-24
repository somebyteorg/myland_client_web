import {parseOverviewTileColor} from './tileColor'
import type {CameraState, ViewportRect} from './mapCamera'
import type {Tile} from './types'

export function buildMinimapStaticMapCanvas(tiles: Tile[], mapWidth: number, mapHeight: number) {
    const canvas = document.createElement('canvas')
    canvas.width = mapWidth
    canvas.height = mapHeight

    const context = canvas.getContext('2d')
    if (!context) return null

    const image = context.createImageData(mapWidth, mapHeight)

    for (const tile of tiles) {
        const index = (tile.y * mapWidth + tile.x) * 4
        const color = parseOverviewTileColor(tile)

        image.data[index] = color.red
        image.data[index + 1] = color.green
        image.data[index + 2] = color.blue
        image.data[index + 3] = 255
    }
    context.putImageData(image, 0, 0)

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
