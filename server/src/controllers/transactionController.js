const Transaction = require('../models/Transaction');
const Material = require('../models/Material');
const User = require('../models/User');
const net = require('net');
const puppeteer = require('puppeteer');

// Helper: Thuật toán tự động tính toán lại Tồn kho cho toàn bộ lịch sử
const recalculateBalances = async (materialId) => {
  const transactions = await Transaction.find({ materialId, isDeleted: { $ne: true } }).sort({ date: 1, createdAt: 1 });
  let currentBalance = 0;
  const bulkOps = [];
  for (let tx of transactions) {
    if (tx.type === 'IN') currentBalance += tx.quantity;
    else if (tx.type === 'OUT' || tx.type === 'OUT_PLAN' || tx.type === 'OUT_OTHER') currentBalance -= tx.quantity;
    
    if (tx.balance !== currentBalance) {
      bulkOps.push({
        updateOne: {
          filter: { _id: tx._id },
          update: { $set: { balance: currentBalance } }
        }
      });
    }
  }
  if (bulkOps.length > 0) {
    await Transaction.bulkWrite(bulkOps);
  }

  // Đồng bộ số dư Tồn Kho mới nhất ra bên ngoài bảng "Thông Tin Vật Liệu"
  const lastTx = await Transaction.findOne({ materialId, isDeleted: { $ne: true } }).sort({ date: -1, createdAt: -1 });
  await Material.findByIdAndUpdate(materialId, { balance: lastTx ? lastTx.balance : 0 });
};

// @desc    Lấy danh sách thẻ kho (giao dịch) của 1 sản phẩm cụ thể
// @route   GET /api/transactions/:materialId
exports.getTransactionsByMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    
    // Tìm material gốc để lấy itemsCode
    const currentMaterial = await Material.findById(materialId);
    if (!currentMaterial) return res.status(404).json({ message: 'Không tìm thấy vật liệu' });

    // Lấy map User để tự động ánh xạ giao dịch cũ (chỉ có Tên) sang định dạng (ID - Tên)
    const allUsers = await User.find().select('fullName username');
    const userMap = {};
    allUsers.forEach(u => {
      if (u.username) {
        userMap[u.fullName] = `${u.username} - ${u.fullName}`;
      }
    });

    // Tìm tất cả Material có cùng itemsCode (các Vendor khác nhau)
    const allMaterials = await Material.find({ itemsCode: currentMaterial.itemsCode });
    const materialIds = allMaterials.map(m => m._id);

    // Phân trang (mô phỏng 25 dòng/trang như thẻ kho giấy)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Đổi mặc định sang 20 dòng
    const skip = (page - 1) * limit;
    const { fromDate, toDate, latest, showDeleted } = req.query;

    // Lấy TOÀN BỘ giao dịch của các Vendor chung mã để tính Tồn kho gộp (Running Balance)
    let query = { materialId: { $in: materialIds } };
    if (showDeleted !== 'true') query.isDeleted = { $ne: true };

    const allTransactions = await Transaction.find(query)
      .sort({ date: 1, createdAt: 1 }); // Sắp xếp theo ngày tăng dần

    let runningCombinedBalance = 0;
    let processedTransactions = allTransactions.map(tx => {
      if (!tx.isDeleted) {
        if (tx.type === 'IN') runningCombinedBalance += tx.quantity;
        else if (['OUT', 'OUT_PLAN', 'OUT_OTHER'].includes(tx.type)) runningCombinedBalance -= tx.quantity;
      }
      
      let txUser = tx.user;
      if (userMap[txUser]) {
        txUser = userMap[txUser];
      }

      return { ...tx.toObject(), combinedBalance: runningCombinedBalance, user: txUser };
    });

    // Lọc theo khoảng thời gian nếu có
    if (fromDate) {
      const fd = new Date(fromDate);
      fd.setHours(0, 0, 0, 0);
      processedTransactions = processedTransactions.filter(tx => new Date(tx.date) >= fd);
    }
    if (toDate) {
      const td = new Date(toDate);
      td.setHours(23, 59, 59, 999);
      processedTransactions = processedTransactions.filter(tx => new Date(tx.date) <= td);
    }

    // Cắt mảng để phân trang
    let transactions;
    if (latest === 'true') {
      transactions = processedTransactions.slice(-limit); // Lấy N dòng mới nhất
    } else {
      transactions = processedTransactions.slice(skip, skip + limit);
    }
    const total = processedTransactions.length;

    // Tính tổng tồn kho hiện tại của tất cả các vendor cộng lại
    const totalBalance = allMaterials.reduce((sum, m) => sum + (m.balance || 0), 0);

    res.status(200).json({
      transactions,
      page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      totalBalance
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu thẻ kho', error: error.message });
  }
};

