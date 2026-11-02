<template>
  <view class="h5-icon" :style="iconStyle">
    <text class="h5-icon-glyph" v-if="!isArrow" :style="{ color: color }">·</text>
  </view>
</template>

<script>
  /**
   * H5 端替代 Vant Weapp 的 van-icon（仅用于浏览器预览）。
   * 小程序端仍使用原生 @vant/weapp 组件，本文件不会被打包。
   */
  export default {
    name: 'VanIcon',
    props: {
      name: { type: String, default: '' },
      color: { type: String, default: '#969799' },
      size: { type: [String, Number], default: '32rpx' }
    },
    computed: {
      isArrow() {
        return this.name === 'arrow' || this.name === 'arrow-right';
      },
      pxSize() {
        return typeof this.size === 'number' ? `${this.size}px` : this.size;
      },
      iconStyle() {
        if (!this.isArrow) return { width: this.pxSize, height: this.pxSize };
        return {
          width: this.pxSize,
          height: this.pxSize,
          borderTop: `3rpx solid ${this.color}`,
          borderRight: `3rpx solid ${this.color}`
        };
      }
    }
  };
</script>

<style scoped>
  .h5-icon {
    display: inline-block;
    flex-shrink: 0;
    box-sizing: border-box;
    transform: rotate(45deg);
    margin-right: 6rpx;
  }

  .h5-icon-glyph {
    font-size: 28rpx;
    line-height: 1;
  }
</style>
