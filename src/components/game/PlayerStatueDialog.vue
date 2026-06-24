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
            <canvas ref="mapPreviewCanvas" class="player-statue-map-preview"></canvas>
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

            <div class="player-statue-material-group">
              <span>创建方式</span>
              <div class="player-statue-segment-options">
                <button
                    v-for="mode in playerStatueCreateModes"
                    :key="mode.id"
                    type="button"
                    :class="{ 'is-active': editor.mode === mode.id }"
                    :disabled="submitting || exporting"
                    @click="editor.mode = mode.id"
                >
                  {{ mode.label }}
                </button>
              </div>
              <small v-if="editor.mode === 'simple'" class="player-statue-field-note">建议上传 512px 左右的透明 PNG 或 WebP 成品图</small>
            </div>

            <template v-if="editor.mode === 'generated'">
              <div class="player-statue-material-group">
                <span>图像效果</span>
                <div class="player-statue-segment-options">
                  <button
                      v-for="mode in playerStatueArtModes"
                      :key="mode.id"
                      type="button"
                      :class="{ 'is-active': editor.artMode === mode.id }"
                      :disabled="submitting || exporting"
                      @click="editor.artMode = mode.id"
                  >
                    {{ mode.label }}
                  </button>
                </div>
              </div>

              <div class="player-statue-material-group">
                <span>雕像样式</span>
                <div class="player-statue-compact-options">
                  <button
                      v-for="shape in playerStatueShapes"
                      :key="shape.id"
                      type="button"
                      :class="{ 'is-active': editor.shapeId === shape.id }"
                      :disabled="submitting || exporting"
                      @click="editor.shapeId = shape.id"
                  >
                    {{ shape.label }}
                  </button>
                </div>
              </div>

              <div v-if="editor.artMode === 'statue'" class="player-statue-material-group">
                <span>材质</span>
                <div class="player-statue-material-options">
                  <button
                      v-for="material in playerStatueMaterials"
                      :key="material.id"
                      type="button"
                      :class="{ 'is-active': editor.materialId === material.id }"
                      :disabled="submitting || exporting"
                      @click="editor.materialId = material.id"
                  >
                    {{ material.label }}
                  </button>
                </div>
              </div>

              <div class="player-statue-material-group">
                <span>背景</span>
                <div class="player-statue-compact-options">
                  <button
                      v-for="background in playerStatueBackgrounds"
                      :key="background.id"
                      type="button"
                      :class="{ 'is-active': editor.backgroundId === background.id }"
                      :disabled="submitting || exporting"
                      @click="selectBackground(background.id)"
                  >
                    {{ background.label }}
                  </button>
                </div>
                <input
                    ref="backgroundInput"
                    class="player-statue-file-input"
                    type="file"
                    accept="image/*"
                    @change="onBackgroundFileChange"
                />
                <span v-if="backgroundName" class="player-statue-file-name">{{ backgroundName }}</span>
              </div>

              <label v-if="editor.backgroundId === 'custom'" class="player-statue-slider">
                <span>背景图大小</span>
                <input
                    v-model.number="editor.backgroundScale"
                    type="range"
                    min="0.55"
                    max="1.35"
                    step="0.01"
                    :disabled="submitting || exporting"
                />
              </label>

              <div class="player-statue-material-group">
                <span>文字区域</span>
                <div class="player-statue-nameplate-options">
                  <button
                      v-for="nameplate in playerStatueNameplates"
                      :key="nameplate.id"
                      type="button"
                      :class="{ 'is-active': editor.nameplateId === nameplate.id }"
                      :disabled="submitting || exporting"
                      @click="editor.nameplateId = nameplate.id"
                  >
                    <i :style="{ background: nameplate.plate, borderColor: nameplate.border }"></i>
                    {{ nameplate.label }}
                  </button>
                </div>
              </div>
            </template>

            <label class="player-statue-slider">
              <span>{{ editor.mode === 'simple' ? '裁剪缩放' : '缩放' }}</span>
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
  PLAYER_STATUE_IMAGE_SIZE,
  PLAYER_STATUE_NAME_MAX_LENGTH,
} from '@/game/playerStatueConfig'
import {
  drawGeneratedPlayerStatue,
  drawGeneratedPlayerStatueEmpty,
  drawGeneratedPlayerStatueMapPreview,
  drawSimplePlayerStatue,
  exportGeneratedPlayerStatueBlob,
  exportSimplePlayerStatueBlob,
  playerStatueArtModes,
  playerStatueBackgrounds,
  playerStatueCreateModes,
  playerStatueMaterials,
  playerStatueNameplates,
  playerStatueShapes,
} from '@/game/playerStatueImage'
import type {
  PlayerStatueArtMode,
  PlayerStatueBackgroundId,
  PlayerStatueCreateMode,
  PlayerStatueGenerationSettings,
  PlayerStatueMaterialId,
  PlayerStatueNameplateId,
  PlayerStatueShapeId,
} from '@/game/playerStatueImage'
import type {Tile} from '@/game/types'

