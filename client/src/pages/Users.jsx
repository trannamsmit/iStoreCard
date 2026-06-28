import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function Users() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ username: '', fullName: '', role: 'Staff', group: 'MAIN' });
  const [backupDateRange, setBackupDateRange] = useState({ from: '', to: '' });
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [backups, setBackups] = useState([]);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    // Chặn nếu không phải Admin hoặc trên điện thoại (đã có CSS chặn mobile)
    if (currentUser.role !== 'Admin') {
      alert('Truy cập bị từ chối! Chỉ dành cho Quản lý.');
      navigate('/');
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get(`/users?reqUser=${currentUser.username}`);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveUser = async () => {
    if (!formData.username || !formData.fullName) return alert('Điền đủ ID và Họ tên!');
    try {
      if (editingUserId) {
        await api.put(`/users/${editingUserId}`, formData);
        alert('Cập nhật User thành công!');
      } else {
        await api.post('/users', formData);
        alert('Tạo User thành công! Mật khẩu mặc định là ID.');
      }
      setEditingUserId(null);
      setFormData({ username: '', fullName: '', role: 'Staff', group: 'MAIN' });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi lưu user');
    }
  };

  const handleEditClick = (user) => {
    setEditingUserId(user._id);
    setFormData({ username: user.username, fullName: user.fullName, role: user.role, group: user.group || 'MAIN' });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormData({ username: '', fullName: '', role: 'Staff', group: 'MAIN' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc muốn xóa User này?')) {
      await api.delete(`/users/${id}`);
      fetchUsers();
    }
  };

  const handleResetPass = async (id) => {
    if (window.confirm('Reset mật khẩu của User này về mặc định (Bằng ID)?')) {
      await api.post(`/users/reset-password/${id}`);
      alert('Reset thành công!');
    }
  };

  // ===================== TÍNH NĂNG SUPER ADMIN =====================
  const handleClearAll = async () => {
    const pass = window.prompt('⚠️ CẢNH BÁO NGUY HIỂM!\nNhập mật khẩu xác nhận để XÓA TOÀN BỘ lịch sử xuất/nhập của hệ thống (Reset thẻ kho về 0):');
    if (pass) {
      if (pass !== '108994') return alert('Sai mật khẩu xác nhận!');
      try {
        const res = await api.post('/users/clear-all', { password: pass });
        alert(res.data.message);
      } catch (err) {
        alert(err.response?.data?.message || 'Lỗi khi xóa dữ liệu');
      }
    }
  };

  const handleCreateBackup = async (isDateRange = false) => {
    try {
      let payload = {};
      if (isDateRange) {
        if (!backupDateRange.from || !backupDateRange.to) {
          return alert('Vui lòng chọn đủ cả ngày bắt đầu và kết thúc!');
        }
        payload = { fromDate: backupDateRange.from, toDate: backupDateRange.to };
      }
      const res = await api.post('/users/backup', payload);
      alert(res.data.message);
      setIsBackupModalOpen(false); // Đóng modal sau khi thành công
    } catch (err) {
      alert('Lỗi tạo backup!');
    }
  };

  const fetchBackupsAndOpenModal = async () => {
    try {
      const res = await api.get('/users/backups');
      setBackups(res.data);
      setIsRestoreModalOpen(true);
    } catch (err) {
      alert('Lỗi lấy danh sách backup!');
    }
  };

  const handleRestore = async (filename) => {
    if (window.confirm(`Bạn có chắc muốn khôi phục dữ liệu từ bản: ${filename}?\nToàn bộ dữ liệu (Người dùng, Thẻ kho, Vật tư) hiện tại sẽ bị GHI ĐÈ!`)) {
      try {
        const res = await api.post('/users/restore', { filename });
        alert(res.data.message);
        setIsRestoreModalOpen(false);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.message || 'Lỗi khôi phục!');
      }
    }
  };

  return (
    <>
      <style>
        {`
          .desktop-only-view { display: block; }
          @media (max-width: 768px) { .desktop-only-view { display: none !important; } }
        `}
      </style>
      <div className="card desktop-only-view">
        <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2>👥 Quản lý Người Dùng</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {currentUser.username === 'admin' && (
              <>
                <button className="btn btn-danger" onClick={handleClearAll}>💥 Xóa Toàn Bộ Dữ Liệu</button>
                <button className="btn btn-primary" onClick={() => setIsBackupModalOpen(true)}>💾 Backup</button>
                <button className="btn btn-warning" onClick={fetchBackupsAndOpenModal}>🔙 Restore</button>
              </>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/')}>🔙 Trở về</button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
          <input type="text" className="form-control" placeholder="ID Đăng nhập" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} disabled={!!editingUserId} />
          <input type="text" className="form-control" placeholder="Họ và Tên" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
          <select className="form-control" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="Staff">Nhân viên</option>
            <option value="Admin">Quản lý (Admin)</option>
          </select>
          <select className="form-control" value={formData.group} onChange={e => setFormData({...formData, group: e.target.value})}>
            <option value="MAIN">Nhóm MAIN</option>
            <option value="BOARD">Nhóm BOARD</option>
          </select>
          {editingUserId ? (
            <>
              <button className="btn btn-success" onClick={handleSaveUser}>💾 Lưu</button>
              <button className="btn btn-secondary" onClick={handleCancelEdit}>Hủy</button>
            </>
          ) : (
            <button className="btn btn-success" onClick={handleSaveUser}>➕ Thêm User</button>
          )}
        </div>

        <table className="modern-table">
          <thead>
            <tr>
              <th>ID Đăng nhập</th>
              <th>Họ và Tên</th>
              <th>Nhóm</th>
              <th>Quyền hạn</th>
              <th style={{ textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.fullName}</td>
                <td>{u.group === 'BOARD' ? <span className="badge badge-warning" style={{ color: 'white' }}>BOARD</span> : <span className="badge badge-success">MAIN</span>}</td>
                <td>{u.role === 'Admin' ? <span className="badge badge-danger">Quản lý</span> : <span className="badge badge-primary">Nhân viên</span>}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px', marginRight: '5px' }} onClick={() => handleEditClick(u)}>✏️ Sửa</button>
                  <button className="btn btn-warning" style={{ padding: '5px 10px', fontSize: '12px', marginRight: '5px', color: 'white' }} onClick={() => handleResetPass(u._id)}>🔄 Reset Pass</button>
                  <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleDelete(u._id)}>🗑 Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cửa sổ Tùy chọn Backup */}
      {isBackupModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ width: '90%', maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>💾 Tùy chọn Sao lưu Dữ liệu</h3>
              <button className="close-btn" onClick={() => setIsBackupModalOpen(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
              {/* Backup toàn bộ */}
              <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>1. Sao lưu Toàn bộ Hệ thống</h4>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleCreateBackup(false)}>Backup Tất Cả</button>
              </div>
              {/* Backup theo ngày */}
              <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>2. Sao lưu Giao dịch theo Ngày</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input type="date" className="form-control" value={backupDateRange.from} onChange={e => setBackupDateRange(prev => ({...prev, from: e.target.value}))} />
                  <input type="date" className="form-control" value={backupDateRange.to} onChange={e => setBackupDateRange(prev => ({...prev, to: e.target.value}))} />
                </div>
                <button className="btn btn-success" style={{ width: '100%' }} onClick={() => handleCreateBackup(true)}>Backup Theo Ngày</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setIsBackupModalOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Cửa sổ Khôi phục dữ liệu (Restore) */}
      {isRestoreModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ width: '90%', maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>🔙 Khôi phục Dữ liệu (Restore)</h3>
              <button className="close-btn" onClick={() => setIsRestoreModalOpen(false)}>×</button>
            </div>
            <div style={{ marginTop: '15px' }}>
              <p style={{ color: '#7f8c8d' }}>Chọn một bản sao lưu để khôi phục toàn bộ hệ thống:</p>
              {backups.length === 0 ? (
                <p style={{ color: '#e74c3c', fontWeight: 'bold' }}>Chưa có bản sao lưu nào!</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, maxHeight: '250px', overflowY: 'auto' }}>
                  {backups.map((file, idx) => (
                    <li key={idx} style={{ padding: '12px 10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>{file}</span>
                      <button className="btn btn-warning" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleRestore(file)}>Khôi phục</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setIsRestoreModalOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Users;