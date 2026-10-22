const UserActivity = require("../models/UserActivity");
const DailyUsage = require("../models/DailyUsage");

// Every key here must exist in UserActivity.actionCounts
const allowedActions = [
  "taskCreated", "taskUpdated", "taskDeleted", "taskCompleted",
  "searches", "searchDeleted", "historyCleared",
  "favoriteAdded", "favoriteRemoved", "locationViews",
  "profileUpdated", "avatarChanged", "other",
];

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

// Adds to today's row for this user (created on first use that day)
async function bumpDaily(userId, { activeSeconds = 0, actions = 0 }) {
  await DailyUsage.updateOne(
    { userId, date: dayKey() },
    { $inc: { activeSeconds, actions } },
    { upsert: true }
  );
}

// Counts one action for the user (total + per-type + today)
const recordActivity = async (userId, actionType) => {
  if (!userId) return;
  const action = allowedActions.includes(actionType) ? actionType : "other";
  const now = new Date();

  await UserActivity.findOneAndUpdate(
    { userId },
    {
      $set: { lastActivityAt: now },
      $setOnInsert: { userId, firstActivityAt: now },
      $inc: { totalActions: 1, [`actionCounts.${action}`]: 1 },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await bumpDaily(userId, { actions: 1 });
};

module.exports = recordActivity;
module.exports.bumpDaily = bumpDaily;
module.exports.dayKey = dayKey;
