<template>
  <section
      ref="cardRef"
      class="top-player-card"
      :class="{ 'has-chronicle-open': showChronicle, 'has-shop-open': showShop }"
      :aria-busy="loading"
  >
    <div class="player-card-actions">
      <button
          class="player-card-action-button player-shop-toggle"
          type="button"
          :class="{ 'is-active': showShop }"
          :aria-expanded="showShop"
          aria-label="打开商城"
          :disabled="!playerId"
          @click="toggleShop"
          @focus="showShopTooltip"
          @blur="hideTooltip"
          @mouseenter="showShopTooltip"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.8 8.1h10.4l-.8 10.4H7.6z"/>
          <path d="M9 8.1a3 3 0 0 1 6 0"/>
          <path d="M7.4 12h9.2"/>
          <path d="M10.1 15.1h3.8"/>
        </svg>
      </button>
      <button
          class="player-card-action-button player-chronicle-toggle"
          type="button"
          :class="{ 'is-active': showChronicle }"
          :aria-expanded="showChronicle"
          aria-label="查看编年史"
          :disabled="!playerId"
          @click="toggleChronicle"
          @focus="showChronicleTooltip"
          @blur="hideTooltip"
          @mouseenter="showChronicleTooltip"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5h10a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/>
          <path d="M7 4.5v15"/>
          <path d="M9.8 8.4h5.8"/>
          <path d="M9.8 11.8h5.8"/>
          <path d="M9.8 15.2h3.8"/>
        </svg>
      </button>
    </div>

    <div class="player-avatar">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="`${displayName}头像`"/>
      <span v-else>{{ avatarInitial }}</span>
      <b
          v-if="showLandBadge"
          class="player-land-badge"
          :aria-label="`拥有地块 ${landCountLabel}`"
          tabindex="0"
          @focus="showLandTooltip"
          @blur="hideTooltip"
          @mouseenter="showLandTooltip"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
      >
        {{ landCountLabel }}
      </b>
    </div>

    <div class="player-card-body">
      <div class="player-title">
        <strong>{{ displayName }}</strong>
        <small>{{ genderLabel }} · {{ ageLabel }}</small>
      </div>

      <div class="player-stats">
        <div class="player-stats-primary">
          <span
              v-for="stat in primaryPlayerStats"
              :key="stat.key"
              class="player-stat player-stat-primary"
              :class="`is-${stat.key}`"
              :aria-label="`${stat.label} ${stat.value}`"
              tabindex="0"
              @focus="showStatTooltip(stat.label, $event)"
              @blur="hideTooltip"
              @mouseenter="showStatTooltip(stat.label, $event)"
              @mousemove="moveTooltip"
              @mouseleave="hideTooltip"
          >
            <span class="player-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path v-for="path in stat.iconPaths" :key="path" :d="path"/>
              </svg>
            </span>
            <span class="player-stat-label">{{ stat.label }}</span>
            <b class="player-stat-value">{{ stat.value }}</b>
          </span>
        </div>
        <div
            v-if="secondaryCurrencyStats.length > 0"
            class="player-stats-secondary"
        >
          <span
              v-for="stat in secondaryCurrencyStats"
              :key="stat.key"
              class="player-stat player-stat-secondary"
              :class="`is-${stat.key}`"
              :aria-label="`${stat.label} ${stat.value}`"
              tabindex="0"
              @focus="showStatTooltip(stat.label, $event)"
              @blur="hideTooltip"
              @mouseenter="showStatTooltip(stat.label, $event)"
              @mousemove="moveTooltip"
              @mouseleave="hideTooltip"
          >
            <span class="player-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path v-for="path in stat.iconPaths" :key="path" :d="path"/>
              </svg>
            </span>
            <b class="player-stat-value">{{ stat.value }}</b>
          </span>
        </div>
      </div>
      <div v-if="claimMode" class="player-claim-items" :aria-busy="claimLoading">
        <button
            v-if="showPioneerToken"
            class="claim-item-button pioneer-token-button"
            type="button"
            :class="{ 'is-active': landPlacementMode === 'pioneer' }"
            :aria-label="pioneerAriaLabel"
            :disabled="claimLoading"
            @click="handleUsePioneer"
            @focus="showPioneerTooltip"
            @blur="hideTooltip"
            @mouseenter="showPioneerTooltip"
            @mousemove="moveTooltip"
            @mouseleave="hideTooltip"
        >
          <svg class="claim-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 20V5.5"/>
            <path d="M8 5.5h9l-2.2 3 2.2 3H8z"/>
            <path d="M5.5 20h5"/>
          </svg>
          <span>{{ tokenLabel }}</span>
        </button>
        <button
            v-if="showLandDeed"
            class="claim-item-button deed-token-button"
            type="button"
            :class="{ 'is-active': landPlacementMode === 'deed' }"
            :aria-label="deedAriaLabel"
            :disabled="claimLoading"
            @click="handleUseDeed"
            @focus="showDeedTooltip"
            @blur="hideTooltip"
            @mouseenter="showDeedTooltip"
            @mousemove="moveTooltip"
            @mouseleave="hideTooltip"
        >
          <svg class="claim-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3.5h7l3 3V20H7z"/>
            <path d="M14 3.5v3h3"/>
            <path d="M10 11h4"/>
            <path d="M10 14h5"/>
            <path d="M15.8 17.2l1.2 2 1.2-2"/>
            <circle cx="17" cy="16" r="1.8"/>
          </svg>
          <span>{{ deedLabel }}</span>
        </button>
        <button
            v-if="showPlayerStatueToken"
            class="claim-item-button statue-token-button"
            type="button"
            :aria-label="statueAriaLabel"
            @focus="showStatueTooltip"
            @blur="hideTooltip"
            @mouseenter="showStatueTooltip"
            @mousemove="moveTooltip"
            @mouseleave="hideTooltip"
        >
          <svg class="claim-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 20h10"/>
            <path d="M9 20v-3.6h6V20"/>
            <path d="M9.2 16.4h5.6l1.2-8.2H8z"/>
            <path d="M10.5 8.2 12 4.5l1.5 3.7"/>
            <path d="M10.4 11.8h3.2"/>
            <path d="M10.8 14h2.4"/>
          </svg>
          <span>{{ statueLabel }}</span>
        </button>
      </div>
    </div>

    <PlayerChroniclePanel
        v-if="showChronicle && playerId"
        :player-id="playerId"
        @close="showChronicle = false"
        @locate="$emit('locateChronicleTile', $event)"
    />

    <GameShopDialog
        v-if="showShop && playerId"
        :item-catalog="itemCatalog"
        :player-id="playerId"
        @close="showShop = false"
    />

    <GameTooltip :tooltip="tooltip" @update-element="setTooltipElement"/>

    <div
        class="player-stamina-track"
        role="meter"
        aria-label="精力"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="staminaValue"
    >
      <i :style="{ width: `${staminaPercent}%` }"></i>
    </div>
  </section>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import GameShopDialog from '@/components/game/GameShopDialog.vue'
