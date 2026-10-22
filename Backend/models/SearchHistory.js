const mongoose = require("mongoose");

// Every place a person has looked at. `count` = times it was typed in a search,
// `views` = times it was opened (search, saved place, GPS, recent list).
const searchHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    city: { type: String, required: true },
    admin1: { type: String, default: "" },
    country: { type: String, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    placeKey: { type: String, default: "" }, // "28.61,77.21" - the same place found by different names
    count: { type: Number, default: 1 },
    views: { type: Number, default: 0 },
    lastSearchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

searchHistorySchema.index({ userId: 1, placeKey: 1 });

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
