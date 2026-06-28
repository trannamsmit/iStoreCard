import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Transactions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [transactions, setTransactions] = useState([]);
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendorsList, setVendorsList] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);

  // States cho Lịch sử chi tiết
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailTransactions, setDetailTransactions] = useState([]);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [fullTextModal, setFullTextModal] = useState({ isOpen: false, title: '', content: '' });
  

  // States cho Form Modal Ghi Nhập / Xuất
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('IN'); // 'IN' hoặc 'OUT'
  const [editingTxId, setEditingTxId] = useState(null);
  const [formData, setFormData] = useState({
    targetMaterialId: '', // Dùng để xác định sẽ Nhập/Xuất vào kho của Vendor nào
    date: new Date().toISOString().split('T')[0], // Mặc định là ngày hôm nay (YYYY-MM-DD)
    description: '',
    vendor: '',
    quantity: ''
  });

  // States cho tìm kiếm nhanh
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [isLiveScannerOpen, setIsLiveScannerOpen] = useState(false);

  // State cho Modal chọn loại Xuất hàng
  const [isOutTypeModalOpen, setIsOutTypeModalOpen] = useState(false);


  // Hàm lấy tên cuối cùng từ Họ và tên (VD: "Trần Văn Nam" -> "Nam")
  const getLastName = (fullName) => {
    if (!fullName || fullName === 'System') return 'System';
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1];
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }

    if (id) {
      setLoading(true);
      fetchData();
    } else {
      setMaterial(null);
      setTransactions([]);
    }
  }, [id]);
  
  // Lắng nghe sự kiện mở Modal Chi Tiết từ Header (Mobile)
  useEffect(() => {
    const handleOpenDetailsEvent = () => handleOpenDetails();
    window.addEventListener('open-details-modal', handleOpenDetailsEvent);
    return () => window.removeEventListener('open-details-modal', handleOpenDetailsEvent);
  }, []);

  const fetchData = async () => {
    try {
      // Gọi song song 2 API lấy thông tin vật liệu và thẻ kho
      const [matRes, transRes, allMatRes] = await Promise.all([
        api.get(`/materials/${id}`),
        api.get(`/transactions/${id}?limit=20&latest=true`), // Chỉ lấy 20 dòng mới nhất cho trang chính
        api.get('/materials') // Lấy danh sách toàn bộ vật tư để lọc các Vendor chung Code
      ]);
      
      const currentMaterial = matRes.data;
      setMaterial(currentMaterial);
      // Đảo ngược mảng để dữ liệu mới nhất hiển thị trên cùng bảng
      setTransactions(transRes.data.transactions.reverse());
      setTotalBalance(transRes.data.totalBalance || 0);

      // Lọc ra danh sách Vendor của riêng Items Code này
      const vendorsForCode = new Map();
      allMatRes.data.forEach(m => {
        if (m.itemsCode === currentMaterial.itemsCode) {
          const vName = (m.vendorName || '').trim();
          const vCode = (m.vendorCode || '').trim();
          const display = (vName && vCode) ? `${vName} - ${vCode}` : (vName || vCode || 'Chưa có tên Vendor');
          vendorsForCode.set(m._id, {
            id: m._id,
            display: display,
            vendorString: display === 'Chưa có tên Vendor' ? '' : display,
            balance: m.balance || 0,
            updatedAt: m.updatedAt
          });
        }
      });
      setVendorsList(Array.from(vendorsForCode.values()));
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu thẻ kho:', error);
    } finally {
      setLoading(false);
    }
  };


  // Mở và tải dữ liệu chi tiết
  const handleOpenDetails = async () => {
    setIsDetailsOpen(true);
    fetchDetails('', '');
  };

  const fetchDetails = async (from, to) => {
    try {
      // Gọi API lấy tối đa 100 dòng mới nhất
      const res = await api.get(`/transactions/${id}?limit=100&latest=true&fromDate=${from}&toDate=${to}&showDeleted=true`);
      // Đảo ngược mảng để giao dịch mới nhất luôn ở trên cùng trong bảng chi tiết (như nhật ký)
      setDetailTransactions(res.data.transactions.reverse());
    } catch (err) {
      console.error('Lỗi khi lấy chi tiết:', err);
    }
  };

  const handleOpenFullText = (title, content) => {
    if (!content || content === '-') return;
    setFullTextModal({ isOpen: true, title, content });
  };

  // Xử lý tìm kiếm thời gian thực
  const handleSearch = async (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/materials/search?q=${val}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Lỗi tìm kiếm:', err);
    }
  };

  // Xử lý khi quét QR thành công (Tự động chuyển vào thẻ kho)
  const handleQRScanSuccess = async (decodedText) => {
    setSearchQuery(decodedText);
    try {
      const res = await api.get(`/materials/search?q=${encodeURIComponent(decodedText)}`);
      const results = res.data;
      if (results.length === 1) {
        setSearchResults([]);
        navigate(`/transactions/${results[0]._id}`);
      } else if (results.length > 1) {
        setSearchResults(results);
      } else {
        alert(`Không tìm thấy mã vật tư nào khớp với QR: ${decodedText}`);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Lỗi tìm kiếm:', err);
    }
  };

  // Mở trình quét QR (Dùng Camera thiết bị)
  const startQRScanner = () => {
    // window.isSecureContext là cách chuẩn để biết trang có đang chạy trên HTTPS hoặc localhost không
    // Nếu có, cho phép quét live. Nếu không, chuyển sang chế độ chụp ảnh.
    if (window.isSecureContext) {
      setIsLiveScannerOpen(true);
    } else {
      alert("⚠️ CAMERA TRỰC TIẾP BỊ CHẶN (DO THIẾU HTTPS):\n\nHệ thống sẽ mở ứng dụng Máy Ảnh gốc. Vui lòng CHỤP ẢNH mã QR và bấm 'OK' (hoặc dấu tick ✓) để hệ thống xử lý ảnh!");
      // Phải gọi trực tiếp, không qua async để trình duyệt Mobile không chặn mở Camera
      document.getElementById('qr-file-input').click();
    }
  };

  const handleQRImageUpload = async (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];
    setScanning(true);

    const processFile = async (fileToScan) => {
      try {
        const html5QrCode = new window.Html5Qrcode("qr-reader-hidden");
        const result = await html5QrCode.scanFile(fileToScan, false);
        handleQRScanSuccess(result);
      } catch (err) {
        alert("Không nhận diện được mã QR trong ảnh. Vui lòng chụp rõ nét hơn!");
      } finally {
        setScanning(false);
        const fileInput = document.getElementById('qr-file-input');
        if (fileInput) fileInput.value = ''; // Reset input
      }
    };

    // Thuật toán nén ảnh để tránh tràn RAM và giúp quét siêu tốc
    const compressAndScan = () => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1024; // Kích thước tối đa (Pixel)

          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = (height / width) * MAX_SIZE;
              width = MAX_SIZE;
            } else {
              width = (width / height) * MAX_SIZE;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
              processFile(resizedFile);
            } else {
              processFile(file); // Dùng lại ảnh gốc nếu nén lỗi
            }
          }, 'image/jpeg', 0.9);
        };
        img.onerror = () => processFile(file); // Fallback
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };

    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.onload = compressAndScan;
      script.onerror = () => {
        setScanning(false);
        alert('Lỗi: Không thể tải thư viện quét mã QR.');
      };
      document.head.appendChild(script);
    } else {
      compressAndScan();
    }
  };

  useEffect(() => {
    if (isLiveScannerOpen) {
      setScanning(true);
      const startScan = () => {
        // Tùy chỉnh khung quét động cho vừa màn hình điện thoại
        const qrboxFunction = function(viewfinderWidth, viewfinderHeight) {
          const minEdgePercentage = 0.7; // 70%
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return { width: qrboxSize, height: qrboxSize };
        };

        const html5QrcodeScanner = new window.Html5QrcodeScanner(
          "qr-reader-live",
          { 
            fps: 10, 
            qrbox: qrboxFunction,
            aspectRatio: 1.0
          },
          false
        );
        html5QrcodeScanner.render(
          (decodedText) => {
            html5QrcodeScanner.clear();
            setIsLiveScannerOpen(false);
            setScanning(false);
            handleQRScanSuccess(decodedText);
          },
          (error) => { /* ignore error on every frame */ }
        );
        window.currentQrScanner = html5QrcodeScanner;
      };

      if (!window.Html5QrcodeScanner) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode';
        script.onload = startScan;
        script.onerror = () => {
          setScanning(false);
          setIsLiveScannerOpen(false);
          alert('Lỗi: Không thể tải thư viện quét mã QR.');
        };
        document.head.appendChild(script);
      } else {
        startScan();
      }
    }
  }, [isLiveScannerOpen]);

  const closeLiveScanner = () => {
    if (window.currentQrScanner) {
      try { window.currentQrScanner.clear(); } catch(e) {}
    }
    setIsLiveScannerOpen(false);
    setScanning(false);
  };

  // Mở modal chọn loại xuất hàng
  const handleOpenOutModal = () => {
    setIsOutTypeModalOpen(true);
  };

  // Xử lý khi người dùng chọn 1 loại xuất hàng
  const handleSelectOutType = (subType) => {
    setIsOutTypeModalOpen(false);
    let mainType = 'OUT_OTHER';
    let description = `Xuất ${subType}`;

    if (subType === 'Plan') {
      mainType = 'OUT_PLAN';
      description = null; // Đặt là null để hàm openModal tự tính toán
    } else if (subType === 'Khác') {
      description = ''; // Để trống cho người dùng tự nhập
    }
    openModal(mainType, null, description);
  };

  // Mở Modal và cài đặt mặc định dựa theo loại Giao dịch
  const openModal = (type, tx = null, predefinedDescription = null) => {
    setTransactionType(type);
    if (tx) {
      setEditingTxId(tx._id);
      setFormData({
        targetMaterialId: tx.materialId || id,
        date: new Date(tx.date).toISOString().split('T')[0],
        description: tx.description || '',
        vendor: tx.vendor || '',
        quantity: tx.quantity.toString()
      });
    } else {
        const vName = (material?.vendorName || '').trim();
        const vCode = (material?.vendorCode || '').trim();
        const defaultVendor = (vName && vCode) ? `${vName} - ${vCode}` : (vName || vCode || '');

        // Ưu tiên ghi đè description từ lựa chọn của người dùng
        let defaultDescription = predefinedDescription !== null 
            ? predefinedDescription 
            : (type === 'IN' ? 'Nhập kho' : 'Xuất khác');
        
        if (type === 'OUT_PLAN' && predefinedDescription === null) { // Chỉ tính toán khi không có ghi chú cho sẵn
          const now = new Date();
          const currentHour = now.getHours();
          const modelPrefix = (material?.model || '').charAt(0).toUpperCase(); // Lấy chữ cái đầu của Model
          
          let addDays = 1;
          if (currentHour < 7 && ['X', 'P', 'T'].includes(modelPrefix)) {
            addDays = 2;
          }
          
          const planDate = new Date(now);
          planDate.setDate(planDate.getDate() + addDays);
          const dd = String(planDate.getDate()).padStart(2, '0');
          const mm = String(planDate.getMonth() + 1).padStart(2, '0');
          defaultDescription = `Plan ${dd}/${mm}`;
        }

      let targetId = id;
      let targetVendorString = defaultVendor;

      // Nếu là Xuất kho, ưu tiên tìm và chọn mặc định Vendor nào còn tồn kho
      if (type !== 'IN') {
        const availableVendor = vendorsList.find(v => v.balance > 0);
        if (availableVendor) {
          targetId = availableVendor.id;
          targetVendorString = availableVendor.vendorString;
        }
      }

      setEditingTxId(null);
      setFormData({
        targetMaterialId: targetId,
        date: new Date().toISOString().split('T')[0],
        description: defaultDescription,
        vendor: targetVendorString,
        quantity: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Xử lý Lưu Giao dịch
  const handleSaveTransaction = async () => {
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      return alert('Vui lòng nhập số lượng hợp lệ (lớn hơn 0)!');
    }
    try {
      setLoading(true);
      if (editingTxId) {
        await api.put(`/transactions/detail/${editingTxId}`, { type: transactionType, ...formData });
        setIsModalOpen(false);
        fetchData();
      } else {
        const userString = currentUser.username ? `${currentUser.username} - ${currentUser.fullName}` : currentUser.fullName;
        await api.post('/transactions', { materialId: formData.targetMaterialId || id, type: transactionType, user: userString, ...formData });
        setIsModalOpen(false);
        fetchData(); // Tải lại dữ liệu (Vì giờ dùng chung 1 thẻ kho nên không cần chuyển trang)
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
      setLoading(false); // Tắt loading nếu có lỗi để người dùng sửa lại
    }
  };

  // Xử lý Xóa giao dịch
  const handleDeleteTransaction = async (txId) => {
    if (window.confirm('Bạn có chắc muốn xóa giao dịch này? Hành động này sẽ thay đổi số dư Tồn Kho.')) {
      try {
        setLoading(true);
        await api.delete(`/transactions/detail/${txId}`);
        fetchData(); // Tải lại dữ liệu
      } catch (error) {
        console.error(error);
        alert('Lỗi khi xóa giao dịch');
        setLoading(false);
      }
    }
  };

  if (loading) return <p>Đang tải dữ liệu thẻ kho...</p>;

  return (
    <div className="transactions-container">
      <style>
        {`
          .transactions-container { display: flex; gap: 25px; align-items: flex-start; }
          .left-panel { flex: 0 0 280px; margin: 0; position: sticky; top: 20px; }
          .right-panel { flex: 1; margin: 0; min-width: 0; }
          .table-responsive { overflow-x: auto; width: 100%; }
          .mobile-full-btn { padding: 10px 20px; border-radius: 8px; }
          .info-panel-desktop-only { display: block; }
          .mobile-header-balance { display: none; }
          .desktop-actions-only { display: flex; } /* Thêm class để điều khiển nút PC */
          .desktop-details-btn { display: inline-block; }
          .mobile-details-btn { display: none; }
          .mobile-hidden-title { display: block; }
          .search-actions-container {
            margin-bottom: 30px;
          }
          .mobile-date { display: none; }
          .btn-scan-qr {
          display: none; /* Ẩn nút quét QR trên giao diện PC */
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            font-size: 22px;
            cursor: pointer;
            z-index: 5;
          }
          
          .truncate-text {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            transition: color 0.2s;
          }
          .truncate-text:hover {
            color: #2980b9 !important;
          }
          
          /* Đường viền dọc mờ chia các cột của bảng */
          .modern-table th, .modern-table td {
            border-right: 1px solid #e2e8f0;
          }
          .modern-table th:last-child, .modern-table td:last-child {
            border-right: none;
          }
          
          .history-filter-flex { display: flex; gap: 15px; align-items: flex-end; }
          .filter-inputs { display: flex; gap: 15px; flex: 2; }
          .filter-inputs > div { flex: 1; }
          .filter-buttons { display: flex; gap: 15px; flex: 1; }
          .filter-buttons > button { flex: 1; }

          /* --- BỐ CỤC NÚT TRÊN GIAO DIỆN PC --- */
          .mobile-bottom-actions {
            display: none; /* Ẩn thanh công cụ mobile trên PC */
          }

          @media (max-width: 768px) {
            .transactions-container { 
              flex-direction: column; gap: 0; padding-bottom: 85px; 
              width: 100%; margin-left: 0; 
              overflow-x: hidden; box-sizing: border-box; 
            }
            .left-panel { 
              flex: none; width: 100%; position: static; 
              border: none; box-shadow: none; padding: 0 !important; 
              margin-bottom: 0; background: transparent;
              box-sizing: border-box;
            }
            .right-panel { 
              width: 100%; box-sizing: border-box; 
              padding: 10px 2px !important; border-radius: 8px !important; 
              border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-top: 10px;
            }
            .search-actions-container { margin-bottom: 0; }
            /* Thu hẹp khoảng trống giữa Header và Bảng thẻ kho trên Mobile */
            .right-panel .header-actions {
              margin-bottom: 10px !important;
            }

            .search-input-mobile {
              border-radius: 8px !important;
              border: 1px solid #ccc !important;
              padding: 12px 45px 12px 12px !important;
            }
        .btn-scan-qr { display: block; } /* Chỉ hiển thị nút quét QR trên Mobile */
            .header-actions-flex { flex-direction: row; flex-wrap: wrap; align-items: center !important; justify-content: space-between !important; gap: 10px; }
            .desktop-details-btn { display: none; }
            .mobile-details-btn { display: block; width: 100%; margin-top: 10px; padding: 10px; font-size: 14px; border-radius: 8px; font-weight: bold; }
            .mobile-hidden-title { display: none !important; }
            .mobile-header-balance {
              display: block;
              width: 100%;
              text-align: left;
              margin-top: 0;
              padding-top: 2px; /* Thu hẹp khoảng trống */
              border-top: 1px solid #eee;
            }
            .info-panel-desktop-only { display: none; }
            .desktop-actions-only { display: none !important; } /* Ẩn nút PC trên mobile */
            .history-filter-flex { flex-direction: column; align-items: stretch !important; gap: 10px; }
            .filter-inputs, .filter-buttons { display: flex; flex-direction: row !important; flex-wrap: nowrap !important; width: 100%; gap: 10px; }
            .filter-inputs > div { width: 50%; min-width: 0; }
            .filter-inputs label { font-size: 12px !important; margin-bottom: 2px; display: block; white-space: nowrap; }
            .filter-inputs input[type="date"] { padding: 6px 2px !important; font-size: 12px !important; width: 100%; box-sizing: border-box; height: 32px; }
            .filter-buttons button { padding: 8px 4px !important; font-size: 13px !important; white-space: nowrap; height: 34px; }
            .modern-table { white-space: nowrap; }

            /* Ẩn link Điều hướng Vật liệu ở thanh Menu chung trên mobile */
            /* Chỉ ẩn link "Vật liệu", không ẩn logo (link về trang chủ) */
            .top-nav a[href="/materials"] { 
              display: none !important; 
            }
            
            /* Định dạng 3 nút thao tác cố định ở đáy màn hình điện thoại (App style) */
            .mobile-bottom-actions {
              position: fixed;
              bottom: 0;
              left: 0; right: 0;
              width: 100%;
              display: flex !important;
              flex-direction: row !important; /* Xếp ngang trên Mobile */
              padding: 12px 15px;
              background: rgba(224, 242, 254, 0.95); /* Xanh nhạt trong suốt */
              box-shadow: 0 -4px 15px rgba(0,0,0,0.1);
              z-index: 1000;
              gap: 15px !important;
              margin: 0 !important;
              border-top-left-radius: 20px;
              border-top-right-radius: 20px;
              justify-content: center; /* Căn giữa 3 nút */
              box-sizing: border-box; /* CỰC KỲ QUAN TRỌNG: Chống tràn khung và lệch phải */
            }
            .mobile-action-btn {
              flex: 1;
              padding: 8px 5px !important; /* Giảm padding 1 chút */
              font-size: 13px !important; /* Giảm font 1 chút */
              display: flex !important;
              flex-direction: column; /* Xếp dọc Icon và Chữ */
              align-items: center;
              justify-content: center; /* Căn giữa nội dung nút */
              gap: 5px;
              border-radius: 12px !important;
            }
            .desktop-date { display: none; }
            .mobile-date { display: inline; font-size: 11px; }
            
            /* Thu nhỏ bảng thẻ kho để nhìn thấy cột Tồn cuối */
            .modern-table th, .modern-table td {
              padding: 8px 4px !important;
              font-size: 12px;
            }
            .modern-table .badge { padding: 3px 5px; font-size: 11px; }
            
            .truncate-text {
              max-width: 100px !important;
            }

            /* Hiệu ứng Zebra (màu nền xen kẽ) để dễ dóng hàng trên Mobile */
            .modern-table tbody tr:nth-child(even) {
              background-color: #f1f5f9 !important; /* Màu xám xanh nhạt cho dòng chẵn */
            }
            .modern-table tbody tr {
              border-bottom: 1px solid #cbd5e1; /* Đường kẻ ngang rõ nét hơn */
            }
            
            /* Thu nhỏ bảng chi tiết lịch sử trên mobile */
            .details-table th, .details-table td {
              padding: 6px 4px !important;
              font-size: 11px !important;
            }
            
            /* Ép Tiêu đề Code, Model, Type trên 1 dòng */
            .material-header-title { flex-wrap: nowrap !important; gap: 8px !important; overflow-x: auto; white-space: nowrap; padding-bottom: 2px; }
            .title-code { font-size: 27px !important; }
            .title-model, .title-type { font-size: 16px !important; }
          }
        `}
      </style>

      <input 
        type="file" 
        id="qr-file-input" 
        accept="image/*" 
        capture="environment" 
        style={{ display: 'none' }} 
        onChange={handleQRImageUpload}
      />
      <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
      
      {/* CỘT TRÁI: Menu Thao Tác & Thông tin */}
      <div className="card left-panel">
        <h3 className="mobile-hidden-title" style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>⚡ Thao Tác</h3>
        
        <div className="search-actions-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Khối tìm kiếm Code nhanh */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-control search-input-mobile" 
              placeholder="🔍 Tìm Code thẻ kho... (Nhập code mới)" 
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
            />
            <button className="btn-scan-qr" onClick={startQRScanner} title="Quét mã QR" disabled={scanning}>
              {scanning ? '⏳' : '📷'}
            </button>
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', zIndex: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '5px', overflow: 'hidden' }}>
                {searchResults.map(m => (
                  <Link 
                    key={m._id} 
                    to={`/transactions/${m._id}`}
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    style={{ display: 'block', padding: '10px 15px', textDecoration: 'none', color: '#2c3e50', borderBottom: '1px solid #eee', fontSize: '13px' }}
                  >
                    <strong style={{ color: '#2980b9' }}>{m.itemsCode}</strong><br/>
                    <span style={{ color: '#7f8c8d' }}>{m.model || m.objectDescription || 'Không có mô tả'}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {material && (
            <>
              {/* Các nút thao tác cho giao diện PC (Xếp dọc) */}
              <div className="desktop-actions-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <button className="btn btn-success" style={{ width: '100%' }} onClick={() => openModal('IN')}>➕ Ghi Nhập</button>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleOpenOutModal}>➖ Xuất Hàng</button>
              </div>

              {/* Thanh công cụ cố định chỉ dành cho giao diện Mobile */}
              <div className="mobile-bottom-actions">
                <button className="btn btn-success mobile-action-btn" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }} onClick={() => openModal('IN')}>
                  <div style={{ fontSize: '18px', lineHeight: '1' }}>➕</div>
                  <div>Ghi Nhập</div>
                </button>
                <button className="btn btn-info mobile-action-btn" style={{ backgroundColor: '#bfdbfe', color: '#1e40af' }} onClick={handleOpenDetails}>
                  <div style={{ fontSize: '18px', lineHeight: '1' }}>🔍</div>
                  <div>Chi tiết</div>
                </button>
                <button className="btn btn-danger mobile-action-btn" style={{ backgroundColor: '#ffe4e6', color: '#e11d48' }} onClick={handleOpenOutModal}>
                  <div style={{ fontSize: '18px', lineHeight: '1' }}>➖</div>
                  <div>Xuất Hàng</div>
                </button>
              </div>
            </>
          )}
        </div>

        {material && (
          <div className="info-panel-desktop-only">
            <h3 style={{ margin: 0, color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>📌 Thông Tin</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <strong style={{ fontSize: '28px', color: '#e74c3c', wordBreak: 'break-word', lineHeight: '1.2' }}>{material.itemsCode}</strong>
              </div>
              <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #e67e22', marginTop: '5px', marginBottom: '5px' }}>
                <span style={{ fontSize: '12px', color: '#e67e22', fontWeight: 'bold', textTransform: 'uppercase' }}>SL Tổng (Các Vendor)</span><br/>
                <strong style={{ fontSize: '32px', color: '#d35400', lineHeight: '1.2' }}>
                  {Number(totalBalance || 0).toLocaleString('vi-VN')}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#7f8c8d', textTransform: 'uppercase', fontWeight: 'bold' }}>Loại (Type)</span><br/>
                  <strong style={{ fontSize: '15px' }}>{material.materialType || 'N/A'}</strong>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#7f8c8d', textTransform: 'uppercase', fontWeight: 'bold' }}>Model</span><br/>
                  <strong style={{ fontSize: '15px' }}>{material.model || 'N/A'}</strong>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#7f8c8d', textTransform: 'uppercase', fontWeight: 'bold' }}>Nhà cung cấp (Vendors)</span><br/>
                {vendorsList.filter(v => v.balance > 0).length > 0 ? (
                  <ul style={{ paddingLeft: '0', margin: '5px 0 0 0', listStyle: 'none', fontSize: '14px', color: '#2c3e50' }}>
                    {vendorsList.filter(v => v.balance > 0).map((v, i) => (
                      <li key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                        <strong style={{ color: '#2980b9' }}>{v.display}</strong>
                        <div style={{ fontSize: '13px', color: '#34495e', marginTop: '4px' }}>
                          SL Tồn: <span style={{ fontWeight: 'bold', color: '#e67e22' }}>{Number(v.balance || 0).toLocaleString('vi-VN')}</span> | 
                          Tổng tiền: <span style={{ fontWeight: 'bold', color: '#27ae60' }}>${Number(v.balance * (material.price || 0)).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <strong style={{ fontSize: '15px' }}>N/A</strong>
                )}
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                <div style={{flex: 1}}>
                  <span style={{ fontSize: '12px', color: '#7f8c8d', textTransform: 'uppercase', fontWeight: 'bold' }}>Đơn giá (Price)</span><br/>
                  <strong style={{ fontSize: '18px', color: '#27ae60' }}>${Number(material.price || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</strong>
                </div>
                <div style={{flex: 1}}>
                  <span style={{ fontSize: '12px', color: '#7f8c8d', textTransform: 'uppercase', fontWeight: 'bold' }}>Tổng tiền (Total $)</span><br/>
                  <strong style={{ fontSize: '18px', color: '#27ae60' }}>${Number((material.price || 0) * totalBalance).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</strong>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#7f8c8d', textTransform: 'uppercase', fontWeight: 'bold' }}>Mô tả (Description)</span><br/>
                <strong style={{ fontSize: '15px' }}>{material.objectDescription || 'N/A'}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CỘT PHẢI: Bảng Chi Tiết Thẻ Kho */}
      <div className="card right-panel">
        {!material ? (
          <div className="empty-state">
            <h3>👈 Vui lòng tìm kiếm và chọn mã Code ở menu bên trái để xem Thẻ Kho!</h3>
          </div>
        ) : (
          <>
            <div className="header-actions" style={{ marginBottom: '20px' }}>
              <div className="header-actions-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h2 className="material-header-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="title-code" style={{ color: '#e74c3c', fontSize: '32px', fontWeight: '900' }}>{material.itemsCode}</span>
                  <span className="title-model" style={{ color: '#e67e22', fontSize: '20px', fontWeight: 'bold' }}>{material.model || 'N/A'}</span>
                  {material.materialType && <span className="title-type" style={{ color: '#2980b9', fontSize: '20px', fontWeight: 'bold' }}>{material.materialType}</span>}
                </h2>
                <div className="mobile-header-balance">
                  <strong style={{ fontSize: '24px', color: '#d35400' }}>
                    SL Tổng : {Number(totalBalance || 0).toLocaleString('vi-VN')}
                  </strong>
                  {/* Hiển thị chi tiết tồn kho của từng Vendor trên Mobile */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: '12px', color: '#34495e', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                    {vendorsList.filter(v => v.balance > 0).length > 0 ? (
                      vendorsList.filter(v => v.balance > 0).map((v, i) => (
                        <div key={i} style={{ wordBreak: 'break-word' }}>
                          <span style={{ color: '#2980b9', fontWeight: '500' }}>{v.display}: </span>
                          <span style={{ fontWeight: 'bold', color: '#e67e22' }}>{Number(v.balance || 0).toLocaleString('vi-VN')}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontStyle: 'italic', color: '#7f8c8d', gridColumn: '1 / -1' }}>Hết hàng ở tất cả các kho.</div>
                    )}
                  </div>
                </div>
                <button className="btn btn-info desktop-details-btn" onClick={handleOpenDetails} style={{ backgroundColor: '#3498db', color: 'white' }}>
                  🔍 Chi tiết xuất nhập (100 dòng)
                </button>
              </div>
            </div>
            <div className="table-responsive">
            <table className="modern-table">
          <thead>
            <tr>
              <th style={{ whiteSpace: 'nowrap', width: '80px' }}>Ngày</th>
              <th style={{ textAlign: 'center', width: '60px' }}>Nhập</th>
              <th style={{ textAlign: 'center', width: '80px' }}>Xuất Plan</th>
              <th style={{ textAlign: 'center', width: '80px' }}>Xuất khác</th>
              <th style={{ textAlign: 'center', width: '80px' }}>Tồn cuối</th>
              <th style={{ width: '80px' }}>Ký tên</th>
              <th style={{ maxWidth: '150px' }}>Ghi chú</th>
              <th style={{ maxWidth: '120px' }}>Vendor</th>
              <th style={{ textAlign: 'center', width: '90px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(transactions) && transactions.length > 0 ? transactions.map((t) => (
              <tr key={t._id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className="desktop-date">{new Date(t.date).toLocaleDateString('vi-VN')}</span>
                  <span className="mobile-date">{`${String(new Date(t.date).getDate()).padStart(2, '0')}/${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}`}</span>
                </td>
                <td style={{ textAlign: 'center' }}>{t.type === 'IN' ? <span className="badge badge-success">+{Number(t.quantity).toLocaleString('vi-VN')}</span> : ''}</td>
                <td style={{ textAlign: 'center' }}>{t.type === 'OUT_PLAN' ? <span className="badge badge-danger">-{Number(t.quantity).toLocaleString('vi-VN')}</span> : ''}</td>
                <td style={{ textAlign: 'center' }}>{(t.type === 'OUT_OTHER' || t.type === 'OUT') ? <span className="badge badge-warning" style={{ color: '#2c3e50', fontWeight: 'bold' }}>-{Number(t.quantity).toLocaleString('vi-VN')}</span> : ''}</td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{Number(t.combinedBalance !== undefined ? t.combinedBalance : t.balance).toLocaleString('vi-VN')}</td>
                <td className="truncate-text" onClick={() => handleOpenFullText('Thông tin Người Ký', t.user)} title="Nhấn để xem chi tiết">{getLastName(t.user)}</td>
                <td className="truncate-text" style={{ maxWidth: '150px' }} onClick={() => handleOpenFullText('Chi tiết Ghi chú', t.description)} title="Nhấn để xem chi tiết">{t.description}</td>
                <td className="truncate-text" style={{ maxWidth: '120px' }} onClick={() => handleOpenFullText('Chi tiết Vendor', t.vendor || '-')} title="Nhấn để xem chi tiết">{t.vendor || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', marginRight: '5px' }} onClick={() => openModal(t.type, t)}>✏️</button>
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleDeleteTransaction(t._id)}>🗑</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9" className="empty-state">Chưa có giao dịch nhập/xuất nào.</td>
              </tr>
            )}
          </tbody>
        </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Chọn Loại Xuất Hàng */}
      {isOutTypeModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1500 }}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3>Chọn Loại Xuất Hàng</h3>
              <button className="close-btn" onClick={() => setIsOutTypeModalOpen(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <button className="btn btn-primary mobile-full-btn" onClick={() => handleSelectOutType('Plan')}>Xuất Plan</button>
              <button className="btn btn-secondary mobile-full-btn" onClick={() => handleSelectOutType('WD')}>Xuất WD</button>
              <button className="btn btn-secondary mobile-full-btn" onClick={() => handleSelectOutType('RMA')}>Xuất RMA</button>
              <button className="btn btn-secondary mobile-full-btn" onClick={() => handleSelectOutType('NGDV')}>Xuất NGDV</button>
              <button className="btn btn-secondary mobile-full-btn" onClick={() => handleSelectOutType('B05')}>Xuất B05</button>
              <button className="btn btn-warning mobile-full-btn" style={{color: 'white'}} onClick={() => handleSelectOutType('Khác')}>Xuất Khác (Tự nhập)</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setIsOutTypeModalOpen(false)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Ghi Nhập / Ghi Xuất */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ color: transactionType === 'IN' ? '#27ae60' : (transactionType === 'OUT_PLAN' ? '#c0392b' : '#f39c12') }}>
                {editingTxId 
                  ? (transactionType === 'IN' ? '✏️ Sửa Nhập Kho' : (transactionType === 'OUT_PLAN' ? '✏️ Sửa Xuất Plan' : '✏️ Sửa Xuất Khác'))
                  : (transactionType === 'IN' ? '➕ Ghi Nhập Kho' : (transactionType === 'OUT_PLAN' ? '➖ Ghi Xuất Plan' : '➖ Ghi Xuất Khác'))}
              </h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ngày chứng từ *</label>
                <input type="date" className="form-control" name="date" value={formData.date} onChange={handleInputChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ghi chú / Diễn giải</label>
                <input type="text" className="form-control" name="description" value={formData.description} onChange={handleInputChange} placeholder="Nhập lý do..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Vendor (Bên giao / Bên nhận)</label>
                <select 
                  className="form-control" 
                  name="vendor" 
                  value={formData.targetMaterialId} 
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedVendor = vendorsList.find(v => v.id === selectedId);
                    setFormData(prev => ({
                      ...prev,
                      targetMaterialId: selectedId,
                      vendor: selectedVendor ? selectedVendor.vendorString : ''
                    }));
                  }}
                  disabled={!!editingTxId}
                >
              {vendorsList
                .filter(v => transactionType === 'IN' || v.balance > 0 || (editingTxId && v.id === formData.targetMaterialId))
                .map((v, idx) => (
                    <option key={idx} value={v.id}>{v.display} (Tồn kho: {v.balance})</option>
                  ))}
                  {editingTxId && !vendorsList.find(v => v.id === formData.targetMaterialId) && (
                    <option value={formData.targetMaterialId}>{formData.vendor}</option>
                  )}
                </select>
                {!!editingTxId && <small style={{color: '#7f8c8d'}}>* Không thể đổi Vendor khi đang sửa giao dịch cũ</small>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Số lượng *</label>
                <input type="number" className="form-control" name="quantity" value={formData.quantity} onChange={handleInputChange} min="1" placeholder="Nhập số lượng..." style={{ fontSize: '18px', fontWeight: 'bold' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy Bỏ</button>
              <button className={`btn ${transactionType === 'IN' ? 'btn-success' : 'btn-danger'}`} onClick={handleSaveTransaction}>💾 Lưu Giao Dịch</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Live QR Scanner (Dành cho HTTPS/Localhost) */}
      {isLiveScannerOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ width: '90%', maxWidth: '400px', padding: '15px' }}>
            <div className="modal-header">
              <h3>📷 Quét Mã QR</h3>
              <button className="close-btn" onClick={closeLiveScanner}>×</button>
            </div>
            <div id="qr-reader-live" style={{ width: '100%', minHeight: '300px' }}></div>
          </div>
        </div>
      )}

      {/* Modal hiển thị Full Text (Cửa sổ ảo cho ghi chú/vendor) */}
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

      {/* Modal Chi Tiết Lịch Sử 100 Dòng */}
      {isDetailsOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000, padding: '10px' }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '1400px', height: '95vh', display: 'flex', flexDirection: 'column', padding: '15px' }}>
            <div className="modal-header">
              <h3>🔍 Lịch Sử Xuất Nhập Chi Tiết - {material?.itemsCode}</h3>
              <button className="close-btn" onClick={() => setIsDetailsOpen(false)}>×</button>
            </div>
            
            <div className="history-filter-flex" style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <div className="filter-inputs">
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#7f8c8d' }}>Từ ngày:</label>
                  <input type="date" className="form-control" value={dateFilter.from} onChange={e => setDateFilter(prev => ({...prev, from: e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#7f8c8d' }}>Đến ngày:</label>
                  <input type="date" className="form-control" value={dateFilter.to} onChange={e => setDateFilter(prev => ({...prev, to: e.target.value}))} />
                </div>
              </div>
              <div className="filter-buttons">
                <button className="btn btn-primary" onClick={() => fetchDetails(dateFilter.from, dateFilter.to)}>Lọc Dữ Liệu</button>
                <button className="btn btn-secondary" onClick={() => { setDateFilter({from:'', to:''}); fetchDetails('',''); }}>Xóa Lọc</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1, border: '1px solid #eee', borderRadius: '8px' }}>
              <table className="modern-table details-table" style={{ minWidth: '800px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white' }}>
                  <tr>
                    <th style={{ padding: '8px', fontSize: '13px', width: '80px' }}>Ngày</th>
                    <th style={{ padding: '8px', fontSize: '13px', width: '80px' }}>Phân Loại</th>
                    <th style={{ padding: '8px', fontSize: '13px', textAlign: 'center', width: '70px' }}>Số lượng</th>
                    <th style={{ padding: '8px', fontSize: '13px', textAlign: 'center', width: '70px' }}>Tồn Cuối</th>
                    <th style={{ padding: '8px', fontSize: '13px', maxWidth: '150px' }}>Ghi chú</th>
                    <th style={{ padding: '8px', fontSize: '13px', maxWidth: '120px' }}>Vendor</th>
                    <th style={{ padding: '8px', fontSize: '13px', width: '130px' }}>Thời gian Lưu Log</th>
                    <th style={{ padding: '8px', fontSize: '13px', width: '100px' }}>Người thực hiện</th>
                    <th style={{ padding: '8px', fontSize: '13px', textAlign: 'center', width: '80px' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {detailTransactions.map(t => (
                    <tr key={t._id} style={{ opacity: t.isDeleted ? 0.7 : 1, backgroundColor: t.isDeleted ? '#fdf2f2' : (t.historyAction === 'Bản Mới (Sau Sửa)' ? '#f0f9ff' : 'transparent') }}>
                      <td style={{ padding: '6px 8px', fontSize: '13px', textDecoration: t.isDeleted ? 'line-through' : 'none', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        <span className="desktop-date">{new Date(t.date).toLocaleDateString('vi-VN')}</span>
                        <span className="mobile-date">{`${String(new Date(t.date).getDate()).padStart(2, '0')}/${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}`}</span>
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: '13px' }}>
                        {t.type === 'IN' ? <span className="badge badge-success" style={{ fontSize: '11px' }}>Nhập Kho</span> : 
                         t.type === 'OUT_PLAN' ? <span className="badge badge-danger" style={{ fontSize: '11px' }}>Xuất Plan</span> : 
                         <span className="badge badge-warning" style={{ color: '#2c3e50', fontWeight: 'bold', fontSize: '11px' }}>Xuất Khác</span>}
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: '13px', textDecoration: t.isDeleted ? 'line-through' : 'none', textAlign: 'center', fontWeight: 'bold', color: t.type === 'IN' ? '#27ae60' : '#c0392b' }}>{t.type === 'IN' ? '+' : '-'}{Number(t.quantity).toLocaleString('vi-VN')}</td>
                      <td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'center', color: '#e67e22', fontWeight: 'bold' }}>{Number(t.combinedBalance !== undefined ? t.combinedBalance : t.balance).toLocaleString('vi-VN')}</td>
                      <td className="truncate-text" style={{ padding: '6px 8px', fontSize: '13px', textDecoration: t.isDeleted ? 'line-through' : 'none', maxWidth: '150px' }} onClick={() => handleOpenFullText('Chi tiết Ghi chú', t.description)} title="Nhấn để xem chi tiết">{t.description}</td>
                      <td className="truncate-text" style={{ padding: '6px 8px', fontSize: '13px', textDecoration: t.isDeleted ? 'line-through' : 'none', maxWidth: '120px' }} onClick={() => handleOpenFullText('Chi tiết Vendor', t.vendor || '-')} title="Nhấn để xem chi tiết">{t.vendor || '-'}</td>
                      <td style={{ padding: '6px 8px', fontSize: '12px', color: '#7f8c8d' }}>{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="truncate-text" style={{ padding: '6px 8px', fontSize: '13px', textDecoration: t.isDeleted ? 'line-through' : 'none' }} onClick={() => handleOpenFullText('Thông tin Người Ký', t.user)} title="Nhấn để xem chi tiết">{getLastName(t.user)}</td>
                      <td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'center' }}>
                        <span className={`badge ${t.historyAction === 'Đã Xóa' ? 'badge-danger' : (t.historyAction === 'Bản Cũ (Bị Sửa)' ? 'badge-secondary' : (t.historyAction === 'Bản Mới (Sau Sửa)' ? 'badge-info' : 'badge-success'))}`} style={{ fontSize: '11px' }}>
                          {t.historyAction || (t.isDeleted ? 'Đã Xóa' : 'Thêm Mới')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {detailTransactions.length === 0 && (
                    <tr><td colSpan="10" className="empty-state">Không tìm thấy dữ liệu.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transactions;