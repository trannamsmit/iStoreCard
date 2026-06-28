import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../api';

function Materials() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // States cho tìm kiếm và chọn
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Số lượng dữ liệu trên 1 trang

  // States cho Modal Thêm/Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    materialType: '', model: '', itemsCode: '', objectDescription: '',
    vendorName: '', vendor: '', vendorCode: '', price: 0
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Mỗi khi người dùng gõ tìm kiếm, tự động reset về trang 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchMaterials = async () => {
    try {
      const response = await api.get('/materials');
      setMaterials(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách vật liệu:', error);
      alert('Không thể kết nối đến máy chủ. VUI LÒNG KIỂM TRA MONGODB ĐÃ ĐƯỢC BẬT CHƯA!');
    } finally {
      setLoading(false);
    }
  };


  // Lọc dữ liệu theo thanh tìm kiếm
  const filteredMaterials = materials.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      (m.itemsCode || '').toLowerCase().includes(term) ||
      (m.objectDescription || '').toLowerCase().includes(term) ||
      (m.model || '').toLowerCase().includes(term) ||
      (m.materialType || '').toLowerCase().includes(term) ||
      (m.vendorName || '').toLowerCase().includes(term) ||
      (m.vendorCode || '').toLowerCase().includes(term)
    );
  });

  // Tính toán dữ liệu hiển thị cho Trang hiện tại
  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentMaterials = filteredMaterials.slice(startIndex, startIndex + itemsPerPage);

  // Xử lý Checkbox Chọn tất cả
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredMaterials.map(m => m._id));
    } else {
      setSelectedIds([]);
    }
  };

  // Xử lý Checkbox từng dòng
  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  // Xóa nhiều
  const handleDeleteSelected = async () => {
    if (window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} vật tư đã chọn?`)) {
      try {
        setLoading(true);
        await api.post('/materials/delete-multiple', { ids: selectedIds });
        setSelectedIds([]);
        fetchMaterials();
      } catch (error) {
        console.error(error);
        alert('Lỗi khi xóa dữ liệu');
        setLoading(false);
      }
    }
  };

  // Mở modal Thêm mới
  const openAddModal = () => {
    setEditingId(null);
    setFormData({ materialType: '', model: '', itemsCode: '', objectDescription: '', vendorName: '', vendor: '', vendorCode: '', price: 0 });
    setIsModalOpen(true);
  };

  // Mở modal Sửa
  const openEditModal = () => {
    const itemToEdit = materials.find(m => m._id === selectedIds[0]);
    if (itemToEdit) {
      setEditingId(itemToEdit._id);
      setFormData({
        materialType: itemToEdit.materialType || '',
        model: itemToEdit.model || '',
        itemsCode: itemToEdit.itemsCode || '',
        objectDescription: itemToEdit.objectDescription || '',
        vendorName: itemToEdit.vendorName || '',
        vendor: itemToEdit.vendor || '',
        vendorCode: itemToEdit.vendorCode || '',
        price: itemToEdit.price || 0
      });
      setIsModalOpen(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Lưu form (Thêm hoặc Sửa)
  const handleSave = async () => {
    if (!formData.itemsCode) return alert('Mã vật tư (Items Code) là bắt buộc!');
    try {
      setLoading(true);
      if (editingId) {
        await api.put(`/materials/${editingId}`, formData);
        alert('Cập nhật thành công!');
      } else {
        await api.post('/materials', formData);
        alert('Thêm mới thành công!');
      }
      setIsModalOpen(false);
      setSelectedIds([]);
      fetchMaterials();
    } catch (error) {
      console.error(error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // Dùng ArrayBuffer thay vì BinaryString để chống lỗi cho các file Excel format mới
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" }); // defval để các ô trống không bị undefined
        
        // Lọc trùng lặp dựa trên Items Code VÀ Vendor code để cho phép 1 Code có nhiều dòng (ứng với nhiều Vendor)
        const uniqueDataMap = new Map();

        rawData.forEach(row => {
          const normalizedRow = {};
          Object.keys(row).forEach(key => { normalizedRow[key.trim()] = row[key]; });

          const itemsCode = String(normalizedRow['Items Code'] || '').trim();
          if (itemsCode) {
            // Xử lý giá tiền an toàn (xóa bỏ dấu $, chữ cái, dấu phẩy...)
            let rawPrice = String(normalizedRow['Price($)'] || normalizedRow['Price'] || '0');
            let safePrice = Number(rawPrice.replace(/[^0-9.-]+/g, ''));

            const vendorCode = String(normalizedRow['Vendor code'] || '').trim();
            const uniqueKey = itemsCode + '_' + vendorCode; // Gộp key

            if (!uniqueDataMap.has(uniqueKey)) {
              uniqueDataMap.set(uniqueKey, {
                materialType: String(normalizedRow['Material Type'] || '').trim(),
                model: String(normalizedRow['Model'] || '').trim(),
                itemsCode: itemsCode,
                objectDescription: String(normalizedRow['Object description'] || '').trim(),
                vendorName: String(normalizedRow['Vendor Name'] || '').trim(),
                vendor: String(normalizedRow['Vendor'] || '').trim(),
                vendorCode: vendorCode,
                price: isNaN(safePrice) ? 0 : safePrice,
              });
            }
          }
        });

        const formattedData = Array.from(uniqueDataMap.values());

        if (formattedData.length === 0) {
          return alert('Không tìm thấy dữ liệu hợp lệ (Cần có cột "Items Code")');
        }

        setLoading(true);
        await api.post('/materials/upload', formattedData);
        alert(`✅ Upload thành công ${formattedData.length} vật tư!`);
        
        // Reset input file để có thể chọn lại cùng 1 file nhiều lần
        e.target.value = null;
        fetchMaterials();
      } catch (err) {
        console.error(err);
        const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
        alert('Lỗi khi xử lý file Excel: ' + serverMsg);
        setLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    // Lọc các vật liệu có tồn kho > 0 từ danh sách đã được filter a-z
    const exportData = filteredMaterials
      .filter(m => (m.balance || 0) > 0)
      .map(m => ({
        'Loại vật tư': m.materialType,
        'Model': m.model,
        'Mã vật tư': m.itemsCode,
        'Mô tả': m.objectDescription,
        'Tên nhà sản xuất': m.vendorName,
        'Mã nhà sản xuất': m.vendor,
        'Vendor Code': m.vendorCode,
        'Giá ($)': m.price,
        'Tồn kho': m.balance,
        'Ngày cập nhật cuối': new Date(m.updatedAt).toLocaleString('vi-VN')
      }));

    if (exportData.length === 0) {
      alert('Không có dữ liệu nào có tồn kho lớn hơn 0 để xuất.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách vật liệu");
    XLSX.writeFile(wb, `DanhSachVatLieu_ConTonKho_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const downloadSample = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Material Type': 'Tape',
      'Model': 'A166',
      'Items Code': 'TAPE-001',
      'Object description': 'Băng keo chịu nhiệt',
      'Vendor Name': 'Samsung',
      'Vendor': 'SS',
      'Vendor code': 'V-001',
      'Price($)': 10
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    XLSX.writeFile(wb, "Sample_Materials.xlsx");
  };

  if (loading) return <p>Đang tải dữ liệu...</p>;

  return (
    <>
      <style>
        {`
          .mobile-forbidden { display: none; }
          .desktop-only-view { display: block; }
          @media (max-width: 768px) {
            /* Ẩn link Điều hướng Vật liệu ở thanh Menu chung trên mobile */
            a[href="/materials"], a[href="/"] { display: none !important; }
            
            .mobile-forbidden { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 60vh; 
              text-align: center; 
              padding: 20px;
              color: #7f8c8d;
            }
            .desktop-only-view { display: none; }
          }
        `}
      </style>
      
      {/* Màn hình thông báo chặn Mobile */}
      <div className="card mobile-forbidden">
        <h1 style={{ fontSize: '50px', marginBottom: '10px' }}>💻</h1>
        <h3 style={{ color: '#e74c3c' }}>Không Hỗ Trợ Thiết Bị Di Động</h3>
        <p>Giao diện Quản lý Danh mục Vật liệu chứa bảng dữ liệu phức tạp. Vui lòng sử dụng <strong>Máy Tính (PC/Laptop)</strong> để truy cập chức năng này!</p>
      </div>

      <div className="card desktop-only-view">
      <div className="header-actions">
        <h2>🏠 Thông Tin Vật Liệu - Xin chào, {currentUser.fullName}!</h2>
        <input 
          type="text" 
          className="search-box" 
          placeholder="🔍 Tìm kiếm vật tư (Mã, Tên, Model...)" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="btn-group">
          {/* Các nút gốc của vật liệu */}
          {selectedIds.length > 0 && (
            <>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>🗑 Xóa ({selectedIds.length})</button>
              {selectedIds.length === 1 && (
                <button className="btn btn-secondary" onClick={openEditModal}>✏️ Sửa</button>
              )}
            </>
          )}
           <button className="btn btn-success" onClick={handleExportExcel}>📤 Xuất Excel</button>
          <button className="btn btn-warning" onClick={downloadSample}>⬇️ Mẫu</button>
          <label className="btn btn-success" style={{ margin: 0, cursor: 'pointer' }}>
            📥 Upload
            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
          <button className="btn btn-primary" onClick={openAddModal}>➕ Thêm</button>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>🔙 Trở về</button>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
      <table className="modern-table">
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <input type="checkbox" checked={selectedIds.length === filteredMaterials.length && filteredMaterials.length > 0} onChange={handleSelectAll} />
            </th>
            <th>Material Type</th>
            <th>Model</th>
            <th>Items Code</th>
            <th>Object description</th>
            <th>Vendor Name</th>
            <th>Vendor</th>
            <th>Vendor code</th>
            <th>Price($)</th>
            <th style={{ textAlign: 'center' }}>Tồn Kho</th>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Ngày Giờ Lưu</th>
            <th style={{ textAlign: 'center' }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(currentMaterials) && currentMaterials.length > 0 ? currentMaterials.map((m) => (
            <tr key={m._id} style={{ backgroundColor: selectedIds.includes(m._id) ? '#f1f8ff' : '' }}>
              <td style={{ textAlign: 'center' }}>
                <input type="checkbox" checked={selectedIds.includes(m._id)} onChange={(e) => handleSelectOne(e, m._id)} />
              </td>
              <td><span className="badge">{m.materialType || '-'}</span></td>
              <td>{m.model}</td>
              <td><span className="badge badge-primary">{m.itemsCode}</span></td>
              <td><strong>{m.objectDescription}</strong></td>
              <td>{m.vendorName || '-'}</td>
              <td>{m.vendor || '-'}</td>
              <td style={{color: '#2980b9'}}>{m.vendorCode || '-'}</td>
              <td style={{ color: '#2ecc71', fontWeight: 'bold' }}>${Number(m.price || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#e67e22', fontSize: '15px' }}>{Number(m.balance || 0).toLocaleString('vi-VN')}</td>
              <td style={{ textAlign: 'center', fontSize: '12px', color: '#7f8c8d' }}>{new Date(m.updatedAt).toLocaleString('vi-VN')}</td>
              <td style={{ textAlign: 'center' }}>
                <Link to={`/transactions/${m._id}`} className="action-link">Thẻ Kho &rarr;</Link>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>Không tìm thấy vật tư nào.</td>
            </tr>
          )}
        </tbody>
      </table>
      
      {/* Thanh điều hướng Phân trang */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>⬅ Trang trước</button>
          <span className="page-info">Trang {currentPage} / {totalPages}</span>
          <button className="btn btn-secondary page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Trang sau ➡</button>
        </div>
      )}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>🔙 Trở về</button>
      </div>

      {/* Modal Thêm/Sửa Vật Tư */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingId ? '✏️ Sửa Thông Tin Vật Tư' : '➕ Thêm Vật Tư Mới'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Mã Vật Tư (Items Code) *</label>
                <input className="form-control" name="itemsCode" value={formData.itemsCode} onChange={handleInputChange} disabled={!!editingId} placeholder="Vd: TAPE-001" />
              </div>
              <div className="form-group">
                <label>Loại (Material Type)</label>
                <input className="form-control" name="materialType" value={formData.materialType} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Dòng Máy (Model)</label>
                <input className="form-control" name="model" value={formData.model} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Mô Tả (Description)</label>
                <input className="form-control" name="objectDescription" value={formData.objectDescription} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Nhà Sản Xuất (Vendor Name)</label>
                <input className="form-control" name="vendorName" value={formData.vendorName} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Mã Vendor (Vendor)</label>
                <input className="form-control" name="vendor" value={formData.vendor} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Vendor Code</label>
                <input className="form-control" name="vendorCode" value={formData.vendorCode} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Giá Tiền (Price $)</label>
                <input type="number" className="form-control" name="price" value={formData.price} onChange={handleInputChange} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy Bỏ</button>
              <button className="btn btn-primary" onClick={handleSave}>💾 Lưu Dữ Liệu</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default Materials;