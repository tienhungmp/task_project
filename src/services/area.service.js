const Area = require('../models/Area');

class AreaService {
  async getAll(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [areas, total] = await Promise.all([
      Area.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Area.countDocuments({ userId })
    ]);

    return {
      areas,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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