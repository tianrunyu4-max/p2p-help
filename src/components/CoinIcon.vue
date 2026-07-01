<template>
  <img 
    :src="coinIconUrl" 
    :alt="alt" 
    :class="['coin-icon', sizeClass]"
    :style="customStyle"
  />
</template>

<script setup>
const props = defineProps({
  size: {
    type: String,
    default: 'medium' // small, medium, large, custom
  },
  width: {
    type: String,
    default: null
  },
  height: {
    type: String,
    default: null
  },
  alt: {
    type: String,
    default: 'AI币'
  }
})

const coinIconUrl = '/coin-icon.jpg'

const sizeClass = computed(() => {
  if (props.width || props.height) return 'custom-size'
  return `size-${props.size}`
})

const customStyle = computed(() => {
  const style = {}
  if (props.width) style.width = props.width
  if (props.height) style.height = props.height
  return style
})
</script>

<script>
import { computed } from 'vue'
export default {
  name: 'CoinIcon'
}
</script>

<style scoped>
.coin-icon {
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
}

.size-small {
  width: 16px;
  height: 16px;
}

.size-medium {
  width: 24px;
  height: 24px;
}

.size-large {
  width: 32px;
  height: 32px;
}

.custom-size {
  /* 自定义尺寸由style控制 */
}
</style>
