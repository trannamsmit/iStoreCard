import React, { useState, useEffect } from 'react';

/**
 * Màn hình cấu hình IP Server LAN - Hiển thị khi chạy trên Android
 * Cho phép người dùng nhập IP server lần đầu tiên (hoặc thay đổi sau)
 */
function ServerConfig({ onConfigured }) {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('5050');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'

  useEffect(() => {
    // Nạp cấu hình đã lưu (nếu có)
    const saved = localStorage.getItem('serverUrl');
    if (saved) {
      try {
        const url = new URL(saved);
        setIp(url.hostname);
        setPort(url.port || '5050');
      } catch {}
    }
  }, []);

  const buildUrl = (ipVal, portVal) => `http://${ipVal}:${portVal}/api`;

  const handleTest = async () => {
    if (!ip.trim()) return alert('Vui lòng nhập địa chỉ IP!');
    setTesting(true);
    setStatus(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`http://${ip.trim()}:${port}/api/users`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok || res.status === 401) {
        setStatus('ok');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!ip.trim()) return alert('Vui lòng nhập địa chỉ IP Server!');
    const url = buildUrl(ip.trim(), port);
    localStorage.setItem('serverUrl', url);
    onConfigured(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Segoe UI', sans-serif"
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '35px 30px',
        width: '100%',
        maxWidth: '380px',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
          <h2 style={{ color: 'white', margin: 0, fontSize: '22px', fontWeight: '700' }}>iStoreCard</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0 0 0' }}>
            Cấu hình kết nối Server LAN
          </p>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Địa chỉ IP Server
          </label>
          <input
            type="text"
            value={ip}
            onChange={e => setIp(e.target.value)}
            placeholder="Ví dụ: 172.26.9.22"
            inputMode="numeric"
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Cổng (Port)
          </label>
          <input
            type="text"
            value={port}
            onChange={e => setPort(e.target.value)}
            placeholder="5050"
            inputMode="numeric"
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Kết quả kiểm tra */}
        {status === 'ok' && (
          <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '10px', padding: '12px', marginBottom: '15px', textAlign: 'center', color: '#4ade80', fontSize: '14px' }}>
            ✅ Kết nối thành công! Server đang hoạt động.
          </div>
        )}
        {status === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', padding: '12px', marginBottom: '15px', textAlign: 'center', color: '#f87171', fontSize: '14px' }}>
            ❌ Không kết nối được. Kiểm tra lại IP và Port.
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(59,130,246,0.2)',
            border: '1px solid rgba(59,130,246,0.5)',
            borderRadius: '12px',
            color: '#93c5fd',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '12px'
          }}
        >
          {testing ? '⏳ Đang kiểm tra...' : '🔍 Kiểm tra kết nối'}
        </button>

        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(37,99,235,0.4)'
          }}
        >
          💾 Lưu và tiếp tục
        </button>

        <p style={{ color: '#475569', fontSize: '11px', textAlign: 'center', marginTop: '20px', lineHeight: '1.5' }}>
          Đảm bảo điện thoại và Server đang kết nối cùng 1 mạng WiFi LAN
        </p>
      </div>
    </div>
  );
}

export default ServerConfig;
