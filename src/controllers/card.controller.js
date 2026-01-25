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
  // card.controller.js - Thêm method mới

  /**
   * POST /api/cards/:id/blocks/with-file
   * Tạo block và upload file trong 1 request duy nhất
   * Body (multipart/form-data):
   *   - file: File (image/audio)
   *   - type: string (image/audio)
   *   - order: number (optional)
   *   - caption: string (optional - cho image)
   *   - isPinned: boolean (optional)
   */
  async addBlockWithFile(req, res) {
    try {
      const { type, order, caption, isPinned } = req.body;

      // Validate type
      if (!["image", "audio"].includes(type)) {
        return res.status(400).json({
          error:
            "Invalid block type. Must be image or audio when uploading file",
        });
      }

      // Check file
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      // Prepare block content based on type
      const fileUrl = `/uploads/${req.file.filename}`;
      let content = {};

      if (type === "image") {
        content = {
          imageUrl: fileUrl,
          imageCaption: caption || "",
        };
      } else if (type === "audio") {
        content = {
          audioUrl: fileUrl,
          audioDuration: 0, // Client có thể update sau
        };
      }

      // Create block data
      const blockData = {
        type,
        order: order ? parseInt(order) : undefined,
        isPinned: isPinned === "true" || isPinned === true,
        content,
        metadata: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      };

      // Add block to card
      const card = await cardService.addBlock(
        req.params.id,
        req.userId,
        blockData,
      );

      res.json({
        success: true,
        card,
        block: card.blocks[card.blocks.length - 1], // Return newly created block
        fileInfo: {
          url: fileUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error) {
      // Clean up uploaded file if error occurs
      if (req.file) {
        const fs = require("fs");
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PUT /api/cards/:id/blocks/:blockId/file
   * Update block với file mới (replace file cũ)
   * Body (multipart/form-data):
   *   - file: File (image/audio)
   *   - caption: string (optional - cho image)
   */
  async updateBlockFile(req, res) {
    try {
      const { caption } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      // Get current block to determine type and delete old file
      const card = await cardService.getById(req.params.id, req.userId);
      const block = card.blocks.find(
        (b) => b._id.toString() === req.params.blockId,
      );

      if (!block) {
        return res.status(404).json({ error: "Block not found" });
      }

      if (!["image", "audio"].includes(block.type)) {
        return res.status(400).json({
          error: "Can only update file for image or audio blocks",
        });
      }

      // Delete old file if exists
      const fs = require("fs");
      const path = require("path");
      if (block.content?.imageUrl) {
        const oldFilePath = path.join(
          __dirname,
          "../../",
          block.content.imageUrl,
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } else if (block.content?.audioUrl) {
        const oldFilePath = path.join(
          __dirname,
          "../../",
          block.content.audioUrl,
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Prepare new content
      const fileUrl = `/uploads/${req.file.filename}`;
      let content = { ...block.content };

      if (block.type === "image") {
        content.imageUrl = fileUrl;
        if (caption !== undefined) {
          content.imageCaption = caption;
        }
      } else if (block.type === "audio") {
        content.audioUrl = fileUrl;
      }

      // Update metadata
      content.metadata = {
        ...content.metadata,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };

      // Update block
      const updatedCard = await cardService.updateBlock(
        req.params.id,
        req.userId,
        req.params.blockId,
        content,
      );

      res.json({
        success: true,
        card: updatedCard,
        fileInfo: {
          url: fileUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error) {
      // Clean up uploaded file if error occurs
      if (req.file) {
        const fs = require("fs");
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CardController();
