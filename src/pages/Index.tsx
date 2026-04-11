import { useState, useEffect, useCallback, useRef } from "react";
import { ContactList } from "@/components/chat/ContactList";
import { ChatArea } from "@/components/chat/ChatArea";
import { SettingsPanel } from "@/components/chat/SettingsPanel";
import {
  Contact,
  Message,
  fetchContacts,
  fetchMessages,
  markContactRead,
  subscribeToMessages,
  subscribeToContacts,
} from "@/lib/whatsapp";
import { Settings } from "lucide-react";

const Index = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showContactList, setShowContactList] = useState(true);
  const [loading, setLoading] = useState(true);
  const selectedContactRef = useRef<Contact | null>(null);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const loadContacts = useCallback(async () => {
    try {
      const data = await fetchContacts();
      setContacts(data);
    } catch (e) {
      console.error("Error loading contacts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (contactId: string) => {
    try {
      const data = await fetchMessages(contactId);
      setMessages(data);
    } catch (e) {
      console.error("Error loading messages:", e);
    }
  }, []);

  useEffect(() => {
    loadContacts();

    const msgSub = subscribeToMessages((payload: any) => {
      const newMsg = payload.new as Message;
      if (selectedContactRef.current && newMsg.contact_id === selectedContactRef.current.id) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      loadContacts();
    });

    const contactSub = subscribeToContacts(() => {
      loadContacts();
    });

    return () => {
      msgSub.unsubscribe();
      contactSub.unsubscribe();
    };
  }, [loadContacts]);

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setShowContactList(false);
    await loadMessages(contact.id);
    await markContactRead(contact.id);
    loadContacts();
  };

  const handleBack = () => {
    setShowContactList(true);
    setSelectedContact(null);
  };

  if (showSettings) {
    return <SettingsPanel onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-secondary">
      {/* Contact list - visible on desktop always, on mobile when showContactList */}
      <div
        className={`${
          showContactList ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-[380px] lg:w-[420px] md:min-w-[320px] border-r border-border bg-card`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary">
          <h1 className="text-lg font-bold text-primary-foreground">WhatsApp Cloud</h1>
          <button onClick={() => setShowSettings(true)} className="text-primary-foreground/80 hover:text-primary-foreground">
            <Settings size={22} />
          </button>
        </div>
        <ContactList
          contacts={contacts}
          selectedId={selectedContact?.id || null}
          onSelect={handleSelectContact}
          loading={loading}
        />
      </div>

      {/* Chat area */}
      <div
        className={`${
          !showContactList ? "flex" : "hidden"
        } md:flex flex-col flex-1 min-w-0`}
      >
        {selectedContact ? (
          <ChatArea
            contact={selectedContact}
            messages={messages}
            onBack={handleBack}
            onMessageSent={() => {
              loadMessages(selectedContact.id);
              loadContacts();
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center wa-chat-bg">
            <div className="text-center text-muted-foreground">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-medium mb-1">WhatsApp Cloud Chat</h2>
              <p className="text-sm">Select a contact to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
