import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import {fileURLToPath, URL} from 'node:url'

// https://vite.dev/config/
export default defineConfig({
    base: '/',
    plugins: [vue(), tailwindcss()],
    build: {
        emptyOutDir: true,
        assetsDir: './web_assets',
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://10.6.2.51:8000',
                changeOrigin: true,
            },
            '/sse': {
                target: 'http://10.6.2.51:8001',
                changeOrigin: true,
            },
        },
    },
})
