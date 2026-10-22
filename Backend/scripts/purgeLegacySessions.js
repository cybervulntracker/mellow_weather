// One-off clean-up for sessions created before remote sign-out existed (they have no session id, so
// "Sign out all devices" cannot reach them). This closes those rows and signs everybody in again.
//   node scripts/purgeLegacySessions.js          -> shows what would change
//   node scripts/purgeLegacySessions.js --apply  -> does it
require("dotenv").config();
const mongoose = require("mongoose");
const UserSession = require("../models/UserSession");

(async () => {
  await mongoose.connect(process.env.DBURL);
  const filter = { endedAt: null, $or: [{ sid: "" }, { sid: { $exists: false } }] };
  const count = await UserSession.countDocuments(filter);
  console.log(`${count} open session record(s) have no session id.`);
  if (process.argv.includes("--apply") && count) {
    await UserSession.updateMany(filter, { $set: { endedAt: new Date(), endReason: "expired" } });
    // the express-session store is the "sessions" collection; clearing it makes everyone sign in once more
    await mongoose.connection.collection("sessions").deleteMany({});
    console.log("Closed them and cleared stored sessions. Everyone signs in again once.");
  } else if (count) console.log("Run again with --apply to close them.");
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
