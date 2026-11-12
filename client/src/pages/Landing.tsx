import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, Droplets, HeartPulse, ShieldCheck, Siren, Activity, Users, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { PillLink } from '../components/site/parts';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { useLanguage } from '../lib/language';
import type { FacilityType, PublicStats } from '../lib/types';

/* ─── 3D Blood Drop Canvas ─────────────────────────────────────────── */

interface Particle { x: number; y: number; vx: number; vy: number; r: number; o: number; life: number; maxLife: number; }

function BloodCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let w = 0, h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', handleMove);

    // Create blood drop path for drawing
    const drawDrop = (cx: number, cy: number, size: number, rotation: number, alpha: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;

      const grad = ctx.createRadialGradient(0, size * 0.1, 0, 0, 0, size);
      grad.addColorStop(0, '#ff4444');
      grad.addColorStop(0.5, '#cc0000');
      grad.addColorStop(1, '#660000');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.6, -size * 0.3, size * 0.7, size * 0.4, 0, size * 0.9);
      ctx.bezierCurveTo(-size * 0.7, size * 0.4, -size * 0.6, -size * 0.3, 0, -size);
      ctx.fill();

      // Shine highlight
      ctx.globalAlpha = alpha * 0.45;
      const shine = ctx.createRadialGradient(-size * 0.18, -size * 0.25, 0, -size * 0.1, -size * 0.1, size * 0.4);
      shine.addColorStop(0, 'rgba(255,255,255,0.8)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(-size * 0.15, -size * 0.2, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Floating blood drops
    const drops: { x: number; y: number; size: number; speed: number; phase: number; rot: number; rotSpeed: number }[] = [];
    for (let i = 0; i < 18; i++) {
      drops.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 12 + Math.random() * 28,
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * 0.5 - 0.25,
        rotSpeed: (Math.random() - 0.5) * 0.008,
      });
    }

    const spawnParticle = (x: number, y: number) => {
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          x, y,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2 - 1,
          r: 1.5 + Math.random() * 2.5,
          o: 0.6 + Math.random() * 0.4,
          life: 0,
          maxLife: 40 + Math.random() * 40,
        });
      }
    };

    let t = 0;
    const loop = () => {
      t++;
      ctx.clearRect(0, 0, w, h);

      // Background veins / capillary network
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 0, 0, 0.06)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const sx = w * (0.1 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        for (let y = 0; y < h; y += 20) {
          ctx.lineTo(sx + Math.sin((y + t) * 0.015 + i) * 30, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Draw floating drops
      for (const d of drops) {
        const dx = (d.x / 100) * w;
        const dy = ((d.y / 100) * h);
        d.y += d.speed;
        d.x += Math.sin(t * 0.02 + d.phase) * 0.08;
        d.rot += d.rotSpeed;
        if (d.y > 105) { d.y = -8; d.x = Math.random() * 100; }

        // Mouse repulsion
        const mx = mouseRef.current.x, my = mouseRef.current.y;
        const dist = Math.hypot(dx - mx, dy - my);
        if (dist < 120) {
          const angle = Math.atan2(dy - my, dx - mx);
          d.x += Math.cos(angle) * (120 - dist) * 0.003;
          d.y += Math.sin(angle) * (120 - dist) * 0.003;
          if (t % 8 === 0) spawnParticle(dx, dy);
        }

        const depth = (d.size - 12) / 28;
        const alpha = 0.2 + depth * 0.5;
        drawDrop(dx, dy, d.size, d.rot, alpha);
      }

      // Particles
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life++;
        const progress = p.life / p.maxLife;
        if (progress >= 1) { ps.splice(i, 1); continue; }
        ctx.globalAlpha = p.o * (1 - progress);
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Heartbeat line at bottom
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 0, 0, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const lineY = h - 60;
      for (let x = 0; x < w; x += 2) {
        const wave = Math.sin((x - t * 2) * 0.02) * 8;
        const pulse = x % 180 < 40 ? Math.sin((x % 180) * 0.16) * 25 : 0;
        if (x === 0) ctx.moveTo(x, lineY + wave + pulse);
        else ctx.lineTo(x, lineY + wave + pulse);
      }
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.removeEventListener('mousemove', handleMove); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />;
}

/* ─── 3D Hero Drop (CSS 3D) ────────────────────────────────────────── */

function Hero3D() {
  const { t } = useLanguage();
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouseX(x); setMouseY(y);
  }, []);

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="hero-3d-section relative overflow-hidden bg-gradient-to-b from-[#0a0000] via-[#1a0000] to-[#2a0505]"
    >
      {/* Animated canvas background */}
      <BloodCanvas />

      {/* Radial glow behind the center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-red-900/20 blur-[120px] animate-pulse" />
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 size-[350px] rounded-full bg-red-600/10 blur-[80px]" />

      {/* 3D content */}
      <div className="relative z-10 flex min-h-[calc(100vh-76px)] flex-col items-center justify-center px-6 py-12" style={{ perspective: '1200px' }}>
        {/* 3D Blood drop icon */}
        <div
          className="blood-drop-3d mb-4"
          style={{
            transform: `rotateY(${mouseX * 15}deg) rotateX(${-mouseY * 15}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.15s ease-out',
          }}
        >
          <div className="relative">
            {/* Drop shadow / glow */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-28 rounded-full bg-red-600/30 blur-[40px]" />
            {/* SVG Blood Drop */}
            <svg viewBox="0 0 120 160" className="relative size-28 sm:size-32 drop-shadow-[0_0_40px_rgba(200,0,0,0.6)]" style={{ filter: 'drop-shadow(0 0 30px rgba(200,0,0,0.5))' }}>
              <defs>
                <radialGradient id="drop3d" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#ff4444" />
                  <stop offset="50%" stopColor="#cc0000" />
                  <stop offset="100%" stopColor="#660000" />
                </radialGradient>
                <radialGradient id="dropShine" cx="35%" cy="30%" r="40%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              <path d="M60 8 C40 50, 10 85, 10 110 C10 140, 32 158, 60 158 C88 158, 110 140, 110 110 C110 85, 80 50, 60 8Z" fill="url(#drop3d)" />
              <ellipse cx="45" cy="80" rx="18" ry="25" fill="url(#dropShine)" />
              {/* Heartbeat inside */}
              <path d="M25 115 L42 115 L48 100 L55 130 L62 95 L68 120 L72 115 L95 115" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Text content with 3D parallax */}
        <div
          className="text-center"
          style={{
            transform: `translateZ(60px) rotateY(${mouseX * 3}deg) rotateX(${-mouseY * 3}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.2s ease-out',
          }}
        >
          <p className="font-script text-2xl text-red-400/80 sm:text-3xl hero-fade-in" style={{ animationDelay: '0.2s' }}>{t('Every drop counts')}</p>
          <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl xl:text-6xl hero-fade-in" style={{ animationDelay: '0.4s' }}>
            {t('Blood help, ')}<span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">{t('without delay.')}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-red-200/80 sm:text-lg hero-fade-in" style={{ animationDelay: '0.6s' }}>
            {t('BloodBridge connects patients\u2019 families, willing donors and verified hospitals, so the right help is reached in minutes instead of hours of phone calls.')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 hero-fade-in" style={{ animationDelay: '0.8s' }}>
            <Link to="/hospitals" className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-red-700 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white shadow-[0_0_30px_rgba(200,0,0,0.4)] transition-all duration-300 hover:shadow-[0_0_50px_rgba(200,0,0,0.6)] hover:scale-105">
              <Droplets className="size-5" />
              {t('Find blood')}
              <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 transition group-hover:opacity-100" />
            </Link>
            <Link to="/sign-up" className="group relative inline-flex items-center gap-2 rounded-full border-2 border-red-500/50 bg-white/5 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white backdrop-blur-sm transition-all duration-300 hover:border-red-400 hover:bg-white/10 hover:scale-105">
              <HeartPulse className="size-5" />
              {t('Donate blood')}
            </Link>
          </div>
        </div>

        {/* Quick nav tabs */}
        <nav className="mt-8 hero-fade-in" style={{ animationDelay: '1s' }}>
          <ul className="flex flex-wrap justify-center gap-2">
            {[
              { to: '/get-blood', label: t('Request blood') },
              { to: '/donate', label: t('Donate blood') },
              { to: '/how-it-works', label: t('How it works') },
              { to: '/for-hospitals', label: t('For hospitals') },
            ].map((tab) => (
              <li key={tab.to}>
                <Link to={tab.to} className="block rounded-full border border-red-800/40 bg-red-950/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300 backdrop-blur-sm transition hover:border-red-600/60 hover:bg-red-900/40 hover:text-white">
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Scroll indicator */}
        <div className="mt-8 hero-fade-in" style={{ animationDelay: '1.2s' }}>
          <div className="flex flex-col items-center gap-1.5 text-red-400/50">
            <span className="text-xs font-bold uppercase tracking-widest">{t('Scroll')}</span>
            <div className="h-8 w-[1.5px] bg-gradient-to-b from-red-500/50 to-transparent animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 3D Feature Cards ─────────────────────────────────────────────── */

function Feature3DCard({ icon: Icon, title, text, to, delay }: { icon: typeof Droplets; title: string; text: string; to: string; delay: number }) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  }, []);

  return (
    <div className="hero-fade-in" style={{ animationDelay: `${delay}s`, perspective: '800px' }}>
      <Link to={to}>
        <div
          ref={cardRef}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setMouse({ x: 0, y: 0 }); }}
          onMouseMove={handleMove}
          className="group relative overflow-hidden rounded-2xl border border-red-900/30 bg-gradient-to-br from-[#1a0505] to-[#0d0000] p-8 shadow-lg transition-all duration-300 hover:shadow-[0_0_40px_rgba(200,0,0,0.15)]"
          style={{
            transform: hovered ? `rotateY(${mouse.x * 10}deg) rotateX(${-mouse.y * 10}deg) translateZ(20px)` : 'none',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.2s ease-out, box-shadow 0.3s',
          }}
        >
          {/* Glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: hovered ? `radial-gradient(circle at ${(mouse.x + 1) * 50}% ${(mouse.y + 1) * 50}%, rgba(200,0,0,0.15), transparent 60%)` : 'none',
            }}
          />

          <div className="relative z-10" style={{ transform: 'translateZ(30px)' }}>
            <div className="mb-5 inline-flex rounded-xl bg-red-900/30 p-3 ring-1 ring-red-800/30">
              <Icon className="size-7 text-red-400" />
            </div>
            <h3 className="text-xl font-extrabold text-white">{t(title)}</h3>
            <p className="mt-3 text-sm leading-relaxed text-red-200/60">{t(text)}</p>
            <span className="mt-5 inline-block text-sm font-extrabold uppercase tracking-wider text-red-500 transition group-hover:text-red-400">{t('Learn more')} →</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ─── How It Works Slides ──────────────────────────────────────────── */

const SLIDES = [
  { script: 'Step one', title: 'Someone needs blood', text: 'A family member posts a request for a patient at a verified hospital: blood group, units and how urgent it is.', icon: Siren },
  { script: 'Step two', title: 'Matching donors are alerted', text: 'We find compatible, eligible, available donors near the hospital and alert them instantly. Their details stay private.', icon: HeartPulse },
  { script: 'Step three', title: 'A code confirms the donation', text: 'The donor shows a 6 digit code at the hospital desk. Staff confirm it, and the donor gets a certificate anyone can verify.', icon: ShieldCheck },
] as const;

function Slides3D() {
  const { t } = useLanguage();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 6500);
    return () => clearInterval(id);
  }, [paused]);

  const s = SLIDES[i]!;
  const go = (d: number) => setI((x) => (x + d + SLIDES.length) % SLIDES.length);
  const Icon = s.icon;

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-b from-[#0d0000] to-[#1a0505] py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={t('How a request works')}
    >
      {/* Background glow */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-red-900/10 blur-[100px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-16 md:grid-cols-2">
        <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-red-800/40 bg-red-950/60 text-red-300 hover:bg-red-900/60 sm:grid">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-red-800/40 bg-red-950/60 text-red-300 hover:bg-red-900/60 sm:grid">
          <ChevronRight className="size-5" />
        </button>

        <div key={i} className="rise-in">
          <p className="font-script text-3xl text-red-400/80 sm:text-4xl">{t(s.script)}</p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white sm:text-4xl">{t(s.title)}</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-red-200/70">{t(s.text)}</p>
          <PillLink to="/how-it-works" tone="red" className="mt-6">{t('See the full flow')}</PillLink>
        </div>

        {/* 3D icon card */}
        <div className="mx-auto" style={{ perspective: '600px' }}>
          <div
            key={i}
            className="rise-in grid size-52 place-items-center rounded-3xl border border-red-800/30 bg-gradient-to-br from-red-950/80 to-[#0d0000] shadow-[0_0_60px_rgba(200,0,0,0.15)] sm:size-64"
            style={{ transformStyle: 'preserve-3d', animation: 'float-3d 4s ease-in-out infinite' }}
          >
            <Icon className="size-20 text-red-500/80" strokeWidth={1.2} />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-2.5">
        {SLIDES.map((_, n) => (
          <button key={n} type="button" onClick={() => setI(n)} aria-label={`${t('Show step')} ${n + 1}`} aria-current={n === i}
            className={clsx('size-3 cursor-pointer rounded-full transition', n === i ? 'bg-red-500 shadow-[0_0_10px_rgba(200,0,0,0.6)]' : 'bg-red-900/50')} />
        ))}
      </div>
    </section>
  );
}

/* ─── Stats Section ────────────────────────────────────────────────── */

function BloodStats({ stats }: { stats: PublicStats | undefined }) {
  const { t } = useLanguage();
  const s = stats;

  const items = useMemo(() => [
    { icon: Users, value: s ? number(s.donors) : '…', label: `${t('donors registered')}${s && s.cities > 0 ? ` ${number(s.cities)} ${t(s.cities === 1 ? 'city' : 'cities')}` : ''}`, note: t('Live on BloodBridge') },
    { icon: Building2, value: s ? number(s.verifiedHospitals) : '…', label: `${t('facilities verified by our review team, out of')} ${s ? number(s.listedFacilities) : '…'} ${t('mapped')}`, note: t('Verified network') },
    { icon: Activity, value: s ? number(s.donations) : '…', label: t('donations confirmed at hospital desks'), note: t('One donation can help up to 3 patients') },
  ], [s, t]);

  return (
    <section className="relative overflow-hidden bg-[#0d0000] py-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,0,0,0.08),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-6 px-5 sm:px-8 md:grid-cols-3">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="group rounded-2xl border border-red-900/30 bg-gradient-to-br from-red-950/40 to-[#0a0000] p-8 text-center transition hover:border-red-800/50 hover:shadow-[0_0_30px_rgba(200,0,0,0.1)]">
              <div className="mx-auto mb-4 inline-flex rounded-full border border-red-800/30 bg-red-950/40 p-3">
                <Icon className="size-6 text-red-400" />
              </div>
              <p className="text-4xl font-black tracking-tight text-white sm:text-5xl">{item.value}</p>
              <p className="mt-2 text-sm font-bold leading-snug text-red-200/70">{item.label}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-red-500/60">{item.note}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Hospital Directory ───────────────────────────────────────────── */

const TYPE_LABEL: Record<FacilityType, string> = { HOSPITAL: 'Hospital', BLOOD_BANK: 'Blood bank' };
interface NetworkItem { id: string; name: string; city: string | null; state: string | null; type: FacilityType; hasEmergency: boolean }

/* ─── Landing Page ─────────────────────────────────────────────────── */

export default function Landing() {
  const { t } = useLanguage();
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: () => api.get<PublicStats>('/public/stats'), staleTime: 60_000 });
  const net = useQuery({ queryKey: ['public-network'], queryFn: () => api.get<{ items: NetworkItem[] }>('/public/network'), staleTime: 60_000 });

  return (
    <>
      {/* 3D Hero */}
      <Hero3D />

      {/* Feature cards */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2a0505] to-[#0d0000] py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <p className="font-script text-3xl text-red-400/80">{t('What we do')}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t('Three paths, one mission')}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Feature3DCard icon={HeartPulse} title="Become a Donor" text="Check your eligibility, set your location and get alerted when a patient near you needs your group." to="/donate" delay={0.2} />
            <Feature3DCard icon={Droplets} title="Find Blood" text="Search real hospitals and blood banks near you, then send a request to a verified one." to="/get-blood" delay={0.4} />
            <Feature3DCard icon={Building2} title="For Hospitals" text="Claim your facility, get verified and receive requests with donors on the way." to="/for-hospitals" delay={0.6} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <Slides3D />

      {/* Stats */}
      <BloodStats stats={stats.data} />

      {/* Hospitals / network section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0d0000] to-[#1a0505] py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mb-10 text-center">
            <p className="font-script text-3xl text-red-400/80">{t('Latest from the network')}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t('Newly verified hospitals')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-red-200/60">{t('Facilities that completed our document review and can now receive blood requests.')}</p>
          </div>

          {net.data && net.data.items.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {net.data.items.map((h) => (
                <article key={h.id} className="group flex overflow-hidden rounded-2xl border border-red-900/30 bg-gradient-to-r from-red-950/40 to-[#0a0000] shadow-lg transition hover:border-red-800/40 hover:shadow-[0_0_30px_rgba(200,0,0,0.1)]">
                  <div className="grid w-28 shrink-0 place-items-center bg-gradient-to-br from-red-900/60 to-red-950/80 text-red-400 sm:w-44">
                    <Building2 className="size-12" strokeWidth={1.4} />
                  </div>
                  <div className="min-w-0 p-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-500">{t(TYPE_LABEL[h.type])}{h.hasEmergency ? ` · ${t('Emergency care')}` : ''}</p>
                    <h3 className="mt-1 truncate text-xl font-extrabold text-white">{h.name}</h3>
                    <p className="mt-1 text-sm text-red-200/60">{[h.city, h.state].filter(Boolean).join(', ') || t('Location on file')}</p>
                    <Link to={`/hospitals/${h.id}`} className="mt-4 inline-block rounded-full bg-red-600 px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(200,0,0,0.3)] hover:bg-red-700">{t('View hospital')}</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-red-900/40 bg-red-950/20 p-10 text-center">
              <p className="text-lg font-bold text-white">{t('No hospital is verified yet.')}</p>
              <p className="mt-2 text-red-200/60">{t('Be the first in your city. Claim your listing, submit your licence and start receiving requests.')}</p>
              <Link to="/for-hospitals" className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(200,0,0,0.3)] hover:bg-red-700">
                {t('Register your hospital')}
              </Link>
            </div>
          )}

          <div className="mt-10 flex justify-center">
            <Link to="/hospitals" className="inline-flex w-full max-w-xl items-center justify-center gap-2 rounded-full border border-red-800/40 bg-red-950/40 px-6 py-4 text-sm font-extrabold uppercase tracking-wider text-red-300 transition hover:border-red-600/60 hover:bg-red-900/40 hover:text-white">
              <Zap className="size-5" />
              {t('Search all hospitals and blood banks')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