// @desc    Lấy báo cáo theo ca làm việc (Shift Report)
// @route   GET /api/transactions/report/shift
exports.getShiftReport = async (req, res) => {
  try {
    const { date, shift, group } = req.query;
    if (!date || !shift) return res.status(400).json({ message: 'Thiếu tham số bắt buộc: date và shift' });

    let validUsers = ['System']; // Dự phòng để lấy cả các giao dịch hệ thống
    const userMap = {};

    if (group) {
      // Nếu có group, lọc theo group đó
      const usersInGroup = await User.find({ group }).select('fullName username');
      usersInGroup.forEach(u => {
        validUsers.push(u.fullName);
        if (u.username) {
          const fullString = `${u.username} - ${u.fullName}`;
          validUsers.push(fullString);
          userMap[u.fullName] = fullString;
        }
      });
    } else {
      // Nếu không có group (admin), lấy tất cả người dùng
      const allUsers = await User.find().select('fullName username');
      allUsers.forEach(u => {
        validUsers.push(u.fullName);
        if (u.username) {
          const fullString = `${u.username} - ${u.fullName}`;
          validUsers.push(fullString);
          userMap[u.fullName] = fullString;
        }
      });
    }

    // 2. Tính toán khung giờ theo ca (Tạo Date thủ công để tránh lỗi lệch múi giờ UTC)
    const [year, month, day] = date.split('-');
    const startDate = new Date(year, month - 1, day);
    const endDate = new Date(year, month - 1, day);

    if (shift === 'A') {
      startDate.setHours(8, 0, 0, 0);
      endDate.setHours(19, 59, 59, 999);
    } else if (shift === 'B') {
      startDate.setHours(20, 0, 0, 0);
      endDate.setDate(endDate.getDate() + 1); // Sang ngày hôm sau
      endDate.setHours(7, 59, 59, 999);
    }

    // 3. Truy vấn các giao dịch (Sử dụng createdAt vì date từ Thẻ kho chỉ lưu ngày không có giờ)
    const transactions = await Transaction.find({
      user: { $in: validUsers },
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    }).populate('materialId', 'itemsCode model materialType').sort({ createdAt: -1 });

    // Map dữ liệu để các giao dịch cũ hoặc của nhân viên chưa đăng xuất tự hiện ID
    const processedTransactions = transactions.map(tx => {
      const txObj = tx.toObject();
      if (userMap[txObj.user]) {
        txObj.user = userMap[txObj.user];
      }
      return txObj;
    });

    res.json(processedTransactions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy báo cáo', error: error.message });
  }
};

// @desc    Thêm giao dịch Nhập/Xuất kho và tính toán Tồn cuối
// @route   POST /api/transactions
exports.createTransaction = async (req, res) => {
  try {
    const { materialId, date, documentNo, description, vendor, type, quantity, user, note } = req.body;

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ message: 'Không tìm thấy vật liệu' });
    }

    // Lấy giao dịch gần nhất của vật liệu này để lấy Tồn cuối hiện tại
    const lastTransaction = await Transaction.findOne({ materialId, isDeleted: { $ne: true } }).sort({ date: -1, createdAt: -1 });

    // Tính tồn trước đó
    let previousBalance = lastTransaction ? lastTransaction.balance : 0;

    // Tính toán Tồn cuối = Tồn đầu + Nhập - Xuất
    let newBalance = previousBalance;
    if (type === 'IN') {
      newBalance += Number(quantity);
    } else if (type === 'OUT' || type === 'OUT_PLAN' || type === 'OUT_OTHER') {
      newBalance -= Number(quantity);
      if (newBalance < 0) {
        return res.status(400).json({ message: 'Số lượng xuất vượt quá tồn kho hiện tại!' });
      }
    } else {
      return res.status(400).json({ message: 'Loại giao dịch không hợp lệ' });
    }

    const transaction = new Transaction({
      materialId,
      date: date || new Date(),
      documentNo,
      description,
      note, // Thêm trường note vào đây
      vendor,
      type,
      quantity,
      balance: newBalance,
      historyAction: 'Thêm Mới',
      user: user || 'System' // Sẽ lấy từ phiên đăng nhập sau
    });

    const savedTransaction = await transaction.save();
    
    // Tính toán lại toàn bộ tồn kho để đảm bảo chính xác (kể cả khi ghi giao dịch bù vào quá khứ)
    await recalculateBalances(materialId);

    res.status(201).json(savedTransaction);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi lưu giao dịch', error: error.message });
  }
};

