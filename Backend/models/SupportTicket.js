const mongoose = require("mongoose");

// A message from a user to the admins ("support inbox"). Admins reply in the admin panel;
// the user sees the reply under Settings -> Help.
const supportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: ["bug", "idea", "account", "other"], default: "other" },
    status: { type: String, enum: ["open", "answered", "closed"], default: "open", index: true },
    messages: [
      {
        from: { type: String, enum: ["user", "admin"], required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true, trim: true, maxlength: 2000 },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

supportTicketSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
