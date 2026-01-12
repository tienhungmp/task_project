const cardService = require('../services/card.service');

class CardController {
  async getAll(req, res) {
    try {
      const { projectId, folderId, areaId, status, isArchived, search, page = 1, limit = 20 } = req.query;
      const filters = { projectId, folderId, areaId, status, isArchived, search };
      
      const result = await cardService.getAll(
        req.userId,
        filters,
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
      const card = await cardService.getById(req.params.id, req.userId);
      res.json(card);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const card = await cardService.create(req.userId, req.body);
      res.status(201).json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const card = await cardService.update(req.params.id, req.userId, req.body);
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await cardService.delete(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async move(req, res) {
    try {
      const { targetProjectId } = req.body;
      const card = await cardService.move(req.params.id, req.userId, targetProjectId);
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateBlocks(req, res) {
    try {
      const { blocks } = req.body;
      const card = await cardService.updateBlocks(req.params.cardId, req.userId, blocks);
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CardController();