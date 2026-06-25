<template>
  <section v-if="abandonDialog.visible" class="game-modal-backdrop">
    <div class="game-modal" :aria-busy="abandonDialog.submitting">
      <header>
        <strong>荒废土地</strong>
        <button type="button" :disabled="abandonDialog.submitting" @click="$emit('closeAbandon')">×</button>
      </header>
      <p>确认将 {{ abandonCoordinate }} 变为草原？地块上的作物会被清空。</p>
      <p v-if="abandonDialog.errorMessage" class="modal-error">{{ abandonDialog.errorMessage }}</p>
      <footer>
        <button type="button" :disabled="abandonDialog.submitting" @click="$emit('closeAbandon')">取消</button>
        <button
            type="button"
            class="danger"
            :class="{ 'is-loading': abandonDialog.submitting }"
            :disabled="abandonDialog.submitting"
            @click="$emit('confirmAbandon')"
        >
          <i v-if="abandonDialog.submitting" class="button-spinner" aria-hidden="true"></i>
          <span>{{ abandonDialog.submitting ? '荒废中' : '确认荒废' }}</span>
        </button>
      </footer>
    </div>
  </section>

  <section v-if="clearCropDialog.visible" class="game-modal-backdrop">
    <div class="game-modal" :aria-busy="clearCropDialog.submitting">
      <header>
        <strong>铲除作物</strong>
        <button type="button" :disabled="clearCropDialog.submitting" @click="$emit('closeClearCrop')">×</button>
      </header>
      <p>确认铲除 {{ clearCropCoordinate }} 上的 {{ clearCropName }}？该操作不可撤销。</p>
      <p v-if="clearCropDialog.errorMessage" class="modal-error">{{ clearCropDialog.errorMessage }}</p>
      <footer>
        <button type="button" :disabled="clearCropDialog.submitting" @click="$emit('closeClearCrop')">取消</button>
        <button
            type="button"
            class="danger"
            :class="{ 'is-loading': clearCropDialog.submitting }"
            :disabled="clearCropDialog.submitting"
            @click="$emit('confirmClearCrop')"
        >
          <i v-if="clearCropDialog.submitting" class="button-spinner" aria-hidden="true"></i>
          <span>{{ clearCropDialog.submitting ? '铲除中' : '确认铲除' }}</span>
        </button>
      </footer>
    </div>
  </section>

  <section v-if="purchaseDialog.visible" class="game-modal-backdrop">
    <div class="game-modal">
      <header>
        <strong>申请购买土地</strong>
        <button type="button" @click="$emit('closePurchase')">×</button>
      </header>
      <p>向 {{ purchaseDialog.tile?.owner }} 发送买地申请。</p>
      <label class="modal-field">
        <span>出价灵石</span>
        <input
            :value="purchaseDialog.price"
            type="number"
            min="1"
            step="1"
            @input="$emit('updatePurchasePrice', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <footer>
        <button type="button" @click="$emit('closePurchase')">取消</button>
        <button type="button" @click="$emit('confirmPurchase')">发送申请</button>
      </footer>
    </div>
  </section>

  <section v-if="claimDialog.visible" class="game-modal-backdrop">
    <div class="game-modal" :aria-busy="claimDialog.submitting">
      <header>
        <strong>{{ claimTitle }}</strong>
        <button type="button" :disabled="claimDialog.submitting" @click="$emit('closeClaim')">×</button>
      </header>
      <p>{{ claimMessage }}</p>
      <p v-if="claimDialog.errorMessage" class="modal-error">{{ claimDialog.errorMessage }}</p>
      <footer>
        <button type="button" :disabled="claimDialog.submitting" @click="$emit('closeClaim')">取消</button>
        <button
            type="button"
            class="modal-primary"
            :class="{ 'is-loading': claimDialog.submitting }"
            :disabled="claimDialog.submitting"
            @click="$emit('confirmClaim')"
        >
          <i v-if="claimDialog.submitting" class="button-spinner" aria-hidden="true"></i>
          <span>{{ claimDialog.submitting ? claimSubmittingLabel : claimConfirmLabel }}</span>
        </button>
      </footer>
    </div>
  </section>

  <section v-if="pioneerGuideDialog.visible" class="game-modal-backdrop">
    <div class="game-modal">
      <header>
        <strong>建立家园</strong>
        <button type="button" @click="$emit('closePioneerGuide')">×</button>
      </header>
      <p>需要先使用开拓令完成开拓，建立家园后才可以继续种植、扩张领地等操作。</p>
      <footer>
        <button type="button" @click="$emit('closePioneerGuide')">稍后</button>
        <button type="button" @click="$emit('confirmPioneerGuide')">进入开拓</button>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import type {
  AbandonDialogState,
  ClaimDialogState,
  ClearCropDialogState,
  PurchaseDialogState,
} from '@/composables/game/useGameDialogs'

