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
}

module.exports = new AIService();