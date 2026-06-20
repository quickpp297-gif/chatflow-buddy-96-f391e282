import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageCircle, Zap, Bot, ShieldCheck, Sparkles, ArrowRight,
  Globe, Workflow, Send, Image as ImageIcon, BarChart3, CheckCircle2,
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // optional auto-redirect for logged-in users opening root
    // keep landing visible — they can click "Open Dashboard"
  }, [user, loading, navigate]);

  return (
    <div className="min-h-[100dvh] bg-[#0b141a] text-white overflow-x-hidden relative">
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#00a884]/20 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-[#25d366]/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-[#00a884]/10 blur-[160px]" />
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(#25d366 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      {/* Nav */}
      <header className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25d366] to-[#00a884] flex items-center justify-center shadow-lg shadow-[#00a884]/30">
            <MessageCircle size={20} className="text-[#0b141a]" />
          </div>
          <span className="font-bold text-lg tracking-tight">ZentAI</span>
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-[#25d366] bg-[#25d366]/10 px-2 py-0.5 rounded-full ml-2 border border-[#25d366]/20">Cloud 2050</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#flows" className="hover:text-white transition">Flows</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <button onClick={() => navigate("/app")}
              className="px-4 py-2 rounded-xl bg-[#25d366] text-[#0b141a] font-semibold text-sm hover:bg-[#1ebe5a] transition shadow-lg shadow-[#25d366]/30">
              Open Dashboard
            </button>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:block px-4 py-2 text-sm text-white/80 hover:text-white">Sign in</Link>
              <Link to="/auth" className="px-4 py-2 rounded-xl bg-[#25d366] text-[#0b141a] font-semibold text-sm hover:bg-[#1ebe5a] transition shadow-lg shadow-[#25d366]/30">
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-14 sm:pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 mb-6 backdrop-blur">
          <Sparkles size={12} className="text-[#25d366]" />
          The future of WhatsApp business — built for 2050
        </div>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] max-w-5xl mx-auto">
          One inbox. <span className="bg-gradient-to-r from-[#25d366] to-[#5be5a8] bg-clip-text text-transparent">Infinite automation.</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
          Reply, broadcast, automate — power your entire WhatsApp business with visual flows, AI auto-replies, and a beautifully real-time inbox.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/auth"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-[#25d366] text-[#0b141a] font-bold hover:bg-[#1ebe5a] transition shadow-2xl shadow-[#25d366]/40">
            Start Free <ArrowRight size={18} className="group-hover:translate-x-1 transition" />
          </Link>
          <a href="#features"
            className="px-7 py-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/10 transition font-medium">
            See features
          </a>
        </div>

        {/* Hero device mock */}
        <div className="mt-16 relative max-w-4xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#25d366]/20 to-[#00a884]/20 blur-3xl rounded-full" />
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#111b21] to-[#0b141a] p-2 shadow-2xl">
            <div className="rounded-2xl overflow-hidden bg-[#0b141a]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                <div className="ml-3 text-xs text-white/40">app.finoxpro.com / inbox</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
                <div className="border-r border-white/5 p-3 space-y-2">
                  {["Aisha Khan", "Vikram", "Support", "Lead #2104"].map((n, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${i === 0 ? "bg-white/5" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center text-xs font-bold text-[#0b141a]">{n[0]}</div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-medium truncate">{n}</div>
                        <div className="text-[10px] text-white/40 truncate">Typing…</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sm:col-span-2 p-4 space-y-2 min-h-[280px]">
                  <div className="flex">
                    <div className="bg-white/5 px-3 py-2 rounded-2xl rounded-tl-sm text-xs max-w-[70%]">Hi! Do you ship to Mumbai?</div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] px-3 py-2 rounded-2xl rounded-tr-sm text-xs max-w-[70%]">Yes — 24h delivery. Want the COD link?</div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b]/60 px-3 py-2 rounded-2xl rounded-tr-sm text-xs max-w-[70%] flex items-center gap-2"><Bot size={12} /> Auto-flow triggered</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[["99.9%","Uptime"],["<200ms","Realtime"],["10k+","Msgs/day"],["256-bit","Encrypted"]].map(([n, l]) => (
            <div key={l} className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur px-3 py-3">
              <div className="text-[#25d366] font-bold">{n}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <div className="text-center mb-14">
          <div className="text-xs uppercase tracking-widest text-[#25d366] mb-3">Everything inside</div>
          <h2 className="text-3xl sm:text-5xl font-black">Built for teams that move fast.</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { i: <MessageCircle size={22} />, t: "Realtime Inbox", d: "Multi-account, threaded chats with read receipts and typing indicators." },
            { i: <Workflow size={22} />, t: "Visual Flows", d: "Drag-drop chatbot builder: triggers, conditions, delays, actions." },
            { i: <Bot size={22} />, t: "AI Auto-Replies", d: "Welcome, away, keyword triggers — fully customizable per account." },
            { i: <Send size={22} />, t: "Broadcast & Templates", d: "Send approved templates to thousands with delivery tracking." },
            { i: <ImageIcon size={22} />, t: "Media Everywhere", d: "Images, voice, video, docs — uploaded to your own /uploads server." },
            { i: <ShieldCheck size={22} />, t: "Vault-grade Security", d: "Per-account RLS, password-locked credentials, HIBP enforcement." },
            { i: <Globe size={22} />, t: "Meta Cloud API", d: "Official WhatsApp Cloud API integration with webhook fan-out." },
            { i: <BarChart3 size={22} />, t: "Live Analytics", d: "Volume, response time, flow conversions — at a glance." },
            { i: <Zap size={22} />, t: "Push Notifications", d: "Browser + mobile push, even when the tab is closed." },
          ].map((f) => (
            <div key={f.t} className="group rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur p-5 transition hover:-translate-y-0.5">
              <div className="w-11 h-11 rounded-xl bg-[#25d366]/10 text-[#25d366] flex items-center justify-center mb-4 group-hover:bg-[#25d366]/20 transition">
                {f.i}
              </div>
              <h3 className="font-semibold mb-1">{f.t}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flows callout */}
      <section id="flows" className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f1f1a] via-[#0b141a] to-[#0b141a] p-8 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-[#25d366]/10 blur-3xl" />
          <div className="grid lg:grid-cols-2 gap-10 items-center relative">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#25d366] mb-3">New · Visual Flows</div>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight">Automate every conversation. <span className="text-[#25d366]">Without code.</span></h2>
              <p className="mt-5 text-white/70">Drag-drop trigger → message → condition → action. Plus linear sequences and native Meta Flows JSON for forms inside WhatsApp.</p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Visual node-based chatbot builder","Linear step sequences","Meta WhatsApp Flows (forms)","Keyword + new-contact + any-message triggers"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#25d366]" /> {t}</li>
                ))}
              </ul>
              <Link to="/auth" className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#25d366] text-[#0b141a] font-bold hover:bg-[#1ebe5a] transition">
                Build your first flow <ArrowRight size={16} />
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b141a]/60 backdrop-blur p-5">
              <div className="space-y-3">
                {[
                  { icon: <Zap size={14} />, label: "Trigger", sub: 'Keyword "price"', color: "bg-[#25d366]/20 text-[#25d366]" },
                  { icon: <MessageCircle size={14} />, label: "Send Message", sub: '"Our pricing starts at ₹999/mo"', color: "bg-blue-500/20 text-blue-300" },
                  { icon: <Workflow size={14} />, label: "Condition", sub: "User replied YES?", color: "bg-yellow-500/20 text-yellow-300" },
                  { icon: <Send size={14} />, label: "Send Template", sub: "checkout_link", color: "bg-purple-500/20 text-purple-300" },
                ].map((n, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${n.color}`}>{n.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{n.label}</div>
                      <div className="text-[11px] text-white/50 truncate">{n.sub}</div>
                    </div>
                    <div className="text-white/30 text-xs">↓</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
        <h2 className="text-3xl sm:text-5xl font-black">Simple. Honest. Free to start.</h2>
        <p className="mt-4 text-white/60">Bring your own Meta WhatsApp Cloud API. No per-message markup.</p>
        <div className="mt-10 inline-flex flex-col p-8 rounded-3xl border border-[#25d366]/30 bg-gradient-to-br from-[#0f1f1a] to-[#0b141a] text-left max-w-sm w-full">
          <div className="text-xs uppercase tracking-widest text-[#25d366]">Starter</div>
          <div className="mt-2 text-5xl font-black">Free</div>
          <div className="text-xs text-white/40">forever — for solo creators</div>
          <ul className="mt-5 space-y-2 text-sm text-white/80">
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[#25d366] shrink-0" /> 1 WhatsApp account</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[#25d366] shrink-0" /> Unlimited flows</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[#25d366] shrink-0" /> Realtime inbox</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[#25d366] shrink-0" /> Media uploads</li>
          </ul>
          <Link to="/auth" className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#25d366] text-[#0b141a] font-bold hover:bg-[#1ebe5a] transition">
            Create account
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 mt-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <div>© {new Date().getFullYear()} ZentAI · WhatsApp Cloud Suite</div>
          <div className="flex gap-5">
            <Link to="/auth" className="hover:text-white">Sign in</Link>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}