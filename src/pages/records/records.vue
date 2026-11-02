<template>
  <view class="page">
    <view class="header" :style="headerStyle">
      <view class="row between header-top" :style="titleRowStyle">
        <text class="title">记录</text>
        <view class="back-today" v-if="!isTodayToday" @tap="backToToday">
          <text class="back-today-text">回到今天</text>
        </view>
      </view>

      <view class="date-bar">
        <view class="arrow" @tap="moveDay(-1)">‹</view>
        <picker mode="date" :value="dateStr" :end="todayStr" @change="onDatePick">
          <view class="date-center">
            <text class="date-main">{{ dateLabel }}</text>
            <text class="date-sub">{{ weekdayLabel }} · {{ dayRecords.length }} 条记录</text>
          </view>
        </picker>
        <view class="arrow" :class="{ disabled: isTodayToday }" @tap="moveDay(1)">›</view>
      </view>

      <scroll-view scroll-x class="filter-scroller" :show-scrollbar="false">
        <view class="filter-tabs">
          <text class="filter-pill" :class="{ active: filter === 'all' }" @tap="filter = 'all'">全部</text>
          <text
            v-for="item in types"
            :key="item.key"
            class="filter-pill"
            :class="{ active: filter === item.key }"
            @tap="filter = item.key"
          >
            {{ item.icon }} {{ item.name }}
          </text>
        </view>
      </scroll-view>
    </view>

    <view class="page-body">
      <!-- 当日摘要 -->
      <view class="summary-row" v-if="summaryList.length">
        <view class="summary-chip" v-for="item in summaryList" :key="item.key">
          <text class="summary-emoji">{{ item.icon }}</text>
          <text class="summary-text">{{ item.name }} {{ item.count }}</text>
        </view>
      </view>

      <view class="card list-card">
        <view class="empty-block" v-if="!filteredRecords.length">
          <text class="empty-emoji">🍼</text>
          <text class="empty-text">{{ filter === 'all' ? '这一天还没有记录' : '这一天还没有相关记录' }}</text>
          <view class="empty-btn" @tap="addForDate">
            <text class="empty-btn-text">去记录</text>
          </view>
        </view>
        <view v-else>
          <record-item v-for="item in filteredRecords" :key="item.id" :record="item" @tap="openRecord(item)" />
        </view>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { recordsOfDay, can } from '@/store';
  import { RECORD_TYPES, RECORD_TYPE_MAP } from '@/common/record-schema';
  import { navMetrics, formatDate, formatMonthDay, weekdayText, parseDateTime, isToday, addDays } from '@/common/utils';
  import RecordItem from '@/components/record-item.vue';

  export default {
    components: { RecordItem },
    data() {
      const now = Date.now();
      return {
        types: RECORD_TYPES,
        currentDay: now,
        dateStr: formatDate(now),
        todayStr: formatDate(now),
        filter: 'all'
      };
    },
    computed: {
      // 自定义导航栏：顶部状态栏留白
      headerStyle() {
        return { paddingTop: `${navMetrics().statusBar}px` };
      },
      // 仅标题行需要避开右上角胶囊，下方日期栏与筛选条保持满宽度
      titleRowStyle() {
        return { paddingRight: `${navMetrics().rowRightPad}px` };
      },
      isTodayToday() {
        return isToday(this.currentDay);
      },
      dateLabel() {
        if (isToday(this.currentDay)) return '今天';
        const diff = Math.round(
          (parseDateTime(this.todayStr, '00:00') - parseDateTime(this.dateStr, '00:00')) / 86400000
        );
        if (diff === 1) return '昨天';
        return formatMonthDay(this.currentDay);
      },
      weekdayLabel() {
        return weekdayText(this.currentDay);
      },
      dayRecords() {
        return recordsOfDay(this.currentDay);
      },
      filteredRecords() {
        if (this.filter === 'all') return this.dayRecords;
        return this.dayRecords.filter(item => item.type === this.filter);
      },
      summaryList() {
        const counter = {};
        this.dayRecords.forEach(item => {
          counter[item.type] = (counter[item.type] || 0) + 1;
        });
        return RECORD_TYPES.filter(item => counter[item.key]).map(item => ({
          key: item.key,
          icon: item.icon,
          name: item.name,
          count: counter[item.key]
        }));
      }
    },
    onShow() {
      // 从编辑页返回后刷新“今天”的边界
      this.todayStr = formatDate(Date.now());
    },
    methods: {
      moveDay(delta) {
        if (delta > 0 && this.isTodayToday) return;
        const next = addDays(this.currentDay, delta);
        this.currentDay = next;
        this.dateStr = formatDate(next);
      },
      backToToday() {
        const now = Date.now();
        this.currentDay = now;
        this.dateStr = formatDate(now);
      },
      onDatePick(e) {
        const value = e.detail.value;
        this.dateStr = value;
        this.currentDay = parseDateTime(value, '12:00');
      },
      openRecord(record) {
        // 显式传入记录对象，不依赖事件参数（小程序端 handler 收到的是事件对象）
        const id = typeof record === 'string' ? record : record && record.id;
        if (!id) return;
        const readonly = can('record.write') ? '' : '&readonly=1';
        uni.navigateTo({ url: `/pages/record-edit/record-edit?id=${id}${readonly}` });
      },
      addForDate() {
        if (!can('record.write')) {
          uni.showToast({ title: '当前身份仅可查看，不能记录', icon: 'none' });
          return;
        }
        const type = this.filter === 'all' ? 'feeding' : this.filter;
        const meta = RECORD_TYPE_MAP[type];
        uni.navigateTo({ url: `/pages/record-edit/record-edit?type=${meta.key}` });
      }
    }
  };
