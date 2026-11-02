<template>
  <!-- .stop 编译为 catchtap：阻断原生冒泡，避免冒泡和 emit 各触发一次导致重复跳转 -->
  <view class="record-item" @tap.stop="$emit('tap', record)">
    <view class="time-col">
      <text class="time">{{ timeText }}</text>
    </view>
    <view class="bubble" :style="{ background: meta.bg }">
      <text class="bubble-icon">{{ meta.icon }}</text>
    </view>
    <view class="content">
      <text class="summary">{{ summary }}</text>
      <text class="note" v-if="record.note">{{ record.note }}</text>
    </view>
    <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
  </view>
</template>

<script>
  import { formatTime } from '@/common/utils';
  import { getRecordType, recordSummary } from '@/common/record-schema';

  export default {
    name: 'RecordItem',
    props: {
      record: {
        type: Object,
        required: true
      }
    },
    emits: ['tap'],
    computed: {
      meta() {
        return getRecordType(this.record.type);
      },
      timeText() {
        return formatTime(this.record.time);
      },
      summary() {
        return recordSummary(this.record);
      }
    }
  };
</script>

<style scoped>
  .record-item {
    display: flex;
    align-items: center;
    padding: 22rpx 0;
  }

  .time-col {
    width: 84rpx;
    flex-shrink: 0;
  }

  .time {
    font-size: 24rpx;
    color: #a39ca0;
    font-variant-numeric: tabular-nums;
  }

  .bubble {
    width: 68rpx;
    height: 68rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 22rpx;
    flex-shrink: 0;
  }

  .bubble-icon {
    font-size: 34rpx;
    line-height: 1;
  }

  .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
    padding-right: 12rpx;
  }

  .summary {
    font-size: 29rpx;
    color: #2e2a2b;
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .note {
    font-size: 24rpx;
    color: #a39ca0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
