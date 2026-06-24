import {
    PLAYER_STATUE_IMAGE_QUALITY_STEP,
    PLAYER_STATUE_IMAGE_SIZE,
    PLAYER_STATUE_INITIAL_IMAGE_QUALITY,
    PLAYER_STATUE_MAX_UPLOAD_BYTES,
    PLAYER_STATUE_MIN_IMAGE_QUALITY,
} from './playerStatueConfig'

export interface PlayerStatueTransform {
    offsetX: number
    offsetY: number
    rotation: number
    zoom: number
}

export interface PlayerStatueGenerationSettings {
    artMode: PlayerStatueArtMode
    backgroundId: PlayerStatueBackgroundId
    backgroundScale: number
    materialId: PlayerStatueMaterialId
    mode: PlayerStatueCreateMode
    nameplateId: PlayerStatueNameplateId
    shapeId: PlayerStatueShapeId
}

interface PlayerStatueMaterial {
    accent: string
    dark: string
    edge: string
    id: string
    label: string
    light: string
    mid: string
    shadow: string
}

interface PlayerStatueNameplate {
    border: string
    id: string
    label: string
    plate: string
    text: string
    textStroke: string
}

interface PlayerStatueOption<Id extends string> {
    id: Id
    label: string
}

export const playerStatueArtModes = [
    {id: 'statue', label: '雕像'},
    {id: 'original', label: '原画'},
] as const satisfies readonly PlayerStatueOption<string>[]

export const playerStatueCreateModes = [
    {id: 'simple', label: '简单上传'},
    {id: 'generated', label: '制作雕像'},
] as const satisfies readonly PlayerStatueOption<string>[]

export const playerStatueShapes = [
    {id: 'person', label: '人物'},
    {id: 'monument', label: '纪念碑'},
    {id: 'crystal', label: '晶石'},
    {id: 'totem', label: '图腾'},
    {id: 'tablet', label: '石碑'},
] as const satisfies readonly PlayerStatueOption<string>[]

export const playerStatueMaterials = [
    {
        id: 'stone',
        label: '石像',
        light: '#ece6d7',
        mid: '#aaa18d',
        dark: '#676052',
        edge: '#3f3b34',
        accent: '#fffaf0',
        shadow: '#2d2a26',
    },
    {
        id: 'bronze',
        label: '铜像',
        light: '#d7b985',
        mid: '#9a6e38',
        dark: '#584024',
        edge: '#332919',
        accent: '#f4dfb5',
        shadow: '#271d13',
    },
    {
        id: 'gold',
        label: '金像',
        light: '#f2d77c',
        mid: '#bd8f31',
        dark: '#75591f',
        edge: '#3e3218',
        accent: '#fff3ad',
        shadow: '#30250d',
    },
    {
        id: 'jade',
        label: '玉像',
        light: '#dcebdc',
        mid: '#8fb69b',
        dark: '#537364',
        edge: '#2c493f',
        accent: '#f4fff5',
        shadow: '#1d332d',
    },
] as const satisfies readonly PlayerStatueMaterial[]

export const playerStatueBackgrounds = [
    {id: 'none', label: '无'},
    {id: 'panel', label: '背板'},
    {id: 'arch', label: '石拱'},
    {id: 'banner', label: '锦旗'},
    {id: 'custom', label: '背景图'},
] as const satisfies readonly PlayerStatueOption<string>[]

export const playerStatueNameplates = [
    {id: 'dark', label: '深色', plate: '#4b392b', border: '#2f251d', text: '#fff2c7', textStroke: '#241b14'},
    {id: 'stone', label: '石色', plate: '#ead9ae', border: '#9f8050', text: '#47331d', textStroke: '#fff5d6'},
    {id: 'gold', label: '金色', plate: '#b7862f', border: '#6c4a18', text: '#fff1b8', textStroke: '#47300f'},
    {id: 'jade', label: '青玉', plate: '#6b987f', border: '#345947', text: '#f1fff3', textStroke: '#243f35'},
    {id: 'redwood', label: '红木', plate: '#8a4b3b', border: '#5a2d24', text: '#ffe4c8', textStroke: '#3a1e19'},
] as const satisfies readonly PlayerStatueNameplate[]

export type PlayerStatueArtMode = typeof playerStatueArtModes[number]['id']
export type PlayerStatueCreateMode = typeof playerStatueCreateModes[number]['id']
export type PlayerStatueMaterialId = typeof playerStatueMaterials[number]['id']
export type PlayerStatueBackgroundId = typeof playerStatueBackgrounds[number]['id']
export type PlayerStatueNameplateId = typeof playerStatueNameplates[number]['id']
export type PlayerStatueShapeId = typeof playerStatueShapes[number]['id']

