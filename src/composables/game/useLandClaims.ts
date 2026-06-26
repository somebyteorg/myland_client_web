import {computed, reactive, ref, watch} from 'vue'
import type {ComputedRef} from 'vue'
import api from '@/utils/ky'
import {resolveApiError} from '@/utils/apiErrors'
import {
    ITEM_ID_CURRENCY_FIBER,
    ITEM_ID_CURRENCY_GRAIN,
    ITEM_ID_CURRENCY_HERB,
    ITEM_ID_CURRENCY_IRON,
    ITEM_ID_CURRENCY_QUARRY,
    ITEM_ID_CURRENCY_STONE,
    ITEM_ID_CURRENCY_WOOD,
    ITEM_ID_PROP_LAND_DEED,
    ITEM_ID_PROP_LAND_GRANT,
    ITEM_ID_PROP_PLAYER_STATUE,
    ITEM_ID_TOOL_HAMMER,
} from '@/constants'
import {
    ITEM_TYPE_CURRENCY,
    ITEM_TYPE_GRAIN_SEED,
    ITEM_TYPE_PROP,
    ITEM_TYPE_TOOL,
} from '@/game/itemCatalogData'
import type {GameItem, ItemInventoryEntry, ItemInventoryListResponse} from '@/game/types'

export type LandPlacementMode = 'pioneer' | 'deed'

interface UseLandClaimsOptions {
    mapReady: ComputedRef<boolean>
    hasOwnHomeOnCurrentMap: ComputedRef<boolean>
    getPlayerId: () => string | null | undefined
    getSeedItemIds: () => number[]
    onPlacementUiChange: (enabled: boolean) => void
    onError: (message: string) => void
}

const currencyInventoryEntries = [
    [ITEM_ID_CURRENCY_GRAIN, 'grainCurrency'],
    [ITEM_ID_CURRENCY_STONE, 'stoneCurrency'],
    [ITEM_ID_CURRENCY_WOOD, 'woodCurrency'],
    [ITEM_ID_CURRENCY_QUARRY, 'quarryCurrency'],
    [ITEM_ID_CURRENCY_IRON, 'ironCurrency'],
    [ITEM_ID_CURRENCY_HERB, 'herbCurrency'],
    [ITEM_ID_CURRENCY_FIBER, 'fiberCurrency'],
] as const

const claimInventoryItemTypes = [
    ITEM_TYPE_CURRENCY,
    ITEM_TYPE_GRAIN_SEED,
    ITEM_TYPE_PROP,
    ITEM_TYPE_TOOL,
] as const

