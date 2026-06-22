<template>
  <section
      class="game-chat-panel"
      :class="{ 'is-open': isOpen }"
      aria-label="村庄聊天"
      @mouseenter="openPanel"
      @focusin="openPanel"
  >
    <button
        class="game-chat-trigger"
        type="button"
        :aria-expanded="isOpen"
        @click="openPanel"
    >
      <span class="game-chat-trigger-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
              d="M5.5 6.4A3.4 3.4 0 0 1 8.9 3h6.2a3.4 3.4 0 0 1 3.4 3.4v4.2a3.4 3.4 0 0 1-3.4 3.4h-3.7L7.5 18v-4H8.9a3.4 3.4 0 0 1-3.4-3.4Z"/>
          <path d="M8.6 7.3h6.8"/>
          <path d="M8.6 10.2h4.7"/>
          <path d="M16.8 14.1v2.1a2.8 2.8 0 0 1-2.8 2.8H9.5l-3 2.5v-2.5H5.3A2.8 2.8 0 0 1 2.5 16.2v-3.6"/>
        </svg>
      </span>
      <span class="game-chat-trigger-copy">
        <strong>聊天</strong>
        <small>{{ triggerStatusLabel }}</small>
      </span>
      <span
          class="game-chat-trigger-dot"
          :class="{ 'is-busy': isBusy, 'is-error': Boolean(errorMessage) }"
          aria-hidden="true"
      ></span>
      <span v-if="unreadCount > 0" class="game-chat-unread-badge" aria-label="未读消息">
        {{ unreadCountLabel }}
      </span>
    </button>

    <Transition name="game-chat-pop">
      <div v-if="isOpen" class="game-chat-window">
        <header class="game-chat-header">
          <button
              class="game-chat-refresh"
              :class="{ 'is-refreshing': loadingInitial }"
              type="button"
              aria-label="刷新聊天"
              :disabled="loadingInitial"
              @click="refreshMessages"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.2 7.2A8 8 0 1 0 20 12"/>
              <path d="M19.4 3.8v3.8h-3.8"/>
            </svg>
          </button>
          <div>
            <strong>村庄频道</strong>
          </div>
          <button
              class="game-chat-close"
              type="button"
              aria-label="关闭聊天"
              @click="closePanel"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12"/>
              <path d="M18 6 6 18"/>
            </svg>
          </button>
        </header>

        <div
            ref="listRef"
            class="game-chat-body"
            :aria-busy="loadingInitial || loadingHistory"
            @scroll="handleListScroll"
        >
          <button
              v-if="messages.length > 0 && hasMoreHistory"
              class="game-chat-history-button"
              type="button"
              :disabled="loadingHistory"
              @click="loadOlderMessages"
          >
            <svg v-if="loadingHistory" class="game-chat-spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="game-chat-spinner-track" cx="12" cy="12" r="8"/>
              <circle class="game-chat-spinner-arc" cx="12" cy="12" r="8"/>
            </svg>
            <span>{{ loadingHistory ? '读取中' : '查看更早消息' }}</span>
          </button>

          <div v-if="initialLoading" class="game-chat-state">正在读取聊天...</div>

          <div v-else-if="errorMessage && messages.length <= 0" class="game-chat-state is-error">
            {{ errorMessage }}
          </div>

          <div v-else-if="messages.length <= 0" class="game-chat-state">暂无聊天记录</div>

          <ol v-else class="game-chat-list">
            <li
                v-for="message in messages"
                :key="message.message_id"
                class="game-chat-message"
                :class="{ 'is-own': isOwnMessage(message) }"
            >
              <span v-if="!isOwnMessage(message)" class="game-chat-avatar">
                <img
                    v-if="message.player_avatar"
                    :src="message.player_avatar"
                    :alt="`${formatPlayerName(message)}头像`"
                />
                <span v-else>{{ getAvatarInitial(message) }}</span>
              </span>
              <div class="game-chat-bubble">
                <div class="game-chat-meta">
                  <strong>{{ formatPlayerName(message) }}</strong>
                  <time>{{ formatMessageTime(message) }}</time>
                </div>
                <p>{{ formatMessageContent(message) }}</p>
              </div>
            </li>
          </ol>

          <p v-if="errorMessage && messages.length > 0" class="game-chat-inline-error">
            {{ errorMessage }}
          </p>
        </div>

        <form class="game-chat-compose" @submit.prevent="sendMessage">
          <textarea
              v-model="draftMessage"
              ref="composeRef"
              rows="1"
              maxlength="300"
              :disabled="sending || !playerId"
              :placeholder="composePlaceholder"
              aria-label="聊天内容"
              @input="resizeCompose"
              @keydown.enter.exact="handleComposeSubmit"
          ></textarea>
          <button
              type="submit"
              aria-label="发送聊天"
              :disabled="!canSend"
          >
            <svg v-if="!sending" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 11.2 19.4 4.6l-4.9 14.8-3.2-6.5Z"/>
              <path d="M11.3 12.9 19.4 4.6"/>
            </svg>
            <svg v-else class="game-chat-spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="game-chat-spinner-track" cx="12" cy="12" r="8"/>
              <circle class="game-chat-spinner-arc" cx="12" cy="12" r="8"/>
            </svg>
          </button>
        </form>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref} from 'vue'
