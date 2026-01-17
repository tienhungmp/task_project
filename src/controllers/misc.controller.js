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
   * POST /api/ai/suggest-project
   * Gọi AI để đề xuất project info + tasks (CHƯA TẠO trong DB)
   * Body: { projectDescription: string }
   */
  async suggestProject(req, res) {
    try {
      const { projectDescription } = req.body;

      if (!projectDescription || projectDescription.trim().length < 20) {
        return res.status(400).json({ 
          error: 'Project description is required (minimum 20 characters)' 
        });
      }

      const result = await aiService.suggestProjectWithAI(
        req.userId,
        projectDescription
      );
      
      res.json({
        success: true,
        suggestions: result
      });
    } catch (error) {
      console.error('suggestProject error:', error);

      if (error.message.includes('AI service is unavailable')) {
        return res.status(503).json({ 
          error: 'AI service is currently unavailable',
          detail: 'Please ensure the AI backend is running on port 8000'
        });
      }

      res.status(500).json({ 
        error: error.message,
        detail: 'Failed to get AI suggestions'
      });
    }
  }

  /**
   * POST /api/ai/create-project
   * Tạo project + tasks thật trong DB từ AI suggestions
   * Body: { 
   *   areaId: ObjectId,
   *   project: { name, description, color, icon, energyLevel, estimatedDurationDays },
   *   tasks: [{ taskText, estimatedTimeMinutes, priority, status, energyLevel, suggestedTopic, order }]
   * }
   */
  async createProjectFromSuggestions(req, res) {
    try {
      const { areaId, project, tasks } = req.body;

      if (!areaId) {
        return res.status(400).json({ 
          error: 'areaId is required' 
        });
      }

      if (!project || !project.name) {
        return res.status(400).json({ 
          error: 'project object with name is required' 
        });
      }

      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ 
          error: 'tasks array is required and must not be empty' 
        });
      }

      const result = await aiService.createProjectFromSuggestions(
        req.userId,
        areaId,
        project,
        tasks
      );
      
      res.status(201).json({
        success: true,
        project: result.project,
        tasks: result.tasks,
        metadata: result.metadata
      });
    } catch (error) {
      console.error('createProjectFromSuggestions error:', error);

      if (error.message === 'Area not found') {
        return res.status(404).json({ 
          error: 'Area not found',
          detail: 'The specified area does not exist or you do not have access to it'
        });
      }

      res.status(500).json({ 
        error: error.message,
        detail: 'Failed to create project from suggestions'
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