import {resolve} from 'node:path';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react()],
  // Share Remotion's public folder so staticFile('samples/...') (sample logos and screenshots) works in the Player.
  publicDir: resolve(__dirname, '../../packages/video/public'),
  server: {
    fs: {allow: [resolve(__dirname, '../..')]},
  },
});
