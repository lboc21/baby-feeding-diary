import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  build: {
    // 微信小程序主包体积有限，关闭 sourcemap
    sourcemap: false
  }
});
