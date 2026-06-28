import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import * as XLSX from 'xlsx';

function Reports() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Logic tính toán ca làm việc hiện tại
  const getCurrentShiftInfo = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    let shiftDate = new Date(now);
    let shiftType = 'A'; // 'A' -> Ca Ngày, 'B' -> Ca Đêm

    if (currentHour >= 8 && currentHour < 20) {
      shiftType = 'A';
    } else {
      shiftType = 'B';
      // Nếu đang là nửa đêm (00:00 - 07:59), ca làm việc thực tế thuộc về ngày hôm trước
      if (currentHour < 8) {
        shiftDate.setDate(shiftDate.getDate() - 1);
      }
    }

    const year = shiftDate.getFullYear();
    const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
    const day = String(shiftDate.getDate()).padStart(2, '0');

    return {
      date: `${year}-${month}-${day}`,
      shift: shiftType
    };
  };

  const [date, setDate] = useState(getCurrentShiftInfo().date);
  const [shift, setShift] = useState(getCurrentShiftInfo().shift);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fullTextModal, setFullTextModal] = useState({ isOpen: false, title: '', content: '' });

  useEffect(() => {
    // Chặn quyền truy cập nếu không phải Admin
    if (currentUser.role !== 'Admin') {
      alert('Truy cập bị từ chối!');
      navigate('/');
    } else {
      // Tự động tải dữ liệu của ca hiện tại khi vừa vào trang
      fetchReport();
    }
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/transactions/report/shift?date=${date}&shift=${shift}`;
      // Nếu không phải là admin gốc, thì lọc theo group của quản lý đó
      if (currentUser.username !== 'admin') {
        url += `&group=${currentUser.group || 'MAIN'}`;
      }
      const res = await api.get(url);
      setData(res.data);
    } catch (error) {
      alert('Lỗi lấy dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (data.length === 0) return alert('Không có dữ liệu để xuất!');
    
    // Sắp xếp lại dữ liệu thành các cột đúng chuẩn Excel
    const excelData = data.map(t => ({
      'Items Code': t.materialId ? t.materialId.itemsCode : 'N/A',
      'Lượng Nhập': t.type === 'IN' ? t.quantity : '',
      'Xuất Plan': t.type === 'OUT_PLAN' ? t.quantity : '',
      'Xuất Khác': (t.type === 'OUT' || t.type === 'OUT_OTHER') ? t.quantity : '',
      'Vendor': t.vendor || '',
      'Người Ký / Thực Hiện': t.user,
      'Ghi chú': t.description || '',
      'Ngày Giờ': new Date(t.createdAt).toLocaleString('vi-VN')
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    const shiftName = shift === 'A' ? 'Ngay' : 'Dem';
    XLSX.utils.book_append_sheet(wb, ws, `Ca_${shiftName}_${date}`);
    XLSX.writeFile(wb, `BaoCao_XuatNhap_Ca${shiftName}_${date}.xlsx`);
  };

  const getLastName = (fullName) => {
    if (!fullName || fullName === 'System') return 'System';
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1];
  };

  const handleOpenFullText = (title, content) => {
    if (!content || content === '-') return;
    setFullTextModal({ isOpen: true, title, content });
  };

  return (
    <div className="card desktop-only-view">
      <style>
        {`
          .truncate-text {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            transition: color 0.2s;
            max-width: 150px;
          }
          .truncate-text:hover {
            color: #2980b9 !important;
          }
        `}
      </style>
      <div className="header-actions">
        <h2>📊 Dữ Liệu Xuất Nhập (Ca làm việc) - Nhóm {currentUser.group || 'MAIN'}</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>🔙 Trở về</button>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>Ngày làm việc</label>
          <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>Ca làm việc</label>
          <select className="form-control" value={shift} onChange={e => setShift(e.target.value)}>
            <option value="A">Ca Ngày (08:00 - 19:59)</option>
            <option value="B">Ca Đêm (20:00 - 07:59 hôm sau)</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Đang tải...' : '🔍 Lấy Dữ Liệu'}
          </button>
          <button className="btn btn-success" onClick={exportToExcel} disabled={data.length === 0}>
            ⬇️ Xuất File Excel
          </button>
        </div>
      </div>

      <table className="modern-table">
        <thead>
          <tr>
            <th>Items Code</th>
            <th style={{ textAlign: 'center' }}>Lượng Nhập</th>
            <th style={{ textAlign: 'center' }}>Xuất Plan</th>
            <th style={{ textAlign: 'center' }}>Xuất Khác</th>
            <th>Vendor</th>
            <th>Người Thực Hiện</th>
            <th>Ghi chú</th>
            <th>Ngày Giờ</th>
          </tr>
        </thead>
        <tbody>
          {data.map(t => (
            <tr key={t._id}>
              <td><strong style={{ color: '#2980b9' }}>{t.materialId ? t.materialId.itemsCode : 'N/A'}</strong></td>
              <td style={{ textAlign: 'center', color: '#27ae60', fontWeight: 'bold' }}>{t.type === 'IN' ? `+${Number(t.quantity).toLocaleString('vi-VN')}` : ''}</td>
              <td style={{ textAlign: 'center', color: '#c0392b', fontWeight: 'bold' }}>{t.type === 'OUT_PLAN' ? `-${Number(t.quantity).toLocaleString('vi-VN')}` : ''}</td>
              <td style={{ textAlign: 'center', color: '#e67e22', fontWeight: 'bold' }}>{(t.type === 'OUT' || t.type === 'OUT_OTHER') ? `-${Number(t.quantity).toLocaleString('vi-VN')}` : ''}</td>
              <td>{t.vendor || '-'}</td>
              <td className="truncate-text" onClick={() => handleOpenFullText('Thông tin Người Thực Hiện', t.user)} title="Nhấn để xem chi tiết">
                {getLastName(t.user)}
              </td>
              <td className="truncate-text" onClick={() => handleOpenFullText('Ghi chú', t.description || '-')} title="Nhấn để xem chi tiết">
                {t.description || '-'}
              </td>
              <td>{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
            </tr>
          ))}
          {data.length === 0 && !loading && (
            <tr><td colSpan="8" className="empty-state">Không có dữ liệu trong ca này.</td></tr>
          )}
        </tbody>
      </table>

      {/* Modal hiển thị Full Text */}
      {fullTextModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ color: '#2980b9' }}>{fullTextModal.title}</h3>
              <button className="close-btn" onClick={() => setFullTextModal({ isOpen: false, title: '', content: '' })}>×</button>
            </div>
            <div style={{ padding: '15px 0', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '15px', color: '#2c3e50' }}>
              {fullTextModal.content}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setFullTextModal({ isOpen: false, title: '', content: '' })}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;