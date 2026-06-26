import type {GameItemType, PlantAnimationEffect, PlantType} from './types'

export const ITEM_TYPE_GRAIN_SEED = 'grain_seed' satisfies GameItemType
export const ITEM_TYPE_GRAIN_CROP = 'grain_crop' satisfies GameItemType
export const ITEM_TYPE_PROP = 'prop' satisfies GameItemType
export const ITEM_TYPE_TOOL = 'tool' satisfies GameItemType

export const fallbackPlantAnimationEffect: PlantAnimationEffect = {
    seedColor: '#8b6b3a',
    stemColor: '#4b8f3f',
    leafColor: '#6eb858',
    fruitColor: '#d9e078',
    accentColor: '#eaf0a6',
    kind: 'grain',
}

export const plantAnimationEffectsByItemId: Partial<Record<PlantType, PlantAnimationEffect>> = {
    1001: {
        kind: 'grain',
        seedColor: '#9c6c2f',
        stemColor: '#8b7a2a',
        leafColor: '#d8bd48',
        fruitColor: '#efd66b',
        accentColor: '#f8e38a',
    },
    1002: {
        kind: 'grain',
        seedColor: '#8b6b3a',
        stemColor: '#4b8f3f',
        leafColor: '#6eb858',
        fruitColor: '#d9e078',
        accentColor: '#eaf0a6',
    },
    1003: {
        kind: 'bush',
        seedColor: '#caa347',
        stemColor: '#4e8a45',
        leafColor: '#6fb85b',
        fruitColor: '#d9b14b',
        accentColor: '#f0d075',
    },
    1004: {
        kind: 'grain',
        seedColor: '#d7a642',
        stemColor: '#5f9d45',
        leafColor: '#7fc45c',
        fruitColor: '#f0c94d',
        accentColor: '#fff095',
    },
    1005: {
        kind: 'tree',
        seedColor: '#9d6745',
        stemColor: '#7a5230',
        leafColor: '#5fa04f',
        fruitColor: '#d94a3d',
        accentColor: '#f16d5e',
    },
    1006: {
        kind: 'tree',
        seedColor: '#a46a4d',
        stemColor: '#7a5230',
        leafColor: '#67a957',
        fruitColor: '#ef9f7a',
        accentColor: '#ffd0ad',
    },
    1007: {
        kind: 'vine',
        seedColor: '#6a5240',
        stemColor: '#6a5a35',
        leafColor: '#5e9d48',
        fruitColor: '#7d4ba6',
        accentColor: '#a278d1',
    },
    1008: {
        kind: 'bush',
        seedColor: '#8f5633',
        stemColor: '#4f8e42',
        leafColor: '#6fbd5f',
        fruitColor: '#d83b43',
        accentColor: '#ff7a82',
    },
}
