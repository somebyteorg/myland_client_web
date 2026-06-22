<template>
  <GamePlayerCard
      :claim-item-info="claimItemInfo"
      :claim-inventory="claimInventory"
      :claim-loading="claimLoading"
      :claim-mode="claimMode"
      :item-catalog="itemCatalog"
      :land-placement-mode="landPlacementMode"
      :loading="playerLoading"
      :player="player"
      @locate-chronicle-tile="$emit('locateChronicleTile', $event)"
      @resize="$emit('playerCardResize', $event)"
      @use-deed="$emit('useDeed')"
      @use-pioneer="$emit('usePioneer')"
  />
  <div class="top-right-hud">
    <GameCalendarCard :loading="timeLoading" :time="time"/>
    <GameOnlineStatus
        :player-id="playerId"
        @locate-player-home="$emit('locatePlayerHome', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import GameCalendarCard from '@/components/game/GameCalendarCard.vue'
import GameOnlineStatus from '@/components/game/GameOnlineStatus.vue'
import GamePlayerCard from '@/components/game/GamePlayerCard.vue'
import type {GameItem} from '@/game/types'
import type {GameTimeInfo, PlayerChronicleLocation, PlayerInfo} from '@/game/homeTypes'

defineProps<{
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
  }
  claimLoading: boolean
  claimMode: boolean
  itemCatalog: GameItem[]
  landPlacementMode: 'pioneer' | 'deed' | null
  player: PlayerInfo | null
  playerId: string
  time: GameTimeInfo | null
  playerLoading: boolean
  timeLoading: boolean
}>()

defineEmits<{
  locateChronicleTile: [location: PlayerChronicleLocation]
  locatePlayerHome: [playerId: string]
  playerCardResize: [height: number]
  useDeed: []
  usePioneer: []
}>()
</script>

<style>
.top-right-hud {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 26;
  display: flex;
  max-width: min(520px, calc(100vw - 392px));
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
}

.top-right-hud:hover,
.top-right-hud:focus-within {
  z-index: 90;
}

@media (max-width: 900px) {
  .top-right-hud {
    top: 12px;
    right: 12px;
    max-width: calc(100vw - 336px);
  }
}

@media (max-width: 640px) {
  .top-right-hud {
    max-width: max(92px, calc(100vw - 264px));
    gap: 5px;
  }
}
</style>
