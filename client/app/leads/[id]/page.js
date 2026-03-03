"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowLeft, Phone, Calendar, Sparkles, MessageCircle,
  Loader2, Activity, LogOut, Pencil, Save, Trash2, X,
  MoreVertical, Bot, PhoneCall, StickyNote, Hash, Clock
} from "lucide-react";

// ─── Activity icon map ───
const ACTIVITY_ICON = {
  CALL: PhoneCall,
  WHATSAPP: MessageCircle,
  NOTE: StickyNote,
  AI_MESSAGE_GENERATED: Bot,
  STATUS_CHANGE: Activity,
};

const ACTIVITY_COLOR = {
  CALL: "bg-emerald-100 text-emerald-700 border-emerald-200",
  WHATSAPP: "bg-green-100 text-green-700 border-green-200",
  NOTE: "bg-slate-100 text-slate-600 border-slate-200",
  AI_MESSAGE_GENERATED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  STATUS_CHANGE: "bg-violet-100 text-violet-700 border-violet-200",
};

// ─── Status badge config ───
const STATUS_CONFIG = {
  NEW: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200/60" },
  CONTACTED: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200/60" },
  INTERESTED: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-200/60" },
  CONVERTED: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200/60" },
  LOST: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-200/60" },
};

export default function LeadDetailPage({ params }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { user, logout } = useAuth();
  const router = useRouter();

  // ─── Lead State ───
  const [lead, setLead] = useState(null);
  const [leadLoading, setLeadLoading] = useState(true);

  // ─── Edit Mode ───
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "", phone: "", source: "Instagram", status: "NEW", tags: "", nextFollowUpAt: ""
  });

  // ─── Timeline State ───
  const [activities, setActivities] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: "NOTE", content: "" });
  const [postingActivity, setPostingActivity] = useState(false);

  // ─── AI Follow-up State ───
  const [loadingAi, setLoadingAi] = useState(false);

  // ─── Fetch lead details ───
  const fetchLead = async () => {
    try {
      setLeadLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Lead not found");
      const data = await res.json();
      setLead(data);
      setFormData({
        name: data.name,
        phone: data.phone,
        source: data.source,
        status: data.status,
        tags: data.tags ? data.tags.join(", ") : "",
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt).toISOString().split("T")[0] : ""
      });
    } catch (err) {
      toast.error("Failed to load lead details");
    } finally {
      setLeadLoading(false);
    }
  };

  // ─── Fetch timeline activities ───
  const fetchActivities = async (cursor = null) => {
    try {
      if (cursor) setLoadingMore(true);
      else setLoadingActivities(true);

      const token = localStorage.getItem("token");
      let url = `http://localhost:5001/api/leads/${id}/timeline?limit=8`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();

      if (cursor) {
        setActivities(prev => [...prev, ...data.data]);
      } else {
        setActivities(data.data);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error("Failed to load timeline");
    } finally {
      setLoadingActivities(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchLead();
      fetchActivities();
    }
  }, [user, id]);

  // ─── Save lead edits ───
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean)
      };
      const res = await fetch(`http://localhost:5001/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setLead(updated);
      setIsEditing(false);
      toast.success("Lead updated successfully");
      fetchActivities(); // Refresh to capture any STATUS_CHANGE activity
    } catch (err) {
      toast.error(err.message || "Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete lead ───
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this lead? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Lead deleted");
      router.push("/leads");
    } catch (err) {
      toast.error("Error deleting lead");
    }
  };

  // ─── Post activity ───
  const handlePostActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.content && newActivity.type === "NOTE") return;
    setPostingActivity(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newActivity)
      });
      if (!res.ok) throw new Error("Failed to post activity");
      setNewActivity({ type: "NOTE", content: "" });
      toast.success("Activity logged");
      fetchActivities(); // Refresh from start
    } catch (err) {
      toast.error("Failed to post activity");
    } finally {
      setPostingActivity(false);
    }
  };

  // ─── AI Follow-up ───
  const handleAIFollowUp = async () => {
    setLoadingAi(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${id}/ai-followup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Failed to generate AI follow-up");
      toast.success("AI Follow-up generated successfully!");
      fetchActivities();
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoadingAi(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${s.bg} ${s.text} ${s.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
        {status}
      </span>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ─── Premium Dark Navbar ─── */}
      <nav className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 border-b border-indigo-900/50 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm border border-white/10">
                <Activity className="h-5 w-5 text-indigo-300" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">WellnessZ</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-sm font-medium text-indigo-100/70 hover:text-white transition-colors">Dashboard</Link>
              <Link href="/leads" className="text-sm font-semibold text-white border-b-2 border-indigo-400 pb-[18px] pt-[20px]">Leads</Link>
              <div className="hidden sm:block text-sm font-medium text-indigo-50">{user?.name}</div>
              <button onClick={logout} className="inline-flex items-center justify-center p-2 rounded-md text-indigo-200/60 hover:text-rose-400 hover:bg-white/5 transition-colors" title="Log out">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 lg:px-8">
        {/* ─── Back Link + Breadcrumb ─── */}
        <div className="mb-6">
          <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-indigo-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Leads
          </Link>
        </div>

        {leadLoading ? (
          <LeadDetailSkeleton />
        ) : !lead ? (
          /* ─── Not Found ─── */
          <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-16 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Lead not found</h2>
            <p className="text-zinc-500 text-sm mb-6">The lead you're looking for doesn't exist or has been deleted.</p>
            <Link href="/leads" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← Return to Leads</Link>
          </div>
        ) : (
          /* ─── Two-Column Layout ─── */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* ═══════════════════════════════════════════════ */}
            {/* LEFT COLUMN — Lead Info & Edit Form            */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lead Header Card */}
              <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
                      {lead.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-zinc-900">{lead.name}</h1>
                      <div className="flex items-center gap-1.5 text-sm text-zinc-500 mt-0.5">
                        <Phone className="w-3.5 h-3.5" />
                        {lead.phone}
                      </div>
                    </div>
                  </div>
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-indigo-700 hover:bg-indigo-50 border border-zinc-200 rounded-lg transition-all">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>

                {/* Status & Meta */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</span>
                    {getStatusBadge(lead.status)}
                  </div>
                  <div className="h-px bg-zinc-100"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Source</span>
                    <span className="text-sm font-medium text-zinc-700">{lead.source}</span>
                  </div>
                  <div className="h-px bg-zinc-100"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Next Follow-Up</span>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-700">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-medium">
                        {lead.nextFollowUpAt
                          ? new Date(lead.nextFollowUpAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : "Not set"}
                      </span>
                    </div>
                  </div>
                  <div className="h-px bg-zinc-100"></div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-2">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.tags && lead.tags.length > 0 ? lead.tags.map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-zinc-200/60 uppercase tracking-wide">
                          <Hash className="w-3 h-3 text-zinc-400" />{tag}
                        </span>
                      )) : (
                        <span className="text-zinc-400 text-xs italic">No tags added</span>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-zinc-100"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Created</span>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {new Date(lead.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Follow-up Action Card */}
              <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-xl shadow-sm border border-indigo-100 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">AI Follow-up</h3>
                    <p className="text-xs text-zinc-500">Generate a personalized follow-up message</p>
                  </div>
                </div>
                <button
                  onClick={handleAIFollowUp}
                  disabled={loadingAi}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingAi ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate AI Follow-up</>
                  )}
                </button>
              </div>

              {/* Edit Form (Expandable) */}
              {isEditing && (
                <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Edit Lead</h3>
                    <button onClick={() => setIsEditing(false)} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSave} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Name *</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Phone *</label>
                      <input required type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Source</label>
                        <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })}
                          className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white cursor-pointer">
                          <option value="Instagram">Instagram</option>
                          <option value="Referral">Referral</option>
                          <option value="Ads">Ads</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Status</label>
                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                          className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white font-medium cursor-pointer">
                          <option value="NEW">New</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="INTERESTED">Interested</option>
                          <option value="CONVERTED">Converted</option>
                          <option value="LOST">Lost</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Tags (comma-separated)</label>
                      <input type="text" value={formData.tags} placeholder="e.g. Premium, High Value" onChange={e => setFormData({ ...formData, tags: e.target.value })}
                        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all placeholder:text-zinc-400" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Next Follow-Up</label>
                      <input type="date" value={formData.nextFollowUpAt} onChange={e => setFormData({ ...formData, nextFollowUpAt: e.target.value })}
                        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" />
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                      <button type="button" onClick={handleDelete} className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Lead
                      </button>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-60">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* RIGHT COLUMN — Activity Timeline               */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900">Activity Timeline</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Track all interactions and events for this lead</p>
                  </div>
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100">
                    {activities.length} {activities.length === 1 ? "event" : "events"}
                  </span>
                </div>

                {/* ─── Post Activity Form ─── */}
                <div className="mb-8 bg-slate-50 rounded-xl p-4 border border-zinc-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-violet-500 rounded-l-xl"></div>
                  <form onSubmit={handlePostActivity}>
                    <div className="flex items-center gap-3 mb-3">
                      <select
                        value={newActivity.type}
                        onChange={e => setNewActivity({ ...newActivity, type: e.target.value })}
                        className="px-3 py-1.5 font-semibold border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                      >
                        <option value="NOTE">📝 Note</option>
                        <option value="CALL">📞 Call</option>
                        <option value="WHATSAPP">💬 WhatsApp</option>
                      </select>
                      <span className="text-[11px] text-zinc-400 font-medium">Log new activity</span>
                    </div>
                    <textarea
                      placeholder="Log a call summary, note, or message..."
                      rows={2}
                      value={newActivity.content}
                      onChange={e => setNewActivity({ ...newActivity, content: e.target.value })}
                      className="w-full px-3 py-2.5 border border-zinc-200 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 mb-3 resize-none transition-all placeholder:text-zinc-400 bg-white"
                    />
                    <div className="flex justify-end">
                      <button type="submit" disabled={postingActivity} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-black rounded-lg transition-colors shadow-sm disabled:opacity-60">
                        {postingActivity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {postingActivity ? "Posting..." : "Post Activity"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* ─── Timeline Feed ─── */}
                {loadingActivities ? (
                  <TimelineSkeleton />
                ) : activities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-7 h-7 text-zinc-400" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 mb-1">No activities yet</h3>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto">Start by logging a call, note, or generating an AI follow-up above.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Connecting vertical line */}
                    <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-400 via-indigo-300 to-indigo-100 rounded-full"></div>

                    <div className="space-y-1">
                      {activities.map((act, idx) => {
                        const IconComp = ACTIVITY_ICON[act.type] || MoreVertical;
                        const colorClass = ACTIVITY_COLOR[act.type] || ACTIVITY_COLOR.NOTE;
                        const isAi = act.type === "AI_MESSAGE_GENERATED" || (act.content && act.content.includes("AI Follow-up"));

                        return (
                          <div key={act._id} className="relative flex gap-4 pb-6 group">
                            {/* Step Icon */}
                            <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm ${colorClass}`}>
                              <IconComp className="w-4 h-4" />
                            </div>

                            {/* Content Card */}
                            <div className={`flex-1 min-w-0 rounded-xl p-4 border transition-all duration-150 ${
                              isAi
                                ? "bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-100 shadow-sm"
                                : "bg-white border-zinc-100 hover:shadow-sm"
                            }`}>
                              {/* Header */}
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0 ${
                                    isAi ? "bg-indigo-100 text-indigo-700" :
                                    act.type === "CALL" ? "bg-emerald-50 text-emerald-700" :
                                    act.type === "WHATSAPP" ? "bg-green-50 text-green-700" :
                                    act.type === "STATUS_CHANGE" ? "bg-violet-50 text-violet-700" :
                                    "bg-zinc-100 text-zinc-600"
                                  }`}>
                                    {isAi ? "AI Generated" : act.type.replace("_", " ")}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-medium truncate">
                                    by {act.createdBy?.name || "System"}
                                  </span>
                                </div>
                                <span className="text-[10px] font-medium text-zinc-400 flex-shrink-0 whitespace-nowrap">
                                  {new Date(act.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                  {" · "}
                                  {new Date(act.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              {/* Body */}
                              {isAi ? (
                                <div className="mt-2">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Bot className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs font-bold text-indigo-900">AI-Generated Message</span>
                                  </div>
                                  <div className="text-sm text-indigo-900/80 leading-relaxed whitespace-pre-wrap bg-indigo-50/50 rounded-lg p-3 border border-indigo-100/50 font-medium">
                                    {act.content?.replace("✨ AI Follow-up Generated:\n\n", "").replace("WhatsApp: ", "")}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap font-medium">
                                  {act.content}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ─── Load More ─── */}
                    {nextCursor && (
                      <div className="text-center pt-4 relative z-10">
                        <button
                          onClick={() => fetchActivities(nextCursor)}
                          disabled={loadingMore}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200/60 transition-all disabled:opacity-50 uppercase tracking-wider"
                        >
                          {loadingMore ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
                          ) : (
                            "Load More Activities"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Lead Detail Skeleton Loader ───
function LeadDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-pulse">
      {/* Left Column Skeleton */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-zinc-100 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-200"></div>
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-zinc-200 rounded w-2/3"></div>
              <div className="h-3 bg-zinc-100 rounded w-1/2"></div>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i}>
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-zinc-100 rounded w-1/4"></div>
                  <div className="h-5 bg-zinc-100 rounded w-1/3"></div>
                </div>
                {i < 5 && <div className="h-px bg-zinc-50 mt-4"></div>}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-5 h-32"></div>
      </div>
      {/* Right Column Skeleton */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-xl border border-zinc-100 p-6">
          <div className="mb-6">
            <div className="h-5 bg-zinc-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-zinc-100 rounded w-1/2"></div>
          </div>
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 mb-8 h-32"></div>
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-zinc-200 flex-shrink-0"></div>
                <div className="flex-1 bg-zinc-50 rounded-xl p-4 border border-zinc-100 h-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Skeleton Loader ───
function TimelineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-4">
          <div className="w-9 h-9 rounded-xl bg-zinc-200 flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 bg-zinc-200 rounded w-20"></div>
              <div className="h-3 bg-zinc-100 rounded w-24"></div>
            </div>
            <div className="h-14 bg-zinc-50 rounded-lg border border-zinc-100"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
