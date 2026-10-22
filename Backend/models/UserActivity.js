
const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Overall engagement
    totalActiveSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalActions: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Activity history
    firstActivityAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: null,
    },

    // Session statistics
    totalSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageSessionSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestSessionSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Action breakdown
    actionCounts: {
      taskCreated: { type: Number, default: 0 },
      taskUpdated: { type: Number, default: 0 },
      taskDeleted: { type: Number, default: 0 },
      taskCompleted: { type: Number, default: 0 },
      searches: { type: Number, default: 0 },
      searchDeleted: { type: Number, default: 0 },
      historyCleared: { type: Number, default: 0 },
      favoriteAdded: { type: Number, default: 0 },
      favoriteRemoved: { type: Number, default: 0 },
      locationViews: { type: Number, default: 0 },
      profileUpdated: { type: Number, default: 0 },
      avatarChanged: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },

    // Daily usage for analytics charts
    dailyUsage: [
      {
        date: {
          type: String,
          required: true,
        },
        activeSeconds: {
          type: Number,
          default: 0,
        },
        actions: {
          type: Number,
          default: 0,
        },
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
  }
);

userActivitySchema.index({ lastActivityAt: -1 });

module.exports = mongoose.model(
  "UserActivity",
  userActivitySchema
);
