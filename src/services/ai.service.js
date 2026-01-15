const axios = require('axios');
const Area = require('../models/Area');
const Folder = require('../models/Folder');
const Card = require('../models/Card');

/**
 * AI Service tích hợp với Python FastAPI backend
 * Backend AI tự động đề xuất projects và topics dựa trên nội dung
 */
class AIService {
  constructor() {
    // URL của Python AI backend
    this.AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000';
    this.ANALYZE_ENDPOINT = `${this.AI_BACKEND_URL}/api/analyze`;
    this.TIMEOUT = 30000; // 30 seconds
  }

  /**
   * Gọi AI backend để phân tích nội dung và trích xuất tasks
   */
  async callAIBackend(text, userId = null) {
    try {
      const response = await axios.post(
        this.ANALYZE_ENDPOINT,
        {
          text: text,
          user_id: userId
        },
        {
          timeout: this.TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error('AI backend returned unsuccessful response');
      }

      return response.data;
    } catch (error) {
      console.error('AI Backend Error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AI service is unavailable. Please ensure the AI backend is running.');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(`AI Error: ${error.response.data.detail}`);
      }
      
      throw new Error(`Failed to analyze content: ${error.message}`);
    }
  }

  /**
   * NEW API: Phân tích nội dung card
   * POST /api/ai/analyze-card
   * Body: { content: string, attachments: [] }
   */
  async analyzeCard(content, attachments = []) {
    try {
      // Gọi AI backend
      const aiResponse = await this.callAIBackend(content);

      // Extract thông tin từ response
      const tasks = aiResponse.tasks || [];
      const metadata = aiResponse.metadata || {};

      if (tasks.length === 0) {
        return {
          suggestedTags: [],
          suggestedProject: null,
          suggestedTopic: null,
          energyLevel: 'medium',
          estimatedTime: 30,
          aiTasks: [],
          projectsSuggested: [],
          topicsSuggested: [],
          processingTime: 0,
          tokensUsed: 0,
          tasksExtracted: 0
        };
      }

      // Lấy tất cả suggestions từ các tasks
      const allProjects = tasks.map(t => t.suggested_project);
      const allTopics = tasks.map(t => t.suggested_topic);
      
      // Đếm frequency để chọn suggestion phổ biến nhất
      const projectCounts = this._countFrequency(allProjects);
      const topicCounts = this._countFrequency(allTopics);

      const mostCommonProject = this._getMostCommon(projectCounts);
      const mostCommonTopic = this._getMostCommon(topicCounts);

      // Extract tags từ topics (unique)
      const suggestedTags = [...new Set(allTopics)].slice(0, 5);

      // Tính average time và priority
      const avgTime = tasks.length > 0
        ? Math.round(tasks.reduce((sum, t) => sum + t.estimated_time_minutes, 0) / tasks.length)
        : 30;

      const priorityCounts = this._countFrequency(tasks.map(t => t.priority));
      const dominantPriority = this._getMostCommon(priorityCounts) || 'Medium';

      // Map sang energy level (High priority -> high energy)
      const energyLevel = dominantPriority === 'High' ? 'high' 
                        : dominantPriority === 'Low' ? 'low' 
                        : 'medium';

      return {
        // Suggestions cho user
        suggestedTags,
        suggestedProject: mostCommonProject,
        suggestedTopic: mostCommonTopic,
        energyLevel,
        estimatedTime: avgTime,
        
        // Raw AI response để debug
        aiTasks: tasks,
        projectsSuggested: metadata.projects_discovered || [],
        topicsSuggested: metadata.topics_discovered || [],
        
        // Metadata
        processingTime: aiResponse.processing_time_ms,
        tokensUsed: metadata.tokens_used,
        tasksExtracted: tasks.length
      };
    } catch (error) {
      console.error('analyzeCard error:', error.message);
      throw error;
    }
  }

