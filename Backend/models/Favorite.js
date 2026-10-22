const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    city: { type: String, required: true },
    admin1: { type: String, default: "" },
    country: { type: String, default: "" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    nickname: { type: String, default: "", maxlength: 40 }, // "Mum's house", "Office"
    position: { type: Number, default: 0 },                 // drag-to-sort order
    isHome: { type: Boolean, default: false },              // the pinned city (used for alerts)
  },
  { timestamps: true }
);

favoriteSchema.index({ userId: 1, latitude: 1, longitude: 1 });

module.exports = mongoose.model("Favorite", favoriteSchema);
