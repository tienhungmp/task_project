const Joi = require('joi');

const areaSchema = Joi.object({
  name: Joi.string().min(1).required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional()
});

const folderSchema = Joi.object({
  areaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  parentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('').optional(),
  color: Joi.number().integer().required(),
  icon: Joi.number().integer().required(),
  password: Joi.string().min(4).optional()
});

const projectSchema = Joi.object({
  folderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  name: Joi.string().min(1).required(),
  hideCompleted: Joi.boolean().optional(),
  energyLevel: Joi.string().valid('low', 'medium', 'high').optional(),
  calendarSync: Joi.boolean().optional()
});

const checklistItemSchema = Joi.object({
  text: Joi.string().required(),
  checked: Joi.boolean().default(false)
});

const blockSchemaValidation = Joi.object({
  _id: Joi.string().optional(),
  type: Joi.string().valid('text', 'checklist', 'table', 'media', 'link').required(),
  order: Joi.number().required(),
  // TEXT block
  textContent: Joi.when('type', {
    is: 'text',
    then: Joi.string().required(),
    otherwise: Joi.forbidden()
  }),
  // CHECKLIST block
  checklistItems: Joi.when('type', {
    is: 'checklist',
    then: Joi.array().items(checklistItemSchema).min(1).required(),
    otherwise: Joi.forbidden()
  }),
  // TABLE block
  tableData: Joi.when('type', {
    is: 'table',
    then: Joi.array().items(Joi.array().items(Joi.string())).min(1).required(),
    otherwise: Joi.forbidden()
  }),
  // MEDIA block
  mediaUrl: Joi.when('type', {
    is: 'media',
    then: Joi.string().uri().required(),
    otherwise: Joi.forbidden()
  }),
  mediaType: Joi.when('type', {
    is: 'media',
    then: Joi.string().valid('image', 'video', 'audio', 'file').required(),
    otherwise: Joi.forbidden()
  }),
  mediaName: Joi.when('type', {
    is: 'media',
    then: Joi.string().required(),
    otherwise: Joi.forbidden()
  })
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
  blocks: Joi.array().items(blockSchemaValidation).optional()
});

const blocksUpdateSchema = Joi.object({
  blocks: Joi.array().items(blockSchemaValidation).required()
});

module.exports = {
  areaSchema,
  folderSchema,
  projectSchema,
  cardSchema,
  blocksUpdateSchema
};