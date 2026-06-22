<template>
  <Teleport to="body">
    <section
        v-if="visible"
        class="player-statue-dialog-backdrop"
        @click.self="emit('close')"
    >
      <div class="player-statue-dialog" role="dialog" aria-modal="true" aria-labelledby="player-statue-title">
        <header class="player-statue-dialog-header">
          <div>
            <strong id="player-statue-title">建立雕像</strong>
            <span v-if="tileLabel">{{ tileLabel }}</span>
          </div>
          <button
              class="player-statue-close-button"
              type="button"
              :disabled="submitting || exporting"
              aria-label="关闭"
              @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="player-statue-editor">
          <div class="player-statue-preview-shell">
            <canvas
                ref="previewCanvas"
                class="player-statue-preview"
                :class="{ 'is-empty': !sourceImage }"
                @pointerdown="onPreviewPointerDown"
                @pointermove="onPreviewPointerMove"
                @pointerup="onPreviewPointerUp"
                @pointercancel="onPreviewPointerUp"
                @wheel.prevent="onPreviewWheel"
            ></canvas>
          </div>

          <aside class="player-statue-controls">
            <label class="player-statue-name-field">
              <span>雕像名称（必填）</span>
              <input
                  v-model="statueName"
                  type="text"
                  :maxlength="PLAYER_STATUE_NAME_MAX_LENGTH"
                  placeholder="请输入中文名称"
                  :disabled="submitting || exporting"
                  @input="normalizeStatueName"
              />
              <small>建议输入中文，限制为30字内</small>
            </label>

            <input
                ref="fileInput"
                class="player-statue-file-input"
                type="file"
                accept="image/*"
                @change="onFileChange"
            />
            <button class="player-statue-primary-control" type="button" :disabled="submitting" @click="chooseFile">
              选择图像
            </button>
            <span class="player-statue-file-name">{{ imageName || '未选择图像' }}</span>

            <label class="player-statue-slider">
              <span>缩放</span>
              <input
                  v-model.number="editor.zoom"
                  type="range"
                  min="0.55"
                  max="2.6"
                  step="0.01"
                  :disabled="!sourceImage || submitting"
              />
            </label>

            <div class="player-statue-control-row">
              <button type="button" :disabled="!sourceImage || submitting" @click="rotateImage(-90)">左转</button>
              <button type="button" :disabled="!sourceImage || submitting" @click="rotateImage(90)">右转</button>
              <button type="button" :disabled="!sourceImage || submitting" @click="resetTransform">重置</button>
            </div>
          </aside>
        </div>

        <p v-if="displayError" class="player-statue-error">{{ displayError }}</p>

        <footer class="player-statue-dialog-footer">
          <button type="button" :disabled="submitting || exporting" @click="emit('close')">取消</button>
          <button
              class="player-statue-submit-button"
              type="button"
              :disabled="!canSubmit"
              @click="confirm"
          >
            {{ submitting || exporting ? '建立中...' : '建立雕像' }}
          </button>
        </footer>
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, reactive, ref, watch} from 'vue'
import {
  PLAYER_STATUE_IMAGE_QUALITY_STEP,
  PLAYER_STATUE_IMAGE_SIZE,
  PLAYER_STATUE_INITIAL_IMAGE_QUALITY,
  PLAYER_STATUE_MAX_UPLOAD_BYTES,
  PLAYER_STATUE_MIN_IMAGE_QUALITY,
  PLAYER_STATUE_NAME_MAX_LENGTH,
} from '@/game/playerStatueConfig'
import type {Tile} from '@/game/types'

const previewSize = PLAYER_STATUE_IMAGE_SIZE
const outputSize = PLAYER_STATUE_IMAGE_SIZE

