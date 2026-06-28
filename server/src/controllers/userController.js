const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Material = require('../models/Material');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const SECRET_KEY = 'istorecard_secret_cute_key'; // Khóa bí mật JWT

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const username = req.body.username?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không đúng!' });
    }
    const token = jwt.sign({ id: user._id, role: user.role, fullName: user.fullName }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role, group: user.group } });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách User (Chỉ Admin)
exports.getUsers = async (req, res) => {
  try {
    const { reqUser } = req.query;
    const query = {};
    // Nếu không phải là tài khoản admin gốc, thì ẩn tài khoản admin đi
    if (reqUser !== 'admin') {
      query.username = { $ne: 'admin' };
    }
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách user' });
  }
};

// Thêm User
exports.createUser = async (req, res) => {
  try {
    let { username, fullName, role, group } = req.body;
    username = username?.trim().toLowerCase();
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'ID đăng nhập đã tồn tại!' });
    
    // Pass mặc định bằng ID
    const user = new User({ username, fullName, role, group, password: username });
    await user.save();
    res.status(201).json({ message: 'Tạo user thành công!' });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi tạo user', error: error.message });
  }
};

// Xóa User
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa User' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa user' });
  }
};

// Reset Password (về mặc định là ID)
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy User' });
    user.password = user.username; // Đặt lại pass = ID
    await user.save();
    res.json({ message: 'Đã reset mật khẩu về mặc định (Bằng ID)!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi reset mật khẩu' });
  }
};

// Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User không tồn tại' });

    // Admin có thể đổi pass cho người khác không cần pass cũ, nhưng nếu tự đổi pass thì cần
    if (oldPassword) {
      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) return res.status(400).json({ message: 'Mật khẩu cũ không chính xác!' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đổi mật khẩu' });
  }
};

// Cập nhật User
exports.updateUser = async (req, res) => {
  try {
    const { fullName, role, group } = req.body;

    // Dùng findByIdAndUpdate để ghi đè dữ liệu thẳng xuống Database, tránh lỗi từ hàm save()
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { fullName, role, group },
      { new: true } // Trả về thông tin mới sau khi cập nhật
    );
    if (!updatedUser) return res.status(404).json({ message: 'Không tìm thấy User' });

    res.json({ message: 'Cập nhật User thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật user', error: error.message });
  }
};

// Xóa toàn bộ dữ liệu lịch sử và Reset tồn kho về 0
exports.clearAllData = async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== '108994') {
      return res.status(400).json({ message: 'Sai mật khẩu xác nhận!' });
    }

    await Transaction.deleteMany({});
    await Material.updateMany({}, { balance: 0 });

    res.json({ message: 'Đã xóa toàn bộ lịch sử giao dịch và reset tồn kho về 0!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa dữ liệu', error: error.message });
  }
};

// Backup toàn bộ dữ liệu hệ thống
exports.backupData = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    const materials = await Material.find();
    const users = await User.find();
    let transactions;
    let filenamePrefix = 'backup_all_';

    if (fromDate && toDate) {
      transactions = await Transaction.find({ date: { $gte: new Date(fromDate), $lte: new Date(toDate) } });
      filenamePrefix = `backup_range_${fromDate}_to_${toDate}_`;
    } else {
      transactions = await Transaction.find();
    }
    
    const backupData = { materials, transactions, users };
    const backupDir = path.join(__dirname, '../../backup');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `${filenamePrefix}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(backupData));

    // Tự động dọn dẹp: Chỉ giữ lại 10 bản backup mới nhất
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort(); // Sắp xếp tăng dần (cũ đến mới)
    if (files.length > 10) {
      const filesToDelete = files.slice(0, files.length - 10); // Lấy các file cũ vượt quá giới hạn
      filesToDelete.forEach(f => {
        fs.unlinkSync(path.join(backupDir, f)); // Xóa file
      });
    }

    res.json({ message: 'Backup dữ liệu thành công!', filename });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo backup', error: error.message });
  }
};

// Lấy danh sách các file Backup hiện có
exports.getBackups = async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../../backup');
    if (!fs.existsSync(backupDir)) return res.json([]);
    
    // Lấy các file .json và sắp xếp file mới nhất lên đầu
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách backup', error: error.message });
  }
};

// Restore dữ liệu từ file
exports.restoreData = async (req, res) => {
  try {
    const { filename } = req.body;
    const backupDir = path.join(__dirname, '../../backup');
    const filePath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Không tìm thấy file backup!' });

    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Xóa sạch dữ liệu cũ
    await Material.deleteMany({});
    await Transaction.deleteMany({});
    await User.deleteMany({});

    // Đổ dữ liệu mới vào
    if (backupData.materials?.length) await Material.insertMany(backupData.materials);
    if (backupData.transactions?.length) await Transaction.insertMany(backupData.transactions);
    if (backupData.users?.length) await User.insertMany(backupData.users);

    res.json({ message: `Restore thành công dữ liệu từ bản sao: ${filename}` });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi Restore', error: error.message });
  }
};