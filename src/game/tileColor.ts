import {parseHexColor, resolveThemeColor} from './colorUtils'
import {terrainColors} from './config'
import type {Tile} from './types'

export interface RgbColor {
    blue: number
    green: number
    red: number
}

const overviewTileColorCache = new Map<string, {hex: string; rgb: RgbColor}>()

export function getOverviewTileColor(tile: Tile) {
    return getOverviewTileColorEntry(tile).hex
}

export function getOverviewTileRgb(tile: Tile): RgbColor {
    return getOverviewTileColorEntry(tile).rgb
}

function getOverviewTileColorEntry(tile: Tile) {
    const key = `${tile.terrain}:${tile.themeColor ?? ''}`
    const cached = overviewTileColorCache.get(key)
    if (cached) return cached

    const baseColor = terrainColors[tile.terrain]
    const rgb = tile.themeColor
        ? blendOverviewThemeColor(tile, baseColor)
        : parseHexColor(baseColor)
    const entry = {
        hex: rgbToHex(rgb),
        rgb,
    }

    overviewTileColorCache.set(key, entry)

    return entry
}

function blendOverviewThemeColor(tile: Tile, baseColor: string) {
    const themeColor = resolveThemeColor(tile.themeColor, '#d8b85b')
    const alpha = tile.terrain === 'home' ? 0.68 : 0.24

    return blendRgb(parseHexColor(baseColor), parseHexColor(themeColor), alpha)
}

export function parseOverviewTileColor(tile: Tile): RgbColor {
    return getOverviewTileRgb(tile)
}

function blendRgb(base: RgbColor, overlay: RgbColor, alpha: number): RgbColor {
    const safeAlpha = Math.max(0, Math.min(1, alpha))

    return {
        red: Math.round(base.red * (1 - safeAlpha) + overlay.red * safeAlpha),
        green: Math.round(base.green * (1 - safeAlpha) + overlay.green * safeAlpha),
        blue: Math.round(base.blue * (1 - safeAlpha) + overlay.blue * safeAlpha),
    }
}

function rgbToHex(color: RgbColor) {
    return `#${[color.red, color.green, color.blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}
