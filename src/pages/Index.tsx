import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ContactList } from "@/components/chat/ContactList";
import { ChatArea } from "@/components/chat/ChatArea";
import { SettingsPanel } from "@/components/chat/SettingsPanel";
import {
  Contact, Message, fetchContacts, fetchMessages, markContactRead,
  subscribeToMessages, subscribeToContacts,
} from "@/lib/whatsapp";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { Settings, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { ensurePushSubscription, pushSupported } from "@/lib/push";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { current: account, accounts, setCurrentId, loading: accLoading } = useAccount();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showContactList, setShowContactList] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const selectedContactRef = useRef<Contact | null>(null);

  const upsertContact = useCallback((incoming: Contact) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== incoming.id);
      next.unshift(incoming);
      next.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
      return next;
    });
  }, []);

  const mergeRealtimeMessage = useCallback((incoming: Message) => {
    if (!selectedContactRef.current || incoming.contact_id !== selectedContactRef.current.id) return;

    setMessages((prev) => {
      if (incoming.id.startsWith("pending-")) {
        const existingPendingIndex = prev.findIndex((m) => m.id === incoming.id);
        if (existingPendingIndex >= 0) {
          const next = [...prev];
          next[existingPendingIndex] = { ...next[existingPendingIndex], ...incoming };
          return next;
        }

        return [...prev, incoming].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
      }

      const existingIndex = prev.findIndex((m) => m.id === incoming.id || (!!incoming.wa_message_id && m.wa_message_id === incoming.wa_message_id));
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...incoming };
        return next;
      }

      if (incoming.direction === "outgoing") {
        const pendingIndex = prev.findIndex((m) => {
          if (m.status !== "pending" || m.direction !== "outgoing" || m.message_type !== incoming.message_type) return false;
          if ((m.content || "") !== (incoming.content || "")) return false;
          if ((m.media_filename || "") !== (incoming.media_filename || "")) return false;
          return true;
        });
        if (pendingIndex >= 0) {
          const next = [...prev];
          next[pendingIndex] = { ...next[pendingIndex], ...incoming, status: incoming.status || "sent" };
          return next;
        }
      }

      return [...prev, incoming].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    });
  }, []);

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  // Android/mobile hardware back button: when a contact is open, push a history entry
  // so that pressing back closes the chat instead of leaving the app.
  useEffect(() => {
    if (!selectedContact) return;
    if (typeof window === "undefined") return;
    const isNarrow = window.matchMedia("(max-width: 767px)").matches;
    if (!isNarrow) return;

    window.history.pushState({ chatOpen: true }, "");
    const onPop = () => {
      setShowContactList(true);
      setSelectedContact(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [selectedContact]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Auto-prompt push notifications once per session per account
  useEffect(() => {
    if (!user || !account || !pushSupported()) return;
    const key = `wa_push_prompted_${account.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    if (Notification.permission === "default") {
      // Fire on next tick so UI is ready
      setTimeout(() => {
        ensurePushSubscription(account.id, user.id).then((sub) => {
          if (sub) toast.success("Notifications enabled");
        }).catch(() => {});
      }, 800);
    } else if (Notification.permission === "granted") {
      ensurePushSubscription(account.id, user.id).catch(() => {});
    }
  }, [user, account]);

  const loadContacts = useCallback(async () => {
    if (!account) { setContacts([]); setLoading(false); return; }
    try {
      setContacts(await fetchContacts(account.id));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [account]);

  const loadMessages = useCallback(async (contactId: string) => {
    setMessages(await fetchMessages(contactId));
  }, []);

  useEffect(() => {
    if (!account) return;
    setSelectedContact(null);
    setMessages([]);
    setLoading(true);
    loadContacts();

    const msgSub = subscribeToMessages(account.id, (payload: any) => {
      if (payload.eventType === "DELETE") return;

      const nextMessage = (payload.new || payload.old) as Message | undefined;
      if (nextMessage) {
        mergeRealtimeMessage(nextMessage);
      }
      if (payload.eventType === "INSERT" && nextMessage?.direction === "incoming" && document.visibilityState === "visible") {
        toast.info("New message received");
      }
    });
    const contactSub = subscribeToContacts(account.id, (payload: any) => {
      if (payload.eventType === "DELETE") {
        const deletedId = payload.old?.id as string | undefined;
        if (!deletedId) return;
        setContacts((prev) => prev.filter((c) => c.id !== deletedId));
        return;
      }

      const nextContact = payload.new as Contact | undefined;
      if (!nextContact) return;
      upsertContact(nextContact);
      if (selectedContactRef.current?.id === nextContact.id) {
        setSelectedContact(nextContact);
      }
    });
    return () => { msgSub.unsubscribe(); contactSub.unsubscribe(); };
  }, [account, loadContacts, mergeRealtimeMessage, upsertContact]);

  const handleSelectContact = async (c: Contact) => {
    setSelectedContact(c);
    setShowContactList(false);
    await loadMessages(c.id);
    await markContactRead(c.id);
    setContacts((prev) => prev.map((item) => item.id === c.id ? { ...item, unread_count: 0 } : item));
  };

  // Keep selectedContact in sync with latest contacts (for window/unread updates)
  useEffect(() => {
    if (!selectedContact) return;
    const updated = contacts.find((c) => c.id === selectedContact.id);
    if (updated && updated !== selectedContact) setSelectedContact(updated);
  }, [contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || accLoading) {
    return <div className="h-[100dvh] flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (showSettings) return <SettingsPanel onBack={() => setShowSettings(false)} />;

  if (!account) {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2">Welcome!</h2>
          <p className="text-muted-foreground mb-4">Configure your WhatsApp account to start.</p>
          <button onClick={() => setShowSettings(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg">
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  const credsMissing = !account.phone_number_id || !account.access_token;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-secondary">
      <div className={`${showContactList ? "flex" : "hidden"} md:flex flex-col w-full ${selectedContact ? "md:w-[380px] lg:w-[420px] md:min-w-[320px] md:flex-none" : "md:flex-1"} border-r border-border bg-card`}>
        <div className="flex items-center justify-between px-3 py-2.5 bg-[hsl(var(--wa-header))] gap-2">
          <div className="relative flex-1 min-w-0">
            <button onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 text-primary-foreground font-semibold text-sm w-full text-left">
              <span className="truncate">{account.business_name}</span>
              {accounts.length > 1 && <ChevronDown size={16} className="shrink-0" />}
            </button>
            {showMenu && accounts.length > 1 && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[200px]">
                {accounts.map((a) => (
                  <button key={a.id} onClick={() => { setCurrentId(a.id); setShowMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-secondary ${a.id === account.id ? "font-medium text-primary" : ""}`}>
                    {a.business_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <button onClick={() => navigate("/admin")} title="Admin"
              className="text-primary-foreground/80 hover:text-primary-foreground p-1.5 rounded hover:bg-primary-foreground/10">
              <ShieldCheck size={20} />
            </button>
          )}
          <button onClick={() => setShowSettings(true)} title="Settings"
            className="text-primary-foreground/80 hover:text-primary-foreground p-1.5 rounded hover:bg-primary-foreground/10">
            <Settings size={20} />
          </button>
          <button onClick={() => signOut()} title="Sign out"
            className="text-primary-foreground/80 hover:text-primary-foreground p-1.5 rounded hover:bg-primary-foreground/10">
            <LogOut size={20} />
          </button>
        </div>

        {credsMissing && (
          <div className="bg-accent text-accent-foreground text-xs px-3 py-2 border-b border-border">
            ⚠️ Add WhatsApp token & phone ID in <button className="underline font-medium" onClick={() => setShowSettings(true)}>Settings</button> to enable messaging.
          </div>
        )}

        <ContactList
          contacts={contacts}
          selectedId={selectedContact?.id || null}
          onSelect={handleSelectContact}
          loading={loading}
        />
      </div>

      <div className={`${!showContactList ? "flex" : "hidden"} ${selectedContact ? "md:flex" : "md:hidden"} flex-col flex-1 min-w-0`}>
        {selectedContact && (
          <ChatArea
            contact={selectedContact}
            messages={messages}
            onBack={() => {
              const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
              if (isNarrow && window.history.state && (window.history.state as any).chatOpen) {
                window.history.back();
              } else {
                setShowContactList(true);
                setSelectedContact(null);
              }
            }}
            onContactDeleted={(contactId) => {
              setContacts((prev) => prev.filter((item) => item.id !== contactId));
              setMessages([]);
              setSelectedContact(null);
              setShowContactList(true);
            }}
            onMessageSent={(pendingMessage) => {
              mergeRealtimeMessage(pendingMessage);
              setContacts((prev) => prev.map((item) => item.id === selectedContact.id ? {
                ...item,
                last_message_at: pendingMessage.timestamp,
              } : item).sort((a, b) => {
                const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return bTime - aTime;
              }));
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Index;