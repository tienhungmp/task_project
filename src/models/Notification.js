const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['due_soon', 'overdue', 'reminder'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  // Thời gian task đến hạn
  dueDate: {
    type: Date,
    required: true
  },
  // Metadata về task
  taskInfo: {
    title: String,
    status: String,
    energyLevel: String,
    projectName: String,
    areaName: String
  }
}, {
  timestamps: true
});

// Index để query hiệu quả
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ cardId: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);