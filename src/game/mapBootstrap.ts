import {MAP_FILE_ID_NAMELESS} from '@/constants'
import {loadBaseMap, loadMapItems} from './baseMap'
import {createSeedPlantCatalog, loadGameItems} from './itemCatalog'
import {createLocalMapJson} from './mapData'

export async function loadInitialMapData(mapId = MAP_FILE_ID_NAMELESS) {
    const [baseMap, mapItems, itemList] = await Promise.all([
        loadBaseMap(mapId),
        loadMapItems(mapId),
        loadGameItems(),
    ])

    return {
        baseMap,
        itemList,
        mapItems,
        mapJson: createLocalMapJson(baseMap),
        plantCatalog: createSeedPlantCatalog(itemList.items),
    }
}
