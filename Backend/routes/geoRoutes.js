const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { searchPlaces } = require("../utils/geo");

const router = express.Router();

// Autocomplete: returns ranked candidates (city, state, country, exact coordinates)
router.get("/search", requireAuth, async (req, res) => {
  try {
    const query = String(req.query.q || "").slice(0, 100);
    res.json(await searchPlaces(query));
  } catch (error) {
    console.error("GEO SEARCH ERROR:", error.message);
    res.status(502).json({ message: "Place search is unavailable right now. Please try again." });
  }
});

module.exports = router;
