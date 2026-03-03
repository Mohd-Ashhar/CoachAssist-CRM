"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Activity, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:5001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user);
      } else {
        setError(data.msg || "Registration failed");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Server error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel: Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[45%] lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-indigo-50 p-2 rounded-xl">
              <Activity className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight">
              WellnessZ
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
              Create an account
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Join WellnessZ and start closing leads faster today.
            </p>
          </div>

          <div className="mt-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 flex items-start gap-3 text-sm text-rose-600 animate-in fade-in slide-in-from-top-1">
                  <span className="font-medium">{error}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm transition-colors"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm transition-colors"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-700">
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm transition-colors"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-200" />
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-zinc-900 hover:text-zinc-700 transition-colors">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Panel: Visual/Branding */}
      <div className="hidden lg:block lg:flex-1 relative bg-zinc-900 overflow-hidden">
        {/* Abstract Background pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] rounded-full bg-indigo-500/20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-3xl"></div>

        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl mb-8">
            <Sparkles className="h-10 w-10 text-indigo-300" />
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-4 max-w-lg">
            "We streamlined our entire workflow with WellnessZ's beautifully simple interface."
          </h2>
          <p className="text-lg text-zinc-400 max-w-md">
            Join thousands of forward-thinking teams building better client relationships.
          </p>
          <div className="mt-12 flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-xs font-medium`}>
                  U{i}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-start gap-0.5 text-sm">
              <div className="flex text-amber-400 text-xs">★★★★★</div>
              <span className="text-zinc-400 font-medium">From 2,000+ happy users</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
