const Card = require('../models/Card');

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
      Card.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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

  async updateBlocks(id, userId, blocks) {
    const card = await Card.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { blocks },
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
}

module.exports = new CardService();