  /**
   * NEW API: Phân loại note và đề xuất Area/Folder
   * POST /api/ai/classify-note
   * Body: { content: string, title: string, tags: [] }
   */
  async classifyNote(userId, content, title = '', tags = []) {
    try {
      // Kết hợp title và content để phân tích
      const textToAnalyze = `${title}\n\n${content}`.trim();

      // Gọi AI để phân tích
      const aiResponse = await this.callAIBackend(textToAnalyze, userId);
      const tasks = aiResponse.tasks || [];
      const metadata = aiResponse.metadata || {};

      if (tasks.length === 0) {
        return {
          topic: 'general',
          confidence: 0.5,
          suggestedArea: null,
          suggestedFolder: null,
          suggestedTags: tags,
          aiProjectsSuggested: [],
          aiTopicsSuggested: [],
          tasksExtracted: [],
          reasoning: {
            topic: 'general',
            confidenceLevel: 'low',
            explanation: 'No tasks could be extracted from the content',
            projectsSuggested: [],
            topicsSuggested: [],
            suggestedAction: 'Manual review suggested'
          }
        };
      }

      // Lấy suggestions từ AI
      const aiProjects = metadata.projects_discovered || [];
      const aiTopics = metadata.topics_discovered || [];

      // Lấy dữ liệu thực tế của user từ DB
      const [userAreas, userFolders] = await Promise.all([
        Area.find({ userId }).lean(),
        Folder.find({ userId }).lean()
      ]);

      // Map AI suggestions với dữ liệu thực
      const suggestedArea = this._findBestMatchingArea(
        aiProjects, 
        aiTopics, 
        userAreas
      );

      const suggestedFolder = suggestedArea 
        ? this._findBestMatchingFolder(aiProjects, aiTopics, userFolders, suggestedArea._id)
        : null;

      // Tính confidence dựa trên số tasks và độ nhất quán
      const priorityCounts = this._countFrequency(tasks.map(t => t.priority));
      const dominantPriority = this._getMostCommon(priorityCounts);
      const priorityConsistency = priorityCounts[dominantPriority] / tasks.length;
      
      const confidence = Math.min(0.95, 0.5 + (priorityConsistency * 0.3) + (tasks.length * 0.05));

      // Determine topic dựa trên AI suggestions
      const topicCounts = this._countFrequency(aiTopics);
      const detectedTopic = this._getMostCommon(topicCounts) || 'general';

      // Extract unique tags
      const allTags = [...new Set([...tags, ...aiTopics])].slice(0, 5);

      return {
        // Classification results
        topic: detectedTopic,
        confidence: parseFloat(confidence.toFixed(2)),
        
        // Suggestions
        suggestedArea: suggestedArea ? {
          _id: suggestedArea._id,
          name: suggestedArea.name,
          color: suggestedArea.color,
          icon: suggestedArea.icon
        } : null,
        
        suggestedFolder: suggestedFolder ? {
          _id: suggestedFolder._id,
          name: suggestedFolder.name,
          color: suggestedFolder.color,
          icon: suggestedFolder.icon
        } : null,
        
        suggestedTags: allTags,
        
        // AI raw data
        aiProjectsSuggested: aiProjects,
        aiTopicsSuggested: aiTopics,
        tasksExtracted: tasks,
        
        // Reasoning
        reasoning: this._generateReasoning(
          detectedTopic, 
          confidence, 
          tasks.length,
          aiProjects,
          aiTopics
        )
      };
    } catch (error) {
      console.error('classifyNote error:', error.message);
      throw error;
    }
  }

