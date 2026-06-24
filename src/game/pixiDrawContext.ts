import {
    Container,
    Graphics,
    Matrix,
    Sprite,
    Text,
    Texture,
} from 'pixi.js'
import type {FillInput, StrokeInput, TextStyleFontWeight} from 'pixi.js'

type CanvasLineCap = 'butt' | 'round' | 'square'
type CanvasLineJoin = 'bevel' | 'miter' | 'round'
type CanvasTextAlign = 'center' | 'end' | 'left' | 'right' | 'start'
type CanvasTextBaseline = 'alphabetic' | 'bottom' | 'hanging' | 'ideographic' | 'middle' | 'top'
type PixiCanvasStyle = string | number | PixiCanvasGradient

interface DrawState {
    container: Container
    fillStyle: PixiCanvasStyle
    font: string
    globalAlpha: number
    lineCap: CanvasLineCap
    lineJoin: CanvasLineJoin
    lineWidth: number
    matrix: Matrix
    strokeStyle: PixiCanvasStyle
    textAlign: CanvasTextAlign
    textBaseline: CanvasTextBaseline
}

type PathCommand =
    | { type: 'arc'; x: number; y: number; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean }
    | { type: 'bezierCurveTo'; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
    | { type: 'closePath' }
    | { type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number; rotation: number; startAngle: number; endAngle: number; counterclockwise?: boolean }
    | { type: 'lineTo'; x: number; y: number }
    | { type: 'moveTo'; x: number; y: number }
    | { type: 'quadraticCurveTo'; cpx: number; cpy: number; x: number; y: number }
    | { type: 'rect'; x: number; y: number; width: number; height: number }
    | { type: 'roundRect'; x: number; y: number; width: number; height: number; radius: number }

const maxGraphicsPoolSize = 1024
const maxTextPoolSize = 512
const maxSpritePoolSize = 512
const maxContainerPoolSize = 2048

export interface PixiTextMetrics {
    width: number
}

export class PixiCanvasGradient {
    private readonly stops: Array<{ offset: number; color: string | number }> = []

    addColorStop(offset: number, color: string | number) {
        this.stops.push({offset, color})
    }

    getRepresentativeColor() {
        if (this.stops.length === 0) return '#ffffff'

        const ordered = [...this.stops].sort((left, right) => left.offset - right.offset)
        const middle = ordered.reduce((closest, stop) => {
            return Math.abs(stop.offset - 0.62) < Math.abs(closest.offset - 0.62) ? stop : closest
        }, ordered[0])

        return middle.color
    }
}

let imageTextureCache = new Map<object, Texture>()
const imageUploadSafetyCache = new WeakMap<object, boolean>()
let skippedUnsafeImageSources = 0

export function getPixiTextureCacheStats() {
    return {
        imageTextures: imageTextureCache.size,
        skippedUnsafeImages: skippedUnsafeImageSources,
    }
}

export function destroyPixiTextureCache() {
    for (const texture of imageTextureCache.values()) {
        if (!texture.destroyed) texture.destroy(true)
    }
    imageTextureCache = new Map<object, Texture>()
    skippedUnsafeImageSources = 0
}

export class PixiDrawContext {
    imageSmoothingEnabled = false
    imageSmoothingQuality: ImageSmoothingQuality = 'low'

    private currentGraphics: Graphics | null = null
    private readonly containerPool: Container[] = []
    private readonly graphicsPool: Graphics[] = []
    private pathCommands: PathCommand[] = []
    private root: Container
    private readonly spritePool: Sprite[] = []
    private stack: DrawState[] = []
    private state: DrawState
    private readonly textPool: Text[] = []

    constructor(root: Container) {
        this.root = root
        this.state = createDefaultState(root)
    }

    beginFrame(root = this.root) {
        this.root = root
        const children = root.removeChildren()
        for (const child of children) {
            this.recycleOrDestroy(child)
        }

        this.stack = []
        this.pathCommands = []
        this.currentGraphics = null
        this.state = createDefaultState(root)
    }

    destroy() {
        const children = this.root.removeChildren()
        for (const child of children) {
            destroyPixiDisplayTree(child)
        }
        for (const graphics of this.graphicsPool) {
            if (!graphics.destroyed) {
                graphics.destroy({
                    children: true,
                    context: true,
                })
            }
        }
        for (const text of this.textPool) {
            if (!text.destroyed) destroyPixiDisplayTree(text)
        }
        for (const sprite of this.spritePool) {
            if (!sprite.destroyed) destroyPixiDisplayTree(sprite)
        }
        for (const container of this.containerPool) {
            if (!container.destroyed) destroyPixiDisplayTree(container)
        }
        this.graphicsPool.length = 0
        this.textPool.length = 0
        this.spritePool.length = 0
        this.containerPool.length = 0
        this.stack = []
        this.pathCommands = []
        this.currentGraphics = null
    }

    getStats() {
        return {
            containerPool: this.containerPool.length,
            graphicsPool: this.graphicsPool.length,
            rootChildren: this.root.children.length,
            spritePool: this.spritePool.length,
            textPool: this.textPool.length,
        }
    }

    get fillStyle() {
        return this.state.fillStyle
    }

    set fillStyle(value: PixiCanvasStyle) {
        this.state.fillStyle = value
    }

    get font() {
        return this.state.font
    }

    set font(value: string) {
        this.state.font = value
    }

    get globalAlpha() {
        return this.state.globalAlpha
    }

    set globalAlpha(value: number) {
        this.state.globalAlpha = Math.max(0, Math.min(1, value))
    }

    get lineCap() {
        return this.state.lineCap
    }

    set lineCap(value: CanvasLineCap) {
        this.state.lineCap = value
    }

    get lineJoin() {
        return this.state.lineJoin
    }

    set lineJoin(value: CanvasLineJoin) {
        this.state.lineJoin = value
    }

    get lineWidth() {
        return this.state.lineWidth
    }

    set lineWidth(value: number) {
        this.state.lineWidth = value
    }

    get strokeStyle() {
        return this.state.strokeStyle
    }

    set strokeStyle(value: PixiCanvasStyle) {
        this.state.strokeStyle = value
    }

    get textAlign() {
        return this.state.textAlign
    }

    set textAlign(value: CanvasTextAlign) {
        this.state.textAlign = value
    }

    get textBaseline() {
        return this.state.textBaseline
    }

    set textBaseline(value: CanvasTextBaseline) {
        this.state.textBaseline = value
    }

    save() {
        this.stack.push(cloneState(this.state))
    }

    restore() {
        const previous = this.stack.pop()
        if (!previous) return

        this.state = previous
        this.currentGraphics = null
    }

    translate(x: number, y: number) {
        const matrix = this.state.matrix
        matrix.tx += matrix.a * x + matrix.c * y
        matrix.ty += matrix.b * x + matrix.d * y
        this.currentGraphics = null
    }

    scale(x: number, y: number) {
        const matrix = this.state.matrix
        matrix.a *= x
        matrix.b *= x
        matrix.c *= y
        matrix.d *= y
        this.currentGraphics = null
    }

    rotate(angle: number) {
        const matrix = this.state.matrix
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const a = matrix.a
        const b = matrix.b
        const c = matrix.c
        const d = matrix.d

        matrix.a = a * cos + c * sin
        matrix.b = b * cos + d * sin
        matrix.c = c * cos - a * sin
        matrix.d = d * cos - b * sin
        this.currentGraphics = null
    }

    beginPath() {
        this.pathCommands = []
        this.graphics().beginPath()
    }

    closePath() {
        this.pathCommands.push({type: 'closePath'})
        this.graphics().closePath()
    }

    moveTo(x: number, y: number) {
        this.pathCommands.push({type: 'moveTo', x, y})
        this.graphics().moveTo(x, y)
    }

    lineTo(x: number, y: number) {
        this.pathCommands.push({type: 'lineTo', x, y})
        this.graphics().lineTo(x, y)
    }

    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
        this.pathCommands.push({type: 'quadraticCurveTo', cpx, cpy, x, y})
        this.graphics().quadraticCurveTo(cpx, cpy, x, y)
    }

    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
        this.pathCommands.push({type: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y})
        this.graphics().bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
    }

    rect(x: number, y: number, width: number, height: number) {
        this.pathCommands.push({type: 'rect', x, y, width, height})
        this.graphics().rect(x, y, width, height)
    }

    roundRect(x: number, y: number, width: number, height: number, radius = 0) {
        this.pathCommands.push({type: 'roundRect', x, y, width, height, radius})
        this.graphics().roundRect(x, y, width, height, radius)
    }

    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise = false) {
        this.pathCommands.push({type: 'arc', x, y, radius, startAngle, endAngle, counterclockwise})
        this.graphics().arc(x, y, radius, startAngle, endAngle, counterclockwise)
    }

    ellipse(
        x: number,
        y: number,
        radiusX: number,
        radiusY: number,
        rotation = 0,
        startAngle = 0,
        endAngle = Math.PI * 2,
        counterclockwise = false,
    ) {
        this.pathCommands.push({type: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise})
        drawEllipsePath(this.graphics(), x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise)
    }

    fill() {
        this.graphics().fill(toFillInput(this.state.fillStyle, this.state.globalAlpha))
    }

    stroke() {
        this.graphics().stroke(toStrokeInput(this.state))
    }

    fillRect(x: number, y: number, width: number, height: number) {
        this.graphics()
            .beginPath()
            .rect(x, y, width, height)
            .fill(toFillInput(this.state.fillStyle, this.state.globalAlpha))
        this.pathCommands = []
    }

    strokeRect(x: number, y: number, width: number, height: number) {
        this.graphics()
            .beginPath()
            .rect(x, y, width, height)
            .stroke(toStrokeInput(this.state))
        this.pathCommands = []
    }

    clearRect() {
        this.pathCommands = []
    }

    setLineDash(_segments: number[]) {
        // Pixi Graphics has no native dashed stroke. Existing dashed overlays still render as solid strokes.
    }

    clip() {
        if (this.pathCommands.length === 0) return

        const mask = this.acquireGraphics()
        mask.setFromMatrix(this.state.matrix.clone())
        replayPath(mask, this.pathCommands)
        mask.fill(0xffffff)

        const clipped = this.acquireContainer()
        clipped.mask = mask
        clipped.addChild(mask)
        this.state.container.addChild(clipped)
        this.state.container = clipped
        this.currentGraphics = null
    }

    fillText(text: string, x: number, y: number) {
        if (!text) return

        const font = parseFont(this.state.font)
        const color = resolveColor(this.state.fillStyle)
        const label = this.acquireText()
        label.resolution = getTextTextureResolution(this.state.matrix)
        label.roundPixels = true
        label.text = text
        label.style = {
            fill: color.color,
            fontFamily: font.family,
            fontSize: font.size,
            fontWeight: font.weight,
        }
        label.anchor.set(getTextAnchorX(this.state.textAlign), getTextAnchorY(this.state.textBaseline))
        label.alpha = this.state.globalAlpha * color.alpha
        label.position.set(x, y)

        const group = this.acquireContainer()
        group.setFromMatrix(this.state.matrix)
        group.addChild(label)
        this.state.container.addChild(group)
        this.currentGraphics = null
    }

    measureText(text: string): PixiTextMetrics {
        const {size} = parseFont(this.state.font)

        return {
            width: estimateTextWidth(text, size),
        }
    }

    createLinearGradient(_x0: number, _y0: number, _x1: number, _y1: number) {
        return new PixiCanvasGradient()
    }

    createRadialGradient(_x0: number, _y0: number, _r0: number, _x1: number, _y1: number, _r1: number) {
        return new PixiCanvasGradient()
    }

    drawImage(image: CanvasImageSource, x: number, y: number, width: number, height: number) {
        if (!isSupportedImageSource(image)) return
        if (!canUploadImageSourceToWebGl(image)) return

        let texture = imageTextureCache.get(image)
        if (!texture) {
            try {
                texture = Texture.from(image, true)
            } catch (error) {
                console.warn('Skipping image that cannot be used as a Pixi texture.', error)
                return
            }
            imageTextureCache.set(image, texture)
        }
        texture.source.scaleMode = this.imageSmoothingEnabled ? 'linear' : 'nearest'
        texture.source.antialias = this.imageSmoothingEnabled

        const sprite = this.acquireSprite()
        sprite.texture = texture
        sprite.roundPixels = !this.imageSmoothingEnabled
        sprite.alpha = this.state.globalAlpha
        sprite.position.set(x, y)
        sprite.width = width
        sprite.height = height

        const group = this.acquireContainer()
        group.setFromMatrix(this.state.matrix)
        group.addChild(sprite)
        this.state.container.addChild(group)
        this.currentGraphics = null
    }

    private graphics() {
        if (this.currentGraphics) return this.currentGraphics

        const graphics = this.acquireGraphics()
        graphics.setFromMatrix(this.state.matrix.clone())
        this.state.container.addChild(graphics)
        this.currentGraphics = graphics

        return graphics
    }

    private acquireGraphics() {
        const graphics = this.graphicsPool.pop() ?? new Graphics()

        resetGraphicsForReuse(graphics)

        return graphics
    }

    private acquireText() {
        const text = this.textPool.pop() ?? new Text()

        resetTextForReuse(text)

        return text
    }

    private acquireSprite() {
        const sprite = this.spritePool.pop() ?? new Sprite()

        resetSpriteForReuse(sprite)

        return sprite
    }

    private acquireContainer() {
        const container = this.containerPool.pop() ?? new Container()

        resetContainerForReuse(container)

        return container
    }

    private recycleOrDestroy(child: Container) {
        if (child instanceof Graphics) {
            this.recycleGraphics(child)
            return
        }

        if (child instanceof Text) {
            this.recycleText(child)
            return
        }

        if (child instanceof Sprite) {
            this.recycleSprite(child)
            return
        }

        const children = child.removeChildren()
        for (const nested of children) {
            this.recycleOrDestroy(nested)
        }
        child.mask = null
        this.recycleContainer(child)
    }

    private recycleGraphics(graphics: Graphics) {
        if (graphics.destroyed || this.graphicsPool.length >= maxGraphicsPoolSize) {
            if (!graphics.destroyed) {
                graphics.destroy({
                    children: true,
                    context: true,
                })
            }
            return
        }

        const children = graphics.removeChildren()
        for (const child of children) {
            this.recycleOrDestroy(child)
        }
        resetGraphicsForReuse(graphics)
        this.graphicsPool.push(graphics)
    }

    private recycleText(text: Text) {
        if (text.destroyed || this.textPool.length >= maxTextPoolSize) {
            if (!text.destroyed) destroyPixiDisplayTree(text)
            return
        }

        resetTextForReuse(text)
        this.textPool.push(text)
    }

    private recycleSprite(sprite: Sprite) {
        if (sprite.destroyed || this.spritePool.length >= maxSpritePoolSize) {
            if (!sprite.destroyed) destroyPixiDisplayTree(sprite)
            return
        }

        resetSpriteForReuse(sprite)
        this.spritePool.push(sprite)
    }

    private recycleContainer(container: Container) {
        if (container.destroyed || this.containerPool.length >= maxContainerPoolSize) {
            if (!container.destroyed) destroyPixiDisplayTree(container)
            return
        }

        resetContainerForReuse(container)
        this.containerPool.push(container)
    }
}

