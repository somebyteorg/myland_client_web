<template>
  <section
      class="online-status-card"
      :class="{ 'is-open': panelOpen }"
      aria-label="在线玩家"
      @mouseenter="openPanel"
      @mouseleave="closePanel"
      @focusin="openPanel"
      @focusout="handleFocusOut"
  >
    <button class="online-status-trigger" type="button" :aria-expanded="panelOpen" @click="openPanel">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.4 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"/>
        <path d="M15.8 10.4a2.6 2.6 0 1 0 0-5.2"/>
        <path d="M3.9 18.6a4.7 4.7 0 0 1 9 0"/>
        <path d="M13.8 15.1a4 4 0 0 1 5.9 3.5"/>
      </svg>
      <span>{{ countLabel }}</span>
    </button>

    <Transition name="online-panel-pop">
      <div v-if="panelOpen" class="online-player-panel">
        <header class="online-player-header">
          <strong>在线玩家</strong>
          <span>{{ panelStatusLabel }}</span>
        </header>

        <div class="online-player-body">
          <div v-if="listLoading && players.length <= 0" class="online-player-state">正在刷新...</div>
          <div v-else-if="listError && players.length <= 0" class="online-player-state is-error">{{ listError }}</div>
          <div v-else-if="players.length <= 0" class="online-player-state">暂无在线玩家</div>

          <ol v-else class="online-player-list">
            <li
                v-for="player in players"
                :key="player.player_id"
                class="online-player-item"
                :class="{ 'is-current': player.player_id === playerId }"
            >
              <span class="online-player-avatar" :style="{ '--player-color': resolvePlayerColor(player.color) }">
                <img v-if="player.avatar" :src="player.avatar" :alt="`${formatPlayerName(player)}头像`"/>
                <span v-else>{{ getAvatarInitial(player) }}</span>
              </span>
              <span class="online-player-info">
                <span class="online-player-name-row">
                  <button
                      class="online-player-locate"
                      type="button"
                      :aria-label="`定位到${formatPlayerName(player)}的住宅`"
                      @click.stop="locatePlayerHome(player.player_id)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="5.2"/>
                      <path d="M12 3.6v3"/>
                      <path d="M12 17.4v3"/>
                      <path d="M3.6 12h3"/>
                      <path d="M17.4 12h3"/>
                    </svg>
                  </button>
                  <strong>{{ formatPlayerName(player) }}</strong>
                  <small v-if="formatPlayerProfile(player)">{{ formatPlayerProfile(player) }}</small>
                </span>
                <p v-if="formatPlayerManifesto(player)">{{ formatPlayerManifesto(player) }}</p>
              </span>
            </li>
          </ol>

          <p v-if="listError && players.length > 0" class="online-player-inline-error">{{ listError }}</p>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useGameEventListener} from '@/composables/useGameEventBus'
import {loadOnlineCount, loadOnlinePlayers} from '@/game/onlineData'
import type {
  OnlineCountEvent,
  OnlinePlayer,
} from '@/game/onlineTypes'

const ONLINE_LIST_PAGE_SIZE = 10

const props = defineProps<{
  playerId: string
}>()

const emit = defineEmits<{
  locatePlayerHome: [playerId: string]
}>()

const panelOpen = ref(false)
const countPlayer = ref<number | null>(null)
const countLoading = ref(false)
const players = ref<OnlinePlayer[]>([])
const listLoading = ref(false)
const listError = ref('')
let closeTimer: number | null = null

const countLabel = computed(() => {
  if (countLoading.value && countPlayer.value === null) return '--'

  return String(Math.max(0, Number(countPlayer.value) || 0))
})
const panelStatusLabel = computed(() => {
  if (listLoading.value) return '同步中'
  if (listError.value) return '读取失败'
  if (countPlayer.value === null) return '实时人数'

  return `${countLabel.value} 人在线`
})

onMounted(() => {
  void refreshOnlineCount()
})

useGameEventListener<OnlineCountEvent>('online_count', (event) => {
  countPlayer.value = Math.max(0, Number(event.count_player) || 0)
})

function openPanel() {
  clearCloseTimer()
  if (panelOpen.value) return

  panelOpen.value = true
  void refreshOnlinePlayers()
}

function closePanel() {
  clearCloseTimer()
  closeTimer = window.setTimeout(() => {
    panelOpen.value = false
  }, 120)
}

function handleFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget
  const nextTarget = event.relatedTarget
  if (currentTarget instanceof Node && nextTarget instanceof Node && currentTarget.contains(nextTarget)) return

  closePanel()
}

function clearCloseTimer() {
  if (closeTimer === null) return

  window.clearTimeout(closeTimer)
  closeTimer = null
}

async function refreshOnlineCount() {
  countLoading.value = true

  try {
    const data = await loadOnlineCount()
    countPlayer.value = Math.max(0, Number(data.count_player) || 0)
  } catch {
    countPlayer.value = countPlayer.value ?? 0
  } finally {
    countLoading.value = false
  }
}

