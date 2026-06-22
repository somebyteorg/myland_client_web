<template>
  <Teleport to="body">
    <section class="shop-modal-backdrop" aria-label="商城" @click.self="closeDialog">
      <div class="game-modal shop-modal" role="dialog" aria-modal="true"
           :aria-busy="loading || purchasingItemId !== null">
        <header class="shop-modal-header">
          <div class="shop-modal-title">
            <span class="shop-modal-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.8 8.1h10.4l-.8 10.4H7.6z"/>
                <path d="M9 8.1a3 3 0 0 1 6 0"/>
                <path d="M7.4 12h9.2"/>
              </svg>
            </span>
            <strong>商城</strong>
          </div>
          <button
              class="shop-close-button"
              type="button"
              :disabled="purchasingItemId !== null"
              aria-label="关闭商城"
              @click="closeDialog"
          >
            ×
          </button>
        </header>

        <div class="shop-body">
          <div v-if="loading" class="shop-state">正在整理货架...</div>
          <div v-else-if="errorMessage" class="shop-state is-error">
            <span>{{ errorMessage }}</span>
            <button type="button" @click="loadShopItems">重试</button>
          </div>
          <div v-else-if="products.length <= 0" class="shop-state">当前没有可购买商品</div>
          <div v-else class="shop-grid">
            <button
                v-for="product in products"
                :key="product.item_id"
                class="shop-product"
                type="button"
                :class="{ 'is-selected': selectedProduct?.item_id === product.item_id }"
                :disabled="purchasingItemId !== null || !playerId"
                :aria-label="getProductAriaLabel(product)"
                @click="selectProduct(product)"
                @focus="showProductTooltip(product, $event)"
                @blur="hideTooltip"
                @mouseenter="showProductTooltip(product, $event)"
                @mousemove="moveTooltip"
                @mouseleave="hideTooltip"
            >
              <span class="shop-product-cover">{{ getProductEmoji(product) }}</span>
              <span class="shop-product-name">{{ getProductName(product) }}</span>
              <span class="shop-product-price">
                <b>{{ formatPrice(product.carrot) }}</b>
                <span aria-hidden="true">🥕</span>
              </span>
              <i v-if="purchasingItemId === product.item_id" class="shop-product-spinner" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div v-if="selectedProduct" class="shop-purchase-panel">
          <div class="shop-purchase-summary">
            <span class="shop-selected-cover">{{ getProductEmoji(selectedProduct) }}</span>
            <div>
              <strong>{{ getProductName(selectedProduct) }}</strong>
              <small>{{ formatPrice(selectedProduct.carrot) }} 🥕 / 件</small>
            </div>
          </div>

          <label class="shop-quantity-field">
            <span>购买数量</span>
            <div class="shop-quantity-control">
              <button
                  type="button"
                  :disabled="quantity <= 1 || purchasingItemId !== null"
                  aria-label="减少数量"
                  @click="stepQuantity(-1)"
              >
                -
              </button>
              <input
                  :value="quantity"
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  inputmode="numeric"
                  @input="handleQuantityInput"
                  @change="handleQuantityInput"
              />
              <button
                  type="button"
                  :disabled="quantity >= 99 || purchasingItemId !== null"
                  aria-label="增加数量"
                  @click="stepQuantity(1)"
              >
                +
              </button>
            </div>
          </label>

          <div class="shop-purchase-total">
            <span>合计</span>
            <strong>
              {{ totalPriceLabel }}
              <span aria-hidden="true">🥕</span>
            </strong>
          </div>

          <button
              class="shop-purchase-submit"
              type="button"
              :class="{ 'is-loading': purchasingItemId !== null }"
              :disabled="!canSubmitPurchase"
              @click="purchaseSelectedProduct"
          >
            <i v-if="purchasingItemId !== null" class="button-spinner" aria-hidden="true"></i>
            <span>{{ purchasingItemId !== null ? '跳转中' : '购买' }}</span>
          </button>
        </div>

        <p v-if="purchaseErrorMessage" class="modal-error">{{ purchaseErrorMessage }}</p>
      </div>

      <GameTooltip :tooltip="tooltip" @update-element="setTooltipElement"/>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import GameTooltip from '@/components/game/GameTooltip.vue'
