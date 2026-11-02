<template>
  <view class="chips">
    <view
      v-for="opt in options"
      :key="opt.value"
      class="chip"
      :class="{ 'chip-active': isActive(opt.value) }"
      :style="chipStyle(opt.value)"
      @tap="onTap(opt.value)"
    >
      <text class="chip-text">{{ opt.label }}</text>
    </view>
  </view>
</template>

<script>
  import { hexToRgba } from '@/common/utils';

  export default {
    name: 'ChipSelect',
    props: {
      options: {
        type: Array,
        default: () => []
      },
      value: {
        type: [String, Number, Array],
        default: ''
      },
      multiple: {
        type: Boolean,
        default: false
      },
      color: {
        type: String,
        default: '#ff7b8b'
      }
    },
    emits: ['change'],
    methods: {
      isActive(value) {
        if (this.multiple) {
          return Array.isArray(this.value) && this.value.indexOf(value) > -1;
        }
        return this.value === value;
      },
      chipStyle(value) {
        if (!this.isActive(value)) return '';
        return `background:${hexToRgba(this.color, 0.12)};border-color:${hexToRgba(this.color, 0.42)};color:${this.color};`;
      },
      onTap(value) {
        if (this.multiple) {
          const list = Array.isArray(this.value) ? [...this.value] : [];
          const index = list.indexOf(value);
          if (index > -1) list.splice(index, 1);
          else list.push(value);
          this.$emit('change', list);
          return;
        }
        this.$emit('change', value);
      }
    }
  };
</script>

<style scoped>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 68rpx;
    padding: 0 30rpx;
    border-radius: 999rpx;
    background: #fdf5f2;
    border: 2rpx solid transparent;
    transition: all 0.15s ease;
  }

  .chip-text {
    font-size: 26rpx;
    color: #6b6467;
    line-height: 1;
  }

  .chip-active .chip-text {
    font-weight: 600;
  }
</style>
