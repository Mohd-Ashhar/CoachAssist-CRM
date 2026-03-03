const router = require("express").Router();
const Lead = require("../models/Lead");
const LeadActivity = require("../models/LeadActivity");
const AiFollowup = require("../models/AiFollowup");
const auth = require("../middleware/auth");
const { client: redis } = require("../lib/redis");
const { generateFollowUp } = require("../lib/gemini");

// All lead routes require authentication
router.use(auth);

// GET /api/leads - List all leads with optional filters
router.get("/", async (req, res) => {
  try {
    const { status, tags, search } = req.query;
    let query = {};

    if (status) query.status = status;
    
    if (tags) {
      const tagsArray = tags.split(",").map((t) => t.trim());
      query.tags = { $in: tagsArray };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    console.error("Error fetching leads:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/leads/:id - Get single lead
router.get("/:id", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ msg: "Lead not found" });
    
    res.json(lead);
  } catch (err) {
    console.error("Error fetching lead:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ msg: "Lead not found" });
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/leads - Create a new lead
router.post("/", async (req, res) => {
  try {
    const { name, phone, source, status, tags, nextFollowUpAt, assignedTo } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ msg: "Name and phone are required" });
    }

    const newLead = new Lead({
      name,
      phone,
      source,
      status,
      tags: tags || [],
      nextFollowUpAt,
      assignedTo: assignedTo || req.user.id,
    });

    const savedLead = await newLead.save();

    await LeadActivity.create({
      leadId: savedLead._id,
      type: "STATUS_CHANGE",
      content: `Lead created via ${source || 'Instagram'}`,
      createdBy: req.user.id
    });

    res.status(201).json(savedLead);
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// PATCH /api/leads/:id - Update a lead
router.patch("/:id", async (req, res) => {
  try {
    const oldLead = await Lead.findById(req.params.id);
    if (!oldLead) return res.status(404).json({ msg: "Lead not found" });

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (req.body.status && req.body.status !== oldLead.status) {
      await LeadActivity.create({
        leadId: updatedLead._id,
        type: "STATUS_CHANGE",
        content: `Status changed from ${oldLead.status} to ${updatedLead.status}`,
        createdBy: req.user.id
      });
    }

    res.json(updatedLead);
  } catch (err) {
    console.error("Error updating lead:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ msg: "Lead not found" });
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/leads/:id - Delete a lead
router.delete("/:id", async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) return res.status(404).json({ msg: "Lead not found" });

    res.json({ msg: "Lead removed" });
  } catch (err) {
    console.error("Error deleting lead:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ msg: "Lead not found" });
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/leads/:id/timeline - Get paginated activities for a lead
router.get("/:id/timeline", async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const query = { leadId: req.params.id };
    
    // Cursor pagination using indexed createdAt
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const activities = await LeadActivity.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("createdBy", "name");

    const nextCursor = activities.length > 0 ? activities[activities.length - 1].createdAt : null;

    res.json({
      data: activities,
      nextCursor
    });
  } catch (err) {
    console.error("Error fetching timeline:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/leads/:id/activities - Manually log a timeline activity
router.post("/:id/activities", async (req, res) => {
  try {
    const { type, content } = req.body;
    
    if (!type) {
      return res.status(400).json({ msg: "Activity type is required" });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ msg: "Lead not found" });

    const activity = await LeadActivity.create({
      leadId: lead._id,
      type,
      content,
      createdBy: req.user.id
    });

    const populatedActivity = await activity.populate("createdBy", "name");
    res.status(201).json(populatedActivity);
  } catch (err) {
    console.error("Error creating activity:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/leads/:id/ai-followup - Generate AI follow-up suggestions
router.post("/:id/ai-followup", async (req, res) => {
  try {
    // Rate limit: 5 per user per hour (skip if Redis unavailable)
    if (redis) {
      try {
        const rateLimitKey = `ai_ratelimit:${req.user.id}`;
        const current = await redis.incr(rateLimitKey);
        if (current === 1) await redis.expire(rateLimitKey, 3600);
        if (current > 5) {
          return res.status(429).json({ msg: "Rate limit exceeded. Max 5 AI generations per hour." });
        }
      } catch (err) {
        console.error("Redis Rate Limiter Error:", err);
        return res.status(500).json({ msg: "Internal Server Error: Rate limiter is currently unavailable." });
      }
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ msg: "Lead not found" });

    const recentActivities = await LeadActivity.find({ leadId: lead._id })
      .sort({ createdAt: -1 })
      .limit(3);

    const aiOutput = await generateFollowUp(lead, recentActivities);

    const saved = await AiFollowup.create({
      leadId: lead._id,
      whatsappMessage: aiOutput.whatsappMessage,
      callScript: aiOutput.callScript,
      objectionHandler: aiOutput.objectionHandler,
      createdBy: req.user.id,
    });

    await LeadActivity.create({
      leadId: lead._id,
      type: "AI_MESSAGE_GENERATED",
      content: `WhatsApp: ${aiOutput.whatsappMessage}`,
      createdBy: req.user.id,
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("AI followup error:", err);
    if (err.message?.includes("API key")) {
      return res.status(500).json({ msg: "Gemini API key is not configured" });
    }
    res.status(500).json({ msg: "Failed to generate AI follow-up" });
  }
});

module.exports = router;