import GameTooltip from '@/components/game/GameTooltip.vue'
import PlayerChroniclePanel from '@/components/game/PlayerChroniclePanel.vue'
import {useFloatingTooltip} from '@/composables/useFloatingTooltip'
import type {PlayerChronicleLocation, PlayerInfo} from '@/game/homeTypes'
import type {GameItem} from '@/game/types'

const props = defineProps<{
  claimItemInfo: {
    pioneerToken: {
      name: string
      description: string
    }
    landDeed: {
      name: string
      description: string
    }
    playerStatueToken: {
      name: string
      description: string
    }
  }
  claimInventory: {
    pioneerToken: number
    landDeed: number
    playerStatueToken: number
    grainCurrency: number
    stoneCurrency: number
    woodCurrency: number
    quarryCurrency: number
    ironCurrency: number
    herbCurrency: number
    fiberCurrency: number
  }
  claimLoading: boolean
  claimMode: boolean
  itemCatalog: GameItem[]
  landPlacementMode: 'pioneer' | 'deed' | null
  player: PlayerInfo | null
  loading: boolean
}>()

const emit = defineEmits<{
  locateChronicleTile: [location: PlayerChronicleLocation]
  resize: [height: number]
  useDeed: []
  usePioneer: []
}>()

const {tooltip, showTooltip, moveTooltip, hideTooltip, setTooltipElement} = useFloatingTooltip()
const cardRef = ref<HTMLElement | null>(null)
const showChronicle = ref(false)
const showShop = ref(false)
let cardResizeObserver: ResizeObserver | null = null
let lastCardHeight = 0

