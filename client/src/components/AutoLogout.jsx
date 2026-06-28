import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AutoLogout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Không áp dụng bộ đếm giờ nếu người dùng đang ở trang đăng nhập
    if (location.pathname === '/login') return;

    let timeoutId;

    const logout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert('Tài khoản đã tự động đăng xuất do không có hoạt động nào trong 60 phút.');
      navigate('/login');
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(logout, 60 * 60 * 1000); // 60 phút = 3600000 milliseconds
    };

    // Danh sách các sự kiện được coi là "Có hoạt động"
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // Bắt đầu đếm ngay khi component được render

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [navigate, location.pathname]);

  return null; // Component này chạy ngầm, không render ra giao diện
};

export default AutoLogout;