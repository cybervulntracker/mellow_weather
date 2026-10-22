const User = require("../models/Users");

// Checks the session cookie, loads the user onto req.user, and blocks
// suspended accounts on every request (so a suspension is instant).
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Please login first" });
    }

    const user = await User.findById(req.session.userId).select("-password");

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Account no longer exists" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "Your account has been suspended. Please contact an administrator.",
        code: "SUSPENDED",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = requireAuth;
