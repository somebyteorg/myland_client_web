import {reactive} from 'vue'
import type {LandChunkRequest} from '@/game/landChunks'
import {createPlayerStatue} from '@/game/playerStatue'
import {PLAYER_STATUE_NAME_MAX_LENGTH} from '@/game/playerStatueConfig'
import type {MapItemResponse, Tile} from '@/game/types'
import {resolveApiErrorMessage} from '@/utils/apiErrors'
import {uploadFile} from '@/utils/uploadFile'

interface UploadedStatueImageCache {
    key: string
    url: string
}

interface UsePlayerStatueControllerOptions {
    getMapId: () => number
    getPlayerId: () => string | null | undefined
    getPlayerStatueInventoryAvailable: () => number
    canBuildPlayerStatueTile: (tile: Tile) => boolean
    hideContextMenu: () => void
    hideHomeHoverCard: () => void
    hideLandHoverCard: () => void
    focusTile: (tile: Tile, center?: boolean) => void
    refreshMapItems: (mapId: number, rect?: LandChunkRequest) => Promise<unknown>
    refreshClaimInventory: () => Promise<void>
    setPlayerStatueInventoryQuantity: (quantity: number) => void
    showToast: (message: string) => void
    showErrorToast: (message: string) => void
    requestDraw: () => void
}

export function usePlayerStatueController(options: UsePlayerStatueControllerOptions) {
    const dialog = reactive({
        visible: false,
        tile: null as Tile | null,
        submitting: false,
        errorMessage: '',
    })
    let uploadedStatueImage: UploadedStatueImageCache | null = null

    function canUseAt(tile: Tile) {
        return options.getPlayerStatueInventoryAvailable() > 0 && options.canBuildPlayerStatueTile(tile)
    }

    function openDialog(tile: Tile) {
        if (!options.canBuildPlayerStatueTile(tile)) {
            options.showErrorToast('这块草地不能建立雕像')
            return
        }
        if (options.getPlayerStatueInventoryAvailable() <= 0) {
            options.showErrorToast('没有可用雕像令')
            return
        }

        options.hideContextMenu()
        options.hideHomeHoverCard()
        options.hideLandHoverCard()
        options.focusTile(tile, false)
        dialog.tile = tile
        dialog.errorMessage = ''
        dialog.visible = true
    }

    function closeDialog() {
        if (dialog.submitting) return

        resetDialog()
    }

    function resetDialog() {
        dialog.visible = false
        dialog.tile = null
        dialog.submitting = false
        dialog.errorMessage = ''
        uploadedStatueImage = null
    }

    async function confirm(blob: Blob, statueName: string) {
        const tile = dialog.tile
        const playerId = options.getPlayerId()?.trim()
        const normalizedStatueName = statueName.trim()

        if (!tile || !playerId) {
            dialog.errorMessage = playerId ? '没有选择草地' : '缺少玩家信息'
            return
        }
        if (!normalizedStatueName) {
            dialog.errorMessage = '请输入雕像名称'
            return
        }
        if (Array.from(normalizedStatueName).length > PLAYER_STATUE_NAME_MAX_LENGTH) {
            dialog.errorMessage = `雕像名称需限制在${PLAYER_STATUE_NAME_MAX_LENGTH}字内`
            return
        }
        if (!options.canBuildPlayerStatueTile(tile)) {
            dialog.errorMessage = '这块草地不能建立雕像'
            return
        }
        if (options.getPlayerStatueInventoryAvailable() <= 0) {
            dialog.errorMessage = '没有可用雕像令'
            return
        }

        dialog.submitting = true
        dialog.errorMessage = ''

        try {
            const statueUrl = await getUploadedStatueUrl(blob)

            const mapId = options.getMapId()
            const response = await createPlayerStatue(mapId, {
                player_id: playerId,
                x: tile.x,
                y: tile.y,
                statue_name: normalizedStatueName,
                statue_url: statueUrl,
            })
            const nextCount = Number(response.count_statue)
            if (Number.isFinite(nextCount)) {
                options.setPlayerStatueInventoryQuantity(nextCount)
            } else {
                await options.refreshClaimInventory()
            }
            await options.refreshMapItems(mapId, createPlayerStatueRefreshRect(response.item_data, tile))
            resetDialog()
            options.showToast('雕像已建立')
            options.requestDraw()
        } catch (error) {
            console.error(error)
            dialog.errorMessage = await resolveApiErrorMessage(error, '建立雕像失败')
        } finally {
            dialog.submitting = false
        }
    }

    async function getUploadedStatueUrl(blob: Blob) {
        const key = await createBlobCacheKey(blob)
        if (uploadedStatueImage?.key === key) return uploadedStatueImage.url

        const uploadResult = await uploadFile(blob, {
            filename: `player-statue-${Date.now()}.jpg`,
        })
        const statueUrl = uploadResult.url?.trim()
        if (!statueUrl) throw new Error('图片上传响应缺少 url')

        uploadedStatueImage = {
            key,
            url: statueUrl,
        }

        return statueUrl
    }

    return {
        dialog,
        canUseAt,
        openDialog,
        closeDialog,
        resetDialog,
        confirm,
    }
}

async function createBlobCacheKey(blob: Blob) {
    const buffer = await blob.arrayBuffer()
    const digest = await getSha256Digest(buffer)

    return `${blob.type}:${blob.size}:${digest}`
}

async function getSha256Digest(buffer: ArrayBuffer) {
    if (globalThis.crypto?.subtle) {
        const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer)

        return Array.from(new Uint8Array(digestBuffer), toHexByte).join('')
    }

    const bytes = new Uint8Array(buffer)
    let hash = 2166136261
    for (const byte of bytes) {
        hash ^= byte
        hash = Math.imul(hash, 16777619)
    }

    return hash.toString(16)
}

function toHexByte(byte: number) {
    return byte.toString(16).padStart(2, '0')
}

function createPlayerStatueRefreshRect(item: MapItemResponse | null | undefined, tile: Tile): LandChunkRequest {
    if (item && item.width > 0 && item.height > 0) {
        return {
            x: item.x,
            y: item.y,
            w: item.width,
            h: item.height,
        }
    }

    return {
        x: tile.x,
        y: tile.y,
        w: 1,
        h: 1,
    }
}