  /**
   * NEW API: Tự động organize note
   * POST /api/ai/auto-organize/:cardId
   */
  async autoOrganizeNote(userId, cardId) {
    try {
      // Lấy card
      const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
      if (!card) {
        throw new Error('Card not found');
      }

      // Classify note
      const classification = await this.classifyNote(
        userId,
        card.content,
        card.title,
        card.tags
      );

      // Chỉ auto-organize nếu confidence >= 0.75
      if (classification.confidence >= 0.75) {
        const updates = {};

        // Update area nếu có suggestion
        if (classification.suggestedArea) {
          updates.areaId = classification.suggestedArea._id;
        }

        // Update folder nếu có suggestion
        if (classification.suggestedFolder) {
          updates.folderId = classification.suggestedFolder._id;
        }

        // Merge tags
        if (classification.suggestedTags.length > 0) {
          updates.tags = [...new Set([...card.tags, ...classification.suggestedTags])];
        }

        // Apply updates nếu có gì để update
        if (Object.keys(updates).length > 0) {
          await Card.findByIdAndUpdate(cardId, updates);
        }

        return {
          ...classification,
          autoOrganized: true,
          applied: {
            area: classification.suggestedArea?.name || null,
            folder: classification.suggestedFolder?.name || null,
            tags: updates.tags || card.tags
          }
        };
      }

      // Confidence thấp - không auto organize
      return {
        ...classification,
        autoOrganized: false,
        message: 'Confidence too low for auto-organization. Manual review recommended.'
      };
    } catch (error) {
      console.error('autoOrganizeNote error:', error.message);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Đếm frequency của các items trong array
   */
  _countFrequency(items) {
    const counts = {};
    items.forEach(item => {
      if (item) {
        counts[item] = (counts[item] || 0) + 1;
      }
    });
    return counts;
  }

  /**
   * Lấy item phổ biến nhất
   */
  _getMostCommon(counts) {
    if (Object.keys(counts).length === 0) return null;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Tìm Area phù hợp nhất dựa trên AI suggestions
   */
  _findBestMatchingArea(aiProjects, aiTopics, userAreas) {
    if (userAreas.length === 0) return null;

    // Kết hợp projects và topics để tìm kiếm
    const searchTerms = [...aiProjects, ...aiTopics]
      .filter(Boolean)
      .map(t => t.toLowerCase());

    if (searchTerms.length === 0) return userAreas[0];

    // Tìm area có tên khớp
    for (const term of searchTerms) {
      const match = userAreas.find(area => {
        const areaName = area.name.toLowerCase();
        return areaName.includes(term) || term.includes(areaName);
      });
      if (match) return match;
    }

    // Fallback: trả về area đầu tiên
    return userAreas[0];
  }

  /**
   * Tìm Folder phù hợp nhất trong Area
   */
  _findBestMatchingFolder(aiProjects, aiTopics, userFolders, areaId) {
    const foldersInArea = userFolders.filter(f => 
      f.areaId.toString() === areaId.toString()
    );

    if (foldersInArea.length === 0) return null;

    const searchTerms = [...aiProjects, ...aiTopics]
      .filter(Boolean)
      .map(t => t.toLowerCase());

    if (searchTerms.length === 0) return foldersInArea[0];

    // Tìm folder có tên khớp
    for (const term of searchTerms) {
      const match = foldersInArea.find(folder => {
        const folderName = folder.name.toLowerCase();
        return folderName.includes(term) || term.includes(folderName);
      });
      if (match) return match;
    }

    // Fallback: trả về folder đầu tiên trong area
    return foldersInArea[0];
  }

  /**
   * Generate reasoning text
   */
  _generateReasoning(topic, confidence, taskCount, aiProjects, aiTopics) {
    const confidenceLevel = confidence >= 0.85 ? 'high' : confidence >= 0.75 ? 'medium' : 'low';

    const topicsList = aiTopics.filter(Boolean).join(', ') || 'general topics';
    const projectsList = aiProjects.filter(Boolean).join(', ') || 'general projects';

    return {
      topic,
      confidenceLevel,
      explanation: `AI detected ${taskCount} task(s) related to: ${topicsList}`,
      projectsSuggested: aiProjects.filter(Boolean),
      topicsSuggested: aiTopics.filter(Boolean),
      suggestedAction: confidence >= 0.75 
        ? 'Auto-organize recommended' 
        : 'Manual review suggested'
    };
  }
}

module.exports = new AIService();