import {useGameEventListener} from '@/composables/useGameEventBus'
import {CHAT_MESSAGE_PAGE_SIZE, loadChatMessageList, sendChatTextMessage} from '@/game/chatData'
import {
  isValidChatMessage,
  isVillageChatEvent,
  mergeChatMessages,
  normalizeChatMessages,
} from '@/game/chatMessages'
import type {ChatMessage, ChatMessageNewEvent} from '@/game/chatTypes'

const props = defineProps<{
  playerId: string
}>()

const listRef = ref<HTMLElement | null>(null)
const composeRef = ref<HTMLTextAreaElement | null>(null)
const isOpen = ref(false)
const loaded = ref(false)
const messages = ref<ChatMessage[]>([])
const hasMoreHistory = ref(false)
const loadingInitial = ref(false)
const loadingHistory = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const draftMessage = ref('')
const unreadCount = ref(0)

const initialLoading = computed(() => loadingInitial.value && messages.value.length <= 0)
const isBusy = computed(() => loadingInitial.value || loadingHistory.value || sending.value)
const canSend = computed(() => Boolean(props.playerId && draftMessage.value.trim() && !sending.value))
const composePlaceholder = computed(() => props.playerId ? '输入消息' : '缺少玩家身份')
const unreadCountLabel = computed(() => unreadCount.value > 99 ? '99+' : String(unreadCount.value))
const triggerStatusLabel = computed(() => {
  if (isBusy.value) return '同步中'
  if (errorMessage.value) return '连接异常'
  if (unreadCount.value > 0) return `${unreadCountLabel.value} 条未读`
  if (!loaded.value) return '悬停打开'
  if (messages.value.length <= 0) return '暂无消息'

  return `${messages.value.length} 条消息`
})

useGameEventListener<ChatMessageNewEvent>('chat_message_new', handleChatMessageNew)

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})

async function openPanel() {
  const wasOpen = isOpen.value
  isOpen.value = true
  unreadCount.value = 0
  await nextTick()

  if (!loaded.value && !loadingInitial.value) {
    await loadLatestMessages()
    return
  }

  if (wasOpen) return

  scrollToBottom()
}

function closePanel() {
  isOpen.value = false
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!isOpen.value || event.key !== 'Escape') return

  event.preventDefault()
  closePanel()
}

async function refreshMessages() {
  unreadCount.value = 0
  await loadLatestMessages()
}

async function loadLatestMessages() {
  if (loadingInitial.value) return

  loadingInitial.value = true
  errorMessage.value = ''

  try {
    const data = await loadChatMessageList({
      sort: 'down',
      pageSize: CHAT_MESSAGE_PAGE_SIZE,
    })
    messages.value = normalizeChatMessages(data.items)
    hasMoreHistory.value = Boolean(data.has_more)
    loaded.value = true
    await nextTick()
    scrollToBottom()
  } catch {
    errorMessage.value = '聊天读取失败，请稍后再试'
  } finally {
    loadingInitial.value = false
  }
}

