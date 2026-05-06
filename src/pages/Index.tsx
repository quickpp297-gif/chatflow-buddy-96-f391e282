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

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

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
      const newMsg = payload.new as Message;
      if (selectedContactRef.current && newMsg?.contact_id === selectedContactRef.current.id) {
        setMessages((prev) => prev.find((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      }
      loadContacts();
    });
    const contactSub = subscribeToContacts(account.id, () => loadContacts());
    return () => { msgSub.unsubscribe(); contactSub.unsubscribe(); };
  }, [account, loadContacts]);

  const handleSelectContact = async (c: Contact) => {
    setSelectedContact(c);
    setShowContactList(false);
    await loadMessages(c.id);
    await markContactRead(c.id);
    loadContacts();
  };

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
      <div className={`${showContactList ? "flex" : "hidden"} md:flex flex-col w-full md:w-[380px] lg:w-[420px] md:min-w-[320px] border-r border-border bg-card`}>
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

      <div className={`${!showContactList ? "flex" : "hidden"} md:flex flex-col flex-1 min-w-0`}>
        {selectedContact ? (
          <ChatArea
            contact={selectedContact}
            messages={messages}
            onBack={() => { setShowContactList(true); setSelectedContact(null); }}
            onMessageSent={() => { loadMessages(selectedContact.id); loadContacts(); }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center wa-chat-bg">
            <div className="text-center text-muted-foreground p-6">
              <div className="text-7xl mb-4">💬</div>
              <h2 className="text-xl font-medium mb-1">{account.business_name}</h2>
              <p className="text-sm">Select a contact to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;