const props = defineProps<{
  visible: boolean
  tile: Tile | null
  submitting: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [blob: Blob, statueName: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const sourceImage = ref<HTMLImageElement | null>(null)
const imageObjectUrl = ref('')
const imageName = ref('')
const statueName = ref('')
const localError = ref('')
const exporting = ref(false)
const editor = reactive({
  zoom: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
})
const dragState = reactive({
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  originOffsetX: 0,
  originOffsetY: 0,
})

const tileLabel = computed(() => props.tile ? `(${props.tile.x},${props.tile.y})` : '')
const displayError = computed(() => localError.value || props.errorMessage)
const normalizedStatueName = computed(() => statueName.value.trim())
const canSubmit = computed(() => Boolean(
    sourceImage.value &&
    normalizedStatueName.value &&
    getTextLength(normalizedStatueName.value) <= PLAYER_STATUE_NAME_MAX_LENGTH &&
    !props.submitting &&
    !exporting.value,
))

watch(
    () => props.visible,
    async (visible) => {
      if (!visible) {
        resetDialog()
        return
      }

      localError.value = ''
      await nextTick()
      drawPreview()
    },
)

watch(
    () => [
      sourceImage.value,
      editor.zoom,
      editor.rotation,
      editor.offsetX,
      editor.offsetY,
    ],
    () => drawPreview(),
    {flush: 'post'},
)

onBeforeUnmount(() => {
  revokeImageUrl()
})

function chooseFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return
  if (!file.type.startsWith('image/')) {
    localError.value = '请选择图像文件'
    return
  }

  const nextUrl = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    revokeImageUrl()
    imageObjectUrl.value = nextUrl
    sourceImage.value = image
    imageName.value = file.name
    localError.value = ''
    resetTransform()
  }
  image.onerror = () => {
    URL.revokeObjectURL(nextUrl)
    localError.value = '图像读取失败'
  }
  image.src = nextUrl
}

function rotateImage(degrees: number) {
  editor.rotation = normalizeRotation(editor.rotation + degrees)
}

function resetTransform() {
  editor.zoom = 1
  editor.rotation = 0
  editor.offsetX = 0
  editor.offsetY = 0
}

function onPreviewPointerDown(event: PointerEvent) {
  if (props.submitting || exporting.value) return

  if (!sourceImage.value) {
    chooseFile()
    return
  }

  dragState.active = true
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.originOffsetX = editor.offsetX
  dragState.originOffsetY = editor.offsetY
  previewCanvas.value?.setPointerCapture(event.pointerId)
}

function onPreviewPointerMove(event: PointerEvent) {
  if (!dragState.active || event.pointerId !== dragState.pointerId) return

  const rect = previewCanvas.value?.getBoundingClientRect()
  if (!rect) return

  const scaleX = previewSize / Math.max(1, rect.width)
  const scaleY = previewSize / Math.max(1, rect.height)
  editor.offsetX = clampOffset(dragState.originOffsetX + (event.clientX - dragState.startX) * scaleX)
  editor.offsetY = clampOffset(dragState.originOffsetY + (event.clientY - dragState.startY) * scaleY)
}

function onPreviewPointerUp(event: PointerEvent) {
  if (event.pointerId !== dragState.pointerId) return

  dragState.active = false
  previewCanvas.value?.releasePointerCapture(event.pointerId)
}

function onPreviewWheel(event: WheelEvent) {
  if (!sourceImage.value || props.submitting) return

  const delta = event.deltaY > 0 ? -0.06 : 0.06
  editor.zoom = clamp(editor.zoom + delta, 0.55, 2.6)
}

async function confirm() {
  if (!normalizedStatueName.value) {
    localError.value = '请输入雕像名称'
    return
  }
  if (getTextLength(normalizedStatueName.value) > PLAYER_STATUE_NAME_MAX_LENGTH) {
    localError.value = `雕像名称需限制在${PLAYER_STATUE_NAME_MAX_LENGTH}字内`
    return
  }
  if (!sourceImage.value) {
    localError.value = '请选择图像'
    return
  }
  if (props.submitting || exporting.value) return

  try {
    exporting.value = true
    localError.value = ''
    emit('confirm', await exportEditedImageBlob(), normalizedStatueName.value)
  } catch (error) {
    console.error(error)
    localError.value = '图像处理失败'
  } finally {
    exporting.value = false
  }
}

function normalizeStatueName() {
  const chars = Array.from(statueName.value)
  if (chars.length > PLAYER_STATUE_NAME_MAX_LENGTH) {
    statueName.value = chars.slice(0, PLAYER_STATUE_NAME_MAX_LENGTH).join('')
  }
}

async function exportEditedImageBlob() {
  let quality = PLAYER_STATUE_INITIAL_IMAGE_QUALITY
  let blob = await renderEditedBlob(outputSize, quality)

  while (blob.size > PLAYER_STATUE_MAX_UPLOAD_BYTES && quality > PLAYER_STATUE_MIN_IMAGE_QUALITY) {
    quality -= PLAYER_STATUE_IMAGE_QUALITY_STEP
    blob = await renderEditedBlob(outputSize, quality)
  }

  return blob
}

