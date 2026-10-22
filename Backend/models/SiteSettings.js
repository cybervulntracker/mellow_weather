const mongoose = require("mongoose");

// Single-document collection (key = "main")
const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    siteName: { type: String, default: "MellowWeather" },
    allowRegistrations: { type: Boolean, default: true },
    defaultUnit: { type: String, enum: ["C", "F"], default: "C" },
    defaultCity: { type: String, default: "New Delhi" },
    announcement: { type: String, default: "", maxlength: 200 },
    weeklyReport: { type: Boolean, default: false },
    lastReportOn: { type: String, default: "" },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);
