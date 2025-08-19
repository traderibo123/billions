// pages/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

type Screen = "intro" | "play" | "gameover";

const GOOD = ["HUMAN", "AI", "DISCORD", "REFERRAL", "ZK"] as const;
const BAD = ["FAKE", "SYBIL"] as const;

type Good = (typeof GOOD)[number];
type Bad = (typeof BAD)[number];

type Drop = { id: number; x: number; y: number; vy: number; type: Good | Bad; good: boolean };
type Floaty = { id: number; x: number; y: number; text: string; life: number };
type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number };

const COLORS: Record<Good | Bad, string> = {
  HUMAN: "from-emerald-400 to-emerald-600",
  AI: "from-sky-400 to-sky-600",
  DISCORD: "from-indigo-400 to-indigo-600",
  REFERRAL: "from-amber-400 to-amber-600",
  ZK: "from-fuchsia-400 to-fuchsia-600",
  FAKE: "from-rose-400 to-rose-600",
  SYBIL: "from-red-500 to-red-700",
};
const LABELS: Record<Good | Bad, string> = {
  HUMAN: "Human",
  AI: "AI Agent",
  DISCORD: "Discord",
  REFERRAL: "Referral",
  ZK: "ZK Proof",
  FAKE: "Fake",
  SYBIL: "Sybil",
};
const ICONS: Record<Good | Bad, string> = {
  HUMAN: "🧑‍🚀",
  AI: "🤖",
  DISCORD: "💬",
  REFERRAL: "🔗",
  ZK: "🛡️",
  FAKE: "⚠️",
  SYBIL: "🕵️",
};

const KEY_LEFT = new Set(["ArrowLeft", "a", "A"]);
const KEY_RIGHT = new Set(["ArrowRight", "d", "D"]);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sanitizeHandle = (v: string) => v.trim().replace(/^@+/, "");

