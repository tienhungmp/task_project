const Card = require('../models/Card');

class DashboardService {
  async getEnergyOverview(userId) {
    const energyStats = await Card.aggregate([
      { $match: { userId, deletedAt: null, isArchived: false } },
      {
        $group: {
          _id: '$energyLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    const overview = {
      low: 0,
      medium: 0,
      high: 0
    };

    energyStats.forEach(stat => {
      overview[stat._id] = stat.count;
    });

    return overview;
  }

  async getStats(userId, period = 'week') {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const [totalCards, completedCards, activeCards, overdueCards] = await Promise.all([
      Card.countDocuments({ userId, deletedAt: null, isArchived: false }),
      Card.countDocuments({ userId, status: 'done', deletedAt: null, isArchived: false }),
      Card.countDocuments({ userId, status: { $in: ['todo', 'doing'] }, deletedAt: null, isArchived: false }),
      Card.countDocuments({
        userId,
        dueDate: { $lt: now },
        status: { $ne: 'done' },
        deletedAt: null,
        isArchived: false
      })
    ]);

    const recentActivity = await Card.find({
      userId,
      createdAt: { $gte: startDate },
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return {
      totalCards,
      completedCards,
      activeCards,
      overdueCards,
      completionRate: totalCards > 0 ? ((completedCards / totalCards) * 100).toFixed(2) : 0,
      recentActivity
    };
  }
}

module.exports = new DashboardService();