function isSupportedImageSource(image: CanvasImageSource): image is HTMLImageElement | HTMLCanvasElement | OffscreenCanvas {
    return image instanceof HTMLImageElement ||
        image instanceof HTMLCanvasElement ||
        (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas)
}

function canUploadImageSourceToWebGl(image: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) {
    const cached = imageUploadSafetyCache.get(image)
    if (cached !== undefined) return cached

    if (image instanceof HTMLImageElement && (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)) {
        return false
    }

    const safe = isCanvasReadable(image)
    imageUploadSafetyCache.set(image, safe)
    if (!safe) skippedUnsafeImageSources += 1

    return safe
}

function isCanvasReadable(image: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) {
    const width = getImageSourceWidth(image)
    const height = getImageSourceHeight(image)
    if (width <= 0 || height <= 0) return false

    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    const context = canvas.getContext('2d', {willReadFrequently: true})
    if (!context) return false

    try {
        context.drawImage(image, 0, 0, 1, 1)
        context.getImageData(0, 0, 1, 1)
        return true
    } catch {
        return false
    }
}

function getImageSourceWidth(image: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) {
    if (image instanceof HTMLImageElement) return image.naturalWidth || image.width

    return image.width
}

function getImageSourceHeight(image: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) {
    if (image instanceof HTMLImageElement) return image.naturalHeight || image.height

    return image.height
}

