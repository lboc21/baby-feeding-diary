<template>
  <view class="page">
    <view class="header" :style="headerStyle">
      <view class="row between header-top" :style="titleRowStyle">
        <view class="title-wrap">
          <text class="title">统计</text>
          <!-- 多宝宝家庭：统计只看当前宝宝，名字必须显示出来避免误读 -->
          <text class="baby-name">{{ babyName }}</text>
        </view>
        <view class="range-switch">
          <text class="range-item" :class="{ active: range === 7 }" @tap="range = 7">近 7 天</text>
          <text class="range-item" :class="{ active: range === 30 }" @tap="range = 30">近 30 天</text>
        </view>
      </view>
    </view>

    <view class="page-body">
      <!-- 关键指标 -->
      <view class="card">
        <view class="metric-grid">
          <stat-tile :value="avgFeed" unit="次/天" label="平均喂养" color="#ff7b8b" bg="#fff1f4" />
          <stat-tile :value="avgAmount" unit="ml/天" label="平均瓶喂" color="#ff9a5c" bg="#fff4ec" />
          <stat-tile :value="avgSleep" unit="h/天" label="平均睡眠" color="#9b8ce8" bg="#f3f0ff" />
          <stat-tile :value="totalDiaper" unit="次" label="尿布合计" color="#6fa8e8" bg="#eef5ff" />
        </view>
      </view>

      <!-- 喂养次数 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">每日喂养次数</text>
          <text class="card-sub">{{ totalFeed }} 次</text>
        </view>
        <bar-chart :data="feedSeries" color="#ff7b8b" unit="次" :show-value="range === 7" />
      </view>

      <!-- 奶量 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">每日瓶喂奶量</text>
          <text class="card-sub">{{ totalAmount }} ml</text>
        </view>
        <bar-chart :data="amountSeries" color="#ff9a5c" unit="ml" :show-value="range === 7" />
      </view>

      <!-- 睡眠 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">每日睡眠时长</text>
          <text class="card-sub">小时</text>
        </view>
        <bar-chart :data="sleepSeries" color="#9b8ce8" unit="h" :show-value="range === 7" />
      </view>

      <!-- 尿布 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">每日换尿布</text>
          <text class="card-sub">尿 {{ totalPee }} · 便 {{ totalPoo }}</text>
        </view>
        <bar-chart :data="diaperSeries" color="#6fa8e8" unit="次" :show-value="range === 7" />
      </view>

      <!-- 成长趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">身高体重</text>
          <text class="card-sub" v-if="growthList.length">近 {{ growthList.length }} 次</text>
        </view>
        <view v-if="growthList.length" class="growth-list">
          <view class="growth-row" v-for="item in growthList" :key="item.id">
            <text class="growth-date">{{ shortDate(item.time) }}</text>
            <view class="growth-values">
              <text class="growth-value" v-if="item.payload.height">
                {{ item.payload.height }}
                <text class="growth-unit">cm</text>
              </text>
              <text class="growth-value" v-if="item.payload.weight">
                {{ item.payload.weight }}
                <text class="growth-unit">kg</text>
              </text>
              <text class="growth-value" v-if="item.payload.head">
                {{ item.payload.head }}
                <text class="growth-unit">cm 头围</text>
              </text>
            </view>
          </view>
        </view>
        <view v-else class="empty-tip">还没有身高体重记录，去「今日 - 身高体重」添加</view>
      </view>

      <!-- 体温 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">最近体温</text>
          <text class="card-sub" v-if="tempList.length">{{ tempList.length }} 条</text>
        </view>
        <view v-if="tempList.length" class="temp-list">
          <view class="temp-row" v-for="item in tempList" :key="item.id">
            <view class="temp-left">
              <text class="temp-value" :class="{ fever: Number(item.payload.value) >= 37.5 }">
                {{ item.payload.value }}
                <text class="temp-unit">℃</text>
              </text>
              <text class="temp-tag" v-if="Number(item.payload.value) >= 37.5">偏高</text>
            </view>
            <text class="temp-meta">{{ shortDate(item.time) }} · {{ item.payload.method || '腋温' }}</text>
          </view>
        </view>
        <view v-else class="empty-tip">还没有体温记录</view>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, babyRecords } from '@/store';
  import { navMetrics, startOfDay, addDays, formatDate } from '@/common/utils';
  import BarChart from '@/components/bar-chart.vue';
  import StatTile from '@/components/stat-tile.vue';

  export default {
    components: { BarChart, StatTile },
    data() {
      return {
        range: 7
      };
    },
    computed: {
      // 自定义导航栏：顶部状态栏留白
      headerStyle() {
        return { paddingTop: `${navMetrics().statusBar}px` };
      },
      // 仅「近 7 天 / 近 30 天」这一行需要避开右上角胶囊
      titleRowStyle() {
        return { paddingRight: `${navMetrics().rowRightPad}px` };
      },
      babyName() {
        return state.baby.name || '宝宝';
      },
      buckets() {
        const days = this.range;
        const todayStart = startOfDay(Date.now());
        const list = [];
        const index = {};
        for (let i = days - 1; i >= 0; i--) {
          const dayStart = addDays(todayStart, -i);
          const item = {
            dayStart,
            label: this.shortDate(dayStart),
            showLabel: days <= 7 || i % 5 === 0,
            records: []
          };
          list.push(item);
          index[dayStart] = item;
        }
        // 统计只看当前宝宝，与今日页保持一致
        babyRecords().forEach(record => {
          const key = startOfDay(record.time);
          if (index[key]) index[key].records.push(record);
        });
        return list;
      },
      feedSeries() {
        return this.buckets.map(bucket => ({
          label: bucket.showLabel ? bucket.label : '',
          value: bucket.records.filter(item => item.type === 'feeding').length
        }));
      },
      amountSeries() {
        return this.buckets.map(bucket => ({
          label: bucket.showLabel ? bucket.label : '',
          value: bucket.records
            .filter(item => item.type === 'feeding' && item.payload.mode !== 'breast')
            .reduce((sum, item) => sum + (Number(item.payload.amount) || 0), 0)
        }));
      },
      sleepSeries() {
        return this.buckets.map(bucket => ({
          label: bucket.showLabel ? bucket.label : '',
          value: Number(
            (
              bucket.records
                .filter(item => item.type === 'sleep')
                .reduce((sum, item) => sum + (Number(item.payload.duration) || 0), 0) / 60
            ).toFixed(1)
          )
        }));
      },
      diaperSeries() {
        return this.buckets.map(bucket => ({
          label: bucket.showLabel ? bucket.label : '',
          value: bucket.records.filter(item => item.type === 'diaper').length
        }));
      },
      totalFeed() {
        return this.feedSeries.reduce((sum, item) => sum + item.value, 0);
      },
      totalAmount() {
        return this.amountSeries.reduce((sum, item) => sum + item.value, 0);
      },
      totalDiaper() {
        return this.diaperSeries.reduce((sum, item) => sum + item.value, 0);
      },
      totalPee() {
        let count = 0;
        this.buckets.forEach(bucket => {
          bucket.records.forEach(item => {
            if (item.type === 'diaper' && (item.payload.kind === 'pee' || item.payload.kind === 'mixed')) count += 1;
          });
        });
        return count;
      },
      totalPoo() {
        let count = 0;
        this.buckets.forEach(bucket => {
          bucket.records.forEach(item => {
            if (item.type === 'diaper' && (item.payload.kind === 'poo' || item.payload.kind === 'mixed')) count += 1;
          });
        });
        return count;
      },
      avgFeed() {
        return (this.totalFeed / this.range).toFixed(1);
      },
      avgAmount() {
        return Math.round(this.totalAmount / this.range);
      },
      avgSleep() {
        const total = this.sleepSeries.reduce((sum, item) => sum + item.value, 0);
        return (total / this.range).toFixed(1);
      },
      growthList() {
        return babyRecords()
          .filter(item => item.type === 'growth')
          .slice(0, 3);
      },
      tempList() {
        return babyRecords()
          .filter(item => item.type === 'temperature')
          .slice(0, 5);
      }
    },
    methods: {
      shortDate(ts) {
        const date = new Date(ts);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      },
      fullDate(ts) {
        return formatDate(ts);
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
    padding: 0 32rpx 24rpx;
  }

  .header-top {
    padding-top: 20rpx;
  }

  .title {
    font-size: 42rpx;
    font-weight: 700;
    color: #2e2a2b;
  }

  .title-wrap {
    display: flex;
    align-items: baseline;
    gap: 14rpx;
  }

  .baby-name {
    flex-shrink: 0;
    font-size: 24rpx;
    color: #f2607a;
    background: #fff1f4;
    border-radius: 999rpx;
    padding: 4rpx 16rpx;
    white-space: nowrap;
  }

  .range-switch {
    display: flex;
    background: #fff;
    border-radius: 999rpx;
    padding: 6rpx;
  }

  .range-item {
    height: 60rpx;
    padding: 0 26rpx;
    border-radius: 999rpx;
    font-size: 24rpx;
    color: #8a8386;
    display: flex;
    align-items: center;
  }

  .range-item.active {
    background: #ff7b8b;
    color: #fff;
    font-weight: 600;
  }

  .page-body {
    padding: 8rpx 32rpx 0;
  }

  .metric-grid {
    display: flex;
    gap: 12rpx;
  }

  .metric-grid > view {
    flex: 1;
  }

  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 24rpx;
  }

  .card-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #2e2a2b;
  }

  .card-sub {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .growth-list,
  .temp-list {
    display: flex;
    flex-direction: column;
  }

  .growth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f6efec;
  }

  .growth-row:last-child {
    border-bottom: none;
  }

  .growth-date {
    font-size: 24rpx;
    color: #a39ca0;
    width: 110rpx;
  }

  .growth-values {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    gap: 24rpx;
  }

  .growth-value {
    font-size: 30rpx;
    font-weight: 600;
    color: #45b49b;
  }

  .growth-unit {
    font-size: 20rpx;
    color: #a39ca0;
    margin-left: 4rpx;
    font-weight: 400;
  }

  .temp-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18rpx 0;
    border-bottom: 1rpx solid #f6efec;
  }

  .temp-row:last-child {
    border-bottom: none;
  }

  .temp-left {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
  }

  .temp-value {
    font-size: 34rpx;
    font-weight: 600;
    color: #2e2a2b;
  }

  .temp-value.fever {
    color: #f2607a;
  }

  .temp-unit {
    font-size: 20rpx;
    color: #a39ca0;
    margin-left: 2rpx;
    font-weight: 400;
  }

  .temp-tag {
    font-size: 20rpx;
    color: #f2607a;
    background: #ffeef1;
    border-radius: 8rpx;
    padding: 2rpx 10rpx;
  }

  .temp-meta {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .empty-tip {
    font-size: 24rpx;
    color: #b6afb2;
    padding: 24rpx 0 8rpx;
  }
</style>