const previewSize = PLAYER_STATUE_IMAGE_SIZE
const mapPreviewWidth = 300
const mapPreviewHeight = 190

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
const backgroundInput = ref<HTMLInputElement | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const mapPreviewCanvas = ref<HTMLCanvasElement | null>(null)
const sourceImage = ref<HTMLImageElement | null>(null)
const backgroundImage = ref<HTMLImageElement | null>(null)
const imageObjectUrl = ref('')
const backgroundObjectUrl = ref('')
const imageName = ref('')
const backgroundName = ref('')
const statueName = ref('')
const localError = ref('')
const exporting = ref(false)
const editor = reactive({
  artMode: 'statue' as PlayerStatueArtMode,
  backgroundId: 'none' as PlayerStatueBackgroundId,
  backgroundScale: 1,
  materialId: 'stone' as PlayerStatueMaterialId,
  mode: 'simple' as PlayerStatueCreateMode,
  nameplateId: 'dark' as PlayerStatueNameplateId,
  shapeId: 'person' as PlayerStatueShapeId,
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
      backgroundImage.value,
      editor.mode,
      editor.artMode,
      editor.backgroundId,
      editor.backgroundScale,
      editor.materialId,
      editor.nameplateId,
      editor.shapeId,
      editor.zoom,
      editor.rotation,
      editor.offsetX,
      editor.offsetY,
      normalizedStatueName.value,
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

function selectBackground(backgroundId: PlayerStatueBackgroundId) {
  if (backgroundId === 'custom') {
    if (backgroundImage.value) editor.backgroundId = 'custom'
    backgroundInput.value?.click()
    return
  }

  editor.backgroundId = backgroundId
}

function onBackgroundFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return
  if (!file.type.startsWith('image/')) {
    localError.value = '请选择背景图像文件'
    return
  }

  const nextUrl = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    revokeBackgroundUrl()
    backgroundObjectUrl.value = nextUrl
    backgroundImage.value = image
    backgroundName.value = file.name
    editor.backgroundId = 'custom'
    localError.value = ''
  }
  image.onerror = () => {
    URL.revokeObjectURL(nextUrl)
    localError.value = '背景图像读取失败'
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
    emit('confirm', await exportPlayerStatueBlob(), normalizedStatueName.value)
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

function drawPreview() {
  const canvas = previewCanvas.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return

  canvas.width = previewSize
  canvas.height = previewSize

  if (editor.mode === 'simple') {
    drawSimplePlayerStatue(context, sourceImage.value, previewSize, createTransform())
    drawMapPreview()
    return
  }

  if (sourceImage.value) {
    drawGeneratedPlayerStatue(context, {
      artMode: editor.artMode,
      backgroundId: editor.backgroundId,
      backgroundImage: backgroundImage.value,
      backgroundScale: editor.backgroundScale,
      image: sourceImage.value,
      inscription: normalizedStatueName.value,
      materialId: editor.materialId,
      nameplateId: editor.nameplateId,
      shapeId: editor.shapeId,
      size: previewSize,
      transform: createTransform(),
    })
  } else {
    drawGeneratedPlayerStatueEmpty(context, previewSize, createCreateOptions(), normalizedStatueName.value)
  }

  drawMapPreview()
}

function drawMapPreview() {
  const canvas = mapPreviewCanvas.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return

  canvas.width = mapPreviewWidth
  canvas.height = mapPreviewHeight
  if (editor.mode === 'simple') {
    drawSimpleMapPreview(context, sourceImage.value)
    return
  }

  drawGeneratedPlayerStatueMapPreview(context, {
    artMode: editor.artMode,
    backgroundId: editor.backgroundId,
    backgroundImage: backgroundImage.value,
    backgroundScale: editor.backgroundScale,
    height: mapPreviewHeight,
    image: sourceImage.value,
    inscription: normalizedStatueName.value,
    materialId: editor.materialId,
    nameplateId: editor.nameplateId,
    shapeId: editor.shapeId,
    size: previewSize,
    transform: createTransform(),
    width: mapPreviewWidth,
  })
}

function drawSimpleMapPreview(context: CanvasRenderingContext2D, image: HTMLImageElement | null) {
  const tile = Math.min(74, Math.floor(Math.min(mapPreviewWidth / 3.35, mapPreviewHeight / 2.95)))
  const left = (mapPreviewWidth - tile * 2) / 2
  const top = mapPreviewHeight * 0.2

  context.clearRect(0, 0, mapPreviewWidth, mapPreviewHeight)
  const gradient = context.createLinearGradient(0, 0, 0, mapPreviewHeight)
  gradient.addColorStop(0, '#d9ead4')
  gradient.addColorStop(1, '#b6d5a6')
  context.fillStyle = gradient
  context.fillRect(0, 0, mapPreviewWidth, mapPreviewHeight)

  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) {
      context.fillStyle = (x + y) % 2 === 0 ? '#91c86d' : '#86bd65'
      context.fillRect(left + x * tile, top + y * tile, tile, tile)
      context.strokeStyle = 'rgba(72, 105, 50, 0.35)'
      context.lineWidth = 1.2
      context.strokeRect(left + x * tile + 0.5, top + y * tile + 0.5, tile - 1, tile - 1)
    }
  }

  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = previewSize
  previewCanvas.height = previewSize
  const previewContext = previewCanvas.getContext('2d')
  if (!previewContext) return

  drawSimplePlayerStatue(previewContext, image, previewSize, createTransform())
  context.drawImage(previewCanvas, left, top, tile * 2, tile * 2)
}

