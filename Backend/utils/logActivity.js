
const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({
  actorId,
  actorRole,
  action,
  description,
  targetId = null,
  targetLabel = null,
  changes = null,
  outcome = "success",
}) => {
  try {
    await ActivityLog.create({
      actorId,
      actorRole,
      action,
      description,
      targetId,
      targetLabel,
      changes,
      outcome,
    });
  } catch (error) {
    // Logging failures should not crash the application.
    console.error("ACTIVITY LOG ERROR:", error.message);
  }
};

module.exports = logActivity;
