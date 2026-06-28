const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// LƯU Ý: Phải đặt route báo cáo này TRƯỚC route /:materialId để tránh lỗi nhầm lẫn ID
router.get('/report/shift', transactionController.getShiftReport);

router.post('/test-printer', transactionController.testPrinter);
router.post('/print-network', transactionController.printNetwork);

router.route('/:materialId')
  .get(transactionController.getTransactionsByMaterial);

router.route('/')
  .post(transactionController.createTransaction);

router.route('/detail/:id')
  .put(transactionController.updateTransaction)
  .delete(transactionController.deleteTransaction);

module.exports = router;