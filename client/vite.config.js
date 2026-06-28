import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Mở IP LAN để máy khác truy cập được
    port: 5555, // Đổi sang cổng 5555 (hoặc 5111 tùy bạn)
    strictPort: true // Bắt buộc dùng cổng này, nếu trùng sẽ báo lỗi chứ không tự nhảy cổng khác
  }
});
