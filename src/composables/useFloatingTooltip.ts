import {reactive, ref} from 'vue'

export interface FloatingTooltipState {
    visible: boolean
    x: number
    y: number
    arrowX: number
    title: string
    description: string
}

export function useFloatingTooltip() {
    const tooltipRef = ref<HTMLElement | null>(null)
    const tooltip = reactive<FloatingTooltipState>({
        visible: false,
        x: 0,
        y: 0,
        arrowX: 14,
        title: '',
        description: '',
    })

    function showTooltip(title: string, description: string | null | undefined, event: MouseEvent | FocusEvent) {
        tooltip.title = title
        tooltip.description = description?.trim() || ''
        tooltip.visible = true

        const point = readTooltipAnchorPoint(event)
        placeTooltip(point.x, point.y)
        requestAnimationFrame(() => placeTooltip(point.x, point.y))
    }

    function moveTooltip(event: MouseEvent) {
        if (!tooltip.visible) return

        placeTooltip(event.clientX, event.clientY)
    }

    function hideTooltip() {
        tooltip.visible = false
    }

    function setTooltipElement(element: HTMLElement | null) {
        tooltipRef.value = element
    }

    function readTooltipAnchorPoint(event: MouseEvent | FocusEvent) {
        if ('clientX' in event && 'clientY' in event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            return {
                x: event.clientX,
                y: event.clientY,
            }
        }

        const target = event.currentTarget as HTMLElement | null
        if (!target) return {x: 0, y: 0}

        const rect = target.getBoundingClientRect()

        return {
            x: rect.right,
            y: rect.bottom,
        }
    }

    function placeTooltip(clientX: number, clientY: number) {
        const offset = 14
        const margin = 12
        const width = tooltipRef.value?.offsetWidth ?? 220
        const height = tooltipRef.value?.offsetHeight ?? 84
        let x = clientX + offset
        let y = clientY + offset

        if (x + width + margin > window.innerWidth) {
            x = Math.max(margin, window.innerWidth - width - margin)
        }
        if (y + height + margin > window.innerHeight) {
            y = Math.max(margin, window.innerHeight - height - margin)
        }

        tooltip.x = x
        tooltip.y = y
        tooltip.arrowX = Math.max(14, Math.min(width - 14, clientX - x + 14))
    }

    return {
        tooltipRef,
        tooltip,
        showTooltip,
        moveTooltip,
        hideTooltip,
        setTooltipElement,
    }
}
