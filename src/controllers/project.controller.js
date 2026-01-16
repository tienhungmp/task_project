const projectService = require('../services/project.service');

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
      const project = await projectService.update(req.params.id, req.userId, req.body);
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
}

module.exports = new ProjectController();