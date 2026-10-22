// Runs the notification scheduler (digests, rain alerts, alert rules, weekly report) as its own process.
// Use it when you run more than one copy of the website, or want notifications to keep working while the
// website restarts:
//   1. set RUN_SCHEDULER_IN_APP=0 in .env (the website then skips the scheduler)
//   2. run `npm run worker` (or `pm2 start worker.js`)
require("dotenv").config();
const mongoose = require("mongoose");
const { startScheduler, runNotificationTick } = require("./utils/scheduler");

(async () => {
  try {
    await mongoose.connect(process.env.DBURL);
    console.log("Worker connected to MongoDB");
    startScheduler({ keepAlive: true });
    await runNotificationTick(); // catch up straight away after a restart
  } catch (error) {
    console.error("Worker failed to start:", error.message);
    process.exit(1);
  }
})();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
