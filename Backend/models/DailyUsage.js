const mongoose = require("mongoose");

// One row per user per day: powers the usage charts without growing an array.
const dailyUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // YYYY-MM-DD (UTC)
  activeSeconds: { type: Number, default: 0 },
  actions: { type: Number, default: 0 },
});

dailyUsageSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyUsageSchema.index({ date: 1 });

module.exports = mongoose.model("DailyUsage", dailyUsageSchema);
