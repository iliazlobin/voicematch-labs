// Plugins
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Utilities
import { defineConfig } from 'vite'
// const { defineConfig } = require('@vue/cli-service')
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  // configureWebpack: {
  //   module: {
  //     rules: [
  //       {
  //         test: /GainWorklet\.js$/,
  //         loader: 'worklet-loader',
  //         options: {
  //           name: 'js/[hash].worklet.js'
  //         }
  //       }
  //     ]
  //   }
  // },
  // envPrefix: '',
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
    vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    // basicSsl(),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  server: {
    // host: "0.0.0.0",
    https: false,
    // origin: 'http://localhost:9080',
    port: 9080,
    hmr: {
      // overlay: false,
    },
    proxy: {
      '/youtube/info': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/youtube/download': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/audio/process': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/predictions/wordrecog': {
        target: 'http://localhost:7081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/predictions\/wordrecog/, '/predictions/model'),
      },
      '/predictions/phonerecog': {
        target: 'http://localhost:7082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/predictions\/phonerecog/, '/predictions/model'),
      },
      '/predictions/pitcheval': {
        target: 'http://localhost:7083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/predictions\/pitcheval/, '/invocations'),
      },
    },
  },
})
