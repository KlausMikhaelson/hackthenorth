"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

export default function GamePage() {
  const [roomId, setRoomId] = useState<string>("");
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [tempRoom, setTempRoom] = useState("");
  useEffect(() => {
    const rid = typeof window !== "undefined" ? (localStorage.getItem("room_id") || "public") : "public";
    setRoomId(rid);
    setTempRoom(rid);
  }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-3 flex items-center justify-between border-b">
        <div className="text-sm">
          <Link className="underline" href="/">Home</Link>
          <span className="mx-2">/</span>
          <span>Game</span>
          {roomId && (
            <>
              <span className="mx-2">/</span>
              <span className="opacity-80">Room: {roomId}</span>
              <button onClick={() => setShowRoomModal(true)} className="ml-3 underline">
                Change room
              </button>
            </>
          )}
        </div>
        <Link className="text-sm underline" href="/signup">Change user</Link>
      </div>
      <div className="flex-1">
        <GameCanvas />
      </div>

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
              <p className="text-xs text-slate-500">Only players with this Room ID will share the same arena.</p>
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
              <button onClick={() => setShowRoomModal(false)} className="px-4 py-2 text-sm underline">Cancel</button>
              <button
                onClick={() => {
                  const next = (tempRoom || "public").trim();
                  if (typeof window !== "undefined") {
                    localStorage.setItem("room_id", next);
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:opacity-90"
              >
                Save & Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


