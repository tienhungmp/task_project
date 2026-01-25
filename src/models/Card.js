const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "image", "audio", "checkbox", "heading", "list"],
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    // NEW: Pin functionality
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    content: {
      // For text/heading
      text: String,

      // For image
      imageUrl: String,
      imageCaption: String,

      // For audio
      audioUrl: String,
      audioDuration: Number, // seconds

      // For checkbox
      checked: Boolean,
      label: String,

      // For list
      items: [
        {
          text: String,
          checked: Boolean, // for checklist style
        },
      ],
    },
    metadata: {
      // Common metadata
      createdAt: Date,
      updatedAt: Date,

      // File info (for image/audio)
      fileName: String,
      fileSize: Number,
      mimeType: String,
    },
  },
  { _id: true },
);

blockSchema.index({ isPinned: -1, "metadata.createdAt": -1 });

const checklistItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    checked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const cardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    areaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    blocks: {
      type: [blockSchema],
      default: [],
    },
    blocksSortBy: {
      type: String,
      enum: ["order", "createdAt", "updatedAt"],
      default: "order",
    },
    blocksSortOrder: {
      type: String,
      enum: ["asc", "desc"],
      default: "asc",
    },
    content: {
      type: String,
      default: "",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    attachments: [
      {
        url: String,
        name: String,
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["todo", "doing", "done", "pending"],
      default: "todo",
      index: true,
    },
    energyLevel: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    reminder: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    // New simplified fields
    link: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    checklist: {
      type: [checklistItemSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

cardSchema.virtual("sortedBlocks").get(function () {
  if (!this.blocks || this.blocks.length === 0) return [];

  const blocks = [...this.blocks];

  // Separate pinned and unpinned blocks
  const pinnedBlocks = blocks.filter((b) => b.isPinned);
  const unpinnedBlocks = blocks.filter((b) => !b.isPinned);

  // Sort pinned blocks by pinnedAt (newest first)
  pinnedBlocks.sort((a, b) => {
    return new Date(b.pinnedAt) - new Date(a.pinnedAt);
  });

  // Sort unpinned blocks based on preference
  const sortField =
    this.blocksSortBy === "createdAt"
      ? "metadata.createdAt"
      : this.blocksSortBy === "updatedAt"
        ? "metadata.updatedAt"
        : "order";

  unpinnedBlocks.sort((a, b) => {
    let aVal, bVal;

    if (sortField === "order") {
      aVal = a.order;
      bVal = b.order;
    } else if (sortField === "metadata.createdAt") {
      aVal = new Date(a.metadata.createdAt);
      bVal = new Date(b.metadata.createdAt);
    } else {
      aVal = new Date(a.metadata.updatedAt);
      bVal = new Date(b.metadata.updatedAt);
    }

    if (this.blocksSortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Pinned blocks always on top
  return [...pinnedBlocks, ...unpinnedBlocks];
});

cardSchema.virtual("isBlockBased").get(function () {
  return this.blocks && this.blocks.length > 0;
});

// Virtual to compute checklist completion
cardSchema.virtual("checklistProgress").get(function () {
  if (!this.checklist || this.checklist.length === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  const completed = this.checklist.filter((item) => item.checked).length;
  const total = this.checklist.length;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
});

cardSchema.set("toJSON", { virtuals: true });
cardSchema.set("toObject", { virtuals: true });

cardSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
cardSchema.index({ userId: 1, status: 1 });
cardSchema.index({ tags: 1 });
cardSchema.index({ title: "text", content: "text" });

module.exports = mongoose.model("Card", cardSchema);
