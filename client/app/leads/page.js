"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

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
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const fetchLeads = async () => {
    try {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
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
    setAiResult(null);
    setAiError("");
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
      fetchActivities(editingLead._id); // Refresh from start
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5001/api/leads/${editingLead._id}/ai-followup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Failed to generate");
      setAiResult(data);
      fetchActivities(editingLead._id);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
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

      setIsModalOpen(false);
      fetchLeads(); // Refresh list
    } catch (err) {
      setError(err.message || "An error occurred");
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
      fetchLeads();
    } catch (err) {
      alert("Error deleting lead");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-indigo-600 tracking-tight">WellnessZ</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
                Dashboard
              </Link>
              <span className="text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 py-1">
                Leads
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
          >
            + Add Lead
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input 
              type="text" 
              placeholder="Search by Name or Phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="w-full sm:w-48">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="INTERESTED">Interested</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div className="flex-1 sm:max-w-xs">
            <input 
              type="text" 
              placeholder="Filter by Tag..." 
              value={tagsFilter}
              onChange={(e) => setTagsFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No leads found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status & Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Follow Up</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{lead.name}</div>
                        <div className="text-sm text-gray-500">{lead.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                          lead.status === 'CONTACTED' ? 'bg-yellow-100 text-yellow-800' :
                          lead.status === 'INTERESTED' ? 'bg-indigo-100 text-indigo-800' :
                          lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {lead.status}
                        </span>
                        <div className="text-sm text-gray-500 mt-1">{lead.source}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {lead.tags && lead.tags.map((tag, idx) => (
                            <span key={idx} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleOpenModal(lead)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                        <button onClick={() => handleDelete(lead._id)} className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal / Slide-over for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingLead ? "Edit Lead" : "Add New Lead"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Lead Form */}
              <form onSubmit={handleSubmit} className={`p-6 overflow-y-auto ${editingLead ? 'md:w-1/2 md:border-r border-gray-200' : 'w-full'} space-y-4`}>
                <h3 className="font-semibold text-gray-800 mb-2">Lead Details</h3>
                {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Instagram">Instagram</option>
                      <option value="Referral">Referral</option>
                      <option value="Ads">Ads</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="INTERESTED">Interested</option>
                      <option value="CONVERTED">Converted</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input type="text" value={formData.tags} placeholder="Fitness, Premium, Cold..." onChange={e => setFormData({...formData, tags: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow Up</label>
                  <input type="date" value={formData.nextFollowUpAt} onChange={e => setFormData({...formData, nextFollowUpAt: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="submit" className="w-full px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors">
                    {editingLead ? "Save Changes" : "Create Lead"}
                  </button>
                </div>
              </form>

              {/* Timeline (Only visible in Edit Mode) */}
              {editingLead && (
                <div className="md:w-1/2 p-6 overflow-y-auto bg-gray-50 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-800">Activity Timeline</h3>
                    <button
                      onClick={handleGenerateAI}
                      disabled={aiLoading}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                    >
                      {aiLoading ? "Generating..." : "✨ AI Follow-up"}
                    </button>
                  </div>
                  
                  {/* Add Activity Form */}
                  <form onSubmit={handlePostActivity} className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex gap-2 mb-2">
                      <select 
                        value={newActivity.type} 
                        onChange={e => setNewActivity({...newActivity, type: e.target.value})}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="NOTE">Note</option>
                        <option value="CALL">Call</option>
                        <option value="WHATSAPP">WhatsApp</option>
                      </select>
                    </div>
                    <textarea 
                      placeholder="Add a well formatted note or call summary..."
                      rows={2}
                      value={newActivity.content}
                      onChange={e => setNewActivity({...newActivity, content: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 text-sm rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 mb-2 resize-none"
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors">
                        Post Activity
                      </button>
                    </div>
                  </form>

                  {/* AI Follow-up Result */}
                  {aiError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{aiError}</div>
                  )}
                  {aiResult && (
                    <div className="mb-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-bold text-purple-800">✨ AI-Generated Follow-up</h4>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">WhatsApp Message</p>
                        <p className="text-sm text-gray-800 bg-white p-2 rounded border border-gray-200">{aiResult.whatsappMessage}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Call Script</p>
                        <ul className="list-disc list-inside text-sm text-gray-800 bg-white p-2 rounded border border-gray-200 space-y-1">
                          {aiResult.callScript?.map((point, i) => <li key={i}>{point}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Objection Handler</p>
                        <p className="text-sm text-gray-800 bg-white p-2 rounded border border-gray-200 italic">{aiResult.objectionHandler}</p>
                      </div>
                    </div>
                  )}

                  {/* Activity Feed */}
                  <div className="flex-1 overflow-y-auto space-y-4">
                    {activities.length === 0 && !loadingActivities && (
                      <p className="text-gray-500 text-sm text-center py-4">No activities logged yet.</p>
                    )}
                    {activities.map((act) => (
                      <div key={act._id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            act.type === 'STATUS_CHANGE' ? 'bg-blue-100 text-blue-800' :
                            act.type === 'CALL' ? 'bg-green-100 text-green-800' :
                            act.type === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {act.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(act.createdAt).toLocaleString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {act.content && <p className="text-sm text-gray-700 whitespace-pre-wrap">{act.content}</p>}
                        <p className="text-xs text-gray-400 mt-2 text-right">By {act.createdBy?.name || 'System'}</p>
                      </div>
                    ))}
                    
                    {nextCursor && (
                      <div className="text-center pt-2 pb-4">
                        <button 
                          onClick={() => fetchActivities(editingLead._id, nextCursor)}
                          disabled={loadingActivities}
                          className="text-sm text-indigo-600 font-medium hover:text-indigo-800 disabled:opacity-50"
                        >
                          {loadingActivities ? 'Loading...' : 'Load Older Activities'}
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
