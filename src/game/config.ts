import type {ObjectType, Terrain} from './types'

export const tileSize = 64
export const overviewCellSize = 8
export const minScale = 0.28
export const maxScale = 2.35
export const maxPixelRatio = 2
export const maxOwnerLabelScale = 1.02

export const terrainColors: Record<Terrain, string> = {
    grass: '#8fc86a',
    field: '#d8b85b',
    home: '#caa96f',
    water: '#4fb1c5',
    mountain: '#8f8978',
}

export const terrainBrightColors: Record<Terrain, string> = {
    grass: '#b4dc83',
    field: '#ebd278',
    home: '#e3c990',
    water: '#92d8df',
    mountain: '#b4ae9b',
}

export const terrainDarkColors: Record<Terrain, string> = {
    grass: '#67a94f',
    field: '#a98732',
    home: '#8d6c3d',
    water: '#2d7f9f',
    mountain: '#625f56',
}

export const objectLabels: Record<ObjectType, string> = {
    home: '住宅',
    watchdog: '看门狗',
    scarecrow: '稻草人',
    player_statue: '雕像',
}
