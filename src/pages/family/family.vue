<template>
  <view class="page">
    <view class="page-body">
      <!-- 未加入家庭：引导创建 -->
      <view class="card intro" v-if="!familyReady">
        <text class="intro-title">{{ supported ? '创建家庭空间' : '当前环境不支持家庭协作' }}</text>
        <text class="intro-text" v-if="supported">
          创建后你将成为超管，可以邀请家人一起记录，也能设置他们的备注名与权限。
        </text>
        <text class="intro-text" v-else>家庭协作需要微信小程序环境，H5 预览下只能单机使用。</text>
        <view class="primary-btn" v-if="supported" @tap="doCreate">
          <text class="primary-text">{{ loading ? '创建中…' : '创建家庭' }}</text>
        </view>
      </view>

      <block v-else>
        <!-- 家庭码 -->
        <view class="code-card">
          <text class="code-label">家庭码</text>
          <text class="code-value">{{ familyCode }}</text>
          <text class="code-hint">{{ store.family.members.length }} 位成员 · 我是{{ roleLabel(store.auth.role) }}</text>
          <view class="code-actions">
            <view class="code-btn solid" @tap="copyCode">复制家庭码</view>
          </view>
        </view>

        <!-- 小程序测试号的 AppSecret 不支持 code2Session，此时身份存在本机 -->
        <view class="notice" v-if="isDeviceLogin">
          <text class="notice-text">
            当前使用本机身份（微信登录不可用）。换手机时，让对方重新发一张邀请码即可重新加入。
          </text>
        </view>

        <!-- 成员列表 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">家庭成员</text>
            <text class="card-sub">{{ store.family.members.length }} 人</text>
          </view>

          <view v-for="item in store.family.members" :key="item.memberId" class="member-item" @tap="openMember(item)">
            <view class="member-avatar">
              <text class="member-avatar-text">{{ avatarOf(item) }}</text>
            </view>
            <view class="member-info">
              <view class="member-name-row">
                <text class="member-name">{{ item.nickname || '未命名成员' }}</text>
                <text class="me-tag" v-if="item.memberId === store.auth.memberId">我</text>
              </view>
              <text class="member-meta">{{ joinText(item) }}</text>
            </view>
            <text class="role-tag" :class="item.role">{{ roleLabel(item.role) }}</text>
            <van-icon v-if="canManage(item)" name="arrow" color="#d9d2d5" size="26rpx" />
          </view>

          <view class="empty-tip" v-if="!store.family.members.length">还没有加载到成员信息</view>
        </view>

        <!-- 邀请 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">邀请家人</text>
            <text class="card-sub">7 天有效</text>
          </view>

          <view class="role-picker">
            <text class="role-option" :class="{ active: inviteRole === 'editor' }" @tap="inviteRole = 'editor'">
              共同记录
            </text>
            <text class="role-option" :class="{ active: inviteRole === 'viewer' }" @tap="inviteRole = 'viewer'">
              仅查看
            </text>
          </view>
          <text class="role-desc">
            {{ inviteRole === 'editor' ? '可以新增和编辑记录、宝宝档案' : '只能查看记录与统计，不能修改' }}
          </text>

          <view class="primary-btn" v-if="isOwner" @tap="doInvite">
            <text class="primary-text">{{ loading ? '生成中…' : '生成邀请码' }}</text>
          </view>
          <text class="hint" v-else>仅超管可以邀请成员</text>

          <view class="invite-result" v-if="inviteCode">
            <text class="invite-code">{{ inviteCode }}</text>
            <text class="invite-tip">邀请码 · {{ roleLabel(inviteRole) }}</text>
            <view class="invite-actions">
              <view class="mini-btn" @tap="copyInvite">复制</view>
              <button class="mini-btn share-btn" open-type="share">微信邀请</button>
            </view>
          </view>
        </view>

        <!-- 家庭操作 -->
        <view class="card">
          <view class="menu-item" v-if="isOwner" @tap="chooseTransfer">
            <text class="menu-icon">👑</text>
            <text class="menu-label">转让超管</text>
            <van-icon name="arrow" color="#d9d2d5" size="26rpx" />
          </view>
          <view class="menu-item" v-if="!isOwner" @tap="doLeave">
            <text class="menu-icon">🚪</text>
            <text class="menu-label danger-text">退出家庭</text>
          </view>
          <view class="menu-item" v-if="isOwner" @tap="doDissolve">
            <text class="menu-icon">💥</text>
            <text class="menu-label danger-text">解散家庭</text>
          </view>
        </view>

        <text class="foot-hint">超管不能直接退出，需要先把超管转让给其他成员，或解散家庭。</text>
      </block>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, ROLE_LABELS } from '@/store';
  import {
    cloudAvailable,
    fetchFamily,
    createFamily,
    createInvite,
    updateMember,
    removeMember,
    transferOwner,
    leaveFamily,
    dissolveFamily
  } from '@/services/cloud';
  import { formatDate } from '@/common/utils';

  export default {
    data() {
      return {
        store: state,
        loading: false,
        supported: false,
        inviteRole: 'editor',
        inviteCode: ''
      };
    },
    computed: {
      familyReady() {
        return !!(this.store.auth.token && this.store.family.code);
      },
      familyCode() {
        return this.store.family.code || '';
      },
      isOwner() {
        return this.store.auth.role === 'owner';
      },
      /** 微信登录不可用时降级成了设备身份 */
      isDeviceLogin() {
        return this.store.auth.loginType === 'device';
      }
    },
    onLoad() {
      // #ifdef MP-WEIXIN
      this.supported = cloudAvailable();
      // #endif
    },
    onShow() {
      // 从加入页返回时需要刷新成员列表
      if (this.supported && this.familyReady) this.refresh();
    },
    onShareAppMessage() {
      const babyName = this.store.baby.name || '宝宝';
      return {
        title: `邀请你一起记录 ${babyName} 的成长`,
        path: `/pages/family-join/family-join?invite=${this.inviteCode || ''}`
      };
    },
    methods: {
      roleLabel(role) {
        return ROLE_LABELS[role] || '成员';
      },
      avatarOf(member) {
        return (member.nickname || '家').slice(0, 1);
      },
      joinText(member) {
        if (!member.joinedAt) return member.role === 'owner' ? '创建了这个家庭' : '已加入';
        return `${formatDate(member.joinedAt)} 加入`;
      },
      canManage(member) {
        return this.isOwner && member.memberId !== this.store.auth.memberId;
      },
      async refresh() {
        try {
          await fetchFamily();
        } catch (e) {
          console.warn('[family] 刷新家庭信息失败', e);
        }
      },
      async doCreate() {
        if (this.loading) return;
        this.loading = true;
        try {
          await createFamily();
          await fetchFamily();
          uni.showToast({ title: '家庭已创建', icon: 'success' });
        } catch (e) {
          uni.showModal({ title: '创建失败', content: e.message || '请稍后重试', showCancel: false });
        } finally {
          this.loading = false;
        }
      },
      copyCode() {
        if (!this.familyCode) return;
        uni.setClipboardData({
          data: this.familyCode,
          success: () => uni.showToast({ title: '已复制', icon: 'success' })
        });
      },
      async doInvite() {
        if (this.loading) return;
        this.loading = true;
        try {
          const res = await createInvite(this.inviteRole);
          this.inviteCode = (res && res.code) || '';
          uni.showToast({ title: '邀请码已生成', icon: 'success' });
        } catch (e) {
          uni.showModal({ title: '生成失败', content: e.message || '请稍后重试', showCancel: false });
        } finally {
          this.loading = false;
        }
      },
      copyInvite() {
        if (!this.inviteCode) return;
        uni.setClipboardData({
          data: this.inviteCode,
          success: () => uni.showToast({ title: '已复制', icon: 'success' })
        });
      },
      openMember(member) {
        if (!this.canManage(member)) return;
        const isViewer = member.role === 'viewer';
        uni.showActionSheet({
          itemList: ['修改备注名', isViewer ? '设为共同记录' : '设为仅查看', '转让超管', '移出家庭'],
          success: res => {
            if (res.tapIndex === 0) this.editNickname(member);
            if (res.tapIndex === 1) this.changeRole(member, isViewer ? 'editor' : 'viewer');
            if (res.tapIndex === 2) this.doTransfer(member);
            if (res.tapIndex === 3) this.doRemove(member);
          }
        });
      },
      editNickname(member) {
        uni.showModal({
          title: '修改备注名',
          editable: true,
          placeholderText: '例如：妈妈、奶奶',
          content: member.nickname || '',
          success: async res => {
            if (!res.confirm) return;
            const nickname = String(res.content || '').trim();
            if (!nickname) {
              uni.showToast({ title: '备注名不能为空', icon: 'none' });
              return;
            }
            await this.runAction('updateMember', () => updateMember(member.memberId, { nickname }), '已保存');
          }
        });
      },
      changeRole(member, role) {
        this.runAction('updateMember', () => updateMember(member.memberId, { role }), '权限已更新');
      },
      doTransfer(member) {
        uni.showModal({
          title: '转让超管',
          content: `将超管转让给「${member.nickname || '该成员'}」后，你将变为共同记录。确认转让吗？`,
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            this.runAction('transferOwner', () => transferOwner(member.memberId), '已转让超管');
          }
        });
      },
      doRemove(member) {
        uni.showModal({
          title: '移出家庭',
          content: `「${member.nickname || '该成员'}」将无法再查看和记录这个家庭的数据。`,
          confirmText: '移出',
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            this.runAction('removeMember', () => removeMember(member.memberId), '已移出');
          }
        });
      },
      chooseTransfer() {
        const others = this.store.family.members.filter(item => item.memberId !== this.store.auth.memberId);
        if (!others.length) {
          uni.showToast({ title: '还没有其他成员可以转让', icon: 'none' });
          return;
        }
        uni.showActionSheet({
          itemList: others.map(item => item.nickname || '未命名成员'),
          success: res => this.doTransfer(others[res.tapIndex])
        });
      },
      doLeave() {
        uni.showModal({
          title: '退出家庭',
          content: '退出后将无法查看这个家庭的记录，本地已有记录仍会保留。',
          confirmText: '退出',
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            this.runAction(
              'leaveFamily',
              () => leaveFamily(),
              '已退出家庭',
              () => uni.navigateBack()
            );
          }
        });
      },
      doDissolve() {
        uni.showModal({
          title: '解散家庭',
          content: '所有成员都会被移出，家庭成员将无法再共同记录。确认解散吗？',
          confirmText: '解散',
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            this.runAction(
              'dissolveFamily',
              () => dissolveFamily(),
              '家庭已解散',
              () => uni.navigateBack()
            );
          }
        });
      },
      /** 统一的异步操作壳：统一 loading、报错与刷新 */
      async runAction(tag, runner, successText, after) {
        if (this.loading) return;
        this.loading = true;
        try {
          await runner();
          uni.showToast({ title: successText, icon: 'success' });
          if (after) setTimeout(after, 600);
        } catch (e) {
          console.warn(`[family] ${tag} 失败`, e);
          uni.showModal({ title: '操作失败', content: e.message || '请稍后重试', showCancel: false });
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

  .intro {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  .intro-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #2e2a2b;
  }

  .intro-text {
    font-size: 24rpx;
    color: #a39ca0;
    line-height: 1.7;
  }

  .code-card {
    border-radius: 36rpx;
    padding: 40rpx 32rpx 32rpx;
    background: linear-gradient(135deg, #ff9db0 0%, #ff7b8b 55%, #f2607a 100%);
    box-shadow: 0 16rpx 40rpx rgba(242, 96, 122, 0.24);
    display: flex;
    flex-direction: column;
  }

  .code-label {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.88);
  }

  .code-value {
    font-size: 60rpx;
    font-weight: 700;
    color: #fff;
    letter-spacing: 8rpx;
    margin-top: 10rpx;
  }

  .code-hint {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.82);
    margin-top: 10rpx;
  }

  .code-actions {
    display: flex;
    gap: 18rpx;
    margin-top: 26rpx;
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
    color: #f2607a;
    font-weight: 600;
  }

  .notice {
    margin-top: 20rpx;
    padding: 22rpx 26rpx;
    border-radius: 20rpx;
    background: #fff6e8;
  }

  .notice-text {
    font-size: 23rpx;
    color: #b8834a;
    line-height: 1.6;
  }

  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 20rpx;
  }

  .card-title {
    font-size: 29rpx;
    font-weight: 600;
    color: #2e2a2b;
  }

  .card-sub {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 22rpx 0;
    border-bottom: 1rpx solid #f6efec;
  }

  .member-item:last-child {
    border-bottom: none;
  }

  .member-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    background: #fff1f4;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .member-avatar-text {
    font-size: 30rpx;
    font-weight: 600;
    color: #f2607a;
  }

  .member-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
  }

  .member-name-row {
    display: flex;
    align-items: center;
    gap: 10rpx;
  }

  .member-name {
    font-size: 29rpx;
    font-weight: 600;
    color: #2e2a2b;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .me-tag {
    flex-shrink: 0;
    font-size: 19rpx;
    color: #8a8386;
    background: #f4efec;
    border-radius: 999rpx;
    padding: 2rpx 12rpx;
  }

  .member-meta {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .role-tag {
    flex-shrink: 0;
    font-size: 21rpx;
    border-radius: 999rpx;
    padding: 6rpx 16rpx;
    color: #8a8386;
    background: #f4efec;
  }

  .role-tag.owner {
    color: #d9863c;
    background: #fff3e2;
  }

  .role-tag.editor {
    color: #f2607a;
    background: #fff1f4;
  }

  .role-tag.viewer {
    color: #6f9df0;
    background: #eef3ff;
  }

  .role-picker {
    display: flex;
    gap: 16rpx;
  }

  .role-option {
    flex: 1;
    height: 76rpx;
    border-radius: 20rpx;
    background: #fdf7f4;
    color: #8a8386;
    font-size: 27rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2rpx solid transparent;
  }

  .role-option.active {
    background: #fff1f4;
    color: #f2607a;
    border-color: #ffbcc6;
    font-weight: 600;
  }

  .role-desc {
    display: block;
    margin-top: 14rpx;
    font-size: 22rpx;
    color: #a39ca0;
  }

  .primary-btn {
    margin-top: 24rpx;
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

  .hint {
    display: block;
    margin-top: 20rpx;
    text-align: center;
    font-size: 23rpx;
    color: #b9b1b4;
  }

  .invite-result {
    margin-top: 24rpx;
    padding: 26rpx;
    border-radius: 24rpx;
    background: #fdf7f4;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  .invite-code {
    font-size: 50rpx;
    font-weight: 700;
    color: #f2607a;
    letter-spacing: 10rpx;
  }

  .invite-tip {
    font-size: 22rpx;
    color: #a39ca0;
  }

  .invite-actions {
    display: flex;
    gap: 18rpx;
    margin-top: 16rpx;
  }

  .mini-btn {
    height: 64rpx;
    padding: 0 40rpx;
    border-radius: 999rpx;
    background: #fff;
    color: #f2607a;
    font-size: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2rpx solid #ffd4dc;
  }

  /* 小程序 button 自带样式需要清掉，才能和旁边的 view 对齐 */
  .share-btn {
    margin: 0;
    line-height: normal;
    background: #ff7b8b;
    color: #fff;
    border-color: #ff7b8b;
    font-weight: 500;
  }

  .share-btn::after {
    border: none;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    height: 100rpx;
    border-bottom: 1rpx solid #f6efec;
  }

  .menu-item:last-child {
    border-bottom: none;
  }

  .menu-icon {
    font-size: 32rpx;
    width: 44rpx;
    text-align: center;
  }

  .menu-label {
    flex: 1;
    font-size: 29rpx;
    color: #2e2a2b;
  }

  .danger-text {
    color: #d4767f;
  }

  .empty-tip {
    font-size: 24rpx;
    color: #b6afb2;
    padding: 16rpx 0;
  }

  .foot-hint {
    display: block;
    margin-top: 24rpx;
    font-size: 22rpx;
    color: #b9b1b4;
    line-height: 1.7;
  }

  .safe-bottom {
    height: 48rpx;
  }
</style>
