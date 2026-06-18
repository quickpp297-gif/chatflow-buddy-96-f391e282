import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle, ArrowLeft, Sparkles, ShieldCheck, Zap, Bot } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/app");
    });
  }, [navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created! You can sign in now.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0b141a] text-white grid lg:grid-cols-2 relative overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#00a884]/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[#25d366]/10 blur-[160px]" />
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(#25d366 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      {/* Left brand panel */}
      <div className="hidden lg:flex relative z-10 flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25d366] to-[#00a884] flex items-center justify-center shadow-lg shadow-[#00a884]/30">
            <MessageCircle size={22} className="text-[#0b141a]" />
          </div>
          <span className="font-bold text-xl">FinoXPro</span>
        </Link>
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 mb-5 backdrop-blur">
            <Sparkles size={12} className="text-[#25d366]" /> Built for 2050
          </div>
          <h2 className="text-4xl xl:text-5xl font-black leading-tight">
            Run your <span className="bg-gradient-to-r from-[#25d366] to-[#5be5a8] bg-clip-text text-transparent">WhatsApp business</span> like a spaceship.
          </h2>
          <p className="mt-4 text-white/60 max-w-md">Realtime inbox, visual chatbot flows, AI auto-replies, secure media — all in one beautifully fast workspace.</p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              { i: <Zap size={16} />, t: "Flows" },
              { i: <Bot size={16} />, t: "AI Replies" },
              { i: <ShieldCheck size={16} />, t: "Secure" },
            ].map((b) => (
              <div key={b.t} className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur p-3 flex flex-col items-center text-center gap-1">
                <div className="text-[#25d366]">{b.i}</div>
                <div className="text-xs text-white/70">{b.t}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-white/30">© {new Date().getFullYear()} FinoXPro — WhatsApp Cloud Suite</div>
      </div>

      {/* Right form panel */}
      <div className="relative z-10 flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6">
            <ArrowLeft size={16} /> Back to home
          </Link>

          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25d366] to-[#00a884] flex items-center justify-center">
              <MessageCircle size={22} className="text-[#0b141a]" />
            </div>
            <span className="font-bold text-xl">FinoXPro</span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-7 sm:p-9 shadow-2xl">
            <h1 className="text-2xl sm:text-3xl font-black">
              {mode === "login" ? "Welcome back." : "Create account."}
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {mode === "login" ? "Sign in to your inbox." : "Start in under a minute."}
            </p>

            <form onSubmit={handle} className="space-y-3 mt-7">
              {mode === "signup" && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5 block">Name</label>
                  <input
                    type="text" placeholder="Your name"
                    value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder-white/30 focus:border-[#25d366] focus:outline-none focus:ring-2 focus:ring-[#25d366]/20 transition"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5 block">Email</label>
                <input
                  type="email" placeholder="you@company.com" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder-white/30 focus:border-[#25d366] focus:outline-none focus:ring-2 focus:ring-[#25d366]/20 transition"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5 block">Password</label>
                <input
                  type="password" placeholder="••••••••" required minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder-white/30 focus:border-[#25d366] focus:outline-none focus:ring-2 focus:ring-[#25d366]/20 transition"
                />
              </div>
              <button
                type="submit" disabled={busy}
                className="w-full bg-[#25d366] text-[#0b141a] py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-[#1ebe5a] transition shadow-lg shadow-[#25d366]/30 mt-2"
              >
                {busy ? "Please wait..." : mode === "login" ? "Sign In" : "Create account"}
              </button>
            </form>

            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full text-center text-sm text-white/60 mt-5 hover:text-white transition"
            >
              {mode === "login" ? "No account? " : "Already have an account? "}
              <span className="text-[#25d366] font-medium">
                {mode === "login" ? "Sign up" : "Sign in"}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-white/30 text-center mt-5">
            By continuing you agree to the Terms & Privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}