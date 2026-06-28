import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './PrintLabel.css';

function PrintLabel() {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [labels, setLabels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [printerIp, setPrinterIp] = useState(localStorage.getItem('printerIp') || '172.26.9.214');
  const [isPinging, setIsPinging] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const qriousInstances = useRef({});

  // Render QR Codes
  useEffect(() => {
    const loadQrious = () => {
      if (!window.QRious) return;
      
      labels.forEach((lbl) => {
        const canvas = document.getElementById(`qrcode-${lbl.id}`);
        if (canvas) {
          if (!qriousInstances.current[lbl.id]) {
            qriousInstances.current[lbl.id] = new window.QRious({
              element: canvas,
              value: lbl.code,
                size: 300,
                level: 'H',
                foreground: '#000000',
                background: '#ffffff'
              });
            } else {
            qriousInstances.current[lbl.id].value = lbl.code;
          }
        }
      });
    };

    if (!window.QRious) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
      script.onload = loadQrious;
      document.head.appendChild(script);
    } else {
      setTimeout(loadQrious, 50); // Đợi DOM render xong thẻ canvas mới vẽ
    }
  }, [labels]); // Lắng nghe mỗi khi mảng labels thay đổi

  // Lấy tự động Model và Type dựa trên Code
  useEffect(() => {
    const loadMissingData = async () => {
      const missingCodes = [...new Set(labels.filter(l => !l.isLoaded).map(l => l.code))];
      if (missingCodes.length === 0) return;

      const fetchedData = {};

      for (const code of missingCodes) {
        try {
          const res = await api.get(`/materials/search?q=${encodeURIComponent(code)}`);
          const exactMatch = res.data.find(m => m.itemsCode.toUpperCase() === code);
          const match = exactMatch || res.data[0];
          
          fetchedData[code] = {
            model: match ? (match.model || '') : 'N/A',
            type: match ? (match.materialType || '') : 'N/A'
          };
        } catch (err) {
          fetchedData[code] = { model: 'LỖI', type: 'LỖI' };
        }
      }

      setLabels(prevLabels => {
        let changed = false;
        const updated = prevLabels.map(l => {
          if (!l.isLoaded && fetchedData[l.code]) {
            changed = true;
            return {
              ...l,
              model: fetchedData[l.code].model,
              type: fetchedData[l.code].type,
              isLoaded: true
            };
          }
          return l;
        });
        return changed ? updated : prevLabels;
      });
    };

    const delay = setTimeout(() => {
      loadMissingData();
    }, 400);

    return () => clearTimeout(delay);
  }, [labels]);

  const updateLabelsFromText = (text) => {
    setInputText(text);
    const knownCodes = {};
    labels.forEach(l => {
      if (l.isLoaded) {
        knownCodes[l.code] = { model: l.model, type: l.type };
      }
    });

    const lines = text.split('\n');
    const newLabels = lines.map((line, idx) => {
      const code = line.trim().toUpperCase();
      if (!code) return null;
      
      if (knownCodes[code]) {
        return { id: `${code}-${idx}`, code, model: knownCodes[code].model, type: knownCodes[code].type, isLoaded: true };
      }

      return { id: `${code}-${idx}`, code, model: '...', type: '...', isLoaded: false };
    }).filter(Boolean);

    setLabels(newLabels);
  };

  const handleTextareaChange = (e) => {
    updateLabelsFromText(e.target.value);
  };

  // Hàm xử lý tìm kiếm khi gõ phím
  const handleSearch = async (value) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/materials/search?q=${encodeURIComponent(value)}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Lỗi tìm kiếm:', err);
    }
  };

  // Hàm xử lý khi bấm chọn 1 gợi ý từ Dropdown
  const handleSelectSearchResult = (material) => {
    const code = material.itemsCode;
    let newText = inputText;
    // Đảm bảo mã mới luôn được chèn ở đầu 1 dòng, và tự động Enter tạo dòng mới sau đó
    if (newText && !newText.endsWith('\n')) newText += '\n';
    newText += code + '\n';
    
    updateLabelsFromText(newText);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Hàm Ping máy in
  const handlePing = async () => {
    if (!printerIp) return alert('Vui lòng nhập IP máy in!');
    setIsPinging(true);
    try {
      const res = await api.post('/transactions/test-printer', { ip: printerIp });
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi kết nối tới máy chủ!');
    } finally {
      setIsPinging(false);
    }
  };

  // Hàm gửi lệnh in ngầm qua Mạng LAN
  const handleNetworkPrint = async () => {
    const validLabels = labels.filter(l => l.code);
    if (validLabels.length === 0) return alert('Không có tem nào để in!');
    if (!printerIp) return alert('Vui lòng nhập IP máy in!');
    
    setIsPrinting(true);
    try {
      const res = await api.post('/transactions/print-network', { 
        ip: printerIp, 
        labels: validLabels 
      });
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi gửi lệnh in!');
    } finally {
      setIsPrinting(false);
    }
  };

  // Chia mảng labels thành từng nhóm 4 tem (1 trang A4)
  const chunks = [];
  for (let i = 0; i < labels.length; i += 4) {
    chunks.push(labels.slice(i, i + 4));
  }

  return (
    <div className="print-label-wrapper">
      <div className="print-sidebar-panel">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          Tạo tem nhãn
          <button onClick={() => navigate('/')} style={{ padding: '6px 10px', background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', textTransform: 'none' }}>🔙 Trở về</button>
        </h2>
        
        <div className="print-input-group hide-on-mobile" style={{ marginBottom: '15px', background: '#e0f2fe', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
          <label style={{ color: '#0369a1' }}>🖨️ CẤU HÌNH MÁY IN MẠNG (LAN):</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={printerIp} 
              onChange={(e) => {
                setPrinterIp(e.target.value);
                localStorage.setItem('printerIp', e.target.value);
              }} 
              placeholder="Ví dụ: 172.26.9.214" 
              style={{ flex: 1, borderColor: '#7dd3fc', textTransform: 'none' }}
            />
            <button onClick={handlePing} disabled={isPinging} style={{ padding: '0 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              {isPinging ? '...' : 'Ping'}
            </button>
          </div>
        </div>

        <button className="btn-print-action" onClick={handleNetworkPrint} disabled={isPrinting} style={{ marginBottom: '20px', marginTop: 0 }}>
          {isPrinting ? '⏳ Đang gửi lệnh in tới Server...' : '🖨️ In Tem'}
        </button>

        {/* Khối Tìm kiếm và thêm nhanh */}
        <div className="print-input-group" style={{ position: 'relative' }}>
          <label>🔍 TÌM VÀ CHỌN NHANH:</label>
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => handleSearch(e.target.value)} 
            placeholder="Nhập Code, Model để tìm..." 
          />
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #3b82f6', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 15px rgba(0,0,0,0.15)', marginTop: '4px', overflow: 'hidden' }}>
              {searchResults.map(m => (
                <div 
                  key={m._id} 
                  onClick={() => handleSelectSearchResult(m)}
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <strong style={{ color: '#2563eb', display: 'block', fontSize: '13px' }}>{m.itemsCode}</strong>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{m.model} • {m.materialType}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="print-input-group" style={{ display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
          <label>DANH SÁCH MÃ CODE (Mỗi dòng 1 mã):</label>
          <textarea 
            rows="10"
            style={{ resize: 'none', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', textTransform: 'uppercase', lineHeight: '1.6', outline: 'none' }}
            value={inputText}
            onChange={handleTextareaChange}
            placeholder="Dùng máy quét mã vạch&#10;hoặc nhập từng mã rồi ấn Enter..."
          />
        </div>
      </div>
      
      <div className="print-preview-area">
        {chunks.length === 0 && (
          <div style={{ marginTop: '50px', color: '#64748b', fontStyle: 'italic' }}>
            Nhập code vào ô bên trái để xem trước tem in...
          </div>
        )}
        {chunks.map((chunk, pageIndex) => (
          <div className="a4-page" key={`page-${pageIndex}`} style={{ marginBottom: pageIndex < chunks.length - 1 ? '20px' : '0' }}>
            {chunk.map((lbl) => (
              <div className="label-container" key={lbl.id}>
                <div className="label-row">
                  <div className="label-title model-title">MODEL</div>
                  <div className="label-value model-value">{lbl.model}</div>
                  <div className="qrcode-zone"><canvas id={`qrcode-${lbl.id}`}></canvas></div>
                </div>
                <div className="label-row">
                  <div className="label-title">CODE</div>
                  <div className="label-value">{lbl.code}</div>
                </div>
                <div className="label-row">
                  <div className="label-title">TYPE</div>
                  <div className="label-value">{lbl.type}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PrintLabel;