"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Client, Wallet, classicAddressToXAddress, dropsToXrp } from "xrpl";

const DEFAULT_WSS = process.env.NEXT_PUBLIC_XRPL_WSS || "wss://s.altnet.rippletest.net:51233";

export default function WalletPage() {
  const [seed, setSeed] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [xAddress, setXAddress] = useState<string>("");
  const [balanceXrp, setBalanceXrp] = useState<string>("-");
  const [reserveXrp, setReserveXrp] = useState<string>("-");
  const [network, setNetwork] = useState<string>(DEFAULT_WSS);
  const clientRef = useRef<Client | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Load saved wallet
  useEffect(() => {
    const s = localStorage.getItem("wallet_seed") || "";
    const n = localStorage.getItem("wallet_wss") || DEFAULT_WSS;
    setNetwork(n);
    if (s) {
      setSeed(s);
      try {
        const w = Wallet.fromSeed(s);
        setAddress(w.address);
        setXAddress(classicAddressToXAddress(w.address, false, false));
      } catch {}
    }
  }, []);

  async function connect() {
    if (clientRef.current?.isConnected()) return;
    setConnecting(true);
    const c = new Client(network);
    clientRef.current = c;
    await c.connect();
    setConnecting(false);
  }

  async function refresh() {
    try {
      await connect();
      const client = clientRef.current!;
      if (!address) return;
      const info = await client.request({ command: "account_info", account: address, ledger_index: "validated" });
      const ownerCount = info.result.account_data.OwnerCount || 0;
      const server = await client.request({ command: "server_info" });
      // @ts-ignore
      const base = parseFloat(server.result.info.validated_ledger.reserve_base_xrp);
      // @ts-ignore
      const inc = parseFloat(server.result.info.validated_ledger.reserve_inc_xrp);
      setReserveXrp(((ownerCount * inc) + base).toString());
      const balDrops = info.result.account_data.Balance;
      // @ts-ignore
      setBalanceXrp(dropsToXrp(balDrops));
    } catch (e) {
      console.error(e);
    }
  }

  function generate() {
    const w = Wallet.generate();
    // @ts-ignore
    setSeed(w.seed);
    setAddress(w.address);
    setXAddress(classicAddressToXAddress(w.address, false, false));
    // @ts-ignore
    localStorage.setItem("wallet_seed", w.seed);
  }

  function saveNetwork() {
    localStorage.setItem("wallet_wss", network);
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
        <div className="leaf" style={{ left: "12%", animationDelay: "-0.4s", fontSize: "16px" }}>🍁</div>
        <div className="leaf" style={{ left: "32%", animationDelay: "-0.9s", fontSize: "14px" }}>🍂</div>
        <div className="leaf" style={{ left: "54%", animationDelay: "-1.3s", fontSize: "18px" }}>🍁</div>
        <div className="leaf" style={{ left: "72%", animationDelay: "-0.2s", fontSize: "12px" }}>🍂</div>
        <div className="leaf" style={{ left: "88%", animationDelay: "-0.7s", fontSize: "20px" }}>🍃</div>
      </div>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-amber-300/90"><Link href="/" className="underline">Home</Link> <span className="mx-2">/</span> Wallet</div>
          <Link className="text-sm underline text-amber-300/90" href="/game">Back to Game</Link>
        </div>

        <div className="space-y-3 max-w-2xl">
          <div className="space-y-2">
            <label className="block text-sm font-medium">XRPL WebSocket URL</label>
            <div className="flex gap-2">
              <input className="border border-amber-800 bg-amber-900/40 px-3 py-2 rounded-md flex-1 placeholder:text-amber-300/60" value={network} onChange={(e)=>setNetwork(e.target.value)} />
              <button onClick={saveNetwork} className="border border-amber-800 hover:border-amber-700 bg-amber-900/40 px-4 py-2 rounded-md">Save</button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={generate} className="border border-amber-800 hover:border-amber-700 bg-amber-900/40 px-4 py-2 rounded-md">Generate Wallet</button>
              <button onClick={refresh} disabled={connecting || !address} className="border border-amber-800 hover:border-amber-700 disabled:opacity-60 bg-amber-900/40 px-4 py-2 rounded-md">{connecting ? "Connecting..." : "Refresh"}</button>
            </div>
            <div className="text-xs text-amber-300/80">Seed is stored in your browser localStorage only.</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm"><span className="font-medium">Seed:</span> {seed || "-"}</div>
            <div className="text-sm"><span className="font-medium">Address:</span> {address || "-"}</div>
            <div className="text-sm"><span className="font-medium">X-Address:</span> {xAddress || "-"}</div>
            <div className="text-sm"><span className="font-medium">Balance:</span> {balanceXrp} XRP</div>
            <div className="text-sm"><span className="font-medium">Reserve:</span> {reserveXrp} XRP</div>
          </div>
        </div>
      </main>

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


