import {reactive} from 'vue'
import {Application, Container} from 'pixi.js'
import type {ViewportRect} from '@/game/mapCamera'
import {destroyPixiDisplayTree, PixiDrawContext} from '@/game/pixiDrawContext'
import type {PixiMapRenderFrame, PixiMapRenderLayers} from '@/game/pixiRenderFrame'

export interface MapRenderFrameBounds {
    width: number
    height: number
}

export interface MapRenderFrameState {
    redrawAnimationLayers: boolean
    redrawLabelLayer: boolean
    redrawSceneLayers: boolean
}

export interface MapRenderStats {
    averageFrameMs: number
    frames: number
    lastFrameMs: number
    lastRenderState: MapRenderFrameState
    peakFrameMs: number
    pixiChildren: number
}

interface UseMapRenderLoopOptions {
    getCanvas: () => HTMLCanvasElement | null
    maxPixelRatio: number
    getAnimationFrameInterval: () => number
    getSceneFrameInterval: () => number
    drawFrame: (frame: PixiMapRenderFrame, timestamp: number, bounds: MapRenderFrameBounds, state: MapRenderFrameState) => void
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
    let lastAnimationDrawAt = 0
    let lastSceneDrawAt = 0
    let drawingActive = false
    let needsAnimationRedraw = true
    let needsLabelRedraw = true
    let needsSceneRedraw = true
    let pixiApp: Application | null = null
    let pixiFrame: PixiMapRenderFrame | null = null
    let pixiCanvas: HTMLCanvasElement | null = null
    let pixiInitPromise: Promise<Application | null> | null = null
    const recentFrameTimes: number[] = []
    const stats = reactive<MapRenderStats>({
        averageFrameMs: 0,
        frames: 0,
        lastFrameMs: 0,
        lastRenderState: {
            redrawAnimationLayers: false,
            redrawLabelLayer: false,
            redrawSceneLayers: false,
        },
        peakFrameMs: 0,
        pixiChildren: 0,
    })

    function resize() {
        const canvas = options.getCanvas()
        if (!canvas) return

        Object.assign(bounds, readCanvasBounds(canvas))
        void ensurePixiApp().then((app) => {
            if (!app) return

            app.renderer.resize(
                Math.max(1, bounds.width),
                Math.max(1, bounds.height),
                getPixelRatio(),
            )
            requestDraw()
        })

        options.onResize()
        requestDraw()
    }

    function requestDraw() {
        needsAnimationRedraw = true
        needsLabelRedraw = true
        needsSceneRedraw = true
        options.onDrawRequest()
    }

    function requestSceneDraw() {
        needsSceneRedraw = true
    }

    function requestAnimationDraw() {
        needsAnimationRedraw = true
    }

    function start(timestamp = 0) {
        if (drawingActive) return

        drawingActive = true
        drawLoop(timestamp)
    }

    function stop() {
        drawingActive = false
        cancelAnimationFrame(animationFrame)
        pixiInitPromise = null
        destroyPixiFrame(pixiFrame)
        pixiFrame = null
        pixiCanvas = null
        pixiApp?.destroy(
            {removeView: false, releaseGlobalResources: true},
        )
        pixiApp = null
    }

    function drawLoop(timestamp = 0) {
        if (!drawingActive) return

        const animationFrameInterval = options.getAnimationFrameInterval()
        const sceneFrameInterval = options.getSceneFrameInterval()
        const animationDue = Number.isFinite(animationFrameInterval) && timestamp - lastAnimationDrawAt >= animationFrameInterval
        const sceneDue = Number.isFinite(sceneFrameInterval) && timestamp - lastSceneDrawAt >= sceneFrameInterval

        if (needsSceneRedraw || needsLabelRedraw || needsAnimationRedraw || sceneDue || animationDue) {
            const redrawSceneLayers = needsSceneRedraw || sceneDue
            const redrawLabelLayer = needsLabelRedraw || sceneDue
            const redrawAnimationLayers = needsAnimationRedraw || animationDue

            if (redrawSceneLayers) {
                needsSceneRedraw = false
                lastSceneDrawAt = timestamp
            }
            if (redrawLabelLayer) {
                needsLabelRedraw = false
            }
            if (redrawAnimationLayers) {
                needsAnimationRedraw = false
                lastAnimationDrawAt = timestamp
            }
            draw(timestamp, {
                redrawAnimationLayers,
                redrawLabelLayer,
                redrawSceneLayers,
            })
        }

        animationFrame = requestAnimationFrame(drawLoop)
    }

    function draw(timestamp: number, state: MapRenderFrameState) {
        void drawPixiFrame(timestamp, state)
    }