export function useLandClaims(options: UseLandClaimsOptions) {
    const pioneerGuideDialog = reactive({
        visible: false,
    })
    const pioneerGuideDismissed = ref(false)
    const claimInventory = reactive({
        pioneerToken: 0,
        landDeed: 0,
        playerStatueToken: 0,
        grainCurrency: 0,
        stoneCurrency: 0,
        woodCurrency: 0,
        quarryCurrency: 0,
        ironCurrency: 0,
        herbCurrency: 0,
        fiberCurrency: 0,
        hammerTool: 0,
    })
    const seedInventory = reactive<Record<number, number>>({})
    const claimItemInfo = reactive({
        pioneerToken: {
            name: '开拓令',
            description: '',
        },
        landDeed: {
            name: '地契',
            description: '',
        },
        playerStatueToken: {
            name: '雕像令',
            description: '',
        },
    })
    const claimInventoryLoading = ref(false)
    const claimSubmitting = ref(false)
    const claimMessage = ref('')
    const claimMessageTone = ref<'info' | 'error'>('info')
    const pioneerPlacementActive = ref(false)
    const deedPlacementActive = ref(false)

    const claimMode = computed(() => options.mapReady.value && !options.hasOwnHomeOnCurrentMap.value)
    const landPlacementMode = computed<LandPlacementMode | null>(() => pioneerPlacementActive.value ? 'pioneer' : deedPlacementActive.value ? 'deed' : null)
    const claimTokensAvailable = computed(() => Math.max(0, claimInventory.pioneerToken))
    const deedInventoryAvailable = computed(() => Math.max(0, claimInventory.landDeed))
    const playerStatueInventoryAvailable = computed(() => Math.max(0, claimInventory.playerStatueToken))
    const canSubmitClaim = computed(() => {
        if (!landPlacementMode.value || claimSubmitting.value) return false

        return landPlacementMode.value === 'pioneer' ? claimTokensAvailable.value > 0 : deedInventoryAvailable.value > 0
    })
    const showPioneerPlacementToggle = computed(() => claimMode.value && claimInventory.pioneerToken > 0)

    watch(claimMode, (enabled) => {
        if (enabled) {
            deedPlacementActive.value = false
        } else {
            pioneerPlacementActive.value = false
            pioneerGuideDialog.visible = false
        }
    })

    watch(deedInventoryAvailable, (quantity) => {
        if (quantity > 0 || !deedPlacementActive.value || claimSubmitting.value) return

        deedPlacementActive.value = false
        options.onPlacementUiChange(false)
    })

    watch(claimTokensAvailable, (quantity) => {
        if (quantity > 0 || !pioneerPlacementActive.value || claimSubmitting.value) return

        pioneerPlacementActive.value = false
        options.onPlacementUiChange(false)
    })

    watch(landPlacementMode, (mode, previousMode) => {
        if (mode) {
            options.onPlacementUiChange(true)
            return
        }

        if (previousMode) options.onPlacementUiChange(false)
    })

    watch(
        () => claimMode.value && claimTokensAvailable.value > 0,
        (shouldPrompt) => {
            if (!shouldPrompt || pioneerGuideDismissed.value || pioneerPlacementActive.value) return

            pioneerGuideDialog.visible = true
        },
    )

    function resetForPlayerChange() {
        claimInventory.pioneerToken = 0
        claimInventory.landDeed = 0
        claimInventory.playerStatueToken = 0
        claimInventory.hammerTool = 0
        resetCurrencyInventory()
        resetSeedInventory()
        claimInventoryLoading.value = false
        claimMessage.value = ''
        pioneerPlacementActive.value = false
        deedPlacementActive.value = false
        pioneerGuideDialog.visible = false
        pioneerGuideDismissed.value = false
    }

    function togglePioneerPlacementMode() {
        if (!claimMode.value || claimInventory.pioneerToken <= 0) return

        pioneerGuideDismissed.value = true
        pioneerGuideDialog.visible = false
        pioneerPlacementActive.value = !pioneerPlacementActive.value
        if (pioneerPlacementActive.value) deedPlacementActive.value = false
    }

    function toggleDeedPlacementMode() {
        if (!options.hasOwnHomeOnCurrentMap.value || claimInventory.landDeed <= 0) return

        pioneerPlacementActive.value = false
        deedPlacementActive.value = !deedPlacementActive.value
    }

    function enterPioneerPlacementMode() {
        if (!claimMode.value || claimInventory.pioneerToken <= 0) return

        pioneerGuideDismissed.value = true
        pioneerGuideDialog.visible = false
        pioneerPlacementActive.value = true
        deedPlacementActive.value = false
    }

    function closePioneerGuideDialog() {
        pioneerGuideDismissed.value = true
        pioneerGuideDialog.visible = false
    }

    function completePioneerClaim() {
        pioneerPlacementActive.value = false
        pioneerGuideDialog.visible = false
        pioneerGuideDismissed.value = true
    }

    function updateClaimItemInfo(items: GameItem[]) {
        const pioneerToken = items.find((item) => item.item_id === ITEM_ID_PROP_LAND_GRANT)
        const landDeed = items.find((item) => item.item_id === ITEM_ID_PROP_LAND_DEED)
        const playerStatueToken = items.find((item) => item.item_id === ITEM_ID_PROP_PLAYER_STATUE)

        if (pioneerToken) {
            claimItemInfo.pioneerToken.name = pioneerToken.item_name || '开拓令'
            claimItemInfo.pioneerToken.description = pioneerToken.item_description || ''
        }
        if (landDeed) {
            claimItemInfo.landDeed.name = landDeed.item_name || '地契'
            claimItemInfo.landDeed.description = landDeed.item_description || ''
        }
        if (playerStatueToken) {
            claimItemInfo.playerStatueToken.name = playerStatueToken.item_name || '雕像令'
            claimItemInfo.playerStatueToken.description = playerStatueToken.item_description || ''
        }
    }

    async function refreshClaimInventory() {
        const playerId = options.getPlayerId()
        const seedItemIds = getTrackedSeedItemIds()
        if (!playerId) {
            claimInventory.pioneerToken = 0
            claimInventory.landDeed = 0
            claimInventory.playerStatueToken = 0
            claimInventory.hammerTool = 0
            resetCurrencyInventory()
            resetSeedInventory()
            return
        }

        claimInventory.pioneerToken = 0
        claimInventory.landDeed = 0
        claimInventory.playerStatueToken = 0
        claimInventory.hammerTool = 0
        resetCurrencyInventory()
        resetSeedInventory(seedItemIds)

        claimInventoryLoading.value = true

        try {
            const data = await api.get('api/item/inventory', {
                searchParams: [
                    ['player_id', playerId],
                    ['page_size', '1000'],
                    ...claimInventoryItemTypes.map((itemType) => ['item_types[]', itemType]),
                ],
            }).json<ItemInventoryListResponse>()
            const inventoryItems = data.items ?? []

            claimInventory.pioneerToken = options.mapReady.value && !options.hasOwnHomeOnCurrentMap.value
                ? getInventoryQuantity(inventoryItems, ITEM_ID_PROP_LAND_GRANT)
                : 0
            claimInventory.landDeed = options.mapReady.value && options.hasOwnHomeOnCurrentMap.value
                ? getInventoryQuantity(inventoryItems, ITEM_ID_PROP_LAND_DEED)
                : 0
            claimInventory.playerStatueToken = getInventoryQuantity(inventoryItems, ITEM_ID_PROP_PLAYER_STATUE)
            claimInventory.hammerTool = getInventoryQuantity(inventoryItems, ITEM_ID_TOOL_HAMMER)
            for (const [itemId, key] of currencyInventoryEntries) {
                claimInventory[key] = getInventoryQuantity(inventoryItems, itemId)
            }
            for (const itemId of seedItemIds) {
                seedInventory[itemId] = getInventoryQuantity(inventoryItems, itemId)
            }
            claimMessageTone.value = 'info'
            if (claimMessage.value === '道具读取失败，请稍后再试') claimMessage.value = ''
        } catch (error) {
            console.error(error)
            claimInventory.pioneerToken = 0
            claimInventory.landDeed = 0
            claimInventory.playerStatueToken = 0
            claimInventory.hammerTool = 0
            resetCurrencyInventory()
            resetSeedInventory(seedItemIds)
            claimMessageTone.value = 'error'
            claimMessage.value = '道具读取失败，请稍后再试'
            const apiError = await resolveApiError(error, claimMessage.value)
            if (apiError.isValidationError) options.onError(apiError.message)
        } finally {
            claimInventoryLoading.value = false
        }
    }

    function getTrackedSeedItemIds() {
        return Array.from(new Set(
            options.getSeedItemIds()
                .map((itemId) => Number(itemId))
                .filter((itemId) => Number.isFinite(itemId) && itemId > 0),
        ))
    }

    function resetSeedInventory(seedItemIds: number[] = []) {
        const nextItemIds = new Set(seedItemIds)

        for (const key of Object.keys(seedInventory)) {
            const itemId = Number(key)
            if (!nextItemIds.has(itemId)) {
                delete seedInventory[itemId]
                continue
            }

            seedInventory[itemId] = 0
        }

        for (const itemId of seedItemIds) {
            seedInventory[itemId] = 0
        }
    }

    function setSeedInventoryQuantity(itemId: number, quantity: number) {
        seedInventory[itemId] = Math.max(0, Number(quantity) || 0)
    }

    function setPlayerStatueInventoryQuantity(quantity: number) {
        claimInventory.playerStatueToken = Math.max(0, Number(quantity) || 0)
    }

    function addCurrencyQuantity(itemId: number, quantity: number) {
        const nextQuantity = Math.max(0, Number(quantity) || 0)
        const entry = currencyInventoryEntries.find(([currencyItemId]) => currencyItemId === itemId)

        if (!entry) return

        claimInventory[entry[1]] += nextQuantity
    }

    function resetCurrencyInventory() {
        for (const [, key] of currencyInventoryEntries) {
            claimInventory[key] = 0
        }
    }

    function getInventoryQuantity(items: ItemInventoryEntry[], itemId: number) {
        return items
            .filter((item) => item.item_id === itemId)
            .reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0)
    }

    return {
        pioneerGuideDialog,
        claimInventory,
        seedInventory,
        claimItemInfo,
        claimInventoryLoading,
        claimSubmitting,
        claimMessage,
        claimMessageTone,
        pioneerPlacementActive,
        deedPlacementActive,
        claimMode,
        landPlacementMode,
        claimTokensAvailable,
        deedInventoryAvailable,
        playerStatueInventoryAvailable,
        canSubmitClaim,
        showPioneerPlacementToggle,
        resetForPlayerChange,
        togglePioneerPlacementMode,
        toggleDeedPlacementMode,
        enterPioneerPlacementMode,
        closePioneerGuideDialog,
        completePioneerClaim,
        updateClaimItemInfo,
        setSeedInventoryQuantity,
        setPlayerStatueInventoryQuantity,
        addCurrencyQuantity,
        refreshClaimInventory,
    }
}
