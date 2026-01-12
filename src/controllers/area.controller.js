const areaService = require('../services/area.service');

class AreaController {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await areaService.getAll(req.userId, parseInt(page), parseInt(limit));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const area = await areaService.getById(req.params.id, req.userId);
      res.json(area);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const area = await areaService.create(req.userId, req.body);
      res.status(201).json(area);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const area = await areaService.update(req.params.id, req.userId, req.body);
      res.json(area);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await areaService.delete(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
}

module.exports = new AreaController();