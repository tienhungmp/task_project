const Card = require('../models/Card');
const Project = require('../models/Project');
const Area = require('../models/Area');
const Folder = require('../models/Folder');

class StatsService {
  /**
   * Thống kê theo ngày
   */
  async getDailyStats(userId, date) {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    return await this._getStatsForRange(userId, startOfDay, endOfDay);
  }

  /**
   * Thống kê theo tuần
   */
  async getWeeklyStats(userId, weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const stats = await this._getStatsForRange(userId, weekStart, weekEnd);

    // Thêm breakdown theo ngày trong tuần
    const dailyBreakdown = await this._getDailyBreakdown(userId, weekStart, weekEnd);
    stats.dailyBreakdown = dailyBreakdown;

    return stats;
  }

  /**
   * Thống kê theo tháng
   */
  async getMonthlyStats(userId, year, month) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const stats = await this._getStatsForRange(userId, startOfMonth, endOfMonth);

    // Thêm breakdown theo tuần trong tháng
    const weeklyBreakdown = await this._getWeeklyBreakdown(userId, startOfMonth, endOfMonth);
    stats.weeklyBreakdown = weeklyBreakdown;

    return stats;
  }

  /**
   * Thống kê theo năm
   */
  async getYearlyStats(userId, year) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const stats = await this._getStatsForRange(userId, startOfYear, endOfYear);

    // Thêm breakdown theo tháng trong năm
    const monthlyBreakdown = await this._getMonthlyBreakdown(userId, startOfYear, endOfYear);
    stats.monthlyBreakdown = monthlyBreakdown;

    return stats;
  }

  /**
   * Thống kê theo khoảng thời gian tùy chọn
   */
  async getRangeStats(userId, startDate, endDate) {
    return await this._getStatsForRange(userId, startDate, endDate);
  }

  /**
   * Tổng quan toàn bộ
   */
  async getOverview(userId) {
    const [
      totalCards,
      totalProjects,
      totalAreas,
      totalFolders,
      completedTasks,
      pendingTasks,
      tasksByStatus,
      tasksByEnergy,
      topAreas,
      topProjects,
      recentActivity
    ] = await Promise.all([
      Card.countDocuments({ userId, deletedAt: null }),
      Project.countDocuments({ userId }),
      Area.countDocuments({ userId }),
      Folder.countDocuments({ userId }),
      Card.countDocuments({ userId, deletedAt: null, status: 'done' }),
      Card.countDocuments({ userId, deletedAt: null, status: { $in: ['todo', 'doing', 'pending'] } }),
      this._getTasksByStatus(userId),
      this._getTasksByEnergy(userId),
      this._getTopAreas(userId, 5),
      this._getTopProjects(userId, 5),
      this._getRecentActivity(userId, 10)
    ]);

    return {
      summary: {
        totalCards,
        totalProjects,
        totalAreas,
        totalFolders,
        completedTasks,
        pendingTasks,
        completionRate: totalCards > 0 ? ((completedTasks / totalCards) * 100).toFixed(2) : 0
      },
      distribution: {
        byStatus: tasksByStatus,
        byEnergy: tasksByEnergy
      },
      topPerformers: {
        areas: topAreas,
        projects: topProjects
      },
      recentActivity
    };
  }

  /**
   * Xu hướng theo thời gian (để vẽ chart)
   */
  async getTrends(userId, period, limit) {
    const trends = [];
    const now = new Date();

    for (let i = limit - 1; i >= 0; i--) {
      let startDate, endDate, label;

      if (period === 'day') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - i);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        label = startDate.toISOString().split('T')[0];
      } else if (period === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - (i * 7));
        startDate = this._getWeekStart(startDate);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        label = `Week ${this._getWeekNumber(startDate)}`;
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        label = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      const stats = await this._getBasicStatsForRange(userId, startDate, endDate);
      
      trends.push({
        label,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        ...stats
      });
    }

    return trends;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Lấy thống kê chi tiết cho một khoảng thời gian
   */
  async _getStatsForRange(userId, startDate, endDate) {
    const [
      totalCreated,
      totalCompleted,
      totalTasks,
      totalNotes,
      tasksByStatus,
      tasksByEnergy,
      tasksByArea,
      tasksByProject,
      overdueCount
    ] = await Promise.all([
      Card.countDocuments({
        userId,
        deletedAt: null,
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      Card.countDocuments({
        userId,
        deletedAt: null,
        status: 'done',
        updatedAt: { $gte: startDate, $lte: endDate }
      }),
      Card.countDocuments({
        userId,
        deletedAt: null,
        dueDate: { $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      Card.countDocuments({
        userId,
        deletedAt: null,
        dueDate: null,
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      this._getTasksByStatusInRange(userId, startDate, endDate),
      this._getTasksByEnergyInRange(userId, startDate, endDate),
      this._getTasksByAreaInRange(userId, startDate, endDate),
      this._getTasksByProjectInRange(userId, startDate, endDate),
      Card.countDocuments({
        userId,
        deletedAt: null,
        dueDate: { $lt: endDate },
        status: { $ne: 'done' }
      })
    ]);

    return {
      summary: {
        totalCreated,
        totalCompleted,
        totalTasks,
        totalNotes,
        overdueCount,
        completionRate: totalCreated > 0 ? ((totalCompleted / totalCreated) * 100).toFixed(2) : 0
      },
      distribution: {
        byStatus: tasksByStatus,
        byEnergy: tasksByEnergy,
        byArea: tasksByArea,
        byProject: tasksByProject
      }
    };
  }

  /**
   * Lấy stats cơ bản (cho trends)
   */
  async _getBasicStatsForRange(userId, startDate, endDate) {
    const [created, completed] = await Promise.all([
      Card.countDocuments({
        userId,
        deletedAt: null,
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      Card.countDocuments({
        userId,
        deletedAt: null,
        status: 'done',
        updatedAt: { $gte: startDate, $lte: endDate }
      })
    ]);

    return { created, completed };
  }

  /**
   * Breakdown theo ngày trong khoảng thời gian
   */
  async _getDailyBreakdown(userId, startDate, endDate) {
    const days = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const stats = await this._getBasicStatsForRange(userId, dayStart, dayEnd);
      
      days.push({
        date: current.toISOString().split('T')[0],
        dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'short' }),
        ...stats
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  /**
   * Breakdown theo tuần
   */
  async _getWeeklyBreakdown(userId, startDate, endDate) {
    const weeks = [];
    let current = this._getWeekStart(new Date(startDate));

    while (current <= endDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const stats = await this._getBasicStatsForRange(userId, current, weekEnd);
      
      weeks.push({
        weekNumber: this._getWeekNumber(current),
        startDate: current.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        ...stats
      });

      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }

  /**
   * Breakdown theo tháng
   */
  async _getMonthlyBreakdown(userId, startDate, endDate) {
    const months = [];
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (current <= endDate) {
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const stats = await this._getBasicStatsForRange(userId, current, monthEnd);
      
      months.push({
        month: current.getMonth() + 1,
        year: current.getFullYear(),
        label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        ...stats
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  /**
   * Tasks by status
   */
  async _getTasksByStatus(userId) {
    const result = await Card.aggregate([
      { $match: { userId, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { todo: 0, doing: 0, done: 0, pending: 0 });
  }

  async _getTasksByStatusInRange(userId, startDate, endDate) {
    const result = await Card.aggregate([
      { 
        $match: { 
          userId, 
          deletedAt: null,
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { todo: 0, doing: 0, done: 0, pending: 0 });
  }

  /**
   * Tasks by energy
   */
  async _getTasksByEnergy(userId) {
    const result = await Card.aggregate([
      { $match: { userId, deletedAt: null } },
      { $group: { _id: '$energyLevel', count: { $sum: 1 } } }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { low: 0, medium: 0, high: 0, urgent: 0 });
  }

  async _getTasksByEnergyInRange(userId, startDate, endDate) {
    const result = await Card.aggregate([
      { 
        $match: { 
          userId, 
          deletedAt: null,
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      { $group: { _id: '$energyLevel', count: { $sum: 1 } } }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { low: 0, medium: 0, high: 0, urgent: 0 });
  }

  /**
   * Tasks by area
   */
  async _getTasksByAreaInRange(userId, startDate, endDate) {
    const result = await Card.aggregate([
      { 
        $match: { 
          userId, 
          deletedAt: null,
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      { $group: { _id: '$areaId', count: { $sum: 1 } } },
      { $lookup: { from: 'areas', localField: '_id', foreignField: '_id', as: 'area' } },
      { $unwind: { path: '$area', preserveNullAndEmptyArrays: true } },
      { $project: { areaName: '$area.name', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return result.map(r => ({ name: r.areaName || 'Unknown', count: r.count }));
  }

  /**
   * Tasks by project
   */
  async _getTasksByProjectInRange(userId, startDate, endDate) {
    const result = await Card.aggregate([
      { 
        $match: { 
          userId, 
          deletedAt: null,
          projectId: { $ne: null },
          createdAt: { $gte: startDate, $lte: endDate }
        } 
      },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      { $project: { projectName: '$project.name', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return result.map(r => ({ name: r.projectName || 'Unknown', count: r.count }));
  }

  /**
   * Top areas
   */
  async _getTopAreas(userId, limit) {
    const result = await Card.aggregate([
      { $match: { userId, deletedAt: null } },
      { $group: { _id: '$areaId', count: { $sum: 1 } } },
      { $lookup: { from: 'areas', localField: '_id', foreignField: '_id', as: 'area' } },
      { $unwind: '$area' },
      { $project: { name: '$area.name', color: '$area.color', icon: '$area.icon', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    return result;
  }

  /**
   * Top projects
   */
  async _getTopProjects(userId, limit) {
    const result = await Card.aggregate([
      { $match: { userId, deletedAt: null, projectId: { $ne: null } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
      { $unwind: '$project' },
      { $project: { name: '$project.name', color: '$project.color', icon: '$project.icon', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    return result;
  }

  /**
   * Recent activity
   */
  async _getRecentActivity(userId, limit) {
    const cards = await Card.find({ userId, deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('areaId', 'name')
      .populate('projectId', 'name')
      .lean();

    return cards.map(card => ({
      _id: card._id,
      title: card.title,
      status: card.status,
      area: card.areaId?.name,
      project: card.projectId?.name,
      updatedAt: card.updatedAt
    }));
  }

  /**
   * Get week start (Monday)
   */
  _getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get week number
   */
  _getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

module.exports = new StatsService();