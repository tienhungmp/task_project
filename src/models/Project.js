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
  hideCompleted: {
    type: Boolean,
    default: false
  },
  energyLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
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

module.exports = mongoose.model('Project', projectSchema);