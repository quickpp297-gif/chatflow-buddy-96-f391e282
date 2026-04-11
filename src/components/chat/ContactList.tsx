import { useState, useMemo } from "react";
import { Contact } from "@/lib/whatsapp";
import { Search, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ContactListProps {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (contact: Contact) => void;
  loading: boolean;
}

export function ContactList({ contacts, selectedId, onSelect, loading }: ContactListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone_number.includes(q)
    );
  }, [contacts, search]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare size={40} className="mb-2 opacity-40" />
            <p className="text-sm">No contacts yet</p>
            <p className="text-xs mt-1">Messages will appear here</p>
          </div>
        ) : (
          filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => onSelect(contact)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/80 transition-colors border-b border-border ${
                selectedId === contact.id ? "bg-accent" : ""
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {(contact.name || contact.phone_number).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">
                    {contact.name || contact.phone_number}
                  </span>
                  {contact.last_message_at && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">
                    {contact.phone_number}
                  </span>
                  {(contact.unread_count || 0) > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-2">
                      {contact.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
