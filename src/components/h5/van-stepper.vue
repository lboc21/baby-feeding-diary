<template>
  <view class="h5-stepper">
    <view class="h5-stepper__btn" :class="{ 'is-disabled': current <= min }" @click="stepBy(-1)">−</view>
    <input class="h5-stepper__input" type="number" :value="String(current)" @input="onInput" @blur="onBlur" />
    <view class="h5-stepper__btn" :class="{ 'is-disabled': current >= max }" @click="stepBy(1)">+</view>
  </view>
</template>

<script>
  /**
   * H5 端替代 Vant Weapp 的 van-stepper（仅用于浏览器预览）。
   * 事件参数与小程序一致：change 事件的 e.detail 为数值。
   */
  export default {
    name: 'VanStepper',
    props: {
      value: { type: [Number, String], default: 0 },
      min: { type: [Number, String], default: 0 },
      max: { type: [Number, String], default: 9999 },
      step: { type: [Number, String], default: 1 },
      integer: { type: Boolean, default: false }
    },
    data() {
      return { current: Number(this.value) || 0 };
    },
    watch: {
      value(next) {
        this.current = Number(next) || 0;
      }
    },
    methods: {
      normalize(raw) {
        let next = Number(raw);
        if (isNaN(next)) next = Number(this.min) || 0;
        if (this.integer) next = Math.round(next);
        next = Math.min(Math.max(next, Number(this.min)), Number(this.max));
        return next;
      },
      commit(next) {
        this.current = next;
        this.$emit('change', { detail: next });
      },
      stepBy(direction) {
        this.commit(this.normalize(this.current + direction * Number(this.step)));
      },
      onInput(e) {
        const raw = e.detail ? e.detail.value : e.target.value;
        this.current = raw === '' ? '' : Number(raw);
      },
      onBlur() {
        this.commit(this.normalize(this.current));
      }
    }
  };
</script>

<style scoped>
  .h5-stepper {
    display: flex;
    align-items: center;
    border-radius: 8rpx;
    overflow: hidden;
  }

  .h5-stepper__btn {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f7f8fa;
    color: #323233;
    font-size: 32rpx;
  }

  .h5-stepper__btn.is-disabled {
    color: #c8c9cc;
  }

  .h5-stepper__input {
    width: 120rpx;
    height: 56rpx;
    text-align: center;
    font-size: 28rpx;
    color: #323233;
    background: #f7f8fa;
    margin: 0 2rpx;
  }
</style>
