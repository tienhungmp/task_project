const express = require('express');
const router = express.Router();
const checkProjectPermission = require('../middleware/checkProjectPermission');

const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const areaController = require('../controllers/area.controller');
const folderController = require('../controllers/folder.controller');
const projectController = require('../controllers/project.controller');
const cardController = require('../controllers/card.controller');
const notificationController = require('../controllers/notification.controller');
const { searchController, dashboardController, syncController, aiController } = require('../controllers/misc.controller');

const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');

const { registerSchema, loginSchema, refreshTokenSchema, updateProfileSchema, changePasswordSchema } = require('../dto/auth.dto');
const { areaSchema, folderSchema, projectSchema, cardSchema, checklistUpdateSchema, convertToTaskSchema, convertToNoteSchema, blocksSortPreferenceSchema } = require('../dto/validation.dto');

const statsController = require('../controllers/stats.controller');

// AUTH ROUTES
router.post('/auth/register', upload.single('avatar'), validate(registerSchema), authController.register);
router.post('/auth/login', validate(loginSchema), authController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);

// USER ROUTES
router.get('/user/profile', authenticate, userController.getProfile);
router.put('/user/profile', authenticate, validate(updateProfileSchema), userController.updateProfile);
router.put('/user/avatar', authenticate, upload.single('avatar'), userController.updateAvatar);
router.put('/user/password', authenticate, validate(changePasswordSchema), userController.changePassword);

// AREA ROUTES
router.get('/areas', authenticate, areaController.getAll);
router.get('/areas/:id', authenticate, areaController.getById);
router.post('/areas', authenticate, validate(areaSchema), areaController.create);
router.put('/areas/:id', authenticate, validate(areaSchema), areaController.update);
router.delete('/areas/:id', authenticate, areaController.delete);

// FOLDER ROUTES
router.get('/folders', authenticate, folderController.getAll);
router.get('/folders/:id', authenticate, folderController.getById);
router.post('/folders', authenticate, validate(folderSchema), folderController.create);
router.put('/folders/:id', authenticate, folderController.update);
router.delete('/folders/:id', authenticate, folderController.delete);
router.post('/folders/:id/access', authenticate, folderController.verifyAccess);

// PROJECT ROUTES
router.get('/projects', authenticate, projectController.getAll);
router.post('/projects', authenticate, validate(projectSchema), projectController.create);
router.put('/projects/:id', authenticate, checkProjectPermission('owner'), projectController.update);
router.delete('/projects/:id', authenticate, checkProjectPermission('owner'), projectController.delete);
router.post('/projects/:id/share', authenticate, checkProjectPermission('owner'), projectController.shareWithUser);
router.delete('/projects/:id/share/:userId', authenticate, checkProjectPermission('owner'), projectController.unshareWithUser);
router.post('/projects/:id/share/public', authenticate, checkProjectPermission('owner'), projectController.generateShareLink);
router.delete('/projects/:id/share/public', authenticate, checkProjectPermission('owner'), projectController.revokeShareLink);

// Routes chỉ cần view permission
router.get('/projects/:id', authenticate, checkProjectPermission('view'), projectController.getById);
router.get('/projects/:id/shares', authenticate, checkProjectPermission('view'), projectController.getSharedUsers);
router.get('/shared/projects/:token', projectController.getByShareToken);

