import type {Butterfly, MapObject, Tile} from './types'

export function canShowButterflyOnTile(tile: Tile | null | undefined) {
    return Boolean(tile && tile.terrain === 'grass' && tile.ownerType === 'none')
}

export function removeButterfliesFromTileIfNeeded(butterflies: Butterfly[], tile: Tile) {
    if (canShowButterflyOnTile(tile)) return

    removeButterfliesFromTile(butterflies, tile.x, tile.y)
}

export function removeButterfliesFromTile(butterflies: Butterfly[], x: number, y: number) {
    for (let index = butterflies.length - 1; index >= 0; index -= 1) {
        const butterfly = butterflies[index]
        if (butterfly.tileX === x && butterfly.tileY === y) {
            butterflies.splice(index, 1)
        }
    }
}

export function removeButterfliesFromObject(butterflies: Butterfly[], object: MapObject) {
    for (let y = object.y; y < object.y + object.height; y += 1) {
        for (let x = object.x; x < object.x + object.width; x += 1) {
            removeButterfliesFromTile(butterflies, x, y)
        }
    }
}