</script>

<style scoped>
  .page {
    min-height: 100vh;
    background: var(--bfd-bg);
  }

  .header {
    background: linear-gradient(180deg, #fff0f3 0%, #fff8f5 100%);
    padding: 0 32rpx 8rpx;
  }

  .header-top {
    padding-top: 20rpx;
  }

  .title {
    font-size: 42rpx;
    font-weight: 700;
    color: #2e2a2b;
  }

  .back-today {
    height: 56rpx;
    padding: 0 24rpx;
    border-radius: 999rpx;
    background: #fff;
    display: flex;
    align-items: center;
  }

  .back-today-text {
    font-size: 24rpx;
    color: #f2607a;
  }

  .date-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20rpx;
    padding: 0 4rpx;
  }

  .arrow {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    color: #8a8386;
    padding-bottom: 6rpx;
  }

  .arrow.disabled {
    opacity: 0.35;
  }

  .date-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6rpx;
  }

  .date-main {
    font-size: 34rpx;
    font-weight: 600;
    color: #2e2a2b;
  }

  .date-sub {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .filter-scroller {
    width: 100%;
    white-space: nowrap;
    padding: 24rpx 0 16rpx;
  }

  .filter-tabs {
    display: inline-flex;
    gap: 12rpx;
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    white-space: nowrap;
    height: 62rpx;
    padding: 0 26rpx;
    border-radius: 999rpx;
    background: #fff;
    color: #8a8386;
    font-size: 25rpx;
  }

  .filter-pill.active {
    background: #ff7b8b;
    color: #fff;
    font-weight: 600;
  }

  .page-body {
    padding: 8rpx 32rpx 0;
  }

  .summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-bottom: 20rpx;
  }

  .summary-chip {
    display: flex;
    align-items: center;
    gap: 8rpx;
    height: 56rpx;
    padding: 0 20rpx;
    border-radius: 999rpx;
    background: #fff;
  }

  .summary-emoji {
    font-size: 24rpx;
  }

  .summary-text {
    font-size: 22rpx;
    color: #6b6467;
  }

  .list-card {
    padding: 8rpx 32rpx;
  }

  .empty-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80rpx 0;
    gap: 18rpx;
  }

  .empty-emoji {
    font-size: 64rpx;
  }

  .empty-text {
    font-size: 26rpx;
    color: #a39ca0;
  }

  .empty-btn {
    margin-top: 12rpx;
    height: 68rpx;
    padding: 0 44rpx;
    border-radius: 999rpx;
    background: #fff1f4;
    display: flex;
    align-items: center;
  }

  .empty-btn-text {
    font-size: 26rpx;
    color: #f2607a;
    font-weight: 600;
  }
</style>
