const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  checked: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const cardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  areaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
    index: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    url: String,
    name: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['todo', 'doing', 'done','pending'],
    default: 'todo',
    index: true
  },
  energyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: {
    type: Date,
    default: null
  },
  reminder: {
    type: Date,
    default: null
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  // New simplified fields
  link: {
    type: String,
    default: null
  },
  imageUrl: {
    type: String,
    default: null
  },
  checklist: {
    type: [checklistItemSchema],
    default: []
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Virtual to compute checklist completion
cardSchema.virtual('checklistProgress').get(function() {
  if (!this.checklist || this.checklist.length === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  const completed = this.checklist.filter(item => item.checked).length;
  const total = this.checklist.length;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100)
  };
});

cardSchema.set('toJSON', { virtuals: true });
cardSchema.set('toObject', { virtuals: true });

cardSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
cardSchema.index({ userId: 1, status: 1 });
cardSchema.index({ tags: 1 });
cardSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Card', cardSchema);