// CARD ROUTES
router.get('/cards', authenticate, cardController.getAll);
router.get('/cards/:id', authenticate, cardController.getById);
router.post('/cards', authenticate, validate(cardSchema), cardController.create);
router.put('/cards/:id', authenticate, cardController.update);
router.delete('/cards/:id', authenticate, cardController.delete);
router.post('/cards/:id/move', authenticate, cardController.move);
router.get('/folders/:folderId/cards', authenticate, cardController.getByFolder);
router.put('/cards/:cardId/checklist', authenticate, validate(checklistUpdateSchema), cardController.updateChecklist);
router.post('/cards/:id/convert-to-task', authenticate, validate(convertToTaskSchema), cardController.convertToTask);
router.post('/cards/:id/convert-to-note', authenticate, validate(convertToNoteSchema), cardController.convertToNote);
router.post('/cards/:id/blocks/:blockId/pin', authenticate, cardController.pinBlock);
router.delete('/cards/:id/blocks/:blockId/pin', authenticate, cardController.unpinBlock);
router.patch('/cards/:id/blocks/:blockId/toggle-pin', authenticate, cardController.togglePinBlock);
router.put('/cards/:id/blocks/sort-preference', authenticate, validate(blocksSortPreferenceSchema), cardController.updateBlocksSortPreference);
router.get('/cards/:id/blocks/sorted', authenticate, cardController.getBlocksSorted);
// Block operations - OPTIMIZED UPLOAD
// NEW: Tạo block + upload file trong 1 request
router.post('/cards/:id/blocks/with-file', authenticate, upload.single('file'), cardController.addBlockWithFile);

// NEW: Update block file (replace file cũ)
router.put('/cards/:id/blocks/:blockId/file', authenticate, upload.single('file'), cardController.updateBlockFile);

// Block operations
router.post('/cards/:id/blocks', authenticate, cardController.addBlock);
router.put('/cards/:id/blocks/:blockId', authenticate, cardController.updateBlock);
router.delete('/cards/:id/blocks/:blockId', authenticate, cardController.deleteBlock);
router.put('/cards/:id/blocks/reorder', authenticate, cardController.reorderBlocks);
router.put('/cards/:id/blocks', authenticate, cardController.updateAllBlocks);
router.post('/cards/blocks/upload', authenticate, upload.single('file'), cardController.uploadBlockFile);

// NOTIFICATION ROUTES
router.get('/notifications', authenticate, notificationController.getAll);
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadCount);
router.put('/notifications/:id/read', authenticate, notificationController.markAsRead);
router.put('/notifications/read-all', authenticate, notificationController.markAllAsRead);
router.delete('/notifications/:id', authenticate, notificationController.delete);
router.delete('/notifications/read', authenticate, notificationController.deleteAllRead);
router.post('/notifications/scan', authenticate, notificationController.triggerScan); // For testing/admin

// SEARCH
router.get('/search', authenticate, searchController.search);

// DASHBOARD
router.get('/dashboard/energy-overview', authenticate, dashboardController.getEnergyOverview);
router.get('/dashboard/stats', authenticate, dashboardController.getStats);

// STATISTICS - Thống kê chi tiết
router.get('/stats/overview', authenticate, statsController.getOverview);
router.get('/stats/daily', authenticate, statsController.getDailyStats);
router.get('/stats/weekly', authenticate, statsController.getWeeklyStats);
router.get('/stats/monthly', authenticate, statsController.getMonthlyStats);
router.get('/stats/yearly', authenticate, statsController.getYearlyStats);
router.get('/stats/range', authenticate, statsController.getRangeStats);
router.get('/stats/trends', authenticate, statsController.getTrends);

// SYNC
router.get('/sync', authenticate, syncController.sync);

// AI ROUTES
router.get('/ai/health', aiController.healthCheck);
router.post('/ai/analyze-card', authenticate, aiController.analyzeCard);
router.post('/ai/classify-note', authenticate, aiController.classifyNote);
router.post('/ai/auto-organize/:cardId', authenticate, aiController.autoOrganizeNote);

// NEW: Quick Note - Tạo note nhanh từ text
router.post('/ai/quick-note', authenticate, aiController.quickNote);

router.post('/ai/suggest-folder', authenticate, aiController.suggestFolder);

// NEW: Smart Organize - Phân loại thông minh dựa trên folders/areas có sẵn
router.post('/ai/smart-organize/:cardId', authenticate, aiController.smartOrganize);

// AI Project Creation - 2 bước
router.post('/ai/suggest-project', authenticate, aiController.suggestProject); // Bước 1: Lấy đề xuất từ AI
router.post('/ai/create-project', authenticate, aiController.createProjectFromSuggestions); // Bước 2: Tạo thật vào DB

module.exports = router;