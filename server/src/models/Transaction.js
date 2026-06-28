const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  date: { type: Date, default: Date.now, index: true },              // Ngày ghi sổ
  documentNo: { type: String },                                      // Số chứng từ (Phiếu nhập/xuất)
  description: { type: String },                                     // Diễn giải (Mua hàng, Xuất sản xuất...)
  note: { type: String },                                            // Ghi chú mới thêm
  type: { type: String, enum: ['IN', 'OUT', 'OUT_PLAN', 'OUT_OTHER'], required: true }, // Loại: IN (Nhập), OUT_PLAN (Xuất Plan), OUT_OTHER (Xuất khác)
  quantity: { type: Number, required: true, min: 0 },                // Số lượng
  balance: { type: Number, required: true },                         // Tồn cuối NGAY SAU giao dịch này
  vendor: { type: String },                                          // Vendor giao dịch (Bên giao / Bên nhận)
  isDeleted: { type: Boolean, default: false },                      // Đánh dấu đã xóa (Soft Delete) để lưu log
  historyAction: { type: String, default: 'Thêm Mới' },              // Lưu vết hành động (Thêm Mới, Đã Xóa, Bản Cũ, Bản Mới)
  user: { type: String, required: true },                            // Người thực hiện (Từ Session/JWT)
}, { timestamps: true });

// Đánh index gộp để tăng tốc độ truy vấn khi hiển thị thẻ kho theo từng sản phẩm, sắp xếp theo thời gian
transactionSchema.index({ materialId: 1, date: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
