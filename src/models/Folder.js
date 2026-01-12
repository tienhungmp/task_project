const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const folderSchema = new mongoose.Schema({
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
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
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
  passwordHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

folderSchema.index({ userId: 1, areaId: 1 });
folderSchema.index({ parentId: 1 });

folderSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

folderSchema.methods.verifyPassword = async function(password) {
  if (!this.passwordHash) return true;
  return bcrypt.compare(password, this.passwordHash);
};

folderSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.isProtected = !!obj.passwordHash;
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('Folder', folderSchema);