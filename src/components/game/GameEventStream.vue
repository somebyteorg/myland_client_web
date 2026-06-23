<template></template>

<script setup lang="ts">
import {onBeforeUnmount, watch} from 'vue'
import {io} from 'socket.io-client'
import type {Socket} from 'socket.io-client'
import {emitGameEvent} from '@/composables/useGameEventBus'

const SOCKET_IO_PATH = '/io/'
const ROOM_NAME_CHAT_NAMELESS = 'chat_nameless'
const ROOM_NAME_MAP_NAMELESS = 'map_nameless'
const REALTIME_ROOM_NAMES = [
  ROOM_NAME_CHAT_NAMELESS,
  ROOM_NAME_MAP_NAMELESS,
] as const
const FORWARDED_REALTIME_EVENT_NAMES = [
  'chat_message_new',
  'map_item',
  'map_land_chunk',
  'map_land_abandoned',
  'online_count',
] as const
const RECONNECT_DELAY_MS = 1000
const RECONNECT_DELAY_MAX_MS = 12000
const DISCONNECTED_NOTICE = {
  message: '世界已断开正在重联',
  autoClose: true,
  tone: 'error',
  durationMs: 2800,
} as const

const props = defineProps<{
  playerId: string
  token: string
}>()

type RealtimeCredentials = {
  playerId: string
  token: string
}
type ForwardedRealtimeEventName = typeof FORWARDED_REALTIME_EVENT_NAMES[number]

let activeSocket: Socket | null = null
let disconnectedNoticeShown = false

watch(
    () => [props.playerId, props.token] as const,
    ([playerId, token]) => {
      syncRealtimeConnection(playerId, token)
    },
    {immediate: true},
)

onBeforeUnmount(() => {
  stopRealtimeSocket()
})

function syncRealtimeConnection(playerId: string, token: string) {
  resetConnectionState()

  const credentials = normalizeCredentials(playerId, token)
  if (!credentials) return

  openRealtimeSocket(credentials)
}

function normalizeCredentials(playerId: string, token: string): RealtimeCredentials | null {
  const normalizedPlayerId = playerId.trim()
  const normalizedToken = token.trim()
  if (!normalizedPlayerId || !normalizedToken) return null

  return {
    playerId: normalizedPlayerId,
    token: normalizedToken,
  }
}

function openRealtimeSocket(credentials: RealtimeCredentials) {
  try {
    const socket = createRealtimeSocket(credentials)
    activeSocket = socket
    bindSocketLifecycle(socket)
    forwardRealtimeEvents(socket)
    socket.connect()
  } catch (error) {
    notifyDisconnected()
    console.error('Socket.IO create failed', error)
  }
}

function stopRealtimeSocket() {
  resetConnectionState()
}

function resetConnectionState() {
  disconnectedNoticeShown = false
  closeActiveSocket()
}

function createRealtimeSocket(credentials: RealtimeCredentials) {
  return io({
    path: SOCKET_IO_PATH,
    auth: {
      token: credentials.token,
      player_id: credentials.playerId,
    },
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
    autoConnect: false,
  })
}

function bindSocketLifecycle(socket: Socket) {
  socket.on('connect', () => handleSocketConnect(socket))
  socket.on('disconnect', notifyDisconnected)
  socket.on('connect_error', handleSocketConnectError)
}

function handleSocketConnect(socket: Socket) {
  disconnectedNoticeShown = false
  joinRealtimeRooms(socket)
}

function forwardRealtimeEvents(socket: Socket) {
  for (const eventName of FORWARDED_REALTIME_EVENT_NAMES) {
    socket.on(eventName, (payload: unknown) => {
      forwardRealtimeEvent(eventName, payload)
    })
  }
}

function joinRealtimeRooms(socket: Socket) {
  emitRoomCommand(socket, 'join')
}

function closeActiveSocket() {
  if (!activeSocket) return

  leaveRealtimeRooms(activeSocket)
  activeSocket.removeAllListeners()
  activeSocket.disconnect()
  activeSocket = null
}

function leaveRealtimeRooms(socket: Socket) {
  emitRoomCommand(socket, 'leave')
}

function emitRoomCommand(socket: Socket, command: 'join' | 'leave') {
  if (!socket.connected) return

  for (const roomName of REALTIME_ROOM_NAMES) {
    socket.emit(command, roomName)
  }
}

function handleSocketConnectError(error: Error) {
  notifyDisconnected()
  console.error('Socket.IO connect failed', error)
}

function notifyDisconnected() {
  if (disconnectedNoticeShown) return

  disconnectedNoticeShown = true
  emitGameEvent('game_toast', {
    ...DISCONNECTED_NOTICE,
  })
}

function forwardRealtimeEvent(eventName: ForwardedRealtimeEventName, payload: unknown) {
  const eventPayload = parseRealtimePayload(eventName, payload)
  if (eventPayload === undefined) return

  emitGameEvent(eventName, eventPayload)
}

function parseRealtimePayload(eventName: ForwardedRealtimeEventName, payload: unknown) {
  if (typeof payload !== 'string') return payload
  if (!payload) return undefined

  try {
    return JSON.parse(payload) as unknown
  } catch (error) {
    console.error(`Socket.IO ${eventName} parse failed`, error)
    return undefined
  }
}
</script>
