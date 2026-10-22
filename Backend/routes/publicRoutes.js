const express = require("express");
const SiteSettings = require("../models/SiteSettings");

const router = express.Router();

// Safe, non-secret settings the login page and weather site need
router.get("/settings", async (req, res) => {
  try {
    const s = (await SiteSettings.findOne({ key: "main" }).lean()) || {};
    res.json({
      siteName: s.siteName || "MellowWeather",
      allowRegistrations: s.allowRegistrations !== false,
      defaultUnit: s.defaultUnit || "C",
      defaultCity: s.defaultCity || "New Delhi",
      announcement: s.announcement || "",
      maintenanceMode: Boolean(s.maintenanceMode),
      maintenanceMessage: s.maintenanceMessage || "",
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null, // browser push only shows when keys are set
      googleClientId: process.env.GOOGLE_CLIENT_ID || null, // the Google button only shows when this is set
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load settings" });
  }
});

module.exports = router;
