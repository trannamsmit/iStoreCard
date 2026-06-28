const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/login', userController.login);
router.post('/clear-all', userController.clearAllData);
router.post('/backup', userController.backupData);
router.get('/backups', userController.getBackups);
router.post('/restore', userController.restoreData);
router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.delete('/:id', userController.deleteUser);
router.put('/:id', userController.updateUser);
router.post('/reset-password/:id', userController.resetPassword);
router.post('/change-password', userController.changePassword);

module.exports = router;