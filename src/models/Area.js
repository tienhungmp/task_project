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
  description: {
    type: String,
    default: ''
  },
  color: {
    type: Number,
  },
  icon: {
    type: Number,
  }
}, {
  timestamps: true
});

areaSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Area', areaSchema);