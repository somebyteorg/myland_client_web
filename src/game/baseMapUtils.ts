import type {
    BaseMapJson,
    BaseMapPoint,
    BaseMapRect,
    BaseMapRiver,
    BaseTerrain,
    MapTerrainPoint,
    MapTerrainResponse
} from './types'

export function createBaseTerrainLookup(baseMap: BaseMapJson) {
    const mountainTiles = new Set(baseMap.mountains.flatMap((mountain) => collectRectTiles(mountain)))
    const riverTiles = new Set(baseMap.rivers.flatMap((river) => river.tiles.map(([x, y]) => getCoordinateKey(x, y))))

    return (x: number, y: number): BaseTerrain => {
        if (x < 0 || y < 0 || x >= baseMap.grid.width || y >= baseMap.grid.height) return 'mountain'
        if (mountainTiles.has(getCoordinateKey(x, y))) return 'mountain'
        if (riverTiles.has(getCoordinateKey(x, y))) return 'water'

        return 'grass'
    }
}

export function createBaseMapJson(response: MapTerrainResponse): BaseMapJson {
    const thickness = Math.max(0, Math.floor(response.mountain))
    const mountains = createBorderMountains(response.width, response.height, thickness)
    const riverPoints = response.terrains.river ?? []
    const rivers = createRiverDefinitions(riverPoints)

    return {
        schemaVersion: 'myland.base-map.v1',
        id: response.id,
        code: response.code,
        name: response.name,
        mountain: thickness,
        grid: {
            width: response.width,
            height: response.height,
            tileSize: 64,
        },
        mountains,
        rivers,
    }
}

function createBorderMountains(width: number, height: number, thickness: number) {
    if (thickness <= 0) return []

    const safeThickness = Math.min(thickness, Math.floor(Math.min(width, height) / 2))
    if (safeThickness <= 0) return []

    const mountains: BaseMapRect[] = [
        {x: 0, y: 0, width, height: safeThickness},
        {x: 0, y: height - safeThickness, width, height: safeThickness},
        {x: 0, y: safeThickness, width: safeThickness, height: Math.max(0, height - safeThickness * 2)},
        {
            x: width - safeThickness,
            y: safeThickness,
            width: safeThickness,
            height: Math.max(0, height - safeThickness * 2)
        },
    ]

    return mountains.filter((rect) => rect.width > 0 && rect.height > 0)
}

function createRiverDefinitions(points: MapTerrainPoint[]): BaseMapRiver[] {
    const uniquePoints = Array.from(
        new Map(points.map((point) => [getCoordinateKey(point.x, point.y), [point.x, point.y] as BaseMapPoint])).values(),
    )
    const pointSet = new Set(uniquePoints.map(([x, y]) => getCoordinateKey(x, y)))
    const adjacency = buildAdjacency(pointSet)
    const visited = new Set<string>()
    const rivers: BaseMapRiver[] = []

    for (const point of uniquePoints) {
        const startKey = getCoordinateKey(point[0], point[1])
        if (visited.has(startKey)) continue

        const componentKeys = collectComponent(startKey, adjacency, visited)
        const componentPoints = componentKeys.map((key) => parseCoordinateKey(key))
        const centerline = buildRiverCenterline(componentKeys, adjacency)
        rivers.push({
            id: `river-${rivers.length + 1}`,
            width: 0.92,
            centerline,
            tiles: componentPoints,
        })
    }

    return rivers
}

function buildAdjacency(pointSet: Set<string>) {
    const adjacency = new Map<string, string[]>()

    for (const key of pointSet) {
        const [x, y] = parseCoordinateKey(key)
        const neighbors: string[] = []

        for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ]) {
            const neighborKey = getCoordinateKey(x + dx, y + dy)
            if (pointSet.has(neighborKey)) neighbors.push(neighborKey)
        }

        adjacency.set(key, neighbors)
    }

    return adjacency
}

function collectComponent(startKey: string, adjacency: Map<string, string[]>, visited: Set<string>) {
    const queue = [startKey]
    const component: string[] = []
    visited.add(startKey)

    while (queue.length) {
        const key = queue.shift()
        if (!key) continue

        component.push(key)

        for (const neighbor of adjacency.get(key) ?? []) {
            if (visited.has(neighbor)) continue

            visited.add(neighbor)
            queue.push(neighbor)
        }
    }

    return component
}

function buildRiverCenterline(componentKeys: string[], adjacency: Map<string, string[]>) {
    if (componentKeys.length <= 1) return componentKeys.map((key) => parseCoordinateKey(key))

    const firstKey = componentKeys[0]
    const start = findFarthestPoint(firstKey, adjacency)
    const endSearch = findFarthestPoint(start.key, adjacency)
    const path = reconstructPath(start.key, endSearch.key, adjacency)

    return path.map((key) => parseCoordinateKey(key))
}

function findFarthestPoint(startKey: string, adjacency: Map<string, string[]>) {
    const queue: string[] = [startKey]
    const distance = new Map<string, number>([[startKey, 0]])
    let farthestKey = startKey

    while (queue.length) {
        const key = queue.shift()
        if (!key) continue

        const nextDistance = (distance.get(key) ?? 0) + 1
        for (const neighbor of adjacency.get(key) ?? []) {
            if (distance.has(neighbor)) continue

            distance.set(neighbor, nextDistance)
            queue.push(neighbor)
            if ((distance.get(farthestKey) ?? 0) < nextDistance) farthestKey = neighbor
        }
    }

    return {key: farthestKey, distance}
}

function reconstructPath(startKey: string, endKey: string, adjacency: Map<string, string[]>) {
    const queue: string[] = [startKey]
    const previous = new Map<string, string | null>([[startKey, null]])

    while (queue.length) {
        const key = queue.shift()
        if (!key) continue
        if (key === endKey) break

        for (const neighbor of adjacency.get(key) ?? []) {
            if (previous.has(neighbor)) continue

            previous.set(neighbor, key)
            queue.push(neighbor)
        }
    }

    const path: string[] = []
    let current: string | null = endKey

    while (current) {
        path.push(current)
        current = previous.get(current) ?? null
    }

    return path.reverse()
}

function collectRectTiles(rect: BaseMapRect) {
    const tiles: string[] = []

    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
            tiles.push(getCoordinateKey(x, y))
        }
    }

    return tiles
}

function getCoordinateKey(x: number, y: number) {
    return `${x},${y}`
}

function parseCoordinateKey(key: string): BaseMapPoint {
    const [x, y] = key.split(',').map(Number)

    return [x, y]
}
