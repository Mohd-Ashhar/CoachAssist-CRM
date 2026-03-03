const mongoose = require("mongoose");

const aiFollowupSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    whatsappMessage: { type: String, required: true },
    callScript: [{ type: String }],
    objectionHandler: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AiFollowup", aiFollowupSchema);
