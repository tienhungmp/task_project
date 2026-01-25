const mongoose = require('mongoose');

const projectShareSchema = new mongoose.Schema({
  sharedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permission: {
    type: String,
    enum: ['view'],
    default: 'view'
  },
  sharedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

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
  },
  // NEW: Sharing functionality
  shares: {
    type: [projectShareSchema],
    default: []
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String,
    default: null,
    index: true,
    sparse: true
  }
}, {
  timestamps: true
});

projectSchema.index({ userId: 1, areaId: 1 });
projectSchema.index({ 'shares.sharedWith': 1 });
projectSchema.index({ shareToken: 1 });

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

// Method để check quyền truy cập
projectSchema.methods.hasAccess = function(userId) {
  const userIdStr = userId.toString();
  
  // Owner có full access
  if (this.userId.toString() === userIdStr) {
    return { hasAccess: true, permission: 'owner' };
  }
  
  // Check shared users
  const share = this.shares.find(s => s.sharedWith.toString() === userIdStr);
  if (share) {
    return { hasAccess: true, permission: share.permission };
  }
  
  // Public project - view only
  if (this.isPublic) {
    return { hasAccess: true, permission: 'view' };
  }
  
  return { hasAccess: false, permission: null };
};

// Method để thêm share
projectSchema.methods.addShare = function(sharedWith, sharedBy) {
  // Check if already shared
  const existingShare = this.shares.find(
    s => s.sharedWith.toString() === sharedWith.toString()
  );
  
  if (existingShare) {
    throw new Error('Project already shared with this user');
  }
  
  this.shares.push({
    sharedWith,
    sharedBy,
    permission: 'view',
    sharedAt: new Date()
  });
};

// Method để remove share
projectSchema.methods.removeShare = function(sharedWith) {
  this.shares = this.shares.filter(
    s => s.sharedWith.toString() !== sharedWith.toString()
  );
};

// Method để generate share token
projectSchema.methods.generateShareToken = function() {
  const crypto = require('crypto');
  this.shareToken = crypto.randomBytes(32).toString('hex');
  return this.shareToken;
};

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Project', projectSchema);