const Area = require('../models/Area');
const Folder = require('../models/Folder');
const Card = require('../models/Card');
const Project = require('../models/Project');

class AreaService {
  async getAll(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [areas, total] = await Promise.all([
      Area.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Area.countDocuments({ userId })
    ]);

    const areasWithCounts = await Promise.all(
      areas.map(async (area) => {
        const [
          folderCount,
          projectCount,
          taskCount,
          noteCount
        ] = await Promise.all([
          Folder.countDocuments({
            userId,
            areaId: area._id
          }),

          Project.countDocuments({
            userId,
            areaId: area._id
          }),

          // TASK: có dueDate
          Card.countDocuments({
            userId,
            areaId: area._id,
            deletedAt: null,
            dueDate: { $ne: null }
          }),

          // NOTE: không có dueDate
          Card.countDocuments({
            userId,
            areaId: area._id,
            deletedAt: null,
            dueDate: null
          })
        ]);

        return {
          ...area,
          folderCount,
          projectCount,
          taskCount,
          noteCount
        };
      })
    );

    return {
      data: areasWithCounts,
      pagination: {
        page,
        limit,
        total
      }
    };
  }

  async getById(id, userId) {
    const area = await Area.findOne({ _id: id, userId }).lean();
    if (!area) {
      throw new Error('Area not found');
    }
    return area;
  }

  async create(userId, data) {
    if (!data.color && data.color !== 0) {
      throw new Error('Color is required');
    }
    if (!data.icon && data.icon !== 0) {
      throw new Error('Icon is required');
    }
    
    const area = new Area({ userId, ...data });
    await area.save();
    return area;
  }

  async update(id, userId, data) {
    const area = await Area.findOneAndUpdate(
      { _id: id, userId },
      data,
      { new: true, runValidators: true }
    );

    if (!area) {
      throw new Error('Area not found');
    }

    return area;
  }

  async delete(id, userId) {
    const area = await Area.findOneAndDelete({ _id: id, userId });
    if (!area) {
      throw new Error('Area not found');
    }
    return area;
  }
}

module.exports = new AreaService();