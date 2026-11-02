<template>
  <view class="page">
    <view class="header" :style="headerStyle">
      <text class="title">宝宝</text>
      <text class="header-sub" v-if="store.babies.length > 1">共 {{ store.babies.length }} 个</text>
    </view>

    <view class="page-body">
      <view
        v-for="item in store.babies"
        :key="item.id"
        class="baby-item"
        :class="{ active: item.id === store.currentBabyId }"
        @tap="choose(item)"
      >
        <view class="avatar">
          <text class="avatar-text">{{ item.avatar || '👶' }}</text>
        </view>
        <view class="info">
          <view class="name-row">
            <text class="name">{{ item.name || '未命名宝宝' }}</text>
            <text class="current-tag" v-if="item.id === store.currentBabyId">当前</text>
          </view>
          <text class="meta">{{ metaText(item) }}</text>
        </view>
        <view class="edit-btn" @tap.stop="edit(item)">
          <van-icon name="edit" color="#c9c2c4" size="32rpx" />
        </view>
      </view>

      <view class="empty" v-if="!store.babies.length">
        <text class="empty-text">还没有宝宝档案</text>
      </view>

      <view class="add-btn" v-if="canWrite" @tap="addBaby">
        <text class="add-text">+ 添加宝宝</text>
      </view>

      <text class="hint" v-if="!canWrite">当前身份只能查看，无法添加宝宝</text>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, switchBaby, can } from '@/store';
  import { ageText, navMetrics } from '@/common/utils';

  export default {
    data() {
      return {
        store: state
      };
    },
    computed: {
      headerStyle() {
        return { paddingTop: `${navMetrics().statusBar}px` };
      },
      canWrite() {
        return can('baby.write');
      }
    },
    methods: {
      metaText(baby) {
        const age = ageText(baby.birthday);
        if (!baby.birthday) return '未填写出生日期';
        return age ? `${baby.birthday} · ${age}` : baby.birthday;
      },
      choose(baby) {
        if (baby.id === this.store.currentBabyId) {
          uni.navigateBack();
          return;
        }
        switchBaby(baby.id);
        uni.showToast({ title: `已切换到 ${baby.name || '宝宝'}`, icon: 'none', duration: 800 });
        setTimeout(() => uni.navigateBack(), 300);
      },
      edit(baby) {
        uni.navigateTo({ url: `/pages/baby-profile/baby-profile?id=${baby.id}` });
      },
      addBaby() {
        uni.navigateTo({ url: '/pages/baby-profile/baby-profile?mode=create' });
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
    padding: 0 32rpx 20rpx;
    display: flex;
    align-items: baseline;
    gap: 16rpx;
  }

  .title {
    font-size: 44rpx;
    font-weight: 700;
    color: #2e2a2b;
  }

  .header-sub {
    font-size: 24rpx;
    color: #a39ca0;
  }

  .page-body {
    padding: 8rpx 32rpx 0;
  }

  .baby-item {
    display: flex;
    align-items: center;
    padding: 26rpx 24rpx;
    margin-bottom: 20rpx;
    background: #fff;
    border-radius: 28rpx;
    border: 2rpx solid transparent;
    box-shadow: 0 8rpx 24rpx rgba(255, 143, 163, 0.06);
  }

  .baby-item.active {
    border-color: #ffbcc6;
    background: #fffafb;
  }

  .avatar {
    width: 92rpx;
    height: 92rpx;
    border-radius: 30rpx;
    background: #fff1f4;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 22rpx;
  }

  .avatar-text {
    font-size: 48rpx;
    line-height: 1;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  .name {
    font-size: 31rpx;
    font-weight: 600;
    color: #2e2a2b;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .current-tag {
    flex-shrink: 0;
    font-size: 21rpx;
    color: #f2607a;
    background: #fff1f4;
    border-radius: 999rpx;
    padding: 4rpx 14rpx;
  }

  .meta {
    font-size: 24rpx;
    color: #a39ca0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .edit-btn {
    flex-shrink: 0;
    padding: 16rpx 8rpx 16rpx 24rpx;
  }

  .empty {
    padding: 80rpx 0;
    text-align: center;
  }

  .empty-text {
    font-size: 27rpx;
    color: #a39ca0;
  }

  .add-btn {
    margin-top: 12rpx;
    padding: 28rpx 0;
    text-align: center;
    background: #fff;
    border-radius: 28rpx;
    border: 2rpx dashed #f3d4da;
  }

  .add-text {
    font-size: 29rpx;
    color: #f2607a;
    font-weight: 500;
  }

  .hint {
    display: block;
    margin-top: 28rpx;
    text-align: center;
    font-size: 24rpx;
    color: #b9b1b4;
  }

  .safe-bottom {
    height: 40rpx;
  }
</style>
