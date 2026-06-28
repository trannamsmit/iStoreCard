import axios from 'axios';

/**
 * Lấy base URL theo thứ tự ưu tiên:
 * 1. localStorage (người dùng tự cấu hình qua màn hình ServerConfig - dành cho Android)
 * 2. VITE_API_URL từ .env (dành cho web browser trên PC)
 * 3. Fallback mặc định
 */
const getBaseUrl = () => {
  const saved = localStorage.getItem('serverUrl');
  if (saved) return saved;
  return import.meta.env.VITE_API_URL || 'http://localhost:5050/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Interceptor: Cập nhật baseURL trước mỗi request
// (Xử lý trường hợp user thay đổi IP sau khi app đã khởi động)
api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  return config;
});

export default api;
