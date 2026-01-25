const cardService = require("../services/card.service");

class CardController {
  async getAll(req, res) {
    try {
      const {
        projectId,
        folderId,
        areaId,
        status,
        isArchived,
        search,
        page = 1,
        limit = 20,
      } = req.query;
      const filters = {
        projectId,
        folderId,
        areaId,
        status,
        isArchived,
        search,
      };

      const result = await cardService.getAll(
        req.userId,
        filters,
        parseInt(page),
        parseInt(limit),
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const card = await cardService.getById(req.params.id, req.userId);
      res.json(card);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const card = await cardService.create(req.userId, req.body);
      res.status(201).json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const card = await cardService.update(
        req.params.id,
        req.userId,
        req.body,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await cardService.delete(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async move(req, res) {
    try {
      const { targetProjectId } = req.body;
      const card = await cardService.move(
        req.params.id,
        req.userId,
        targetProjectId,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateChecklist(req, res) {
    try {
      const { checklist } = req.body;
      const card = await cardService.updateChecklist(
        req.params.cardId,
        req.userId,
        checklist,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getByFolder(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await cardService.getByFolder(
        req.userId,
        req.params.folderId,
        parseInt(page),
        parseInt(limit),
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/cards/:id/convert-to-task
   * Chuyển note thành task bằng cách set dueDate
   * Body: { dueDate: Date, projectId?: ObjectId, status?: string }
   */
  async convertToTask(req, res) {
    try {
      const { dueDate, projectId, status } = req.body;

      if (!dueDate) {
        return res.status(400).json({
          error: "dueDate is required to convert note to task",
        });
      }

      const card = await cardService.convertToTask(
        req.params.id,
        req.userId,
        dueDate,
        projectId,
        status,
      );

      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/cards/:id/convert-to-note
   * Chuyển task thành note bằng cách xóa dueDate
   * Body: { folderId?: ObjectId }
   */
  async convertToNote(req, res) {
    try {
      const { folderId } = req.body;

      const card = await cardService.convertToNote(
        req.params.id,
        req.userId,
        folderId,
      );

      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async addBlock(req, res) {
    try {
      const { type, content, order } = req.body;

      if (!["text", "image", "audio", "checkbox"].includes(type)) {
        return res.status(400).json({ error: "Invalid block type" });
      }

      const card = await cardService.addBlock(req.params.id, req.userId, {
        type,
        content,
        order,
      });

      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateBlock(req, res) {
    try {
      const { content } = req.body;
      const card = await cardService.updateBlock(
        req.params.id,
        req.userId,
        req.params.blockId,
        content,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteBlock(req, res) {
    try {
      const card = await cardService.deleteBlock(
        req.params.id,
        req.userId,
        req.params.blockId,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async reorderBlocks(req, res) {
    try {
      const { blockOrders } = req.body; // [{ blockId, order }]
      const card = await cardService.reorderBlocks(
        req.params.id,
        req.userId,
        blockOrders,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateAllBlocks(req, res) {
    try {
      const { blocks } = req.body;
      const card = await cardService.updateAllBlocks(
        req.params.id,
        req.userId,
        blocks,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async uploadBlockFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const fileInfo = {
        url: fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };

      res.json(fileInfo);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // controllers/card.controller.js - Thêm methods

  async pinBlock(req, res) {
    try {
      const card = await cardService.pinBlock(
        req.params.id,
        req.userId,
        req.params.blockId,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async unpinBlock(req, res) {
    try {
      const card = await cardService.unpinBlock(
        req.params.id,
        req.userId,
        req.params.blockId,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async togglePinBlock(req, res) {
    try {
      const card = await cardService.togglePinBlock(
        req.params.id,
        req.userId,
        req.params.blockId,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateBlocksSortPreference(req, res) {
    try {
      const { sortBy, sortOrder } = req.body;
      const card = await cardService.updateBlocksSortPreference(
        req.params.id,
        req.userId,
        sortBy,
        sortOrder,
      );
      res.json(card);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getBlocksSorted(req, res) {
    try {
      const { sortBy, sortOrder } = req.query;
      const blocks = await cardService.getBlocksSorted(
        req.params.id,
        req.userId,
        sortBy,
        sortOrder,
      );
      res.json({ blocks });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CardController();
