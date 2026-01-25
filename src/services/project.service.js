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

  /**
 * Share project với user khác (view-only)
 */
async shareWithUser(projectId, ownerId, targetUserEmail) {
  try {
    // 1. Tìm project và verify ownership
    const project = await Project.findOne({ _id: projectId, userId: ownerId });
    if (!project) {
      throw new Error('Project not found or you do not have permission');
    }

    // 2. Tìm target user
    const User = require('../models/User');
    const targetUser = await User.findOne({ email: targetUserEmail });
    if (!targetUser) {
      throw new Error('User not found with this email');
    }

    // 3. Không thể share với chính mình
    if (targetUser._id.toString() === ownerId.toString()) {
      throw new Error('Cannot share project with yourself');
    }

    // 4. Add share
    project.addShare(targetUser._id, ownerId);
    await project.save();

    return {
      success: true,
      sharedWith: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        avatarUrl: targetUser.avatarUrl
      },
      permission: 'view',
      sharedAt: new Date()
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Unshare project
 */
async unshareWithUser(projectId, ownerId, targetUserId) {
  try {
    const project = await Project.findOne({ _id: projectId, userId: ownerId });
    if (!project) {
      throw new Error('Project not found or you do not have permission');
    }

    project.removeShare(targetUserId);
    await project.save();

    return {
      success: true,
      message: 'Project unshared successfully'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Lấy danh sách users được share
 */
async getSharedUsers(projectId, userId) {
  try {
    const project = await Project.findById(projectId)
      .populate('shares.sharedWith', 'name email avatarUrl')
      .populate('shares.sharedBy', 'name email')
      .lean();

    if (!project) {
      throw new Error('Project not found');
    }

    // Verify access
    const access = await this._checkProjectAccess(projectId, userId);
    if (!access.hasAccess) {
      throw new Error('You do not have access to this project');
    }

    return {
      owner: {
        _id: project.userId,
        permission: 'owner'
      },
      shares: project.shares.map(share => ({
        user: share.sharedWith,
        permission: share.permission,
        sharedBy: share.sharedBy,
        sharedAt: share.sharedAt
      })),
      totalShares: project.shares.length
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate public share link
 */
async generateShareLink(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      throw new Error('Project not found or you do not have permission');
    }

    // Generate token nếu chưa có
    if (!project.shareToken) {
      project.generateShareToken();
      project.isPublic = true;
      await project.save();
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared/projects/${project.shareToken}`;

    return {
      success: true,
      shareUrl,
      shareToken: project.shareToken,
      isPublic: project.isPublic
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Revoke public share link
 */
async revokeShareLink(projectId, userId) {
  try {
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      throw new Error('Project not found or you do not have permission');
    }

    project.shareToken = null;
    project.isPublic = false;
    await project.save();

    return {
      success: true,
      message: 'Public share link revoked'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get project by share token (public access)
 */
async getByShareToken(shareToken) {
  try {
    const project = await Project.findOne({ 
      shareToken, 
      isPublic: true 
    }).lean();

    if (!project) {
      throw new Error('Invalid or expired share link');
    }

    // Get statistics
    const [totalTasks, completedTasks] = await Promise.all([
      Card.countDocuments({
        projectId: project._id,
        deletedAt: null,
        dueDate: { $ne: null }
      }),
      Card.countDocuments({
        projectId: project._id,
        deletedAt: null,
        dueDate: { $ne: null },
        status: 'done'
      })
    ]);

    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;

    return {
      ...project,
      totalTasks,
      completedTasks,
      completionRate,
      permission: 'view' // Always view-only for public links
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get shared projects (projects được chia sẻ với user)
 */
async getSharedWithMe(userId, page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      Project.find({ 'shares.sharedWith': userId })
        .sort({ 'shares.sharedAt': -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email avatarUrl')
        .populate('areaId', 'name color icon')
        .lean(),
      Project.countDocuments({ 'shares.sharedWith': userId })
    ]);

    // Add statistics for each project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const [totalTasks, completedTasks] = await Promise.all([
          Card.countDocuments({
            projectId: project._id,
            deletedAt: null,
            dueDate: { $ne: null }
          }),
          Card.countDocuments({
            projectId: project._id,
            deletedAt: null,
            dueDate: { $ne: null },
            status: 'done'
          })
        ]);

        const completionRate = totalTasks > 0 
          ? Math.round((completedTasks / totalTasks) * 100) 
          : 0;

        // Find share info
        const share = project.shares.find(
          s => s.sharedWith.toString() === userId.toString()
        );

        return {
          ...project,
          totalTasks,
          completedTasks,
          completionRate,
          permission: share?.permission || 'view',
          sharedAt: share?.sharedAt,
          owner: project.userId
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
  } catch (error) {
    throw error;
  }
}

/**
 * Helper: Check project access
 */
async _checkProjectAccess(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) {
    return { hasAccess: false, permission: null };
  }
  
  return project.hasAccess(userId);
}

/**
 * Update getById để support shared projects
 */
async getById(id, userId) {
  const project = await Project.findById(id)
    .populate('userId', 'name email avatarUrl')
    .lean();
    
  if (!project) {
    throw new Error('Project not found');
  }

  // Check access
  const access = await this._checkProjectAccess(id, userId);
  if (!access.hasAccess) {
    throw new Error('You do not have access to this project');
  }

  // Thêm task statistics
  const [totalTasks, completedTasks, todoTasks, doingTasks] = await Promise.all([
    Card.countDocuments({
      projectId: id,
      deletedAt: null,
      dueDate: { $ne: null }
    }),
    Card.countDocuments({
      projectId: id,
      deletedAt: null,
      dueDate: { $ne: null },
      status: 'done'
    }),
    Card.countDocuments({
      projectId: id,
      deletedAt: null,
      dueDate: { $ne: null },
      status: 'todo'
    }),
    Card.countDocuments({
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
    duration,
    permission: access.permission,
    isOwner: project.userId._id.toString() === userId.toString()
  };
}
}

module.exports = new ProjectService();