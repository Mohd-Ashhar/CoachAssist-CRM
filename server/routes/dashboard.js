const router = require("express").Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Lead = require("../models/Lead");
const LeadActivity = require("../models/LeadActivity");
const { getCache, setCache } = require("../lib/redis");

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/analytics", auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `dashboard:${req.user.id}:${today}`;

    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Run all aggregations in parallel
    const [funnelAndConversion, overdueResult, topSources, activityGraph] = await Promise.all([
      // 1 + 2: Funnel counts + conversion rate in a single $facet
      Lead.aggregate([
        {
          $facet: {
            funnel: [
              { $group: { _id: "$status", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            conversion: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  converted: {
                    $sum: { $cond: [{ $eq: ["$status", "CONVERTED"] }, 1, 0] },
                  },
                },
              },
            ],
          },
        },
      ]),

      // 3: Overdue follow-ups
      Lead.aggregate([
        {
          $match: {
            nextFollowUpAt: { $lt: now },
            status: { $nin: ["CONVERTED", "LOST"] },
          },
        },
        { $count: "count" },
      ]),

      // 4: Top sources
      Lead.aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // 5: 7-day activity graph
      LeadActivity.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const conversionData = funnelAndConversion[0]?.conversion[0];
    const total = conversionData?.total || 0;
    const converted = conversionData?.converted || 0;

    const analytics = {
      funnel: funnelAndConversion[0]?.funnel || [],
      conversionRate: total > 0 ? +(converted / total).toFixed(4) : 0,
      totalLeads: total,
      convertedLeads: converted,
      overdueFollowUps: overdueResult[0]?.count || 0,
      topSources: topSources,
      activityGraph: activityGraph,
    };

    await setCache(cacheKey, analytics, 60);

    res.json(analytics);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
