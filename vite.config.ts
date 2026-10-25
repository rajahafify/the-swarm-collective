import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        site: 'index.html',
        play: 'play/index.html'
      }
    }
  }
});
