export interface PlayerInfo {
    player_id: string
    name: string
    gender: string
    gender_string: string
    avatar: string | null
    count_land: number
    tick_age: number
    tick_age_string: string | number
    health: number
    hungry: number
    reputation: number
    stamina: number
}

export interface GameTimeInfo {
    year: number
    season: string
    hour: string
    day: number
    string: string
    diff_hour: number
}

export interface TickFormatInfo {
    tick: number
    year: number
    season: string
    hour: string
    day: number
    string: string
}

export interface PlayerChronicleItem {
    event_id: number
    event_type: string
    text: string
    tick_format: TickFormatInfo
    village_id: number | null
    x: number | null
    y: number | null
}

export interface PlayerChronicleResponse {
    page: number
    page_size: number
    total: number
    items: PlayerChronicleItem[]
}

export interface PlayerChronicleLocation {
    village_id: number | null
    x: number
    y: number
}
