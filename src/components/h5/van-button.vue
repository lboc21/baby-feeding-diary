<template>
  <view
    class="h5-button"
    :class="['h5-button--' + type, { 'is-block': block, 'is-round': round, 'is-disabled': disabled || loading }]"
    @click="onClick"
  >
    <text class="h5-button__text" v-if="loading">处理中…</text>
    <text class="h5-button__text" v-else><slot /></text>
  </view>
</template>

<script>
  /**
   * H5 端替代 Vant Weapp 的 van-button（仅用于浏览器预览）。
   * 对外事件与小程序一致：tap。
   */
  export default {
    name: 'VanButton',
    props: {
      type: { type: String, default: 'default' },
      round: { type: Boolean, default: false },
      block: { type: Boolean, default: false },
      loading: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false }
    },
    methods: {
      onClick() {
        if (this.disabled || this.loading) return;
        this.$emit('tap');
      }
    }
  };
</script>

<style scoped>
  .h5-button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 88rpx;
    padding: 0 32rpx;
    background: #f2f3f5;
    color: #323233;
    font-size: 32rpx;
    border-radius: 8rpx;
    box-sizing: border-box;
  }

  .h5-button.is-block {
    display: flex;
    width: 100%;
  }

  .h5-button.is-round {
    border-radius: 999rpx;
  }

  .h5-button--primary {
    background: var(--bfd-primary, #ff7b8b);
    color: #fff;
  }

  .h5-button--danger {
    background: #ee0a24;
    color: #fff;
  }

  .h5-button.is-disabled {
    opacity: 0.6;
  }

  .h5-button__text {
    font-size: 32rpx;
    font-weight: 500;
  }
</style>