interface PioneerGuideDialogState {
  visible: boolean
}

const props = defineProps<{
  abandonDialog: AbandonDialogState
  claimDialog: ClaimDialogState
  clearCropDialog: ClearCropDialogState
  pioneerGuideDialog: PioneerGuideDialogState
  purchaseDialog: PurchaseDialogState
}>()

defineEmits<{
  closeAbandon: []
  closeClaim: []
  closeClearCrop: []
  closePioneerGuide: []
  closePurchase: []
  confirmAbandon: []
  confirmClaim: []
  confirmClearCrop: []
  confirmPioneerGuide: []
  confirmPurchase: []
  updatePurchasePrice: [price: number]
}>()

const abandonCoordinate = computed(() => {
  const tile = props.abandonDialog.tile

  return tile ? `(${tile.x},${tile.y})` : '(--,--)'
})
const clearCropName = computed(() => props.clearCropDialog.tile?.crop || '当前作物')
const clearCropCoordinate = computed(() => {
  const tile = props.clearCropDialog.tile

  return tile ? `${tile.x},${tile.y}` : '--,--'
})
const claimTitle = computed(() => props.claimDialog.mode === 'deed' ? '确认扩张领地' : '确认开拓家园')
const claimConfirmLabel = computed(() => props.claimDialog.mode === 'deed' ? '确认扩张' : '确认开拓')
const claimSubmittingLabel = computed(() => props.claimDialog.mode === 'deed' ? '扩张中' : '开拓中')
const claimMessage = computed(() => {
  const tile = props.claimDialog.tile
  const x = tile?.x ?? '--'
  const y = tile?.y ?? '--'

  if (props.claimDialog.mode === 'deed') {
    return `使用 1 张地契，将 (${x}, ${y}) 这块空地纳入你的领地？`
  }

  return `使用 1 枚开拓令，将 (${x}, ${y}) 起始的 2x2 空地设为初始家园？`
})
</script>

<style>
.game-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  background: rgb(54 61 38 / 18%);
  backdrop-filter: blur(3px);
}

.game-modal {
  width: min(460px, calc(100vw - 32px));
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 96%);
  box-shadow: 0 18px 42px rgb(72 61 36 / 24%);
  padding: 14px;
}

.game-modal header,
.game-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.game-modal header strong {
  font-size: 17px;
}

.game-modal header button {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: #dfc996;
  color: #443721;
  font-weight: 900;
}

.game-modal p {
  margin: 12px 0;
  color: #5f5139;
  line-height: 1.5;
}

.game-modal footer {
  justify-content: flex-end;
  margin-top: 14px;
}

.game-modal footer button {
  min-height: 34px;
  border: 1px solid #b99d62;
  border-radius: 8px;
  background: #fff2cc;
  padding: 0 12px;
  color: #443721;
  font-weight: 800;
}

.game-modal footer button:disabled,
.game-modal header button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.game-modal footer button.modal-primary,
.game-modal footer button:last-child {
  border-color: #687c45;
  background: #7f9b59;
  color: #fff9df;
}

.game-modal footer button.is-loading {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.button-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(255 249 223 / 42%);
  border-top-color: #fff9df;
  border-radius: 50%;
  animation: spin 720ms linear infinite;
}

.modal-error {
  border: 1px solid rgb(195 107 85 / 46%);
  border-radius: 8px;
  background: rgb(255 239 225 / 82%);
  padding: 8px 10px;
  color: #91372f !important;
  font-size: 13px;
  font-weight: 800;
}

.game-modal footer button.danger {
  border-color: #a8463c;
  background: #c94d3f;
}

.modal-field {
  display: grid;
  gap: 6px;
  color: #6b593c;
  font-size: 13px;
  font-weight: 800;
}

.modal-field input {
  width: 100%;
  border: 1px solid #d2bb83;
  border-radius: 8px;
  background: #fff9ea;
  padding: 9px 10px;
  color: #3a3123;
  outline: none;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
