<template>
  <view class="page">
    <view class="header" :style="headerStyle">
      <text class="title">我的</text>
    </view>

    <view class="page-body">
      <!-- 宝宝卡片：点进去是宝宝列表，在那里切换或编辑 -->
      <view class="baby-card" @tap="goBabyList">
        <view class="baby-avatar">
          <text class="baby-avatar-text">{{ store.baby.avatar || '👶' }}</text>
        </view>
        <view class="grow">
          <view class="baby-name-row">
            <text class="baby-name">{{ store.baby.name || '还未设置宝宝昵称' }}</text>
            <text class="switch-tag" v-if="store.babies.length > 1">切换</text>
          </view>
          <text class="baby-info">{{ babyInfo }}</text>
        </view>
        <van-icon name="arrow" color="#c9c2c4" size="28rpx" />
      </view>

      <!-- 数据概览 -->
      <view class="card stat-row">
        <view class="stat-item">
          <text class="stat-num">{{ totalRecords }}</text>
          <text class="stat-label">记录总数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ recordDays }}</text>
          <text class="stat-label">记录天数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ sinceDays }}</text>
          <text class="stat-label">陪伴天数</text>
        </view>
      </view>

      <!-- 设置 -->
      <view class="card menu-card">
        <view class="menu-item" @tap="goBabyList">
          <text class="menu-icon">👶</text>
          <text class="menu-label">宝宝管理</text>
          <text class="menu-value">{{ store.babies.length }} 个</text>
          <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
        </view>
        <view class="menu-item" @tap="goProfile">
          <text class="menu-icon">📝</text>
          <text class="menu-label">当前宝宝档案</text>
          <text class="menu-value">{{ store.baby.profileCompleted ? '已完成' : '去完善' }}</text>
          <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
        </view>
        <view class="menu-item" @tap="goFamily">
          <text class="menu-icon">👨‍👩‍👧</text>
          <text class="menu-label">家庭与成员</text>
          <text class="menu-value">{{ familyText }}</text>
          <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
        </view>
        <view class="menu-item" @tap="goSync">
          <text class="menu-icon">☁️</text>
          <text class="menu-label">云同步</text>
          <text class="menu-value">{{ syncStatus }}</text>
          <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
        </view>
        <view class="menu-item" @tap="openInterval">
          <text class="menu-icon">⏰</text>
          <text class="menu-label">喂养间隔提醒</text>
          <text class="menu-value">{{ intervalText }}</text>
          <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
        </view>
        <view class="menu-item" @tap="exportData">
          <text class="menu-icon">📤</text>
          <text class="menu-label">导出全部数据</text>
          <text class="menu-value">JSON</text>
          <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
        </view>
      </view>

      <view class="card menu-card">
        <view class="menu-item" @tap="clearData">
          <text class="menu-icon">🗑️</text>
          <text class="menu-label danger-text">清空本地记录</text>
          <text class="menu-value">{{ totalRecords }} 条</text>
        </view>
      </view>

      <view class="footer">
        <text class="footer-text">{{ appName }} v{{ version }}</text>
        <text class="footer-sub">{{ slogan }}</text>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, saveSettings, clearRecords, allRecordsForSync, babyRecords, ROLE_LABELS } from '@/store';
  import { APP_INFO } from '@/config';
  import { ageText, navMetrics, dateKeyOf, parseDateTime } from '@/common/utils';

  export default {
    data() {
      return {
        store: state,
        appName: APP_INFO.name,
        version: APP_INFO.version,
        slogan: APP_INFO.slogan
      };
    },
    computed: {
      // 自定义导航栏：顶部状态栏留白（标题靠左，无需避让胶囊）
      headerStyle() {
        return { paddingTop: `${navMetrics().statusBar}px` };
      },
      babyInfo() {
        const parts = [];
        const age = ageText(this.store.baby.birthday);
        if (age) parts.push(age);
        if (this.store.baby.gender === 'boy') parts.push('男宝');
        if (this.store.baby.gender === 'girl') parts.push('女宝');
        if (this.store.baby.birthday) parts.push(`生日 ${this.store.baby.birthday}`);
        return parts.length ? parts.join(' · ') : '补充生日后可以自动计算月龄';
      },
      totalRecords() {
        return babyRecords().length;
      },
      recordDays() {
        const set = {};
        babyRecords().forEach(item => {
          set[dateKeyOf(item.time)] = true;
        });
        return Object.keys(set).length;
      },
      sinceDays() {
        if (!this.store.baby.birthday) return '—';
        const birth = parseDateTime(this.store.baby.birthday, '00:00');
        const days = Math.floor((Date.now() - birth) / 86400000);
        return days >= 0 ? days : 0;
      },
      syncStatus() {
        if (!this.store.family.code) return '未开启';
        if (this.store.sync.lastError) return '待重试';
        if (!this.store.sync.lastSyncAt) return '已设置';
        return '已同步';
      },
      familyText() {
        if (!this.store.family.code) return '未开启';
        const role = ROLE_LABELS[this.store.auth.role] || '成员';
        return `${role} · ${this.store.family.members.length} 人`;
      },
      intervalText() {
        const minutes = Number(this.store.settings.feedInterval) || 180;
        return `${(minutes / 60).toFixed(1).replace('.0', '')} 小时`;
      }
    },
    methods: {
      goBabyList() {
        uni.navigateTo({ url: '/pages/baby-list/baby-list' });
      },
      goProfile() {
        const id = this.store.baby.id;
        const url = id ? `/pages/baby-profile/baby-profile?id=${id}` : '/pages/baby-profile/baby-profile';
        uni.navigateTo({ url });
      },
      goFamily() {
        uni.navigateTo({ url: '/pages/family/family' });
      },
      goSync() {
        uni.navigateTo({ url: '/pages/sync/sync' });
      },
      openInterval() {
        const options = [120, 150, 180, 210, 240];
        uni.showActionSheet({
          itemList: options.map(minutes => `${minutes / 60} 小时`),
          success: res => {
            const minutes = options[res.tapIndex];
            if (!minutes) return;
            saveSettings({ feedInterval: minutes });
            uni.showToast({ title: `已设为 ${minutes / 60} 小时`, icon: 'none' });
          }
        });
      },
      exportData() {
        const payload = {
          app: APP_INFO.name,
          version: APP_INFO.version,
          exportedAt: new Date().toISOString(),
          baby: this.store.baby,
          records: allRecordsForSync()
        };
        const text = JSON.stringify(payload, null, 2);
        uni.setClipboardData({
          data: text,
          success: () => {
            uni.showToast({ title: '数据已复制到剪贴板', icon: 'none', duration: 2000 });
          },
          fail: () => {
            uni.showModal({
              title: '导出失败',
              content: '记录较多时剪贴板无法承载，建议使用云同步备份。',
              showCancel: false
            });
          }
        });
      },
      clearData() {
        if (!this.store.records.length) {
          uni.showToast({ title: '当前没有记录', icon: 'none' });
          return;
        }
        uni.showModal({
          title: '清空本地记录',
          content: `将删除本机 ${this.store.records.length} 条记录，云端备份不受影响。确认继续吗？`,
          confirmText: '清空',
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            clearRecords();
            uni.showToast({ title: '已清空', icon: 'success' });
          }
        });
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

  .title {
    font-size: 42rpx;
    font-weight: 700;
    color: #2e2a2b;
    padding-top: 20rpx;
    display: block;
  }

  .page-body {
    padding: 8rpx 32rpx 0;
  }

  .baby-card {
    display: flex;
    align-items: center;
    gap: 24rpx;
    background: #fff;
    border-radius: var(--bfd-radius);
    padding: 32rpx;
    box-shadow: 0 10rpx 36rpx rgba(226, 168, 160, 0.12);
  }

  .baby-avatar {
    width: 108rpx;
    height: 108rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #ffe6ea, #ffeef5);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .baby-avatar-text {
    font-size: 56rpx;
    line-height: 1;
  }

  .baby-name {
    font-size: 34rpx;
    font-weight: 600;
    color: #2e2a2b;
    display: block;
  }

  .baby-name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  .switch-tag {
    flex-shrink: 0;
    font-size: 20rpx;
    color: #f2607a;
    background: #fff1f4;
    border-radius: 999rpx;
    padding: 3rpx 14rpx;
    white-space: nowrap;
  }

  .baby-info {
    font-size: 23rpx;
    color: #a39ca0;
    margin-top: 8rpx;
    display: block;
  }

  .stat-row {
    display: flex;
    align-items: center;
    margin-top: 24rpx;
    padding: 28rpx 0;
  }

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  .stat-num {
    font-size: 40rpx;
    font-weight: 700;
    color: #2e2a2b;
  }

  .stat-label {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .stat-divider {
    width: 1rpx;
    height: 48rpx;
    background: #f4ebe8;
  }

  .menu-card {
    margin-top: 24rpx;
    padding: 8rpx 32rpx;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    height: 108rpx;
    border-bottom: 1rpx solid #f6efec;
  }

  .menu-item:last-child {
    border-bottom: none;
  }

  .menu-icon {
    font-size: 34rpx;
    width: 44rpx;
    text-align: center;
  }

  .menu-label {
    flex: 1;
    font-size: 29rpx;
    color: #2e2a2b;
  }

  .menu-value {
    font-size: 24rpx;
    color: #a39ca0;
    margin-right: 8rpx;
  }

  .danger-text {
    color: #d4767f;
  }

  .footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    padding: 56rpx 0 20rpx;
  }

  .footer-text {
    font-size: 24rpx;
    color: #b6afb2;
  }

  .footer-sub {
    font-size: 22rpx;
    color: #c9c2c4;
  }
</style>
