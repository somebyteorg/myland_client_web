export type Terrain = 'grass' | 'field' | 'home' | 'water' | 'mountain'
export type OwnerType = 'player' | 'neighbor' | 'none' | 'village'
export type PlantType = number
export type FarmTool = 'inspect' | 'shovel' | PlantType
export type CropStatus = 'seed' | 'growing' | 'harvestable' | 'withered'
export type ObjectType = 'home' | 'watchdog' | 'scarecrow' | 'player_statue'
export type BaseTerrain = 'grass' | 'water' | 'mountain'
export type BaseMapPoint = [number, number]

export type GameItemType = 'grain_seed' | 'grain_crop' | string

export interface GameItem {
    item_id: number
    item_name: string
    item_cover: string | null
    item_description: string | null
    item_type: GameItemType
    item_emoji: string | null
    updated_at: string
}

export interface GameItemListResponse {
    page: number
    page_size: number
    total: number
    items: GameItem[]
}

export interface ItemInventoryEntry {
    location_type: string
    grid_index: number | null
    item_id: number
    quantity: number
    tick_expired: number | null
    tick_expired_format: string | null
    is_stolen: boolean
}

export interface LandGrantResponse {
    count_grand?: number
    count_deed?: number
    land_id?: number
}

export interface LandAbandonResponse {
    is_success: boolean
}

export interface GameTickFormat {
    tick: number
    year: number
    season: string
    hour: string
    day: number
    string: string
}

export interface MapLandOwnerData {
    player_id?: string
    name?: string
    color?: string | null
}

export interface MapLandCrop {
    crop_id: number
    crop_status: CropStatus
    item_id: number
    tick_planted_format: GameTickFormat
    second_mature: number
    yield_expected: number
    is_can_stolen: boolean
}

export interface MapLandChunkItem {
    land_id: number
    land_name: string | null
    land_quality: string
    x: number
    y: number
    owner_type: string
    owner_data: MapLandOwnerData | null
    crop: MapLandCrop | null
}

export interface MapPlayerHomeItem {
    item_name: string | null
    x: number
    y: number
    width: number
    height: number
    level: number
}

export interface LandCropPlantingResponse {
    crop_id: number
    crop_status?: CropStatus
    second_mature: number
    tick_planted_format: GameTickFormat
    yield_expected: number
    count_seed: number
}

export interface LandCropClearResponse {
    is_success: boolean
}

export interface LandCropHarvestResponse {
    yield_harvested: number
}

export interface LandCropStealResponse {
    player_stolen: number
}

export interface MapTerrainPoint {
    x: number
    y: number
}

export interface MapTerrainResponse {
    id: number
    code: string
    name: string
    width: number
    height: number
    mountain: number
    terrains: {
        river?: MapTerrainPoint[]
        [key: string]: MapTerrainPoint[] | undefined
    }
}

export interface MapItemOwnerData {
    player_id: string
    name: string
    gender?: string | null
    gender_string?: string | null
    avatar: string | null
    tick_age?: number | null
    tick_age_string?: string | number | null
    color?: string | null
    manifesto?: string | null
    count_visit?: number | null
    tick_last_visit?: GameTickFormat | null
    count_visit_view?: number | null
    count_land?: number | null
}

export interface MapItemResponse {
    tick_created_format?: {
        tick: number
        year: number
        season: string
        hour: string
        day: number
        string: string
    }
    item_name: string | null
    item_type: string
    owner_type: string
    owner_data: MapItemOwnerData
    x: number
    y: number
    width: number
    height: number
    level: number
    count_visit?: number | null
    item_data?: {
        player_statue_name?: string | null
        player_statue_url?: string | null
        [key: string]: unknown
    } | null
}

export interface NeighborVisitResponse {
    count_visit?: number | null
}

export interface NeighborInfoResponse {
    player_id: string
    name: string
    gender: string | null
    gender_string: string | null
    avatar: string | null
    tick_age: number | null
    tick_age_string: string | number | null
    color: string | null
    manifesto: string | null
    count_visit: number | null
    tick_last_visit: GameTickFormat | null
    count_visit_view: number | null
    count_land: number | null
}

export interface BaseMapGrid {
    width: number
    height: number
    tileSize: number
}

export interface BaseMapRect {
    x: number
    y: number
    width: number
    height: number
}

