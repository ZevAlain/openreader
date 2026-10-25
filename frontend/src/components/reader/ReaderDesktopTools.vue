<template>
  <aside class="reader-left-rail">
    <button class="rail-item" :class="{ active: activePanel === 'shelf' }" type="button" title="书架" @click="$emit('action', 'shelf')">
      <v-icon :icon="mdiBookOpenOutline" size="18" />
      <span>书架</span>
    </button>
    <button class="rail-item" :class="{ active: activePanel === 'source' }" type="button" title="书源" @click="$emit('action', 'source')">
      <v-icon :icon="mdiViewGridOutline" size="18" />
      <span>书源</span>
    </button>
    <button class="rail-item" :class="{ active: activePanel === 'toc' }" type="button" title="目录" @click="$emit('action', 'toc')">
      <v-icon :icon="mdiTableOfContents" size="18" />
      <span>目录</span>
    </button>
    <button class="rail-item" :class="{ active: activePanel === 'settings' }" type="button" title="设置" @click="$emit('action', 'settings')">
      <v-icon :icon="mdiCogOutline" size="18" />
      <span>设置</span>
    </button>
    <button class="rail-item rail-home" type="button" title="返回首页" @click="$emit('action', 'home')">
      <v-icon :icon="mdiArrowLeft" size="18" />
      <span>首页</span>
    </button>
    <button class="rail-item" type="button" title="回到顶部" @click="$emit('action', 'top')">
      <v-icon :icon="mdiArrowUp" size="18" />
      <span>顶部</span>
    </button>
    <button class="rail-item" type="button" title="跳到底部" @click="$emit('action', 'bottom')">
      <v-icon :icon="mdiArrowDown" size="18" />
      <span>底部</span>
    </button>
  </aside>

  <aside class="reader-right-rail">
    <button class="round-tool" type="button" title="书签" @click="$emit('action', 'bookmarks')">
      <v-icon :icon="mdiBookmarkOutline" size="18" />
    </button>
    <button class="round-tool" type="button" title="搜索正文" @click="$emit('action', 'search')">
      <v-icon :icon="mdiMagnify" size="18" />
    </button>
    <button class="round-tool" type="button" title="书籍信息" @click="$emit('action', 'info')">
      <v-icon :icon="mdiInformationOutline" size="18" />
    </button>
    <button class="round-tool" type="button" title="重新载入章节" @click="$emit('action', 'reload')">
      <v-icon :icon="mdiRefresh" size="18" />
    </button>
    <button v-if="autoReadingSupported" class="round-tool" type="button" :class="{ active: autoReading }" title="自动阅读" @click="$emit('action', 'auto-read')">
      <v-icon :icon="mdiEyeOutline" size="18" />
    </button>
    <button v-if="ttsSupported" class="round-tool" type="button" :class="{ active: ttsPlaying }" title="朗读" @click="$emit('action', 'tts')">
      <v-icon :icon="mdiHeadphones" size="18" />
    </button>
    <button class="round-tool" type="button" :title="isNight ? '日间模式' : '夜间模式'" @click="$emit('action', 'night')">
      <v-icon v-if="isNight" :icon="mdiWeatherSunny" size="18" />
      <v-icon v-else :icon="mdiWeatherNight" size="18" />
    </button>
  </aside>
</template>

<script setup>
import {
  mdiArrowDown,
  mdiArrowLeft,
  mdiArrowUp,
  mdiBookOpenOutline,
  mdiBookmarkOutline,
  mdiCogOutline,
  mdiEyeOutline,
  mdiHeadphones,
  mdiInformationOutline,
  mdiMagnify,
  mdiRefresh,
  mdiTableOfContents,
  mdiViewGridOutline,
  mdiWeatherNight,
  mdiWeatherSunny,
} from '@mdi/js'

defineProps({
  autoReading: {
    type: Boolean,
    default: false,
  },
  autoReadingSupported: {
    type: Boolean,
    default: true,
  },
  ttsPlaying: {
    type: Boolean,
    default: false,
  },
  ttsSupported: {
    type: Boolean,
    default: false,
  },
  activePanel: {
    type: String,
    default: '',
  },
  isNight: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['action'])
</script>

<style scoped>
.reader-left-rail {
  position: fixed;
  top: 0;
  bottom: 0;
  left: max(8px, var(--reader-left-x));
  z-index: 5;
  display: grid;
  width: 58px;
  align-content: start;
  background: color-mix(in srgb, var(--reader-popup-bg) 64%, transparent);
  border-right: 1px solid rgba(148, 132, 87, 0.38);
  border-left: 1px solid rgba(148, 132, 87, 0.26);
  backdrop-filter: blur(2px);
}

.rail-item {
  display: grid;
  width: 100%;
  height: 60px;
  place-items: center;
  align-content: center;
  gap: 2px;
  padding: 7px 0 5px;
  color: color-mix(in srgb, var(--reader-popup-text, var(--reader-text)) 72%, transparent);
  background: color-mix(in srgb, var(--reader-popup-bg) 58%, transparent);
  border: 0;
  border-bottom: 1px solid rgba(148, 132, 87, 0.35);
  cursor: pointer;
  font-size: 16px;
}

.rail-item span {
  font-size: 12px;
  line-height: 1;
}

.rail-item:hover {
  color: var(--reader-popup-text, var(--reader-text));
  background: color-mix(in srgb, var(--reader-popup-bg) 82%, transparent);
}

.rail-item.active {
  color: var(--reader-accent, #ed4259);
  background: color-mix(in srgb, var(--reader-popup-bg) 88%, transparent);
}

.rail-item:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.rail-home {
  height: 60px;
  color: var(--reader-popup-text, var(--reader-text));
}

.reader-right-rail {
  position: fixed;
  right: auto;
  bottom: 150px;
  left: var(--reader-right-x);
  z-index: 5;
  display: grid;
  max-height: max(120px, calc(100vh - 170px));
  grid-template-columns: 36px;
  grid-auto-rows: 36px;
  align-content: start;
  gap: 16px;
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-width: none;
}

.reader-right-rail::-webkit-scrollbar {
  display: none;
}

.round-tool {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: var(--reader-popup-text, var(--reader-text));
  background: var(--reader-popup-bg);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(80, 62, 28, 0.08);
  cursor: pointer;
}

.round-tool:hover,
.round-tool.active {
  color: var(--reader-active-text, #0f5451);
  background: var(--reader-popup-bg);
  box-shadow: 0 12px 26px rgba(80, 62, 28, 0.14);
}

.round-tool:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

@media (max-width: 750px) {
  .reader-left-rail,
  .reader-right-rail {
    display: none;
  }
}
</style>