const statIconPaths = {
  reputation: [
    'M12 5.1 14.6 7.3 17.9 7.8 16.4 10.6 16.9 13.8 12 11.8 7.1 13.8 7.6 10.6 6.1 7.8 9.4 7.3Z',
    'M9.1 12.3 7.8 19l4.2-2.3 4.2 2.3-1.3-6.7',
    'M12 6.7 12.8 8.1 14.4 8.4 13.3 9.5 13.5 11.1 12 10.4 10.5 11.1 10.7 9.5 9.6 8.4 11.2 8.1Z',
  ],
  stone: [
    'M12 4.7 16.9 7.5 18.1 11.9 12 19.3 5.9 11.9 7.1 7.5Z',
    'M7.1 7.5h9.8',
    'M12 4.7 9.5 7.5 12 19.3 14.5 7.5Z',
    'M9.5 7.5 8.1 11.9h7.8l-1.4-4.4',
  ],
  grain: [
    'M12 4.4v15.2',
    'M12 7c-1.9.2-3.5 1.2-4.7 3',
    'M12 9.1c-2 .2-3.6 1.3-4.8 3.1',
    'M12 11.4c-1.6.2-2.9 1-3.8 2.4',
    'M12 7c1.9.2 3.5 1.2 4.7 3',
    'M12 9.1c2 .2 3.6 1.3 4.8 3.1',
    'M12 11.4c1.6.2 2.9 1 3.8 2.4',
    'M9.5 17.2h5',
  ],
  wood: [
    'M6.7 15.3h8.9a3 3 0 0 0 0-6H6.7a3 3 0 0 0 0 6Z',
    'M8.1 9.3a3 3 0 0 1 0 6',
    'M5.7 12.3h8.8',
    'M16.8 8.1 19 5.9',
    'M17.6 10.2l3-1.2',
  ],
  quarry: [
    'M7 18.2 4.7 13l3.4-4.2 5.2 1.3 1.5 5.8-3.5 2.3Z',
    'M13.3 10.1 16.2 6l4.1 3.4-.9 5.1-4.6 1.4',
    'M8.1 8.8 10.4 13l-3.4 5.2',
    'M16.2 6l-.7 5.3 3.9 3.2',
  ],
  iron: [
    'M8.2 18.5 4.9 12.3 8.4 5.6h7.2l3.5 6.7-3.3 6.2Z',
    'M8.4 5.6 12 12.3l3.6-6.7',
    'M4.9 12.3H12l3.8 6.2',
    'M12 12.3l7.1.1',
  ],
  herb: [
    'M11.8 18.8c.2-5.5 2.4-9.5 6.8-12.1',
    'M13.8 11.4c-.2-3.5 1.5-5.7 5.1-6.6.4 3.4-1.3 5.6-5.1 6.6Z',
    'M10.4 14.3c-3.2.2-5.3-1.3-6.3-4.5 3.2-.4 5.3 1.1 6.3 4.5Z',
    'M11.3 16c-2.5.7-4.3.1-5.4-1.9',
  ],
  fiber: [
    'M8.3 5.3c2.2 3.2 2.2 5.7 0 8.9-1.5 2.2-1.4 3.7.3 4.5',
    'M12 4.8c1.8 3 1.7 5.7-.2 8.2-1.6 2.1-1.4 3.9.6 5.4',
    'M15.6 5.3c-1.3 3.2-1.1 5.7.8 7.7 1.9 2 1.7 3.8-.5 5.4',
    'M6.7 15.3c3.8.9 7.4.9 10.8 0',
  ],
} as const

