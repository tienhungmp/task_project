const Folder = require('../models/Folder');

class FolderService {
  async getAll(userId, filters = {}) {
    const query = { userId };
    
    if (filters.areaId) query.areaId = filters.areaId;
    if (filters.parentId !== undefined) {
      query.parentId = filters.parentId === 'null' ? null : filters.parentId;
    }

    const folders = await Folder.find(query).sort({ createdAt: -1 }).lean();
    return folders;
  }

  async getById(id, userId) {
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      throw new Error('Folder not found');
    }
    return folder;
  }

  async create(userId, data) {
    const folder = new Folder({ userId, ...data });
    
    if (data.password) {
      await folder.setPassword(data.password);
    }
    
    await folder.save();
    return folder;
  }

  async update(id, userId, data) {
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      throw new Error('Folder not found');
    }

    Object.assign(folder, data);
    
    if (data.password) {
      await folder.setPassword(data.password);
    } else if (data.password === null) {
      folder.passwordHash = null;
    }

    await folder.save();
    return folder;
  }

  async delete(id, userId) {
    const folder = await Folder.findOneAndDelete({ _id: id, userId });
    if (!folder) {
      throw new Error('Folder not found');
    }
    return folder;
  }

  async verifyAccess(id, userId, password) {
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      throw new Error('Folder not found');
    }

    const hasAccess = await folder.verifyPassword(password);
    return { hasAccess, folder };
  }
}

module.exports = new FolderService();