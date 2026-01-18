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

folderSchema.methods.setPassword = async function (password) {
  if (!password) {
    throw new Error('Password is required');
  }

  const normalized = String(password).trim();
  if (!normalized) {
    throw new Error('Password cannot be empty');
  }

  const saltRounds = 10;
  this.passwordHash = await bcrypt.hash(normalized, saltRounds);
};

folderSchema.methods.verifyPassword = async function (password) {
  if (!this.passwordHash) return true;
  
  console.log('Input password (quoted): ', JSON.stringify(String(password)));
  console.log('Trimmed password (quoted): ', JSON.stringify(String(password).trim()));
  console.log('Stored hash: ', this.passwordHash);
  
  if (!password) return false;
  const normalized = String(password).trim();
  if (!normalized) return false;
  
  const match = await bcrypt.compare(normalized, this.passwordHash);
  console.log('Bcrypt compare result: ', match);
  return match;
};


folderSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.isProtected = !!obj.passwordHash;
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('Folder', folderSchema);