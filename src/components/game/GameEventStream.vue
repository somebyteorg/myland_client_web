<template></template>

<script setup lang="ts">
import {onBeforeUnmount, watch} from 'vue'
import {emitGameEvent} from '@/composables/useGameEventBus'

const FORWARDED_SSE_EVENT_NAMES = [
  'chat_message_new',
  'map_item',
  'map_land_chunk',
  'map_land_abandoned',
  'online_count',
] as const
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 12000
const DISCONNECTED_NOTICE = {
  message: '世界已断开正在重联',
  autoClose: true,
  tone: 'error',
  durationMs: 2800,
} as const

const props = defineProps<{
  playerId: string
}>()

type ForwardedSseEventName = typeof FORWARDED_SSE_EVENT_NAMES[number]

let eventSource: EventSource | null = null
let reconnectTimer: number | null = null
let reconnectAttempt = 0
let currentPlayerId = ''
let disconnectedNoticeShown = false

watch(
    () => props.playerId,
    (playerId) => {
      connectPlayerEventStream(playerId)
    },
    {immediate: true},
)

onBeforeUnmount(() => {
  stopEventStream()
})

function connectPlayerEventStream(playerId: string) {
  resetConnectionState()

  const normalizedPlayerId = playerId.trim()
  if (!normalizedPlayerId) return

  currentPlayerId = normalizedPlayerId
  openCurrentPlayerEventStream()
}

function openCurrentPlayerEventStream() {
  if (!currentPlayerId) return

  try {
    const nextEventSource = new EventSource(getEventStreamUrl(currentPlayerId))
    eventSource = nextEventSource
    bindEventSourceLifecycle(nextEventSource)
    forwardServerEvents(nextEventSource)
  } catch {
    handleEventStreamDisconnect()
  }
}

function stopEventStream() {
  resetConnectionState()
  currentPlayerId = ''
}

function resetConnectionState() {
  clearReconnectTimer()
  reconnectAttempt = 0
  disconnectedNoticeShown = false
  closeCurrentEventSource()
}

function getEventStreamUrl(playerId: string) {
  return `/sse/${encodeURIComponent(playerId)}`
}

function bindEventSourceLifecycle(source: EventSource) {
  source.onopen = handleEventStreamOpen
  source.onerror = handleEventStreamDisconnect
}

function handleEventStreamOpen() {
  reconnectAttempt = 0
  disconnectedNoticeShown = false
}

function forwardServerEvents(source: EventSource) {
  for (const eventName of FORWARDED_SSE_EVENT_NAMES) {
    source.addEventListener(eventName, (event) => {
      forwardServerEvent(eventName, event)
    })
  }
}

function closeCurrentEventSource() {
  if (!eventSource) return

  eventSource.close()
  eventSource = null
}

function handleEventStreamDisconnect() {
  closeCurrentEventSource()
  notifyDisconnected()
  scheduleReconnect()
}

function notifyDisconnected() {
  if (disconnectedNoticeShown) return

  disconnectedNoticeShown = true
  emitGameEvent('game_toast', {
    ...DISCONNECTED_NOTICE,
  })
}

function scheduleReconnect() {
  if (!currentPlayerId || reconnectTimer !== null) return

  reconnectAttempt += 1
  const delayMs = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttempt - 1), RECONNECT_MAX_DELAY_MS)

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    openCurrentPlayerEventStream()
  }, delayMs)
}

function clearReconnectTimer() {
  if (reconnectTimer === null) return

  window.clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function forwardServerEvent(eventName: ForwardedSseEventName, event: Event) {
  const messageEvent = event as MessageEvent<string>
  if (!messageEvent.data) return

  try {
    emitGameEvent(eventName, JSON.parse(messageEvent.data) as unknown)
  } catch (error) {
    console.error(`SSE ${eventName} parse failed`, error)
  }
}
</script>
