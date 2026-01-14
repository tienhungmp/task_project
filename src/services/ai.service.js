const Area = require('../models/Area');
const Folder = require('../models/Folder');
const Card = require('../models/Card');

class AIService {
  async analyzeCard(content, attachments = []) {
    // Mock AI analysis for MVP
    const keywords = content.toLowerCase().split(' ');
    const suggestedTags = [];

    if (keywords.some(k => ['meeting', 'call', 'zoom'].includes(k))) {
      suggestedTags.push('meeting');
    }
    if (keywords.some(k => ['urgent', 'asap', 'important'].includes(k))) {
      suggestedTags.push('urgent');
    }
    if (keywords.some(k => ['review', 'check', 'verify'].includes(k))) {
      suggestedTags.push('review');
    }

    const energyLevel = keywords.some(k => ['urgent', 'asap'].includes(k))
      ? 'high'
      : keywords.length > 50
      ? 'medium'
      : 'low';

    const estimatedTime = Math.max(15, Math.min(120, keywords.length * 2));

    return {
      suggestedTags: [...new Set(suggestedTags)],
      suggestedAreaId: null,
      suggestedProjectId: null,
      energyLevel,
      estimatedTime
    };
  }

  async classifyNote(userId, content, title = '', tags = []) {
    // Mock AI classification based on user's existing structure
    const userAreas = await Area.find({ userId }).lean();
    const userFolders = await Folder.find({ userId }).lean();
    const existingCards = await Card.find({ userId }).limit(100).lean();

    // Extract keywords from content
    const text = `${title} ${content}`.toLowerCase();
    const keywords = text.split(/\s+/).filter(w => w.length > 3);

    // Mock topic detection
    let detectedTopic = 'general';
    let confidence = 0;
    const suggestedTags = [...tags];

    // Detect work-related content
    if (this._containsKeywords(text, ['work', 'project', 'client', 'deadline', 'meeting', 'task'])) {
      detectedTopic = 'work';
      confidence = 0.85;
      suggestedTags.push('work');
    }
    // Detect personal content
    else if (this._containsKeywords(text, ['personal', 'family', 'health', 'fitness', 'hobby'])) {
      detectedTopic = 'personal';
      confidence = 0.80;
      suggestedTags.push('personal');
    }
    // Detect learning content
    else if (this._containsKeywords(text, ['learn', 'study', 'course', 'tutorial', 'documentation', 'research'])) {
      detectedTopic = 'learning';
      confidence = 0.82;
      suggestedTags.push('learning');
    }
    // Detect finance content
    else if (this._containsKeywords(text, ['budget', 'expense', 'payment', 'invoice', 'financial', 'money'])) {
      detectedTopic = 'finance';
      confidence = 0.88;
      suggestedTags.push('finance');
    }
    // Detect ideas/brainstorming
    else if (this._containsKeywords(text, ['idea', 'brainstorm', 'concept', 'innovation', 'creative'])) {
      detectedTopic = 'ideas';
      confidence = 0.75;
      suggestedTags.push('ideas');
    }

    // Find matching area based on detected topic
    let suggestedArea = null;
    const matchingArea = userAreas.find(area => 
      area.name.toLowerCase().includes(detectedTopic) || 
      detectedTopic.includes(area.name.toLowerCase().substring(0, 4))
    );

    if (matchingArea) {
      suggestedArea = {
        _id: matchingArea._id,
        name: matchingArea.name,
        color: matchingArea.color
      };
    }

    // Find matching folder in the suggested area
    let suggestedFolder = null;
    if (matchingArea) {
      const matchingFolder = userFolders.find(folder => 
        folder.areaId.toString() === matchingArea._id.toString()
      );

      if (matchingFolder) {
        suggestedFolder = {
          _id: matchingFolder._id,
          name: matchingFolder.name,
          color: matchingFolder.color,
          icon: matchingFolder.icon
        };
      }
    }

    // Extract common tags from existing cards
    const commonTags = this._extractCommonTags(existingCards, keywords);
    suggestedTags.push(...commonTags);

    // Remove duplicates and limit to 5 tags
    const uniqueTags = [...new Set(suggestedTags)].slice(0, 5);

    return {
      topic: detectedTopic,
      confidence,
      suggestedArea,
      suggestedFolder,
      suggestedTags: uniqueTags,
      reasoning: this._generateReasoning(detectedTopic, confidence, content)
    };
  }

  async autoOrganizeNote(userId, cardId) {
    // Get the card
    const card = await Card.findOne({ _id: cardId, userId });
    if (!card) {
      throw new Error('Card not found');
    }

    // Classify the note
    const classification = await this.classifyNote(
      userId,
      card.content,
      card.title,
      card.tags
    );

    // Auto-update if confidence is high enough
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

      // Update the card
      await Card.findByIdAndUpdate(cardId, updates);

      return {
        ...classification,
        autoOrganized: true,
        applied: {
          area: classification.suggestedArea?.name,
          folder: classification.suggestedFolder?.name,
          tags: updates.tags
        }
      };
    }

    return {
      ...classification,
      autoOrganized: false,
      message: 'Confidence too low for auto-organization. Manual review recommended.'
    };
  }

  // Helper methods
  _containsKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  _extractCommonTags(cards, keywords) {
    const tagFrequency = {};
    
    cards.forEach(card => {
      card.tags?.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    });

    // Get most common tags that match keywords
    const commonTags = Object.entries(tagFrequency)
      .filter(([tag]) => keywords.some(kw => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase())))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    return commonTags;
  }

  _generateReasoning(topic, confidence, content) {
    const reasons = {
      work: 'Detected work-related keywords such as project, deadline, or meeting',
      personal: 'Identified personal context from keywords like family, health, or hobby',
      learning: 'Found learning-related terms such as study, course, or research',
      finance: 'Detected financial keywords including budget, expense, or payment',
      ideas: 'Recognized creative content with terms like idea, brainstorm, or concept',
      general: 'Unable to determine specific topic with high confidence'
    };

    const confidenceLevel = confidence >= 0.85 ? 'high' : confidence >= 0.75 ? 'medium' : 'low';

    return {
      topic,
      confidenceLevel,
      explanation: reasons[topic] || reasons.general,
      contentLength: content.length,
      suggestedAction: confidence >= 0.75 
        ? 'Auto-organize recommended' 
        : 'Manual review suggested'
    };
  }
}

module.exports = new AIService();