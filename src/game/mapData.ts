import {tileSize} from './config'
import {createBaseTerrainLookup} from './baseMapUtils'
import {createEmptyCropPatch} from './tileState'
import type {
    BaseMapJson,
    BaseTerrain,
    Butterfly,
    MapJson,
    Terrain,
    Tile,
} from './types'

export function createLocalMapJson(baseMap: BaseMapJson): MapJson {
    const baseTerrainAt = createBaseTerrainLookup(baseMap)
    const {width, height} = baseMap.grid

    return {
        schemaVersion: 'myland.map.v1',
        id: baseMap.id,
        code: baseMap.code,
        name: baseMap.name,
        width,
        height,
        tiles: Array.from({length: width * height}, (_, index) => {
            const x = index % width
            const y = Math.floor(index / width)

            return createBaseTile(x, y, width, baseTerrainAt)
        }),
        objects: [],
    }
}

function createBaseTile(
    x: number,
    y: number,
    width: number,
    baseTerrainAt: (x: number, y: number) => BaseTerrain,
): Tile {
    const id = String(y * width + x + 1).padStart(4, '0')
    const baseTerrain = baseTerrainAt(x, y)
    let terrain: Terrain = 'grass'
    let name = `草地 ${id}`
    let crop = '未开拓草地'
    let status = '未开拓'
    let humidity = Math.floor(28 + hash(x + 23, y + 41) * 68)

    if (baseTerrain === 'mountain') {
        terrain = 'mountain'
        name = `环山 ${id}`
        crop = '环山'
        status = '不可开拓'
    } else if (baseTerrain === 'water') {
        terrain = 'water'
        name = `河道 ${id}`
        crop = '河流'
        status = '不可耕作'
        humidity = 100
    }

    return {
        id,
        x,
        y,
        landId: null,
        landName: null,
        landQuality: null,
        ownerPlayerId: null,
        terrain,
        ownerType: 'none',
        owner: '无主',
        name,
        fertility: Math.floor(35 + hash(x + 33, y + 11) * 62),
        humidity,
        security: Math.floor(16 + hash(x + 61, y + 17) * 64),
        ...createEmptyCropPatch(status, crop),
    }
}

export function createButterflies(tiles: Tile[]): Butterfly[] {
    const butterflies: Butterfly[] = []
    const emptyGrassTiles = tiles.filter((tile) => tile.terrain === 'grass' && tile.ownerType === 'none')
    const usedIndexes = new Set<number>()

    while (butterflies.length < 90 && usedIndexes.size < emptyGrassTiles.length) {
        const index = Math.floor(Math.random() * emptyGrassTiles.length)
        if (usedIndexes.has(index)) continue

        usedIndexes.add(index)
        const tile = emptyGrassTiles[index]
        butterflies.push({
            tileX: tile.x,
            tileY: tile.y,
            x: (tile.x + 0.22 + Math.random() * 0.56) * tileSize,
            y: (tile.y + 0.22 + Math.random() * 0.56) * tileSize,
            phase: Math.random() * Math.PI * 2,
            speed: 0.75 + Math.random() * 0.85,
        })
    }

    return butterflies
}

export function hash(x: number, y: number) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123

    return value - Math.floor(value)
}
