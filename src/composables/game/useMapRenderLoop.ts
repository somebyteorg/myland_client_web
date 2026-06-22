import {reactive} from 'vue'
import type {ViewportRect} from '@/game/mapCamera'

export interface MapRenderFrameBounds {
    width: number
    height: number
}

interface UseMapRenderLoopOptions {
    getCanvas: () => HTMLCanvasElement | null
    maxPixelRatio: number
    getFrameInterval: () => number
    drawFrame: (context: CanvasRenderingContext2D, timestamp: number, bounds: MapRenderFrameBounds) => void
    onResize: () => void
    onDrawRequest: () => void
}

export function useMapRenderLoop(options: UseMapRenderLoopOptions) {
    const bounds = reactive<ViewportRect>({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
    })

    let animationFrame = 0
    let lastDrawAt = 0
    let drawingActive = false
    let needsDraw = true

    function resize() {
        const canvas = options.getCanvas()
        if (!canvas) return

        Object.assign(bounds, readCanvasBounds(canvas))
        const ratio = getPixelRatio()
        canvas.width = Math.max(1, Math.floor(bounds.width * ratio))
        canvas.height = Math.max(1, Math.floor(bounds.height * ratio))

        options.onResize()
        requestDraw()
    }

    function requestDraw() {
        needsDraw = true
        options.onDrawRequest()
    }

    function requestAnimationDraw() {
        needsDraw = true
    }

    function start(timestamp = 0) {
        if (drawingActive) return

        drawingActive = true
        drawLoop(timestamp)
    }

    function stop() {
        drawingActive = false
        cancelAnimationFrame(animationFrame)
    }

    function drawLoop(timestamp = 0) {
        if (!drawingActive) return

        const frameInterval = options.getFrameInterval()
        if (needsDraw || timestamp - lastDrawAt >= frameInterval) {
            lastDrawAt = timestamp
            needsDraw = false
            draw(timestamp)
        }

        animationFrame = requestAnimationFrame(drawLoop)
    }

    function draw(timestamp: number) {
        const canvas = options.getCanvas()
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        const ratio = getPixelRatio()
        const width = canvas.width / ratio
        const height = canvas.height / ratio

        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        context.imageSmoothingEnabled = false
        context.clearRect(0, 0, width, height)
        options.drawFrame(context, timestamp, {width, height})
    }

    function getPixelRatio() {
        return Math.min(window.devicePixelRatio || 1, options.maxPixelRatio)
    }

    return {
        bounds,
        resize,
        requestDraw,
        requestAnimationDraw,
        start,
        stop,
    }
}

function readCanvasBounds(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()

    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    }
}
