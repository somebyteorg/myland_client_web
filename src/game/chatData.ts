import {MAP_FILE_ID_NAMELESS} from '@/constants'
import api from '@/utils/ky'
import type {ChatMessage, ChatMessageListResponse} from './chatTypes'

export const VILLAGE_CHAT_ROOM = {
    type: 'village',
    value: MAP_FILE_ID_NAMELESS,
} as const

export const CHAT_MESSAGE_PAGE_SIZE = 20

export type ChatMessageSort = 'up' | 'down'

export interface ChatMessageListQuery {
    lastMessageId?: number
    sort: ChatMessageSort
    pageSize?: number
}

export function loadChatMessageList(query: ChatMessageListQuery) {
    const searchParams: Record<string, string | number> = {
        sort: query.sort,
        page: 1,
        page_size: query.pageSize ?? CHAT_MESSAGE_PAGE_SIZE,
    }

    if (query.lastMessageId) searchParams.last_message_id = query.lastMessageId

    return api.get(getChatRoomPath('list'), {searchParams}).json<ChatMessageListResponse>()
}

export function sendChatTextMessage(playerId: string, content: string) {
    return api.post(getChatRoomPath('send'), {
        json: {
            player_id: playerId,
            message_type: 'text',
            message_content: content,
            reply_message_id: null,
        },
    }).json<ChatMessage>()
}

function getChatRoomPath(action: 'list' | 'send') {
    return `api/chat/message/${encodeURIComponent(VILLAGE_CHAT_ROOM.type)}/${encodeURIComponent(String(VILLAGE_CHAT_ROOM.value))}/${action}`
}
