<template>
  <view class="page">
    <!-- 类型切换（仅新增时展示） -->
    <scroll-view v-if="!isEdit && !readonly" scroll-x class="type-scroller" :show-scrollbar="false">
      <view class="type-tabs">
        <view
          v-for="item in types"
          :key="item.key"
          class="type-tab"
          :class="{ active: form.type === item.key }"
          :style="tabStyle(item)"
          @tap="switchType(item.key)"
        >
          <text class="type-emoji">{{ item.icon }}</text>
          <text class="type-name">{{ item.name }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="page-body">
      <!-- 仅查看身份：不隐藏内容，但禁用一切修改 -->
      <view class="readonly-tip" v-if="readonly">
        <text class="readonly-text">当前身份仅可查看，无法修改这条记录</text>
      </view>

      <!-- 时间 -->
      <view class="card time-card">
        <view class="row between">
          <text class="field-label">发生时间</text>
          <view class="pickers">
            <picker mode="date" :value="dateStr" @change="onDateChange">
              <view class="picker-chip">{{ dateStr }}</view>
            </picker>
            <picker mode="time" :value="timeStr" @change="onTimeChange">
              <view class="picker-chip strong">{{ timeStr }}</view>
            </picker>
          </view>
        </view>
        <view class="quick-row">
          <text class="quick-pill" @tap="setNow">现在</text>
          <text class="quick-pill" @tap="shiftMinutes(-15)">-15分</text>
          <text class="quick-pill" @tap="shiftMinutes(-30)">-30分</text>
          <text class="quick-pill" @tap="shiftMinutes(-60)">-1小时</text>
        </view>
      </view>

      <!-- 动态字段 -->
      <view class="card fields-card">
        <view class="field" v-for="(field, index) in fields" :key="field.key">
          <view class="field-head">
            <text class="field-label">{{ field.label }}</text>
            <text class="field-tip" v-if="field.tip">{{ field.tip }}</text>
          </view>

          <chip-select
            v-if="field.type === 'chips'"
            :options="field.options"
            :multiple="!!field.multiple"
            :color="meta.color"
            :value="form.payload[field.key]"
            @change="val => setField(field.key, val)"
          />

          <view class="stepper-row" v-else-if="field.type === 'stepper'">
            <van-stepper
              :value="form.payload[field.key]"
              :min="field.min || 0"
              :max="field.max || 9999"
              :step="field.step || 1"
              :integer="true"
              @change="e => setField(field.key, e.detail)"
            />
            <text class="unit-text">{{ field.unit }}</text>
          </view>

          <view class="input-row" v-else-if="field.type === 'number'">
            <input
              class="input"
              type="digit"
              :value="form.payload[field.key]"
              :placeholder="field.placeholder"
              placeholder-class="ph"
              @input="e => setField(field.key, e.detail.value)"
            />
            <text class="unit-text" v-if="field.unit">{{ field.unit }}</text>
          </view>

          <view class="input-row" v-else-if="field.type === 'text'">
            <input
              class="input"
              :value="form.payload[field.key]"
              :placeholder="field.placeholder"
              placeholder-class="ph"
              maxlength="50"
              @input="e => setField(field.key, e.detail.value)"
            />
          </view>

          <view class="switch-row" v-else-if="field.type === 'switch'">
            <van-switch :checked="!!form.payload[field.key]" :size="24" @change="e => setField(field.key, e.detail)" />
          </view>

          <view class="field-divider" v-if="index < fields.length - 1"></view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="card">
        <text class="field-label">备注</text>
        <textarea
          class="note-input"
          :value="form.note"
          placeholder="补充一些细节，比如宝宝的反应"
          placeholder-class="ph"
          maxlength="200"
          @input="onNoteInput"
        />
        <text class="note-count">{{ form.note.length }}/200</text>
      </view>

      <view class="actions" v-if="!readonly">
        <van-button type="primary" :round="true" :block="true" @tap="save">保存记录</van-button>
        <view class="delete-btn" v-if="isEdit" @tap="confirmDelete">删除这条记录</view>
      </view>

      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<script>
  import {
    state,
    addRecord,
    getRecord,
    updateRecord,
    removeRecord,
    createRecord,
    initialPayload,
    applyFeedingHistory,
    can
  } from '@/store';
  import { RECORD_TYPES, RECORD_TYPE_MAP, createPayload, visibleFields } from '@/common/record-schema';
  import { parseDateTime, formatDate, formatTime } from '@/common/utils';
  import ChipSelect from '@/components/chip-select.vue';
  import { maybeSync } from '@/services/cloud';

  export default {
    components: { ChipSelect },
    data() {
      return {
        types: RECORD_TYPES,
        store: state,
        isEdit: false,
        /** 只读态：仅查看身份打开历史记录时只展示，不提供任何修改入口 */
        readonly: false,
        recordId: '',
        form: {
          type: 'feeding',
          time: Date.now(),
          payload: createPayload('feeding'),
          note: ''
        },
        dateStr: formatDate(Date.now()),
        timeStr: formatTime(Date.now())
      };
    },
    computed: {
      meta() {
        return RECORD_TYPE_MAP[this.form.type] || RECORD_TYPES[0];
      },
      fields() {
        return visibleFields(this.form.type, this.form.payload);
      }
    },
    onLoad(options) {
      // 只读可由调用方指定（如 records 页的只读入口），也可由角色直接推导
      this.readonly = !!(options && options.readonly) || !can('record.write');

      if (options && options.id) {
        const record = getRecord(options.id);
        // 记录可能已被删除或同步覆盖，不能静默降级成「新增」表单
        if (!record) {
          uni.showToast({ title: '这条记录已不存在', icon: 'none' });
          setTimeout(() => uni.navigateBack(), 1200);
          return;
        }
        this.isEdit = true;
        this.recordId = record.id;
        this.form = {
          type: record.type,
          time: record.time,
          payload: { ...createPayload(record.type), ...(record.payload || {}) },
          note: record.note || ''
        };
        this.dateStr = formatDate(record.time);
        this.timeStr = formatTime(record.time);
        uni.setNavigationBarTitle({ title: `编辑${this.meta.name}` });
        return;
      }
      const type = options && options.type ? options.type : 'feeding';
      this.switchType(RECORD_TYPE_MAP[type] ? type : 'feeding');
    },
    methods: {
      tabStyle(item) {
        if (this.form.type !== item.key) return '';
        return `background:${item.bg};color:${item.color};border-color:${item.color}33;`;
      },
      switchType(type) {
        if (this.readonly) return;
        this.form.type = type;
        // 新建时沿用上一条同类记录的方式/侧别/时长/奶量，编辑模式不会走到这里
        this.form.payload = this.isEdit ? createPayload(type) : initialPayload(type);
        uni.setNavigationBarTitle({ title: this.isEdit ? `编辑${this.meta.name}` : this.meta.name });
      },
      setField(key, value) {
        if (this.readonly) return;
        this.form.payload[key] = value;
        // 新建时从亲喂切到瓶喂（或反过来）带出该方式上次用的侧别/时长/奶量；
        // 编辑历史记录时不自动填充，避免覆盖用户正在修正的数据
        if (key === 'mode' && this.form.type === 'feeding' && !this.isEdit) {
          applyFeedingHistory(this.form.payload, value);
        }
      },
      onNoteInput(e) {
        if (this.readonly) return;
        this.form.note = e.detail.value;
      },
      onDateChange(e) {
        if (this.readonly) return;
        this.dateStr = e.detail.value;
      },
      onTimeChange(e) {
        if (this.readonly) return;
        this.timeStr = e.detail.value;
      },
      setNow() {
        if (this.readonly) return;
        const now = Date.now();
        this.dateStr = formatDate(now);
        this.timeStr = formatTime(now);
      },
      shiftMinutes(minutes) {
        if (this.readonly) return;
        const base = parseDateTime(this.dateStr, this.timeStr);
        const next = base + minutes * 60000;
        this.dateStr = formatDate(next);
        this.timeStr = formatTime(next);
      },
      normalizePayload() {
        const payload = {};
        this.fields.forEach(field => {
          const raw = this.form.payload[field.key];
          if (raw === '' || raw === undefined || raw === null) return;
          if (field.type === 'number' || field.type === 'stepper') {
            const num = Number(raw);
            if (!Number.isNaN(num)) payload[field.key] = num;
            return;
          }
          if (Array.isArray(raw)) {
            if (raw.length) payload[field.key] = raw;
            return;
          }
          payload[field.key] = raw;
        });
        return payload;
      },
      validate(payload) {
        switch (this.form.type) {
          case 'feeding':
            if (payload.mode === 'breast' && !payload.duration) return '请填写喂养时长';
            if (payload.mode !== 'breast' && !payload.amount) return '请填写奶量';
            return '';
          case 'temperature':
            if (!payload.value) return '请填写体温';
            if (payload.value < 34 || payload.value > 43) return '体温应在 34-43℃ 之间';
            return '';
          case 'growth':
            if (!payload.height && !payload.weight && !payload.head) return '至少填写身高、体重或头围中的一项';
            return '';
          case 'medicine':
            if (!payload.name) return '请填写药品名称';
            return '';
          case 'solid':
            if (!payload.food) return '请填写食物名称';
            return '';
          default:
            return '';
        }
      },
      save() {
        if (this.readonly) {
          uni.showToast({ title: '当前身份仅可查看，不能保存', icon: 'none' });
          return;
        }
        const payload = this.normalizePayload();
        const error = this.validate(payload);
        if (error) {
          uni.showToast({ title: error, icon: 'none' });
          return;
        }
        const time = parseDateTime(this.dateStr, this.timeStr);

        if (this.isEdit) {
          updateRecord(this.recordId, { time, payload, note: this.form.note });
        } else {
          const record = createRecord(this.form.type, { time, payload, note: this.form.note });
          addRecord(record);
        }
        uni.showToast({ title: '已保存', icon: 'success', duration: 1200 });
        maybeSync();
        setTimeout(() => uni.navigateBack(), 400);
      },
      confirmDelete() {
        if (this.readonly) return;
        uni.showModal({
          title: '删除记录',
          content: '删除后无法恢复，确认删除吗？',
          confirmText: '删除',
          confirmColor: '#f2607a',
          success: res => {
            if (!res.confirm) return;
            removeRecord(this.recordId);
            maybeSync();
            uni.navigateBack();
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
    padding-bottom: 40rpx;
  }

  .type-scroller {
    width: 100%;
    white-space: nowrap;
    padding: 16rpx 0 8rpx;
  }

  .type-tabs {
    display: inline-flex;
    padding: 0 32rpx;
    gap: 14rpx;
  }

  .type-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    white-space: nowrap;
    gap: 10rpx;
    height: 72rpx;
    padding: 0 26rpx;
    border-radius: 999rpx;
    background: #fff;
    border: 2rpx solid transparent;
    color: #8a8386;
  }

  .type-tab.active {
    font-weight: 600;
  }

  .type-emoji {
    font-size: 30rpx;
    line-height: 1;
  }

  .type-name {
    font-size: 26rpx;
    white-space: nowrap;
  }

  .page-body {
    padding: 16rpx 32rpx 0;
  }

  .readonly-tip {
    margin-top: 12rpx;
    padding: 22rpx 26rpx;
    border-radius: 20rpx;
    background: #fff6e8;
  }

  .readonly-text {
    font-size: 25rpx;
    color: #b8834a;
    line-height: 1.5;
  }

  .time-card {
    margin-top: 12rpx;
  }

  .field-label {
    font-size: 28rpx;
    color: #2e2a2b;
    font-weight: 600;
  }

  .field-tip {
    font-size: 22rpx;
    color: #a39ca0;
    margin-left: 12rpx;
  }

  .pickers {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  .picker-chip {
    height: 60rpx;
    padding: 0 24rpx;
    border-radius: 16rpx;
    background: #fdf5f2;
    display: flex;
    align-items: center;
    font-size: 26rpx;
    color: #6b6467;
  }

  .picker-chip.strong {
    color: #f2607a;
    font-weight: 600;
    background: #fff1f4;
  }

  .quick-row {
    display: flex;
    gap: 14rpx;
    margin-top: 24rpx;
  }

  .quick-pill {
    height: 56rpx;
    padding: 0 26rpx;
    border-radius: 999rpx;
    background: #fdf5f2;
    color: #8a8386;
    font-size: 24rpx;
    display: flex;
    align-items: center;
  }

  .fields-card {
    padding-top: 8rpx;
    padding-bottom: 8rpx;
  }

  .field {
    padding: 28rpx 0 4rpx;
  }

  .field-head {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
  }

  .field-divider {
    height: 1rpx;
    background: #f6efec;
    margin-top: 28rpx;
  }

  .stepper-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding-bottom: 20rpx;
  }

  .unit-text {
    font-size: 24rpx;
    color: #a39ca0;
  }

  .input-row {
    display: flex;
    align-items: center;
    background: #fdf7f4;
    border-radius: 20rpx;
    padding: 0 24rpx;
    height: 88rpx;
    margin-bottom: 20rpx;
  }

  .input {
    flex: 1;
    font-size: 30rpx;
    color: #2e2a2b;
  }

  .ph {
    color: #c0b9bc;
    font-size: 28rpx;
  }

  .switch-row {
    padding-bottom: 20rpx;
  }

  .note-input {
    width: 100%;
    height: 160rpx;
    margin-top: 18rpx;
    font-size: 28rpx;
    color: #2e2a2b;
    line-height: 1.5;
  }

  .note-count {
    display: block;
    text-align: right;
    font-size: 22rpx;
    color: #c9c2c4;
  }

  .actions {
    margin-top: 40rpx;
  }

  .delete-btn {
    margin-top: 28rpx;
    text-align: center;
    font-size: 26rpx;
    color: #c98f96;
    padding: 16rpx 0;
  }
</style>