export function destroyPixiDisplayTree(child: Container) {
    if (child instanceof Text) {
        child.destroy({
            children: true,
            style: true,
            texture: true,
            textureSource: true,
        })
        return
    }

    if (child instanceof Graphics) {
        child.destroy({
            children: true,
            context: true,
        })
        return
    }

    if (child instanceof Sprite) {
        child.destroy({
            children: true,
        })
        return
    }

    const children = child.removeChildren()
    for (const nested of children) {
        destroyPixiDisplayTree(nested)
    }
    child.destroy()
}

function createDefaultState(container: Container): DrawState {
    return {
        container,
        fillStyle: '#000000',
        font: '10px sans-serif',
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        lineWidth: 1,
        matrix: new Matrix(),
        strokeStyle: '#000000',
        textAlign: 'start',
        textBaseline: 'alphabetic',
    }
}

function resetGraphicsForReuse(graphics: Graphics) {
    graphics.clear()
    graphics.mask = null
    graphics.alpha = 1
    graphics.visible = true
    graphics.renderable = true
    graphics.position.set(0, 0)
    graphics.scale.set(1, 1)
    graphics.pivot.set(0, 0)
    graphics.skew.set(0, 0)
    graphics.rotation = 0
}

function resetContainerForReuse(container: Container) {
    container.removeChildren()
    container.mask = null
    container.alpha = 1
    container.visible = true
    container.renderable = true
    container.position.set(0, 0)
    container.scale.set(1, 1)
    container.pivot.set(0, 0)
    container.skew.set(0, 0)
    container.rotation = 0
}

