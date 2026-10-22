
const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    actorRole: {
      type: String,
      enum: ["admin", "user"],
      required: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
    },

    targetId: {
      type: String,
      default: null,
    },

    targetLabel: {
      type: String,
      default: null,
    },

    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    outcome: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
    },

    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

activityLogSchema.index({
  actorId: 1,
  occurredAt: -1,
});

module.exports = mongoose.model(
  "ActivityLog",
  activityLogSchema
);
