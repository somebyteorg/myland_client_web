import {VILLAGE_CHAT_ROOM} from './chatData'
import type {ChatMessage, ChatMessageNewEvent} from './chatTypes'

export function isVillageChatEvent(payload: ChatMessageNewEvent) {
    return payload.room_type === VILLAGE_CHAT_ROOM.type &&
        String(payload.room_value) === String(VILLAGE_CHAT_ROOM.value)
}

export function normalizeChatMessages(items: ChatMessage[]) {
    if (!Array.isArray(items)) return []

    return items
        .filter(isValidChatMessage)
        .sort(sortChatMessagesById)
}

export function mergeChatMessages(currentMessages: ChatMessage[], nextMessages: ChatMessage[]) {
    const byId = new Map<number, ChatMessage>()

    for (const message of currentMessages) byId.set(message.message_id, message)
    for (const message of nextMessages) byId.set(message.message_id, message)

    return Array.from(byId.values()).sort(sortChatMessagesById)
}

export function isValidChatMessage(message: ChatMessage | null | undefined): message is ChatMessage {
    return Boolean(message && Number.isFinite(message.message_id))
}

function sortChatMessagesById(left: ChatMessage, right: ChatMessage) {
    return left.message_id - right.message_id
}
