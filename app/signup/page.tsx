"use client";

import { useRouter } from "next/navigation";
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
      const apiBase = (process.env.NEXT_PUBLIC_REALTIME_URL || process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3002").replace(/\/$/, "");
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
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Enter a username</h1>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. TankAce"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" className="w-full bg-black text-white rounded py-2 hover:opacity-90">
          Continue to Game
        </button>
        <p className="text-sm text-gray-500">Wallet connect via XRPL will be added later.</p>
      </form>
    </div>
  );
}


