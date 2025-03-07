import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  publicDir: 'assets',
  resolve: {
    alias: {
      'pixi.js': path.resolve(__dirname, 'node_modules/pixi.js'),
      '@esotericsoftware/spine-pixi-v8': path.resolve(__dirname, 'node_modules/@esotericsoftware/spine-pixi-v8'),
      '@esotericsoftware/spine-core': path.resolve(__dirname, 'node_modules/@esotericsoftware/spine-core')
    }
  },
  server: {
    open: true
  },
  build: {
    outDir: 'dist'
  }
});