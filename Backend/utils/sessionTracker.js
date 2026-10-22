const UserSession = require("../models/UserSession");
const UserActivity = require("../models/UserActivity");
const { bumpDaily } = require("./recordActivity");
const { getClientInfo } = require("./clientInfo");

const LIVE_WINDOW_MS = 90 * 1000; // a user is "online" if we heard from them in the last 90s

async function startSession(req, user) {
  const now = new Date();
  const doc = await UserSession.create({ userId: user._id, startedAt: now, lastSeenAt: now, sid: req.sessionID, ...getClientInfo(req) });

  await UserActivity.findOneAndUpdate(
    { userId: user._id },
    {
      $set: { lastActivityAt: now },
      $setOnInsert: { userId: user._id, firstActivityAt: now },
      $inc: { totalSessions: 1 },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  req.session.trackId = String(doc._id);
  return doc;
}

async function endSession(trackId, reason = "logout") {
  if (!trackId) return;
  await UserSession.updateOne({ _id: trackId, endedAt: null }, { $set: { endedAt: new Date(), endReason: reason } });
}

// The browser reports "I was active for N seconds". We never trust N blindly:
// it is capped by the real time since we last heard from this session.
async function heartbeat(req, seconds, page = "") {
  const now = new Date();
  let session = req.session.trackId ? await UserSession.findById(req.session.trackId) : null;

  // Logged in before tracking existed, or the session was closed — open a fresh one
  if (!session || session.endedAt) session = await startSession(req, req.user);

  const elapsed = Math.max(0, (now - session.lastSeenAt) / 1000);
  const claimed = Math.max(0, Math.min(Number(seconds) || 0, 60));
  const credit = Math.round(Math.min(claimed, elapsed + 2));

  session.activeSeconds += credit;
  session.lastSeenAt = now;
  if (page) session.currentPage = String(page).slice(0, 80);
  await session.save();

  if (credit > 0) {
    const activity = await UserActivity.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: { lastActivityAt: now },
        $setOnInsert: { userId: req.user._id, firstActivityAt: now },
        $inc: { totalActiveSeconds: credit },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await bumpDaily(req.user._id, { activeSeconds: credit });

    const sessions = Math.max(activity.totalSessions, 1);
    await UserActivity.updateOne(
      { userId: req.user._id },
      {
        $set: {
          averageSessionSeconds: Math.round(activity.totalActiveSeconds / sessions),
          longestSessionSeconds: Math.max(activity.longestSessionSeconds || 0, session.activeSeconds),
        },
      }
    );
  }
  return credit;
}

module.exports = { startSession, endSession, heartbeat, LIVE_WINDOW_MS };
