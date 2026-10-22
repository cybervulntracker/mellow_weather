const logActivity = require("./logActivity");
const recordActivity = require("./recordActivity");
const UserSession = require("../models/UserSession");

// Maps an ActivityLog action to the counter in UserActivity.actionCounts
const COUNTER_FOR = {
  "weather.search": "searches",
  "weather.search_failed": "searches",
  "weather.view": "locationViews",
  "weather.history_deleted": "searchDeleted",
  "weather.history_cleared": "historyCleared",
  "favorite.added": "favoriteAdded",
  "favorite.removed": "favoriteRemoved",
  "profile.updated": "profileUpdated",
  "profile.avatar_changed": "avatarChanged",
  "profile.avatar_removed": "avatarChanged",
};

/**
 * One call records an action everywhere the admin panel looks:
 *   1. ActivityLog  -> the readable timeline
 *   2. UserActivity -> counters, "Actions" total, daily chart
 *   3. UserSession  -> actions in the current login session
 * It never throws, so a tracking problem can't break the real feature.
 */
async function track(req, { action, description, targetId = null, targetLabel = null, changes = null, outcome = "success", actor = null, count = true }) {
  try {
    const user = actor || req.user;
    if (!user) return;

    await logActivity({
      actorId: user._id,
      actorRole: user.role,
      action,
      description,
      targetId: targetId ? String(targetId) : null,
      targetLabel,
      changes,
      outcome,
    });

    if (count) {
      await recordActivity(user._id, COUNTER_FOR[action] || "other");
      if (req.session?.trackId) {
        await UserSession.updateOne({ _id: req.session.trackId }, { $inc: { actions: 1 } });
      }
    }
  } catch (error) {
    console.error("TRACK ERROR:", error.message);
  }
}

module.exports = track;
