const mongoose = require("mongoose");

// "Tell me if the high goes above 40" - checked by the scheduler against a saved place.
// Thresholds are stored in the units the forecast uses (°C, km/h, UV index, US AQI, %).
const METRICS = ["tempMax", "tempMin", "rainProb", "windMax", "uvMax", "aqi"];

const alertRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    metric: { type: String, enum: METRICS, required: true },
    threshold: { type: Number, required: true },
    placeId: { type: mongoose.Schema.Types.ObjectId, ref: "Favorite", default: null }, // null = home city
    enabled: { type: Boolean, default: true },
    lastTriggeredOn: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AlertRule", alertRuleSchema);
module.exports.METRICS = METRICS;
