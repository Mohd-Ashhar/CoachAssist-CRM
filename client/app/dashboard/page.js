"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, TrendingUp, AlertCircle, Target, Activity, LogOut } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const STATUS_COLORS = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-amber-500",
  INTERESTED: "bg-indigo-500",
  CONVERTED: "bg-emerald-500",
  LOST: "bg-rose-500",
};

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5001/api/dashboard/analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setAnalytics(await res.json());
        }
      } catch (err) {
        console.error("Failed to load analytics");
      } finally {
        setAnalyticsLoading(false);
      }
    };
    if (user) fetchAnalytics();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  const chartData = analytics?.activityGraph?.map((day) => ({
    name: new Date(day._id + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: day.count,
  })) || [];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <nav className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 border-b border-indigo-900/50 sticky top-0 z-10 shadow-md">
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
              <Link href="/leads" className="text-sm font-medium text-indigo-100/70 hover:text-white transition-colors">
                Leads
              </Link>
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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome back, here is what is happening with your leads today.</p>
        </div>

        {analyticsLoading ? (
          <DashboardSkeleton />
        ) : !analytics ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-zinc-100 shadow-sm">
            <AlertCircle className="h-10 w-10 text-zinc-400 mb-3" />
            <p className="text-zinc-500 font-medium">Could not load analytics data.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Metric Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <StatCard
                title="Total Leads"
                value={analytics.totalLeads}
                icon={Users}
                trend={{ value: "+12%", isUp: true }}
              />
              <StatCard
                title="Conversion Rate"
                value={`${(analytics.conversionRate * 100).toFixed(1)}%`}
                icon={TrendingUp}
                trend={{ value: "+2.4%", isUp: true }}
              />
              <StatCard
                title="Overdue Follow-ups"
                value={analytics.overdueFollowUps}
                icon={AlertCircle}
                alert={analytics.overdueFollowUps > 0}
                trend={{ value: "-4", isUp: true }}
              />
              <StatCard
                title="Top Source"
                value={analytics.topSources?.[0]?._id || "—"}
                icon={Target}
                trend={{ value: "+8%", isUp: true }}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Activity Chart */}
              <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-zinc-100 p-6 flex flex-col">
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-zinc-950">Activity Overview</h2>
                  <p className="text-sm text-zinc-500">New leads over the last 7 days</p>
                </div>
                
                {chartData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[300px]">
                    <p className="text-zinc-400 text-sm">No activity recorded in the last 7 days.</p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#71717a', fontSize: 13 }} 
                          dy={12}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#71717a', fontSize: 13 }}
                          dx={-12}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: '1px solid #f4f4f5', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                            padding: '12px'
                          }}
                          itemStyle={{ color: '#09090b', fontWeight: 600 }}
                          labelStyle={{ color: '#71717a', marginBottom: '4px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#8b5cf6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorCount)"
                          activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#FFFFFF', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Sidebar Content (Funnel & Sources) */}
              <div className="col-span-1 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                  <h2 className="text-base font-semibold text-zinc-900 mb-4">Lead Funnel</h2>
                  <div className="space-y-4">
                    {analytics.funnel.map((item) => {
                      const pct = analytics.totalLeads > 0 ? (item.count / analytics.totalLeads) * 100 : 0;
                      return (
                        <div key={item._id}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-medium text-zinc-700">{item._id}</span>
                            <span className="text-zinc-500 font-medium">{item.count} <span className="text-zinc-400 font-normal">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${STATUS_COLORS[item._id] || "bg-zinc-400"}`}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {analytics.funnel.length === 0 && (
                      <p className="text-zinc-400 text-sm py-4 text-center">No leads yet.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                  <h2 className="text-base font-semibold text-zinc-900 mb-4">Top Sources</h2>
                  <div className="space-y-3">
                    {analytics.topSources.map((src, idx) => (
                      <div key={src._id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm border border-zinc-200 text-xs font-medium text-zinc-500">
                            {idx + 1}
                          </div>
                          <span className="text-sm font-medium text-zinc-700 capitalize">{src._id || "Unknown"}</span>
                        </div>
                        <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {src.count}
                        </span>
                      </div>
                    ))}
                    {analytics.topSources.length === 0 && (
                      <p className="text-zinc-400 text-sm py-4 text-center">No source data.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, alert, trend }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200 flex flex-col transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
        {Icon && (
          <div className={`p-2 rounded-lg ${alert ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-500"}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        )}
      </div>
      <div>
        <p className={`text-3xl font-bold tracking-tight truncate ${alert ? 'text-rose-600' : 'text-zinc-900'}`}>
          {value}
        </p>
        {trend && (
          <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${trend.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
            <span className={`flex items-center px-1.5 py-0.5 rounded-md ${trend.isUp ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              {trend.value}
            </span>
            <span className="text-zinc-400 font-normal text-xs">vs last week</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-100 h-36 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
              <div className="h-10 w-10 bg-zinc-200 rounded-xl"></div>
            </div>
            <div className="space-y-2 mt-4">
              <div className="h-8 bg-zinc-200 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-100 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl border border-zinc-100 p-6 h-[400px]">
          <div className="h-5 bg-zinc-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-zinc-100 rounded w-1/3 mb-8"></div>
          <div className="h-64 bg-zinc-50 rounded-lg"></div>
        </div>
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-100 p-6 h-[220px]">
            <div className="h-5 bg-zinc-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-5">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <div className="h-3 bg-zinc-200 rounded w-1/4"></div>
                    <div className="h-3 bg-zinc-200 rounded w-1/6"></div>
                  </div>
                  <div className="h-2 bg-zinc-50 rounded-full w-full"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-zinc-100 p-6 h-[176px]">
            <div className="h-5 bg-zinc-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-12 bg-zinc-50 rounded-xl border border-zinc-100"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
