import { supabase } from '@/lib/supabase';

export interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  branch?: string;
  designation?: string;
  is_active: boolean;
  supabase_uid?: string;
}

class RecipientService {
  // In-memory cache
  private cache: Map<string, Recipient> = new Map();
  private allRecipientsCached: Recipient[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL;
  }

  private updateCache(recipients: Recipient[]): void {
    this.allRecipientsCached = recipients;
    this.cacheTimestamp = Date.now();
    for (const r of recipients) {
      this.cache.set(r.id, r);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.allRecipientsCached = null;
    this.cacheTimestamp = 0;
  }

  async fetchRecipients(): Promise<Recipient[]> {
    // Return cache if valid
    if (this.allRecipientsCached && this.isCacheValid()) {
      return this.allRecipientsCached;
    }

    try {
      console.log('[RecipientService] Fetching recipients from Supabase role_recipients...');

      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, is_active, supabase_uid')
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('[RecipientService] Supabase error:', error.message);
        throw error;
      }

      const recipients = (data as Recipient[]) ?? [];
      this.updateCache(recipients);
      console.log(`[RecipientService] Fetched ${recipients.length} recipients`);
      return recipients;
    } catch (error) {
      console.error('[RecipientService] Failed to fetch recipients:', error);
      throw new Error('Failed to fetch recipients from database');
    }
  }

  async getRecipientById(id: string): Promise<Recipient | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    try {
      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, is_active, supabase_uid')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        this.cache.set(data.id, data as Recipient);
      }
      return (data as Recipient) ?? null;
    } catch (error) {
      console.error(`[RecipientService] Failed to get recipient by ID ${id}:`, error);
      return null;
    }
  }

  async getRecipientByEmail(email: string): Promise<Recipient | null> {
    // Check cache first
    for (const r of this.cache.values()) {
      if (r.email === email) return r;
    }

    try {
      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, is_active, supabase_uid')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        this.cache.set(data.id, data as Recipient);
      }
      return (data as Recipient) ?? null;
    } catch (error) {
      console.error(`[RecipientService] Failed to get recipient by email ${email}:`, error);
      return null;
    }
  }

  async getRecipientBySupabaseUid(uid: string): Promise<Recipient | null> {
    try {
      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, is_active, supabase_uid')
        .eq('supabase_uid', uid)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        this.cache.set(data.id, data as Recipient);
      }
      return (data as Recipient) ?? null;
    } catch (error) {
      console.error(`[RecipientService] Failed to get recipient by supabase_uid ${uid}:`, error);
      return null;
    }
  }

  /**
   * Get recipient display name by ID. Returns the name from cache/DB,
   * or a formatted fallback if not found.
   */
  async getRecipientName(recipientId: string): Promise<string> {
    const recipient = await this.getRecipientById(recipientId);
    if (recipient) return recipient.name;
    // Fallback: format the ID as a readable name
    return recipientId;
  }

  async fetchRecipientsByRole(role: string): Promise<Recipient[]> {
    try {
      console.log(`[RecipientService] Fetching recipients for role: ${role}`);

      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, is_active, supabase_uid')
        .eq('role', role)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const recipients = (data as Recipient[]) ?? [];
      for (const r of recipients) {
        this.cache.set(r.id, r);
      }
      return recipients;
    } catch (error) {
      console.error(`[RecipientService] Failed to fetch recipients for role ${role}:`, error);
      throw new Error(`Failed to fetch recipients for role: ${role}`);
    }
  }

  async searchRecipients(query: string): Promise<Recipient[]> {
    try {
      console.log(`[RecipientService] Searching recipients: ${query}`);

      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, designation, is_active, supabase_uid')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const recipients = (data as Recipient[]) ?? [];
      for (const r of recipients) {
        this.cache.set(r.id, r);
      }
      return recipients;
    } catch (error) {
      console.error('[RecipientService] Search failed:', error);
      throw new Error('Failed to search recipients');
    }
  }
}

export const recipientService = new RecipientService();
