const Project = require('../models/Project');

/**
 * Middleware để check quyền truy cập project
 * @param {string} requiredPermission - 'owner' hoặc 'view'
 */
const checkProjectPermission = (requiredPermission = 'view') => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.id || req.params.projectId;
      const userId = req.userId;

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const access = project.hasAccess(userId);

      if (!access.hasAccess) {
        return res.status(403).json({ 
          error: 'You do not have access to this project' 
        });
      }

      // Check permission level
      if (requiredPermission === 'owner' && access.permission !== 'owner') {
        return res.status(403).json({ 
          error: 'Only project owner can perform this action' 
        });
      }

      // Attach permission to request
      req.projectPermission = access.permission;
      req.project = project;

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

module.exports = checkProjectPermission;