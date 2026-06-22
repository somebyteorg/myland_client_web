import type {MapObject} from './types'

export function isHomeObject(object: MapObject | null | undefined): object is MapObject {
    return object?.type === 'home'
}

export function isNeighborHomeObject(object: MapObject | null | undefined): object is MapObject {
    return Boolean(isHomeObject(object) && object.ownerType === 'neighbor' && object.ownerData?.player_id)
}

export function getHomeObjectOwnerLabel(object: MapObject) {
    return object.ownerData?.name?.trim() || (object.ownerType === 'player' ? '我的住宅' : '未知住户')
}
