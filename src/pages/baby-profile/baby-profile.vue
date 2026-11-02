<template>
  <view class="page">
    <view class="page-body">
      <view class="card">
        <text class="label">选择头像</text>
        <view class="avatar-grid">
          <view
            v-for="emoji in avatars"
            :key="emoji"
            class="avatar-option"
            :class="{ active: form.avatar === emoji }"
            @tap="form.avatar = emoji"
          >
            <text class="avatar-emoji">{{ emoji }}</text>
          </view>
        </view>
      </view>

      <view class="card form-card">
        <view class="form-row">
          <text class="label">昵称</text>
          <input
            class="input"
            :value="form.name"
            placeholder="宝宝的小名"
            placeholder-class="ph"
            maxlength="12"
            @input="e => (form.name = e.detail.value)"
          />
        </view>

        <view class="form-row column">
          <text class="label">性别</text>
          <view class="row-value">
            <chip-select
              :options="genderOptions"
              :value="form.gender"
              color="#ff7b8b"
              @change="v => (form.gender = v)"
            />
          </view>
        </view>

        <view class="form-row">
          <text class="label">出生日期</text>
          <picker mode="date" :value="form.birthday" :end="today" @change="onBirthday">
            <view class="picker-value" :class="{ empty: !form.birthday }">
              {{ form.birthday || '请选择' }}
            </view>
          </picker>
        </view>

        <view class="form-row">
          <text class="label">出生身高</text>
          <view class="row-value right">
            <input
              class="input small"
              type="digit"
              :value="form.birthHeight"
              placeholder="选填"
              placeholder-class="ph"
              @input="e => (form.birthHeight = e.detail.value)"
            />
            <text class="unit">cm</text>
          </view>
        </view>

        <view class="form-row">
          <text class="label">出生体重</text>
          <view class="row-value right">
            <input
              class="input small"
              type="digit"
              :value="form.birthWeight"
              placeholder="选填"
              placeholder-class="ph"
              @input="e => (form.birthWeight = e.detail.value)"
            />
            <text class="unit">kg</text>
          </view>
        </view>
      </view>

      <view class="preview" v-if="ageLabel">
        <text class="preview-label">当前月龄</text>
        <text class="preview-value">{{ ageLabel }}</text>
      </view>

      <view class="actions">
        <van-button type="primary" :round="true" :block="true" @tap="save">保存档案</van-button>
      </view>

      <!-- 删除入口只对超管开放，且必须至少保留一个宝宝 -->
      <view class="danger-zone" v-if="canRemove">
        <view class="danger-btn" @tap="removeCurrent">删除这个宝宝</view>
        <text class="danger-tip">删除后，该宝宝的全部记录也会一并清除</text>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import { state, saveBaby, removeBaby, can } from '@/store';
  import { ageText, formatDate, uuid } from '@/common/utils';
  import { maybeSync, saveBabyRemote, removeBabyRemote } from '@/services/cloud';
  import ChipSelect from '@/components/chip-select.vue';

  export default {
    components: { ChipSelect },
    data() {
      return {
        store: state,
        today: formatDate(Date.now()),
        avatars: ['👶', '👧', '👦', '🐣', '🐻', '🐰', '🦊', '🐼'],
        genderOptions: [
          { label: '男宝', value: 'boy' },
          { label: '女宝', value: 'girl' },
          { label: '暂不填', value: 'unknown' }
        ],
        form: {
          name: '',
          gender: 'unknown',
          birthday: '',
          avatar: '👶',
          birthHeight: '',
          birthWeight: ''
        },
        /** 正在编辑的宝宝 ID，空表示当前宝宝 */
        targetId: ''
      };
    },
    computed: {
      ageLabel() {
        return ageText(this.form.birthday);
      },
      canRemove() {
        return this.store.babies.length > 1 && can('baby.remove');
      }
    },
    onLoad(options) {
      const isCreate = !!(options && options.mode === 'create');
      if (isCreate) {
        // 先给个临时 ID，保存时才会真正写进列表
        this.targetId = uuid();
        this.form.avatar = '👶';
        uni.setNavigationBarTitle({ title: '添加宝宝' });
        return;
      }

      const id = options && options.id ? options.id : '';
      const baby = (id && this.store.babies.find(item => item.id === id)) || this.store.baby;
      this.targetId = baby.id || '';
      this.form = {
        name: baby.name || '',
        gender: baby.gender || 'unknown',
        birthday: baby.birthday || '',
        avatar: baby.avatar || '👶',
        birthHeight: baby.birthHeight || '',
        birthWeight: baby.birthWeight || ''
      };
      uni.setNavigationBarTitle({ title: '宝宝档案' });
    },
    methods: {
      onBirthday(e) {
        this.form.birthday = e.detail.value;
      },
      save() {
        if (!can('baby.write')) {
          uni.showToast({ title: '当前身份不能编辑宝宝档案', icon: 'none' });
          return;
        }
        if (!this.form.name.trim()) {
          uni.showToast({ title: '请填写宝宝昵称', icon: 'none' });
          return;
        }
        const saved = saveBaby({
          id: this.targetId || uuid(),
          name: this.form.name.trim(),
          gender: this.form.gender,
          birthday: this.form.birthday,
          avatar: this.form.avatar,
          birthHeight: this.form.birthHeight,
          birthWeight: this.form.birthWeight,
          profileCompleted: true
        });
        maybeSync();
        saveBabyRemote(saved).catch(e => console.warn('[baby] 档案云端保存失败', e));
        uni.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 400);
      },
      removeCurrent() {
        if (!can('baby.remove')) return;
        const name = this.form.name || '这个宝宝';
        uni.showModal({
          title: '删除宝宝',
          content: `删除「${name}」后，它名下的全部记录也会被清除，且无法恢复。`,
          confirmText: '删除',
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            removeBaby(this.targetId);
            removeBabyRemote(this.targetId).catch(e => console.warn('[baby] 云端删除失败', e));
            uni.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => uni.navigateBack(), 400);
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
    padding-top: 24rpx;
  }

  .page-body {
    padding: 0 32rpx;
  }

  .label {
    font-size: 28rpx;
    color: #2e2a2b;
    font-weight: 600;
  }

  .avatar-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20rpx;
    margin-top: 24rpx;
  }

  .avatar-option {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: #fdf5f2;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3rpx solid transparent;
  }

  .avatar-option.active {
    border-color: #ff7b8b;
    background: #fff1f4;
  }

  .avatar-emoji {
    font-size: 50rpx;
    line-height: 1;
  }

  .form-card {
    margin-top: 24rpx;
    padding-top: 8rpx;
    padding-bottom: 8rpx;
  }

  .form-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 104rpx;
    border-bottom: 1rpx solid #f6efec;
  }

  .form-row:last-child {
    border-bottom: none;
  }

  .form-row.column {
    flex-direction: column;
    align-items: flex-start;
    padding: 26rpx 0;
    gap: 20rpx;
  }

  .row-value {
    display: flex;
    align-items: center;
    gap: 10rpx;
  }

  .row-value.right {
    justify-content: flex-end;
  }

  .input {
    flex: 1;
    text-align: right;
    font-size: 29rpx;
    color: #2e2a2b;
  }

  .input.small {
    width: 200rpx;
    flex: none;
  }

  .ph {
    color: #c0b9bc;
    font-size: 26rpx;
  }

  .picker-value {
    font-size: 29rpx;
    color: #2e2a2b;
  }

  .picker-value.empty {
    color: #c0b9bc;
  }

  .unit {
    font-size: 24rpx;
    color: #a39ca0;
  }

  .preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24rpx;
    padding: 28rpx 32rpx;
    background: #fff1f4;
    border-radius: 24rpx;
  }

  .preview-label {
    font-size: 26rpx;
    color: #b4707c;
  }

  .preview-value {
    font-size: 30rpx;
    font-weight: 600;
    color: #f2607a;
  }

  .actions {
    margin-top: 48rpx;
  }

  .danger-zone {
    margin-top: 56rpx;
    padding-bottom: 24rpx;
    text-align: center;
  }

  .danger-btn {
    display: inline-block;
    padding: 20rpx 40rpx;
    font-size: 28rpx;
    color: #f2607a;
    background: #fff;
    border-radius: 999rpx;
    border: 1rpx solid #f7d3d9;
  }

  .danger-tip {
    display: block;
    margin-top: 16rpx;
    font-size: 23rpx;
    color: #b9b1b4;
  }
</style>
