"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function WinnerPage() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setMsg(params.get("msg"));
    } catch {}
  }, []);
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 text-amber-100 flex items-center justify-center p-6">
      {/* Ambient fall glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.35),transparent_60%)]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.25),transparent_60%)]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_60%)]" />
      </div>

      {/* Falling leaves overlay */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="leaf" style={{ left: "12%", animationDelay: "-0.4s", fontSize: "16px" }}>🍁</div>
        <div className="leaf" style={{ left: "32%", animationDelay: "-0.9s", fontSize: "14px" }}>🍂</div>
        <div className="leaf" style={{ left: "54%", animationDelay: "-1.3s", fontSize: "18px" }}>🍁</div>
        <div className="leaf" style={{ left: "72%", animationDelay: "-0.2s", fontSize: "12px" }}>🍂</div>
        <div className="leaf" style={{ left: "88%", animationDelay: "-0.7s", fontSize: "20px" }}>🍃</div>
      </div>

      <main className="relative z-10 w-full max-w-lg mx-auto text-center space-y-5">
        <div className="text-sm text-amber-300/90"><Link href="/" className="underline">Home</Link> <span className="mx-2">/</span> Winner</div>
        <h1 className="text-3xl font-bold">Victory!</h1>
        <p className="text-amber-200/90">{msg || "You are the last player standing."}</p>
        <p className="text-amber-200/90">Funds will be released from escrow to your XRPL account soon.</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/game" className="inline-flex items-center justify-center rounded-md border border-amber-700 hover:border-amber-600 bg-amber-900/30 px-5 py-3 font-medium">Play Again</Link>
          <Link href="/wallet" className="inline-flex items-center justify-center rounded-md bg-amber-600 hover:bg-amber-500 text-amber-50 shadow-sm shadow-amber-900/30 px-5 py-3 font-medium">View Wallet</Link>
        </div>
      </main>

      {/* Page-scoped styles for falling leaves */}
      <style jsx>{`
        .leaf { position: absolute; top: -10%; animation: fall 12s linear infinite; opacity: 0.7; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25)); }
        @keyframes fall { 0% { transform: translate3d(0,-10%,0) rotate(0deg); } 50% { transform: translate3d(-20px,50vh,0) rotate(180deg); } 100% { transform: translate3d(20px,105vh,0) rotate(360deg); } }
      `}</style>
    </div>
  );
}


