import type {TickFormatInfo} from '@/game/homeTypes'

export interface ChatMessage {
    message_id: number
    message_type: string
    message_content: string
    player_id: string
    player_name: string
    player_avatar: string | null
    tick_format: TickFormatInfo
}

export interface ChatMessageListResponse {
    page: number
    page_size: number
    has_more: boolean
    items: ChatMessage[]
}

export interface ChatMessageNewEvent {
    room_type: string
    room_value: number | string
    message: ChatMessage
}
