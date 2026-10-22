const { rateLimit } = require("express-rate-limit");

// Limits are per client IP. Set TRUST_PROXY in .env when running behind a proxy, or every
// visitor would look like the proxy and share one limit.
const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message, code: "RATE_LIMITED" },
    // Tests and local scripts can switch limits off
    skip: () => process.env.DISABLE_RATE_LIMIT === "1",
  });

const apiLimiter = make(60 * 1000, Number(process.env.API_RATE_LIMIT) || 240, "Too many requests. Please slow down for a moment.");
// /api/auth covers login, register, reset links, 2FA codes...
const authLimiter = make(15 * 60 * 1000, Number(process.env.AUTH_RATE_LIMIT) || 60, "Too many sign-in attempts. Please try again in a few minutes.");

module.exports = { apiLimiter, authLimiter };
