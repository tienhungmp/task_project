const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  color: {
    type: Number,
    required: true
  },
  icon: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  hideCompleted: {
    type: Boolean,
    default: false
  },
  energyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  calendarSync: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

projectSchema.index({ userId: 1, areaId: 1 });

// Virtual để kiểm tra project đã quá hạn chưa
projectSchema.virtual('isOverdue').get(function() {
  if (!this.endDate) return false;
  return new Date() > this.endDate;
});

// Virtual để tính duration (số ngày)
projectSchema.virtual('duration').get(function() {
  if (!this.startDate || !this.endDate) return null;
  const diff = this.endDate - this.startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Project', projectSchema);