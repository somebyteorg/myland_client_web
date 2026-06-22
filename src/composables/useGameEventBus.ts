import {onBeforeUnmount, onMounted} from 'vue'

export interface GameToastEvent {
    message: string
    autoClose?: boolean
    durationMs?: number
    tone?: 'info' | 'error'
}

const gameEventTarget = new EventTarget()

export function emitGameEvent<T>(eventName: string, payload: T) {
    gameEventTarget.dispatchEvent(new CustomEvent<T>(eventName, {detail: payload}))
}

export function useGameEventListener<T>(eventName: string, handler: (payload: T) => void) {
    const listener = (event: Event) => {
        handler((event as CustomEvent<T>).detail)
    }

    onMounted(() => {
        gameEventTarget.addEventListener(eventName, listener)
    })

    onBeforeUnmount(() => {
        gameEventTarget.removeEventListener(eventName, listener)
    })
}
