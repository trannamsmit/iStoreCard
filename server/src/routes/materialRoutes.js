const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');

router.route('/')
  .get(materialController.getMaterials)
  .post(materialController.createMaterial);

router.route('/upload')
  .post(materialController.uploadMaterials);

router.route('/delete-multiple')
  .post(materialController.deleteMultipleMaterials);

router.route('/search')
  .get(materialController.searchMaterials);

router.route('/:id')
  .get(materialController.getMaterialById)
  .put(materialController.updateMaterial)
  .delete(materialController.deleteMaterial);

module.exports = router;