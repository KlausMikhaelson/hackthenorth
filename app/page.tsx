"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const params = useSearchParams();
  const msg = params.get("msg");
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <main className="mx-auto max-w-6xl px-6 py-12">
        {msg && (
          <div className="mb-4 text-sm bg-red-100 text-red-900 px-3 py-2 rounded border border-red-300">
            {msg}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              Live Multiplayer Prototype
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
              Build, Battle, and Mint
              <span className="block text-sky-400">Your Tank on XRPL</span>
            </h1>
            <p className="text-slate-300 max-w-prose">
              Enter the arena, earn hits, and collect skins. Generate a wallet on sign-up, mint
              NFTs for your tank, and bring them into battle.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup" className="inline-flex items-center justify-center rounded-md bg-sky-500 hover:bg-sky-400 text-white px-5 py-3 font-medium">
                Get Started
              </Link>
              <Link href="/game" className="inline-flex items-center justify-center rounded-md border border-slate-600 hover:border-slate-500 px-5 py-3 font-medium">
                Enter Game
              </Link>
              <Link href="/wallet" className="inline-flex items-center justify-center rounded-md border border-slate-600 hover:border-slate-500 px-5 py-3 font-medium">
                Wallet
              </Link>
              <Link href="/store" className="inline-flex items-center justify-center rounded-md border border-slate-600 hover:border-slate-500 px-5 py-3 font-medium">
                Store
              </Link>
            </div>
            <div className="flex items-center gap-4 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Image src="/globe.svg" alt="XRPL" width={16} height={16} /> XRPL Testnet Ready
              </div>
              <div className="flex items-center gap-2">
                <Image src="/window.svg" alt="Three.js" width={16} height={16} /> Three.js
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] w-full rounded-2xl bg-slate-800/60 border border-slate-700 backdrop-blur-sm flex items-center justify-center overflow-hidden">
              <Image className="dark:invert opacity-80" src="/next.svg" alt="Logo" width={220} height={48} />
            </div>
          </div>
        </section>

        <section className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
            <h3 className="font-semibold">Instant Wallet</h3>
            <p className="text-sm text-slate-300 mt-1">Sign up to auto-generate an XRPL wallet and store it securely.</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
            <h3 className="font-semibold">Mint Skins</h3>
            <p className="text-sm text-slate-300 mt-1">Buy a skin and we mint an NFT to your wallet automatically.</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
            <h3 className="font-semibold">Bring to Battle</h3>
            <p className="text-sm text-slate-300 mt-1">Your NFTs determine your tank’s look and feel in-game.</p>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-slate-800/80">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-400 flex items-center justify-between">
          <span>© {new Date().getFullYear()} HTN-25</span>
          <div className="flex items-center gap-4">
            <a className="hover:underline" href="https://xrpl.org" target="_blank" rel="noreferrer">XRPL Docs</a>
            <a className="hover:underline" href="https://threejs.org" target="_blank" rel="noreferrer">Three.js</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