function renderEditedBlob(size: number, quality: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context || !sourceImage.value) return Promise.reject(new Error('Canvas is unavailable'))

  drawEditedImage(context, sourceImage.value, size)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Image compression failed'))
    }, 'image/jpeg', quality)
  })
}

function drawPreview() {
  const canvas = previewCanvas.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return

  canvas.width = previewSize
  canvas.height = previewSize
  context.clearRect(0, 0, previewSize, previewSize)

  if (sourceImage.value) {
    drawEditedImage(context, sourceImage.value, previewSize)
  } else {
    drawEmptyPreview(context)
  }

  drawPreviewGuide(context)
}

function drawEditedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, size: number) {
  const offsetScale = size / previewSize
  const angle = (editor.rotation * Math.PI) / 180
  const rotatedWidth = Math.abs(Math.cos(angle)) * image.width + Math.abs(Math.sin(angle)) * image.height
  const rotatedHeight = Math.abs(Math.sin(angle)) * image.width + Math.abs(Math.cos(angle)) * image.height
  const imageScale = Math.max(size / rotatedWidth, size / rotatedHeight) * editor.zoom

  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#efe3c7'
  context.fillRect(0, 0, size, size)
  context.translate(size / 2 + editor.offsetX * offsetScale, size / 2 + editor.offsetY * offsetScale)
  context.rotate(angle)
  context.drawImage(
      image,
      -image.width * imageScale / 2,
      -image.height * imageScale / 2,
      image.width * imageScale,
      image.height * imageScale,
  )
  context.restore()
}