function resetTextForReuse(text: Text) {
    text.text = ''
    text.mask = null
    text.alpha = 1
    text.visible = true
    text.renderable = true
    text.position.set(0, 0)
    text.scale.set(1, 1)
    text.pivot.set(0, 0)
    text.skew.set(0, 0)
    text.rotation = 0
    text.anchor.set(0, 0)
}

function resetSpriteForReuse(sprite: Sprite) {
    sprite.mask = null
    sprite.alpha = 1
    sprite.visible = true
    sprite.renderable = true
    sprite.texture = Texture.EMPTY
    sprite.position.set(0, 0)
    sprite.scale.set(1, 1)
    sprite.pivot.set(0, 0)
    sprite.skew.set(0, 0)
    sprite.rotation = 0
    sprite.anchor.set(0, 0)
}

function cloneState(state: DrawState): DrawState {
    return {
        ...state,
        matrix: state.matrix.clone(),
    }
}

function getTextTextureResolution(matrix: Matrix) {
    const scaleX = Math.hypot(matrix.a, matrix.b)
    const scaleY = Math.hypot(matrix.c, matrix.d)
    const transformScale = Math.max(scaleX, scaleY, 1)
    const deviceScale = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1

    return Math.max(1, Math.min(4, transformScale * deviceScale))
}

