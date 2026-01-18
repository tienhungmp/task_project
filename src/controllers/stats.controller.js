const statsService = require('../services/stats.service');

class StatsController {
  /**
   * GET /api/stats/daily?date=2026-01-18
   * Thống kê theo ngày cụ thể (mặc định hôm nay)
   */
  async getDailyStats(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date) : new Date();
      
      const stats = await statsService.getDailyStats(req.userId, targetDate);
      res.json({
        success: true,
        period: 'daily',
        date: targetDate.toISOString().split('T')[0],
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/stats/weekly?startDate=2026-01-13
   * Thống kê theo tuần (mặc định tuần hiện tại)
   */
  async getWeeklyStats(req, res) {
    try {
      const { startDate } = req.query;
      const weekStart = startDate ? new Date(startDate) : this._getWeekStart(new Date());
      
      const stats = await statsService.getWeeklyStats(req.userId, weekStart);
      res.json({
        success: true,
        period: 'weekly',
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/stats/monthly?year=2026&month=1
   * Thống kê theo tháng (mặc định tháng hiện tại)
   */
  async getMonthlyStats(req, res) {
    try {
      const currentDate = new Date();
      const year = req.query.year ? parseInt(req.query.year) : currentDate.getFullYear();
      const month = req.query.month ? parseInt(req.query.month) : currentDate.getMonth() + 1;
      
      const stats = await statsService.getMonthlyStats(req.userId, year, month);
      res.json({
        success: true,
        period: 'monthly',
        year,
        month,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/stats/yearly?year=2026
   * Thống kê theo năm (mặc định năm hiện tại)
   */
  async getYearlyStats(req, res) {
    try {
      const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
      
      const stats = await statsService.getYearlyStats(req.userId, year);
      res.json({
        success: true,
        period: 'yearly',
        year,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/stats/range?startDate=2026-01-01&endDate=2026-01-31
   * Thống kê theo khoảng thời gian tùy chọn
   */
  async getRangeStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: 'Both startDate and endDate are required' 
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return res.status(400).json({ 
          error: 'startDate must be before or equal to endDate' 
        });
      }

      const stats = await statsService.getRangeStats(req.userId, start, end);
      res.json({
        success: true,
        period: 'custom',
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        days: Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/stats/overview
   * Tổng quan tất cả thống kê (all-time)
   */
  async getOverview(req, res) {
    try {
      const stats = await statsService.getOverview(req.userId);
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/stats/trends?period=week&limit=12
   * Xu hướng theo thời gian (để vẽ chart)
   */
  async getTrends(req, res) {
    try {
      const { period = 'week', limit = 12 } = req.query;
      
      if (!['day', 'week', 'month'].includes(period)) {
        return res.status(400).json({ 
          error: 'period must be one of: day, week, month' 
        });
      }

      const stats = await statsService.getTrends(req.userId, period, parseInt(limit));
      res.json({
        success: true,
        period,
        limit: parseInt(limit),
        trends: stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Helper: Lấy ngày đầu tuần (Monday)
  _getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }
}

module.exports = new StatsController();