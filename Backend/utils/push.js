// Browser push notifications (Web Push + VAPID). Does nothing unless VAPID keys are in .env:
//   npx web-push generate-vapid-keys   ->  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

const enabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(`mailto:${process.env.CONTACT_EMAIL || "admin@example.com"}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

// Sends one push to every device of the user. Dead subscriptions (410/404) are removed.
async function sendPush(userId, { title, body, url = "/weather" }) {
  if (!enabled) return 0;
  const subs = await PushSubscription.find({ userId });
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title, body, url }), { TTL: 3600 });
        sent += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
        else console.error("PUSH ERROR:", error.statusCode || error.message);
      }
    })
  );
  return sent;
}

module.exports = { sendPush, pushEnabled: enabled };
