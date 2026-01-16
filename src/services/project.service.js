const Project = require('../models/Project');

class ProjectService {
  async getAll(userId, areaId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = { userId };
    
    if (areaId) query.areaId = areaId;

    const [projects, total] = await Promise.all([
      Project.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Project.countDocuments(query)
    ]);

    return {
      projects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, userId) {
    const project = await Project.findOne({ _id: id, userId }).lean();
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  async create(userId, data) {
    const project = new Project({ userId, ...data });
    await project.save();
    return project;
  }

  async update(id, userId, data) {
    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      data,
      { new: true, runValidators: true }
    );

    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  }

  async delete(id, userId) {
    const project = await Project.findOneAndDelete({ _id: id, userId });
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }
}

module.exports = new ProjectService();