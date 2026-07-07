import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  available: boolean;
  department?: string;
  designation?: string;
  is_active: boolean;
}

// Priority mapping for roles (lower number = higher priority)
const ROLE_PRIORITY: Record<string, number> = {
  'Principal': 1,
  'Registrar': 2,
  'HOD': 3,
  'Program Department Head': 4,
  'Employee': 5,
  'Security Head': 6,
  'Medical Officer': 7,
};

// ─── Cache helpers ─────────────────────────────────────────────────────────────
const CACHE_KEY = 'emergency-contacts-cache';

function readEmergencyCache(): EmergencyContact[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmergencyContact[];
  } catch {
    return [];
  }
}

function writeEmergencyCache(contacts: EmergencyContact[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(contacts));
  } catch {
    // Ignore quota errors — the data will still be fetched live
  }
}
// ───────────────────────────────────────────────────────────────────────────────

function sortByPriority(contacts: EmergencyContact[]): EmergencyContact[] {
  return [...contacts].sort((a, b) => {
    const priorityA = ROLE_PRIORITY[a.role] ?? 999;
    const priorityB = ROLE_PRIORITY[b.role] ?? 999;
    return priorityA - priorityB;
  });
}

export const useEmergencyContacts = () => {
  // ── Initialise from cache so the very first render already has data ──────────
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => readEmergencyCache());
  const [loading, setLoading] = useState<boolean>(() => readEmergencyCache().length === 0);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    // Only show the spinner when there is truly nothing cached to display
    if (contacts.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, phone, department, designation, is_active')
        .eq('is_active', true);

      if (fetchError) {
        console.error('Error fetching emergency contacts from role_recipients:', fetchError);
        setError(fetchError.message);
        return;
      }

      const transformedContacts: EmergencyContact[] = sortByPriority(
        (data || []).map(recipient => ({
          id: recipient.id,
          name: recipient.name,
          role: recipient.role,
          phone: recipient.phone || 'N/A',
          email: recipient.email,
          available: true,
          department: recipient.department,
          designation: recipient.designation,
          is_active: recipient.is_active,
        }))
      );

      setContacts(transformedContacts);
      writeEmergencyCache(transformedContacts);
    } catch (err) {
      console.error('Unexpected error fetching emergency contacts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('role-recipients-emergency-contacts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'role_recipients',
            filter: 'is_active=eq.true'
          },
          (payload) => {
            console.log('Emergency contacts (role_recipients) real-time update:', payload);

            if (payload.eventType === 'INSERT') {
              const newRecipient = payload.new as any;
              const newContact: EmergencyContact = {
                id: newRecipient.id,
                name: newRecipient.name,
                role: newRecipient.role,
                phone: newRecipient.phone || 'N/A',
                email: newRecipient.email,
                available: true,
                department: newRecipient.department,
                designation: newRecipient.designation,
                is_active: newRecipient.is_active,
              };

              setContacts((prev) => {
                if (prev.some(c => c.id === newContact.id)) return prev;
                const updated = sortByPriority([...prev, newContact]);
                writeEmergencyCache(updated);
                return updated;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedRecipient = payload.new as any;
              const updatedContact: EmergencyContact = {
                id: updatedRecipient.id,
                name: updatedRecipient.name,
                role: updatedRecipient.role,
                phone: updatedRecipient.phone || 'N/A',
                email: updatedRecipient.email,
                available: true,
                department: updatedRecipient.department,
                designation: updatedRecipient.designation,
                is_active: updatedRecipient.is_active,
              };

              setContacts((prev) => {
                const updated = sortByPriority(
                  prev.map((contact) =>
                    contact.id === updatedContact.id ? updatedContact : contact
                  )
                );
                writeEmergencyCache(updated);
                return updated;
              });
            } else if (payload.eventType === 'DELETE') {
              setContacts((prev) => {
                const updated = prev.filter((contact) => contact.id !== payload.old.id);
                writeEmergencyCache(updated);
                return updated;
              });
            }
          }
        )
        .subscribe((status) => {
          console.log('Emergency contacts subscription status:', status);
          if (status === 'CHANNEL_ERROR') {
            console.warn('[EmergencyContacts] Channel error, refetching...');
            setTimeout(() => fetchContacts(), 2000);
          }
        });
    };

    fetchContacts();
    setupRealtimeSubscription();

    const handleFocus = () => fetchContacts();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchContacts]);

  return { contacts, loading, error };
};
