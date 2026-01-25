const Joi = require('joi');

const areaSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('').optional(),
  color: Joi.number().integer().required(),
  icon: Joi.number().integer().required()
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
  areaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('').optional(),
  color: Joi.number().integer().required(),
  icon: Joi.number().integer().required(),
  startDate: Joi.date().optional().allow(null),
  endDate: Joi.date().optional().allow(null).min(Joi.ref('startDate')),
  hideCompleted: Joi.boolean().optional(),
  energyLevel: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  calendarSync: Joi.boolean().optional()
});

const checklistItemSchema = Joi.object({
  _id: Joi.string().optional(),
  text: Joi.string().required(),
  checked: Joi.boolean().default(false)
});

const cardSchema = Joi.object({
  areaId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  projectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  folderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  title: Joi.string().min(1).required(),
  content: Joi.string().allow('').optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('todo', 'doing', 'done', 'pending').optional(),
  energyLevel: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  dueDate: Joi.date().optional().allow(null),
  reminder: Joi.date().optional().allow(null),
  link: Joi.string().uri().optional().allow(null),
  imageUrl: Joi.string().uri().optional().allow(null),
  checklist: Joi.array().items(checklistItemSchema).optional()
});

const checklistUpdateSchema = Joi.object({
  checklist: Joi.array().items(checklistItemSchema).required()
});

const convertToTaskSchema = Joi.object({
  dueDate: Joi.date().required(),
  projectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  status: Joi.string().valid('todo', 'doing', 'done', 'pending').optional()
});

const convertToNoteSchema = Joi.object({
  folderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().allow(null)
});

const blockContentSchema = Joi.object({
  // Text/Heading
  text: Joi.string().allow('').optional(),
  
  // Image
  imageUrl: Joi.string().uri().optional(),
  imageCaption: Joi.string().allow('').optional(),
  
  // Audio
  audioUrl: Joi.string().uri().optional(),
  audioDuration: Joi.number().optional(),
  
  // Checkbox
  checked: Joi.boolean().optional(),
  label: Joi.string().optional(),
  
  // List
  items: Joi.array().items(Joi.object({
    text: Joi.string().required(),
    checked: Joi.boolean().optional()
  })).optional()
}).optional();

const blockSchema = Joi.object({
  _id: Joi.string().optional(),
  type: Joi.string().valid('text', 'image', 'audio', 'checkbox', 'heading', 'list').required(),
  order: Joi.number().required(),
  content: blockContentSchema,
  metadata: Joi.object().optional()
});

const addBlockSchema = Joi.object({
  type: Joi.string().valid('text', 'image', 'audio', 'checkbox', 'heading', 'list').required(),
  content: blockContentSchema.required(),
  order: Joi.number().optional(),
  isPinned: Joi.boolean().optional().default(false)
});

const updateBlockSchema = Joi.object({
  content: blockContentSchema.required()
});

const reorderBlocksSchema = Joi.object({
  blockOrders: Joi.array().items(Joi.object({
    blockId: Joi.string().required(),
    order: Joi.number().required()
  })).required()
});

const updateAllBlocksSchema = Joi.object({
  blocks: Joi.array().items(blockSchema).required()
});

const blocksSortPreferenceSchema = Joi.object({
  sortBy: Joi.string().valid('order', 'createdAt', 'updatedAt').required(),
  sortOrder: Joi.string().valid('asc', 'desc').required()
});


module.exports = {
  areaSchema,
  folderSchema,
  projectSchema,
  cardSchema,
  checklistUpdateSchema,
  convertToTaskSchema,
  convertToNoteSchema,
  addBlockSchema,
  updateBlockSchema,
  reorderBlocksSchema,
  updateAllBlocksSchema,
  blocksSortPreferenceSchema
};