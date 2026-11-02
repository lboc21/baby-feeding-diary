<template>
  <view class="h5-switch" :class="{ 'is-on': checked }" :style="trackStyle" @click="toggle">
    <view class="h5-switch__dot" :style="dotStyle"></view>
  </view>
</template>

<script>
  /**
   * H5 端替代 Vant Weapp 的 van-switch（仅用于浏览器预览）。
   * 事件参数与小程序一致：change 事件的 e.detail 为布尔值。
   */
  export default {
    name: 'VanSwitch',
    props: {
      checked: { type: Boolean, default: false },
      size: { type: [Number, String], default: 30 },
      disabled: { type: Boolean, default: false }
    },
    computed: {
      pxSize() {
        return Number(this.size) || 30;
      },
      trackStyle() {
        const h = this.pxSize;
        return { width: `${h * 2}px`, height: `${h}px` };
      },
      dotStyle() {
        const h = this.pxSize;
        return { width: `${h - 4}px`, height: `${h - 4}px` };
      }
    },
    methods: {
      toggle() {
        if (this.disabled) return;
        this.$emit('change', { detail: !this.checked });
      }
    }
  };
</script>

<style scoped>
  .h5-switch {
    display: inline-flex;
    align-items: center;
    padding: 2px;
    box-sizing: border-box;
    border-radius: 999px;
    background: #e8e8e8;
    transition: background 0.2s ease;
  }

  .h5-switch.is-on {
    background: var(--bfd-primary, #ff7b8b);
  }

  .h5-switch__dot {
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
    transition: transform 0.2s ease;
  }

  .h5-switch.is-on .h5-switch__dot {
    transform: translateX(100%);
  }
</style>
