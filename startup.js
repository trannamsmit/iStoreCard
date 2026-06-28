const net = require('net');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Hàm kiểm tra xem port có đang trống không
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

// Hàm tìm port trống bắt đầu từ port cho trước
async function getAvailablePort(startPort) {
  let port = startPort;
  while (!(await checkPort(port))) {
    port++;
  }
  return port;
}

// Hàm lấy địa chỉ IP của mạng LAN
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Bỏ qua IPv6 và các IP nội bộ (localhost)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // Fallback nếu không tìm thấy
}

async function startSystem() {
  console.log("===================================================");
  console.log("    KHOI DONG HE THONG iStoreCard (OFFLINE LAN)");
  console.log("===================================================");
  console.log("Dang kiem tra cong (port) trong tren may...\n");

  // Tìm port trống cho Backend và Frontend
  const backendPort = await getAvailablePort(5050);
  const frontendPort = await getAvailablePort(5555);
  const localIP = getLocalIP();

  console.log(`- Backend se chay tren port: ${backendPort}`);
  console.log(`- Frontend se chay tren port: ${frontendPort}`);
  console.log(`- IP cua may chu (Local IP): ${localIP}\n`);

  // 1. Cập nhật cấu hình Backend (.env)
  const serverEnvPath = path.join(__dirname, 'server', '.env');
  let serverEnvContent = '';
  if (fs.existsSync(serverEnvPath)) {
    serverEnvContent = fs.readFileSync(serverEnvPath, 'utf8');
    // Xoá các dòng cấu hình cũ
    serverEnvContent = serverEnvContent
      .split('\n')
      .filter(line => !line.startsWith('PORT=') && !line.startsWith('CORS_ORIGIN='))
      .join('\n');
    // Sửa lỗi sai tên biến môi trường ở bản trước (nếu có)
    serverEnvContent = serverEnvContent.replace('MONGO_URI=', 'MONGODB_URI=');
  } else {
    serverEnvContent = 'MONGODB_URI=mongodb://127.0.0.1:27017/istorecard\n';
  }
  serverEnvContent += `\nPORT=${backendPort}\nCORS_ORIGIN=http://${localIP}:${frontendPort}`;
  fs.writeFileSync(serverEnvPath, serverEnvContent.trim());

  // 2. Cập nhật cấu hình Frontend (.env)
  const clientEnvPath = path.join(__dirname, 'client', '.env');
  const clientEnvContent = `VITE_API_URL=http://${localIP}:${backendPort}/api`;
  fs.writeFileSync(clientEnvPath, clientEnvContent);

  // 3. Khởi động Backend
  console.log("[1] Dang khoi dong Backend Server...");
  const backendProcess = spawn('cmd.exe', ['/c', 'npm', 'start'], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'inherit' // Hiển thị log trực tiếp ra console
  });

  // 4. Khởi động Frontend
  console.log("[2] Dang khoi dong Frontend Client...\n");
  const frontendProcess = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev', '--', '--port', frontendPort.toString()], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'inherit' // Hiển thị log trực tiếp ra console
  });

  // 5. Tự động mở trình duyệt sau 3 giây để đảm bảo Frontend đã khởi động xong
  setTimeout(() => {
    spawn('cmd.exe', ['/c', 'start', `http://localhost:${frontendPort}`]);
  }, 3000);

  console.log("===================================================");
  console.log("HUONG DAN TRUY CAP TREN MANG LAN:");
  console.log(`Tu cac may khac trong mang, truy cap: http://${localIP}:${frontendPort}`);
  console.log(`Tu may nay (Server), truy cap:      http://localhost:${frontendPort}`);
  console.log("===================================================\n");
  console.log("Vui long giu cua so nay mo de he thong hoat dong.");
  console.log("Bam Ctrl+C de tat he thong.");

  // Quản lý việc đóng ứng dụng
  process.on('SIGINT', () => {
    console.log("\nDang tat he thong...");
    backendProcess.kill('SIGINT');
    frontendProcess.kill('SIGINT');
    process.exit(0);
  });
}

startSystem().catch(err => {
  console.error("Co loi xay ra khi khoi dong he thong:", err);
});
