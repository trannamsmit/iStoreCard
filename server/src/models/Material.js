const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  materialType: { type: String },
  model: { type: String },
  itemsCode: { type: String, required: true },
  objectDescription: { type: String },
  vendorName: { type: String },
  vendor: { type: String },
  vendorCode: { type: String },
  price: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  createdBy: { type: String, default: 'Admin' }
}, { timestamps: true }); 

const Material = mongoose.model('Material', materialSchema);

// Tự động dọn dẹp chốt chặn (index) cũ gây lỗi "duplicate key code_1"
Material.collection.dropIndex('code_1').catch(() => {});
Material.collection.dropIndex('itemsCode_1').catch(() => {});

module.exports = Material;
