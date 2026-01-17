const axios = require('axios');
const Area = require('../models/Area');
const Folder = require('../models/Folder');
const Card = require('../models/Card');
const Project = require('../models/Project');

/**
 * AI Service tích hợp với Python FastAPI backend
 * Hỗ trợ: analyze, classify, auto-organize, CREATE PROJECT
 */
class AIService {
  constructor() {
    this.AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000';
    this.ANALYZE_ENDPOINT = `${this.AI_BACKEND_URL}/api/analyze`;
    this.CREATE_PROJECT_ENDPOINT = `${this.AI_BACKEND_URL}/api/create-project`;
    this.TIMEOUT = 30000;
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
   * Gọi AI backend để tạo project với tasks
   */
  async callCreateProjectAI(projectDescription, userId = null) {
    try {
      const response = await axios.post(
        this.CREATE_PROJECT_ENDPOINT,
        {
          project_description: projectDescription,
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
      console.error('AI Create Project Error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AI service is unavailable. Please ensure the AI backend is running.');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(`AI Error: ${error.response.data.detail}`);
      }
      
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  /**
   * Phân tích nội dung card
   */
  async analyzeCard(content, attachments = []) {
    try {
      const aiResponse = await this.callAIBackend(content);
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

      const allProjects = tasks.map(t => t.suggested_project);
      const allTopics = tasks.map(t => t.suggested_topic);
      
      const projectCounts = this._countFrequency(allProjects);
      const topicCounts = this._countFrequency(allTopics);

      const mostCommonProject = this._getMostCommon(projectCounts);
      const mostCommonTopic = this._getMostCommon(topicCounts);

      const suggestedTags = [...new Set(allTopics)].slice(0, 5);

      const avgTime = tasks.length > 0
        ? Math.round(tasks.reduce((sum, t) => sum + t.estimated_time_minutes, 0) / tasks.length)
        : 30;

      const priorityCounts = this._countFrequency(tasks.map(t => t.priority));
      const dominantPriority = this._getMostCommon(priorityCounts) || 'Medium';

      const energyLevel = dominantPriority === 'High' ? 'high' 
                        : dominantPriority === 'Low' ? 'low' 
                        : 'medium';

      return {
        suggestedTags,
        suggestedProject: mostCommonProject,
        suggestedTopic: mostCommonTopic,
        energyLevel,
        estimatedTime: avgTime,
        aiTasks: tasks,
        projectsSuggested: metadata.projects_discovered || [],
        topicsSuggested: metadata.topics_discovered || [],
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
   * Phân loại note và đề xuất Area/Folder
   */
  async classifyNote(userId, content, title = '', tags = []) {
    try {
      const textToAnalyze = `${title}\n\n${content}`.trim();
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

      const aiProjects = metadata.projects_discovered || [];
      const aiTopics = metadata.topics_discovered || [];

      const [userAreas, userFolders] = await Promise.all([
        Area.find({ userId }).lean(),
        Folder.find({ userId }).lean()
      ]);

      const suggestedArea = this._findBestMatchingArea(aiProjects, aiTopics, userAreas);
      const suggestedFolder = suggestedArea 
        ? this._findBestMatchingFolder(aiProjects, aiTopics, userFolders, suggestedArea._id)
        : null;

      const priorityCounts = this._countFrequency(tasks.map(t => t.priority));
      const dominantPriority = this._getMostCommon(priorityCounts);
      const priorityConsistency = priorityCounts[dominantPriority] / tasks.length;
      
      const confidence = Math.min(0.95, 0.5 + (priorityConsistency * 0.3) + (tasks.length * 0.05));

      const topicCounts = this._countFrequency(aiTopics);
      const detectedTopic = this._getMostCommon(topicCounts) || 'general';

      const allTags = [...new Set([...tags, ...aiTopics])].slice(0, 5);

      return {
        topic: detectedTopic,
        confidence: parseFloat(confidence.toFixed(2)),
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
        aiProjectsSuggested: aiProjects,
        aiTopicsSuggested: aiTopics,
        tasksExtracted: tasks,
        reasoning: this._generateReasoning(detectedTopic, confidence, tasks.length, aiProjects, aiTopics)
      };
    } catch (error) {
      console.error('classifyNote error:', error.message);
      throw error;
    }
  }

  /**
   * Tự động organize note
   */
  async autoOrganizeNote(userId, cardId) {
    try {
      const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
      if (!card) {
        throw new Error('Card not found');
      }

      const classification = await this.classifyNote(userId, card.content, card.title, card.tags);

      if (classification.confidence >= 0.75) {
        const updates = {};

        if (classification.suggestedArea) {
          updates.areaId = classification.suggestedArea._id;
        }

        if (classification.suggestedFolder) {
          updates.folderId = classification.suggestedFolder._id;
        }

        if (classification.suggestedTags.length > 0) {
          updates.tags = [...new Set([...card.tags, ...classification.suggestedTags])];
        }

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

  /**
   * NEW: Smart Organize - Phân loại thông minh note
   * Tự động:
   * 1. Phân tích nội dung
   * 2. Gợi ý chủ đề/lĩnh vực dựa trên các folders/areas có sẵn
   * 3. Đặt tags phù hợp
   * 4. Chuyển vào folder đúng chủ đề
   * 5. Set area phù hợp
   */
  async smartOrganizeNote(userId, cardId, autoApply = false) {
    try {
      // 1. Lấy card
      const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
      if (!card) {
        throw new Error('Card not found');
      }

      // 2. Lấy tất cả areas và folders của user
      const [userAreas, userFolders] = await Promise.all([
        Area.find({ userId }).lean(),
        Folder.find({ userId }).lean()
      ]);

      // 3. Gọi AI để phân tích
      const textToAnalyze = `${card.title}\n\n${card.content}`.trim();
      const aiResponse = await this.callAIBackend(textToAnalyze, userId);
      const tasks = aiResponse.tasks || [];
      const metadata = aiResponse.metadata || {};

      if (tasks.length === 0) {
        return {
          organized: false,
          reason: 'No meaningful content detected',
          suggestions: {
            tags: card.tags,
            area: null,
            folder: null
          },
          confidence: 0.3
        };
      }

      // 4. Extract AI suggestions
      const aiProjects = metadata.projects_discovered || [];
      const aiTopics = metadata.topics_discovered || [];

      // 5. Tìm area và folder phù hợp nhất
      const suggestedArea = this._findBestMatchingArea(aiProjects, aiTopics, userAreas);
      const suggestedFolder = suggestedArea 
        ? this._findBestMatchingFolder(aiProjects, aiTopics, userFolders, suggestedArea._id)
        : null;

      // 6. Tạo tags từ topics
      const suggestedTags = [...new Set([...card.tags, ...aiTopics])].slice(0, 5);

      // 7. Tính confidence
      const priorityCounts = this._countFrequency(tasks.map(t => t.priority));
      const dominantPriority = this._getMostCommon(priorityCounts);
      const priorityConsistency = priorityCounts[dominantPriority] / tasks.length;
      const confidence = Math.min(0.95, 0.5 + (priorityConsistency * 0.3) + (tasks.length * 0.05));

      // 8. Chuẩn bị suggestions
      const suggestions = {
        area: suggestedArea ? {
          _id: suggestedArea._id,
          name: suggestedArea.name,
          color: suggestedArea.color,
          icon: suggestedArea.icon,
          matchReason: this._explainMatch(aiProjects, aiTopics, suggestedArea.name)
        } : null,
        
        folder: suggestedFolder ? {
          _id: suggestedFolder._id,
          name: suggestedFolder.name,
          color: suggestedFolder.color,
          icon: suggestedFolder.icon,
          areaId: suggestedFolder.areaId,
          matchReason: this._explainMatch(aiProjects, aiTopics, suggestedFolder.name)
        } : null,
        
        tags: suggestedTags,
        
        detectedTopics: aiTopics,
        detectedProjects: aiProjects,
        
        confidence: parseFloat(confidence.toFixed(2))
      };

      // 9. Auto-apply nếu được yêu cầu và confidence đủ cao
      if (autoApply && confidence >= 0.70) {
        const updates = {
          tags: suggestedTags
        };

        if (suggestedArea) {
          updates.areaId = suggestedArea._id;
        }

        if (suggestedFolder) {
          updates.folderId = suggestedFolder._id;
        }

        await Card.findByIdAndUpdate(cardId, updates);

        return {
          organized: true,
          applied: true,
          suggestions,
          changes: {
            area: suggestedArea?.name || 'No change',
            folder: suggestedFolder?.name || 'No change',
            tags: suggestedTags,
            previousTags: card.tags
          },
          confidence,
          message: `Note organized successfully with ${(confidence * 100).toFixed(0)}% confidence`
        };
      }

      // 10. Chỉ trả suggestions nếu không auto-apply
      return {
        organized: false,
        applied: false,
        suggestions,
        confidence,
        message: autoApply 
          ? `Confidence too low (${(confidence * 100).toFixed(0)}%). Manual review recommended.`
          : 'Review suggestions and apply manually'
      };

    } catch (error) {
      console.error('smartOrganizeNote error:', error.message);
      throw error;
    }
  }

  /**
   * Giải thích tại sao match
   */
  _explainMatch(aiProjects, aiTopics, targetName) {
    const allTerms = [...aiProjects, ...aiTopics].filter(Boolean);
    const targetLower = targetName.toLowerCase();
    
    const matchedTerms = allTerms.filter(term => {
      const termLower = term.toLowerCase();
      return targetLower.includes(termLower) || termLower.includes(targetLower);
    });

    if (matchedTerms.length > 0) {
      return `Matched keywords: ${matchedTerms.join(', ')}`;
    }

    return 'Best match based on content analysis';
  }

  /**
   * Gọi AI để đề xuất project (CHƯA TẠO trong DB)
   */
  async suggestProjectWithAI(userId, projectDescription) {
    try {
      // Call AI to get suggestions
      const aiResponse = await this.callCreateProjectAI(projectDescription, userId);

      const { project: projectData, tasks: tasksData, metadata } = aiResponse;

      // Format response để frontend dễ sử dụng
      return {
        project: {
          name: projectData.name,
          description: projectData.description,
          color: projectData.color,
          icon: projectData.icon,
          energyLevel: projectData.energy_level,
          estimatedDurationDays: projectData.estimated_duration_days,
          priority: projectData.priority,
          suggestedArea: projectData.suggested_area
        },
        tasks: tasksData.map(task => ({
          taskText: task.task_text,
          estimatedTimeMinutes: task.estimated_time_minutes,
          priority: task.priority,
          status: task.status,
          energyLevel: task.energy_level,
          suggestedTopic: task.suggested_topic,
          order: task.order
        })),
        metadata: {
          ...metadata,
          totalTasks: tasksData.length,
          totalEstimatedTime: tasksData.reduce((sum, t) => sum + t.estimated_time_minutes, 0)
        }
      };
    } catch (error) {
      console.error('suggestProjectWithAI error:', error.message);
      throw error;
    }
  }

  /**
   * NEW: Tạo project + tasks từ AI suggestions (sau khi user đã chọn lọc)
   */
  async createProjectFromSuggestions(userId, areaId, projectData, tasksData) {
    try {
      // Verify area exists
      const area = await Area.findOne({ _id: areaId, userId });
      if (!area) {
        throw new Error('Area not found');
      }

      // Map energy level
      const energyLevelMap = {
        'low': 'low',
        'medium': 'medium',
        'high': 'high',
        'urgent': 'urgent'
      };

      // Tạo project trong DB
      const project = new Project({
        userId,
        areaId,
        name: projectData.name,
        description: projectData.description || '',
        color: projectData.color || 0,
        icon: projectData.icon || 0,
        energyLevel: energyLevelMap[projectData.energyLevel] || 'medium',
        startDate: new Date(),
        endDate: projectData.estimatedDurationDays 
          ? new Date(Date.now() + projectData.estimatedDurationDays * 24 * 60 * 60 * 1000)
          : null
      });

      await project.save();

      // Map status
      const statusMap = {
        'todo': 'todo',
        'doing': 'doing',
        'done': 'done',
        'pending': 'pending'
      };

      // Tạo tasks trong DB (chỉ những tasks user đã chọn)
      const createdTasks = [];
      for (const taskData of tasksData) {
        const card = new Card({
          userId,
          areaId,
          projectId: project._id,
          title: taskData.taskText,
          content: '',
          tags: taskData.suggestedTopic ? [taskData.suggestedTopic] : [],
          status: statusMap[taskData.status] || 'todo',
          energyLevel: energyLevelMap[taskData.energyLevel] || 'medium',
          dueDate: taskData.order 
            ? new Date(Date.now() + taskData.order * 24 * 60 * 60 * 1000)
            : null
        });

        await card.save();
        createdTasks.push(card);
      }

      return {
        project: project.toJSON(),
        tasks: createdTasks.map(t => t.toJSON()),
        metadata: {
          area: {
            _id: area._id,
            name: area.name
          },
          tasksCreated: createdTasks.length,
          totalTasksSuggested: tasksData.length,
          estimatedDuration: projectData.estimatedDurationDays || null
        }
      };
    } catch (error) {
      console.error('createProjectFromSuggestions error:', error.message);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  _countFrequency(items) {
    const counts = {};
    items.forEach(item => {
      if (item) {
        counts[item] = (counts[item] || 0) + 1;
      }
    });
    return counts;
  }

  _getMostCommon(counts) {
    if (Object.keys(counts).length === 0) return null;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  _findBestMatchingArea(aiProjects, aiTopics, userAreas) {
    if (userAreas.length === 0) return null;

    const searchTerms = [...aiProjects, ...aiTopics]
      .filter(Boolean)
      .map(t => t.toLowerCase());

    if (searchTerms.length === 0) return userAreas[0];

    for (const term of searchTerms) {
      const match = userAreas.find(area => {
        const areaName = area.name.toLowerCase();
        return areaName.includes(term) || term.includes(areaName);
      });
      if (match) return match;
    }

    return userAreas[0];
  }

  _findBestMatchingFolder(aiProjects, aiTopics, userFolders, areaId) {
    const foldersInArea = userFolders.filter(f => 
      f.areaId.toString() === areaId.toString()
    );

    if (foldersInArea.length === 0) return null;

    const searchTerms = [...aiProjects, ...aiTopics]
      .filter(Boolean)
      .map(t => t.toLowerCase());

    if (searchTerms.length === 0) return foldersInArea[0];

    for (const term of searchTerms) {
      const match = foldersInArea.find(folder => {
        const folderName = folder.name.toLowerCase();
        return folderName.includes(term) || term.includes(folderName);
      });
      if (match) return match;
    }

    return foldersInArea[0];
  }

  _generateReasoning(topic, confidence, taskCount, aiProjects, aiTopics) {
    const confidenceLevel = confidence >= 0.85 ? 'high' : confidence >= 0.75 ? 'medium' : 'low';
    const topicsList = aiTopics.filter(Boolean).join(', ') || 'general topics';

    return {
      topic,
      confidenceLevel,
      explanation: `AI detected ${taskCount} task(s) related to: ${topicsList}`,
      projectsSuggested: aiProjects.filter(Boolean),
      topicsSuggested: aiTopics.filter(Boolean),
      suggestedAction: confidence >= 0.75 ? 'Auto-organize recommended' : 'Manual review suggested'
    };
  }
}

module.exports = new AIService();