type PlayerStatKey = keyof typeof statIconPaths

interface PlayerStat {
  key: PlayerStatKey
  label: string
  value: string
  iconPaths: readonly string[]
}

const displayName = computed(() => {
  if (props.loading && !props.player) return '加载中'

  return formatText(props.player?.name, '未命名')
})

const genderLabel = computed(() => formatText(props.player?.gender_string, '未知'))
const ageLabel = computed(() => `${formatValue(props.player?.tick_age_string ?? props.player?.tick_age)}岁`)
const reputationLabel = computed(() => formatValue(props.player?.reputation))
const grainLabel = computed(() => props.claimLoading ? '--' : formatValue(props.claimInventory.grainCurrency))
const stoneLabel = computed(() => props.claimLoading ? '--' : formatValue(props.claimInventory.stoneCurrency))
const primaryPlayerStats = computed<PlayerStat[]>(() => [
  createPlayerStat('reputation', '声望', reputationLabel.value),
  createPlayerStat('stone', '灵石', stoneLabel.value),
  createPlayerStat('grain', '粮食', grainLabel.value),
])
const secondaryCurrencyStats = computed<PlayerStat[]>(() => {
  const secondaryCurrencies = [
    ['wood', '木材', props.claimInventory.woodCurrency],
    ['quarry', '石头', props.claimInventory.quarryCurrency],
    ['iron', '矿石', props.claimInventory.ironCurrency],
    ['herb', '药材', props.claimInventory.herbCurrency],
    ['fiber', '纤维', props.claimInventory.fiberCurrency],
  ] as const

  const stats: PlayerStat[] = []

  for (const [key, label, quantity] of secondaryCurrencies) {
    if (getPositiveQuantity(quantity) <= 0) continue

    stats.push(createPlayerStat(key, label, props.claimLoading ? '--' : formatValue(quantity)))
  }

  return stats
})
const staminaValue = computed(() => clampStat(props.player?.stamina))
const staminaPercent = computed(() => staminaValue.value)
const landCountLabel = computed(() => formatValue(props.player?.count_land))
const showLandBadge = computed(() => Math.max(0, Number(props.player?.count_land) || 0) > 0)
const tokenLabel = computed(() => props.claimLoading ? '--' : formatValue(props.claimInventory.pioneerToken))
const deedLabel = computed(() => props.claimLoading ? '--' : formatValue(props.claimInventory.landDeed))
const statueLabel = computed(() => props.claimLoading ? '--' : formatValue(props.claimInventory.playerStatueToken))
const showPioneerToken = computed(() => props.claimInventory.pioneerToken > 0)
const showLandDeed = computed(() => props.claimInventory.landDeed > 0)
const showPlayerStatueToken = computed(() => props.claimInventory.playerStatueToken > 0)
const pioneerName = computed(() => props.claimItemInfo.pioneerToken.name || '开拓令')
const deedName = computed(() => props.claimItemInfo.landDeed.name || '地契')
const statueName = computed(() => props.claimItemInfo.playerStatueToken.name || '雕像令')
const pioneerDescription = computed(() => props.claimItemInfo.pioneerToken.description.trim() || '暂无道具简介')
const deedDescription = computed(() => props.claimItemInfo.landDeed.description.trim() || '暂无道具简介')
const statueDescription = computed(() => props.claimItemInfo.playerStatueToken.description.trim() || '暂无道具简介')
const pioneerAriaLabel = computed(() => formatItemAriaLabel(pioneerName.value, pioneerDescription.value))
const deedAriaLabel = computed(() => formatItemAriaLabel(deedName.value, deedDescription.value))
const statueAriaLabel = computed(() => formatItemAriaLabel(statueName.value, statueDescription.value))
const avatarInitial = computed(() => displayName.value.slice(0, 1))
const playerId = computed(() => props.player?.player_id?.trim() ?? '')
const avatarUrl = computed(() => {
  const avatar = props.player?.avatar?.trim()

  return avatar || ''
})

