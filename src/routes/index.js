const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const areaController = require('../controllers/area.controller');
const folderController = require('../controllers/folder.controller');
const projectController = require('../controllers/project.controller');
const cardController = require('../controllers/card.controller');
const { searchController, dashboardController, syncController, aiController } = require('../controllers/misc.controller');

const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');

const { registerSchema, loginSchema, refreshTokenSchema, updateProfileSchema, changePasswordSchema } = require('../dto/auth.dto');
const { areaSchema, folderSchema, projectSchema, cardSchema, checklistUpdateSchema, convertToTaskSchema, convertToNoteSchema } = require('../dto/validation.dto');

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
router.get('/projects/:id', authenticate, projectController.getById);
router.post('/projects', authenticate, validate(projectSchema), projectController.create);
router.put('/projects/:id', authenticate, projectController.update);
router.delete('/projects/:id', authenticate, projectController.delete);

// CARD ROUTES
router.get('/cards', authenticate, cardController.getAll);
router.get('/cards/:id', authenticate, cardController.getById);
router.post('/cards', authenticate, validate(cardSchema), cardController.create);
router.put('/cards/:id', authenticate, cardController.update);
router.delete('/cards/:id', authenticate, cardController.delete);
router.post('/cards/:id/move', authenticate, cardController.move);

// Get cards by folder
router.get('/folders/:folderId/cards', authenticate, cardController.getByFolder);

// CHECKLIST ROUTES
router.put('/cards/:cardId/checklist', authenticate, validate(checklistUpdateSchema), cardController.updateChecklist);

// CONVERT ROUTES - Chuyển đổi Note <-> Task
router.post('/cards/:id/convert-to-task', authenticate, validate(convertToTaskSchema), cardController.convertToTask);
router.post('/cards/:id/convert-to-note', authenticate, validate(convertToNoteSchema), cardController.convertToNote);

// SEARCH
router.get('/search', authenticate, searchController.search);

// DASHBOARD
router.get('/dashboard/energy-overview', authenticate, dashboardController.getEnergyOverview);
router.get('/dashboard/stats', authenticate, dashboardController.getStats);

// SYNC
router.get('/sync', authenticate, syncController.sync);

// AI
router.get('/ai/health', aiController.healthCheck);
router.post('/ai/analyze-card', authenticate, aiController.analyzeCard);
router.post('/ai/classify-note', authenticate, aiController.classifyNote);
router.post('/ai/auto-organize/:cardId', authenticate, aiController.autoOrganizeNote);

module.exports = router;