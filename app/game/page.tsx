"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

export default function GamePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-3 flex items-center justify-between border-b">
        <div className="text-sm">
          <Link className="underline" href="/">Home</Link>
          <span className="mx-2">/</span>
          <span>Game</span>
        </div>
        <Link className="text-sm underline" href="/signup">Change user</Link>
      </div>
      <div className="flex-1">
        <GameCanvas />
      </div>
    </div>
  );
}


