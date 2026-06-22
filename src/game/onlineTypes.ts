import type {TickFormatInfo} from '@/game/homeTypes'

export interface OnlineCountResponse {
    count_player: number
}

export interface OnlineCountEvent {
    count_player: number
}

export interface OnlinePlayer {
    player_id: string
    name: string
    gender: string | null
    gender_string: string | null
    avatar: string | null
    tick_age: number | null
    tick_age_string: string | number | null
    color: string | null
    manifesto: string | null
    count_visit: number
    tick_format: TickFormatInfo
}

export interface OnlinePlayerListResponse {
    page: number
    page_size: number
    has_more: boolean
    items: OnlinePlayer[]
}