    async function drawPixiFrame(timestamp: number, state: MapRenderFrameState) {
        const frameStart = getNow()
        const app = await ensurePixiApp()
        if (!app || !pixiFrame) return

        const width = Math.max(1, bounds.width || app.screen.width)
        const height = Math.max(1, bounds.height || app.screen.height)

        if (state.redrawSceneLayers) {
            pixiFrame.backdropContext.beginFrame(pixiFrame.layers.backdrop)
            pixiFrame.sceneContext.beginFrame(pixiFrame.layers.scene)
        }
        if (state.redrawLabelLayer) {
            pixiFrame.labelContext.beginFrame(pixiFrame.layers.labels)
        }
        if (state.redrawAnimationLayers) {
            pixiFrame.cropAnimationContext.beginFrame(pixiFrame.layers.cropAnimation)
            pixiFrame.objectAnimationContext.beginFrame(pixiFrame.layers.objectAnimation)
            pixiFrame.overlayAnimationContext.beginFrame(pixiFrame.layers.overlayAnimation)
        }
        options.drawFrame(pixiFrame, timestamp, {width, height}, state)
        app.render()
        const frameMs = getNow() - frameStart
        updateFrameTimeStats(frameMs)
        stats.frames += 1
        stats.lastFrameMs = frameMs
        stats.lastRenderState = {...state}
        stats.pixiChildren = countLayerChildren(pixiFrame.layers)
    }

    function updateFrameTimeStats(frameMs: number) {
        recentFrameTimes.push(frameMs)
        if (recentFrameTimes.length > 60) recentFrameTimes.shift()

        let total = 0
        let peak = 0
        for (const value of recentFrameTimes) {
            total += value
            peak = Math.max(peak, value)
        }
        stats.averageFrameMs = total / recentFrameTimes.length
        stats.peakFrameMs = peak
    }

    async function ensurePixiApp() {
        const canvas = options.getCanvas()
        if (!canvas) return null
        if (pixiApp && pixiCanvas === canvas) return pixiApp
        if (pixiInitPromise) return pixiInitPromise

        pixiInitPromise = initializePixiApp(canvas)
        const app = await pixiInitPromise
        pixiInitPromise = null

        return app
    }

    async function initializePixiApp(canvas: HTMLCanvasElement) {
        destroyPixiFrame(pixiFrame)
        pixiFrame = null
        pixiApp?.destroy(
            {removeView: false, releaseGlobalResources: true},
        )

        const app = new Application()
        const currentBounds = readCanvasBounds(canvas)
        const width = Math.max(1, currentBounds.width)
        const height = Math.max(1, currentBounds.height)

        await app.init({
            antialias: true,
            autoDensity: true,
            autoStart: false,
            backgroundAlpha: 0,
            canvas,
            height,
            preference: 'webgl',
            resolution: getPixelRatio(),
            width,
        })

        if (options.getCanvas() !== canvas) {
            app.stage.removeChildren()
            app.destroy(
                {removeView: false, releaseGlobalResources: true},
            )
            return null
        }

        pixiApp = app
        pixiCanvas = canvas
        pixiFrame = createPixiFrame(app.stage, app.renderer)
        Object.assign(bounds, currentBounds)

        return app
    }

    function getPixelRatio() {
        return Math.min(window.devicePixelRatio || 1, options.maxPixelRatio)
    }

    return {
        bounds,
        resize,
        requestAnimationDraw,
        requestDraw,
        requestSceneDraw,
        stats,
        start,
        stop,
    }
}

function destroyPixiFrame(frame: PixiMapRenderFrame | null) {
    if (!frame) return

    frame.backdropContext.destroy()
    frame.cropAnimationContext.destroy()
    frame.labelContext.destroy()
    frame.objectAnimationContext.destroy()
    frame.overlayAnimationContext.destroy()
    frame.sceneContext.destroy()

    const children = frame.layers.stage.removeChildren()
    for (const child of children) {
        destroyPixiDisplayTree(child)
    }
}

function createPixiFrame(stage: Container, renderer: Application['renderer']): PixiMapRenderFrame {
    const layers: PixiMapRenderLayers = {
        stage,
        backdrop: new Container(),
        static: new Container(),
        scene: new Container(),
        cropAnimation: new Container(),
        objectAnimation: new Container(),
        overlayAnimation: new Container(),
        labels: new Container(),
    }

    stage.removeChildren()
    stage.addChild(
        layers.backdrop,
        layers.static,
        layers.cropAnimation,
        layers.scene,
        layers.objectAnimation,
        layers.overlayAnimation,
        layers.labels,
    )

    return {
        backdropContext: new PixiDrawContext(layers.backdrop),
        cropAnimationContext: new PixiDrawContext(layers.cropAnimation),
        labelContext: new PixiDrawContext(layers.labels),
        objectAnimationContext: new PixiDrawContext(layers.objectAnimation),
        overlayAnimationContext: new PixiDrawContext(layers.overlayAnimation),
        renderer,
        sceneContext: new PixiDrawContext(layers.scene),
        layers,
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

function countLayerChildren(layers: PixiMapRenderLayers) {
    return layers.backdrop.children.length +
        layers.static.children.length +
        layers.scene.children.length +
        layers.cropAnimation.children.length +
        layers.objectAnimation.children.length +
        layers.overlayAnimation.children.length +
        layers.labels.children.length
}

function getNow() {
    return typeof performance === 'undefined' ? Date.now() : performance.now()
}
