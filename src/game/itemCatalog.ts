import api from '@/utils/ky'
import type {GameItem, GameItemListResponse, PlantDefinition, PlantDefinitionMap} from './types'
import {
    fallbackPlantAnimationEffect,
    ITEM_TYPE_BLUEPRINT,
    ITEM_TYPE_CURRENCY,
    ITEM_TYPE_GRAIN_CROP,
    ITEM_TYPE_GRAIN_SEED,
    ITEM_TYPE_PROP,
    ITEM_TYPE_TOOL,
    plantAnimationEffectsByItemId,
} from './itemCatalogData'

export async function loadGameItems() {
    const searchParams = new URLSearchParams()
    searchParams.append('types[]', ITEM_TYPE_CURRENCY)
    searchParams.append('types[]', ITEM_TYPE_GRAIN_SEED)
    searchParams.append('types[]', ITEM_TYPE_GRAIN_CROP)
    searchParams.append('types[]', ITEM_TYPE_PROP)
    searchParams.append('types[]', ITEM_TYPE_TOOL)
    searchParams.append('types[]', ITEM_TYPE_BLUEPRINT)
    searchParams.set('page_size', '1000')

    return api.get('api/item/list', {
        searchParams,
    }).json<GameItemListResponse>()
}

export function createSeedPlantCatalog(items: GameItem[]) {
    const seedItems = items
        .filter((item) => item.item_type === ITEM_TYPE_GRAIN_SEED)
        .sort((left, right) => left.item_id - right.item_id)
    const plantCycle = seedItems.map((item) => item.item_id)
    const plantDefinitions = seedItems.reduce<PlantDefinitionMap>((result, item) => {
        result[item.item_id] = createPlantDefinition(item)

        return result
    }, {})

    return {
        plantCycle,
        plantDefinitions,
    }
}

export function createPlantDefinition(item: GameItem): PlantDefinition {
    const animationEffect = plantAnimationEffectsByItemId[item.item_id] ?? fallbackPlantAnimationEffect

    return {
        id: item.item_id,
        item,
        ...animationEffect,
    }
}
