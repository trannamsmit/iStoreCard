const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Tải biến môi trường từ file .env
dotenv.config();

// Kết nối với cơ sở dữ liệu MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors()); // Cho phép Frontend gọi API
app.use(express.json({ limit: '100mb' })); // Tăng giới hạn dung lượng JSON lên 100MB
app.use(express.urlencoded({ limit: '100mb', extended: true })); // Hỗ trợ body dung lượng lớn
app.use(express.static(path.join(__dirname, '..', 'public'))); // Phục vụ các file tĩnh

// Default route để kiểm tra server
app.get('/', (req, res) => {
  res.send('iStoreCard API is running...');
});

// Route để tải file APK
app.get('/app.apk', (req, res) => {
  // Trỏ đường dẫn ra thư mục gốc của dự án (D:\Public\iStoreCard)
  const apkPath = path.join(__dirname, '..', '..', 'iStoreCard.apk');
  
  // Kiểm tra xem file có tồn tại không trước khi gửi
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'iStoreCard.apk');
  } else {
    res.status(404).send('Lỗi 404: Không tìm thấy file iStoreCard.apk trên máy chủ. Vui lòng đảm bảo file đã được đặt đúng vào thư mục D:\\Public\\iStoreCard\\');
  }
});

// Đăng ký các Routes
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
