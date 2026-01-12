const folderService = require('../services/folder.service');

class FolderController {
  async getAll(req, res) {
    try {
      const filters = {
        areaId: req.query.areaId,
        parentId: req.query.parentId
      };
      const folders = await folderService.getAll(req.userId, filters);
      res.json(folders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const folder = await folderService.getById(req.params.id, req.userId);
      res.json(folder);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const folder = await folderService.create(req.userId, req.body);
      res.status(201).json(folder);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const folder = await folderService.update(req.params.id, req.userId, req.body);
      res.json(folder);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await folderService.delete(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async verifyAccess(req, res) {
    try {
      const { password } = req.body;
      const result = await folderService.verifyAccess(req.params.id, req.userId, password);
      res.json({ hasAccess: result.hasAccess });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
}

module.exports = new FolderController();