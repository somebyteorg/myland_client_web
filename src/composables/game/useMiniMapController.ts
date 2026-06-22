import {reactive, ref} from 'vue'
import {maxPixelRatio} from '@/game/config'
import {
    getCameraPositionFromMinimapPoint,
    type CameraState,
    type ViewportRect,
} from '@/game/mapCamera'
import {drawMiniMapViewport} from '@/game/renderMiniMap'

interface UseMiniMapControllerOptions {
    camera: CameraState
    getMainCanvas: () => HTMLCanvasElement | null
    getMainBounds: () => ViewportRect
    getStaticCanvas: () => HTMLCanvasElement | null
    getWorldWidth: () => number
    getWorldHeight: () => number
    isMapReady: () => boolean
    clampCamera: (width: number, height: number) => void
    zoomAt: (clientX: number, clientY: number, factor: number) => void
    hideContextMenu: () => void
    requestDraw: () => void
}

export function useMiniMapController(options: UseMiniMapControllerOptions) {
    const canvasRef = ref<HTMLCanvasElement | null>(null)
    const collapsed = ref(true)
    const dragging = ref(false)
    const bounds = reactive<ViewportRect>({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
    })
    const pointerState = reactive({
        active: false,
        id: -1,
    })

    function setCanvas(canvas: HTMLCanvasElement) {
        canvasRef.value = canvas
        updateBounds()
        requestAnimationFrame(() => {
            updateBounds()
            options.requestDraw()
        })
        options.requestDraw()
    }

    function updateBounds() {
        const canvas = canvasRef.value
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        bounds.left = rect.left
        bounds.top = rect.top
        bounds.width = rect.width
        bounds.height = rect.height
    }

    function collapse() {
        collapsed.value = true
        dragging.value = false
    }

    function expand() {
        collapsed.value = false
    }

    function toggleCollapsed() {
        collapsed.value = !collapsed.value
        if (collapsed.value) dragging.value = false
    }

    function draw() {
        if (collapsed.value) return

        const canvas = canvasRef.value
        const context = canvas?.getContext('2d')
        const staticCanvas = options.getStaticCanvas()
        const worldWidth = options.getWorldWidth()
        const worldHeight = options.getWorldHeight()
        if (!canvas || !context || !staticCanvas || worldWidth <= 0 || worldHeight <= 0) return

        if (bounds.width <= 0 || bounds.height <= 0) updateBounds()
        const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio)
        const width = Math.max(1, Math.floor(bounds.width * ratio))
        const height = Math.max(1, Math.floor(bounds.height * ratio))

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
        }

        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        drawMiniMapViewport(context, {
            camera: options.camera,
            mainBounds: options.getMainBounds(),
            minimapBounds: bounds,
            staticCanvas,
            worldWidth,
            worldHeight,
        })
    }

    function onWheel(event: WheelEvent) {
        const mainCanvas = options.getMainCanvas()
        if (!mainCanvas || !options.isMapReady()) return

        options.hideContextMenu()
        const mainBounds = options.getMainBounds()
        const factor = event.deltaY > 0 ? 0.9 : 1.1
        options.zoomAt(mainBounds.left + mainBounds.width / 2, mainBounds.top + mainBounds.height / 2, factor)
    }

    function onPointerDown(event: PointerEvent) {
        const canvas = canvasRef.value
        const mainCanvas = options.getMainCanvas()
        if (!canvas || !mainCanvas || event.button !== 0 || !options.isMapReady()) return

        updateBounds()
        pointerState.active = true
        pointerState.id = event.pointerId
        dragging.value = true
        canvas.setPointerCapture(event.pointerId)
        moveCameraFromPoint(event.clientX, event.clientY)
    }

    function onPointerMove(event: PointerEvent) {
        if (!pointerState.active || event.pointerId !== pointerState.id) return

        moveCameraFromPoint(event.clientX, event.clientY)
    }

    function onPointerUp(event: PointerEvent) {
        const canvas = canvasRef.value
        if (canvas && event.pointerId === pointerState.id) {
            canvas.releasePointerCapture(event.pointerId)
        }

        pointerState.active = false
        dragging.value = false
    }

    function moveCameraFromPoint(clientX: number, clientY: number) {
        const canvas = canvasRef.value
        const mainCanvas = options.getMainCanvas()
        if (!canvas || !mainCanvas || !options.isMapReady()) return

        const mainBounds = options.getMainBounds()
        if (bounds.width <= 0 || bounds.height <= 0 || mainBounds.width <= 0 || mainBounds.height <= 0) return

        const nextPosition = getCameraPositionFromMinimapPoint(
            clientX,
            clientY,
            options.camera.scale,
            bounds,
            mainBounds,
            options.getWorldWidth(),
            options.getWorldHeight(),
        )
        options.camera.x = nextPosition.x
        options.camera.y = nextPosition.y
        options.clampCamera(mainBounds.width, mainBounds.height)
        options.requestDraw()
    }

    return {
        canvasRef,
        collapsed,
        dragging,
        bounds,
        setCanvas,
        updateBounds,
        collapse,
        expand,
        toggleCollapsed,
        draw,
        onWheel,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    }
}