interface DrawPlayerStatueOptions {
    artMode: PlayerStatueArtMode
    backgroundId: PlayerStatueBackgroundId
    backgroundImage: HTMLImageElement | null
    backgroundScale: number
    image: HTMLImageElement | null
    inscription: string
    materialId: PlayerStatueMaterialId
    nameplateId: PlayerStatueNameplateId
    shapeId: PlayerStatueShapeId
    size: number
    transform: PlayerStatueTransform
}

interface DrawPlayerStatueMapPreviewOptions extends DrawPlayerStatueOptions {
    height: number
    width: number
}

const fallbackMaterial = playerStatueMaterials[0]
const fallbackNameplate = playerStatueNameplates[0]

export function drawGeneratedPlayerStatue(context: CanvasRenderingContext2D, options: DrawPlayerStatueOptions) {
    const {artMode, backgroundId, backgroundImage, backgroundScale, image, inscription, size, transform} = options
    const material = getPlayerStatueMaterial(options.materialId)
    const nameplate = getPlayerStatueNameplate(options.nameplateId)

    context.clearRect(0, 0, size, size)
    context.save()
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    drawGroundShadow(context, size, material)
    drawBackground(context, size, material, backgroundId, backgroundImage, backgroundScale, options.shapeId)
    drawPedestal(context, size, material)
    drawStatueBody(context, size, material, image, transform, artMode, options.shapeId)
    drawPedestalInscription(context, size, nameplate, inscription)

    context.restore()
}

export function drawSimplePlayerStatue(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement | null,
    size: number,
    transform: PlayerStatueTransform = defaultPlayerStatueTransform(),
) {
    context.clearRect(0, 0, size, size)
    context.save()
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    if (image) {
        drawTransformedSourceImage(context, image, size, transform, {
            centerY: 0.5,
            focusSize: 1,
        })
    } else {
        context.fillStyle = 'rgba(80, 66, 38, 0.1)'
        context.beginPath()
        context.roundRect(size * 0.13, size * 0.13, size * 0.74, size * 0.74, size * 0.04)
        context.fill()

        context.strokeStyle = 'rgba(80, 66, 38, 0.28)'
        context.lineWidth = size * 0.012
        context.setLineDash([size * 0.035, size * 0.025])
        context.stroke()
        context.setLineDash([])

        context.fillStyle = 'rgba(80, 66, 38, 0.18)'
        context.beginPath()
        context.ellipse(size * 0.5, size * 0.45, size * 0.13, size * 0.16, 0, 0, Math.PI * 2)
        context.fill()
        context.beginPath()
        context.ellipse(size * 0.5, size * 0.66, size * 0.24, size * 0.13, 0, 0, Math.PI * 2)
        context.fill()
    }

    context.restore()
}

