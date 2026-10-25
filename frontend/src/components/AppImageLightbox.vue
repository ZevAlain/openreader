<template>
  <div class="app-image-lightbox" @click.self="$emit('close')">
    <img class="app-lightbox-img" :src="images[index]" alt="" @click.stop>
    <button class="app-lightbox-close" type="button" aria-label="关闭预览" @click="$emit('close')">×</button>
    <button v-if="images.length > 1" class="app-lightbox-nav prev" type="button" aria-label="上一张" @click.stop="step(-1)">‹</button>
    <button v-if="images.length > 1" class="app-lightbox-nav next" type="button" aria-label="下一张" @click.stop="step(1)">›</button>
  </div>
</template>

<script setup>
const props = defineProps({
  images: { type: Array, default: () => [] },
  index: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'update:index'])

function step(delta) {
  const total = props.images.length
  if (!total) return
  emit('update:index', (props.index + delta + total) % total)
}
</script>

<style>
.app-image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  place-items: center;
  background: rgba(16, 18, 17, 0.86);
}

.app-lightbox-img {
  max-width: 92vw;
  max-height: 88vh;
  object-fit: contain;
}

.app-lightbox-close,
.app-lightbox-nav {
  position: absolute;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: #fff;
  font-size: 28px;
  background: rgba(255, 255, 255, 0.12);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.app-lightbox-close {
  top: calc(18px + env(safe-area-inset-top));
  right: 18px;
  font-size: 22px;
}

.app-lightbox-nav.prev {
  left: 14px;
}

.app-lightbox-nav.next {
  right: 14px;
}
</style>
