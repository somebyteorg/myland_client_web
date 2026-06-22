import {reactive} from 'vue'
import type {CameraState} from '@/game/mapCamera'

interface UseMapPointerControllerOptions {
    camera: CameraState
    getCanvas: () => HTMLCanvasElement | null
    isMapReady: () => boolean
    hideContextMenu: () => void
    updateHoverState: (clientX: number, clientY: number, dragging: boolean) => void
    handleClick: (clientX: number, clientY: number) => void
    handleLeave: () => void
    handleWheelZoom: (clientX: number, clientY: number, factor: number) => void
    clampToCanvas: () => void
    requestDraw: () => void
}

export function useMapPointerController(options: UseMapPointerControllerOptions) {
    const pointerState = reactive({
        active: false,
        id: -1,
        lastX: 0,
        lastY: 0,
        moved: 0,
    })

    function onPointerDown(event: PointerEvent) {
        const canvas = options.getCanvas()
        if (!canvas || event.button !== 0 || !options.isMapReady()) return

        options.hideContextMenu()
        pointerState.active = true
        pointerState.id = event.pointerId
        pointerState.lastX = event.clientX
        pointerState.lastY = event.clientY
        pointerState.moved = 0
        canvas.setPointerCapture(event.pointerId)
    }

    function onPointerMove(event: PointerEvent) {
        options.updateHoverState(event.clientX, event.clientY, pointerState.active)

        if (!pointerState.active || event.pointerId !== pointerState.id) return

        const dx = event.clientX - pointerState.lastX
        const dy = event.clientY - pointerState.lastY
        pointerState.lastX = event.clientX
        pointerState.lastY = event.clientY
        pointerState.moved += Math.abs(dx) + Math.abs(dy)
        options.camera.x += dx
        options.camera.y += dy
        options.clampToCanvas()
        options.requestDraw()
    }

    function onPointerUp(event: PointerEvent) {
        const canvas = options.getCanvas()
        if (!canvas || event.pointerId !== pointerState.id) return

        canvas.releasePointerCapture(event.pointerId)
        pointerState.active = false

        if (pointerState.moved < 6) {
            options.handleClick(event.clientX, event.clientY)
        }
    }

    function onPointerCancel(event: PointerEvent) {
        if (event.pointerId !== pointerState.id) return

        pointerState.active = false
    }

    function onPointerLeave() {
        options.handleLeave()
    }

    function onWheel(event: WheelEvent) {
        if (!options.isMapReady()) return

        options.hideContextMenu()
        const factor = event.deltaY > 0 ? 0.9 : 1.1
        options.handleWheelZoom(event.clientX, event.clientY, factor)
    }

    return {
        pointerState,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerLeave,
        onWheel,
    }
}
