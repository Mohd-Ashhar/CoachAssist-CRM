const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateFollowUp = async (lead, recentActivities) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const activitiesSummary = recentActivities
    .map((a) => `[${a.type}] ${a.content || "No details"} (${new Date(a.createdAt).toLocaleDateString()})`)
    .join("\n");

  const prompt = `You are a CRM sales assistant. Based on the lead info and recent activity, generate follow-up content.

Lead:
- Name: ${lead.name}
- Phone: ${lead.phone}
- Status: ${lead.status}
- Source: ${lead.source}
- Tags: ${(lead.tags || []).join(", ")}
- Next Follow-Up: ${lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : "Not set"}

Recent Activity:
${activitiesSummary || "No recent activity"}

Return a JSON object with exactly these fields:
{
  "whatsappMessage": "A short, friendly WhatsApp message (max 2 sentences) to re-engage the lead",
  "callScript": ["bullet 1", "bullet 2", "bullet 3"],
  "objectionHandler": "A single line to handle the most likely objection based on the lead's current status"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return JSON.parse(text);
};

module.exports = { generateFollowUp };