watch(playerId, () => {
  showChronicle.value = false
  showShop.value = false
})

onMounted(() => {
  emitCardHeight()
  if (!cardRef.value || typeof ResizeObserver === 'undefined') return

  cardResizeObserver = new ResizeObserver(() => {
    emitCardHeight()
  })
  cardResizeObserver.observe(cardRef.value)
})

onBeforeUnmount(() => {
  cardResizeObserver?.disconnect()
})

function formatText(value: string | null | undefined, fallback: string) {
  const text = value?.trim()

  return text ? text : fallback
}

function formatValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '--'

  return String(value)
}

function createPlayerStat(key: PlayerStatKey, label: string, value: string): PlayerStat {
  return {
    key,
    label,
    value,
    iconPaths: statIconPaths[key],
  }
}

function getPositiveQuantity(value: number | null | undefined) {
  return Math.max(0, Number(value) || 0)
}

function formatItemAriaLabel(name: string, description: string) {
  return `${name}，${description}`
}

function handleUsePioneer() {
  hideTooltip()
  emit('usePioneer')
}

function handleUseDeed() {
  hideTooltip()
  emit('useDeed')
}

function toggleChronicle() {
  hideTooltip()
  showShop.value = false
  showChronicle.value = !showChronicle.value
}

function toggleShop() {
  hideTooltip()
  showChronicle.value = false
  showShop.value = !showShop.value
}

function showPioneerTooltip(event: MouseEvent | FocusEvent) {
  showTooltip(pioneerName.value, pioneerDescription.value, event)
}

function showDeedTooltip(event: MouseEvent | FocusEvent) {
  showTooltip(deedName.value, deedDescription.value, event)
}

function showStatueTooltip(event: MouseEvent | FocusEvent) {
  showTooltip(statueName.value, statueDescription.value, event)
}

function showLandTooltip(event: MouseEvent | FocusEvent) {
  showTooltip('拥有地块', `当前共拥有 ${landCountLabel.value} 块土地`, event)
}

function showStatTooltip(name: string, event: MouseEvent | FocusEvent) {
  showTooltip(name, '', event)
}

function showChronicleTooltip(event: MouseEvent | FocusEvent) {
  showTooltip('编年史', '', event)
}

function showShopTooltip(event: MouseEvent | FocusEvent) {
  showTooltip('商城', '', event)
}

function clampStat(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0

  return Math.min(100, Math.max(0, Number(value)))
}

function emitCardHeight() {
  const height = Math.ceil(cardRef.value?.getBoundingClientRect().height ?? 0)
  if (height <= 0 || height === lastCardHeight) return

  lastCardHeight = height
  emit('resize', height)
}
</script>

<style>
.top-player-card {
  position: absolute;
  top: 18px;
  z-index: 26;
  left: 18px;
  display: flex;
  box-sizing: border-box;
  width: var(--game-left-panel-width, min(370px, calc(100vw - 36px)));
  min-height: 76px;
  align-items: center;
  gap: 12px;
  overflow: visible;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 86%);
  box-shadow: 0 14px 32px rgb(72 61 36 / 16%);
  padding: 12px;
  backdrop-filter: blur(12px);
}

.top-player-card:hover,
.top-player-card:focus-within,
.top-player-card.has-chronicle-open,
.top-player-card.has-shop-open {
  z-index: 88;
}

.top-player-card.has-shop-open {
  z-index: 96;
}