export default function Home() {
  // Screens & core state
  const [screen, setScreen] = useState<Screen>("intro");
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [power, setPower] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState<number>(() =>
    typeof window === "undefined" ? 0 : parseInt(localStorage.getItem("billions_best") || "0")
  );
  const [x, setX] = useState(0.5);
  const [combo, setCombo] = useState(0);

  // Refs for stable RAF loop
  const timeRef = useRef(60);
  const powerRef = useRef(0);
  const livesRef = useRef(3);
  const xRef = useRef(0.5);
  const comboRef = useRef(0);
  useEffect(() => void (timeRef.current = timeLeft), [timeLeft]);
  useEffect(() => void (powerRef.current = power), [power]);
  useEffect(() => void (livesRef.current = lives), [lives]);
  useEffect(() => void (xRef.current = x), [x]);
  useEffect(() => void (comboRef.current = combo), [combo]);

  // Avatar composer
  const [handle, setHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [glassesUrl] = useState("/billions-glasses.png"); // sabit asset
  const [composedUrl, setComposedUrl] = useState("");
  const [scale, setScale] = useState(1.0);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [rotate, setRotate] = useState(0);

  // Game objects
  const dropsRef = useRef<Drop[]>([]);
  const floatiesRef = useRef<Floaty[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keys = useRef({ L: false, R: false });
  const last = useRef<number | null>(null);

  const reset = () => {
    setTimeLeft(60);
    setPower(0);
    setLives(3);
    setCombo(0);
    timeRef.current = 60;
    powerRef.current = 0;
    livesRef.current = 3;
    comboRef.current = 0;
    xRef.current = 0.5;
    setX(0.5);
    dropsRef.current = [];
    floatiesRef.current = [];
    particlesRef.current = [];
  };

  const fetchAvatar = async () => {
    const h = sanitizeHandle(handle);
    if (!h) {
      alert("Kullanıcı adını @ olmadan gir.");
      return;
    }
    const url = `/api/avatar?handle=${encodeURIComponent(h)}`;
    setAvatarUrl(url);
    await composeAvatar(url, glassesUrl);
  };
  const onLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAvatarUrl(url);
    composeAvatar(url, glassesUrl);
  };

  const composeAvatar = async (src?: string, gsrc?: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src || avatarUrl;
    await new Promise((ok, err) => {
      img.onload = ok;
      img.onerror = err;
    });

    const size = 256;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);

    // circle mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    ctx.restore();

    // ring
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();

    // glasses overlay (or fallback vector)
    const g = new Image();
    g.crossOrigin = "anonymous";
    g.src = gsrc || glassesUrl;
    try {
      await new Promise((ok, err) => {
        g.onload = ok;
        g.onerror = err;
      });
      ctx.save();
      ctx.translate(size / 2 + offX, size * 0.48 + offY);
      ctx.rotate((rotate * Math.PI) / 180);
      const targetW = 170 * scale;
      const targetH = 100 * scale;
      ctx.drawImage(g, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();
    } catch {
      ctx.save();
      ctx.translate(size / 2 + offX, size * 0.48 + offY);
      ctx.rotate((rotate * Math.PI) / 180);
      const w = 180 * scale;
      const h = 95 * scale;
      const r = 40 * scale;
      ctx.fillStyle = "#0ea5e9";
      roundRect(ctx, -w / 2, -h / 2, w, h, r);
      ctx.fill();
      ctx.fillStyle = "#fff";
      const ew = 44 * scale,
        eh = 70 * scale,
        gap = 36 * scale;
      roundRect(ctx, -ew - gap / 2, -eh / 2, ew, eh, 16 * scale);
      ctx.fill();
      roundRect(ctx, gap / 2, -eh / 2, ew, eh, 16 * scale);
      ctx.fill();
      ctx.restore();
    }

    setComposedUrl(c.toDataURL("image/png"));
  };

  useEffect(() => {
    if (avatarUrl) composeAvatar(undefined, glassesUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, offX, offY, rotate]);

  // helpers for FX (floaty text & particles)
  const addFloaty = (text: string, x: number, y: number) => {
    floatiesRef.current.push({
      id: Date.now() + Math.random(),
      text,
      x,
      y,
      life: 1.1,
    });
  };
  const burst = (x: number, y: number, _t: Good | Bad) => {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 1.4;
      particlesRef.current.push({
        id: Date.now() + Math.random(),
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.5,
      });
    }
  };

  // Game loop (stable: depends only on `running`)
  useEffect(() => {
    if (!running) return;

    const kd = (e: KeyboardEvent) => {
      if (KEY_LEFT.has(e.key)) keys.current.L = true;
      if (KEY_RIGHT.has(e.key)) keys.current.R = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (KEY_LEFT.has(e.key)) keys.current.L = false;
      if (KEY_RIGHT.has(e.key)) keys.current.R = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let spawnAcc = 0;

    const step = (t: number) => {
      if (!running) return;
      if (last.current == null) last.current = t;
      const dt = Math.min(0.05, (t - last.current) / 1000);
      last.current = t;

      // time
      timeRef.current = timeRef.current > 0 ? Math.max(0, timeRef.current - dt) : 0;
      setTimeLeft(timeRef.current);

      // movement
      const speed = 1.3;
      let nx = xRef.current;
      const dir = (keys.current.R ? 1 : 0) - (keys.current.L ? 1 : 0);
      nx = clamp01(nx + dir * speed * dt);
      xRef.current = nx;
      setX(nx);

      // spawn
      spawnAcc += dt;
      const spawnEvery = Math.max(0.4, 1.1 - (60 - Math.max(0, timeRef.current)) * 0.018);
      if (spawnAcc >= spawnEvery) {
        spawnAcc = 0;
        const good = Math.random() > 0.28;
        const type = (good
          ? GOOD[Math.floor(Math.random() * GOOD.length)]
          : BAD[Math.floor(Math.random() * BAD.length)]) as Good | Bad;
        dropsRef.current.push({
          id: Date.now() + Math.random(),
          x: Math.random(),
          y: -0.1,
          vy: 0.3 + Math.random() * 0.3,
          type,
          good,
        });
      }

      // update drops
      dropsRef.current.forEach((d) => (d.y += d.vy * dt));

      // particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.5 * dt;
        p.life -= dt;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // floaties
      floatiesRef.current.forEach((f) => {
        f.y -= 0.25 * dt;
        f.life -= dt;
      });
      floatiesRef.current = floatiesRef.current.filter((f) => f.life > 0);

      // collisions
      const PY = 0.88;
      const caught: number[] = [];
      for (const d of dropsRef.current) {
        if (Math.abs(d.y - PY) < 0.04 && Math.abs(d.x - nx) < 0.08) {
          caught.push(d.id);
          if (d.good) {
            const mult = 1 + Math.floor(comboRef.current / 5);
            const gain = 5 * mult;
            powerRef.current += gain;
            setPower(powerRef.current);
            comboRef.current += 1;
            setCombo(comboRef.current);
            addFloaty(`+${gain} POWER ×${mult}`, d.x, PY);
            burst(d.x, PY, d.type);
          } else {
            livesRef.current = Math.max(0, livesRef.current - 1);
            setLives(livesRef.current);
            comboRef.current = 0;
            setCombo(0);
            addFloaty("-life", d.x, PY);
            burst(d.x, PY, d.type);
          }
        }
      }
      if (caught.length) dropsRef.current = dropsRef.current.filter((d) => !caught.includes(d.id));
      dropsRef.current = dropsRef.current.filter((d) => d.y < 1.12);

      // end
      if (timeRef.current <= 0 || livesRef.current <= 0) {
        setRunning(false);
        last.current = null;
        setBest((b) => {
          const n = Math.max(b, powerRef.current);
          localStorage?.setItem("billions_best", String(n));
          return n;
        });
        setScreen("gameover");
        return;
      }

      requestAnimationFrame(step);
    };

    const raf = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [running]);

  const startGame = () => {
    reset();
    setScreen("play");
    setRunning(true);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  // UI helpers
  const Logo = useMemo(
    () => () => (
      <div className="shrink-0 relative">
        <img src="/billions-glasses.png" alt="Billions" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
      </div>
    ),
    []
  );

  const shareOnX = () => {
    const text = encodeURIComponent(`I scored ${powerRef.current} POWER in Billions Neon! @billions_ntwk @traderibo123`);
    const url = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  // Render
  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl relative">
        {/* Background */}
        <div className="absolute -z-10 inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,#0ea5e9_0,transparent_35%),radial-gradient(circle_at_80%_20%,#7c3aed_0,transparent_40%),radial-gradient(circle_at_50%_80%,#22c55e_0,transparent_35%)] opacity-30" />
          <div className="absolute inset-0 animate-slowfloat bg-[radial-gradient(1200px_600px_at_20%_-10%,#0ea5e955_0,transparent_60%)]" />
          <div className="absolute inset-0 animate-slowfloat2 bg-[radial-gradient(1000px_500px_at_120%_120%,#7c3aed55_0,transparent_60%)]" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.45) 100%)" }} />
          <div
            className="absolute inset-0 pointer-events-none opacity-[.05]"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.6) 0, rgba(255,255,255,.6) 1px, transparent 1px, transparent 3px)" }}
          />
        </div>

        {/* Header */}
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Billions Neon — Avatar Game</h1>
              <p className="text-xs md:tex