import {useFloatingTooltip} from '@/composables/useFloatingTooltip'
import {resolveApiErrorMessage} from '@/utils/apiErrors'
import {createMarketShopOrder, loadMarketShopItems, type MarketShopItem} from '@/game/marketShop'
import type {GameItem} from '@/game/types'

const props = defineProps<{
  itemCatalog: GameItem[]
  playerId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const {tooltip, showTooltip, moveTooltip, hideTooltip, setTooltipElement} = useFloatingTooltip()
const shopItems = ref<MarketShopItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const purchaseErrorMessage = ref('')
const purchasingItemId = ref<number | null>(null)
const selectedProduct = ref<MarketShopItem | null>(null)
const quantity = ref(1)
const itemById = computed(() => new Map(props.itemCatalog.map((item) => [item.item_id, item])))
const products = computed(() => shopItems.value.filter((item) => Number.isFinite(item.item_id)))
const totalPriceLabel = computed(() => {
  if (!selectedProduct.value || !Number.isFinite(selectedProduct.value.carrot)) return '--'

  return String(selectedProduct.value.carrot * quantity.value)
})
const canSubmitPurchase = computed(() => Boolean(
    selectedProduct.value
    && props.playerId.trim()
    && purchasingItemId.value === null,
))

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void loadShopItems()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

async function loadShopItems() {
  if (loading.value) return

  loading.value = true
  errorMessage.value = ''
  purchaseErrorMessage.value = ''

  try {
    shopItems.value = await loadMarketShopItems()
  } catch (error) {
    console.error(error)
    errorMessage.value = await resolveApiErrorMessage(error, '商城列表读取失败，请稍后再试')
    shopItems.value = []
  } finally {
    loading.value = false
  }
}

function selectProduct(product: MarketShopItem) {
  hideTooltip()
  selectedProduct.value = product
  quantity.value = 1
  purchaseErrorMessage.value = ''
}

async function purchaseSelectedProduct() {
  const product = selectedProduct.value
  const playerId = props.playerId.trim()
  if (!product || !playerId || purchasingItemId.value !== null) return

  hideTooltip()
  setQuantity(quantity.value)
  purchasingItemId.value = product.item_id
  purchaseErrorMessage.value = ''

  try {
    const data = await createMarketShopOrder(playerId, product.item_id, quantity.value)
    window.location.href = appendReturnUrl(data.pay_url)
  } catch (error) {
    console.error(error)
    purchaseErrorMessage.value = await resolveApiErrorMessage(error, '下单失败，请稍后再试')
  } finally {
    purchasingItemId.value = null
  }
}

function closeDialog() {
  if (purchasingItemId.value !== null) return

  hideTooltip()
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  event.preventDefault()
  closeDialog()
}

function handleQuantityInput(event: Event) {
  setQuantity(Number((event.target as HTMLInputElement).value))
}

function stepQuantity(delta: number) {
  setQuantity(quantity.value + delta)
}

function setQuantity(value: number) {
  const nextValue = Number.isFinite(value) ? Math.trunc(value) : 1

  quantity.value = Math.min(99, Math.max(1, nextValue))
}

function getProductItem(product: MarketShopItem) {
  return itemById.value.get(product.item_id) ?? null
}

function getProductEmoji(product: MarketShopItem) {
  return getProductItem(product)?.item_emoji?.trim() || '？'
}

function getProductName(product: MarketShopItem) {
  return getProductItem(product)?.item_name?.trim() || `商品 ${product.item_id}`
}

function getProductDescription(product: MarketShopItem) {
  return getProductItem(product)?.item_description?.trim() || '暂无商品简介'
}

function getProductAriaLabel(product: MarketShopItem) {
  return `${getProductName(product)}，${formatPrice(product.carrot)}萝卜，${getProductDescription(product)}`
}

function showProductTooltip(product: MarketShopItem, event: MouseEvent | FocusEvent) {
  showTooltip(getProductName(product), getProductDescription(product), event)
}

function formatPrice(price: number) {
  if (!Number.isFinite(price)) return '--'

  return String(price)
}

function appendReturnUrl(payUrl: string) {
  const url = new URL(payUrl, window.location.origin)
  url.searchParams.set('return_url', window.location.href)

  return url.toString()
}
</script>

<style>
.shop-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 96;
  display: grid;
  place-items: center;
  background: rgb(54 61 38 / 18%);
  backdrop-filter: blur(3px);
}

