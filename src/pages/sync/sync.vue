<template>
  <view class="page">
    <view class="page-body">
      <!-- 家庭码：已加入家庭时展示，未加入时引导创建/加入 -->
      <view class="code-card">
        <text class="code-label">{{ familyReady ? '家庭码' : '尚未加入家庭' }}</text>
        <text class="code-value">{{ familyReady ? familyCode : '——' }}</text>
        <text class="code-hint" v-if="familyReady">{{ nickname }}（{{ roleLabel }}）· 记录会同步给家庭内全部成员</text>
        <text class="code-hint" v-else>创建家庭后可以邀请家人一起记录，换手机也用同一份数据</text>
        <view class="code-actions" v-if="familyReady">
          <view class="code-btn" @tap="copyCode">复制家庭码</view>
          <view class="code-btn solid" @tap="goFamily">家庭管理</view>
        </view>
        <view class="code-actions" v-else-if="supported">
          <view class="code-btn solid" @tap="goFamily">创建家庭</view>
        </view>
      </view>

      <!-- 加入家庭 -->
      <view class="card" v-if="!familyReady && supported">
        <text class="card-title">输入邀请码加入家庭</text>
        <text class="card-desc">请家里的超管在「家庭与成员」中生成邀请码，输入后即可共同记录</text>
        <view class="input-row">
          <input
            class="input"
            :value="inputCode"
            placeholder="输入 6 位邀请码"
            placeholder-class="ph"
            maxlength="8"
            @input="e => (inputCode = e.detail.value)"
          />
          <view class="use-btn" @tap="doJoin">加入</view>
        </view>
      </view>

      <!-- H5 等环境降级：保留本地单机使用 -->
      <view class="card" v-if="!supported">
        <text class="card-title">当前环境不支持云同步</text>
        <text class="card-desc">家庭协作需要微信小程序环境，当前记录只保存在本机。</text>
      </view>

      <!-- 同步状态 -->
      <view class="card" v-if="familyReady">
        <view class="status-row">
          <text class="status-label">自动同步</text>
          <van-switch :checked="autoSyncOn" :size="24" @change="toggleAuto" />
        </view>
        <view class="status-row">
          <text class="status-label">上次同步</text>
          <text class="status-value">{{ lastSyncText }}</text>
        </view>
        <view class="status-row" v-if="store.sync.lastError">
          <text class="status-label">失败原因</text>
          <text class="status-error">{{ store.sync.lastError }}</text>
        </view>
      </view>

      <view class="actions" v-if="familyReady">
        <van-button type="primary" :round="true" :block="true" :loading="loading" @tap="doSync">立即同步</van-button>
        <view class="restore-btn" @tap="doRestore">从云端恢复数据</view>
      </view>

      <view class="tip-card">
        <text class="tip-title">关于数据安全</text>
        <text class="tip-text">
          记录会先保存在手机本地，联网后再同步到 uniCloud 云端。家庭码和邀请码只分享给信任的家人。
        </text>
        <text class="tip-text">若提示「云空间未关联」，请在 HBuilderX 中关联服务空间并上传云对象 baby-diary。</text>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, saveSettings, ROLE_LABELS } from '@/store';
  import { syncNow, pullAll, maybeSync, cloudAvailable, joinFamily, fetchFamily } from '@/services/cloud';
  import { formatDate, formatTime } from '@/common/utils';

  export default {
    data() {
      return {
        store: state,
        inputCode: '',
        loading: false,
        /** H5 预览不支持微信登录与家庭协作，降级为本地单机 */
        supported: false
      };
    },
    computed: {
      familyReady() {
        return !!(this.store.auth.token && this.store.family.code);
      },
      familyCode() {
        return this.store.family.code || '';
      },
      nickname() {
        return this.store.auth.nickname || '我';
      },
      roleLabel() {
        return ROLE_LABELS[this.store.auth.role] || '成员';
      },
      autoSyncOn() {
        return !!(this.store.sync.enabled && this.store.settings.autoSync);
      },
      lastSyncText() {
        const ts = this.store.sync.lastSyncAt;
        if (!ts) return '从未同步';
        return `${formatDate(ts)} ${formatTime(ts)}`;
      }
    },
    onLoad() {
      // #ifdef MP-WEIXIN
      this.supported = cloudAvailable();
      // #endif
      if (this.supported && this.store.auth.token) this.refreshFamily();
    },
    methods: {
      async refreshFamily() {
        try {
          await fetchFamily();
        } catch (e) {
          console.warn('[sync] 家庭信息刷新失败', e);
        }
      },
      goFamily() {
        uni.navigateTo({ url: '/pages/family/family' });
      },
      copyCode() {
        if (!this.familyCode) return;
        uni.setClipboardData({
          data: this.familyCode,
          success: () => uni.showToast({ title: '已复制', icon: 'success' })
        });
      },
      async doJoin() {
        const code = String(this.inputCode || '')
          .trim()
          .toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(code)) {
          uni.showToast({ title: '请输入邀请码', icon: 'none' });
          return;
        }
        this.loading = true;
        try {
          await joinFamily(code, '');
          await fetchFamily();
          uni.showToast({ title: '已加入家庭', icon: 'success' });
          this.inputCode = '';
        } catch (e) {
          uni.showModal({ title: '加入失败', content: e.message || '请确认邀请码是否正确', showCancel: false });
        } finally {
          this.loading = false;
        }
      },
      toggleAuto(e) {
        const enabled = !!e.detail;
        saveSettings({ autoSync: enabled });
        if (enabled) maybeSync();
      },
      async doSync() {
        if (!this.supported) {
          uni.showModal({
            title: '当前环境不支持',
            content: '请在 HBuilderX 中关联 uniCloud 服务空间后重新运行。',
            showCancel: false
          });
          return;
        }
        if (!this.familyReady) {
          uni.showToast({ title: '请先创建或加入家庭', icon: 'none' });
          return;
        }
        this.loading = true;
        try {
          const res = await syncNow();
          uni.showToast({ title: `同步完成，拉取 ${res.pulled} 条`, icon: 'none', duration: 2000 });
        } catch (e) {
          uni.showModal({
            title: '同步失败',
            content: e.message || '请确认云对象 baby-diary 已上传到服务空间',
            showCancel: false
          });
        } finally {
          this.loading = false;
        }
      },
      async doRestore() {
        if (!this.familyReady) {
          uni.showToast({ title: '请先创建或加入家庭', icon: 'none' });
          return;
        }
        this.loading = true;
        try {
          const count = await pullAll();
          uni.showToast({ title: `已恢复 ${count} 条记录`, icon: 'none', duration: 2000 });
        } catch (e) {
          uni.showModal({
            title: '恢复失败',
            content: e.message || '请检查网络与云对象部署情况',
            showCancel: false
          });
        } finally {
          this.loading = false;
        }
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

  .code-card {
    border-radius: 36rpx;
    padding: 40rpx 32rpx 32rpx;
    background: linear-gradient(135deg, #8fb8ff 0%, #6f9df0 55%, #5b8ae6 100%);
    box-shadow: 0 16rpx 40rpx rgba(91, 138, 230, 0.26);
    display: flex;
    flex-direction: column;
  }

  .code-label {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.85);
  }

  .code-value {
    font-size: 64rpx;
    font-weight: 700;
    color: #fff;
    letter-spacing: 8rpx;
    margin-top: 12rpx;
  }

  .code-hint {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 12rpx;
    line-height: 1.6;
  }

  .code-actions {
    display: flex;
    gap: 18rpx;
    margin-top: 28rpx;
  }

  .code-btn {
    height: 68rpx;
    padding: 0 36rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    color: #fff;
    background: rgba(255, 255, 255, 0.22);
  }

  .code-btn.solid {
    background: #fff;
    color: #4f7ddb;
    font-weight: 600;
  }

  .card {
    margin-top: 24rpx;
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
    gap: 16rpx;
    margin-top: 24rpx;
    background: #fdf7f4;
    border-radius: 20rpx;
    padding: 0 12rpx 0 24rpx;
    height: 88rpx;
  }

  .input {
    flex: 1;
    font-size: 30rpx;
    color: #2e2a2b;
    letter-spacing: 2rpx;
  }

  .ph {
    color: #c0b9bc;
    font-size: 26rpx;
    letter-spacing: 0;
  }

  .use-btn {
    height: 64rpx;
    padding: 0 32rpx;
    border-radius: 999rpx;
    background: #ff7b8b;
    color: #fff;
    font-size: 26rpx;
    display: flex;
    align-items: center;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f6efec;
  }

  .status-row:last-child {
    border-bottom: none;
  }

  .status-label {
    font-size: 28rpx;
    color: #2e2a2b;
  }

  .status-value {
    font-size: 24rpx;
    color: #a39ca0;
  }

  .status-error {
    font-size: 24rpx;
    color: #f2607a;
    max-width: 440rpx;
    text-align: right;
  }

  .actions {
    margin-top: 40rpx;
  }

  .restore-btn {
    margin-top: 24rpx;
    text-align: center;
    font-size: 26rpx;
    color: #6f9df0;
    padding: 12rpx 0;
  }

  .tip-card {
    margin-top: 40rpx;
    padding: 28rpx;
    border-radius: 24rpx;
    background: #fdf7f4;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  .tip-title {
    font-size: 24rpx;
    font-weight: 600;
    color: #8a8386;
  }

  .tip-text {
    font-size: 22rpx;
    color: #a39ca0;
    line-height: 1.7;
  }
</style>
