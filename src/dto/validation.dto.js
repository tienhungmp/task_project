const Joi = require('joi');

const areaSchema = Joi.object({
  name: Joi.string().min(1).required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional()
});

const folderSchema = Joi.object({
  areaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  parentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  name: Joi.string().min(1).required(),
  password: Joi.string().min(4).optional()
});

const projectSchema = Joi.object({
  folderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  name: Joi.string().min(1).required(),
  hideCompleted: Joi.boolean().optional(),
  energyLevel: Joi.string().valid('low', 'medium', 'high').optional(),
  calendarSync: Joi.boolean().optional()
});

const cardSchema = Joi.object({
  areaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  projectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  folderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  title: Joi.string().min(1).required(),
  content: Joi.string().allow('').optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('todo', 'doing', 'done').optional(),
  energyLevel: Joi.string().valid('low', 'medium', 'high').optional(),
  dueDate: Joi.date().optional().allow(null),
  reminder: Joi.date().optional().allow(null),
  blocks: Joi.array().items(Joi.object({
    type: Joi.string().valid('text', 'checklist', 'table', 'media').required(),
    content: Joi.any().required(),
    isCompleted: Joi.boolean().optional(),
    order: Joi.number().optional()
  })).optional()
});

const blocksUpdateSchema = Joi.object({
  blocks: Joi.array().items(Joi.object({
    _id: Joi.string().optional(),
    type: Joi.string().valid('text', 'checklist', 'table', 'media').required(),
    content: Joi.any().required(),
    isCompleted: Joi.boolean().optional(),
    order: Joi.number().required()
  })).required()
});

module.exports = {
  areaSchema,
  folderSchema,
  projectSchema,
  cardSchema,
  blocksUpdateSchema
};