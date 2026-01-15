const cardService = require('../services/card.service');
const dashboardService = require('../services/dashboard.service');
const syncService = require('../services/sync.service');
const aiService = require('../services/ai.service');

// ==================== SEARCH CONTROLLER ====================
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

// ==================== DASHBOARD CONTROLLER ====================
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

// ==================== SYNC CONTROLLER ====================
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

// ==================== AI CONTROLLER ====================
class AIController {
  /**
   * POST /api/ai/analyze-card
   * Phân tích nội dung card và đề xuất metadata
   * Body: { content: string, attachments: [] }
   */
  async analyzeCard(req, res) {
    try {
      const { content, attachments = [] } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Content is required and must not be empty' 
        });
      }

      const analysis = await aiService.analyzeCard(content, attachments);
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error('analyzeCard error:', error);
      
      // Handle AI service unavailable
      if (error.message.includes('AI service is unavailable')) {
        return res.status(503).json({ 
          error: 'AI service is currently unavailable',
          detail: 'Please ensure the AI backend is running on port 8000'
        });
      }

      res.status(500).json({ 
        error: error.message,
        detail: 'Failed to analyze card content'
      });
    }
  }

  /**
   * POST /api/ai/classify-note
   * Phân loại note và đề xuất Area/Folder/Tags
   * Body: { content: string, title: string, tags: [] }
   */
  async classifyNote(req, res) {
    try {
      const { content, title = '', tags = [] } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Content is required and must not be empty' 
        });
      }

      const classification = await aiService.classifyNote(
        req.userId,
        content,
        title,
        tags
      );
      
      res.json({
        success: true,
        classification
      });
    } catch (error) {
      console.error('classifyNote error:', error);
      
      if (error.message.includes('AI service is unavailable')) {
        return res.status(503).json({ 
          error: 'AI service is currently unavailable',
          detail: 'Please ensure the AI backend is running on port 8000'
        });
      }

      res.status(500).json({ 
        error: error.message,
        detail: 'Failed to classify note'
      });
    }
  }

  /**
   * POST /api/ai/auto-organize/:cardId
   * Tự động organize note dựa trên AI classification
   * Chỉ apply nếu confidence >= 0.75
   */
  async autoOrganizeNote(req, res) {
    try {
      const { cardId } = req.params;

      if (!cardId) {
        return res.status(400).json({ 
          error: 'cardId parameter is required' 
        });
      }

      const result = await aiService.autoOrganizeNote(req.userId, cardId);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('autoOrganizeNote error:', error);

      // Handle card not found
      if (error.message === 'Card not found') {
        return res.status(404).json({ 
          error: 'Card not found',
          detail: 'The specified card does not exist or you do not have access to it'
        });
      }

      if (error.message.includes('AI service is unavailable')) {
        return res.status(503).json({ 
          error: 'AI service is currently unavailable',
          detail: 'Please ensure the AI backend is running on port 8000'
        });
      }

      res.status(500).json({ 
        error: error.message,
        detail: 'Failed to auto-organize note'
      });
    }
  }

  /**
   * GET /api/ai/health
   * Health check cho AI service
   */
  async healthCheck(req, res) {
    try {
      const axios = require('axios');
      const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000';
      
      const response = await axios.get(`${AI_BACKEND_URL}/health`, {
        timeout: 5000
      });

      res.json({
        success: true,
        aiBackend: {
          status: 'healthy',
          url: AI_BACKEND_URL,
          ...response.data
        }
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        aiBackend: {
          status: 'unavailable',
          url: process.env.AI_BACKEND_URL || 'http://localhost:8000',
          error: error.message
        }
      });
    }
  }
}

module.exports = {
  searchController: new SearchController(),
  dashboardController: new DashboardController(),
  syncController: new SyncController(),
  aiController: new AIController()
};