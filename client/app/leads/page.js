"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Search, Filter, Plus, MoreVertical, Sparkles, MessageCircle, Phone, Calendar, Loader2, Activity, LogOut, Eye, Pencil, Users } from "lucide-react";

export default function Leads() {
  const { user, logout } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "", phone: "", source: "Instagram", status: "NEW", tags: "", nextFollowUpAt: ""
  });

  // Timeline state
  const [activities, setActivities] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: "NOTE", content: "" });

  // AI Follow-up state
  const [loadingAiId, setLoadingAiId] = useState(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      let url = "http://localhost:5001/api/leads?";
      
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (tagsFilter) params.append("tags", tagsFilter);
      
      url += params.toString();

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to fetch leads");
      
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      setError("Error loading leads.");
      toast.error("Error loading leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, statusFilter, tagsFilter]);

  const handleOpenModal = (lead = null) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        tags: lead.tags ? lead.tags.join(", ") : "",
        nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().split('T')[0] : ""
      });
      fetchActivities(lead._id);
    } else {
      setEditingLead(null);
      setFormData({
        name: "", phone: "", source: "Instagram", status: "NEW", tags: "", nextFollowUpAt: ""
      });
      setActivities([]);
      setNextCursor(null);
    }
    setError("");
    setIsModalOpen(true);
  };

  const fetchActivities = async (leadId, cursor = null) => {
    try {
      setLoadingActivities(true);
      const token = localStorage.getItem("token");
      let url = `http://localhost:5001/api/leads/${leadId}/timeline?limit=5`;
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
      console.error(err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handlePostActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.content && newActivity.type === 'NOTE') return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${editingLead._id}/activities`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(newActivity)
      });
      if (!res.ok) throw new Error("Failed to post activity");
      setNewActivity({ type: "NOTE", content: "" });
      fetchActivities(editingLead._id);
      toast.success("Activity logged");
    } catch (err) {
      console.error(err);
      toast.error("Failed to post activity");
    }
  };

  const handleInlineAIFollowUp = async (leadId) => {
    setLoadingAiId(leadId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${leadId}/ai-followup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Failed to generate AI follow-up");
      
      toast.success("AI Follow-up generated successfully!");
      fetchLeads();
      if (editingLead && editingLead._id === leadId) {
        fetchActivities(leadId);
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoadingAiId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      const token = localStorage.getItem("token");
      const url = editingLead 
        ? `http://localhost:5001/api/leads/${editingLead._id}` 
        : "http://localhost:5001/api/leads";
      
      const method = editingLead ? "PATCH" : "POST";
      
      const payload = {
        ...formData,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save lead");

      toast.success(editingLead ? "Lead updated successfully" : "Lead created successfully");
      setIsModalOpen(false);
      fetchLeads();
    } catch (err) {
      setError(err.message || "An error occurred");
      toast.error("Failed to save lead");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to delete lead");
      toast.success("Lead deleted");
      fetchLeads();
    } catch (err) {
      toast.error("Error deleting lead");
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      NEW: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200/60" },
      CONTACTED: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200/60" },
      INTERESTED: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-200/60" },
      CONVERTED: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200/60" },
      LOST: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-200/60" }
    };
    const s = config[status] || config.NEW;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${s.bg} ${s.text} ${s.border}`}>
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
              <span className="text-xl font-bold text-white tracking-tight">
                WellnessZ
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-sm font-medium text-indigo-100/70 hover:text-white transition-colors">
                Dashboard
              </Link>
              <span className="text-sm font-semibold text-white border-b-2 border-indigo-400 pb-[18px] pt-[20px]">
                Leads
              </span>
              <div className="hidden sm:block text-sm font-medium text-indigo-50">
                {user?.name}
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center justify-center p-2 rounded-md text-indigo-200/60 hover:text-rose-400 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                title="Log out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">Leads Pipeline</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage, track, and convert your prospects into customers.</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>

        {/* ─── Filters & Search Card ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:w-auto w-full">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm appearance-none bg-white transition-all cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="INTERESTED">Interested</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
            <div className="relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filter by tag..." 
                value={tagsFilter}
                onChange={(e) => setTagsFilter(e.target.value)}
                className="w-full sm:max-w-[180px] pl-9 pr-4 py-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* ─── Leads Table Card ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
          {loading ? (
            /* ─── Loading Skeleton ─── */
            <div className="animate-pulse">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-zinc-100">
                <div className="flex gap-8">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-3 bg-zinc-200 rounded w-24"></div>
                  ))}
                </div>
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="px-6 py-5 border-b border-zinc-50 flex items-center gap-8">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-zinc-100 rounded w-32"></div>
                    <div className="h-3 bg-zinc-50 rounded w-24"></div>
                  </div>
                  <div className="h-6 bg-zinc-100 rounded-full w-20"></div>
                  <div className="flex gap-1">
                    <div className="h-5 bg-zinc-100 rounded w-14"></div>
                    <div className="h-5 bg-zinc-100 rounded w-14"></div>
                  </div>
                  <div className="h-4 bg-zinc-100 rounded w-24"></div>
                  <div className="h-7 bg-zinc-100 rounded w-28"></div>
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            /* ─── Elegant Empty State ─── */
            <div className="py-20 px-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Users className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">No leads found</h3>
              <p className="text-zinc-500 text-sm max-w-md leading-relaxed">
                We couldn't find any leads matching your current filters. Try adjusting your search criteria or add a new lead to get started.
              </p>
              <button 
                onClick={() => handleOpenModal()}
                className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
              >
                <Plus className="w-4 h-4" />
                Add your first lead
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-zinc-100">
                    <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Contact Info</th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Status & Source</th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Tags</th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Follow Up</th>
                    <th className="px-6 py-3.5 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-slate-50/60 transition-colors duration-150 group">
                      {/* Contact Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                            {lead.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 text-sm">{lead.name}</div>
                            <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Status & Source */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(lead.status)}
                        <div className="text-[11px] text-zinc-400 font-medium mt-1.5 uppercase tracking-wide">
                          {lead.source}
                        </div>
                      </td>
                      {/* Tags */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          {lead.tags && lead.tags.map((tag, idx) => (
                            <span key={idx} className="bg-zinc-100 text-zinc-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-md uppercase tracking-wide border border-zinc-200/60">
                              {tag}
                            </span>
                          ))}
                          {(!lead.tags || lead.tags.length === 0) && (
                            <span className="text-zinc-300 text-xs italic">None</span>
                          )}
                        </div>
                      </td>
                      {/* Follow Up */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                          <Calendar className="w-4 h-4 text-zinc-400" />
                          {lead.nextFollowUpAt ? (
                            <span className="font-medium">
                              {new Date(lead.nextFollowUpAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">Not set</span>
                          )}
                        </div>
                      </td>
                      {/* Quick Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {/* Desktop: hover-reveal actions */}
                        <div className="hidden sm:flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button 
                            onClick={() => handleInlineAIFollowUp(lead._id)}
                            disabled={loadingAiId === lead._id}
                            title="Generate AI Follow-up"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all duration-150 disabled:opacity-50 border border-indigo-200/60 shadow-sm hover:shadow cursor-pointer"
                          >
                            {loadingAiId === lead._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            AI Follow-up
                          </button>
                          <Link 
                            href={`/leads/${lead._id}`}
                            title="View Details"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all duration-150"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Link>
                          <button 
                            onClick={() => handleOpenModal(lead)} 
                            title="Edit Lead"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all duration-150"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </div>
                        {/* Mobile: always visible */}
                        <div className="sm:hidden flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleInlineAIFollowUp(lead._id)}
                            disabled={loadingAiId === lead._id}
                            className="p-1.5 text-indigo-600"
                          >
                            {loadingAiId === lead._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>
                          <button onClick={() => handleOpenModal(lead)} className="text-zinc-400 p-1.5 hover:text-zinc-700">
                            <MoreVertical className="w-4 h-4"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ─── Modal / Slide-over for Create/Edit ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-zinc-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  {editingLead ? "Edit Lead Profile" : "Create New Lead"}
                </h2>
                {editingLead && <p className="text-xs text-zinc-500 mt-0.5 font-mono">ID: {editingLead._id}</p>}
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-100">
              {/* Lead Form */}
              <form onSubmit={handleSubmit} className={`p-6 overflow-y-auto ${editingLead ? 'md:w-[45%]' : 'w-full'} space-y-5 bg-white`}>
                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest mb-4">Contact Information</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Name *</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Phone *</label>
                    <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Source</label>
                    <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all bg-white cursor-pointer">
                      <option value="Instagram">Instagram</option>
                      <option value="Referral">Referral</option>
                      <option value="Ads">Ads</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Pipeline Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all bg-white font-medium cursor-pointer">
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="INTERESTED">Interested</option>
                      <option value="CONVERTED">Converted</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Tags (comma-separated)</label>
                  <input type="text" value={formData.tags} placeholder="e.g. Premium, Follow-up, High Value" onChange={e => setFormData({...formData, tags: e.target.value})} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all placeholder:text-zinc-400" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">Next Follow Up</label>
                  <input type="date" value={formData.nextFollowUpAt} onChange={e => setFormData({...formData, nextFollowUpAt: e.target.value})} className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all" />
                </div>

                <div className="pt-6 border-t border-zinc-100 flex justify-between items-center">
                  {editingLead ? (
                    <button type="button" onClick={() => handleDelete(editingLead._id)} className="text-sm font-semibold text-rose-500 hover:text-rose-700 transition-colors">
                      Delete Lead
                    </button>
                  ) : <div></div>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button type="submit" className="px-5 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all">
                      {editingLead ? "Save Changes" : "Create Lead"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Timeline (Only visible in Edit Mode) */}
              {editingLead && (
                <div className="md:w-[55%] flex flex-col bg-slate-50 relative">
                  <div className="p-4 border-b border-zinc-100 bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm shadow-black/5">
                    <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-2">
                       Activity Timeline
                    </h3>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                    {/* Add Activity Form */}
                    <form onSubmit={handlePostActivity} className="mb-8 bg-white p-4 rounded-xl shadow-sm border border-zinc-100 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-violet-500 rounded-l-xl"></div>
                      <div className="flex gap-3 mb-3">
                        <select 
                          value={newActivity.type} 
                          onChange={e => setNewActivity({...newActivity, type: e.target.value})}
                          className="px-3 py-1.5 font-medium border border-zinc-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 cursor-pointer"
                        >
                          <option value="NOTE">Note</option>
                          <option value="CALL">Call</option>
                          <option value="WHATSAPP">WhatsApp</option>
                        </select>
                      </div>
                      <textarea 
                        placeholder="Log a call summary, note, or message..."
                        rows={2}
                        value={newActivity.content}
                        onChange={e => setNewActivity({...newActivity, content: e.target.value})}
                        className="w-full px-3 py-2.5 border border-zinc-200 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 mb-3 resize-none transition-all placeholder:text-zinc-400"
                      />
                      <div className="flex justify-end">
                        <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-black rounded-lg transition-colors shadow-sm">
                          Post Activity
                        </button>
                      </div>
                    </form>

                    {/* Activity Feed */}
                    <div className="space-y-5 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-zinc-200">
                      {activities.length === 0 && !loadingActivities && (
                        <div className="text-zinc-400 text-sm text-center py-6 italic relative bg-slate-50 z-10 w-fit mx-auto px-4">No activities logged yet.</div>
                      )}
                      
                      {activities.map((act) => (
                        <div key={act._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-zinc-100 text-zinc-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            {act.type === 'CALL' ? <Phone className="w-3.5 h-3.5" /> : 
                             act.type === 'WHATSAPP' ? <MessageCircle className="w-3.5 h-3.5" /> : 
                             act.type === 'STATUS_CHANGE' ? <Loader2 className="w-3.5 h-3.5" /> :
                             <MoreVertical className="w-3.5 h-3.5" />}
                          </div>
                          
                          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl shadow-sm border border-zinc-100 bg-white">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                act.type === 'STATUS_CHANGE' ? 'bg-indigo-50 text-indigo-700' :
                                act.type === 'CALL' ? 'bg-green-50 text-green-700' :
                                act.type === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-700' :
                                'bg-zinc-100 text-zinc-700'
                              }`}>
                                {act.type}
                              </span>
                              <span className="text-[10px] font-medium text-zinc-400 flex flex-col items-end">
                                <span>{new Date(act.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                <span>{new Date(act.createdAt).toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'})}</span>
                              </span>
                            </div>
                            
                            <div className="text-sm text-zinc-700 leading-relaxed font-medium">
                              {act.content && act.content.startsWith('✨ AI Follow-up Generated:\n\n') ? (
                                <div className="space-y-3 bg-indigo-50/50 -mx-4 -mb-4 p-4 mt-2 rounded-b-xl border-t border-indigo-100/50 text-xs">
                                  {act.content.replace('✨ AI Follow-up Generated:\n\n', '').split('\n').map((line, i) => (
                                     <p key={i} className={line.includes(':') && line.length < 30 ? "font-bold text-indigo-900 mt-2" : "text-indigo-800/80"}>
                                       {line}
                                     </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{act.content}</p>
                              )}
                            </div>
                            
                            <div className="text-[10px] text-zinc-400 mt-3 flex justify-end font-medium">
                              {act.createdBy?.name || 'System Auto'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {nextCursor && (
                      <div className="text-center pt-8 pb-4 relative z-10 bg-slate-50 w-fit mx-auto px-4 mt-4">
                        <button 
                          onClick={() => fetchActivities(editingLead._id, nextCursor)}
                          disabled={loadingActivities}
                          className="text-xs text-indigo-600 font-bold hover:text-indigo-800 disabled:opacity-50 uppercase tracking-wider"
                        >
                          {loadingActivities ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Load Older Activities'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
