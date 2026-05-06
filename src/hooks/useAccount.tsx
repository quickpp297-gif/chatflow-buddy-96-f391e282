import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface WaAccount {
  id: string;
  user_id: string;
  business_name: string;
  phone_number_id: string | null;
  access_token: string | null;
  verify_token: string;
  display_phone: string | null;
  welcome_enabled: boolean | null;
  welcome_message: string | null;
  welcome_image_url: string | null;
  away_enabled: boolean | null;
  away_message: string | null;
  is_active: boolean | null;
}

interface AccountCtx {
  accounts: WaAccount[];
  current: WaAccount | null;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<AccountCtx>({
  accounts: [], current: null, setCurrentId: () => {}, refresh: async () => {}, loading: true,
});

const KEY = "wa_current_account_id";

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(localStorage.getItem(KEY));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("wa_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setAccounts(data || []);
    if (data && data.length > 0) {
      const stored = localStorage.getItem(KEY);
      if (!stored || !data.find((a) => a.id === stored)) {
        setCurrentIdState(data[0].id);
        localStorage.setItem(KEY, data[0].id);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    localStorage.setItem(KEY, id);
  };

  const current = accounts.find((a) => a.id === currentId) || accounts[0] || null;

  return (
    <Ctx.Provider value={{ accounts, current, setCurrentId, refresh, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAccount = () => useContext(Ctx);