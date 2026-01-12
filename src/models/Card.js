const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'checklist', 'table', 'media', 'link'],
    required: true
  },
  content: mongoose.Schema.Types.Mixed,
  isCompleted: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
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
    enum: ['todo', 'doing', 'done'],
    default: 'todo',
    index: true
  },
  energyLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
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
  blocks: [blockSchema],
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

cardSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
cardSchema.index({ userId: 1, status: 1 });
cardSchema.index({ tags: 1 });
cardSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Card', cardSchema);