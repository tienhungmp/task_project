const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#3B82F6'
  }
}, {
  timestamps: true
});

areaSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Area', areaSchema);