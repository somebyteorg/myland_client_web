import api from '@/utils/ky'
import {resolveThemeColor} from './colorUtils'
import {createEmptyCropPatch} from './tileState'
import type {GameTimeInfo, PlayerInfo} from './homeTypes'
import type {
    LandAbandonResponse,
    LandGrantResponse,
    MapItemOwnerData,
    MapObject,
    Tile,
    TilePatchValue,
} from './types'

export function requestLandGrant(path: string, tile: Tile, playerId: string) {
    return api.post(path, {
        json: {
            player_id: playerId,
            x: tile.x,
            y: tile.y,
        },
    }).json<LandGrantResponse>()
}

export function requestLandDeed(path: string, tile: Tile, playerId: string) {
    return api.post(path, {
        json: {
            player_id: playerId,
            x: tile.x,
            y: tile.y,
        },
    }).json<LandGrantResponse>()
}

export function requestLandAbandon(path: string, tile: Tile, playerId: string) {
    return api.delete(path, {
        json: {
            player_id: playerId,
            x: tile.x,
            y: tile.y,
        },
    }).json<LandAbandonResponse>()
}

export function normalizeGrantCount(value: number | null | undefined, fallback: number) {
    const count = Number(value)

    return Number.isFinite(count) ? Math.max(0, count) : Math.max(0, fallback)
}

export function createPlayerFieldPatch(
    tile: Tile,
    options: {
        landId?: number | null
        currentPlayerId?: string | null
        currentPlayerName?: string | null
        homeObject?: MapObject | null
    },
): TilePatchValue {
    return {
        landId: options.landId ?? tile.landId,
        landName: tile.landName,
        landQuality: tile.landQuality,
        ownerPlayerId: options.currentPlayerId || tile.ownerPlayerId,
        terrain: 'field',
        ownerType: 'player',
        owner: options.currentPlayerName ?? '我',
        themeColor: options.homeObject ? resolveThemeColor(options.homeObject.ownerData?.color) : tile.themeColor,
        name: `我的地 ${tile.id}`,
        fertility: Math.max(tile.fertility, 58),
        security: Math.max(tile.security, 60),
        ...createEmptyCropPatch('待播种'),
    }
}

export function createGrantedHomeObject(
    tile: Tile,
    options: {
        size: number
        ownerData: MapItemOwnerData
        createdAtString?: string | null
        now?: number
    },
): MapObject {
    return {
        id: `granted-home-${tile.x}-${tile.y}-${options.now ?? Date.now()}`,
        type: 'home',
        x: tile.x,
        y: tile.y,
        width: options.size,
        height: options.size,
        level: 1,
        ownerType: 'player',
        ownerData: options.ownerData,
        createdAtString: options.createdAtString ?? null,
    }
}

export function createCurrentPlayerOwnerData(playerId: string | null | undefined, player: PlayerInfo | null | undefined): MapItemOwnerData {
    return {
        player_id: playerId ?? '',
        name: player?.name ?? '我',
        gender: player?.gender,
        gender_string: player?.gender_string,
        avatar: player?.avatar ?? null,
        tick_age: player?.tick_age,
        tick_age_string: player?.tick_age_string,
    }
}

export function getCreatedAtString(gameTime: GameTimeInfo | null | undefined) {
    return gameTime?.string ?? null
}
