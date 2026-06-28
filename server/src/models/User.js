const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // ID đăng nhập
  fullName: { type: String, required: true },               // Họ và tên
  password: { type: String, required: true },               // Mật khẩu
  role: { type: String, enum: ['Admin', 'Staff'], default: 'Staff' }, // Quản lý hoặc Nhân viên
  group: { type: String, enum: ['MAIN', 'BOARD'], default: 'MAIN' }   // Nhóm quản lý
}, { timestamps: true });

// Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Tự động tạo tài khoản Admin mặc định khi hệ thống khởi động (Nếu chưa tồn tại)
const createDefaultAdmin = async () => {
  try {
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      // Lấy từ .env, nếu không có thì tự động tạo chuỗi ngẫu nhiên bảo mật
      const defaultPass = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(-6) + 'A@1';
      
      admin = new User({
        username: 'admin',
        fullName: 'Quản Trị Viên Hệ Thống',
        password: defaultPass,
        role: 'Admin'
      });
      await admin.save();
    }
  } catch (error) {
    console.error('❌ Lỗi tạo Admin mặc định:', error.message);
  }
};

createDefaultAdmin();

module.exports = User;