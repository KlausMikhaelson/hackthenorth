"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("msg");
      if (m) setMsg(m);
    } catch {}
  }, []);
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 text-amber-100">
      {/* Ambient fall glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.35),transparent_60%)]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.25),transparent_60%)]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_60%)]" />
      </div>

      {/* Falling leaves overlay */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="leaf" style={{ left: "8%", animationDelay: "-0.5s", fontSize: "18px" }}>🍁</div>
        <div className="leaf" style={{ left: "24%", animationDelay: "-1.2s", fontSize: "14px" }}>🍂</div>
        <div className="leaf" style={{ left: "42%", animationDelay: "-0.9s", fontSize: "16px" }}>🍁</div>
        <div className="leaf" style={{ left: "58%", animationDelay: "-1.6s", fontSize: "12px" }}>🍂</div>
        <div className="leaf" style={{ left: "72%", animationDelay: "-0.3s", fontSize: "20px" }}>🍃</div>
        <div className="leaf" style={{ left: "86%", animationDelay: "-1.0s", fontSize: "15px" }}>🍁</div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        {msg && (
          <div className="mb-4 text-sm bg-amber-100 text-amber-900 px-3 py-2 rounded border border-amber-300">
            {msg}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-700 bg-amber-800/50 px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              Autumn Multiplayer Prototype
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
              Build, Battle, and Mint
              <span className="block text-amber-400">Your Tank on XRPL</span>
            </h1>
            <p className="text-amber-200/90 max-w-prose">
              Crisp air, golden leaves, and heated battles. Generate a wallet on sign-up,
              mint NFTs for your tank, and bring your autumn style into the arena.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup" className="inline-flex items-center justify-center rounded-md bg-amber-600 hover:bg-amber-500 text-amber-50 shadow-sm shadow-amber-900/30 px-5 py-3 font-medium">
                Get Started
              </Link>
              <Link href="/game" className="inline-flex items-center justify-center rounded-md border border-amber-700 hover:border-amber-600 bg-amber-900/30 px-5 py-3 font-medium">
                Enter Game
              </Link>
              <Link href="/wallet" className="inline-flex items-center justify-center rounded-md border border-amber-700 hover:border-amber-600 bg-amber-900/30 px-5 py-3 font-medium">
                Wallet
              </Link>
              <Link href="/store" className="inline-flex items-center justify-center rounded-md border border-amber-700 hover:border-amber-600 bg-amber-900/30 px-5 py-3 font-medium">
                Store
              </Link>
            </div>
            <div className="flex items-center gap-4 pt-2 text-xs text-amber-300/80">
              <div className="flex items-center gap-2">
                <Image src="/globe.svg" alt="XRPL" width={16} height={16} /> XRPL Testnet Ready
              </div>
              <div className="flex items-center gap-2">
                <Image src="/window.svg" alt="Three.js" width={16} height={16} /> Three.js
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] w-full rounded-2xl bg-amber-900/40 border border-amber-700 backdrop-blur-sm flex items-center justify-center overflow-hidden">
              <Image className="opacity-90 h-full w-full object-cover" src="/image.png" alt="Autumn Arena" width={220} height={220} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35))]" />
            </div>
          </div>
        </section>

        <section className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-amber-800 bg-amber-900/40 p-5">
            <h3 className="font-semibold">Instant Wallet</h3>
            <p className="text-sm text-amber-200/90 mt-1">Sign up to auto-generate an XRPL wallet and store it securely.</p>
          </div>
          <div className="rounded-xl border border-amber-800 bg-amber-900/40 p-5">
            <h3 className="font-semibold">Mint Skins</h3>
            <p className="text-sm text-amber-200/90 mt-1">Buy a skin and we mint an NFT to your wallet automatically.</p>
          </div>
          <div className="rounded-xl border border-amber-800 bg-amber-900/40 p-5">
            <h3 className="font-semibold">Bring to Battle</h3>
            <p className="text-sm text-amber-200/90 mt-1">Your NFTs determine your tank’s look and feel in-game.</p>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-amber-900/80">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-amber-300/80 flex items-center justify-between">
          <span>© {new Date().getFullYear()} HTN-25</span>
          <div className="flex items-center gap-4">
            <a className="hover:underline" href="https://xrpl.org" target="_blank" rel="noreferrer">XRPL Docs</a>
            <a className="hover:underline" href="https://threejs.org" target="_blank" rel="noreferrer">Three.js</a>
          </div>
        </div>
      </footer>

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
