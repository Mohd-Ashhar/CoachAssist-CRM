const mongoose = require("mongoose");

const leadActivitySchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CALL", "WHATSAPP", "NOTE", "STATUS_CHANGE", "AI_MESSAGE_GENERATED"],
      required: true,
    },
    content: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for highly efficient cursor-based pagination
leadActivitySchema.index({ leadId: 1, createdAt: -1 });

module.exports = mongoose.model("LeadActivity", leadActivitySchema);
