import {reactive} from 'vue'

export interface ToastItem {
    id: number
    message: string
    autoClose: boolean
    tone: 'info' | 'error'
}

interface UseToastStackOptions {
    durationMs?: number
}

interface PushToastOptions {
    autoClose?: boolean
    durationMs?: number
    tone?: 'info' | 'error'
}

export function useToastStack(options: UseToastStackOptions = {}) {
    const durationMs = options.durationMs ?? 2400
    const toasts = reactive<ToastItem[]>([])
    const toastTimers = new Map<number, number>()
    let nextToastId = 1

    function pushToast(message: string, pushOptions: PushToastOptions = {}) {
        const autoClose = pushOptions.autoClose ?? false
        const toastDurationMs = pushOptions.durationMs ?? durationMs
        const tone = pushOptions.tone ?? 'info'
        const id = nextToastId
        nextToastId += 1
        toasts.push({id, message, autoClose, tone})

        if (autoClose) {
            const timerId = window.setTimeout(() => {
                removeToast(id)
            }, toastDurationMs)
            toastTimers.set(id, timerId)
        }
    }

    function removeToast(id: number) {
        const index = toasts.findIndex((toast) => toast.id === id)
        if (index >= 0) toasts.splice(index, 1)

        const timerId = toastTimers.get(id)
        if (timerId !== undefined) {
            window.clearTimeout(timerId)
            toastTimers.delete(id)
        }
    }

    function clearToasts() {
        for (const timerId of toastTimers.values()) {
            window.clearTimeout(timerId)
        }
        toastTimers.clear()
        toasts.splice(0, toasts.length)
    }

    return {
        toasts,
        pushToast,
        removeToast,
        clearToasts,
    }
}