.shop-modal {
  display: flex;
  width: min(620px, calc(100vw - 32px));
  max-height: min(720px, calc(100vh - 32px));
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(255 249 232 / 98%), rgb(255 244 211 / 98%));
}

.shop-modal .shop-modal-header {
  border-bottom: 1px solid rgb(173 135 64 / 24%);
  padding-bottom: 12px;
}

.shop-modal-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.shop-modal-title strong {
  font-size: 18px;
  line-height: 1;
}

.shop-modal-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 38%);
  border-radius: 8px;
  background: linear-gradient(145deg, #fff4d4, #e7c879);
  color: #5b4828;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 46%);
}

.shop-modal-icon svg {
  width: 18px;
  height: 18px;
  fill: rgb(255 249 223 / 18%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
}

.shop-modal .shop-close-button {
  border-color: rgb(173 135 64 / 34%);
  background: rgb(255 243 207 / 88%);
}

.shop-modal .shop-close-button:hover:not(:disabled),
.shop-modal .shop-close-button:focus-visible {
  background: #dfc996;
  outline: none;
}

.shop-body {
  min-height: 0;
  overflow: auto;
  padding: 14px 4px 4px;
  scrollbar-color: rgb(173 135 64 / 46%) transparent;
}

.shop-state {
  display: grid;
  min-height: 180px;
  place-items: center;
  border: 1px dashed rgb(173 135 64 / 46%);
  border-radius: 8px;
  background: rgb(255 249 232 / 58%);
  color: #6b593c;
  font-size: 14px;
  font-weight: 800;
}

.shop-state.is-error {
  gap: 10px;
  border-color: rgb(195 107 85 / 46%);
  background: rgb(255 239 225 / 72%);
  color: #91372f;
}

.shop-state button {
  min-height: 32px;
  border: 1px solid #b99d62;
  border-radius: 8px;
  background: #fff2cc;
  padding: 0 12px;
  color: #443721;
  font-weight: 800;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}

.shop-product {
  position: relative;
  display: grid;
  min-height: 158px;
  grid-template-rows: 68px minmax(32px, auto) 28px;
  align-items: center;
  justify-items: center;
  overflow: hidden;
  border: 1px solid rgb(173 135 64 / 32%);
  border-radius: 8px;
  background: linear-gradient(180deg, rgb(255 251 239 / 96%), rgb(255 239 201 / 84%));
  padding: 14px 12px 12px;
  color: #443721;
  box-shadow: 0 8px 18px rgb(72 61 36 / 9%);
  outline: none;
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
}

.shop-product::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: transparent;
  content: '';
}

.shop-product:hover,
.shop-product:focus-visible,
.shop-product.is-selected {
  transform: translateY(-2px);
  border-color: rgb(104 124 69 / 62%);
  background: linear-gradient(180deg, rgb(255 252 241 / 100%), rgb(255 241 206 / 95%));
  box-shadow: 0 14px 26px rgb(72 61 36 / 16%);
}

.shop-product.is-selected {
  border-color: #647f43;
  box-shadow: 0 0 0 2px rgb(100 127 67 / 20%), 0 14px 26px rgb(72 61 36 / 14%);
}

.shop-product.is-selected::before {
  background: #6f8f50;
}

.shop-product:disabled {
  cursor: wait;
  opacity: 0.68;
  transform: none;
}

.shop-product-cover,
.shop-selected-cover {
  display: grid;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 32%);
  border-radius: 8px;
  background: radial-gradient(circle at 50% 32%, #fff9e7 0 36%, #f4d58a 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 58%), 0 7px 14px rgb(72 61 36 / 10%);
  line-height: 1;
}

