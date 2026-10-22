const SiteSettings = require("../models/SiteSettings");
const User = require("../models/Users");

// While maintenance mode is on, only admins can use the API. Sign-in, "who am I", sign-out and the
// public settings stay open so admins can log in and visitors can see the maintenance message.
const OPEN_PATHS = [/^\/auth\/(login|logout|me|two-factor|google)$/, /^\/public\//, /^\/health$/];

let cached = { at: 0, value: { on: false, message: "" } };
const CACHE_MS = 5000;

async function currentMode() {
  if (Date.now() - cached.at < CACHE_MS) return cached.value;
  const s = await SiteSettings.findOne({ key: "main" }).select("maintenanceMode maintenanceMessage").lean();
  cached = { at: Date.now(), value: { on: Boolean(s?.maintenanceMode), message: s?.maintenanceMessage || "" } };
  return cached.value;
}
// The admin settings route calls this after saving so the change is instant
const resetMaintenanceCache = () => { cached = { at: 0, value: cached.value }; };

async function maintenance(req, res, next) {
  try {
    const mode = await currentMode();
    if (!mode.on || OPEN_PATHS.some((rx) => rx.test(req.path))) return next();
    if (req.session?.userId) {
      const user = await User.findById(req.session.userId).select("role").lean();
      if (user?.role === "admin") return next();
    }
    return res.status(503).json({
      message: mode.message || "MellowWeather is down for maintenance. Please try again soon.",
      code: "MAINTENANCE",
    });
  } catch {
    next();
  }
}

module.exports = maintenance;
module.exports.resetMaintenanceCache = resetMaintenanceCache;
