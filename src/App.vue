<template>
  <GameEventStream v-if="authReady" :player-id="sign.player_id" :token="sign.user_token"/>
  <GameView v-if="authReady"/>
  <main v-else class="grid min-h-screen place-items-center bg-[#f7edd5] text-[#3d3324]">
    <section class="rounded-lg border border-[#d8c18d] bg-[#fff9e8]/90 px-8 py-6 text-center shadow-xl">
      <p class="text-lg font-semibold">正在进入一亩三分地</p>
      <p class="mt-2 text-sm text-[#7c6848]">正在整理路引与身份凭证...</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import GameEventStream from '@/components/game/GameEventStream.vue'
import GameView from '@/views/GameView.vue'
import {useSignStore} from '@/stores/sign'
import {LOGIN_URL} from '@/constants'

const sign = useSignStore()
const authReady = ref(false)

onMounted(() => {
  syncAuthFromUrl()
})

function syncAuthFromUrl() {
  const url = new URL(window.location.href)
  const token = getQueryValue(url, 'token')
  const playerId = getQueryValue(url, 'player_id')

  // emos 支付回调会带no
  if (token || getQueryValue(url, 'no')) {
    window.history.replaceState(window.history.state, document.title, `/web?player_id=${playerId}`)
  }

  if (!playerId) {
    sign.clearPlayerId()
    redirectToLogin()
    return
  }

  if (token) {
    sign.setAuth(token, playerId)
    authReady.value = true
    return
  }

  sign.setPlayerId(playerId)

  if (!sign.isSignedIn) {
    redirectToLogin()
    return
  }

  authReady.value = true
}

function getQueryValue(url: URL, key: string) {
  const value = url.searchParams.get(key)

  return value && value.length > 0 ? value : ''
}

function redirectToLogin() {
  window.location.href = LOGIN_URL
}
</script>

<style>
* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
  background: #cfe7df;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
  sans-serif;
}

button,
input,
textarea {
  font: inherit;
}
</style>
