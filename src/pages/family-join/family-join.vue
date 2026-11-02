<template>
  <view class="page">
    <view class="page-body">
      <!-- 加载中 -->
      <view class="card center" v-if="loading && !invite">
        <text class="state-text">正在读取邀请信息…</text>
      </view>

      <!-- 失败 -->
      <view class="card center" v-if="error">
        <text class="state-emoji">😢</text>
        <text class="state-title">{{ error }}</text>
        <text class="state-text">请让家人重新生成邀请码，或在小程序内手动输入。</text>
        <view class="ghost-btn" @tap="goHome">先随便逛逛</view>
      </view>

      <!-- 邀请信息 -->
      <block v-if="invite && !error">
        <view class="hero">
          <text class="hero-emoji">👨‍👩‍👧</text>
          <text class="hero-title">邀请你一起记录{{ invite.babyName || '宝宝' }}的成长</text>
          <text class="hero-sub">加入后你将是「{{ roleLabel(invite.role) }}」</text>
        </view>

        <view class="card">
          <text class="card-title">给自己起个备注名</text>
          <text class="card-desc">家人会在成员列表里看到这个名字，方便区分是谁在记录</text>
          <view class="input-row">
            <input
              class="input"
              :value="nickname"
              placeholder="例如：妈妈、奶奶"
              placeholder-class="ph"
              maxlength="12"
              @input="e => (nickname = e.detail.value)"
            />
          </view>
          <view class="primary-btn" @tap="doJoin">
            <text class="primary-text">{{ submitting ? '加入中…' : '加入家庭' }}</text>
          </view>
        </view>

        <text class="foot-hint">加入后你会看到这个家庭已经记录的内容。</text>
      </block>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { ROLE_LABELS, state } from '@/store';
  import { cloudAvailable, ensureLogin, peekInvite, joinFamily, fetchFamily } from '@/services/cloud';

  export default {
    data() {
      return {
        inviteCode: '',
        invite: null,
        nickname: '',
        loading: true,
        submitting: false,
        error: ''
      };
    },
    onLoad(options) {
      this.inviteCode = String((options && options.invite) || '')
        .trim()
        .toUpperCase();

      // #ifndef MP-WEIXIN
      this.error = '当前环境不支持家庭协作';
      this.loading = false;
      return;
      // #endif

      if (!this.inviteCode) {
        this.error = '邀请码为空';
        this.loading = false;
        return;
      }
      if (!cloudAvailable()) {
        this.error = '云空间未关联';
        this.loading = false;
        return;
      }
      this.load();
    },
    methods: {
      roleLabel(role) {
        return ROLE_LABELS[role] || '共同记录';
      },
      async load() {
        this.loading = true;
        try {
          // 邀请预览不需要身份，先看到邀请再决定是否登录
          const res = await peekInvite(this.inviteCode);
          this.invite = res || null;
          if (!this.nickname && state.auth.nickname) this.nickname = state.auth.nickname;
        } catch (e) {
          this.error = e.message || '邀请码无效';
        } finally {
          this.loading = false;
        }
      },
      async doJoin() {
        if (this.submitting) return;
        const nickname = String(this.nickname || '').trim();
        if (!nickname) {
          uni.showToast({ title: '请先填写备注名', icon: 'none' });
          return;
        }
        this.submitting = true;
        try {
          // 未登录时 ensureLogin 会先走一遍微信登录
          await ensureLogin();
          await joinFamily(this.inviteCode, nickname);
          await fetchFamily();
          uni.showToast({ title: '已加入家庭', icon: 'success' });
          setTimeout(() => uni.reLaunch({ url: '/pages/today/today' }), 700);
        } catch (e) {
          uni.showModal({ title: '加入失败', content: e.message || '请稍后重试', showCancel: false });
        } finally {
          this.submitting = false;
        }
      },
      goHome() {
        uni.reLaunch({ url: '/pages/today/today' });
      }
    }
  };
</script>

<style scoped>
  .page {
    min-height: 100vh;
    background: var(--bfd-bg);
    padding-top: 24rpx;
  }

  .page-body {
    padding: 0 32rpx;
  }

  .card.center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14rpx;
    padding: 60rpx 32rpx;
  }

  .state-emoji {
    font-size: 64rpx;
    line-height: 1;
  }

  .state-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #2e2a2b;
  }

  .state-text {
    font-size: 24rpx;
    color: #a39ca0;
    text-align: center;
    line-height: 1.7;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    padding: 40rpx 0 32rpx;
  }

  .hero-emoji {
    font-size: 76rpx;
    line-height: 1;
  }

  .hero-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #2e2a2b;
    text-align: center;
  }

  .hero-sub {
    font-size: 24rpx;
    color: #f2607a;
    background: #fff1f4;
    border-radius: 999rpx;
    padding: 6rpx 22rpx;
  }

  .card-title {
    font-size: 29rpx;
    font-weight: 600;
    color: #2e2a2b;
    display: block;
  }

  .card-desc {
    font-size: 22rpx;
    color: #a39ca0;
    display: block;
    margin-top: 10rpx;
    line-height: 1.6;
  }

  .input-row {
    display: flex;
    align-items: center;
    margin-top: 24rpx;
    background: #fdf7f4;
    border-radius: 20rpx;
    padding: 0 24rpx;
    height: 88rpx;
  }

  .input {
    flex: 1;
    font-size: 29rpx;
    color: #2e2a2b;
  }

  .ph {
    color: #c0b9bc;
    font-size: 27rpx;
  }

  .primary-btn {
    margin-top: 28rpx;
    height: 88rpx;
    border-radius: 999rpx;
    background: #ff7b8b;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .primary-text {
    font-size: 29rpx;
    color: #fff;
    font-weight: 600;
  }

  .ghost-btn {
    margin-top: 12rpx;
    height: 76rpx;
    padding: 0 44rpx;
    border-radius: 999rpx;
    background: #fff;
    border: 2rpx solid #f3d4da;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    color: #f2607a;
  }

  .foot-hint {
    display: block;
    margin-top: 24rpx;
    font-size: 22rpx;
    color: #b9b1b4;
    text-align: center;
  }

  .safe-bottom {
    height: 48rpx;
  }
</style>
