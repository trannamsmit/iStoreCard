import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

import bgImage from '../img/photo-1586528116311-ad8dd3c8310d.avif';
import appLogo from '../img/logo.png';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      navigate('/'); // Chuyển về trang chủ
    } catch (err) {
      if (err.response) {
        alert('Lỗi: ' + err.response.data.message);
      } else {
        alert('Lỗi kết nối máy chủ! (Vui lòng kiểm tra Terminal xem Backend có đang bị lỗi tắt đột ngột không)');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <style>
        {`
          .login-container {
            display: flex; justify-content: center; align-items: center; min-height: 100vh; width: 100vw;
            background: url('${bgImage}') no-repeat center center/cover;
            position: fixed; top: 0; left: 0; z-index: 9999;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }
          .login-container::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 58, 138, 0.7) 100%);
            z-index: 0;
          }
          .login-box {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            padding: 50px 40px; border-radius: 24px; 
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            width: 90%; max-width: 420px; text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.2);
            position: relative;
            z-index: 1;
            animation: fadeIn 0.8s ease-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .input-group {
            position: relative;
            margin-bottom: 20px;
          }
          .input-icon {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 18px;
            transition: all 0.3s ease;
            z-index: 2;
          }
          .login-input { 
            width: 100%; padding: 16px 16px 16px 48px; border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; font-size: 15px; outline: none; box-sizing: border-box; background: rgba(0,0,0,0.25); color: white; transition: all 0.3s ease; 
            position: relative;
          }
          .login-input::placeholder {
            color: #64748b;
          }
          .login-input:focus { 
            border-color: #3b82f6; background: rgba(0,0,0,0.4); box-shadow: 0 0 0 4px rgba(59,130,246,0.25); 
          }
          .login-input:focus ~ .input-icon {
            transform: translateY(-50%) scale(1.1);
          }
          .login-btn { 
            width: 100%; padding: 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: bold; letter-spacing: 1px; cursor: pointer; transition: all 0.3s ease; margin-top: 15px;
            box-shadow: 0 4px 15px rgba(37,99,235,0.4);
          }
          .login-btn:hover { 
            transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37,99,235,0.6); 
          }
          .login-btn:active {
            transform: translateY(1px); box-shadow: 0 2px 10px rgba(37,99,235,0.4);
          }
          .login-btn:disabled {
            background: #475569; cursor: not-allowed; transform: none; box-shadow: none;
          }
          
          @media (max-width: 768px) {
            .login-box { padding: 40px 25px; }
            .login-box h2 { font-size: 24px; }
          }
        `}
      </style>
      <div className="login-box">
        <div style={{ marginBottom: '35px' }}>
          <img src={appLogo} alt="Logo" style={{ height: '180px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
        </div>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input 
              type="text" 
              className="login-input" 
              placeholder="Tên đăng nhập (ID)" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
            <span className="input-icon">👤</span>
          </div>
          <div className="input-group">
            <input 
              type="password" 
              className="login-input" 
              placeholder="Mật khẩu" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            <span className="input-icon">🔒</span>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
          </button>
          <a 
            href={`${(api.defaults.baseURL || 'http://localhost:5050/api').replace('/api', '')}/app.apk`} 
            className="download-apk-link" 
            style={{ display: 'block', marginTop: '20px', color: '#a5b4fc', textDecoration: 'none', fontSize: '14px' }}>
            Tải App Android
          </a>
        </form>
      </div>
    </div>
  );
}
export default Login;