.player-avatar {
  position: relative;
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #ad8740;
  border-radius: 50%;
  background: linear-gradient(145deg, #ffe593, #c59243);
  color: #4a3512;
  font-size: 20px;
  font-weight: 900;
}

.player-avatar img,
.player-avatar > span {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 50%;
}

.player-avatar img {
  object-fit: cover;
}

.player-avatar > span {
  display: grid;
  place-items: center;
}

.player-land-badge {
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border: 2px solid #fff7df;
  border-radius: 50%;
  background: #5f7d43;
  color: #fffbe9;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 3px 8px rgb(72 61 36 / 24%);
}

.player-card-body {
  min-width: 0;
  flex: 1;
}

.player-card-actions {
  position: absolute;
  right: 8px;
  top: 8px;
  display: flex;
  gap: 6px;
}

.player-card-action-button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 42%);
  border-radius: 8px;
  background: rgb(255 249 232 / 88%);
  color: #5b4828;
  box-shadow: 0 4px 10px rgb(72 61 36 / 10%);
}

.player-card-action-button:hover,
.player-card-action-button:focus-visible {
  border-color: rgb(104 124 69 / 58%);
  background: rgb(240 226 180 / 95%);
  outline: none;
}

.player-card-action-button.is-active {
  border-color: #647f43;
  background: #6f8f50;
  color: #fff9df;
}

.player-card-action-button:disabled {
  cursor: wait;
  opacity: 0.48;
}

.player-card-action-button svg {
  width: 17px;
  height: 17px;
  fill: rgb(255 249 223 / 16%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.player-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  box-sizing: border-box;
  padding-right: 68px;
  line-height: 1;
}

.player-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  line-height: 1;
}

.player-title small {
  flex: 0 0 auto;
  color: #806b48;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.player-stats {
  display: grid;
  gap: 7px;
  margin-top: 7px;
}

.player-stats-primary {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
}

.player-stats-secondary {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  padding-top: 1px;
  padding-bottom: 4px;
}

.player-stat {
  --stat-bg: rgb(255 242 204 / 68%);
  --stat-border: rgb(173 135 64 / 34%);
  --stat-color: #5b4828;
  --stat-icon-bg: rgb(255 249 232 / 92%);

  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  border: 1px solid var(--stat-border);
  border-radius: 999px;
  background: var(--stat-bg);
  color: var(--stat-color);
  font-size: 11px;
  font-weight: 900;
  line-height: 1.1;
  outline: none;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 54%);
}

.player-stat:hover,
.player-stat:focus-visible {
  border-color: rgb(104 124 69 / 58%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 54%),
  0 0 0 2px rgb(104 124 69 / 14%);
}

.player-stat-primary {
  flex: 0 1 auto;
  min-width: 0;
  min-height: 26px;
  justify-content: center;
  gap: 4px;
  padding: 3px 7px 3px 4px;
}

.player-stat-secondary {
  flex: 0 1 auto;
  min-width: 0;
  min-height: 22px;
  justify-content: center;
  gap: 4px;
  padding: 2px 7px 2px 3px;
  font-size: 10px;
}

.player-stat.is-reputation {
  --stat-bg: rgb(255 239 178 / 72%);
  --stat-border: rgb(184 130 42 / 42%);
  --stat-color: #6a4a12;
  --stat-icon-bg: rgb(255 248 225 / 94%);
}

.player-stat.is-stone {
  --stat-bg: rgb(225 238 255 / 76%);
  --stat-border: rgb(80 118 160 / 34%);
  --stat-color: #315d85;
  --stat-icon-bg: rgb(243 248 255 / 94%);
}

.player-stat.is-grain {
  --stat-bg: rgb(234 242 190 / 76%);
  --stat-border: rgb(113 138 55 / 34%);
  --stat-color: #546d23;
  --stat-icon-bg: rgb(249 252 231 / 94%);
}

.player-stat.is-wood {
  --stat-bg: rgb(236 223 202 / 76%);
  --stat-border: rgb(132 95 58 / 34%);
  --stat-color: #6d4a25;
  --stat-icon-bg: rgb(255 249 238 / 94%);
}

.player-stat.is-quarry {
  --stat-bg: rgb(232 235 232 / 78%);
  --stat-border: rgb(105 114 102 / 34%);
  --stat-color: #536052;
  --stat-icon-bg: rgb(248 249 247 / 94%);
}

