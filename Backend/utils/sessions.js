const UserSession = require("../models/UserSession");

const destroyInStore = (store, sid) => new Promise((resolve) => store.destroy(sid, () => resolve()));

// Signs a person out of their devices. Pass `exceptSid` to keep the current one.
async function revokeSessions(store, userId, exceptSid = null) {
  const filter = { userId, endedAt: null };
  if (exceptSid) filter.sid = { $ne: exceptSid };
  const open = await UserSession.find(filter);

  for (const session of open) {
    if (session.sid) await destroyInStore(store, session.sid);
  }
  if (open.length) {
    await UserSession.updateMany({ _id: { $in: open.map((s) => s._id) } }, { $set: { endedAt: new Date(), endReason: "revoked" } });
  }
  return open.length;
}

module.exports = { revokeSessions, destroyInStore };
