const Project = require('../models/Project');
const Card = require('../models/Card');

class ProjectService {
  async getAll(userId, areaId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = { userId };
    
    if (areaId) query.areaId = areaId;

    const [projects, total] = await Promise.all([
      Project.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Project.countDocuments(query)
    ]);

    // Thêm task counts và progress cho mỗi project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const [totalTasks, completedTasks] = await Promise.all([
          Card.countDocuments({
            userId,
            projectId: project._id,
            deletedAt: null,
            dueDate: { $ne: null } // Chỉ đếm tasks
          }),
          Card.countDocuments({
            userId,
            projectId: project._id,
            deletedAt: null,
            dueDate: { $ne: null },
            status: 'done'
          })
        ]);

        const completionRate = totalTasks > 0 
          ? Math.round((completedTasks / totalTasks) * 100) 
          : 0;

        // Kiểm tra overdue
        const isOverdue = project.endDate ? new Date() > new Date(project.endDate) : false;

        // Tính duration
        let duration = null;
        if (project.startDate && project.endDate) {
          const diff = new Date(project.endDate) - new Date(project.startDate);
          duration = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        return {
          ...project,
          totalTasks,
          completedTasks,
          completionRate,
          isOverdue,
          duration
        };
      })
    );

    return {
      projects: projectsWithStats,
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

    // Thêm task statistics
    const [totalTasks, completedTasks, todoTasks, doingTasks] = await Promise.all([
      Card.countDocuments({
        userId,
        projectId: id,
        deletedAt: null,
        dueDate: { $ne: null }
      }),
      Card.countDocuments({
        userId,
        projectId: id,
        deletedAt: null,
        dueDate: { $ne: null },
        status: 'done'
      }),
      Card.countDocuments({
        userId,
        projectId: id,
        deletedAt: null,
        dueDate: { $ne: null },
        status: 'todo'
      }),
      Card.countDocuments({
        userId,
        projectId: id,
        deletedAt: null,
        dueDate: { $ne: null },
        status: 'doing'
      })
    ]);

    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;

    const isOverdue = project.endDate ? new Date() > new Date(project.endDate) : false;

    let duration = null;
    if (project.startDate && project.endDate) {
      const diff = new Date(project.endDate) - new Date(project.startDate);
      duration = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return {
      ...project,
      totalTasks,
      completedTasks,
      todoTasks,
      doingTasks,
      completionRate,
      isOverdue,
      duration
    };
  }

  async create(userId, data) {
    // Validate dates
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      if (end <= start) {
        throw new Error('End date must be after start date');
      }
    }

    const project = new Project({ userId, ...data });
    await project.save();
    return project;
  }

  async update(id, userId, data) {
    // Validate dates if both are provided
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      if (end <= start) {
        throw new Error('End date must be after start date');
      }
    }

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
    
    // Optionally: Handle orphaned tasks
    // Option 1: Delete all tasks in this project
    // await Card.updateMany(
    //   { userId, projectId: id },
    //   { deletedAt: new Date() }
    // );
    
    // Option 2: Move tasks to no project
    await Card.updateMany(
      { userId, projectId: id, deletedAt: null },
      { projectId: null }
    );
    
    return project;
  }
}

module.exports = new ProjectService();