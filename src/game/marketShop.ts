import api from '@/utils/ky'

export interface MarketShopItem {
    item_id: number
    carrot: number
}

export interface MarketShopOrderResponse {
    pay_url: string
}

export function loadMarketShopItems() {
    return api.get('api/market/shop/list').json<MarketShopItem[]>()
}

export function createMarketShopOrder(playerId: string, itemId: number, quantity = 1) {
    return api.post('api/market/shop/create', {
        json: {
            player_id: playerId,
            item_id: itemId,
            quantity,
        },
    }).json<MarketShopOrderResponse>()
}
