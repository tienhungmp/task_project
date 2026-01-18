const Card = require('../models/Card');
const notificationService = require('./notification.service');

class CardService {
  async getAll(userId, filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = { userId, deletedAt: null };

    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.folderId) query.folderId = filters.folderId;
    if (filters.areaId) query.areaId = filters.areaId;
    if (filters.status) query.status = filters.status;
    if (filters.isArchived !== undefined) query.isArchived = filters.isArchived === 'true';

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const [cards, total] = await Promise.all([
      Card.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('areaId', 'name color icon')
        .populate('folderId', 'name color icon')
        .populate('projectId', 'name color icon')
        .lean(),
      Card.countDocuments(query)
    ]);

    return {
      cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getByFolder(userId, folderId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = { 
      userId, 
      folderId, 
      deletedAt: null,
      isArchived: false 
    };

    const [cards, total] = await Promise.all([
      Card.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('areaId', 'name color icon')
        .populate('folderId', 'name color icon')
        .lean(),
      Card.countDocuments(query)
    ]);

    return {
      cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getById(id, userId) {
    const card = await Card.findOne({ _id: id, userId, deletedAt: null }).lean();
    if (!card) {
      throw new Error('Card not found');
    }
    return card;
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
      { new: true, runValidators: true }
    );

    if (!card) {
      throw new Error('Card not found');
    }

    // Kiểm tra và tạo thông báo nếu dueDate hoặc reminder thay đổi
    this._checkAndCreateNotifications(card._id, userId);

    return card;
  }

  async delete(id, userId) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date(), isArchived: true },
      { new: true }
    );

    if (!card) {
      throw new Error('Card not found');
    }

    return card;
  }

  async move(id, userId, targetProjectId) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { projectId: targetProjectId },
      { new: true }
    );

    if (!card) {
      throw new Error('Card not found');
    }

    return card;
  }

  async updateChecklist(id, userId, checklist) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { checklist },
      { new: true }
    );

    if (!card) {
      throw new Error('Card not found');
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
      Card.countDocuments(filter)
    ]);

    return {
      cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async convertToTask(id, userId, dueDate, projectId = null, status = 'todo') {
    const card = await Card.findOne({ _id: id, userId, deletedAt: null });
    
    if (!card) {
      throw new Error('Card not found');
    }

    if (card.dueDate) {
      throw new Error('Card is already a task');
    }

    const updates = {
      dueDate: new Date(dueDate),
      status: status || 'todo'
    };

    if (projectId) {
      updates.projectId = projectId;
      updates.folderId = null;
    }

    const updatedCard = await Card.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    // Tạo thông báo cho task mới
    this._checkAndCreateNotifications(updatedCard._id, userId);

    return updatedCard;
  }

  async convertToNote(id, userId, folderId = null) {
    const card = await Card.findOne({ _id: id, userId, deletedAt: null });
    
    if (!card) {
      throw new Error('Card not found');
    }

    if (!card.dueDate) {
      throw new Error('Card is already a note');
    }

    const updates = {
      dueDate: null,
      reminder: null,
      status: 'todo'
    };

    if (folderId) {
      updates.folderId = folderId;
      updates.projectId = null;
    }

    const updatedCard = await Card.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

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
        console.error('Error creating notifications:', error);
      }
    });
  }
}

module.exports = new CardService();