export function drawGeneratedPlayerStatueEmpty(
    context: CanvasRenderingContext2D,
    size: number,
    settings: PlayerStatueGenerationSettings,
    inscription = '',
) {
    const material = getPlayerStatueMaterial(settings.materialId)
    const nameplate = getPlayerStatueNameplate(settings.nameplateId)

    context.clearRect(0, 0, size, size)
    context.save()
    context.fillStyle = hexToRgba(material.shadow, 0.08)
    context.beginPath()
    context.roundRect(size * 0.18, size * 0.18, size * 0.64, size * 0.58, size * 0.035)
    context.fill()

    context.strokeStyle = hexToRgba(material.edge, 0.2)
    context.lineWidth = size * 0.012
    context.setLineDash([size * 0.035, size * 0.025])
    context.stroke()
    context.setLineDash([])

    context.fillStyle = hexToRgba(material.edge, 0.2)
    context.font = `900 ${size * 0.045}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('选择图像', size * 0.5, size * 0.47)

    drawPedestal(context, size, material)
    drawPedestalInscription(context, size, nameplate, inscription)
    context.restore()
}

export function drawGeneratedPlayerStatueMapPreview(
    context: CanvasRenderingContext2D,
    options: DrawPlayerStatueMapPreviewOptions,
) {
    const {
        artMode,
        backgroundId,
        backgroundImage,
        backgroundScale,
        height,
        image,
        inscription,
        materialId,
        nameplateId,
        transform,
        width,
    } = options
    const tile = Math.min(74, Math.floor(Math.min(width / 3.35, height / 2.95)))
    const left = (width - tile * 2) / 2
    const top = height * 0.2
    const asset = createGeneratedPlayerStatueCanvas({
        artMode,
        backgroundId,
        backgroundImage,
        backgroundScale,
        image,
        inscription,
        materialId,
        nameplateId,
        shapeId: options.shapeId,
        size: PLAYER_STATUE_IMAGE_SIZE,
        transform,
    })
    const drawSize = tile * 2

    context.clearRect(0, 0, width, height)
    drawMapPreviewGround(context, width, height, tile, left, top)
    context.drawImage(asset, left, top, drawSize, drawSize)
}

export function createGeneratedPlayerStatueCanvas(options: DrawPlayerStatueOptions) {
    const canvas = document.createElement('canvas')
    canvas.width = options.size
    canvas.height = options.size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')

    drawGeneratedPlayerStatue(context, options)

    return canvas
}

export async function exportGeneratedPlayerStatueBlob(options: Omit<DrawPlayerStatueOptions, 'size'>) {
    const canvas = createGeneratedPlayerStatueCanvas({
        ...options,
        size: PLAYER_STATUE_IMAGE_SIZE,
    })
    let quality = PLAYER_STATUE_INITIAL_IMAGE_QUALITY
    let blob = await canvasToBlob(canvas, 'image/webp', quality)

    if (blob.type === 'image/webp') {
        while (blob.size > PLAYER_STATUE_MAX_UPLOAD_BYTES && quality > PLAYER_STATUE_MIN_IMAGE_QUALITY) {
            quality -= PLAYER_STATUE_IMAGE_QUALITY_STEP
            blob = await canvasToBlob(canvas, 'image/webp', quality)
        }

        return blob
    }

    return canvasToBlob(canvas, 'image/png')
}

export async function exportSimplePlayerStatueBlob(image: HTMLImageElement, transform: PlayerStatueTransform) {
    const canvas = document.createElement('canvas')
    canvas.width = PLAYER_STATUE_IMAGE_SIZE
    canvas.height = PLAYER_STATUE_IMAGE_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')

    drawSimplePlayerStatue(context, image, PLAYER_STATUE_IMAGE_SIZE, transform)

    let quality = PLAYER_STATUE_INITIAL_IMAGE_QUALITY
    let blob = await canvasToBlob(canvas, 'image/webp', quality)

    if (blob.type === 'image/webp') {
        while (blob.size > PLAYER_STATUE_MAX_UPLOAD_BYTES && quality > PLAYER_STATUE_MIN_IMAGE_QUALITY) {
            quality -= PLAYER_STATUE_IMAGE_QUALITY_STEP
            blob = await canvasToBlob(canvas, 'image/webp', quality)
        }

        return blob
    }

    return canvasToBlob(canvas, 'image/png')
}

export function getPlayerStatueMaterial(materialId: PlayerStatueMaterialId) {
    return playerStatueMaterials.find((material) => material.id === materialId) ?? fallbackMaterial
}

function getPlayerStatueNameplate(nameplateId: PlayerStatueNameplateId) {
    return playerStatueNameplates.find((nameplate) => nameplate.id === nameplateId) ?? fallbackNameplate
}

function drawGroundShadow(context: CanvasRenderingContext2D, size: number, material: PlayerStatueMaterial) {
    const centerX = size / 2
    const y = size * 0.88
    const gradient = context.createRadialGradient(centerX, y, size * 0.04, centerX, y, size * 0.35)

    gradient.addColorStop(0, hexToRgba(material.shadow, 0.32))
    gradient.addColorStop(0.72, hexToRgba(material.shadow, 0.14))
    gradient.addColorStop(1, hexToRgba(material.shadow, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.ellipse(centerX, y, size * 0.35, size * 0.09, 0, 0, Math.PI * 2)
    context.fill()
}

function drawPedestal(context: CanvasRenderingContext2D, size: number, material: PlayerStatueMaterial) {
    const centerX = size / 2
    const topY = size * 0.74
    const bodyTop = size * 0.77
    const bodyBottom = size * 0.91
    const topWidth = size * 0.58
    const bottomWidth = size * 0.72
    const topHeight = size * 0.105
    const sideGradient = context.createLinearGradient(centerX - bottomWidth / 2, bodyTop, centerX + bottomWidth / 2, bodyBottom)

    sideGradient.addColorStop(0, material.light)
    sideGradient.addColorStop(0.52, material.mid)
    sideGradient.addColorStop(1, material.dark)
    context.fillStyle = sideGradient
    context.strokeStyle = hexToRgba(material.edge, 0.62)
    context.lineWidth = size * 0.012
    context.beginPath()
    context.moveTo(centerX - topWidth * 0.48, bodyTop)
    context.lineTo(centerX + topWidth * 0.48, bodyTop)
    context.lineTo(centerX + bottomWidth * 0.48, bodyBottom)
    context.quadraticCurveTo(centerX, bodyBottom + size * 0.035, centerX - bottomWidth * 0.48, bodyBottom)
    context.closePath()
    context.fill()
    context.stroke()

    const topGradient = context.createLinearGradient(centerX - topWidth / 2, topY - topHeight / 2, centerX + topWidth / 2, topY + topHeight / 2)
    topGradient.addColorStop(0, material.accent)
    topGradient.addColorStop(0.42, material.light)
    topGradient.addColorStop(1, material.dark)
    context.fillStyle = topGradient
    context.strokeStyle = hexToRgba(material.edge, 0.66)
    context.lineWidth = size * 0.012
    context.beginPath()
    context.ellipse(centerX, topY, topWidth / 2, topHeight / 2, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    context.strokeStyle = hexToRgba(material.accent, 0.34)
    context.lineWidth = size * 0.009
    context.beginPath()
    context.moveTo(centerX - bottomWidth * 0.34, bodyTop + size * 0.035)
    context.lineTo(centerX + bottomWidth * 0.28, bodyTop + size * 0.018)
    context.stroke()
}

function drawStatueBody(
    context: CanvasRenderingContext2D,
    size: number,
    material: PlayerStatueMaterial,
    image: HTMLImageElement | null,
    transform: PlayerStatueTransform,
    artMode: PlayerStatueArtMode,
    shapeId: PlayerStatueShapeId,
) {
    const texture = image ? createMaterialTexture(image, size, material, transform, artMode, shapeId) : null

    context.save()
    context.translate(size * 0.018, size * 0.026)
    context.fillStyle = hexToRgba(material.shadow, 0.32)
    drawShapePath(context, size, shapeId)
    context.fill()
    context.restore()

    if (texture) {
        context.drawImage(texture, 0, 0, size, size)
    } else {
        drawFallbackShape(context, size, material, shapeId)
    }

    context.strokeStyle = hexToRgba(material.edge, 0.72)
    context.lineWidth = size * 0.017
    drawShapePath(context, size, shapeId)
    context.stroke()

}

function createMaterialTexture(
    image: HTMLImageElement,
    size: number,
    material: PlayerStatueMaterial,
    transform: PlayerStatueTransform,
    artMode: PlayerStatueArtMode,
    shapeId: PlayerStatueShapeId,
) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', {willReadFrequently: true})
    if (!context) return null

    context.save()
    drawShapePath(context, size, shapeId)
    context.clip()
    drawTransformedSourceImage(context, image, size, transform, getShapeImagePlacement(shapeId))
    context.restore()
    if (artMode === 'statue') {
        applyMaterialRelief(context, size, material)
        drawChiselMarks(context, size, material, shapeId)
    } else {
        drawOriginalArtFinish(context, size, material)
    }

    return canvas
}

function drawTransformedSourceImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    size: number,
    transform: PlayerStatueTransform,
    placement: { centerY: number; focusSize: number },
) {
    const angle = (transform.rotation * Math.PI) / 180
    const rotatedWidth = Math.abs(Math.cos(angle)) * image.width + Math.abs(Math.sin(angle)) * image.height
    const rotatedHeight = Math.abs(Math.sin(angle)) * image.width + Math.abs(Math.cos(angle)) * image.height
    const focusSize = size * placement.focusSize
    const imageScale = Math.max(focusSize / rotatedWidth, focusSize / rotatedHeight) * transform.zoom
    const offsetScale = size / PLAYER_STATUE_IMAGE_SIZE

    context.save()
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.translate(size / 2 + transform.offsetX * offsetScale, size * placement.centerY + transform.offsetY * offsetScale)
    context.rotate(angle)
    context.drawImage(
        image,
        -image.width * imageScale / 2,
        -image.height * imageScale / 2,
        image.width * imageScale,
        image.height * imageScale,
    )
    context.restore()
}

function applyMaterialRelief(context: CanvasRenderingContext2D, size: number, material: PlayerStatueMaterial) {
    const imageData = context.getImageData(0, 0, size, size)
    const data = imageData.data
    const light = hexToRgb(material.light)
    const mid = hexToRgb(material.mid)
    const dark = hexToRgb(material.dark)

    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const index = (y * size + x) * 4
            const alpha = data[index + 3]
            if (alpha === 0) continue

            const luminance = (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255
            const directionalLight = (1 - x / size) * 0.09 + (1 - y / size) * 0.1
            const grain = (hashPixel(x, y) - 0.5) * 0.08
            const shade = clamp(luminance * 0.86 + directionalLight + grain, 0, 1)
            const color = shade < 0.5
                ? mixRgb(dark, mid, shade * 2)
                : mixRgb(mid, light, (shade - 0.5) * 2)

            data[index] = color.r
            data[index + 1] = color.g
            data[index + 2] = color.b
            data[index + 3] = Math.min(246, alpha)
        }
    }

    context.putImageData(imageData, 0, 0)
}

function drawChiselMarks(
    context: CanvasRenderingContext2D,
    size: number,
    material: PlayerStatueMaterial,
    shapeId: PlayerStatueShapeId,
) {
    context.save()
    drawShapePath(context, size, shapeId)
    context.clip()

    context.strokeStyle = hexToRgba(material.edge, 0.14)
    context.lineWidth = size * 0.006
    const marks = [
        [0.38, 0.25, 0.08, 0.018],
        [0.54, 0.31, 0.075, -0.014],
        [0.34, 0.42, 0.07, -0.016],
        [0.58, 0.48, 0.066, 0.018],
        [0.42, 0.58, 0.086, 0.012],
        [0.56, 0.66, 0.062, -0.016],
    ] as const

    for (const [x, y, width, offsetY] of marks) {
        context.beginPath()
        context.moveTo(size * x, size * y)
        context.lineTo(size * (x + width), size * (y + offsetY))
        context.stroke()
    }

    context.fillStyle = hexToRgba(material.edge, 0.08)
    for (let index = 0; index < 12; index += 1) {
        const x = size * (0.34 + (index % 4) * 0.085)
        const y = size * (0.28 + Math.floor(index / 4) * 0.13)
        context.fillRect(x, y, size * 0.01, size * 0.01)
    }
    context.restore()
}

function drawOriginalArtFinish(context: CanvasRenderingContext2D, size: number, material: PlayerStatueMaterial) {
    context.save()

    const lightGradient = context.createRadialGradient(
        size * 0.35,
        size * 0.24,
        size * 0.06,
        size * 0.54,
        size * 0.44,
        size * 0.48,
    )
    lightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.24)')
    lightGradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.04)')
    lightGradient.addColorStop(1, hexToRgba(material.shadow, 0.18))
    context.fillStyle = lightGradient
    context.fillRect(0, 0, size, size)

    context.restore()
}

function drawFallbackShape(
    context: CanvasRenderingContext2D,
    size: number,
    material: PlayerStatueMaterial,
    shapeId: PlayerStatueShapeId,
) {
    const gradient = context.createLinearGradient(size * 0.28, size * 0.15, size * 0.76, size * 0.8)
    gradient.addColorStop(0, material.light)
    gradient.addColorStop(0.52, material.mid)
    gradient.addColorStop(1, material.dark)

    context.fillStyle = gradient
    drawShapePath(context, size, shapeId)
    context.fill()

    context.fillStyle = hexToRgba(material.edge, 0.13)
    if (shapeId === 'person') {
        context.beginPath()
        context.ellipse(size * 0.5, size * 0.34, size * 0.13, size * 0.18, 0, 0, Math.PI * 2)
        context.fill()
        context.beginPath()
        context.ellipse(size * 0.5, size * 0.62, size * 0.27, size * 0.16, 0, 0, Math.PI * 2)
        context.fill()
        return
    }

    context.beginPath()
    context.ellipse(size * 0.5, size * 0.48, size * 0.16, size * 0.24, 0, 0, Math.PI * 2)
    context.fill()
}

function drawPedestalInscription(
    context: CanvasRenderingContext2D,
    size: number,
    nameplate: PlayerStatueNameplate,
    inscription: string,
) {
    const text = inscription.trim()
    if (!text) return

    const maxWidth = size * 0.48
    const centerX = size / 2
    const centerY = size * 0.868
    const lines = createInscriptionLines(text)
    const maxFontSize = lines.length > 1 ? size * 0.032 : size * 0.046
    const minFontSize = lines.length > 1 ? size * 0.019 : size * 0.022
    const fontSize = fitInscriptionFontSize(context, lines, maxWidth, maxFontSize, minFontSize)
    const lineHeight = fontSize * 1.05
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2

    context.save()
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    const textWidth = Math.min(maxWidth, Math.max(...lines.map((line) => context.measureText(line).width)))
    const plateWidth = clamp(textWidth + size * 0.09, size * 0.24, size * 0.58)
    const plateHeight = clamp(lines.length * lineHeight + size * 0.035, size * 0.07, size * 0.13)
    const plateLeft = centerX - plateWidth / 2
    const plateTop = centerY - plateHeight / 2

    context.fillStyle = nameplate.plate
    context.strokeStyle = nameplate.border
    context.lineWidth = Math.max(1, size * 0.008)
    context.beginPath()
    context.roundRect(plateLeft, plateTop, plateWidth, plateHeight, size * 0.014)
    context.fill()
    context.stroke()

    context.lineWidth = Math.max(1, fontSize * 0.14)
    context.strokeStyle = nameplate.textStroke
    context.fillStyle = nameplate.text
    for (let index = 0; index < lines.length; index += 1) {
        const y = startY + index * lineHeight
        context.strokeText(lines[index], centerX, y, maxWidth)
        context.fillText(lines[index], centerX, y, maxWidth)
    }
    context.restore()
}

function fitInscriptionFontSize(
    context: CanvasRenderingContext2D,
    lines: string[],
    maxWidth: number,
    maxSize: number,
    minSize: number,
) {
    let size = maxSize

    while (size > minSize) {
        context.font = `900 ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        if (lines.every((line) => context.measureText(line).width <= maxWidth)) return size
        size -= 1
    }

    return minSize
}

