const cron = require('node-cron');
const notificationService = require('../services/notification.service');

/**
 * Cron job để scan và tạo thông báo tự động
 * Chạy mỗi 15 phút
 */
function initNotificationCronJob() {
  // Chạy mỗi 15 phút
  cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Running notification scan...');
    try {
      const results = await notificationService.scanAndCreateNotifications();
      console.log('✅ Notification scan completed:', results);
    } catch (error) {
      console.error('❌ Notification scan failed:', error.message);
    }
  });

  // Chạy ngay khi server khởi động (sau 30s)
  setTimeout(async () => {
    console.log('🚀 Running initial notification scan...');
    try {
      await notificationService.scanAndCreateNotifications();
    } catch (error) {
      console.error('❌ Initial notification scan failed:', error.message);
    }
  }, 30000);

  console.log('✅ Notification cron job initialized (runs every 15 minutes)');
}

module.exports = { initNotificationCronJob };