const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { heartbeat } = require("../utils/sessionTracker");

const router = express.Router();

// The browser calls this every ~30s while the person is actually using the
// site (tab visible + recent mouse/keyboard/touch). That is "active time".
router.post("/heartbeat", requireAuth, async (req, res) => {
  try {
    const credited = await heartbeat(req, req.body.seconds, req.body.page);
    res.json({ ok: true, credited });
  } catch (error) {
    console.error("HEARTBEAT ERROR:", error.message);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
