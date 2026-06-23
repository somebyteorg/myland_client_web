import {MAP_FILE_ID_NAMELESS} from '@/constants'
import {loadBaseMap} from './baseMap'
import {createSeedPlantCatalog, loadGameItems} from './itemCatalog'
import {createLocalMapJson} from './mapData'

export async function loadInitialMapData(mapId = MAP_FILE_ID_NAMELESS) {
    const [baseMap, itemList] = await Promise.all([
        loadBaseMap(mapId),
        loadGameItems(),
    ])

    return {
        baseMap,
        itemList,
        mapJson: createLocalMapJson(baseMap),
        plantCatalog: createSeedPlantCatalog(itemList.items),
    }
}
