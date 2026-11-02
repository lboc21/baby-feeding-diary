<template>
  <view class="page">
    <!-- 顶部问候 -->
    <view class="header" :style="headerStyle">
      <view class="header-row" :style="titleRowStyle">
        <view class="avatar-btn" @tap="goProfile">
          <text class="avatar-text">{{ store.baby.avatar || '👶' }}</text>
        </view>
        <view class="grow header-main">
          <text class="greeting">{{ greetingText }}</text>
          <view class="meta-row">
            <!-- 多宝宝家庭：点名字直接切换 -->
            <text class="baby-chip" @tap.stop="goBabyList">{{ babyName }} ▾</text>
            <text class="meta-dot">·</text>
            <text class="meta-text">{{ dateLabel }}</text>
            <text class="meta-dot" v-if="ageLabel">·</text>
            <text class="meta-text" v-if="ageLabel">{{ ageLabel }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <!-- 档案引导 -->
      <view class="setup-tip" v-if="!store.baby.profileCompleted" @tap="goProfile">
        <text class="setup-text">完善宝宝档案，月龄和成长记录会更准确</text>
        <text class="setup-link">去设置 ›</text>
      </view>

      <!-- 喂养节奏卡 -->
      <view class="hero">
        <view class="hero-blob"></view>
        <view class="hero-content">
          <text class="hero-label">距离上次喂养</text>
          <view class="hero-value-row">
            <text class="hero-value" :class="{ 'is-placeholder': sinceMinutes === null }">{{ sinceText }}</text>
          </view>
          <text class="hero-sub">{{ lastFeedText }}</text>
          <view class="progress" v-if="sinceMinutes !== null">
            <view class="progress-inner" :style="{ width: progressWidth, background: progressColor }"></view>
          </view>
          <text class="hero-tip">{{ feedTip }}</text>
        </view>
        <view class="hero-actions">
          <view class="hero-btn primary" @tap="goAdd('feeding')">
            <text class="hero-btn-text">记喂养</text>
          </view>
          <view class="hero-btn ghost" @tap="goAdd('diaper')">
            <text class="hero-btn-text">记尿布</text>
          </view>
        </view>
      </view>

      <!-- 今日概览 -->
      <view class="tiles">
        <stat-tile :value="stats.feedCount" unit="次" label="今日喂养" color="#ff7b8b" bg="#fff1f4" />
        <stat-tile
          :value="feedAmountText"
          :unit="stats.feedAmount ? 'ml' : ''"
          label="瓶喂奶量"
          color="#ff9a5c"
          bg="#fff4ec"
        />
        <stat-tile :value="stats.diaperCount" unit="次" label="换尿布" color="#6fa8e8" bg="#eef5ff" />
        <stat-tile :value="sleepText" label="睡眠时长" color="#9b8ce8" bg="#f3f0ff" />
      </view>

      <!-- 快速记录 -->
      <view class="section-header">
        <text class="section-title">今日想记点什么</text>
      </view>
      <view class="quick-grid">
        <view class="quick-item" v-for="item in types" :key="item.key" @tap="goAdd(item.key)">
          <view class="quick-icon" :style="{ background: item.bg }">
            <text class="quick-emoji">{{ item.icon }}</text>
          </view>
          <text class="quick-name">{{ item.name }}</text>
        </view>
      </view>

      <!-- 今日时间轴 -->
      <view class="section-header">
        <text class="section-title">今日记录</text>
        <text class="section-more" @tap="goRecords">全部记录 ›</text>
      </view>
      <view class="card timeline-card">
        <view class="empty-block" v-if="!todayRecords.length">
          <text class="empty-emoji">🌱</text>
          <text class="empty-text">今天还没有记录，点上面的图标开始吧</text>
        </view>
        <view v-else>
          <record-item v-for="item in todayRecords" :key="item.id" :record="item" @tap="openRecord(item)" />
          <view class="timeline-tip" v-if="todayRecords.length >= 5">
            <text class="muted">共 {{ todayRecords.length }} 条记录</text>
            <text class="link" @tap="goRecords">查看全部</text>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, dayStats, recordsOfDay, can } from '@/store';
  import { RECORD_TYPES } from '@/common/record-schema';
  import { ageText, durationText, formatTime, formatMonthDay, weekdayText, navMetrics } from '@/common/utils';
  import RecordItem from '@/components/record-item.vue';
  import StatTile from '@/components/stat-tile.vue';

  export default {
    components: { RecordItem, StatTile },
    data() {
      return {
        store: state,
        types: RECORD_TYPES,
        now: Date.now(),
        timer: null
      };
    },
    computed: {
      // 自定义导航栏：顶部状态栏留白
      headerStyle() {
        return { paddingTop: `${navMetrics().statusBar}px` };
      },
      // 头像与问候语这一行需要避开右上角胶囊
      titleRowStyle() {
        return { paddingRight: `${navMetrics().rowRightPad}px` };
      },
      babyName() {
        return this.store.baby.name || '宝宝';
      },
      greetingText() {
        const hour = new Date(this.now).getHours();
        let hello = '晚上好';
        if (hour < 6) hello = '夜深了';
        else if (hour < 11) hello = '早上好';
        else if (hour < 13) hello = '中午好';
        else if (hour < 18) hello = '下午好';
        const name = this.store.baby.name;
        return name ? `${hello}，${name}` : hello;
      },
      dateLabel() {
        return `${formatMonthDay(this.now)} ${weekdayText(this.now)}`;
      },
      ageLabel() {
        return ageText(this.store.baby.birthday);
      },
      todayRecords() {
        return recordsOfDay(this.now);
      },
      stats() {
        return dayStats(this.now);
      },
      feedAmountText() {
        return this.stats.feedAmount ? String(this.stats.feedAmount) : '0';
      },
      sleepText() {
        const minutes = this.stats.sleepMinutes;
        if (!minutes) return '0';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (!h) return `${m}分`;
        return m ? `${h}时${m}分` : `${h}小时`;
      },
      lastFeeding() {
        return this.store.records.find(item => item.type === 'feeding') || null;
      },
      sinceMinutes() {
        if (!this.lastFeeding) return null;
        return Math.max(0, Math.floor((this.now - this.lastFeeding.time) / 60000));
      },
      sinceText() {
        if (this.sinceMinutes === null) return '待记录';
        return durationText(this.sinceMinutes);
      },
      lastFeedText() {
        if (!this.lastFeeding) return '还没有喂养记录，记录第一次吧';
        const p = this.lastFeeding.payload || {};
        const mode = p.mode === 'breast' ? `亲喂 ${p.duration || 0}分钟` : `${p.amount || 0}ml`;
        return `上次 ${formatTime(this.lastFeeding.time)} · ${mode}`;
      },
      progressRatio() {
        if (this.sinceMinutes === null) return 0;
        const interval = Number(this.store.settings.feedInterval) || 180;
        return this.sinceMinutes / interval;
      },
      progressWidth() {
        return `${Math.min(this.progressRatio, 1) * 100}%`;
      },
      progressColor() {
        return this.progressRatio >= 1 ? '#ffffff' : 'rgba(255,255,255,0.85)';
      },
      feedTip() {
        if (this.sinceMinutes === null) return '记录喂奶后，这里会显示间隔提醒';
        const interval = Number(this.store.settings.feedInterval) || 180;
        const left = interval - this.sinceMinutes;
        if (left > 0) return `距离建议间隔还有 ${durationText(left)}`;
        return `已超过建议间隔 ${durationText(-left)}，注意按需喂养`;
      }
    },
    onShow() {
      this.now = Date.now();
      this.startTimer();
    },
    onHide() {
      this.clearTimer();
    },
    onUnload() {
      this.clearTimer();
    },
    methods: {
      startTimer() {
        this.clearTimer();
        this.timer = setInterval(() => {
          this.now = Date.now();
        }, 30 * 1000);
      },
      clearTimer() {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
      },
      goAdd(type) {
        if (!can('record.write')) {
          uni.showToast({ title: '当前身份仅可查看，不能记录', icon: 'none' });
          return;
        }
        uni.navigateTo({ url: `/pages/record-edit/record-edit?type=${type}` });
      },
      goBabyList() {
        uni.navigateTo({ url: '/pages/baby-list/baby-list' });
      },
      openRecord(record) {
        // 显式传入记录对象，不依赖事件参数（小程序端 handler 收到的是事件对象）
        const id = typeof record === 'string' ? record : record && record.id;
        if (!id) return;
        const readonly = can('record.write') ? '' : '&readonly=1';
        uni.navigateTo({ url: `/pages/record-edit/record-edit?id=${id}${readonly}` });
      },
      goRecords() {
        uni.switchTab({ url: '/pages/records/records' });
      },
      goProfile() {
        uni.navigateTo({ url: '/pages/baby-profile/baby-profile' });
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

  .header-row {
    display: flex;
    align-items: center;
    padding-top: 20rpx;
  }

  .header-main {
    padding-top: 4rpx;
  }

  .greeting {
    font-size: 42rpx;
    font-weight: 700;
    color: #2e2a2b;
    letter-spacing: 1rpx;
  }

  .meta-row {
    display: flex;
    align-items: center;
    margin-top: 10rpx;
    flex-wrap: nowrap;
  }

  .baby-chip {
    flex-shrink: 0;
    font-size: 24rpx;
    font-weight: 600;
    color: #f2607a;
    white-space: nowrap;
  }

  .meta-text {
    font-size: 24rpx;
    color: #a39ca0;
    white-space: nowrap;
  }

  .meta-dot {
    font-size: 24rpx;
    color: #c9c2c4;
    margin: 0 10rpx;
  }

  .avatar-btn {
    width: 92rpx;
    height: 92rpx;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 22rpx;
    box-shadow: 0 8rpx 24rpx rgba(226, 168, 160, 0.18);
  }

  .avatar-text {
    font-size: 46rpx;
    line-height: 1;
  }

  /* 档案引导 */
  .setup-tip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fff;
    border-radius: 20rpx;
    padding: 20rpx 24rpx;
    margin-bottom: 20rpx;
  }

  .setup-text {
    flex: 1;
    min-width: 0;
    font-size: 23rpx;
    color: #8a8386;
  }

  .setup-link {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 23rpx;
    color: #f2607a;
    margin-left: 16rpx;
  }

  /* 喂养节奏卡 */
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: 36rpx;
    padding: 36rpx 32rpx 32rpx;
    background: linear-gradient(135deg, #ffa3af 0%, #ff7b8b 55%, #f96a83 100%);
    box-shadow: 0 16rpx 40rpx rgba(249, 106, 131, 0.28);
  }

  .hero-blob {
    position: absolute;
    right: -80rpx;
    top: -100rpx;
    width: 300rpx;
    height: 300rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
  }

  .hero-content {
    position: relative;
    z-index: 1;
  }

  .hero-label {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.86);
  }

  .hero-value-row {
    display: flex;
    align-items: baseline;
    margin-top: 8rpx;
  }

  .hero-value {
    font-size: 64rpx;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
    letter-spacing: 1rpx;
  }

  .hero-value.is-placeholder {
    font-size: 44rpx;
    font-weight: 600;
  }

  .hero-sub {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.82);
    margin-top: 4rpx;
  }

  .progress {
    height: 10rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.28);
    margin-top: 24rpx;
    overflow: hidden;
  }

  .progress-inner {
    height: 100%;
    border-radius: 999rpx;
    transition: width 0.4s ease;
  }

  .hero-tip {
    display: block;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 14rpx;
  }

  .hero-actions {
    display: flex;
    gap: 18rpx;
    margin-top: 30rpx;
    position: relative;
    z-index: 1;
  }

  .hero-btn {
    flex: 1;
    height: 80rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-btn.primary {
    background: #fff;
  }

  .hero-btn.primary .hero-btn-text {
    color: #f2607a;
    font-weight: 600;
  }

  .hero-btn.ghost {
    background: rgba(255, 255, 255, 0.22);
  }

  .hero-btn.ghost .hero-btn-text {
    color: #fff;
  }

  .hero-btn-text {
    font-size: 28rpx;
  }

  /* 概览 */
  .tiles {
    display: flex;
    gap: 16rpx;
    margin-top: 24rpx;
  }

  /* 快捷记录 */
  .quick-grid {
    display: flex;
    flex-wrap: wrap;
    background: #fff;
    border-radius: var(--bfd-radius);
    padding: 28rpx 12rpx 12rpx;
    box-shadow: 0 10rpx 36rpx rgba(226, 168, 160, 0.12);
  }

  .quick-item {
    width: 33.33%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 28rpx;
  }

  .quick-icon {
    width: 96rpx;
    height: 96rpx;
    border-radius: 30rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .quick-emoji {
    font-size: 46rpx;
    line-height: 1;
  }

  .quick-name {
    font-size: 24rpx;
    color: #6b6467;
    margin-top: 14rpx;
  }

  /* 时间轴 */
  .timeline-card {
    padding: 8rpx 32rpx;
  }

  .empty-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60rpx 0;
    gap: 16rpx;
  }

  .empty-emoji {
    font-size: 56rpx;
  }

  .empty-text {
    font-size: 26rpx;
    color: #a39ca0;
    text-align: center;
  }

  .timeline-tip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 0 28rpx;
    border-top: 1rpx solid #f6efec;
  }

  .link {
    font-size: 24rpx;
    color: #ff7b8b;
  }
</style>