async function exportPlayerStatueBlob() {
  if (!sourceImage.value) throw new Error('Image is required')

  if (editor.mode === 'simple') {
    return exportSimplePlayerStatueBlob(sourceImage.value, createTransform())
  }

  return exportGeneratedPlayerStatueBlob({
    artMode: editor.artMode,
    backgroundId: editor.backgroundId,
    backgroundImage: backgroundImage.value,
    backgroundScale: editor.backgroundScale,
    image: sourceImage.value,
    inscription: normalizedStatueName.value,
    materialId: editor.materialId,
    nameplateId: editor.nameplateId,
    shapeId: editor.shapeId,
    transform: createTransform(),
  })
}

function createTransform() {
  return {
    offsetX: editor.offsetX,
    offsetY: editor.offsetY,
    rotation: editor.rotation,
    zoom: editor.zoom,
  }
}

function createCreateOptions(): PlayerStatueGenerationSettings {
  return {
    artMode: editor.artMode,
    backgroundId: editor.backgroundId,
    backgroundScale: editor.backgroundScale,
    materialId: editor.materialId,
    mode: editor.mode,
    nameplateId: editor.nameplateId,
    shapeId: editor.shapeId,
  }
}

function resetDialog() {
  sourceImage.value = null
  backgroundImage.value = null
  imageName.value = ''
  backgroundName.value = ''
  statueName.value = ''
  localError.value = ''
  editor.artMode = 'statue'
  editor.backgroundId = 'none'
  editor.backgroundScale = 1
  editor.materialId = 'stone'
  editor.mode = 'simple'
  editor.nameplateId = 'dark'
  editor.shapeId = 'person'
  resetTransform()
  revokeImageUrl()
  revokeBackgroundUrl()
}

