<template>
  <view class="stat-tile" :style="{ background: bg }">
    <view class="row">
      <text class="value" :style="{ color: color }">{{ value }}</text>
      <text class="unit" v-if="unit">{{ unit }}</text>
    </view>
    <text class="label">{{ label }}</text>
  </view>
</template>

<script>
  export default {
    name: 'StatTile',
    props: {
      value: {
        type: [String, Number],
        default: '0'
      },
      unit: {
        type: String,
        default: ''
      },
      label: {
        type: String,
        default: ''
      },
      color: {
        type: String,
        default: '#2e2a2b'
      },
      bg: {
        type: String,
        default: '#fdf5f2'
      }
    }
  };
</script>

<style scoped>
  .stat-tile {
    flex: 1;
    min-width: 0;
    border-radius: 26rpx;
    padding: 24rpx 20rpx;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  .row {
    flex-wrap: nowrap;
  }

  .value {
    flex-shrink: 0;
    font-size: 40rpx;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 22rpx;
    color: #a39ca0;
    margin-left: 6rpx;
    padding-bottom: 6rpx;
  }

  .label {
    font-size: 22rpx;
    color: #8a8386;
    white-space: nowrap;
  }
</style>
