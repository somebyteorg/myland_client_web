<template>
  <button v-if="collapsed" class="farm-tool-toggle" type="button" @mouseenter="$emit('expand')" @focus="$emit('expand')"
          @click="$emit('toggle')">农具
  </button>

  <section v-if="!collapsed" class="farm-tool-bar" aria-label="农具栏" @mouseleave="$emit('collapse')">
    <GameTooltip :tooltip="tooltip" @update-element="setTooltipElement"/>
    <button
        type="button"
        :class="{ 'is-active': tool === 'inspect' }"
        aria-label="查看"
        @click="handleSelect('inspect')"
        @focus="showInspectTooltip"
        @blur="hideTooltip"
        @mouseenter="showInspectTooltip"
        @mousemove="moveTooltip"
        @mouseleave="hideTooltip"
    >
      ⌖
    </button>
    <button
        type="button"
        :class="{ 'is-active': tool === 'shovel' }"
        aria-label="铲除作物"
        @click="handleSelect('shovel')"
        @focus="showShovelTooltip"
        @blur="hideTooltip"
        @mouseenter="showShovelTooltip"
        @mousemove="moveTooltip"
        @mouseleave="hideTooltip"
    >
      <span class="shovel-icon"></span>
    </button>
    <button
        v-for="plant in availablePlants"
        :key="plant"
        type="button"
        class="seed-tool"
        :class="{ 'is-active': tool === plant }"
        :aria-label="getPlantTooltipTitle(plant)"
        @click="handleSelect(plant)"
        @focus="showPlantTooltip(plant, $event)"
        @blur="hideTooltip"
        @mouseenter="showPlantTooltip(plant, $event)"
        @mousemove="moveTooltip"
        @mouseleave="hideTooltip"
    >
      <span>{{ plantDefinitions[plant]?.item.item_emoji ?? '🌱' }}</span>
      <small>{{ getSeedQuantity(plant) }}</small>
    </button>
  </section>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import GameTooltip from '@/components/game/GameTooltip.vue'
import {useFloatingTooltip} from '@/composables/useFloatingTooltip'
import type {FarmTool, PlantDefinitionMap, PlantType} from '@/game/types'

const props = defineProps<{
  collapsed: boolean
  plants: PlantType[]
  plantDefinitions: PlantDefinitionMap
  seedInventory: Record<number, number>
  tool: FarmTool
}>()

const emit = defineEmits<{
  collapse: []
  expand: []
  select: [tool: FarmTool]
  toggle: []
}>()

const {tooltip, showTooltip, moveTooltip, hideTooltip, setTooltipElement} = useFloatingTooltip()
const availablePlants = computed(() => {
  return props.plants.filter((plant) => Boolean(props.plantDefinitions[plant]) && getSeedQuantity(plant) > 0)
})

function handleSelect(tool: FarmTool) {
  hideTooltip()
  emit('select', tool)
}

function showInspectTooltip(event: MouseEvent | FocusEvent) {
  showTooltip('查看', '查看当前地块或建筑的信息', event)
}

function showShovelTooltip(event: MouseEvent | FocusEvent) {
  showTooltip('铲除作物', '清除当前地块上的作物', event)
}

function showPlantTooltip(plant: PlantType, event: MouseEvent | FocusEvent) {
  showTooltip(getPlantTooltipTitle(plant), getPlantTooltipDescription(plant), event)
}

function getPlantTooltipTitle(plant: PlantType) {
  return props.plantDefinitions[plant]?.item.item_name ?? '未知种子'
}

function getPlantTooltipDescription(plant: PlantType) {
  const description = props.plantDefinitions[plant]?.item.item_description?.trim() || '选择后可在已拥有的地块播种'

  return `${description}\n剩余 ${getSeedQuantity(plant)}`
}

function getSeedQuantity(plant: PlantType) {
  return Math.max(0, Number(props.seedInventory[plant]) || 0)
}
</script>

<style>
.farm-tool-toggle {
  position: absolute;
  left: 18px;
  top: var(--game-left-control-top, 122px);
  z-index: 29;
  min-height: 38px;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 91%);
  padding: 0 14px;
  color: #59482e;
  font-weight: 900;
  box-shadow: 0 10px 24px rgb(72 61 36 / 16%);
  backdrop-filter: blur(10px);
}

.farm-tool-bar {
  position: absolute;
  left: 18px;
  top: var(--game-left-control-top, 122px);
  z-index: 29;
  display: flex;
  max-width: min(520px, calc(100vw - 36px));
  flex-wrap: nowrap;
  gap: 6px;
  overflow-x: auto;
  border: 1px solid #d8c18d;
  border-radius: 8px;
  background: rgb(255 247 223 / 91%);
  padding: 8px;
  box-shadow: 0 14px 32px rgb(72 61 36 / 18%);
  backdrop-filter: blur(10px);
  scrollbar-width: none;
}

.farm-tool-bar::-webkit-scrollbar {
  display: none;
}

.farm-tool-bar button {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #c9ad70;
  border-radius: 8px;
  background: #fff4d4;
  color: #443721;
  font-size: 18px;
  font-weight: 900;
}

.farm-tool-bar button:hover {
  background: #f5dfaa;
}

.farm-tool-bar button.is-active {
  border-color: #687c45;
  background: #7f9b59;
  color: #fff9df;
  box-shadow: inset 0 0 0 2px rgb(255 249 223 / 42%);
}

.farm-tool-bar button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
  filter: saturate(0.35);
}

.seed-tool small {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border: 1px solid #8f7037;
  border-radius: 999px;
  background: #fff8de;
  color: #4a3717;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.shovel-icon {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
  transform: rotate(-35deg);
}

.shovel-icon::before {
  position: absolute;
  left: 8px;
  top: 1px;
  width: 3px;
  height: 17px;
  border-radius: 999px;
  background: currentColor;
  content: '';
}

.shovel-icon::after {
  position: absolute;
  left: 4px;
  bottom: -1px;
  width: 11px;
  height: 9px;
  border: 2px solid currentColor;
  border-top: 0;
  border-radius: 0 0 8px 8px;
  background: rgb(255 249 223 / 42%);
  content: '';
}

@media (max-width: 900px) {
  .farm-tool-toggle,
  .farm-tool-bar {
    left: 12px;
  }
}

@media (max-width: 640px) {
  .farm-tool-bar button {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .farm-tool-bar {
    max-width: min(360px, calc(100vw - 24px));
  }
}
</style>