function revokeImageUrl() {
  if (!imageObjectUrl.value) return

  URL.revokeObjectURL(imageObjectUrl.value)
  imageObjectUrl.value = ''
}

function revokeBackgroundUrl() {
  if (!backgroundObjectUrl.value) return

  URL.revokeObjectURL(backgroundObjectUrl.value)
  backgroundObjectUrl.value = ''
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
  width: min(760px, calc(100vw - 28px));
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
  grid-template-columns: minmax(0, 340px) minmax(0, 348px);
  gap: 18px;
  padding: 16px;
}

.player-statue-preview-shell {
  display: grid;
  min-height: 0;
  place-items: center;
  gap: 12px;
}

.player-statue-preview {
  width: 320px;
  max-width: 100%;
  aspect-ratio: 1;
  border: 1px solid #b99e69;
  border-radius: 8px;
  background:
      linear-gradient(45deg, rgb(120 101 63 / 9%) 25%, transparent 25%),
      linear-gradient(-45deg, rgb(120 101 63 / 9%) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgb(120 101 63 / 9%) 75%),
      linear-gradient(-45deg, transparent 75%, rgb(120 101 63 / 9%) 75%),
      #fff8de;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
  box-shadow: 0 16px 34px rgb(72 61 36 / 18%),
  inset 0 0 0 1px rgb(255 249 223 / 66%);
  cursor: grab;
  touch-action: none;
}

.player-statue-preview.is-empty {
  border-color: #8e7446;
  box-shadow: 0 18px 36px rgb(72 61 36 / 18%),
  inset 0 0 0 1px rgb(255 249 223 / 66%),
  inset 0 0 0 12px rgb(91 68 32 / 6%);
  cursor: pointer;
}

.player-statue-preview:active {
  cursor: grabbing;
}

.player-statue-map-preview {
  width: 300px;
  max-width: 100%;
  height: auto;
  border: 1px solid #b99e69;
  border-radius: 8px;
  background: #d9ead4;
  box-shadow: inset 0 0 0 1px rgb(255 249 223 / 38%);
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

.player-statue-material-group {
  display: grid;
  gap: 8px;
  color: #59482e;
  font-size: 12px;
  font-weight: 900;
}

.player-statue-material-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.player-statue-nameplate-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.player-statue-compact-options,
.player-statue-segment-options {
  display: grid;
  gap: 7px;
}

.player-statue-compact-options {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.player-statue-segment-options {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.player-statue-compact-options button,
.player-statue-material-options button,
.player-statue-nameplate-options button,
.player-statue-segment-options button {
  min-height: 34px;
  padding: 0 6px;
}

.player-statue-nameplate-options button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.player-statue-nameplate-options i {
  box-sizing: border-box;
  display: block;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  border: 1px solid currentColor;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 24%);
}

.player-statue-compact-options button {
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.player-statue-compact-options button.is-active,
.player-statue-material-options button.is-active,
.player-statue-nameplate-options button.is-active {
  border-color: #647f43;
  background: #e8efd7;
  color: #384927;
  box-shadow: inset 0 0 0 1px rgb(100 127 67 / 22%);
}

.player-statue-segment-options button.is-active {
  border-color: #647f43;
  background: #e8efd7;
  color: #384927;
  box-shadow: inset 0 0 0 1px rgb(100 127 67 / 22%);
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

  .player-statue-compact-options {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>
