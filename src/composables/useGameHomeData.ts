import {computed, ref, watch} from 'vue'
import api from '@/utils/ky'
import {LOGIN_URL} from '@/constants'
import {useSignStore} from '@/stores/sign'
import type {GameTimeInfo, PlayerInfo} from '@/game/homeTypes'

export function useGameHomeData() {
    const sign = useSignStore()
    const playerId = computed(() => sign.player_id)
    const playerInfo = ref<PlayerInfo | null>(null)
    const gameTime = ref<GameTimeInfo | null>(null)
    const playerLoading = ref(false)
    const timeLoading = ref(false)

    watch(playerId, (nextPlayerId, previousPlayerId) => {
        if (!nextPlayerId || nextPlayerId === previousPlayerId) return

        void refreshPlayerInfo()
    })

    async function refreshHomeData() {
        await Promise.all([
            refreshPlayerInfo(),
            refreshGameTime(),
        ])
    }

    async function refreshPlayerInfo() {
        const currentPlayerId = playerId.value

        if (!currentPlayerId) {
            playerInfo.value = null
            return null
        }

        playerLoading.value = true

        try {
            const data = await api.get(`api/player/${encodeURIComponent(currentPlayerId)}/info`).json<PlayerInfo>()
            updatePlayerInfo(data)
            sign.setProfile({
                username: data.name,
                avatar: data.avatar,
            })

            return data
        } catch {
            await sign.signOut()
            window.location.href = LOGIN_URL
            return null
        } finally {
            playerLoading.value = false
        }
    }

    async function refreshGameTime() {
        timeLoading.value = true

        try {
            const data = await api.get('api/common/time').json<GameTimeInfo>()
            updateGameTime(data)

            return data
        } catch {
            return null
        } finally {
            timeLoading.value = false
        }
    }

    function updatePlayerInfo(nextPlayerInfo: PlayerInfo) {
        playerInfo.value = {...nextPlayerInfo}
    }

    function updateGameTime(nextGameTime: GameTimeInfo) {
        gameTime.value = {...nextGameTime}
    }

    return {
        playerInfo,
        gameTime,
        playerLoading,
        timeLoading,
        refreshHomeData,
        updateGameTime,
    }
}
