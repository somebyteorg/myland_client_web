import {computed, ref} from 'vue'
import {defineStore} from 'pinia'

export const useSignStore = defineStore(
    'sign',
    () => {
        const username = ref('')
        const avatar = ref<string | null>(null)
        const user_token = ref('')
        const player_id = ref('')

        const isSignedIn = computed(() => Boolean(user_token.value))

        function setToken(token: string) {
            user_token.value = token
        }

        function setPlayerId(playerId: string) {
            player_id.value = playerId
        }

        function setAuth(token: string, playerId: string) {
            setToken(token)
            setPlayerId(playerId)
        }

        function clearPlayerId() {
            player_id.value = ''
        }

        function setProfile(profile: { username?: string; avatar?: string | null }) {
            username.value = profile.username ?? username.value
            avatar.value = profile.avatar ?? avatar.value
        }

        async function signOut() {
            username.value = ''
            avatar.value = null
            user_token.value = ''
            clearPlayerId()
        }

        return {
            username,
            avatar,
            user_token,
            player_id,
            isSignedIn,
            setToken,
            setPlayerId,
            setAuth,
            clearPlayerId,
            setProfile,
            signOut,
        }
    },
    {
        persist: {
            pick: ['username', 'avatar', 'user_token'],
        },
    },
)

export default useSignStore