.shop-product-cover {
  width: 60px;
  height: 60px;
  font-size: 36px;
}

.shop-selected-cover {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  font-size: 27px;
}

.shop-product-name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #3d3323;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.22;
  text-align: center;
}

.shop-product-price {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgb(201 145 57 / 38%);
  border-radius: 999px;
  background: rgb(255 232 176 / 90%);
  padding: 4px 9px;
  color: #724510;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.shop-product-price b {
  font: inherit;
}

.shop-purchase-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid rgb(173 135 64 / 38%);
  border-radius: 8px;
  background: linear-gradient(180deg, rgb(255 246 219 / 96%), rgb(246 226 176 / 82%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 46%);
  padding: 12px;
}

.shop-purchase-panel::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: #6f8f50;
  content: '';
}

.shop-purchase-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.shop-purchase-summary div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.shop-purchase-summary strong {
  overflow: hidden;
  color: #3d3323;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-purchase-summary small,
.shop-quantity-field span,
.shop-purchase-total span {
  color: #6b593c;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.shop-quantity-field {
  display: grid;
  gap: 6px;
}

.shop-quantity-control {
  display: grid;
  grid-template-columns: 28px 52px 28px;
  height: 32px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgb(72 61 36 / 8%);
}

.shop-quantity-control button,
.shop-quantity-control input,
.shop-purchase-submit {
  border: 1px solid #b99d62;
  background: #fff9ea;
  color: #443721;
  font-weight: 900;
  outline: none;
}

.shop-quantity-control button {
  display: grid;
  place-items: center;
  font-size: 17px;
  line-height: 1;
}

.shop-quantity-control button:first-child {
  border-radius: 0;
}

.shop-quantity-control button:last-child {
  border-radius: 0;
}

.shop-quantity-control button:disabled,
.shop-purchase-submit:disabled {
  cursor: wait;
  opacity: 0.58;
}

.shop-quantity-control input {
  min-width: 0;
  border-right: 0;
  border-left: 0;
  text-align: center;
}

.shop-quantity-control input:focus-visible,
.shop-quantity-control button:focus-visible,
.shop-purchase-submit:focus-visible {
  border-color: #687c45;
  box-shadow: 0 0 0 2px rgb(104 124 69 / 18%);
}

.shop-purchase-total {
  display: grid;
  gap: 6px;
  justify-items: end;
}

.shop-purchase-total strong {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6d4a18;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.shop-purchase-submit {
  display: inline-flex;
  min-width: 78px;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-color: #687c45;
  border-radius: 8px;
  background: linear-gradient(180deg, #86a45d, #6f8f50);
  padding: 0 12px;
  color: #fff9df;
  box-shadow: 0 8px 16px rgb(86 112 58 / 22%);
}

.shop-purchase-submit:hover:not(:disabled),
.shop-purchase-submit:focus-visible {
  background: linear-gradient(180deg, #90ae66, #789a56);
}

.shop-purchase-submit .button-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(255 249 223 / 42%);
  border-top-color: #fff9df;
  border-radius: 50%;
  animation: spin 720ms linear infinite;
}

.shop-product-spinner {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 15px;
  height: 15px;
  border: 2px solid rgb(127 155 89 / 24%);
  border-top-color: #6f8f50;
  border-radius: 50%;
  animation: spin 720ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .shop-modal {
    width: calc(100vw - 20px);
    max-height: calc(100vh - 20px);
  }

  .shop-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .shop-product {
    min-height: 132px;
    grid-template-rows: 50px auto 24px;
    padding: 10px 8px 9px;
  }

  .shop-product-cover {
    width: 48px;
    height: 48px;
    font-size: 30px;
  }

  .shop-purchase-panel {
    grid-template-columns: minmax(0, 1fr);
    gap: 9px;
  }

  .shop-purchase-total {
    justify-items: start;
  }

  .shop-purchase-submit {
    width: 100%;
  }
}
</style>