function drawEllipsePath(
    graphics: Graphics,
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise: boolean,
) {
    const fullEllipse = Math.abs(endAngle - startAngle) >= Math.PI * 2 - 0.001
    if (fullEllipse && Math.abs(rotation) < 0.001) {
        graphics.ellipse(x, y, radiusX, radiusY)
        return
    }

    const total = counterclockwise && endAngle > startAngle
        ? endAngle - startAngle - Math.PI * 2
        : !counterclockwise && endAngle < startAngle
            ? endAngle - startAngle + Math.PI * 2
            : endAngle - startAngle
    const steps = Math.max(8, Math.ceil(Math.abs(total) / (Math.PI / 16)))
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    for (let index = 0; index <= steps; index += 1) {
        const angle = startAngle + total * (index / steps)
        const px = Math.cos(angle) * radiusX
        const py = Math.sin(angle) * radiusY
        const nextX = x + px * cos - py * sin
        const nextY = y + px * sin + py * cos

        if (index === 0) graphics.moveTo(nextX, nextY)
        else graphics.lineTo(nextX, nextY)
    }
}

function replayPath(graphics: Graphics, commands: PathCommand[]) {
    graphics.beginPath()

    for (const command of commands) {
        if (command.type === 'moveTo') graphics.moveTo(command.x, command.y)
        else if (command.type === 'lineTo') graphics.lineTo(command.x, command.y)
        else if (command.type === 'quadraticCurveTo') graphics.quadraticCurveTo(command.cpx, command.cpy, command.x, command.y)
        else if (command.type === 'bezierCurveTo') graphics.bezierCurveTo(command.cp1x, command.cp1y, command.cp2x, command.cp2y, command.x, command.y)
        else if (command.type === 'rect') graphics.rect(command.x, command.y, command.width, command.height)
        else if (command.type === 'roundRect') graphics.roundRect(command.x, command.y, command.width, command.height, command.radius)
        else if (command.type === 'arc') graphics.arc(command.x, command.y, command.radius, command.startAngle, command.endAngle, command.counterclockwise)
        else if (command.type === 'ellipse') {
            drawEllipsePath(
                graphics,
                command.x,
                command.y,
                command.radiusX,
                command.radiusY,
                command.rotation,
                command.startAngle,
                command.endAngle,
                Boolean(command.counterclockwise),
            )
        } else {
            graphics.closePath()
        }
    }
}

