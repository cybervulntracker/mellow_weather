const requireAuth = require("./requireAuth");

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
};

module.exports = requireAdmin;
