"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Assets = {
  address: string;
  textures: string[];
  tankTypes: string[];
  selectedTexture: string | null;
  selectedTankType: string | null;
};

// Loaded dynamically from server
type TextureOption = { id: string; label: string; src: string };

const TANK_TYPES = [
  { id: "cube", label: "Cube" },
  { id: "cone", label: "Cone" },
];

export default function StorePage() {
  const [address, setAddress] = useState<string>("");
  const [assets, setAssets] = useState<Assets | null>(null);
  const [options, setOptions] = useState<TextureOption[]>([]);
  const [saving, setSaving] = useState(false);
  const apiBase = (process.env.NEXT_PUBLIC_REALTIME_URL || process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3002").replace(/\/$/, "");

  useEffect(() => {
    const addr = localStorage.getItem("wallet_address") || "";
    setAddress(addr);
    if (addr) void loadAssets(addr);
    void loadTextureOptions();
  }, []);

  async function loadAssets(addr: string) {
    try {
      const res = await fetch(`${apiBase}/api/user/assets/${addr}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch {}
  }

  async function loadTextureOptions() {
    try {
      const res = await fetch(`${apiBase}/api/assets/textures`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data);
      }
    } catch {}
  }

  async function selectTexture(texId: string) {
    if (!address) return;
    setSaving(true);
    try {
      // 1) Persist selection in store
      const res = await fetch(`${apiBase}/api/user/assets/${address}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addTexture: texId, selectedTexture: texId }),
      });
      const data = await res.json();
      if (res.ok) setAssets(data);

      // 2) Ask server to mint the NFT (skip on-ledger payment/offer for now)
      const username = localStorage.getItem("username") || "";
      if (!username) {
        console.warn("Missing username; skipping mint request");
        return;
      }
      await fetch(`${apiBase}/api/nft/mintForUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, username, sku: texId, metadata: { image: `/textures/${texId}` } }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function selectTankType(kind: string) {
    if (!address) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/user/assets/${address}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addTankType: kind, selectedTankType: kind }),
      });
      const data = await res.json();
      if (res.ok) setAssets(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm">
            <Link href="/" className="underline">Home</Link>
            <span className="mx-2">/</span>
            <span>Store</span>
          </div>
          <Link href="/game" className="text-sm underline">Back to Game</Link>
        </div>

        {!address ? (
          <div className="text-sm text-slate-300">No wallet found. Please sign up first.</div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-semibold mb-4">Select Texture</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {options.map((t) => {
                  const active = assets?.selectedTexture === t.id;
                  return (
                    <button key={t.id} onClick={() => selectTexture(t.id)} className={`rounded-xl overflow-hidden border ${active ? "border-sky-400" : "border-slate-700"} bg-slate-800/50 hover:border-slate-500 text-left`}>
                      <div className="relative w-full h-40">
                        <Image src={t.src} alt={t.label} fill className="object-cover" />
                      </div>
                      <div className="p-3 flex items-center justify-between text-sm">
                        <span>{t.label}</span>
                        {active && <span className="text-sky-400">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">Select Tank Type</h2>
              <div className="flex flex-wrap gap-3">
                {TANK_TYPES.map((k) => {
                  const active = assets?.selectedTankType === k.id;
                  return (
                    <button key={k.id} onClick={() => selectTankType(k.id)} className={`rounded-md px-4 py-2 border ${active ? "border-sky-400 bg-sky-500/10" : "border-slate-700 bg-slate-800/50"} hover:border-slate-500`}>
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="text-xs text-slate-400">Address: {address}</div>
            {saving && <div className="text-sm text-slate-300">Saving...</div>}
          </div>
        )}
      </main>
    </div>
  );
}


