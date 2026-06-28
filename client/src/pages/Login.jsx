import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

import bgImage from '../img/photo-1586528116311-ad8dd3c8310d.avif';
import appLogo from '../img/logo.png';

// Phát hiện đang chạy trong APK (Capacitor) hay web browser
const isCapacitorApp = () => {
  return window.Capacitor !== undefined || window.location.protocol === 'capacitor:';
};

// Lấy IP:Port hiện tại từ serverUrl đã lưu
const getCurrentServerDisplay = () => {
  try {
    const saved = localStorage.getItem('serverUrl');
    if (saved) {
      const url = new URL(saved);
      return `${url.hostname}:${url.port || '5050'}`;
    }
  } catch {}
  return '172.26.9.22:5050';
};

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // State cho form sửa IP server
  const [showServerEdit, setShowServerEdit] = useState(false);
  const [serverInput, setServerInput] = useState(getCurrentServerDisplay());
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState(null); // null | 'ok' | 'error'

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/users/login', {
        username: username.trim(),
        password: password.trim()
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      if (err.response) {
        // Server trả về lỗi (sai mật khẩu, tài khoản không tồn tại...)
        alert('Lỗi: ' + err.response.data.message);
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        alert('⏱️ Timeout! Server không phản hồi sau 10 giây.\nKiểm tra:\n1. Server có đang chạy không?\n2. IP có đúng không? (Bấm vào chip IP bên dưới để kiểm tra)');
      } else if (err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        const currentUrl = localStorage.getItem('serverUrl') || 'chưa cấu hình';
        alert(`🔴 Lỗi mạng! Không thể kết nối tới server.\n\nURL đang dùng: ${currentUrl}\n\nKiểm tra:\n1. Điện thoại có cùng WiFi với server?\n2. IP server có đúng không?\n3. Server có đang chạy không?\n\n👉 Bấm vào chip IP bên dưới để sửa.`);
      } else {
        alert(`Lỗi không xác định: ${err.message || JSON.stringify(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra kết nối tới server
  const handleTestConn = async () => {
    if (!serverInput.trim()) return;
    setTestingConn(true);
    setConnStatus(null);
    try {
      const [ip, port] = serverInput.includes(':') 
        ? serverInput.split(':') 
        : [serverInput, '5050'];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`http://${ip.trim()}:${port || '5050'}/api/users`, { signal: controller.signal });
      clearTimeout(timeout);
      setConnStatus(res.ok || res.status === 401 || res.status === 403 ? 'ok' : 'error');
    } catch {
      setConnStatus('error');
    } finally {
      setTestingConn(false);
    }
  };

  // Lưu IP server mới
  const handleSaveServer = () => {
    if (!serverInput.trim()) return;
    const [ip, port] = serverInput.includes(':')
      ? serverInput.split(':')
      : [serverInput, '5050'];
    const url = `http://${ip.trim()}:${port || '5050'}/api`;
    localStorage.setItem('serverUrl', url);
    setShowServerEdit(false);
    setConnStatus(null);
    alert(`✅ Đã lưu: ${ip.trim()}:${port || '5050'}`);
  };

  return (
    <div className="login-container">
      <style>{`
        .login-container {
          display: flex; justify-content: center; align-items: center; min-height: 100vh; width: 100vw;
          background: url('${bgImage}') no-repeat center center/cover;
          position: fixed; top: 0; left: 0; z-index: 9999;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .login-container::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,58,138,0.7) 100%);
          z-index: 0;
        }
        .login-box {
          background: rgba(255,255,255,0.1); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          padding: 50px 40px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          width: 90%; max-width: 420px; text-align: center;
          border: 1px solid rgba(255,255,255,0.2); position: relative; z-index: 1;
          animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .input-group { position: relative; margin-bottom: 20px; }
        .input-icon {
          position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          font-size: 18px; z-index: 2;
        }
        .login-input {
          width: 100%; padding: 16px 16px 16px 48px; border: 1px solid rgba(255,255,255,0.15);
          border-radius: 14px; font-size: 15px; outline: none; box-sizing: border-box;
          background: rgba(0,0,0,0.25); color: white; transition: all 0.3s ease;
        }
        .login-input::placeholder { color: #64748b; }
        .login-input:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); box-shadow: 0 0 0 4px rgba(59,130,246,0.25); }
        .login-btn {
          width: 100%; padding: 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: bold;
          letter-spacing: 1px; cursor: pointer; transition: all 0.3s ease; margin-top: 15px;
          box-shadow: 0 4px 15px rgba(37,99,235,0.4);
        }
        .login-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37,99,235,0.6); }
        .login-btn:active { transform: translateY(1px); }
        .login-btn:disabled { background: #475569; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Chip hiển thị IP server */
        .server-chip {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 18px; padding: 8px 16px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px; cursor: pointer; transition: all 0.2s;
          color: #94a3b8; font-size: 13px;
        }
        .server-chip:hover { background: rgba(255,255,255,0.15); color: #cbd5e1; }
        .server-chip .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }

        /* Panel sửa IP */
        .server-edit-panel {
          margin-top: 15px; padding: 16px; background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; text-align: left;
        }
        .server-edit-panel label { color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }
        .server-edit-input {
          width: 100%; padding: 10px 14px; background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
          color: white; font-size: 15px; outline: none; box-sizing: border-box; margin-bottom: 10px;
        }
        .server-edit-input:focus { border-color: #3b82f6; }
        .server-btn-row { display: flex; gap: 8px; }
        .server-btn {
          flex: 1; padding: 9px; border: none; border-radius: 8px;
          font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .server-btn-test { background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.4); }
        .server-btn-save { background: #2563eb; color: white; }
        .server-btn-cancel { background: rgba(255,255,255,0.08); color: #94a3b8; }

        @media (max-width: 768px) {
          .login-box { padding: 40px 25px; }
        }
      `}</style>

      <div className="login-box">
        {/* Logo */}
        <div style={{ marginBottom: '30px' }}>
          <img src={appLogo} alt="Logo" style={{ height: '160px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
        </div>

        {/* Form đăng nhập */}
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input
              type="text" className="login-input" placeholder="Tên đăng nhập (ID)"
              value={username} onChange={e => setUsername(e.target.value)} required
            />
            <span className="input-icon">👤</span>
          </div>
          <div className="input-group">
            <input
              type="password" className="login-input" placeholder="Mật khẩu"
              value={password} onChange={e => setPassword(e.target.value)} required
            />
            <span className="input-icon">🔒</span>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
          </button>
        </form>

        {/* Chip IP server — chỉ hiện trong APK Android */}
        {isCapacitorApp() && (
          <>
            <div
              className="server-chip"
              onClick={() => { setShowServerEdit(!showServerEdit); setConnStatus(null); setServerInput(getCurrentServerDisplay()); }}
              title="Bấm để thay đổi IP Server"
            >
              <span className="dot"></span>
              <span>🌐 {getCurrentServerDisplay()}</span>
              <span style={{ fontSize: '10px', opacity: 0.6 }}>{showServerEdit ? '▲' : '▼'}</span>
            </div>
            {showServerEdit && (
              <div className="server-edit-panel">
                <label>Địa chỉ IP Server (IP:Port)</label>
                <input
                  type="text"
                  className="server-edit-input"
                  value={serverInput}
                  onChange={e => { setServerInput(e.target.value); setConnStatus(null); }}
                  placeholder="172.26.9.22:5050"
                  inputMode="numeric"
                />
                {connStatus === 'ok' && (
                  <div style={{ color: '#4ade80', fontSize: '13px', marginBottom: '8px' }}>✅ Kết nối thành công!</div>
                )}
                {connStatus === 'error' && (
                  <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '8px' }}>❌ Không kết nối được. Kiểm tra lại IP.</div>
                )}
                <div className="server-btn-row">
                  <button className="server-btn server-btn-test" onClick={handleTestConn} disabled={testingConn}>
                    {testingConn ? '...' : '🔍 Test'}
                  </button>
                  <button className="server-btn server-btn-save" onClick={handleSaveServer}>
                    💾 Lưu
                  </button>
                  <button className="server-btn server-btn-cancel" onClick={() => { setShowServerEdit(false); setConnStatus(null); }}>
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Nút tải APK — chỉ hiện trên web browser, ẩn trong APK */}
        {!isCapacitorApp() && (
          <a
            href={`${(localStorage.getItem('serverUrl') || 'http://172.26.9.22:5050/api').replace('/api', '')}/app.apk`}
            style={{ display: 'block', marginTop: '20px', color: '#a5b4fc', textDecoration: 'none', fontSize: '14px' }}
          >
            📱 Tải App Android
          </a>
        )}
      </div>
    </div>
  );
}

export default Login;