export interface BaseMapRiver {
    id: string
    width: number
    centerline: BaseMapPoint[]
    tiles: BaseMapPoint[]
}

export interface BaseMapJson {
    schemaVersion: 'myland.base-map.v1'
    id?: number
    code: string
    name: string
    mountain: number
    grid: BaseMapGrid
    mountains: BaseMapRect[]
    rivers: BaseMapRiver[]
}

export type TheftIntensity = 'low' | 'medium' | 'high'

export interface TileTheftState {
    intensity: TheftIntensity
    atTick: number
}

export interface TileCoordinates {
    id: string
    x: number
    y: number
}

export interface TileLandState {
    landId: number | null
    landName: string | null
    landQuality: string | null
}

export interface TileOwnerState {
    terrain: Terrain
    ownerType: OwnerType
    owner: string
    ownerPlayerId: string | null
    themeColor?: string | null
}

export interface TileDisplayState {
    name: string
    status: string
}

export interface TileCropState {
    crop: string
    cropId: number | null
    cropStatus: CropStatus | null
    cropPlantedAt: GameTickFormat | null
    cropSecondMature: number | null
    cropMaturesAtMs: number | null
    cropGrowsAtMs: number | null
    cropYieldExpected: number | null
    isCanStolen: boolean
    plant: PlantType | null
    yield: number
    harvestable: boolean
}

export interface TileResourceState {
    fertility: number
    humidity: number
    security: number
}

export interface TileRiskState {
    theft: TileTheftState | null
    cropActionSubmitting?: boolean
}

export interface Tile extends TileCoordinates,
    TileLandState,
    TileOwnerState,
    TileDisplayState,
    TileCropState,
    TileResourceState,
    TileRiskState {
}

export type TilePatchValue = Partial<Tile>

export interface PlantAnimationEffect {
    seedColor: string
    stemColor: string
    leafColor: string
    fruitColor: string
    accentColor: string
    kind: 'grain' | 'bush' | 'tree' | 'vine'
}

export interface PlantDefinition extends PlantAnimationEffect {
    id: PlantType
    item: GameItem
}

export type PlantDefinitionMap = Record<PlantType, PlantDefinition>

export interface Butterfly {
    tileX: number
    tileY: number
    x: number
    y: number
    phase: number
    speed: number
}

export interface MapObject {
    id: string
    type: ObjectType
    x: number
    y: number
    width: number
    height: number
    level: number
    ownerType: OwnerType
    ownerData: MapItemOwnerData
    createdAtString?: string | null
    playerStatueName?: string | null
    playerStatueUrl?: string | null
    neighborInfoLoading?: boolean
    neighborInfoRequestId?: number
    neighborVisitSubmitting?: boolean
    state?: 'idle' | 'alert'
}

export interface HomeHoverCardState {
    visible: boolean
    x: number
    y: number
    home: MapObject | null
}

export interface LandHoverCardState {
    visible: boolean
    x: number
    y: number
    tile: Tile | null
}

export interface ContextMenuState {
    visible: boolean
    x: number
    y: number
    tile: Tile | null
    object: MapObject | null
    actions: string[]
}

export interface OwnerLabelCluster {
    id: string
    ownerType: OwnerType
    owner: string
    count: number
    centerX: number
    centerY: number
    minX: number
    maxX: number
    minY: number
    maxY: number
    tileKeys: Set<string>
}

export interface MapJson {
    schemaVersion: 'myland.map.v1'
    id?: number
    code: string
    name: string
    width: number
    height: number
    tiles: Tile[]
    objects: MapObject[]
}

export interface TilePatch {
    x: number
    y: number
    tile: TilePatchValue
}

export interface RegionPatch {
    x: number
    y: number
    width: number
    height: number
    tiles: Tile[]
}

export interface ObjectPatch {
    id: string
    object: Partial<MapObject>
}

export type MapRealtimeEvent =
    | { type: 'tile.updated'; patch: TilePatch }
    | { type: 'region.updated'; patch: RegionPatch }
    | { type: 'land.abandoned'; patch: TilePatch }
    | { type: 'land.deeded'; patch: TilePatch }
    | { type: 'plant.updated'; patch: TilePatch }
    | { type: 'object.created'; object: MapObject }
    | { type: 'object.updated'; patch: ObjectPatch }
    | { type: 'home.built'; object: MapObject; region?: RegionPatch }