// @desc    Cập nhật giao dịch
// @route   PUT /api/transactions/detail/:id
exports.updateTransaction = async (req, res) => {
  try {
    const { date, documentNo, description, vendor, type, quantity } = req.body;
    const oldTx = await Transaction.findById(req.params.id);
    if (!oldTx) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });

    // Đánh dấu bản ghi cũ là đã bị sửa (Soft delete để lưu Log)
    oldTx.isDeleted = true;
    oldTx.historyAction = 'Bản Cũ (Bị Sửa)';
    await oldTx.save();

    // Tạo bản ghi mới hoàn toàn để không ghi đè dòng cũ
    const newTx = new Transaction({
      materialId: oldTx.materialId,
      date: date || oldTx.date,
      documentNo: documentNo,
      description: description,
      vendor: vendor,
      type: type || oldTx.type,
      quantity: Number(quantity),
      balance: 0, // Sẽ được tính lại bên dưới
      historyAction: 'Bản Mới (Sau Sửa)',
      user: oldTx.user
    });
    await newTx.save();

    await recalculateBalances(oldTx.materialId);
    res.status(200).json({ message: 'Cập nhật thành công' });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật', error: error.message });
  }
};

// @desc    Xóa giao dịch
// @route   DELETE /api/transactions/detail/:id
exports.deleteTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    
    const materialId = tx.materialId;
    tx.isDeleted = true; // Chuyển thành Soft Delete để giữ lại lịch sử Log
    tx.historyAction = 'Đã Xóa'; // Cập nhật trạng thái hành động
    await tx.save();
    
    await recalculateBalances(materialId);
    res.status(200).json({ message: 'Xóa thành công (Đã lưu vào lịch sử)' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa', error: error.message });
  }
};

// @desc    Kiểm tra kết nối máy in
// @route   POST /api/transactions/test-printer
exports.testPrinter = (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ message: 'Thiếu IP máy in' });

  const testSocket = new net.Socket();
  testSocket.setTimeout(3000); // Đợi tối đa 3 giây

  testSocket.on('connect', () => {
    testSocket.destroy();
    res.json({ message: `🟢 Tín hiệu TỐT! Đã thông mạng tới máy in ${ip} (Cổng 9100)` });
  });

  testSocket.on('timeout', () => {
    testSocket.destroy();
    res.status(400).json({ message: `🔴 THẤT BẠI: Timeout sau 3 giây. Máy in ${ip} đang tắt nguồn hoặc sai IP.` });
  });

  testSocket.on('error', (err) => {
    testSocket.destroy();
    res.status(400).json({ message: `🔴 LỖI KẾT NỐI tới ${ip}: ${err.message}` });
  });

  testSocket.connect(9100, ip);
};

