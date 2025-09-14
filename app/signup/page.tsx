"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  useEffect(() => {
    const existing = typeof window !== "undefined" ? localStorage.getItem("username") : null;
    if (existing) setUsername(existing);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      const apiBase = 'https://hackthenorth.onrender.com';
      const res = await fetch(`${apiBase}/api/user/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Signup failed");
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("username", username.trim());
        localStorage.setItem("wallet_address", data.address);
        if (data.seed) localStorage.setItem("wallet_seed", data.seed);
      }
      router.push("/game");
    } catch (err: any) {
      alert(err?.message || "Network error");
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 text-amber-100 flex items-center justify-center p-6">
      <div className="absolute top-4 left-6 z-10 text-sm text-amber-300/90">
        <Link href="/" className="underline">Home</Link>
        <span className="mx-2">/</span>
        <span>Signup</span>
      </div>
      {/* Ambient fall glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.35),transparent_60%)]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.25),transparent_60%)]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_60%)]" />
      </div>

      {/* Falling leaves overlay */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="leaf" style={{ left: "15%", animationDelay: "-0.4s", fontSize: "16px" }}>🍁</div>
        <div className="leaf" style={{ left: "35%", animationDelay: "-0.9s", fontSize: "14px" }}>🍂</div>
        <div className="leaf" style={{ left: "55%", animationDelay: "-1.3s", fontSize: "18px" }}>🍁</div>
        <div className="leaf" style={{ left: "75%", animationDelay: "-0.2s", fontSize: "12px" }}>🍂</div>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-sm space-y-4 border border-amber-800 rounded-lg p-6 bg-amber-900/40 backdrop-blur-sm">
        <h1 className="text-xl font-semibold">Enter a username</h1>
        <input
          className="w-full border border-amber-800 bg-amber-900/40 rounded px-3 py-2 placeholder:text-amber-300/60"
          placeholder="e.g. TankAce"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" className="w-full border border-amber-700 bg-amber-600 hover:bg-amber-500 text-amber-50 rounded py-2">
          Continue to Game
        </button>
        <p className="text-sm text-amber-300/80">Wallet connect via XRPL will be added later.</p>
      </form>

      {/* Page-scoped styles for falling leaves */}
      <style jsx>{`
        .leaf {
          position: absolute;
          top: -10%;
          animation: fall 12s linear infinite;
          opacity: 0.7;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));
        }
        @keyframes fall {
          0% { transform: translate3d(0,-10%,0) rotate(0deg); }
          50% { transform: translate3d(-20px,50vh,0) rotate(180deg); }
          100% { transform: translate3d(20px,105vh,0) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