.player-stat.is-iron {
  --stat-bg: rgb(229 235 241 / 78%);
  --stat-border: rgb(91 106 121 / 34%);
  --stat-color: #485a69;
  --stat-icon-bg: rgb(247 249 251 / 94%);
}

.player-stat.is-herb {
  --stat-bg: rgb(224 244 218 / 76%);
  --stat-border: rgb(76 140 79 / 34%);
  --stat-color: #3f7a42;
  --stat-icon-bg: rgb(244 253 242 / 94%);
}

.player-stat.is-fiber {
  --stat-bg: rgb(221 241 238 / 76%);
  --stat-border: rgb(69 132 128 / 34%);
  --stat-color: #3f7774;
  --stat-icon-bg: rgb(243 252 250 / 94%);
}

.player-stat-icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--stat-border);
  border-radius: 999px;
  background: var(--stat-icon-bg);
  color: currentColor;
  outline: none;
}

.player-stat-primary .player-stat-icon {
  width: 16px;
  height: 16px;
}

.player-stat-secondary .player-stat-icon {
  width: 16px;
  height: 16px;
}

.player-stat-icon svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.player-stat-secondary .player-stat-icon svg {
  width: 12px;
  height: 12px;
}

.player-stat-primary .player-stat-icon svg {
  width: 12px;
  height: 12px;
}

.player-stat-label {
  display: block;
  min-width: 0;
  white-space: nowrap;
}

.player-stat-primary .player-stat-label {
  flex: 0 0 auto;
}

.player-stat-value {
  display: block;
  min-width: 0;
  white-space: nowrap;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.player-claim-items {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.player-claim-items button {
  position: relative;
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  gap: 5px;
  border: 1px solid rgb(173 135 64 / 38%);
  border-radius: 999px;
  background: rgb(255 242 204 / 78%);
  padding: 2px 7px 2px 3px;
  color: #5b4828;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.1;
}

.player-claim-items button:hover {
  border-color: rgb(104 124 69 / 62%);
  background: rgb(240 226 180 / 92%);
}

.player-claim-items button.is-active {
  border-color: #647f43;
  background: #6f8f50;
  color: #fff9df;
}

.player-claim-items button:disabled {
  cursor: wait;
  opacity: 0.66;
}

.claim-item-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #6f8f50;
  fill: rgb(111 143 80 / 14%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.player-claim-items button.is-active .claim-item-icon {
  color: #fff9df;
  fill: rgb(255 249 223 / 18%);
}

.player-stamina-track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  overflow: hidden;
  background: rgb(93 78 50 / 24%);
}

.player-stamina-track i {
  display: block;
  height: 100%;
  background: #5f9f4a;
}

@media (max-width: 900px) {
  .top-player-card {
    top: 12px;
    left: 12px;
  }
}

@media (max-width: 640px) {
  .top-player-card {
    min-height: 64px;
    align-items: center;
    gap: 8px;
    padding: 9px;
  }

  .player-avatar {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .player-land-badge {
    right: -4px;
    bottom: -4px;
    min-width: 18px;
    height: 18px;
    border-width: 2px;
    font-size: 9px;
  }

  .player-title {
    gap: 5px;
  }

  .player-title strong {
    font-size: 14px;
  }

  .player-title small,
  .player-stat {
    font-size: 11px;
  }

  .player-stats {
    margin-top: 5px;
    gap: 6px;
  }

  .player-stats-secondary {
    gap: 5px;
    padding-bottom: 1px;
  }

  .player-stats-primary {
    gap: 3px;
  }

  .player-stat-primary {
    min-height: 22px;
    padding: 2px 4px 2px 2px;
    font-size: 10px;
  }

  .player-stat-primary .player-stat-icon {
    width: 14px;
    height: 14px;
  }

  .player-stat-secondary {
    min-height: 20px;
    padding: 1px 5px 1px 2px;
    font-size: 10px;
  }

  .player-stat-secondary .player-stat-icon {
    width: 15px;
    height: 15px;
  }

  .player-claim-items {
    margin-top: 8px;
  }
}
</style>