async function loadOlderMessages() {
  if (!hasMoreHistory.value || loadingHistory.value || messages.value.length <= 0) return

  const oldestMessageId = messages.value[0]?.message_id
  if (!oldestMessageId) return

  const list = listRef.value
  const previousScrollHeight = list?.scrollHeight ?? 0
  const previousScrollTop = list?.scrollTop ?? 0

  loadingHistory.value = true
  errorMessage.value = ''

  try {
    const data = await loadChatMessageList({
      lastMessageId: oldestMessageId,
      sort: 'up',
      pageSize: CHAT_MESSAGE_PAGE_SIZE,
    })
    messages.value = mergeChatMessages(messages.value, normalizeChatMessages(data.items))
    hasMoreHistory.value = Boolean(data.has_more)
    loaded.value = true
    await nextTick()

    if (list) {
      list.scrollTop = list.scrollHeight - previousScrollHeight + previousScrollTop
    }
  } catch {
    errorMessage.value = '历史消息读取失败，请稍后再试'
  } finally {
    loadingHistory.value = false
  }
}

async function sendMessage() {
  const content = draftMessage.value.trim()
  if (!content || !props.playerId || sending.value) return

  sending.value = true
  errorMessage.value = ''

  try {
    const data = await sendChatTextMessage(props.playerId, content)

    draftMessage.value = ''
    messages.value = mergeChatMessages(messages.value, normalizeChatMessages([data]))
    loaded.value = true
    await nextTick()
    resizeCompose()
    if (isOpen.value) scrollToBottom()
  } catch {
    errorMessage.value = '消息发送失败，请稍后再试'
  } finally {
    sending.value = false
  }
}

function handleChatMessageNew(payload: ChatMessageNewEvent) {
  if (!isVillageChatEvent(payload)) return
  if (!isValidChatMessage(payload.message) || hasMessage(payload.message.message_id)) return

  const wasLoaded = loaded.value
  const shouldScrollToBottom = isOpen.value && wasLoaded && isListNearBottom()
  messages.value = mergeChatMessages(messages.value, normalizeChatMessages([payload.message]))

  if (!isOpen.value && !isOwnMessage(payload.message)) {
    unreadCount.value += 1
    return
  }

  unreadCount.value = 0
  if (shouldScrollToBottom) {
    void nextTick(() => {
      scrollToBottom()
    })
  }
}

function hasMessage(messageId: number) {
  return messages.value.some((message) => message.message_id === messageId)
}

function handleListScroll() {
  const list = listRef.value
  if (!list || list.scrollTop > 24) return

  void loadOlderMessages()
}

function scrollToBottom() {
  const list = listRef.value
  if (!list) return

  list.scrollTop = list.scrollHeight
}

