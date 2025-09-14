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
  const apiBase = "https://hackthenorth.onrender.com";
  // const apiBase = 'http://localhost:3002';
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [tempRoom, setTempRoom] = useState("");

  useEffect(() => {
    const addr = localStorage.getItem("wallet_address") || "";
    setAddress(addr);
    if (addr) void loadAssets(addr);
    void loadTextureOptions();
    const rid = typeof window !== "undefined" ? (localStorage.getItem("room_id") || "public") : "public";
    setTempRoom(rid);
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
    <div className="relative min-h-screen w-full bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 text-amber-100">
      {/* Ambient fall glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.35),transparent_60%)]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.25),transparent_60%)]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_60%)]" />
      </div>

      {/* Falling leaves overlay */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="leaf" style={{ left: "10%", animationDelay: "-0.4s", fontSize: "16px" }}>🍁</div>
        <div className="leaf" style={{ left: "28%", animationDelay: "-1.0s", fontSize: "14px" }}>🍂</div>
        <div className="leaf" style={{ left: "50%", animationDelay: "-0.7s", fontSize: "18px" }}>🍁</div>
        <div className="leaf" style={{ left: "66%", animationDelay: "-1.4s", fontSize: "12px" }}>🍂</div>
        <div className="leaf" style={{ left: "82%", animationDelay: "-0.2s", fontSize: "20px" }}>🍃</div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-amber-300/90">
            <Link href="/" className="underline">Home</Link>
            <span className="mx-2">/</span>
            <span>Store</span>
            <span className="mx-2">/</span>
            <button
              className="underline"
              onClick={() => setShowRoomModal(true)}
            >
              Change room
            </button>
          </div>
          <Link href="/game" className="text-sm underline text-amber-300/90">Back to Game</Link>
        </div>

        {!address ? (
          <div className="text-sm text-amber-200/90">No wallet found. Please sign up first.</div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-semibold mb-4">Select Texture</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {options.map((t) => {
                  const active = assets?.selectedTexture === t.id;
                  return (
                    <button key={t.id} onClick={() => selectTexture(t.id)} className={`rounded-xl overflow-hidden border ${active ? "border-amber-400" : "border-amber-800"} bg-amber-900/40 hover:border-amber-700 text-left`}>
                      <div className="relative w-full h-40">
                        <Image src={t.src} alt={t.label} fill className="object-cover" />
                        <div className="absolute top-2 left-2 text-[11px]">
                          <span className="inline-flex items-center rounded-full border border-amber-800 bg-amber-900/70 px-2 py-0.5">1 XRLUSD</span>
                        </div>
                      </div>
                      <div className="p-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-amber-800 bg-amber-900/40 px-2 py-0.5 text-[11px]">1 XRLUSD</span>
                          <span>{t.label}</span>
                        </div>
                        {active && <span className="text-amber-400">Selected</span>}
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
                    <button key={k.id} onClick={() => selectTankType(k.id)} className={`rounded-md px-4 py-2 border ${active ? "border-amber-400 bg-amber-500/10" : "border-amber-800 bg-amber-900/40"} hover:border-amber-700`}>
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="text-xs text-amber-300/80">Address: {address}</div>
            {saving && <div className="text-sm text-amber-200/90">Saving...</div>}
          </div>
        )}
      </main>

      {showRoomModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRoomModal(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-lg border shadow-lg bg-white text-slate-900">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Change Room</h3>
              <button onClick={() => setShowRoomModal(false)} className="text-sm underline">Close</button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-sm">Room ID</label>
              <input
                value={tempRoom}
                onChange={(e) => setTempRoom(e.target.value)}
                placeholder="e.g. public or friends-lobby"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-slate-500">This sets the room your game will join.</p>
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
              <button onClick={() => setShowRoomModal(false)} className="px-4 py-2 text-sm underline">Cancel</button>
              <button
                onClick={() => {
                  const next = (tempRoom || "public").trim();
                  if (typeof window !== "undefined") {
                    localStorage.setItem("room_id", next);
                    setShowRoomModal(false);
                    alert(`Room set to ${next}. Go to the Game to join this room.`);
                  }
                }}
                className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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


