const userService = require('../services/user.service');

class UserController {
  async getProfile(req, res) {
    try {
      const user = await userService.getProfile(req.userId);
      res.json(user);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const user = await userService.updateProfile(req.userId, req.body);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Avatar file is required' });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;
      const user = await userService.updateAvatar(req.userId, avatarUrl);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await userService.changePassword(req.userId, currentPassword, newPassword);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new UserController();