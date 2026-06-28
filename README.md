# iStoreCard — Hệ thống quản lý kho vật liệu

Ứng dụng quản lý thẻ kho điện tử, chạy trên mạng LAN nội bộ.  
Hỗ trợ cả **Web Browser** (PC) và **Android App** (APK).

---

## Cách build APK Android (qua GitHub Actions)

### Yêu cầu
- Tài khoản GitHub (miễn phí)
- Git đã cài trên máy

### Các bước

**1. Tạo repo GitHub và push code**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TEN_BAN/istorecard.git
git push -u origin main
```

**2. Bật GitHub Actions**
- Vào repo → tab **Actions**
- Nếu bị hỏi, bấm "I understand my workflows, go ahead and enable them"

**3. Chạy build thủ công**
- Vào **Actions** → chọn workflow **"Build Android APK"**
- Bấm nút **"Run workflow"** → **"Run workflow"** (xanh)
- Đợi ~5–10 phút

**4. Tải APK**
- Sau khi build xong (dấu ✅ xanh), bấm vào workflow run
- Kéo xuống phần **Artifacts** → tải `iStoreCard-vX`
- Giải nén → có file `app-debug.apk`

Hoặc vào tab **Releases** của repo để tải trực tiếp.

---

## Cài APK lên điện thoại

1. Copy file `app-debug.apk` vào điện thoại
2. Vào **Cài đặt → Bảo mật → Cho phép cài từ nguồn không xác định**
3. Mở file APK → Cài đặt
4. Mở app → Nhập **IP Server** và **Port** (mặc định 5050)
5. Bấm **Kiểm tra kết nối** → **Lưu và tiếp tục**

> ⚠️ Điện thoại phải kết nối cùng mạng WiFi với máy chủ!

---

## Chạy hệ thống (Server)

```bash
# Khởi động server
cd server
npm install
npm start

# Hoặc dùng file startup
cd d:\Public\iStoreCard
node startup.js
```

Server chạy mặc định tại `http://[IP-MÁY-TÍNH]:5050`

---

## Cấu trúc dự án

```
iStoreCard/
├── .github/workflows/build-apk.yml   ← GitHub Actions build APK
├── client/                           ← React + Vite + Capacitor
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js                    ← Tự động đọc IP từ localStorage
│   │   ├── components/
│   │   │   ├── AutoLogout.jsx
│   │   │   └── ServerConfig.jsx      ← Màn hình nhập IP Server (Android)
│   │   └── pages/
│   ├── capacitor.config.json
│   └── package.json
└── server/                           ← Express + MongoDB
    └── src/
```

---

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js + Express + MongoDB |
| Frontend | React 18 + Vite + React Router |
| Android | Capacitor 6 |
| Build CI | GitHub Actions |
