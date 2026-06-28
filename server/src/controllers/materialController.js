const Material = require('../models/Material');

// @desc    Lấy danh sách tất cả vật liệu
// @route   GET /api/materials
exports.getMaterials = async (req, res) => {
  try {
    const materials = await Material.find().sort({ updatedAt: -1 }); // Đưa những mã vừa sửa/tạo lên đầu
    res.status(200).json(materials);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách vật liệu', error: error.message });
  }
};

// @desc    Lấy chi tiết 1 vật liệu theo ID
// @route   GET /api/materials/:id
exports.getMaterialById = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Không tìm thấy vật liệu' });
    res.status(200).json(material);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống', error: error.message });
  }
};

// @desc    Thêm mới vật liệu (Có thể mở rộng thêm hàng loạt sau này)
// @route   POST /api/materials
exports.createMaterial = async (req, res) => {
  try {
    const { materialType, model, itemsCode, objectDescription, vendorName, vendor, vendorCode, price, createdBy } = req.body;

    const existingMaterial = await Material.findOne({ itemsCode, vendorCode });
    if (existingMaterial) {
      return res.status(400).json({ message: 'Mã sản phẩm của Vendor này đã tồn tại trong hệ thống' });
    }

    const material = new Material({
      materialType,
      model,
      itemsCode,
      objectDescription,
      vendorName,
      vendor,
      vendorCode,
      price,
      createdBy: createdBy || 'Admin' // Sẽ thay bằng User đăng nhập sau
    });

    const savedMaterial = await material.save();
    res.status(201).json(savedMaterial);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi thêm vật liệu', error: error.message });
  }
};

// @desc    Cập nhật vật liệu
// @route   PUT /api/materials/:id
exports.updateMaterial = async (req, res) => {
  try {
    const updatedMaterial = await Material.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedMaterial) return res.status(404).json({ message: 'Không tìm thấy vật liệu' });
    res.status(200).json(updatedMaterial);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật vật liệu', error: error.message });
  }
};

// @desc    Xóa vật liệu
// @route   DELETE /api/materials/:id
exports.deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ message: 'Không tìm thấy vật liệu' });
    res.status(200).json({ message: 'Đã xóa vật liệu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa', error: error.message });
  }
};

// @desc    Xóa nhiều vật liệu cùng lúc
// @route   POST /api/materials/delete-multiple
exports.deleteMultipleMaterials = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu để xóa' });
    }
    await Material.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: 'Đã xóa thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa nhiều vật liệu', error: error.message });
  }
};

// @desc    Upload danh sách vật liệu từ Excel
// @route   POST /api/materials/upload
exports.uploadMaterials = async (req, res) => {
  try {
    const materials = req.body;
    if (!Array.isArray(materials)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    // Sử dụng BulkWrite để tối ưu hoá hiệu suất khi Upload file Excel cực lớn (hàng vạn dòng)
    const bulkOps = materials.map(item => ({
      updateOne: {
        filter: { itemsCode: item.itemsCode, vendorCode: item.vendorCode },
        update: { $set: item },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      const result = await Material.bulkWrite(bulkOps);
      res.status(200).json({ message: 'Upload thành công', modifiedCount: result.modifiedCount, upsertedCount: result.upsertedCount });
    } else {
      res.status(400).json({ message: 'Không có dữ liệu hợp lệ để xử lý' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi upload', error: error.message });
  }
};

// @desc    Tìm kiếm nhanh vật liệu (tối đa 5 kết quả)
// @route   GET /api/materials/search
exports.searchMaterials = async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.status(200).json([]);
    const materials = await Material.find({
      $or: [
        { itemsCode: { $regex: q, $options: 'i' } },
        { model: { $regex: q, $options: 'i' } }
      ]
    }).limit(5); // Chỉ lấy tối đa 5 kết quả
    res.status(200).json(materials);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm', error: error.message });
  }
};
