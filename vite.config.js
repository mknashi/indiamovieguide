import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    // Avoid using generic PORT env vars here (they're often set for the Vite dev server itself).
    var apiPort = env.VITE_API_PORT || env.API_PORT || '8787';
    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    // The API binds to 127.0.0.1 in dev; using the IP avoids IPv6 localhost quirks.
                    target: "http://127.0.0.1:".concat(apiPort),
                    changeOrigin: true
                }
            }
        },
        preview: {
            port: 4173
        }
    };
});
