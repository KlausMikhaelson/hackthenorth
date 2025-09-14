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
      const base = parseFloat(server.result.info.validated_ledger.reserve_base_xrp);
      const inc = parseFloat(server.result.info.validated_ledger.reserve_inc_xrp);
      setReserveXrp(((ownerCount * inc) + base).toString());
      const balDrops = info.result.account_data.Balance;
      setBalanceXrp(dropsToXrp(balDrops));
    } catch (e) {
      console.error(e);
    }
  }

  function generate() {
    const w = Wallet.generate();
    setSeed(w.seed);
    setAddress(w.address);
    setXAddress(classicAddressToXAddress(w.address, false, false));
    localStorage.setItem("wallet_seed", w.seed);
  }

  function saveNetwork() {
    localStorage.setItem("wallet_wss", network);
  }

  return (
    <div className="min-h-screen p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm"><Link href="/" className="underline">Home</Link> <span className="mx-2">/</span> Wallet</div>
        <Link className="text-sm underline" href="/game">Back to Game</Link>
      </div>

      <div className="space-y-3 max-w-2xl">
        <div className="space-y-2">
          <label className="block text-sm font-medium">XRPL WebSocket URL</label>
          <div className="flex gap-2">
            <input className="border px-2 py-1 flex-1" value={network} onChange={(e)=>setNetwork(e.target.value)} />
            <button onClick={saveNetwork} className="border px-3 py-1">Save</button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={generate} className="border px-3 py-1">Generate Wallet</button>
            <button onClick={refresh} disabled={connecting || !address} className="border px-3 py-1">{connecting ? "Connecting..." : "Refresh"}</button>
          </div>
          <div className="text-xs text-gray-600">Seed is stored in your browser localStorage only.</div>
        </div>

        <div className="space-y-1">
          <div className="text-sm"><span className="font-medium">Seed:</span> {seed || "-"}</div>
          <div className="text-sm"><span className="font-medium">Address:</span> {address || "-"}</div>
          <div className="text-sm"><span className="font-medium">X-Address:</span> {xAddress || "-"}</div>
          <div className="text-sm"><span className="font-medium">Balance:</span> {balanceXrp} XRP</div>
          <div className="text-sm"><span className="font-medium">Reserve:</span> {reserveXrp} XRP</div>
        </div>
      </div>
    </div>
  );
}


