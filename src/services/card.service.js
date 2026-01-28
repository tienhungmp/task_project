const Card = require("../models/Card");
const Project = require("../models/Project");
const notificationService = require("./notification.service");

class CardService {
  async getAll(userId, filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = { deletedAt: null };

    if (filters.projectId) {
      const access = await this._checkProjectAccess(filters.projectId, userId);
      if (!access.hasAccess) {
        throw new Error("You do not have access to this project");
      }

      query.projectId = filters.projectId;

      if (access.permission === "owner") {
        query.userId = userId;
      }
    } else {
      query.userId = userId;
    }

    if (filters.folderId) query.folderId = filters.folderId;
    if (filters.areaId) query.areaId = filters.areaId;
    if (filters.status) query.status = filters.status;
    if (filters.isArchived !== undefined)
      query.isArchived = filters.isArchived === "true";

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const [cards, total] = await Promise.all([
      Card.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("areaId", "name color icon")
        .populate("folderId", "name color icon")
        .populate("projectId", "name color icon")
        .lean(),
      Card.countDocuments(query),
    ]);

    return {
      cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getByFolder(userId, folderId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = {
      userId,
      folderId,
      deletedAt: null,
      isArchived: false,
    };

    const [cards, total] = await Promise.all([
      Card.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("areaId", "name color icon")
        .populate("folderId", "name color icon")
        .lean(),
      Card.countDocuments(query),
    ]);

    return {
      cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id, userId) {
    const card = await Card.findOne({ _id: id, deletedAt: null }).lean();
    if (!card) {
      throw new Error("Card not found");
    }

    if (card.userId?.toString() === userId.toString()) {
      return card;
    }

    if (card.projectId) {
      const access = await this._checkProjectAccess(card.projectId, userId);
      if (access.hasAccess) {
        return card;
      }
    }

    throw new Error("You do not have access to this card");
  }

  async create(userId, data) {
    const card = new Card({ userId, ...data });
    await card.save();

    // Tạo thông báo nếu task có dueDate hoặc reminder
    this._checkAndCreateNotifications(card._id, userId);

    return card;
  }

  async update(id, userId, data) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      data,
      { new: true, runValidators: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    // Kiểm tra và tạo thông báo nếu dueDate hoặc reminder thay đổi
    this._checkAndCreateNotifications(card._id, userId);

    return card;
  }

  async delete(id, userId) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date(), isArchived: true },
      { new: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async archive(id, userId) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { isArchived: true },
      { new: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async unarchive(id, userId) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { isArchived: false },
      { new: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async move(id, userId, targetProjectId) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { projectId: targetProjectId },
      { new: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async updateChecklist(id, userId, checklist) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { checklist },
      { new: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async search(userId, query, tags = [], dateFrom, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const filter = { userId, deletedAt: null };

    if (query) {
      filter.$text = { $search: query };
    }

    if (tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (dateFrom) {
      filter.createdAt = { $gte: new Date(dateFrom) };
    }

    const [cards, total] = await Promise.all([
      Card.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Card.countDocuments(filter),
    ]);

    return {
      cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async convertToTask(id, userId, dueDate, projectId = null, status = "todo") {
    const card = await Card.findOne({ _id: id, userId, deletedAt: null });

    if (!card) {
      throw new Error("Card not found");
    }

    if (card.dueDate) {
      throw new Error("Card is already a task");
    }

    const updates = {
      dueDate: new Date(dueDate),
      status: status || "todo",
    };

    if (projectId) {
      updates.projectId = projectId;
      updates.folderId = null;
    }

    const updatedCard = await Card.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    // Tạo thông báo cho task mới
    this._checkAndCreateNotifications(updatedCard._id, userId);

    return updatedCard;
  }

  async convertToNote(id, userId, folderId = null) {
    const card = await Card.findOne({ _id: id, userId, deletedAt: null });

    if (!card) {
      throw new Error("Card not found");
    }

    if (!card.dueDate) {
      throw new Error("Card is already a note");
    }

    const updates = {
      dueDate: null,
      reminder: null,
      status: "todo",
    };

    if (folderId) {
      updates.folderId = folderId;
      updates.projectId = null;
    }

    const updatedCard = await Card.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return updatedCard;
  }

  /**
   * Helper method để kiểm tra và tạo thông báo
   * Chạy async không cần await để không block request
   */
  _checkAndCreateNotifications(cardId, userId) {
    // Chạy async, không block
    setImmediate(async () => {
      try {
        // Kiểm tra task sắp đến hạn
        await notificationService.createDueSoonNotification(cardId, userId);

        // Kiểm tra task quá hạn
        await notificationService.createOverdueNotification(cardId, userId);

        // Kiểm tra reminder
        await notificationService.createReminderNotification(cardId, userId);
      } catch (error) {
        console.error("Error creating notifications:", error);
      }
    });
  }

  async _checkProjectAccess(projectId, userId) {
    const project = await Project.findById(projectId);
    if (!project) {
      return { hasAccess: false, permission: null };
    }

    return project.hasAccess(userId);
  }

  // services/card.service.js - thêm methods

  async addBlock(cardId, userId, blockData) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    // Auto-increment order if not provided
    if (blockData.order === undefined) {
      const maxOrder =
        card.blocks.length > 0
          ? Math.max(...card.blocks.map((b) => b.order))
          : -1;
      blockData.order = maxOrder + 1;
    }

    const newBlock = {
      type: blockData.type,
      order: blockData.order,
      content: blockData.content,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    card.blocks.push(newBlock);
    await card.save();

    return card;
  }

  async updateBlock(cardId, userId, blockId, content) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    const block = card.blocks.id(blockId);
    if (!block) {
      throw new Error("Block not found");
    }

    block.content = { ...block.content, ...content };
    block.metadata.updatedAt = new Date();

    await card.save();
    return card;
  }

  async deleteBlock(cardId, userId, blockId) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    const blockIndex = card.blocks.findIndex(
      (b) => b._id.toString() === blockId,
    );
    if (blockIndex === -1) {
      throw new Error("Block not found");
    }

    // Remove block
    card.blocks.splice(blockIndex, 1);

    // Reorder remaining blocks
    card.blocks.forEach((block, index) => {
      block.order = index;
    });

    await card.save();
    return card;
  }

  async reorderBlocks(cardId, userId, blockOrders) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    // Update order for each block
    blockOrders.forEach(({ blockId, order }) => {
      const block = card.blocks.id(blockId);
      if (block) {
        block.order = order;
      }
    });

    // Sort blocks by order
    card.blocks.sort((a, b) => a.order - b.order);

    await card.save();
    return card;
  }

  async updateAllBlocks(cardId, userId, blocks) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    // Replace all blocks
    card.blocks = blocks.map((block, index) => ({
      ...block,
      order: index,
      metadata: {
        ...block.metadata,
        updatedAt: new Date(),
      },
    }));

    await card.save();
    return card;
  }

  // services/card.service.js - Thêm methods

  async pinBlock(cardId, userId, blockId) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    const block = card.blocks.id(blockId);
    if (!block) {
      throw new Error("Block not found");
    }

    if (block.isPinned) {
      throw new Error("Block is already pinned");
    }

    block.isPinned = true;
    block.pinnedAt = new Date();
    block.metadata.updatedAt = new Date();

    await card.save();
    return card;
  }

  async unpinBlock(cardId, userId, blockId) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    const block = card.blocks.id(blockId);
    if (!block) {
      throw new Error("Block not found");
    }

    if (!block.isPinned) {
      throw new Error("Block is not pinned");
    }

    block.isPinned = false;
    block.pinnedAt = null;
    block.metadata.updatedAt = new Date();

    await card.save();
    return card;
  }

  async togglePinBlock(cardId, userId, blockId) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    const block = card.blocks.id(blockId);
    if (!block) {
      throw new Error("Block not found");
    }

    block.isPinned = !block.isPinned;
    block.pinnedAt = block.isPinned ? new Date() : null;
    block.metadata.updatedAt = new Date();

    await card.save();
    return card;
  }

  async updateBlocksSortPreference(cardId, userId, sortBy, sortOrder) {
    const validSortBy = ["order", "createdAt", "updatedAt"];
    const validSortOrder = ["asc", "desc"];

    if (!validSortBy.includes(sortBy)) {
      throw new Error(
        "Invalid sortBy value. Must be: order, createdAt, or updatedAt",
      );
    }

    if (!validSortOrder.includes(sortOrder)) {
      throw new Error("Invalid sortOrder value. Must be: asc or desc");
    }

    const card = await Card.findOneAndUpdate(
      { _id: cardId, userId, deletedAt: null },
      {
        blocksSortBy: sortBy,
        blocksSortOrder: sortOrder,
      },
      { new: true },
    );

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async getBlocksSorted(cardId, userId, sortBy = null, sortOrder = null) {
    const card = await Card.findOne({
      _id: cardId,
      userId,
      deletedAt: null,
    }).lean();
    if (!card) {
      throw new Error("Card not found");
    }

    if (!card.blocks || card.blocks.length === 0) {
      return [];
    }

    // Use provided sort or card's default
    const finalSortBy = sortBy || card.blocksSortBy || "order";
    const finalSortOrder = sortOrder || card.blocksSortOrder || "asc";

    return this._sortBlocks(card.blocks, finalSortBy, finalSortOrder);
  }

  _sortBlocks(blocks, sortBy, sortOrder) {
    if (!blocks || blocks.length === 0) return [];

    const blocksCopy = [...blocks];

    // Separate pinned and unpinned
    const pinnedBlocks = blocksCopy.filter((b) => b.isPinned);
    const unpinnedBlocks = blocksCopy.filter((b) => !b.isPinned);

    // Sort pinned blocks by pinnedAt (newest first - always)
    pinnedBlocks.sort((a, b) => {
      return new Date(b.pinnedAt) - new Date(a.pinnedAt);
    });

    // Sort unpinned blocks
    unpinnedBlocks.sort((a, b) => {
      let aVal, bVal;

      if (sortBy === "order") {
        aVal = a.order;
        bVal = b.order;
      } else if (sortBy === "createdAt") {
        aVal = new Date(a.metadata.createdAt);
        bVal = new Date(b.metadata.createdAt);
      } else if (sortBy === "updatedAt") {
        aVal = new Date(a.metadata.updatedAt);
        bVal = new Date(b.metadata.updatedAt);
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Pinned blocks always on top
    return [...pinnedBlocks, ...unpinnedBlocks];
  }

  // Update addBlock to set createdAt
  async addBlock(cardId, userId, blockData) {
    const card = await Card.findOne({ _id: cardId, userId, deletedAt: null });
    if (!card) {
      throw new Error("Card not found");
    }

    // Auto-increment order if not provided
    if (blockData.order === undefined) {
      const maxOrder =
        card.blocks.length > 0
          ? Math.max(...card.blocks.map((b) => b.order))
          : -1;
      blockData.order = maxOrder + 1;
    }

    const now = new Date();
    const newBlock = {
      type: blockData.type,
      order: blockData.order,
      isPinned: blockData.isPinned || false,
      pinnedAt: blockData.isPinned ? now : null,
      content: blockData.content,
      metadata: {
        createdAt: now,
        updatedAt: now,
        ...blockData.metadata,
      },
    };

    card.blocks.push(newBlock);
    await card.save();

    return card;
  }
}

module.exports = new CardService();
