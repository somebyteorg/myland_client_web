import type {OwnerType} from './types'

export function toOwnerType(ownerType: string, ownerPlayerId?: string | null, currentPlayerId?: string | null): OwnerType {
    if (ownerType === 'player') {
        return ownerPlayerId && ownerPlayerId === currentPlayerId ? 'player' : 'neighbor'
    }
    if (ownerType === 'village') return 'village'
    if (ownerType === 'mine') return 'player'

    return 'none'
}
