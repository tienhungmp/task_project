const Notification = require('../models/Notification');
const Card = require('../models/Card');
const Area = require('../models/Area');
const Project = require('../models/Project');

class NotificationService {
  /**
   * Lấy tất cả thông báo của user
   */
  async getAll(userId, filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = { userId };

    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead === 'true';
    }

    if (filters.type) {
      query.type = filters.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('cardId', 'title status energyLevel')
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false })
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      unreadCount
    };
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `Marked ${result.modifiedCount} notifications as read`
    };
  }

  /**
   * Xóa thông báo
   */
  async delete(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Xóa tất cả thông báo đã đọc
   */
  async deleteAllRead(userId) {
    const result = await Notification.deleteMany({
      userId,
      isRead: true
    });

    return {
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} read notifications`
    };
  }

  /**
   * Lấy số lượng thông báo chưa đọc
   */
  async getUnreadCount(userId) {
    const count = await Notification.countDocuments({
      userId,
      isRead: false
    });

    return { unreadCount: count };
  }

  /**
   * Tạo thông báo cho task gần đến hạn
   * Được gọi bởi cron job hoặc khi tạo/cập nhật task
   */
  async createDueSoonNotification(cardId, userId) {
    try {
      const card = await Card.findById(cardId)
        .populate('areaId', 'name')
        .populate('projectId', 'name')
        .lean();

      if (!card || !card.dueDate || card.status === 'done') {
        return null;
      }

      const now = new Date();
      const dueDate = new Date(card.dueDate);
      const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

      // Chỉ tạo thông báo nếu task sắp đến hạn trong 24h
      if (hoursUntilDue < 0 || hoursUntilDue > 24) {
        return null;
      }

      // Kiểm tra xem đã có thông báo cho task này chưa (trong 24h gần nhất)
      const existingNotification = await Notification.findOne({
        userId,
        cardId,
        type: 'due_soon',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (existingNotification) {
        return existingNotification;
      }

      const hoursText = Math.floor(hoursUntilDue);
      const minutesText = Math.floor((hoursUntilDue % 1) * 60);
      
      let timeText = '';
      if (hoursText > 0) {
        timeText = `${hoursText}h`;
        if (minutesText > 0) {
          timeText += ` ${minutesText}m`;
        }
      } else {
        timeText = `${minutesText}m`;
      }

      const notification = new Notification({
        userId,
        cardId,
        type: 'due_soon',
        title: '⏰ Task sắp đến hạn',
        message: `"${card.title}" sẽ đến hạn trong ${timeText}`,
        dueDate: card.dueDate,
        taskInfo: {
          title: card.title,
          status: card.status,
          energyLevel: card.energyLevel,
          projectName: card.projectId?.name || null,
          areaName: card.areaId?.name || null
        }
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error creating due soon notification:', error);
      return null;
    }
  }

  /**
   * Tạo thông báo cho task quá hạn
   */
  async createOverdueNotification(cardId, userId) {
    try {
      const card = await Card.findById(cardId)
        .populate('areaId', 'name')
        .populate('projectId', 'name')
        .lean();

      if (!card || !card.dueDate || card.status === 'done') {
        return null;
      }

      const now = new Date();
      const dueDate = new Date(card.dueDate);

      // Chỉ tạo nếu task đã quá hạn
      if (dueDate >= now) {
        return null;
      }

      // Kiểm tra xem đã có thông báo overdue chưa
      const existingNotification = await Notification.findOne({
        userId,
        cardId,
        type: 'overdue',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (existingNotification) {
        return existingNotification;
      }

      const hoursPastDue = (now - dueDate) / (1000 * 60 * 60);
      const daysPastDue = Math.floor(hoursPastDue / 24);
      
      let timeText = '';
      if (daysPastDue > 0) {
        timeText = `${daysPastDue} ngày`;
      } else {
        timeText = `${Math.floor(hoursPastDue)} giờ`;
      }

      const notification = new Notification({
        userId,
        cardId,
        type: 'overdue',
        title: '🚨 Task quá hạn',
        message: `"${card.title}" đã quá hạn ${timeText}`,
        dueDate: card.dueDate,
        taskInfo: {
          title: card.title,
          status: card.status,
          energyLevel: card.energyLevel,
          projectName: card.projectId?.name || null,
          areaName: card.areaId?.name || null
        }
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error creating overdue notification:', error);
      return null;
    }
  }

  /**
   * Tạo thông báo từ reminder của task
   */
  async createReminderNotification(cardId, userId) {
    try {
      const card = await Card.findById(cardId)
        .populate('areaId', 'name')
        .populate('projectId', 'name')
        .lean();

      if (!card || !card.reminder || card.status === 'done') {
        return null;
      }

      const now = new Date();
      const reminderDate = new Date(card.reminder);

      // Chỉ tạo nếu đã đến thời gian reminder
      if (reminderDate > now) {
        return null;
      }

      // Kiểm tra xem đã có thông báo reminder chưa
      const existingNotification = await Notification.findOne({
        userId,
        cardId,
        type: 'reminder',
        createdAt: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) } // 1h
      });

      if (existingNotification) {
        return existingNotification;
      }

      const notification = new Notification({
        userId,
        cardId,
        type: 'reminder',
        title: '🔔 Nhắc nhở',
        message: `Nhắc nhở cho task: "${card.title}"`,
        dueDate: card.dueDate || reminderDate,
        taskInfo: {
          title: card.title,
          status: card.status,
          energyLevel: card.energyLevel,
          projectName: card.projectId?.name || null,
          areaName: card.areaId?.name || null
        }
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error creating reminder notification:', error);
      return null;
    }
  }

  /**
   * Scan tất cả tasks và tạo thông báo cần thiết
   * Dùng cho cron job
   */
  async scanAndCreateNotifications() {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 1. Tìm tasks sắp đến hạn (trong 24h tới)
      const dueSoonTasks = await Card.find({
        deletedAt: null,
        status: { $ne: 'done' },
        dueDate: {
          $gte: now,
          $lte: tomorrow
        }
      }).lean();

      // 2. Tìm tasks quá hạn
      const overdueTasks = await Card.find({
        deletedAt: null,
        status: { $ne: 'done' },
        dueDate: { $lt: now }
      }).lean();

      // 3. Tìm tasks có reminder đến hạn
      const reminderTasks = await Card.find({
        deletedAt: null,
        status: { $ne: 'done' },
        reminder: { $lte: now }
      }).lean();

      const results = {
        dueSoon: 0,
        overdue: 0,
        reminder: 0,
        total: 0
      };

      // Tạo thông báo cho tasks sắp đến hạn
      for (const task of dueSoonTasks) {
        const notification = await this.createDueSoonNotification(task._id, task.userId);
        if (notification) {
          results.dueSoon++;
          results.total++;
        }
      }

      // Tạo thông báo cho tasks quá hạn
      for (const task of overdueTasks) {
        const notification = await this.createOverdueNotification(task._id, task.userId);
        if (notification) {
          results.overdue++;
          results.total++;
        }
      }

      // Tạo thông báo cho reminders
      for (const task of reminderTasks) {
        const notification = await this.createReminderNotification(task._id, task.userId);
        if (notification) {
          results.reminder++;
          results.total++;
        }
      }

      console.log('✅ Notification scan completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Error scanning notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();