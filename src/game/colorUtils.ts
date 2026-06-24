export const DEFAULT_HOME_COLOR = '#caa96f'

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function resolveThemeColor(color: string | null | undefined, fallback = DEFAULT_HOME_COLOR) {
    const value = color?.trim()
    if (!value) return fallback

    return normalizeHexColor(value) ?? fallback
}

export function normalizeHexColor(color: string) {
    const value = color.trim()
    if (!HEX_COLOR_RE.test(value)) return null

    const hex = value.slice(1)
    if (hex.length === 3) {
        return `#${hex.split('').map((part) => `${part}${part}`).join('')}`.toLowerCase()
    }

    return value.toLowerCase()
}

export function hexToRgba(color: string, alpha: number) {
    const normalized = resolveThemeColor(color)
    const {red, green, blue} = hexToRgb(normalized)
    const safeAlpha = Math.max(0, Math.min(1, alpha))

    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`
}

export function parseHexColor(color: string, fallback = DEFAULT_HOME_COLOR) {
    const normalized = normalizeHexColor(color) ?? resolveThemeColor(fallback)
    const hex = normalized.slice(1)
    const value = Number.parseInt(hex, 16)

    return {
        red: (value >> 16) & 255,
        green: (value >> 8) & 255,
        blue: value & 255,
    }
}

export function getThemeStrokeColor(color: string | null | undefined) {
    const normalized = resolveThemeColor(color)
    const target = getRelativeLuminance(normalized) > 0.72 ? '#3a3123' : '#fff7df'
    const weight = getRelativeLuminance(normalized) > 0.72 ? 0.58 : 0.34

    return mixHexColor(normalized, target, weight)
}

export function getThemeStructureColor(color: string | null | undefined) {
    const normalized = resolveThemeColor(color)

    return getRelativeLuminance(normalized) > 0.58 ? '#4a351f' : '#fff2c5'
}

export function mixHexColor(color: string, target: string, weight: number) {
    const from = hexToRgb(resolveThemeColor(color))
    const to = hexToRgb(resolveThemeColor(target))
    const safeWeight = Math.max(0, Math.min(1, weight))
    const red = Math.round(from.red * (1 - safeWeight) + to.red * safeWeight)
    const green = Math.round(from.green * (1 - safeWeight) + to.green * safeWeight)
    const blue = Math.round(from.blue * (1 - safeWeight) + to.blue * safeWeight)

    return rgbToHex(red, green, blue)
}

function getRelativeLuminance(color: string) {
    const {red, green, blue} = hexToRgb(resolveThemeColor(color))
    const [r, g, b] = [red, green, blue].map((value) => {
        const channel = value / 255

        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function hexToRgb(color: string) {
    return parseHexColor(resolveThemeColor(color))
}

function rgbToHex(red: number, green: number, blue: number) {
    return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}