function toFillInput(style: PixiCanvasStyle, alphaMultiplier: number): FillInput {
    const color = resolveColor(style)

    return {
        color: color.color,
        alpha: color.alpha * alphaMultiplier,
    } as FillInput
}

function toStrokeInput(state: DrawState): StrokeInput {
    const color = resolveColor(state.strokeStyle)

    return {
        alpha: color.alpha * state.globalAlpha,
        cap: state.lineCap,
        color: color.color,
        join: state.lineJoin,
        width: state.lineWidth,
    } as StrokeInput
}

function resolveColor(style: PixiCanvasStyle): { color: string | number; alpha: number } {
    if (style instanceof PixiCanvasGradient) {
        return resolveColor(style.getRepresentativeColor())
    }
    if (typeof style === 'number') {
        return {color: style, alpha: 1}
    }

    const value = style.trim()
    const rgba = value.match(/^rgba?\(([^)]+)\)$/i)
    if (rgba) {
        const parts = rgba[1].split(',').map((part) => part.trim())
        const red = clampColor(Number(parts[0]))
        const green = clampColor(Number(parts[1]))
        const blue = clampColor(Number(parts[2]))
        const alpha = parts[3] === undefined ? 1 : Math.max(0, Math.min(1, Number(parts[3])))

        return {
            color: rgbToHex(red, green, blue),
            alpha,
        }
    }

    return {
        color: normalizeHex(value) || value,
        alpha: 1,
    }
}

function normalizeHex(value: string) {
    if (!value.startsWith('#')) return ''

    const hex = value.slice(1)
    if (/^[0-9a-f]{3}$/i.test(hex)) {
        return `#${hex.split('').map((part) => `${part}${part}`).join('')}`
    }
    if (/^[0-9a-f]{6}$/i.test(hex)) return value

    return ''
}

function clampColor(value: number) {
    if (!Number.isFinite(value)) return 0

    return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHex(red: number, green: number, blue: number) {
    return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function parseFont(font: string) {
    const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10)
    const weight: TextStyleFontWeight = font.includes('900')
        ? '900'
        : font.includes('800')
            ? '800'
            : font.includes('700') || font.includes('bold')
                ? '700'
                : '400'

    return {
        family: 'sans-serif',
        size,
        weight,
    }
}

function estimateTextWidth(text: string, fontSize: number) {
    return Array.from(text).reduce((width, char) => {
        return width + (char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.58)
    }, 0)
}

function getTextAnchorX(align: CanvasTextAlign) {
    if (align === 'center') return 0.5
    if (align === 'right' || align === 'end') return 1

    return 0
}

function getTextAnchorY(baseline: CanvasTextBaseline) {
    if (baseline === 'middle') return 0.5
    if (baseline === 'bottom' || baseline === 'ideographic') return 1
    if (baseline === 'alphabetic') return 0.78

    return 0
}
