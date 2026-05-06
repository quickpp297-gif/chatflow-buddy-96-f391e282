import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/");
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
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created! You can sign in now.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/30 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-8 border border-border">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-3">
            <MessageCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold">FinoXPro</h1>
          <p className="text-xs text-muted-foreground">WhatsApp Cloud Suite</p>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Sign in to your dashboard" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handle} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text" placeholder="Your name"
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            />
          )}
          <input
            type="email" placeholder="Email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <input
            type="password" placeholder="Password" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <button
            type="submit" disabled={busy}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium disabled:opacity-50"
          >
            {busy ? "Please wait..." : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground"
        >
          {mode === "login" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}