import {removeButterfliesFromObject, removeButterfliesFromTile, removeButterfliesFromTileIfNeeded} from './butterflies'
import {getHomeObjectOwnerLabel, isHomeObject} from './objectRules'
import {createHomeTilePatch} from './tileState'
import {createReactiveMapObject} from './mapObjectData'
import type {
    Butterfly,
    MapObject,
    MapRealtimeEvent,
    ObjectPatch,
    RegionPatch,
    Tile,
    TilePatch,
} from './types'
import type {Ref} from 'vue'

type TileLookup = (x: number, y: number) => Tile | null
type OccupiedRect = { x: number; y: number; width: number; height: number }

export interface MapEventApplierOptions {
    tileAt: () => TileLookup
    tiles: Tile[]
    mapObjects: MapObject[]
    occupiedMapRects: OccupiedRect[]
    butterflyAnchors: Butterfly[]
    selectedTile: Ref<Tile | null>
    selectedMapObject: Ref<MapObject | null>
    getPlantLabel: (plant: number) => string
    getObjectThemeColor: (object: MapObject) => string
}

export function createMapEventApplier(options: MapEventApplierOptions) {
    function applyEvent(event: MapRealtimeEvent) {
        if (event.type === 'region.updated') {
            applyRegionPatch(event.patch)
        } else if (event.type === 'object.created') {
            applyObjectCreated(event.object)
        } else if (event.type === 'object.updated') {
            applyObjectPatch(event.patch)
        } else if (event.type === 'home.built') {
            applyHomeBuilt(event)
        } else {
            applyTilePatch(event.patch)
        }
    }

    function applyTilePatch(patch: TilePatch) {
        const tile = options.tileAt()(patch.x, patch.y)
        if (!tile) return

        Object.assign(tile, patch.tile)
        removeButterfliesFromTileIfNeeded(options.butterflyAnchors, tile)

        if (tile.plant) {
            tile.crop = options.getPlantLabel(tile.plant)
        }

        if (options.selectedTile.value?.x === tile.x && options.selectedTile.value.y === tile.y) {
            options.selectedTile.value = tile
        }
        if (options.selectedMapObject.value && !options.mapObjects.includes(options.selectedMapObject.value)) {
            options.selectedMapObject.value = null
        }
    }

    function applyRegionPatch(patch: RegionPatch) {
        for (const incomingTile of patch.tiles) {
            const tile = options.tileAt()(incomingTile.x, incomingTile.y)
            if (!tile) continue

            Object.assign(tile, incomingTile)
            removeButterfliesFromTileIfNeeded(options.butterflyAnchors, tile)
        }
    }

    function applyObjectCreated(object: MapObject) {
        if (options.mapObjects.some((item) => item.id === object.id)) return

        const reactiveObject = createReactiveMapObject(object)
        options.mapObjects.push(reactiveObject)
        rememberOccupiedObject(reactiveObject)
        removeButterfliesFromObject(options.butterflyAnchors, reactiveObject)
    }

    function applyObjectPatch(patch: ObjectPatch) {
        const object = options.mapObjects.find((item) => item.id === patch.id)
        if (!object) return

        Object.assign(object, patch.object)
        if (options.selectedMapObject.value?.id === object.id) options.selectedMapObject.value = object
    }

    function applyHomeBuilt(event: Extract<MapRealtimeEvent, { type: 'home.built' }>) {
        if (event.region) applyRegionPatch(event.region)
        else markHomeObjectTiles(event.object)
        applyObjectCreated(event.object)
        applyHomeLinkedLandColors([event.object])
    }

    function markHomeObjectTiles(object: MapObject) {
        const owner = getHomeObjectOwnerLabel(object)
        const themeColor = options.getObjectThemeColor(object)

        for (let y = object.y; y < object.y + object.height; y += 1) {
            for (let x = object.x; x < object.x + object.width; x += 1) {
                const tile = options.tileAt()(x, y)
                if (!tile) continue

                Object.assign(tile, createHomeTilePatch(tile, {
                    ownerType: object.ownerType,
                    owner,
                    ownerPlayerId: object.ownerData?.player_id ?? null,
                    themeColor,
                }))
                removeButterfliesFromTile(options.butterflyAnchors, tile.x, tile.y)
            }
        }
    }

    function applyHomeLinkedLandColors(objects: MapObject[]) {
        let changed = false

        for (const object of objects) {
            if (!isHomeObject(object)) continue

            const themeColor = options.getObjectThemeColor(object)
            const owner = getLandOwnerLabelForHomeObject(object)
            const linkedTiles = getLinkedLandTiles(object, owner)

            for (const tile of linkedTiles) {
                if (tile.owner !== owner) {
                    tile.owner = owner
                    changed = true
                }
                if (tile.themeColor !== themeColor) {
                    tile.themeColor = themeColor
                    changed = true
                }
                const name = getLinkedLandTileName(tile, owner)
                if (tile.name !== name) {
                    tile.name = name
                    changed = true
                }
            }
        }

        return changed
    }

    function getLinkedLandTiles(object: MapObject, owner: string) {
        return options.tiles.filter((tile) => canHomeColorLinkTile(tile, object, owner))
    }

    function canHomeColorLinkTile(tile: Tile, object: MapObject, owner: string) {
        if (tile.terrain === 'home' || tile.terrain === 'water' || tile.terrain === 'mountain') return false
        if (tile.ownerType !== object.ownerType) return false
        if (tile.ownerPlayerId && object.ownerData?.player_id) return tile.ownerPlayerId === object.ownerData.player_id
        if (tile.owner !== owner) return false

        return tile.terrain === 'field' || tile.terrain === 'grass'
    }

    function getLandOwnerLabelForHomeObject(object: MapObject) {
        const ownerName = object.ownerData?.name?.trim()
        if (ownerName) return ownerName

        return object.ownerType === 'player' ? '我' : '邻居'
    }

    function getLinkedLandTileName(tile: Tile, owner: string) {
        const explicitName = tile.landName?.trim()
        if (explicitName) return explicitName
        if (tile.ownerType === 'player') return `我的地 ${tile.id}`
        if (tile.ownerType === 'neighbor') return `${owner}的田地 ${tile.id}`
        if (tile.ownerType === 'village') return `村落土地 ${tile.id}`

        return `土地 ${tile.id}`
    }

    function rememberOccupiedObject(object: MapObject) {
        rememberOccupiedRect({
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
        })
    }

    function rememberOccupiedRect(rect: OccupiedRect) {
        const normalized = {
            x: rect.x,
            y: rect.y,
            width: Math.max(1, rect.width),
            height: Math.max(1, rect.height),
        }
        const exists = options.occupiedMapRects.some((item) => {
            return item.x === normalized.x &&
                item.y === normalized.y &&
                item.width === normalized.width &&
                item.height === normalized.height
        })

        if (!exists) options.occupiedMapRects.push(normalized)
    }

    return {
        applyEvent,
        applyTilePatch,
        applyRegionPatch,
        applyObjectCreated,
        applyObjectPatch,
        applyHomeBuilt,
        applyHomeLinkedLandColors,
        markHomeObjectTiles,
        rememberOccupiedRect,
        rememberOccupiedObject,
    }
}

export function tilePatchNeedsRenderedMapRebuild(patch: TilePatch) {
    const staticKeys: Array<keyof Tile> = ['terrain', 'ownerType', 'owner', 'themeColor']

    return staticKeys.some((key) => key in patch.tile)
}

export function mapRealtimeEventNeedsRenderedMapRebuild(event: MapRealtimeEvent) {
    if (event.type === 'tile.updated') return tilePatchNeedsRenderedMapRebuild(event.patch)

    return event.type === 'region.updated' ||
        event.type === 'land.abandoned' ||
        event.type === 'land.deeded' ||
        event.type === 'object.created' ||
        event.type === 'home.built'
}
