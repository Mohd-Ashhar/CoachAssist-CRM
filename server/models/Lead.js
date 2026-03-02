const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["Instagram", "Referral", "Ads"],
      default: "Instagram",
    },
    status: {
      type: String,
      enum: ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "LOST"],
      default: "NEW",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    nextFollowUpAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