function resizeCompose() {
  const textarea = composeRef.value
  if (!textarea) return

  textarea.style.height = '0px'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`
  textarea.style.overflowY = textarea.scrollHeight > 96 ? 'auto' : 'hidden'
}

function handleComposeSubmit(event: KeyboardEvent) {
  if (event.isComposing) return

  event.preventDefault()
  void sendMessage()
}

function isListNearBottom() {
  const list = listRef.value
  if (!list) return true

  return list.scrollHeight - list.scrollTop - list.clientHeight < 42
}

function isOwnMessage(message: ChatMessage) {
  return Boolean(props.playerId && message.player_id === props.playerId)
}

function formatPlayerName(message: ChatMessage) {
  const name = message.player_name?.trim()

  return name || '无名村民'
}

function getAvatarInitial(message: ChatMessage) {
  return formatPlayerName(message).slice(0, 1)
}

function formatMessageTime(message: ChatMessage) {
  const text = message.tick_format?.string?.trim()

  return text || '地元历'
}

function formatMessageContent(message: ChatMessage) {
  const content = message.message_content?.trim()

  return content || '[空消息]'
}
</script>

<style>
.game-chat-panel {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 34;
  width: auto;
  color: #3a3123;
}

.game-chat-panel.is-open {
  z-index: 86;
}

.game-chat-panel.is-open::before {
  position: absolute;
  left: 0;
  bottom: 34px;
  width: min(320px, calc(100vw - 36px));
  height: 12px;
  content: '';
}

.game-chat-trigger {
  position: relative;
  display: inline-grid;
  width: auto;
  min-height: 34px;
  grid-template-columns: 18px auto;
  align-items: center;
  gap: 7px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 91%);
  box-shadow: 0 10px 24px rgb(72 61 36 / 16%);
  padding: 0 12px;
  color: #59482e;
  text-align: left;
  backdrop-filter: blur(10px);
}

.game-chat-trigger:hover,
.game-chat-trigger:focus-visible,
.game-chat-panel.is-open .game-chat-trigger {
  border-color: rgb(104 124 69 / 58%);
  background: rgb(255 247 223 / 96%);
  outline: none;
}

.game-chat-trigger-icon {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  color: #5f7d43;
}

.game-chat-trigger-icon svg {
  width: 18px;
  height: 18px;
  fill: rgb(104 124 69 / 12%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.game-chat-trigger-copy {
  display: block;
  min-width: 0;
}

.game-chat-trigger-copy strong,
.game-chat-trigger-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-chat-trigger-copy strong {
  color: #59482e;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.game-chat-trigger-copy small {
  display: none;
  color: #806b48;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.game-chat-trigger-dot {
  display: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #7f9b59;
  box-shadow: 0 0 0 3px rgb(127 155 89 / 16%);
}

.game-chat-trigger-dot.is-busy {
  background: #b88432;
  box-shadow: 0 0 0 3px rgb(184 132 50 / 18%);
}

.game-chat-trigger-dot.is-error {
  background: #b74e43;
  box-shadow: 0 0 0 3px rgb(183 78 67 / 16%);
}

.game-chat-unread-badge {
  position: absolute;
  right: -7px;
  top: -7px;
  display: grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border: 2px solid #fff7df;
  border-radius: 999px;
  background: #c5483d;
  color: #fff9df;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 4px 10px rgb(72 61 36 / 20%);
  padding: 0 4px;
}

.game-chat-window {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  display: grid;
  width: min(320px, calc(100vw - 36px));
  height: min(430px, calc(100vh - 104px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 97%);
  box-shadow: 0 18px 42px rgb(72 61 36 / 24%);
  backdrop-filter: blur(14px);
}

.game-chat-header {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgb(216 193 141 / 62%);
  padding: 11px 12px 10px;
}

.game-chat-header div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.game-chat-header strong,
.game-chat-header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-chat-header strong {
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

.game-chat-header span {
  color: #806b48;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.game-chat-refresh {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 34%);
  border-radius: 8px;
  background: rgb(255 242 204 / 72%);
  color: #5b4828;
}

.game-chat-close {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid rgb(173 135 64 / 34%);
  border-radius: 8px;
  background: rgb(255 242 204 / 72%);
  color: #5b4828;
}

.game-chat-refresh:hover:not(:disabled),
.game-chat-refresh:focus-visible,
.game-chat-close:hover,
.game-chat-close:focus-visible {
  border-color: rgb(104 124 69 / 58%);
  background: rgb(240 226 180 / 92%);
  outline: none;
}

.game-chat-refresh:disabled {
  cursor: wait;
  opacity: 0.54;
}

.game-chat-refresh svg,
.game-chat-close svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transform-origin: center;
  transition: transform 160ms ease;
}

.game-chat-refresh:hover:not(:disabled) svg,
.game-chat-refresh:focus-visible svg {
  transform: rotate(42deg);
}

.game-chat-refresh.is-refreshing svg {
  animation: game-chat-refresh-spin 680ms linear infinite;
}

.game-chat-body {
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  scrollbar-width: thin;
}

.game-chat-history-button {
  display: inline-flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-bottom: 10px;
  border: 1px solid rgb(173 135 64 / 34%);
  border-radius: 8px;
  background: rgb(255 242 204 / 62%);
  color: #806b48;
  font-size: 12px;
  font-weight: 900;
}

.game-chat-history-button:hover:not(:disabled) {
  background: rgb(240 226 180 / 86%);
}

.game-chat-history-button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.game-chat-state {
  display: grid;
  min-height: 190px;
  place-items: center;
  border: 1px dashed rgb(173 135 64 / 36%);
  border-radius: 8px;
  background: rgb(255 249 232 / 56%);
  color: #806b48;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.game-chat-state.is-error,
.game-chat-inline-error {
  color: #91372f;
}

.game-chat-state.is-error {
  border-color: rgb(195 107 85 / 42%);
  background: rgb(255 239 225 / 74%);
}

.game-chat-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.game-chat-message {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.game-chat-message.is-own {
  display: flex;
  justify-content: flex-end;
}

.game-chat-message.is-own .game-chat-bubble {
  justify-self: end;
  max-width: calc(100% - 36px);
  background: rgb(232 246 194 / 88%);
}

.game-chat-avatar {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  overflow: hidden;
  border: 1px solid #ad8740;
  border-radius: 50%;
  background: linear-gradient(145deg, #ffe593, #c59243);
  color: #4a3512;
  font-size: 12px;
  font-weight: 900;
}

.game-chat-avatar img,
.game-chat-avatar > span {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 50%;
}

.game-chat-avatar img {
  object-fit: cover;
}

.game-chat-avatar > span {
  display: grid;
  place-items: center;
}

.game-chat-bubble {
  display: grid;
  max-width: 100%;
  gap: 5px;
  border: 1px solid rgb(173 135 64 / 30%);
  border-radius: 8px;
  background: rgb(255 249 232 / 82%);
  padding: 7px 9px 8px;
  box-shadow: 0 4px 12px rgb(72 61 36 / 8%);
}

.game-chat-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.game-chat-message.is-own .game-chat-meta {
  justify-content: flex-end;
}

.game-chat-meta strong,
.game-chat-meta time {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-chat-meta strong {
  color: #5b4828;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.game-chat-meta time {
  color: #8d7651;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.game-chat-bubble p {
  margin: 0;
  color: #3f3524;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.42;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.game-chat-inline-error {
  margin: 10px 0 0;
  border: 1px solid rgb(195 107 85 / 38%);
  border-radius: 8px;
  background: rgb(255 239 225 / 72%);
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 800;
}

.game-chat-compose {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  align-items: center;
  gap: 8px;
  border-top: 1px solid rgb(216 193 141 / 62%);
  padding: 10px 12px;
}

.game-chat-compose textarea {
  display: block;
  width: 100%;
  min-width: 0;
  height: 36px;
  max-height: 96px;
  border: 1px solid rgb(173 135 64 / 36%);
  border-radius: 8px;
  background: rgb(255 249 232 / 86%);
  padding: 8px 10px;
  color: #3f3524;
  font-size: 13px;
  font-weight: 800;
  line-height: 18px;
  outline: none;
  overflow-y: hidden;
  resize: none;
  scrollbar-width: thin;
}

.game-chat-compose textarea:focus {
  border-color: rgb(104 124 69 / 66%);
  box-shadow: 0 0 0 2px rgb(104 124 69 / 14%);
}

.game-chat-compose textarea:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.game-chat-compose button {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid #687c45;
  border-radius: 8px;
  background: #7f9b59;
  color: #fff9df;
  box-shadow: inset 0 0 0 1px rgb(255 249 223 / 22%);
}

.game-chat-compose button:hover:not(:disabled),
.game-chat-compose button:focus-visible {
  background: #6f8f50;
  outline: none;
}

.game-chat-compose button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  filter: saturate(0.4);
}

.game-chat-compose button svg {
  width: 18px;
  height: 18px;
  fill: rgb(255 249 223 / 18%);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.game-chat-spinner {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  color: currentColor;
  animation: game-chat-spin 560ms linear infinite;
}

.game-chat-spinner-track,
.game-chat-spinner-arc {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
}

.game-chat-spinner-track {
  opacity: 0.24;
  stroke-width: 3;
}

.game-chat-spinner-arc {
  opacity: 0.95;
  stroke-dasharray: 15 38;
  stroke-width: 3.6;
}

.game-chat-pop-enter-active,
.game-chat-pop-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.game-chat-pop-enter-from,
.game-chat-pop-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes game-chat-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes game-chat-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .game-chat-panel {
    left: 12px;
    bottom: 12px;
  }

  .game-chat-window {
    width: min(300px, calc(100vw - 24px));
  }

  .game-chat-panel.is-open::before {
    width: min(300px, calc(100vw - 24px));
  }
}

@media (max-width: 640px) {
  .game-chat-window {
    width: min(228px, calc(100vw - 120px));
  }

  .game-chat-panel.is-open::before {
    width: min(228px, calc(100vw - 120px));
  }

  .game-chat-window {
    height: min(390px, calc(100vh - 88px));
  }

  .game-chat-trigger {
    min-height: 34px;
    grid-template-columns: 18px auto;
    gap: 7px;
    padding: 0 11px;
  }

  .game-chat-trigger-icon {
    width: 18px;
    height: 18px;
  }

  .game-chat-trigger-copy strong {
    font-size: 14px;
  }

  .game-chat-trigger-copy small,
  .game-chat-header span,
  .game-chat-meta time {
    font-size: 10px;
  }

  .game-chat-header,
  .game-chat-body,
  .game-chat-compose {
    padding-right: 9px;
    padding-left: 9px;
  }

  .game-chat-message,
  .game-chat-message.is-own {
    gap: 6px;
  }

  .game-chat-bubble {
    padding: 7px 8px;
  }
}
</style>
