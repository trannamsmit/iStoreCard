import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Materials from './pages/Materials';
import Transactions from './pages/Transactions';
import Login from './pages/Login';
import Users from './pages/Users';
import Reports from './pages/Reports';
import PrintLabel from './pages/PrintLabel';
import AutoLogout from './components/AutoLogout';
import ServerConfig from './components/ServerConfig';
import api from './api';
import appLogo from './img/logo.png';

// Phát hiện đang chạy trên Android (Capacitor) hay Web Browser
const isAndroidApp = () => {
  return window.location.protocol === 'capacitor:' || 
         window.Capacitor !== undefined ||
         (navigator.userAgent.includes('Android') && !navigator.userAgent.includes('Chrome/') && window.location.protocol === 'file:');
};

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [changePassData, setChangePassData] = useState({ oldPassword: '', newPassword: '' });
  
  const menuRef = useRef(null);

  // Đóng menu khi click ra ngoài vùng menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Đóng menu khi chuyển sang trang khác
  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (!changePassData.oldPassword || !changePassData.newPassword) return alert('Vui lòng nhập đủ mật khẩu cũ và mới!');
    try {
      await api.post('/users/change-password', { ...changePassData, userId: currentUser.id });
      alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      handleLogout();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi đổi mật khẩu');
    }
  };

  // Ẩn Header nếu đang ở trang Đăng nhập
  if (location.pathname === '/login') return null;

  return (
    <>
      <nav className="top-nav">
        <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center' }}>
          <img src={appLogo} alt="iStoreCard Logo" style={{ height: '35px', marginRight: '10px' }} />
          <h1 className="desktop-logo" style={{ fontSize: '22px' }}>iStoreCard</h1>
        </Link>
        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {currentUser.role === 'Admin' && location.pathname !== '/users' && (
            <Link to="/users" className="nav-link hide-on-mobile" style={{ backgroundColor: '#e67e22', color: 'white' }}>👥 Quản lý User</Link>
          )}
          {location.pathname !== '/materials' && (
            <Link to="/materials" className="nav-link hide-on-mobile">📦 Thông Tin Vật Liệu</Link>
          )}
          {currentUser.username && (
            <div className="user-profile-container" style={{ position: 'relative' }} ref={menuRef}>
              <div 
                className="user-badge" 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '20px' }}
              >
                <span className="avatar-icon" style={{ background: '#3498db', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : '?'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="user-fullname-text" style={{ fontWeight: 'bold', color: 'white', fontSize: '14px' }}>{currentUser.fullName}</span>
                  <span className="user-id-text" style={{ fontSize: '11px', color: '#bdc3c7' }}>ID: {currentUser.username}</span>
                </div>
              </div>
              {isUserMenuOpen && (
                <div className="user-dropdown-menu">
                  {currentUser.role === 'Admin' && (
                    <button className="hide-on-mobile" onClick={() => { navigate('/reports'); }}>📊 Dữ liệu</button>
                  )}
                  <button onClick={() => { navigate('/print-label'); }}>🏷️ In Tem Nhãn</button>
                  <button onClick={() => { setIsChangePassOpen(true); }}>🔑 Đổi mật khẩu</button>
                  <button onClick={() => { localStorage.removeItem('serverUrl'); window.location.reload(); }} style={{ color: '#2980b9' }}>🌐 Đổi IP Server</button>
                  <button onClick={handleLogout} style={{ color: '#e74c3c', fontWeight: 'bold', borderTop: '1px solid #eee' }}>🚪 Đăng xuất</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {isChangePassOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ width: '90%', maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>🔑 Đổi Mật Khẩu</h3>
              <button className="close-btn" onClick={() => setIsChangePassOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label>Mật khẩu cũ</label>
              <input type="password" placeholder="Nhập mật khẩu hiện tại" className="form-control" value={changePassData.oldPassword} onChange={e => setChangePassData({...changePassData, oldPassword: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Mật khẩu mới</label>
              <input type="password" placeholder="Nhập mật khẩu mới" className="form-control" value={changePassData.newPassword} onChange={e => setChangePassData({...changePassData, newPassword: e.target.value})} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
              <button className="btn btn-secondary" onClick={() => setIsChangePassOpen(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleChangePassword}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  // Kiểm tra xem app có cần hiển thị màn hình cấu hình server không (Android chưa cấu hình)
  const [serverConfigured, setServerConfigured] = useState(() => {
    return !!localStorage.getItem('serverUrl');
  });

  // Nếu đang chạy trên Android mà chưa có cấu hình server → hiện màn hình setup
  if (isAndroidApp() && !serverConfigured) {
    return <ServerConfig onConfigured={() => setServerConfigured(true)} />;
  }

  const globalStyles = `
    body { background-color: #f4f7f6; color: #2c3e50; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .app-container { min-height: 100vh; }
    
    .top-nav { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 15px 40px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); position: relative; }
    .top-nav h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; display: flex; align-items: center; gap: 10px; }
    
    .user-dropdown-menu { position: absolute; top: 110%; right: 0; background: white; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); z-index: 2000; width: 180px; overflow: hidden; }
    .user-dropdown-menu button { display: block; width: 100%; text-align: left; padding: 12px 15px; background: none; border: none; border-bottom: 1px solid #eee; cursor: pointer; color: #2c3e50; font-size: 14px; transition: background 0.2s; }
    .user-dropdown-menu button:hover { background: #f8f9fa; }
    .user-dropdown-menu button:last-child { border-bottom: none; }

    .nav-link { color: #fff; text-decoration: none; font-weight: 500; background: rgba(255,255,255,0.15); padding: 8px 18px; border-radius: 20px; transition: all 0.3s ease; }
    .nav-link:hover { background: rgba(255,255,255,0.3); transform: translateY(-1px); }
    .main-content { padding: 30px 40px; max-width: 1400px; margin: 0 auto; }
    .card, .card-panel { background: #fff; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.05); padding: 25px; margin-bottom: 25px; }
    .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .header-actions h2 { margin: 0; color: #2c3e50; font-weight: 600; }
    .btn-group { display: flex; gap: 12px; align-items: center; }
    .btn { padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; color: white; }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: #3498db; } .btn-primary:hover { background: #2980b9; box-shadow: 0 4px 10px rgba(52, 152, 219, 0.3); }
    .btn-success { background: #2ecc71; } .btn-success:hover { background: #27ae60; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.3); }
    .btn-warning { background: #f39c12; } .btn-warning:hover { background: #e67e22; box-shadow: 0 4px 10px rgba(243, 156, 18, 0.3); }
    .btn-danger { background: #e74c3c; } .btn-danger:hover { background: #c0392b; box-shadow: 0 4px 10px rgba(231, 76, 60, 0.3); }
    .btn-secondary { background: #95a5a6; } .btn-secondary:hover { background: #7f8c8d; box-shadow: 0 4px 10px rgba(149, 165, 166, 0.3); }
    .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; }
    .modern-table th { background-color: #f8f9fa; color: #6c757d; font-weight: 600; padding: 10px 8px; text-align: left; border-bottom: 2px solid #dee2e6; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .modern-table td { padding: 8px; border-bottom: 1px solid #e9ecef; vertical-align: middle; font-size: 13px; }
    .modern-table tbody tr { transition: background-color 0.2s ease; }
    .modern-table tbody tr:hover { background-color: #f8f9fa; }
    .action-link { color: #3498db; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; background: rgba(52,152,219,0.1); transition: all 0.2s; }
    .action-link:hover { background: #3498db; color: white; }
    .badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #e9ecef; color: #495057; display: inline-block; }
    .badge-primary { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
    .badge-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .badge-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
    .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; }
    .info-box span { display: block; font-size: 12px; color: #6c757d; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
    .info-box strong { font-size: 16px; color: #2c3e50; }
    .empty-state { text-align: center; padding: 40px; color: #6c757d; font-style: italic; }

    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal-content { background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 600px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .modal-header h3 { margin: 0; color: #2c3e50; }
    .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #7f8c8d; line-height: 1; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; }
    .form-group label { font-size: 13px; font-weight: bold; color: #34495e; }
    .form-control { padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    .form-control:focus { border-color: #3498db; outline: none; box-shadow: 0 0 0 2px rgba(52,152,219,0.2); }
    .search-box { padding: 10px 15px; border: 1px solid #ddd; border-radius: 20px; width: 300px; font-size: 14px; outline: none; transition: all 0.3s; }
    .search-box:focus { border-color: #3498db; box-shadow: 0 0 0 2px rgba(52,152,219,0.2); width: 350px; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
    .page-info { font-weight: 600; color: #2c3e50; font-size: 14px; }
    .page-btn { padding: 6px 15px; font-size: 13px; }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    @media (max-width: 768px) {
      .top-nav { flex-direction: row; padding: 12px 15px; justify-content: space-between; }
      .desktop-logo { display: flex !important; font-size: 18px !important; }
      .nav-actions { margin-left: 0; justify-content: flex-end; width: auto; gap: 10px; }
      .hide-on-mobile { display: none !important; }
      .user-badge { padding: 0 !important; background: transparent !important; flex-direction: row-reverse; }
      .avatar-icon { display: none !important; }
      .user-id-text { display: none !important; }
      .user-fullname-text { font-size: 15px !important; font-weight: bold; color: #fff !important; margin: 0 !important; text-transform: capitalize; }
      .main-content { padding: 15px 10px !important; }
    }
  `;

  return (
    <Router>
      <AutoLogout />
      <div className="app-container">
        <style>{globalStyles}</style>
        
        <Header />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Transactions />} />
            <Route path="/transactions/:id" element={<Transactions />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/login" element={<Login />} />
            <Route path="/users" element={<Users />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/print-label" element={<PrintLabel />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