async function refreshOnlinePlayers() {
  if (listLoading.value) return

  listLoading.value = true
  listError.value = ''

  try {
    const data = await loadOnlinePlayers({pageSize: ONLINE_LIST_PAGE_SIZE})

    players.value = Array.isArray(data.items)
        ? data.items.filter((player) => player.player_id !== props.playerId)
        : []
  } catch {
    listError.value = '在线列表读取失败'
  } finally {
    listLoading.value = false
  }
}

function formatPlayerName(player: OnlinePlayer) {
  const name = player.name?.trim()

  return name || '无名村民'
}

function getAvatarInitial(player: OnlinePlayer) {
  return formatPlayerName(player).slice(0, 1)
}

function formatPlayerProfile(player: OnlinePlayer) {
  const gender = player.gender_string?.trim()
  const age = String(player.tick_age_string ?? '').trim()
  const parts = [gender, age].filter(Boolean)

  return parts.join(' · ')
}

function formatPlayerManifesto(player: OnlinePlayer) {
  return player.manifesto?.trim() ?? ''
}

function resolvePlayerColor(color: string | null) {
  const normalizedColor = color?.trim()

  return normalizedColor || '#7f9b59'
}

function locatePlayerHome(playerId: string) {
  const normalizedPlayerId = playerId.trim()
  if (!normalizedPlayerId) return

  emit('locatePlayerHome', normalizedPlayerId)
}
</script>

<style>
.online-status-card {
  z-index: 28;
  flex: 0 0 auto;
}

.online-status-card.is-open {
  z-index: 90;
}

.online-status-trigger {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  border: 1px solid rgb(216 193 141 / 40%);
  border-radius: 8px;
  background: rgb(255 247 223 / 60%);
  opacity: 0.86;
  padding: 0 9px;
  color: #4f6536;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 8px 20px rgb(72 61 36 / 10%);
  transition: opacity 160ms ease,
  border-color 160ms ease,
  background 160ms ease;
  backdrop-filter: blur(8px);
}

.online-status-trigger:hover,
.online-status-trigger:focus-visible,
.online-status-card.is-open .online-status-trigger {
  border-color: rgb(104 124 69 / 56%);
  background: rgb(247 255 226 / 86%);
  opacity: 1;
  outline: none;
}

.online-status-trigger svg {
  width: 17px;
  height: 17px;
  fill: rgb(104 124 69 / 12%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
}

.online-player-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  display: grid;
  width: 100%;
  grid-template-rows: auto minmax(0, 1fr);
  max-height: min(418px, calc(100vh - 78px));
  overflow: hidden;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 97%);
  box-shadow: 0 18px 42px rgb(72 61 36 / 22%);
  color: #3a3123;
  backdrop-filter: blur(14px);
}

.online-player-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgb(216 193 141 / 62%);
  padding: 11px 12px 10px;
}

.online-player-header strong,
.online-player-header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-player-header strong {
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

.online-player-header span {
  color: #806b48;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.online-player-state {
  display: grid;
  min-height: 124px;
  place-items: center;
  margin: 10px;
  border: 1px dashed rgb(173 135 64 / 36%);
  border-radius: 8px;
  background: rgb(255 249 232 / 58%);
  color: #806b48;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.online-player-state.is-error,
.online-player-inline-error {
  color: #91372f;
}

.online-player-body {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.online-player-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 6px;
  list-style: none;
}

.online-player-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 6px;
}

.online-player-item.is-current {
  background: rgb(232 246 194 / 76%);
}

.online-player-avatar {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  overflow: hidden;
  border: 2px solid var(--player-color);
  border-radius: 50%;
  background: linear-gradient(145deg, rgb(255 229 147 / 96%), var(--player-color));
  color: #4a3512;
  font-size: 13px;
  font-weight: 900;
}

.online-player-avatar img,
.online-player-avatar > span {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 50%;
}

.online-player-avatar img {
  object-fit: cover;
}

.online-player-avatar > span {
  display: grid;
  place-items: center;
}

.online-player-info {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.online-player-name-row {
  display: grid;
  grid-template-columns: 22px minmax(0, auto) minmax(0, auto);
  align-items: center;
  justify-content: start;
  gap: 6px;
  min-width: 0;
}

.online-player-info strong,
.online-player-name-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-player-info strong {
  color: #443721;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}

.online-player-name-row small {
  color: #806b48;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.online-player-locate {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(104 124 69 / 42%);
  border-radius: 8px;
  background: rgb(247 255 226 / 78%);
  color: #5f7d43;
}

.online-player-locate:hover,
.online-player-locate:focus-visible {
  border-color: rgb(104 124 69 / 72%);
  background: rgb(232 246 194 / 96%);
  color: #3f5f2d;
  outline: none;
}

.online-player-locate svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.online-player-info p {
  margin: 0;
  color: #806b48;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.online-player-inline-error {
  margin: 0 10px 10px;
  border: 1px solid rgb(195 107 85 / 38%);
  border-radius: 8px;
  background: rgb(255 239 225 / 72%);
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 800;
}

.online-panel-pop-enter-active,
.online-panel-pop-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.online-panel-pop-enter-from,
.online-panel-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 640px) {
  .online-status-trigger {
    min-height: 28px;
    gap: 4px;
    padding: 0 7px;
    font-size: 11px;
  }

  .online-status-trigger svg {
    width: 15px;
    height: 15px;
  }

}
</style>
