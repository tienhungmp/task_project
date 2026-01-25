const projectService = require("../services/project.service");

class ProjectController {
  async getAll(req, res) {
    try {
      const { areaId, page = 1, limit = 20 } = req.query;
      const result = await projectService.getAll(
        req.userId,
        areaId,
        parseInt(page),
        parseInt(limit)
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const project = await projectService.getById(req.params.id, req.userId);
      res.json(project);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const project = await projectService.create(req.userId, req.body);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const project = await projectService.update(
        req.params.id,
        req.userId,
        req.body
      );
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await projectService.delete(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * POST /api/projects/:id/share
   * Share project với user khác (view-only)
   * Body: { email: string }
   */
  async shareWithUser(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: "Email is required",
        });
      }

      const result = await projectService.shareWithUser(
        req.params.id,
        req.userId,
        email
      );

      res.json(result);
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("permission")
      ) {
        return res.status(404).json({ error: error.message });
      }
      if (
        error.message.includes("already shared") ||
        error.message.includes("yourself")
      ) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/projects/:id/share/:userId
   * Unshare project
   */
  async unshareWithUser(req, res) {
    try {
      const result = await projectService.unshareWithUser(
        req.params.id,
        req.userId,
        req.params.userId
      );

      res.json(result);
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("permission")
      ) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/projects/:id/shares
   * Lấy danh sách users được share
   */
  async getSharedUsers(req, res) {
    try {
      const result = await projectService.getSharedUsers(
        req.params.id,
        req.userId
      );

      res.json(result);
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access")
      ) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/projects/:id/share/public
   * Generate public share link
   */
  async generateShareLink(req, res) {
    try {
      const result = await projectService.generateShareLink(
        req.params.id,
        req.userId
      );

      res.json(result);
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("permission")
      ) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/projects/:id/share/public
   * Revoke public share link
   */
  async revokeShareLink(req, res) {
    try {
      const result = await projectService.revokeShareLink(
        req.params.id,
        req.userId
      );

      res.json(result);
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("permission")
      ) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/shared/projects/:token
   * Get project by public share token (NO AUTH REQUIRED)
   */
  async getByShareToken(req, res) {
    try {
      const project = await projectService.getByShareToken(req.params.token);
      res.json(project);
    } catch (error) {
      if (
        error.message.includes("Invalid") ||
        error.message.includes("expired")
      ) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/projects/shared/with-me
   * Lấy danh sách projects được chia sẻ với user
   */
  async getSharedWithMe(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await projectService.getSharedWithMe(
        req.userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ProjectController();
