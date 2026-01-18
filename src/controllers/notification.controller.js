const notificationService = require('../services/notification.service');

class NotificationController {
  /**
   * GET /api/notifications
   * Lấy danh sách thông báo
   */
  async getAll(req, res) {
    try {
      const { isRead, type, page = 1, limit = 20 } = req.query;
      const filters = { isRead, type };
      
      const result = await notificationService.getAll(
        req.userId,
        filters,
        parseInt(page),
        parseInt(limit)
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Lấy số lượng thông báo chưa đọc
   */
  async getUnreadCount(req, res) {
    try {
      const result = await notificationService.getUnreadCount(req.userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(req, res) {
    try {
      const notification = await notificationService.markAsRead(
        req.params.id,
        req.userId
      );
      res.json(notification);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * PUT /api/notifications/read-all
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(req, res) {
    try {
      const result = await notificationService.markAllAsRead(req.userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Xóa thông báo
   */
  async delete(req, res) {
    try {
      await notificationService.delete(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/notifications/read
   * Xóa tất cả thông báo đã đọc
   */
  async deleteAllRead(req, res) {
    try {
      const result = await notificationService.deleteAllRead(req.userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/notifications/scan
   * Trigger scan thủ công (admin only hoặc dùng cho testing)
   */
  async triggerScan(req, res) {
    try {
      const result = await notificationService.scanAndCreateNotifications();
      res.json({
        success: true,
        message: 'Notification scan completed',
        results: result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new NotificationController();