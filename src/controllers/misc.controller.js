const cardService = require('../services/card.service');
const dashboardService = require('../services/dashboard.service');
const syncService = require('../services/sync.service');
const aiService = require('../services/ai.service');

class SearchController {
  async search(req, res) {
    try {
      const { q, tags, dateFrom, page = 1, limit = 20 } = req.query;
      const tagArray = tags ? (Array.isArray(tags) ? tags : [tags]) : [];
      
      const result = await cardService.search(
        req.userId,
        q,
        tagArray,
        dateFrom,
        parseInt(page),
        parseInt(limit)
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

class DashboardController {
  async getEnergyOverview(req, res) {
    try {
      const overview = await dashboardService.getEnergyOverview(req.userId);
      res.json(overview);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req, res) {
    try {
      const { period = 'week' } = req.query;
      const stats = await dashboardService.getStats(req.userId, period);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

class SyncController {
  async sync(req, res) {
    try {
      const { lastSync } = req.query;
      if (!lastSync) {
        return res.status(400).json({ error: 'lastSync parameter required' });
      }
      
      const updates = await syncService.getUpdates(req.userId, lastSync);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

class AIController {
  async analyzeCard(req, res) {
    try {
      const { content, attachments } = req.body;
      const analysis = await aiService.analyzeCard(content, attachments);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = {
  searchController: new SearchController(),
  dashboardController: new DashboardController(),
  syncController: new SyncController(),
  aiController: new AIController()
};