function createInscriptionLines(text: string) {
    const chars = Array.from(text)
    if (chars.length <= 7) return [text]

    const firstLength = Math.ceil(chars.length / 2)

    return [
        chars.slice(0, firstLength).join(''),
        chars.slice(firstLength).join(''),
    ].filter(Boolean)
}

function drawBackground(
    context: CanvasRenderingContext2D,
    size: number,
    material: PlayerStatueMaterial,
    backgroundId: PlayerStatueBackgroundId,
    backgroundImage: HTMLImageElement | null,
    backgroundScale: number,
    shapeId: PlayerStatueShapeId,
) {
    if (backgroundId === 'none') return

    if (backgroundId === 'custom') {
        const rect = getBackgroundRect(size, backgroundScale, shapeId)
        if (backgroundImage) {
            context.save()
            context.beginPath()
            context.roundRect(rect.left, rect.top, rect.width, rect.height, rect.radius)
            context.clip()
            drawImageCover(context, backgroundImage, rect.left, rect.top, rect.width, rect.height)

            const tint = context.createLinearGradient(rect.left, rect.top, rect.left + rect.width, rect.top + rect.height)
            tint.addColorStop(0, 'rgba(255, 255, 255, 0.14)')
            tint.addColorStop(0.62, hexToRgba(material.mid, 0.08))
            tint.addColorStop(1, hexToRgba(material.shadow, 0.24))
            context.fillStyle = tint
            context.fillRect(rect.left, rect.top, rect.width, rect.height)
            context.restore()
        }

        context.strokeStyle = hexToRgba(material.edge, 0.38)
        context.lineWidth = size * 0.012
        context.beginPath()
        context.roundRect(rect.left, rect.top, rect.width, rect.height, rect.radius)
        context.stroke()
        return
    }

    if (backgroundId === 'panel') {
        const rect = getBackgroundRect(size, shapeId === 'tablet' ? 1.16 : 1, shapeId)
        const panelGradient = context.createLinearGradient(rect.left, rect.top, rect.left + rect.width, rect.top + rect.height)
        panelGradient.addColorStop(0, hexToRgba(material.light, 0.42))
        panelGradient.addColorStop(0.58, hexToRgba(material.mid, 0.3))
        panelGradient.addColorStop(1, hexToRgba(material.dark, 0.36))
        context.fillStyle = panelGradient
        context.strokeStyle = hexToRgba(material.edge, 0.32)
        context.lineWidth = size * 0.012
        context.beginPath()
        context.roundRect(rect.left, rect.top, rect.width, rect.height, rect.radius)
        context.fill()
        context.stroke()

        context.strokeStyle = hexToRgba(material.accent, 0.16)
        context.lineWidth = size * 0.007
        context.beginPath()
        context.moveTo(rect.left + rect.width * 0.12, rect.top + rect.height * 0.18)
        context.lineTo(rect.left + rect.width * 0.88, rect.top + rect.height * 0.14)
        context.moveTo(rect.left + rect.width * 0.12, rect.top + rect.height * 0.84)
        context.lineTo(rect.left + rect.width * 0.88, rect.top + rect.height * 0.88)
        context.stroke()
        return
    }

    if (backgroundId === 'arch') {
        const outerLeft = size * (shapeId === 'tablet' ? 0.12 : 0.25)
        const outerRight = size * (shapeId === 'tablet' ? 0.88 : 0.75)
        const innerLeft = size * (shapeId === 'tablet' ? 0.22 : 0.34)
        const innerRight = size * (shapeId === 'tablet' ? 0.78 : 0.66)
        const topY = size * (shapeId === 'tablet' ? 0.07 : 0.14)
        const archY = size * (shapeId === 'tablet' ? 0.36 : 0.43)
        const innerArchY = size * (shapeId === 'tablet' ? 0.4 : 0.45)
        const bottomY = size * 0.76
        context.fillStyle = hexToRgba(material.dark, 0.36)
        context.strokeStyle = hexToRgba(material.edge, 0.42)
        context.lineWidth = size * 0.015
        context.beginPath()
        context.moveTo(outerLeft, bottomY)
        context.lineTo(outerLeft, archY)
        context.quadraticCurveTo(size * 0.5, topY, outerRight, archY)
        context.lineTo(outerRight, bottomY)
        context.lineTo(innerRight, bottomY)
        context.lineTo(innerRight, innerArchY)
        context.quadraticCurveTo(size * 0.5, size * (shapeId === 'tablet' ? 0.18 : 0.27), innerLeft, innerArchY)
        context.lineTo(innerLeft, bottomY)
        context.closePath()
        context.fill()
        context.stroke()
        return
    }

    const bannerLeft = size * (shapeId === 'tablet' ? 0.1 : 0.29)
    const bannerRight = size * (shapeId === 'tablet' ? 0.9 : 0.71)
    const bannerTop = size * (shapeId === 'tablet' ? 0.16 : 0.24)
    const bannerBottom = size * (shapeId === 'tablet' ? 0.72 : 0.66)
    context.fillStyle = hexToRgba(material.mid, 0.42)
    context.strokeStyle = hexToRgba(material.edge, 0.36)
    context.lineWidth = size * 0.012
    context.beginPath()
    context.moveTo(bannerLeft, bannerTop)
    context.quadraticCurveTo(size * 0.5, bannerTop - size * 0.06, bannerRight, bannerTop)
    context.lineTo(bannerRight - size * 0.04, bannerBottom)
    context.quadraticCurveTo(size * 0.5, bannerBottom - size * 0.04, bannerLeft + size * 0.04, bannerBottom)
    context.closePath()
    context.fill()
    context.stroke()
}

