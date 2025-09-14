"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { io, Socket } from "socket.io-client";

type PlayerState = {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
};

type Bullet = {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  lifeMs: number;
};

function getUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("username") || "Guest";
}

export default function GameCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const mount = mountRef.current!;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 18);
    camera.lookAt(0, 0, 0);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Tank (cube)
    const tankGeo = new THREE.BoxGeometry(2, 2, 2);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(0, 1, 0);
    scene.add(tank);

    // Other players storage
    const otherPlayers = new Map<string, THREE.Mesh>();

    // Bullets
    const bullets: Bullet[] = [];
    const bulletMeshes: THREE.Mesh[] = [];
    const bulletGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
    bulletGeo.rotateX(Math.PI / 2); // face forward
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });

    // Input
    const keys = new Set<string>();
    function onKey(e: KeyboardEvent) {
      if (e.type === "keydown") {
        if (e.code === "Space" || e.code.startsWith("Arrow")) {
          e.preventDefault();
        }
        if (e.code === "Space") {
          fireBullet();
          return;
        }
        keys.add(e.code);
      } else {
        keys.delete(e.code);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    // Resize
    function onResize() {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    }
    window.addEventListener("resize", onResize);

    // Socket.io client
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3002";
    const socket = io(socketUrl);
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    const username = getUsername();

    socket.on("player:update", (payload: PlayerState) => {
      const { id, position, rotationY } = payload;
      if (id === socket.id) return;
      let mesh = otherPlayers.get(id);
      if (!mesh) {
        mesh = new THREE.Mesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0x22c55e }));
        scene.add(mesh);
        otherPlayers.set(id, mesh);
      }
      mesh.position.set(position.x, position.y, position.z);
      mesh.rotation.y = rotationY;
    });

    socket.on("player:disconnect", ({ id }: { id: string }) => {
      const mesh = otherPlayers.get(id);
      if (mesh) {
        scene.remove(mesh);
        otherPlayers.delete(id);
      }
    });

    socket.on("bullet:fire", (bullet: Bullet) => {
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
      scene.add(mesh);
      bullets.push(bullet);
      bulletMeshes.push(mesh);
    });

    // Movement
    const speed = 8; // units per second
    const rotSpeed = 2.5; // radians per second
    let lastTime = performance.now();

    function fireBullet() {
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.rotation.y);
      const origin = tank.position.clone().add(forward.clone().multiplyScalar(1.5));
      const velocity = forward.multiplyScalar(20);
      const bullet: Bullet = {
        id: `${socket.id}-${Date.now()}`,
        position: { x: origin.x, y: origin.y, z: origin.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        lifeMs: 2000,
      };
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.position.set(origin.x, origin.y, origin.z);
      scene.add(mesh);
      bullets.push(bullet);
      bulletMeshes.push(mesh);
      socket.emit("bullet:fire", bullet);
    }

    window.addEventListener("click", fireBullet);

    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // controls: WASD + QE or Arrow keys to rotate
      if (keys.has("KeyQ") || keys.has("ArrowLeft")) tank.rotation.y += rotSpeed * dt;
      if (keys.has("KeyE") || keys.has("ArrowRight")) tank.rotation.y -= rotSpeed * dt;
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.rotation.y);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.rotation.y);
      const move = new THREE.Vector3();
      if (keys.has("KeyW") || keys.has("ArrowUp")) move.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) move.add(forward.clone().multiplyScalar(-1));
      if (keys.has("KeyA")) move.add(right.clone().multiplyScalar(-1));
      if (keys.has("KeyD")) move.add(right);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        tank.position.add(move);
      }

      // Keep above ground
      tank.position.y = 1;

      // Update bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const m = bulletMeshes[i];
        b.lifeMs -= dt * 1000;
        if (b.lifeMs <= 0) {
          bullets.splice(i, 1);
          const [removed] = bulletMeshes.splice(i, 1);
          if (removed) scene.remove(removed);
          continue;
        }
        b.position.x += b.velocity.x * dt;
        b.position.y += b.velocity.y * dt;
        b.position.z += b.velocity.z * dt;
        m.position.set(b.position.x, b.position.y, b.position.z);
      }

      // Broadcast my state
      socket.emit("player:update", {
        name: username,
        position: { x: tank.position.x, y: tank.position.y, z: tank.position.z },
        rotationY: tank.rotation.y,
      });

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }

    tick();

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", fireBullet);
      socket.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="w-full h-[calc(100vh-49px)]" ref={mountRef}>
      {!connected && (
        <div className="absolute top-14 left-3 text-xs bg-yellow-100 text-yellow-900 px-2 py-1 rounded">
          Connecting to server...
        </div>
      )}
    </div>
  );
}


