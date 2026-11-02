<script>
  import { initStore } from '@/store';

  export default {
    onLaunch() {
      initStore();
    },
    onShow() {},
    onHide() {}
  };
</script>

<style>
  /* ---------------- 设计变量 ---------------- */
  page {
    --bfd-primary: #ff7b8b;
    --bfd-primary-deep: #f2607a;
    --bfd-primary-soft: #ffe9ed;
    --bfd-text: #2e2a2b;
    --bfd-text-2: #6b6467;
    --bfd-text-3: #a39ca0;
    --bfd-bg: #fff8f5;
    --bfd-card: #ffffff;
    --bfd-border: #f4ebe8;
    --bfd-radius: 32rpx;

    /* Vant Weapp 主题（同时兼容带 van- 前缀的写法） */
    --button-primary-background-color: #ff7b8b;
    --button-primary-border-color: #ff7b8b;
    --van-button-primary-background-color: #ff7b8b;
    --van-button-primary-border-color: #ff7b8b;
    --button-border-radius: 999rpx;
    --button-default-border-color: #f4ebe8;
    --button-default-color: #6b6467;
    --cell-background-color: transparent;
    --cell-border-color: #f6efec;
    --cell-text-color: #2e2a2b;
    --cell-value-color: #6b6467;
    --cell-vertical-padding: 24rpx;
    --cell-horizontal-padding: 0;
    --field-input-text-color: #2e2a2b;
    --field-placeholder-text-color: #bdb6b9;
    --field-input-font-size: 30rpx;
    --stepper-background-color: #fff1f4;
    --stepper-button-icon-color: #ff7b8b;
    --stepper-input-text-color: #2e2a2b;
    --switch-on-background-color: #ff7b8b;
    --switch-size: 48rpx;
    --tag-primary-color: #ff7b8b;
    --tag-text-color: #ff7b8b;
    --tag-border-color: #ffd6de;
    --tag-background-color: #fff1f4;
    --divider-border-color: #f4ebe8;
    --divider-text-color: #a39ca0;
    --empty-description-color: #a39ca0;
    --loading-spinner-color: #ff7b8b;

    background-color: var(--bfd-bg);
    color: var(--bfd-text);
    font-size: 28rpx;
    font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  view,
  text,
  scroll-view,
  input,
  textarea {
    box-sizing: border-box;
  }

  /* ---------------- 布局工具 ---------------- */
  .page-body {
    padding: 0 32rpx;
  }

  .row {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .col {
    display: flex;
    flex-direction: column;
  }

  .between {
    justify-content: space-between;
  }

  .center {
    justify-content: center;
    align-items: center;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .card {
    background: var(--bfd-card);
    border-radius: var(--bfd-radius);
    padding: 32rpx;
    box-shadow: 0 10rpx 36rpx rgba(226, 168, 160, 0.12);
  }

  .card + .card {
    margin-top: 24rpx;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40rpx 0 20rpx;
  }

  .section-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--bfd-text);
  }

  .section-more {
    font-size: 24rpx;
    color: var(--bfd-text-3);
  }

  .title-lg {
    font-size: 40rpx;
    font-weight: 700;
    letter-spacing: 1rpx;
  }

  .muted {
    color: var(--bfd-text-3);
    font-size: 24rpx;
  }

  .text-2 {
    color: var(--bfd-text-2);
  }

  .ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* ---------------- 常用元素 ---------------- */
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 64rpx;
    padding: 0 28rpx;
    border-radius: 999rpx;
    background: #fff4f1;
    color: var(--bfd-text-2);
    font-size: 26rpx;
    border: 2rpx solid transparent;
    transition: all 0.15s ease;
  }

  .pill-active {
    background: var(--bfd-primary-soft);
    color: var(--bfd-primary-deep);
    border-color: #ffc9d3;
    font-weight: 600;
  }

  .type-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
  }

  .divider-line {
    height: 1rpx;
    background: var(--bfd-border);
  }

  .safe-bottom {
    height: calc(32rpx + env(safe-area-inset-bottom));
  }
</style>
