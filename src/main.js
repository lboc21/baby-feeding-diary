import { createSSRApp } from 'vue';
import App from './App.vue';

// #ifdef H5
import VanIcon from './components/h5/van-icon.vue';
import VanButton from './components/h5/van-button.vue';
import VanStepper from './components/h5/van-stepper.vue';
import VanSwitch from './components/h5/van-switch.vue';
// #endif

export function createApp() {
  const app = createSSRApp(App);

  // #ifdef H5
  // Vant Weapp 是微信小程序原生组件，浏览器里无法渲染。
  // 这里注册等价的 Vue 组件，仅用于 H5 预览调试，不影响小程序端产物。
  app.component('van-icon', VanIcon);
  app.component('van-button', VanButton);
  app.component('van-stepper', VanStepper);
  app.component('van-switch', VanSwitch);
  // #endif

  return { app };
}
