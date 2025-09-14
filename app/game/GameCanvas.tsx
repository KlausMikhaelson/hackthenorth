"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// Physics removed; simple kinematics only

type PlayerState = {
  id: string;
  name: string;
  position?: { x: number; y: number; z: number };
  rotationY?: number;
  health?: number;
  score?: number;
  textureSrc?: string | null;
};

type Bullet = {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  lifeMs: number;
  shooterId?: string;
};

type PlayerEntity = {
  tank: THREE.Mesh;
  nameSprite: THREE.Sprite;
  healthBarBg: THREE.Mesh;
  healthBarFg: THREE.Mesh;
  health: number;
  score?: number;
  textureSrc?: string | null;
};

function getUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("username") || "Guest";
}

export default function GameCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [myScore, setMyScore] = useState(0);
  const hadMultiplePlayersRef = useRef(false);

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
    const cameraOffset = new THREE.Vector3(0, 6, 12);

    // Orbit controls (disabled zoom/pan, only rotate around player)
    const controls = new OrbitControls(camera, renderer.domElement);


    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    // Prevent looking below the ground plane (tweak as desired)
    controls.minPolarAngle = 0.1; // slightly above straight up
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // just above horizon
    // Environment cube map from public/texture
    (function loadEnvironment() {
      const loader = new THREE.CubeTextureLoader();
      loader.setPath("/textures/");
      const tryLoad = (urls: string[]) =>
        new Promise<THREE.CubeTexture>((resolve, reject) => {
          loader.load(urls, (tex) => resolve(tex), undefined, (err) => reject(err));
        });
      // Preferred order per three.js: [px, nx, py, ny, pz, nz]
      tryLoad(["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"]).then(
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          scene.background = tex;
          scene.environment = tex;
        },
        () => {
          // Fallback to user-provided naming example
          tryLoad(["nx.png", "px.png", "py1.png", "ny.png", "nz.png", "pz.png"]).then((tex2) => {
            tex2.colorSpace = THREE.SRGBColorSpace;
            scene.background = tex2;
            scene.environment = tex2;
          }).catch(() => {
            // Ignore if textures are not present
          });
        }
      );
    })();

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // Ground
    const GROUND_SIZE = 200;
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Apply repeating grass texture to ground
    (function applyGroundTexture() {
      const loader = new THREE.TextureLoader();
      const tiles = Math.max(1, Math.floor(GROUND_SIZE / 2)); // how many repeats across the plane
      const setTex = (tex: THREE.Texture) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(tiles, tiles);
        const mat = new THREE.MeshStandardMaterial({ map: tex });
        ground.material = mat;
      };
      loader.load(
        "/textures/green-grass.png",
        (tex) => setTex(tex),
        undefined,
        () => {
          // fallback to jpg if png missing
          loader.load(
            "/textures/green-grass.jpg",
            (tex) => setTex(tex)
          );
        }
      );
    })();

    // Build boundary walls around the map to match ground size
    (function buildWalls() {
      const WALL_HEIGHT = 4;
      const WALL_THICKNESS = 1;
      const half = GROUND_SIZE / 2;
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x374151 });

      // North/South walls (along X axis)
      const nsGeo = new THREE.BoxGeometry(GROUND_SIZE, WALL_HEIGHT, WALL_THICKNESS);
      const north = new THREE.Mesh(nsGeo, wallMat);
      north.position.set(0, WALL_HEIGHT / 2, -half);
      const south = new THREE.Mesh(nsGeo, wallMat);
      south.position.set(0, WALL_HEIGHT / 2, half);

      // East/West walls (along Z axis)
      const ewGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, GROUND_SIZE);
      const east = new THREE.Mesh(ewGeo, wallMat);
      east.position.set(half, WALL_HEIGHT / 2, 0);
      const west = new THREE.Mesh(ewGeo, wallMat);
      west.position.set(-half, WALL_HEIGHT / 2, 0);

      scene.add(north, south, east, west);
    })();

    // Add cherry tree models from public/models
    (function addCherryTrees() {
      const loader = new GLTFLoader();
      const gltf = "/models/cherry_tree/scene.gltf";
      const positions = [
        new THREE.Vector3(30, 0, 30),
        new THREE.Vector3(-30, 0, 30),
        new THREE.Vector3(30, 0, -30),
        new THREE.Vector3(-30, 0, -30),
        new THREE.Vector3(0, 0, 45),
        new THREE.Vector3(45, 0, 0),
      ];
      function createDeterministicRandom(seed: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seed.length; i++) {
          h ^= seed.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return function rand() {
          h += 0x6D2B79F5;
          let t = Math.imul(h ^ (h >>> 15), 1 | h);
          t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      const addTrees = (root: THREE.Object3D) => {
        positions.forEach((p) => {
          const rand = createDeterministicRandom(`${p.x},${p.z}`);
          const obj = root.clone(true);
          obj.position.set(p.x, 0, p.z);
          const s = 1.8 + rand() * 0.6; // slight deterministic variation
          obj.scale.set(s, s, s);
          obj.rotation.y = rand() * Math.PI * 2;
          scene.add(obj);
        });
      };
      loader.load(gltf, (g) => addTrees(g.scene || (g as any)));
    })();

    // Add scattered stones from public/models
    (function addStones() {
      const loader = new GLTFLoader();
      const gltf = "/models/stone/scene.gltf";
      const coords: Array<[number, number]> = [
        [-85, -70], [-65, -45], [-40, -60], [-20, -80], [5, -70], [30, -55], [60, -65], [80, -40],
        [-80, 40], [-55, 60], [-30, 75], [-5, 65], [20, 80], [45, 55], [70, 70], [85, 45],
        [-90, 0], [-60, 0], [-30, 0], [0, -30], [0, 30], [30, 0], [60, 0], [90, 0],
      ];
      // Pull stones further inward toward center and add a few central placements
      const inward = 0.45;
      const clampInside = (v: number, limit = 90) => Math.max(-limit, Math.min(limit, v));
      const positions = [
        ...coords.map(([x, z]) => new THREE.Vector3(clampInside(x * inward), 0, clampInside(z * inward))),
        new THREE.Vector3(-25, 0, -15),
        new THREE.Vector3(0, 0, -20),
        new THREE.Vector3(22, 0, -10),
        new THREE.Vector3(-18, 0, 12),
        new THREE.Vector3(6, 0, 18),
        new THREE.Vector3(26, 0, 6),
        new THREE.Vector3(-8, 0, -6),
        new THREE.Vector3(12, 0, 0),
        new THREE.Vector3(-12, 0, 2),
      ];
      // Reduce total count a bit (~60% kept)
      const selectedPositions = positions.filter((_, i) => (i % 5 !== 1 && i % 5 !== 3));
      // Deterministic pseudo-random generator from a string seed
      function createDeterministicRandom(seed: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seed.length; i++) {
          h ^= seed.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return function rand() {
          h += 0x6D2B79F5;
          let t = Math.imul(h ^ (h >>> 15), 1 | h);
          t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      const placeStones = (root: THREE.Object3D) => {
        selectedPositions.forEach((p) => {
          const obj = root.clone(true);
          obj.position.set(p.x, 0, p.z);
          // Use deterministic random per position for consistent visuals across clients
          const rand = createDeterministicRandom(`${p.x},${p.z}`);
          const s = 0.01125 + rand() * 0.01875; // ~0.011–0.03
          obj.scale.set(s, s, s);
          obj.rotation.y = rand() * Math.PI * 2;
          scene.add(obj);
        });
      };
      loader.load(gltf, (g) => placeStones(g.scene || (g as any)));
    })();

    // Tank (cube)
    const tankGeo = new THREE.BoxGeometry(2, 2, 2);
    const tankDefaultMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    const tank = new THREE.Mesh(tankGeo, tankDefaultMat);
    tank.position.set(0, 1, 0);
    scene.add(tank);

    // Name label and health bar helpers
    function createNameSprite(name: string): THREE.Sprite {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(3, 0.8, 1);
      return sprite;
    }

    function createHealthBar(): { bg: THREE.Mesh; fg: THREE.Mesh } {
      const BAR_W = 2;
      const BAR_H = 0.2;
      const bgGeo = new THREE.PlaneGeometry(BAR_W, BAR_H);
      const fgGeo = new THREE.PlaneGeometry(BAR_W, BAR_H);
      const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const fgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      return { bg: new THREE.Mesh(bgGeo, bgMat), fg: new THREE.Mesh(fgGeo, fgMat) };
    }

    // Local overlays
    const myNameSprite = createNameSprite(getUsername());
    scene.add(myNameSprite);
    const myHealthBar = createHealthBar();
    scene.add(myHealthBar.bg);
    scene.add(myHealthBar.fg);

    // Other players storage
    const otherPlayers = new Map<string, PlayerEntity>();

    // Bullets
    const bullets: Bullet[] = [];
    const bulletMeshes: THREE.Mesh[] = [];
    // No physics bodies
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
    const socketUrl = "https://hackthenorth.onrender.com";
    // const socketUrl = 'http://localhost:3002';
    const socket = io(socketUrl);
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    const username = getUsername();
    let myTextureSrc: string | null = null;
    // Helper: apply a texture to all 4 side faces of the tank (±X, ±Z)
    function applySideTextures(mesh: THREE.Mesh, textureSrc: string) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureSrc,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          // Create 6 materials for box faces
          // Indices: 0:+X, 1:-X, 2:+Y (top), 3:-Y (bottom), 4:+Z, 5:-Z
          const faceMats: THREE.MeshStandardMaterial[] = [
            new THREE.MeshStandardMaterial({ map: tex }), // +X
            new THREE.MeshStandardMaterial({ map: tex }), // -X
            new THREE.MeshStandardMaterial({ map: tex }), // +Y (top)
            new THREE.MeshStandardMaterial({ color: 0x38bdf8 }), // -Y (bottom)
            new THREE.MeshStandardMaterial({ map: tex }), // +Z
            new THREE.MeshStandardMaterial({ map: tex }), // -Z
          ];
          mesh.material = faceMats;
        },
        undefined,
        () => {
          // ignore load errors silently
        }
      );
    }

    // Fetch wallet-address bound user NFTs for texture decisions
    (async () => {
      try {
        const addr = localStorage.getItem("wallet_address");
        if (!addr) return;
        const apiBase = "https://hackthenorth.onrender.com";
        // const apiBase = 'http://localhost:3002';
        const res = await fetch(`${apiBase}/api/user/byAddress/${addr}`);
        if (res.ok) {
          const data = await res.json();
          console.log("User NFT summary:", data);
          let textureSrc: string | null = null;
          if (data?.selectedTextureSrc) {
            textureSrc = data.selectedTextureSrc as string;
          } else if (data?.selectedNFT?.name && typeof data.selectedNFT.name === "string") {
            textureSrc = data.selectedNFT.name as string;
          } else if (Array.isArray(data.nfts) && data.nfts.length > 0 && typeof data.nfts[0]?.name === "string") {
            textureSrc = data.nfts[0].name as string;
          }
          if (textureSrc) {
            applySideTextures(tank, textureSrc);
            myTextureSrc = textureSrc;
            // Broadcast my selected texture so others can see it
            socket.emit("player:update", { textureSrc });
          } else {
            console.log("No texture selected or available for user.");
          }
        }
      } catch {}
    })();

    // Initial sync
    socket.on("players:state", (existing: PlayerState[]) => {
      existing.forEach((p) => {
        if (p.id === socket.id) return;
        if (!otherPlayers.get(p.id)) {
          const mesh = new THREE.Mesh(tankGeo, tankDefaultMat);
          const px = p.position?.x ?? 0;
          const py = p.position?.y ?? 1;
          const pz = p.position?.z ?? 0;
          mesh.position.set(px, py, pz);
          mesh.rotation.y = p.rotationY ?? 0;
          const nameSprite = createNameSprite(p.name || "Player");
          const { bg, fg } = createHealthBar();
          scene.add(mesh);
          scene.add(nameSprite);
          scene.add(bg);
          scene.add(fg);
          const entity: PlayerEntity = { tank: mesh, nameSprite, healthBarBg: bg, healthBarFg: fg, health: p.health ?? 100, score: p.score ?? 0, textureSrc: null };
          otherPlayers.set(p.id, entity);
          if (p.textureSrc && entity.textureSrc !== p.textureSrc) {
            applySideTextures(mesh, p.textureSrc);
            entity.textureSrc = p.textureSrc;
          }
        }
      });
      // Track if the room has ever had 2+ players
      const totalPlayersNow = otherPlayers.size + 1; // me + others
      if (totalPlayersNow >= 2) hadMultiplePlayersRef.current = true;
    });

    socket.on("player:join", (p: PlayerState) => {
      if (p.id === socket.id) return;
      if (!otherPlayers.get(p.id)) {
        const mesh = new THREE.Mesh(tankGeo, tankDefaultMat);
        const px = p.position?.x ?? 0;
        const py = p.position?.y ?? 1;
        const pz = p.position?.z ?? 0;
        mesh.position.set(px, py, pz);
        mesh.rotation.y = p.rotationY ?? 0;
        const nameSprite = createNameSprite(p.name || "Player");
        const { bg, fg } = createHealthBar();
        scene.add(mesh);
        scene.add(nameSprite);
        scene.add(bg);
        scene.add(fg);
        const entity: PlayerEntity = { tank: mesh, nameSprite, healthBarBg: bg, healthBarFg: fg, health: p.health ?? 100, score: p.score ?? 0, textureSrc: null };
        otherPlayers.set(p.id, entity);
        if (p.textureSrc && entity.textureSrc !== p.textureSrc) {
          applySideTextures(mesh, p.textureSrc);
          entity.textureSrc = p.textureSrc;
        }
      }
      // Mark that a match is active when we reach 2+ players
      const totalPlayersNow = otherPlayers.size + 1;
      if (totalPlayersNow >= 2) hadMultiplePlayersRef.current = true;
    });

    socket.on("player:update", (payload: PlayerState) => {
      const { id, position, rotationY } = payload;
      if (id === socket.id) return;
      let entity = otherPlayers.get(id);
      if (!entity) {
        const mesh = new THREE.Mesh(tankGeo, tankDefaultMat);
        const nameSprite = createNameSprite(payload.name || "Player");
        const { bg, fg } = createHealthBar();
        scene.add(mesh);
        scene.add(nameSprite);
        scene.add(bg);
        scene.add(fg);
        entity = { tank: mesh, nameSprite, healthBarBg: bg, healthBarFg: fg, health: payload.health ?? 100, textureSrc: null };
        otherPlayers.set(id, entity);
      }
      if (position) {
        entity.tank.position.set(position.x, position.y, position.z);
      }
      if (typeof rotationY === "number") {
        entity.tank.rotation.y = rotationY;
      }
      if (payload.textureSrc && entity.textureSrc !== payload.textureSrc) {
        applySideTextures(entity.tank, payload.textureSrc);
        entity.textureSrc = payload.textureSrc;
      }
    });

    socket.on("player:disconnect", ({ id }: { id: string }) => {
      const entity = otherPlayers.get(id);
      if (entity) {
        scene.remove(entity.tank);
        scene.remove(entity.nameSprite);
        scene.remove(entity.healthBarBg);
        scene.remove(entity.healthBarFg);
        otherPlayers.delete(id);
      }
      // If we previously had 2+ players and now only 1 remains (me), declare win
      const totalPlayersNow = otherPlayers.size + 1;
      if (!redirectedRef.current && hadMultiplePlayersRef.current && totalPlayersNow === 1) {
        redirectedRef.current = true;
        router.push("/winner?msg=" + encodeURIComponent("You won! Escrow will release the prize to your account soon."));
      }
    });

    socket.on("bullet:fire", (bullet: any) => {
      const shooterId = (bullet as any).id as string | undefined;
      const newBullet: Bullet = { ...bullet, shooterId };
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.position.set(newBullet.position.x, newBullet.position.y, newBullet.position.z);
      scene.add(mesh);
      bullets.push(newBullet);
      bulletMeshes.push(mesh);
    });

    socket.on("player:health", ({ id, health }: { id: string; health: number }) => {
      if (id === socket.id) {
        myHealth = health;
        if (myHealth <= 0 && !redirectedRef.current) {
          redirectedRef.current = true;
          router.push("/?msg=" + encodeURIComponent("You died. Try again."));
          return;
        }
      }
      const e = otherPlayers.get(id);
      if (e) {
        e.health = health;
      }
    });

    socket.on("player:score", ({ id, score }: { id: string; score: number }) => {
      const e = otherPlayers.get(id);
      if (id === socket.id) {
        setMyScore(score);
      }
      if (e) {
        e.score = score;
      }
    });

    // Movement
    const speed = 8; // units per second
    const rotSpeed = 2.5; // radians per second
    let lastTime = performance.now();

    // No physics world
    let myHealth = 100;

    // No physics helpers

    function fireBullet() {
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.rotation.y);
      const origin = tank.position.clone().add(forward.clone().multiplyScalar(1.5));
      const velocity = forward.multiplyScalar(20);
      const bullet: Bullet = {
        id: `${socket.id}-${Date.now()}`,
        position: { x: origin.x, y: origin.y, z: origin.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        lifeMs: 8000,
        shooterId: socket.id,
      };
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.position.set(origin.x, origin.y, origin.z);
      scene.add(mesh);
      bullets.push(bullet);
      bulletMeshes.push(mesh);
      // No physics body
      socket.emit("bullet:fire", bullet);
    }

    window.addEventListener("click", fireBullet);

    // Room join UI (simple prompt modal)
    const roomId = (typeof window !== 'undefined' ? (localStorage.getItem('room_id') || prompt('Enter Room ID (or type new ID to create):', 'public') || 'public') : 'public');
    if (typeof window !== 'undefined') localStorage.setItem('room_id', roomId);
    socket.emit('room:join', { roomId });
    socket.once('room:joined', () => {
      // Compute a random spawn near the center, avoiding overlap with others if possible
      const SPAWN_RADIUS = 25; // small radius from center
      function pickSpawn() {
        // Uniform random point in a disk
        const r = Math.sqrt(Math.random()) * SPAWN_RADIUS;
        const a = Math.random() * Math.PI * 2;
        const x = r * Math.cos(a);
        const z = r * Math.sin(a);
        return new THREE.Vector3(x, 1, z);
      }
      function isFarFromOthers(p: THREE.Vector3) {
        let ok = true;
        otherPlayers.forEach((e) => {
          const dx = e.tank.position.x - p.x;
          const dz = e.tank.position.z - p.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 25) ok = false; // at least 5 units away
        });
        return ok;
      }
      let spawn = pickSpawn();
      for (let i = 0; i < 20; i++) {
        if (isFarFromOthers(spawn)) break;
        spawn = pickSpawn();
      }
      tank.position.set(spawn.x, spawn.y, spawn.z);
      // Random initial facing
      tank.rotation.y = Math.random() * Math.PI * 2;
      // Announce my join after room is set
      socket.emit("player:join", {
        name: username,
        position: { x: tank.position.x, y: tank.position.y, z: tank.position.z },
        rotationY: tank.rotation.y,
        textureSrc: myTextureSrc,
      });
    });

    // Lock orbit distance to current camera distance from tank
    const initialOrbitDistance = () => {


      const d = camera.position.distanceTo(tank.position);
      controls.minDistance = d;
      controls.maxDistance = d;
    };
    initialOrbitDistance();

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
      tank.position.y = 1;

      // Detect bullet vs player overlaps in simple kinematics
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const shooterId = b.shooterId;

        // First: check collision with ME (target client removes without emitting)
        if (shooterId && shooterId !== socket.id) {
          const dxMe = tank.position.x - b.position.x;
          const dyMe = tank.position.y - b.position.y;
          const dzMe = tank.position.z - b.position.z;
          const distMe = Math.sqrt(dxMe * dxMe + dyMe * dyMe + dzMe * dzMe);
          if (distMe < 1.2) {
            bullets.splice(i, 1);
            const m = bulletMeshes.splice(i, 1)[0];
            if (m) scene.remove(m);
            continue;
          }
        }

        // Then: check other players (not the shooter); shooter emits the hit
        let removed = false;
        otherPlayers.forEach((entity, pid) => {
          if (removed) return;
          if (!shooterId || shooterId === pid) return;
          const dx = entity.tank.position.x - b.position.x;
          const dy = entity.tank.position.y - b.position.y;
          const dz = entity.tank.position.z - b.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 1.2) {
            if (socket.id === shooterId) {
              socket.emit("player:hit", { targetId: pid, damage: 20 });
            }
            bullets.splice(i, 1);
            const m = bulletMeshes.splice(i, 1)[0];
            if (m) scene.remove(m);
            removed = true;
          }
        });
      }

      // Position my overlays
      myNameSprite.position.set(tank.position.x, tank.position.y + 2.6, tank.position.z);
      myHealthBar.bg.position.set(tank.position.x, tank.position.y + 2.2, tank.position.z);
      myHealthBar.fg.position.copy(myHealthBar.bg.position);
      myNameSprite.quaternion.copy(camera.quaternion);
      myHealthBar.bg.quaternion.copy(camera.quaternion);
      myHealthBar.fg.quaternion.copy(camera.quaternion);
      // Scale my health bar
      const myScale = Math.max(0, Math.min(1, myHealth / 100));
      myHealthBar.fg.scale.set(myScale, 1, 1);
      myHealthBar.fg.position.x = myHealthBar.bg.position.x - (1 - myScale) * 1.0; // anchor left assuming width=2

      // Update bullets TTL, movement and cleanup
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.lifeMs -= dt * 1000;
        // Move bullet
        b.position.x += b.velocity.x * dt;
        b.position.y += b.velocity.y * dt;
        b.position.z += b.velocity.z * dt;
        bulletMeshes[i].position.set(b.position.x, b.position.y, b.position.z);
        const BOUND = GROUND_SIZE / 2 - 2;
        const outOfBounds = Math.abs(b.position.x) > BOUND || b.position.y < -1 || Math.abs(b.position.z) > BOUND;
        if (b.lifeMs <= 0 || outOfBounds) {
          bullets.splice(i, 1);
          const m = bulletMeshes.splice(i, 1)[0];
          if (m) scene.remove(m);
        }
      }

      // Broadcast my state
      socket.emit("player:update", {
        name: username,
        position: { x: tank.position.x, y: tank.position.y, z: tank.position.z },
        rotationY: tank.rotation.y,
        ...(myTextureSrc ? { textureSrc: myTextureSrc } : {}),
      });

      // Position other players' overlays
      otherPlayers.forEach((entity) => {
        entity.nameSprite.position.set(entity.tank.position.x, entity.tank.position.y + 2.6, entity.tank.position.z);
        entity.healthBarBg.position.set(entity.tank.position.x, entity.tank.position.y + 2.2, entity.tank.position.z);
        entity.healthBarFg.position.copy(entity.healthBarBg.position);
        entity.nameSprite.quaternion.copy(camera.quaternion);
        entity.healthBarBg.quaternion.copy(camera.quaternion);
        entity.healthBarFg.quaternion.copy(camera.quaternion);
        const scale = Math.max(0, Math.min(1, entity.health / 100));
        entity.healthBarFg.scale.set(scale, 1, 1);
        entity.healthBarFg.position.x = entity.healthBarBg.position.x - (1 - scale) * 1.0;
      });

      // Chase camera: follow behind tank with smoothing
      const behind = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.rotation.y);
      const desired = new THREE.Vector3().copy(tank.position).add(new THREE.Vector3(behind.x * cameraOffset.z, cameraOffset.y, behind.z * cameraOffset.z));
      // Smooth factor based on dt
      const alpha = 1 - Math.pow(0.001, dt);
      camera.position.lerp(desired, alpha);
      const lookAtTarget = new THREE.Vector3(tank.position.x, tank.position.y + 1, tank.position.z);
      camera.lookAt(lookAtTarget);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }

    // Start loop
    tick();

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", fireBullet);
      socket.disconnect();
      // No physics cleanup needed
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [router]);

  return (
    <div className="w-full h-[calc(100vh-49px)]" ref={mountRef}>
      {!connected && (
        <div className="absolute top-14 left-3 text-xs bg-yellow-100 text-yellow-900 px-2 py-1 rounded">
          Connecting to server...
        </div>
      )}
      <div className="absolute top-14 right-3 text-xs bg-sky-100 text-sky-900 px-2 py-1 rounded">
        Score: {myScore}
      </div>
    </div>
  );
}