// @desc    In ngầm qua mạng LAN (Sinh PDF bằng Puppeteer)
// @route   POST /api/transactions/print-network
exports.printNetwork = async (req, res) => {
  try {
    let { ip, labels } = req.body;
    if (!ip || !labels || labels.length === 0) return res.status(400).json({ message: 'Thiếu thông tin in' });

    // Kế thừa logic MMVIP: Tự động đổi IP máy in nếu Client thuộc dải mạng 172.26.8.x
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (clientIp.includes('172.26.8.')) {
      ip = '172.26.8.236'; // Ép sang máy in riêng của dải mạng này
      console.log(`[NETWORK] Client ${clientIp} thuộc dải 172.26.8.x -> Chuyển lệnh in sang: ${ip}`);
    }

    // Tạo file HTML tự động dựa trên dữ liệu tem
    const htmlContent = `
      <!DOCTYPE html><html><head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Arial', sans-serif; background: #fff; width: 210mm; }
          .a4-page { width: 210mm; height: 297mm; padding-top: 1.5cm; display: flex; flex-direction: column; align-items: center; gap: 1cm; page-break-after: always; }
          .label-container { width: 14cm; height: 6cm; border: 1px solid #000; display: flex; flex-direction: column; }
          .label-row { display: flex; height: 2cm; border-bottom: 1px solid #000; align-items: stretch; }
          .label-row:last-child { border-bottom: none; }
          .label-title { width: 35%; font-size: 40px; font-weight: bold; padding-left: 12px; display: flex; align-items: center; border-right: 1px solid #000; text-transform: uppercase; }
          .label-value { width: 65%; font-size: 40px; font-weight: bold; padding-left: 15px; display: flex; align-items: center; white-space: nowrap; overflow: hidden; }
          .qrcode-zone { width: 30%; display: flex; align-items: center; justify-content: center; }
          .qrcode-zone canvas { width: 1.8cm; height: 1.8cm; image-rendering: pixelated; }
        </style>
      </head><body>
        ${Array.from({ length: Math.ceil(labels.length / 4) }).map((_, pageIdx) => {
          const chunk = labels.slice(pageIdx * 4, pageIdx * 4 + 4);
          return `<div class="a4-page">${chunk.map(lbl => `
            <div class="label-container">
              <div class="label-row"><div class="label-title">MODEL</div><div class="label-value" style="width:35%; border-right:1px solid #000;">${lbl.model || ''}</div><div class="qrcode-zone"><canvas id="qr-${lbl.id}"></canvas></div></div>
              <div class="label-row"><div class="label-title">CODE</div><div class="label-value">${lbl.code || ''}</div></div>
              <div class="label-row"><div class="label-title">TYPE</div><div class="label-value">${lbl.type || ''}</div></div>
            </div>`).join('')}</div>`;
        }).join('')}
        <script>${labels.map(lbl => `new QRious({ element: document.getElementById('qr-${lbl.id}'), value: '${lbl.code}', size: 300, level: 'H' });`).join('\n')}</script>
      </body></html>`;

    // Sử dụng Puppeteer để Render trang ẩn và xuất PDF
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await browser.close();

    // Gửi Raw Data vào Port 9100 của máy in
    const client = new net.Socket();
    client.connect(9100, ip, () => {
      client.write(pdfBuffer);
      client.end();
    });
    client.on('error', (err) => console.error('Lỗi máy in LAN:', err));

    res.json({ message: 'Đã gửi lệnh in qua mạng LAN thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi in máy chủ: ' + error.message });
  }
};
