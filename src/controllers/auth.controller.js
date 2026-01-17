const authService = require('../services/auth.service');

class AuthController {
  async register(req, res) {
    try {
      const { email, password, name, bio } = req.body;
      const avatarUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/default-avatar.png';

      const result = await authService.register(email, password, name, avatarUrl, bio);

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);

      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }
}

module.exports = new AuthController();