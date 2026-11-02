<template>
  <view class="chart">
    <view class="chart-body">
      <view class="y-axis" v-if="!isEmpty">
        <text class="y-text">{{ maxLabel }}</text>
        <text class="y-text">{{ midLabel }}</text>
        <text class="y-text">0</text>
      </view>
      <view class="bars is-empty" v-if="isEmpty">
        <text class="chart-empty-text">这段时间还没有数据</text>
      </view>
      <view class="bars" v-else>
        <view class="bar-col" v-for="(item, index) in data" :key="index">
          <view class="bar-track">
            <view class="bar" :style="{ height: heightOf(item.value), background: gradient }">
              <text class="bar-value" v-if="item.value && showValue">{{ item.value }}</text>
            </view>
          </view>
          <text class="bar-label">{{ item.label }}</text>
        </view>
      </view>
    </view>
    <view class="legend" v-if="legend">
      <view class="type-dot" :style="{ background: color }"></view>
      <text class="legend-text">{{ legend }}</text>
    </view>
  </view>
</template>

<script>
  export default {
    name: 'BarChart',
    props: {
      data: {
        type: Array,
        default: () => []
      },
      color: {
        type: String,
        default: '#ff7b8b'
      },
      legend: {
        type: String,
        default: ''
      },
      unit: {
        type: String,
        default: ''
      },
      showValue: {
        type: Boolean,
        default: true
      }
    },
    computed: {
      /** 全部为 0 时不画柱子，避免出现一排“假加载”的小短线 */
      isEmpty() {
        return !this.data.some(item => Number(item.value) > 0);
      },
      max() {
        const values = this.data.map(item => Number(item.value) || 0);
        const raw = Math.max(...values, 0);
        return raw > 0 ? this.niceCeil(raw) : 1;
      },
      maxLabel() {
        return `${Math.round(this.max)}${this.unit}`;
      },
      /** 中间刻度：避免 max=1 时与顶部重复显示 1 */
      midLabel() {
        const mid = this.max / 2;
        return Number.isInteger(mid) ? String(mid) : mid.toFixed(1);
      },
      gradient() {
        return `linear-gradient(180deg, ${this.color}, ${this.color}cc)`;
      }
    },
    methods: {
      /** 把最大值吸附到 1x / 1.5x / 2x × 10^n，坐标轴读数更整净 */
      niceCeil(value) {
        if (value <= 5) return Math.ceil(value);
        const step = Math.pow(10, Math.floor(Math.log10(value)));
        return (Math.ceil((value / step) * 2) / 2) * step;
      },
      heightOf(value) {
        const ratio = (Number(value) || 0) / this.max;
        if (!ratio) return '4rpx';
        return `${Math.max(ratio * 100, 8)}%`;
      }
    }
  };
</script>

<style scoped>
  .chart {
    width: 100%;
  }

  .chart-body {
    display: flex;
    align-items: stretch;
    height: 300rpx;
  }

  .y-axis {
    width: 72rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-bottom: 36rpx;
  }

  .y-text {
    font-size: 20rpx;
    color: #c0b9bc;
    text-align: right;
    padding-right: 12rpx;
  }

  .bars {
    flex: 1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 1rpx solid #f4ebe8;
  }

  .bars.is-empty {
    align-items: center;
    justify-content: center;
  }

  .chart-empty-text {
    font-size: 22rpx;
    color: #c0b9bc;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .bar-track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8rpx;
  }

  .bar {
    width: 56%;
    max-width: 40rpx;
    min-width: 6rpx;
    border-radius: 18rpx 18rpx 6rpx 6rpx;
    position: relative;
    transition: height 0.3s ease;
  }

  .bar-value {
    position: absolute;
    top: -30rpx;
    left: 50%;
    transform: translateX(-50%);
    font-size: 20rpx;
    color: #8a8386;
    white-space: nowrap;
  }

  .bar-label {
    font-size: 20rpx;
    color: #a39ca0;
    padding-top: 14rpx;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 10rpx;
    padding-top: 18rpx;
  }

  .legend-text {
    font-size: 22rpx;
    color: #a39ca0;
  }
</style>
