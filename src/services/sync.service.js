const Area = require('../models/Area');
const Folder = require('../models/Folder');
const Project = require('../models/Project');
const Card = require('../models/Card');

class SyncService {
  async getUpdates(userId, lastSync) {
    const syncDate = new Date(lastSync);

    const [areas, folders, projects, cards] = await Promise.all([
      Area.find({ userId, updatedAt: { $gt: syncDate } }).lean(),
      Folder.find({ userId, updatedAt: { $gt: syncDate } }).lean(),
      Project.find({ userId, updatedAt: { $gt: syncDate } }).lean(),
      Card.find({ userId, updatedAt: { $gt: syncDate } }).lean()
    ]);

    return {
      areas,
      folders,
      projects,
      cards,
      syncTimestamp: new Date().toISOString()
    };
  }
}

module.exports = new SyncService();