function drawEmptyPreview(context: CanvasRenderingContext2D) {
  const center = previewSize / 2
  const outerRadius = previewSize / 2 - 8
  const innerRadius = previewSize / 2 - 36
  const gradient = context.createRadialGradient(center - 46, center - 58, 16, center, center, outerRadius)
  gradient.addColorStop(0, '#fff3cf')
  gradient.addColorStop(0.58, '#d9c291')
  gradient.addColorStop(1, '#8f7650')
  context.fillStyle = gradient
  context.fillRect(0, 0, previewSize, previewSize)

  context.fillStyle = 'rgba(64, 49, 30, 0.18)'
  context.beginPath()
  context.arc(center + 8, center + 10, outerRadius - 2, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = 'rgba(255, 249, 223, 0.22)'
  context.beginPath()
  context.arc(center, center, outerRadius - 4, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = 'rgba(92, 70, 34, 0.16)'
  context.beginPath()
  context.arc(center, center, innerRadius, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = 'rgba(92, 70, 34, 0.24)'
  context.beginPath()
  context.ellipse(center, center - 26, 24, 31, 0, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.ellipse(center, center + 42, 48, 25, 0, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = 'rgba(255, 249, 223, 0.36)'
  context.lineWidth = 6
  context.beginPath()
  context.arc(center, center, outerRadius - 18, -2.7, -0.62)
  context.stroke()
}

function drawPreviewGuide(context: CanvasRenderingContext2D) {
  const center = previewSize / 2
  const outerRadius = previewSize / 2 - 5
  const innerRadius = previewSize / 2 - 21

  context.save()
  context.strokeStyle = 'rgba(255, 249, 223, 0.9)'
  context.lineWidth = 5
  context.beginPath()
  context.arc(center, center, outerRadius, 0, Math.PI * 2)
  context.stroke()

  context.strokeStyle = 'rgba(60, 46, 24, 0.58)'
  context.lineWidth = 2
  context.setLineDash([7, 6])
  context.beginPath()
  context.arc(center, center, innerRadius, 0, Math.PI * 2)
  context.stroke()
  context.setLineDash([])

  context.strokeStyle = 'rgba(255, 249, 223, 0.95)'
  context.lineWidth = 4
  context.beginPath()
  context.arc(center, center, innerRadius + 12, -2.6, -0.72)
  context.stroke()
  context.restore()
}

function resetDialog() {
  sourceImage.value = null
  imageName.value = ''
  statueName.value = ''
  localError.value = ''
  resetTransform()
  revokeImageUrl()
}

function revokeImageUrl() {
  if (!imageObjectUrl.value) return

  URL.revokeObjectURL(imageObjectUrl.value)
  imageObjectUrl.value = ''
}

function normalizeRotation(degrees: number) {
  return ((degrees % 360) + 360) % 360
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampOffset(value: number) {
  return clamp(value, -previewSize, previewSize)
}

function getTextLength(value: string) {
  return Array.from(value).length
}
</script>

<style>
.player-statue-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  background: rgb(31 42 28 / 48%);
  padding: 18px;
  backdrop-filter: blur(5px);
}

.player-statue-dialog {
  box-sizing: border-box;
  display: grid;
  width: min(678px, calc(100vw - 28px));
  max-height: calc(100vh - 28px);
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid #c8ac72;
  border-radius: 8px;
  background: rgb(255 247 223 / 96%);
  box-shadow: 0 24px 64px rgb(42 48 28 / 34%);
}

.player-statue-dialog-header,
.player-statue-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
}

.player-statue-dialog-header {
  border-bottom: 1px solid #d8c18d;
}

.player-statue-dialog-header div {
  display: grid;
  gap: 2px;
}

.player-statue-dialog-header strong {
  color: #3a3123;
  font-size: 16px;
  line-height: 1.1;
}

.player-statue-dialog-header span,
.player-statue-file-name {
  color: #806b48;
  font-size: 12px;
  font-weight: 800;
}

.player-statue-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-statue-close-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: #fff8de;
  color: #4a3717;
  font-size: 22px;
  line-height: 1;
}

.player-statue-editor {
  display: grid;
  grid-template-columns: minmax(0, 330px) minmax(0, 280px);
  gap: 18px;
  padding: 16px;
}

.player-statue-preview-shell {
  display: grid;
  min-height: 0;
  place-items: center;
}

.player-statue-preview {
  width: 320px;
  max-width: 100%;
  aspect-ratio: 1;
  border: 1px solid #a58752;
  border-radius: 50%;
  background: #efe3c7;
  box-shadow: 0 16px 34px rgb(72 61 36 / 18%),
  inset 0 0 0 4px rgb(255 249 223 / 46%);
  cursor: grab;
  touch-action: none;
}

.player-statue-preview.is-empty {
  border-style: dashed;
  border-color: #8e7446;
  background: #efe3c7;
  box-shadow: 0 18px 36px rgb(72 61 36 / 18%),
  inset 0 0 0 6px rgb(255 249 223 / 42%),
  inset 0 0 0 15px rgb(91 68 32 / 7%);
  cursor: pointer;
}

.player-statue-preview:active {
  cursor: grabbing;
}

.player-statue-controls {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 12px;
}

.player-statue-file-input {
  display: none;
}

.player-statue-name-field {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: #59482e;
  font-size: 12px;
  font-weight: 900;
}

.player-statue-name-field input {
  min-width: 0;
  height: 34px;
  border: 1px solid #c8ac72;
  border-radius: 8px;
  background: #fff8de;
  padding: 0 9px;
  color: #3a3123;
  font-size: 13px;
  font-weight: 800;
  outline: none;
}

.player-statue-name-field input:focus {
  border-color: #647f43;
  box-shadow: 0 0 0 2px rgb(100 127 67 / 16%);
}

.player-statue-name-field small {
  overflow: hidden;
  color: #806b48;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-statue-controls button,
.player-statue-dialog-footer button {
  min-height: 36px;
  border: 1px solid #c8ac72;
  border-radius: 8px;
  background: #fff8de;
  padding: 0 12px;
  color: #443721;
  font-size: 13px;
  font-weight: 900;
}

.player-statue-primary-control,
.player-statue-submit-button {
  border-color: #647f43 !important;
  background: #6f8f50 !important;
  color: #fff9df !important;
}

.player-statue-slider {
  display: grid;
  gap: 8px;
  color: #59482e;
  font-size: 12px;
  font-weight: 900;
}

.player-statue-slider input {
  width: 100%;
  accent-color: #6f8f50;
}

.player-statue-control-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.player-statue-control-row button {
  padding: 0 8px;
}

.player-statue-error {
  margin: 0 16px;
  border: 1px solid #c36b55;
  border-radius: 8px;
  background: rgb(255 239 225 / 94%);
  padding: 9px 10px;
  color: #91372f;
  font-size: 13px;
  font-weight: 800;
}

.player-statue-dialog-footer {
  border-top: 1px solid #d8c18d;
}

.player-statue-dialog-footer {
  justify-content: flex-end;
}

.player-statue-controls button:disabled,
.player-statue-dialog-footer button:disabled,
.player-statue-close-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

@media (max-width: 720px) {
  .player-statue-editor {
    grid-template-columns: 1fr;
  }

  .player-statue-controls {
    grid-template-columns: 1fr;
  }
}
</style>