function getBackgroundRect(size: number, scale: number, shapeId: PlayerStatueShapeId) {
    const normalizedScale = clamp(scale || 1, 0.55, 1.35)
    const baseWidth = shapeId === 'tablet' ? 0.82 : 0.66
    const baseHeight = shapeId === 'tablet' ? 0.74 : 0.64
    const width = size * Math.min(0.92, baseWidth * normalizedScale)
    const height = size * Math.min(0.82, baseHeight * normalizedScale)
    const centerX = size * 0.5
    const centerY = size * 0.43

    return {
        height,
        left: centerX - width / 2,
        radius: size * 0.035,
        top: centerY - height / 2,
        width,
    }
}

function drawImageCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    left: number,
    top: number,
    width: number,
    height: number,
) {
    const scale = Math.max(width / image.width, height / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale

    context.drawImage(
        image,
        left + (width - drawWidth) / 2,
        top + (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
    )
}

function drawShapePath(context: CanvasRenderingContext2D, size: number, shapeId: PlayerStatueShapeId) {
    if (shapeId === 'monument') {
        drawMonumentPath(context, size)
        return
    }
    if (shapeId === 'crystal') {
        drawCrystalPath(context, size)
        return
    }
    if (shapeId === 'totem') {
        drawTotemPath(context, size)
        return
    }
    if (shapeId === 'tablet') {
        drawTabletPath(context, size)
        return
    }

    drawPersonPath(context, size)
}

function drawPersonPath(context: CanvasRenderingContext2D, size: number) {
    context.beginPath()
    context.moveTo(size * 0.24, size * 0.73)
    context.bezierCurveTo(size * 0.27, size * 0.58, size * 0.38, size * 0.54, size * 0.4, size * 0.45)
    context.bezierCurveTo(size * 0.31, size * 0.38, size * 0.33, size * 0.17, size * 0.5, size * 0.16)
    context.bezierCurveTo(size * 0.67, size * 0.17, size * 0.69, size * 0.38, size * 0.6, size * 0.45)
    context.bezierCurveTo(size * 0.62, size * 0.54, size * 0.73, size * 0.58, size * 0.76, size * 0.73)
    context.quadraticCurveTo(size * 0.72, size * 0.82, size * 0.5, size * 0.83)
    context.quadraticCurveTo(size * 0.28, size * 0.82, size * 0.24, size * 0.73)
    context.closePath()
}

function drawMonumentPath(context: CanvasRenderingContext2D, size: number) {
    context.beginPath()
    context.moveTo(size * 0.33, size * 0.76)
    context.lineTo(size * 0.37, size * 0.3)
    context.quadraticCurveTo(size * 0.5, size * 0.18, size * 0.63, size * 0.3)
    context.lineTo(size * 0.67, size * 0.76)
    context.quadraticCurveTo(size * 0.5, size * 0.83, size * 0.33, size * 0.76)
    context.closePath()
}

function drawCrystalPath(context: CanvasRenderingContext2D, size: number) {
    context.beginPath()
    context.moveTo(size * 0.5, size * 0.14)
    context.lineTo(size * 0.7, size * 0.35)
    context.lineTo(size * 0.64, size * 0.73)
    context.lineTo(size * 0.5, size * 0.83)
    context.lineTo(size * 0.36, size * 0.73)
    context.lineTo(size * 0.3, size * 0.35)
    context.closePath()
}

function drawTotemPath(context: CanvasRenderingContext2D, size: number) {
    context.beginPath()
    context.moveTo(size * 0.35, size * 0.78)
    context.lineTo(size * 0.35, size * 0.29)
    context.quadraticCurveTo(size * 0.5, size * 0.17, size * 0.65, size * 0.29)
    context.lineTo(size * 0.65, size * 0.78)
    context.quadraticCurveTo(size * 0.5, size * 0.84, size * 0.35, size * 0.78)
    context.closePath()
}

function drawTabletPath(context: CanvasRenderingContext2D, size: number) {
    context.beginPath()
    context.moveTo(size * 0.24, size * 0.82)
    context.lineTo(size * 0.24, size * 0.28)
    context.quadraticCurveTo(size * 0.5, size * 0.07, size * 0.76, size * 0.28)
    context.lineTo(size * 0.76, size * 0.82)
    context.quadraticCurveTo(size * 0.5, size * 0.88, size * 0.24, size * 0.82)
    context.closePath()
}

function getShapeImagePlacement(shapeId: PlayerStatueShapeId) {
    if (shapeId === 'person') return {centerY: 0.45, focusSize: 0.92}
    if (shapeId === 'crystal') return {centerY: 0.47, focusSize: 0.72}
    if (shapeId === 'totem') return {centerY: 0.5, focusSize: 0.72}
    if (shapeId === 'tablet') return {centerY: 0.48, focusSize: 0.92}

    return {centerY: 0.5, focusSize: 0.76}
}

function defaultPlayerStatueTransform(): PlayerStatueTransform {
    return {
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        zoom: 1,
    }
}

function drawMapPreviewGround(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    tile: number,
    left: number,
    top: number,
) {
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#d9ead4')
    gradient.addColorStop(1, '#b6d5a6')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    for (let y = 0; y < 2; y += 1) {
        for (let x = 0; x < 2; x += 1) {
            const tileLeft = left + x * tile
            const tileTop = top + y * tile
            context.fillStyle = (x + y) % 2 === 0 ? '#91c86d' : '#86bd65'
            context.fillRect(tileLeft, tileTop, tile, tile)
            context.strokeStyle = 'rgba(72, 105, 50, 0.35)'
            context.lineWidth = 1.2
            context.strokeRect(tileLeft + 0.5, tileTop + 0.5, tile - 1, tile - 1)
        }
    }

    context.fillStyle = 'rgba(255, 250, 220, 0.38)'
    context.beginPath()
    context.ellipse(left + tile, top + tile * 2 + tile * 0.1, tile * 1.2, tile * 0.32, 0, 0, Math.PI * 2)
    context.fill()
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob)
                return
            }

            reject(new Error('Image compression failed'))
        }, type, quality)
    })
}

function hexToRgb(hex: string) {
    const normalized = hex.replace('#', '')
    const value = normalized.length === 3
        ? normalized.split('').map((part) => `${part}${part}`).join('')
        : normalized

    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    }
}

function hexToRgba(hex: string, alpha: number) {
    const color = hexToRgb(hex)

    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function mixRgb(left: ReturnType<typeof hexToRgb>, right: ReturnType<typeof hexToRgb>, amount: number) {
    const ratio = clamp(amount, 0, 1)

    return {
        r: Math.round(left.r + (right.r - left.r) * ratio),
        g: Math.round(left.g + (right.g - left.g) * ratio),
        b: Math.round(left.b + (right.b - left.b) * ratio),
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}

function hashPixel(x: number, y: number) {
    const next = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123

    return next - Math.floor(next)
}
