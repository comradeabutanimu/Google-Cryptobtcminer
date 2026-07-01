/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { 
  Profile, Plan, Transaction, Deposit, Withdrawal, ActivityLog, Notification, Announcement 
} from '../src/types.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

interface Schema {
  profiles: Profile[];
  plans: Plan[];
  transactions: Transaction[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  activity_logs: ActivityLog[];
  notifications: Notification[];
  announcements: Announcement[];
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    price_btc: 500,
    hash_rate: '500 GH/s',
    daily_earn_btc: 0.00024359,
    duration_days: 60,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    price_btc: 10000,
    hash_rate: '3 TH/s',
    daily_earn_btc: 0.00632479,
    duration_days: 90,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_vip',
    name: 'VIP',
    price_btc: 50000,
    hash_rate: '15 TH/s',
    daily_earn_btc: 0.03846154,
    duration_days: 180,
    is_active: true,
    created_at: new Date().toISOString()
  }
];

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_welcome',
    message: 'Welcome to CryptoBTC Miner! Standard Cloud Mining payouts are processed daily. Start earning now!',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

class Database {
  private data: Schema;
  public supabaseClient = supabase;
  private availableTables = new Set<string>();
  private tableColumns = new Map<string, Set<string>>();
  private bootstrapPromise: Promise<void> | null = null;

  constructor() {
    this.data = {
      profiles: [],
      plans: DEFAULT_PLANS,
      transactions: [],
      deposits: [],
      withdrawals: [],
      activity_logs: [],
      notifications: [],
      announcements: DEFAULT_ANNOUNCEMENTS
    };

    const staticColumns: { [key: string]: string[] } = {
      profiles: [
        'id', 'email', 'full_name', 'btc_balance', 'active_plan', 
        'active_plan_investment', 'active_plan_hash_rate', 'active_plan_rate', 
        'plan_activated_at', 'plan_expires_at', 'last_mining_at', 
        'is_admin', 'is_suspended', 'referral_code', 'referred_by', 
        'admin_note', 'settings', 'two_factor_enabled', 'two_factor_secret', 
        'known_ips', 'created_at'
      ],
      plans: [
        'id', 'name', 'price_btc', 'hash_rate', 'daily_earn_btc', 
        'duration_days', 'is_active', 'created_at'
      ],
      transactions: [
        'id', 'user_id', 'type', 'description', 'amount_btc', 'status', 'created_at'
      ],
      deposits: [
        'id', 'user_id', 'amount_usd', 'amount_btc', 'invoice_id', 
        'nowpayments_payment_id', 'status', 'created_at'
      ],
      withdrawals: [
        'id', 'user_id', 'amount_btc', 'wallet_address', 'status', 
        'actioned_by', 'actioned_at', 'created_at'
      ],
      activity_logs: [
        'id', 'user_id', 'action', 'details', 'created_at'
      ],
      notifications: [
        'id', 'user_id', 'message', 'is_read', 'created_at'
      ],
      announcements: [
        'id', 'message', 'is_active', 'created_at'
      ]
    };

    for (const [table, cols] of Object.entries(staticColumns)) {
      this.tableColumns.set(table, new Set<string>(cols));
    }

    this.bootstrapSupabase();
  }

  public async bootstrapSupabase() {
    if (!this.supabaseClient) {
      console.log('Supabase client is not initialized because SUPABASE_URL or SUPABASE_ANON_KEY is missing.');
      return;
    }

    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.bootstrapPromise = (async () => {
      console.log('Initiating bootstrap sync from Supabase...');
      this.availableTables.clear();

      try {
        if (supabaseUrl && supabaseKey) {
          const restUrl = `${supabaseUrl}/rest/v1`;
          const res = await fetch(restUrl, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });
          if (res.ok) {
            const schema = await res.json() as any;
            if (schema && schema.definitions) {
              for (const tableName of Object.keys(schema.definitions)) {
                const props = schema.definitions[tableName]?.properties;
                if (props) {
                  const columns = new Set<string>(Object.keys(props));
                  this.tableColumns.set(tableName, columns);
                  console.log(`Discovered ${columns.size} columns for Supabase table "${tableName}".`);
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('Could not fetch dynamic OpenAPI schema from PostgREST:', err.message);
      }

      try {
        // 1. Fetch Profiles
        const { data: profiles, error: pError } = await this.supabaseClient.from('profiles').select('*');
        if (!pError && profiles) {
          this.availableTables.add('profiles');
          
          this.data.profiles = profiles.map(p => {
            const unified = { ...p };
            if (unified.email && unified.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
              unified.is_suspended = false;
            }

            let settingsObj = {
              blurBalances: false,
              notifyDepositConfirm: true,
              notifyWithdrawUpdate: true,
              notifySecurityAlert: true,
              notifyPromotions: false
            };
            if (unified.settings) {
              try {
                settingsObj = typeof unified.settings === 'string' ? JSON.parse(unified.settings) : unified.settings;
              } catch (e) {
                console.warn('Failed parsing settings for ' + unified.email);
              }
            }

            return {
              ...unified,
              settings: settingsObj
            } as any;
          });

          console.log(`Loaded ${profiles.length} profiles from Supabase.`);
        } else if (pError) {
          console.error('Error loading profiles from Supabase:', pError.message);
        }

        // 2. Fetch Plans
        const { data: plans, error: plError } = await this.supabaseClient.from('plans').select('*');
        if (!plError && plans && plans.length > 0) {
          this.availableTables.add('plans');
          this.data.plans = plans;
          console.log('Plans loaded from Supabase: ' + plans.length + ' plans');
        } else if (!plError && plans && plans.length === 0) {
          this.availableTables.add('plans');
          await this.syncTableToSupabase('plans', DEFAULT_PLANS);
          this.data.plans = DEFAULT_PLANS;
          console.log('Seeded default plans to Supabase');
        } else {
          if (this.data.plans.length === 0) {
            this.data.plans = DEFAULT_PLANS;
          }
          console.log('Plans loaded from local storage fallback: ' + this.data.plans.length + ' plans');
        }

        // 3. Fetch Transactions
        const { data: txs, error: txError } = await this.supabaseClient.from('transactions').select('*');
        if (!txError && txs) {
          this.availableTables.add('transactions');
          this.data.transactions = txs;
        }

        // 4. Fetch Deposits
        const { data: deposits, error: depError } = await this.supabaseClient.from('deposits').select('*');
        if (!depError && deposits) {
          this.availableTables.add('deposits');
          this.data.deposits = deposits;
        }

        // 5. Fetch Withdrawals
        const { data: withdrawals, error: wdError } = await this.supabaseClient.from('withdrawals').select('*');
        if (!wdError && withdrawals) {
          this.availableTables.add('withdrawals');
          this.data.withdrawals = withdrawals;
        }

        // 6. Fetch Activity Logs
        const { data: logs, error: lError } = await this.supabaseClient.from('activity_logs').select('*');
        if (!lError && logs) {
          this.availableTables.add('activity_logs');
          this.data.activity_logs = logs;
        }

        // 7. Fetch Notifications
        const { data: notifs, error: nError } = await this.supabaseClient.from('notifications').select('*');
        if (!nError && notifs) {
          this.availableTables.add('notifications');
          this.data.notifications = notifs;
        }

        // 8. Fetch Announcements
        const { data: anns, error: annError } = await this.supabaseClient.from('announcements').select('*');
        if (!annError && anns) {
          this.availableTables.add('announcements');
          this.data.announcements = anns;
        }

        await this.ensureSuperAdmin();
        console.log('Finished initializing Supabase detection/sync context.');
      } catch (err: any) {
        console.error('Unexpected error during Supabase boot seeding:', err.message);
      }
    })();
    return this.bootstrapPromise;
  }

  private async ensureSuperAdmin() {
    if (!this.supabaseClient) return;
    const email = 'comradeabutanimu@gmail.com';
    
    try {
      const { data: prof, error } = await this.supabaseClient.from('profiles').select('*').eq('email', email).maybeSingle();
      
      if (!prof) {
        console.log('Super Admin profile not found in Supabase profiles. Ensuring Auth user exists first...');
        
        let authUserId: string | null = null;
        try {
          const { data: authUsers, error: listError } = await this.supabaseClient.auth.admin.listUsers();
          if (!listError && authUsers && authUsers.users) {
            const foundAuth = (authUsers.users as any[]).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
            if (foundAuth) {
              authUserId = foundAuth.id;
            }
          }
        } catch (e) {
          console.warn('Could not list auth users:', e);
        }
        
        if (!authUserId) {
          const { data: authUser, error: authError } = await this.supabaseClient.auth.admin.createUser({
            email: email,
            password: 'Dauda@2026',
            email_confirm: true
          });
          if (authError) {
            console.error('Failed to create Super Admin auth account:', authError.message);
            return;
          }
          authUserId = authUser.user.id;
        }
        
        const adminProfile: any = {
          id: authUserId,
          email: email,
          full_name: 'Comrade Abutanimu',
          btc_balance: 0.155,
          active_plan: null,
          plan_activated_at: null,
          plan_expires_at: null,
          last_mining_at: null,
          is_admin: true,
          is_suspended: false,
          referral_code: 'DAUDA7',
          referred_by: null,
          admin_note: 'Master System Administrator Profile (Protected from delete and lock)',
          created_at: new Date().toISOString(),
          settings: {
            blurBalances: false,
            notifyDepositConfirm: true,
            notifyWithdrawUpdate: true,
            notifySecurityAlert: true,
            notifyPromotions: false
          },
          two_factor_enabled: false,
          two_factor_secret: null
        };
        
        const { error: insError } = await this.supabaseClient.from('profiles').insert({
          ...adminProfile,
          settings: JSON.stringify(adminProfile.settings)
        });
        if (insError) {
          console.error('Failed to insert Super Admin profile:', insError.message);
        } else {
          console.log('Super Admin user and profile created successfully.');
        }
      } else {
        if (!prof.is_admin || prof.is_suspended) {
          const { error: upError } = await this.supabaseClient.from('profiles').update({
            is_admin: true,
            is_suspended: false
          }).eq('id', prof.id);
          if (upError) {
            console.error('Failed to update Super Admin permissions:', upError.message);
          } else {
            console.log('Super Admin profile permissions verified.');
          }
        }
      }
    } catch (err: any) {
      console.error('Error during super admin check:', err.message);
    }
  }

  private filterRowColumns(tableName: string, row: any): any {
    const cleaned = { ...row };
    delete cleaned.detected_language;

    const columns = this.tableColumns.get(tableName);
    if (!columns || columns.size === 0) {
      return cleaned;
    }

    const filtered: any = {};
    for (const key of Object.keys(cleaned)) {
      const keyLower = key.toLowerCase();
      const exactColumnName = Array.from(columns).find(c => c.toLowerCase() === keyLower);
      if (exactColumnName) {
        filtered[exactColumnName] = cleaned[key];
      }
    }
    return filtered;
  }

  private async syncTableToSupabase(tableName: string, rows: any[]) {
    if (!this.supabaseClient || rows.length === 0) return;
    try {
      let cols = this.tableColumns.get(tableName);
      if (!cols) {
        cols = new Set<string>(Object.keys(rows[0]));
        this.tableColumns.set(tableName, cols);
      } else {
        for (const k of Object.keys(rows[0])) {
          cols.add(k);
        }
      }

      const formattedRows = rows.map(r => {
        const cleaned = this.filterRowColumns(tableName, r);
        if (tableName === 'profiles' && cleaned.settings && typeof cleaned.settings === 'object') {
          cleaned.settings = JSON.stringify(cleaned.settings);
        }
        return cleaned;
      });

      const { error } = await this.supabaseClient.from(tableName).upsert(formattedRows);
      if (error) {
        console.warn(`Supabase dynamic sync status for upsert in "${tableName}": info - ${error.message}`);
      } else {
        if (!this.availableTables.has(tableName)) {
          this.availableTables.add(tableName);
        }
        console.log(`Successfully seeded ${rows.length} rows to Supabase table "${tableName}".`);
      }
    } catch (e: any) {
      console.warn(`Supabase dynamic sync exception for upsert in "${tableName}": info - ${e.message}`);
    }
  }

  private async supabaseInsert(tableName: string, row: any) {
    if (!this.supabaseClient) return;
    try {
      let cols = this.tableColumns.get(tableName);
      if (!cols) {
        cols = new Set<string>(Object.keys(row));
        this.tableColumns.set(tableName, cols);
      } else {
        for (const k of Object.keys(row)) {
          cols.add(k);
        }
      }

      const cleaned = this.filterRowColumns(tableName, row);
      if (tableName === 'profiles' && cleaned.settings && typeof cleaned.settings === 'object') {
        cleaned.settings = JSON.stringify(cleaned.settings);
      }
      const { error } = await this.supabaseClient.from(tableName).insert(cleaned);
      if (error) {
        console.warn(`Supabase dynamic sync status for INSERT in "${tableName}": info - ${error.message}`);
      } else {
        if (!this.availableTables.has(tableName)) {
          this.availableTables.add(tableName);
        }
      }
    } catch (err: any) {
      console.warn(`Supabase dynamic sync exception for INSERT in "${tableName}": info - ${err.message}`);
    }
  }

  private async supabaseUpdate(tableName: string, row: any, id: string) {
    if (!this.supabaseClient) return;
    try {
      let cols = this.tableColumns.get(tableName);
      if (!cols) {
        cols = new Set<string>(Object.keys(row));
        this.tableColumns.set(tableName, cols);
      } else {
        for (const k of Object.keys(row)) {
          cols.add(k);
        }
      }

      const cleaned = this.filterRowColumns(tableName, row);
      if (tableName === 'profiles' && cleaned.settings && typeof cleaned.settings === 'object') {
        cleaned.settings = JSON.stringify(cleaned.settings);
      }
      const { error } = await this.supabaseClient.from(tableName).update(cleaned).eq('id', id);
      if (error) {
        console.warn(`Supabase dynamic sync status for UPDATE in "${tableName}": info - ${error.message}`);
      } else {
        if (!this.availableTables.has(tableName)) {
          this.availableTables.add(tableName);
        }
      }
    } catch (err: any) {
      console.warn(`Supabase dynamic sync exception for UPDATE in "${tableName}": info - ${err.message}`);
    }
  }

  private async supabaseDelete(tableName: string, id: string) {
    if (!this.supabaseClient) return;
    try {
      const { error } = await this.supabaseClient.from(tableName).delete().eq('id', id);
      if (error) {
        console.warn(`Supabase dynamic sync status for DELETE in "${tableName}": info - ${error.message}`);
      } else {
        if (!this.availableTables.has(tableName)) {
          this.availableTables.add(tableName);
        }
      }
    } catch (err: any) {
      console.warn(`Supabase dynamic sync exception for DELETE in "${tableName}": info - ${err.message}`);
    }
  }

  public save() {
    // No-op: Local JSON persistence removed to ensure absolute statelessness and prevent data loss.
    // All changes are persisted directly to Supabase.
  }

  // Helper getters: synchronous fast reads, silent non-blocking background synchronization
  public getProfiles(): Profile[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('profiles').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.profiles = data.map(p => {
            let settingsObj = {
              blurBalances: false,
              notifyDepositConfirm: true,
              notifyWithdrawUpdate: true,
              notifySecurityAlert: true,
              notifyPromotions: false
            };
            if (p.settings) {
              try {
                settingsObj = typeof p.settings === 'string' ? JSON.parse(p.settings) : p.settings;
              } catch (e) {}
            }
            return {
              ...p,
              settings: settingsObj
            };
          });
        }
      });
    }
    return this.data.profiles;
  }

  public getPlans(): Plan[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('plans').select('*').then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          this.data.plans = data;
        }
      });
    }
    return this.data.plans;
  }

  public getTransactions(): Transaction[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('transactions').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.transactions = data;
        }
      });
    }
    return this.data.transactions;
  }

  public getDeposits(): Deposit[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('deposits').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.deposits = data;
        }
      });
    }
    return this.data.deposits;
  }

  public getWithdrawals(): Withdrawal[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('withdrawals').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.withdrawals = data;
        }
      });
    }
    return this.data.withdrawals;
  }

  public getActivityLogs(): ActivityLog[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('activity_logs').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.activity_logs = data;
        }
      });
    }
    return this.data.activity_logs;
  }

  public getNotifications(): Notification[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('notifications').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.notifications = data;
        }
      });
    }
    return this.data.notifications;
  }

  public getAnnouncements(): Announcement[] {
    if (this.supabaseClient) {
      this.supabaseClient.from('announcements').select('*').then(({ data, error }) => {
        if (!error && data) {
          this.data.announcements = data;
        }
      });
    }
    return this.data.announcements;
  }

  // Helpers to add data - awaiting Supabase operations for strict transactional consistency
  public async addProfile(profile: Profile) {
    if (profile.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
      profile.is_admin = true;
    }
    const idx = this.data.profiles.findIndex(p => p.id === profile.id);
    if (idx === -1) {
      this.data.profiles.push(profile);
    } else {
      this.data.profiles[idx] = profile;
    }
    await this.supabaseInsert('profiles', profile);
  }

  public async addTransaction(tx: Transaction) {
    this.data.transactions.push(tx);
    await this.supabaseInsert('transactions', tx);
  }

  public async addDeposit(dep: Deposit) {
    this.data.deposits.push(dep);
    await this.supabaseInsert('deposits', dep);
  }

  public async addWithdrawal(wd: Withdrawal) {
    this.data.withdrawals.push(wd);
    await this.supabaseInsert('withdrawals', wd);
  }

  public async addActivityLog(log: ActivityLog) {
    this.data.activity_logs.push(log);
    await this.supabaseInsert('activity_logs', log);
  }

  public async addNotification(notif: Notification) {
    this.data.notifications.push(notif);
    await this.supabaseInsert('notifications', notif);
  }

  public async addAnnouncement(ann: Announcement) {
    this.data.announcements.push(ann);
    await this.supabaseInsert('announcements', ann);
  }

  public async updateProfile(updated: Partial<Profile> & { id: string }) {
    if (updated.email && updated.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
      updated.is_suspended = false;
    }
    
    // First fetch current profile from Supabase to ensure accurate merge
    let current: any = this.data.profiles.find(p => p.id === updated.id);
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.from('profiles').select('*').eq('id', updated.id).maybeSingle();
      if (!error && data) {
        current = data;
      }
    }

    if (current) {
      const changedFields: any = {};
      for (const key of Object.keys(updated)) {
        if ((updated as any)[key] !== (current as any)[key]) {
          changedFields[key] = (updated as any)[key];
        }
      }

      const merged = { ...current, ...updated };
      if (merged.email && merged.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
        merged.is_suspended = false;
      }
      
      merged.active_plan = merged.active_plan ?? null;
      merged.plan_activated_at = merged.plan_activated_at ?? null;
      merged.plan_expires_at = merged.plan_expires_at ?? null;
      merged.last_mining_at = merged.last_mining_at ?? null;
      merged.locked_capital = merged.locked_capital ?? 0;
      merged.deposit_usd_value = merged.deposit_usd_value ?? 0;

      const idx = this.data.profiles.findIndex(p => p.id === updated.id);
      if (idx !== -1) {
        this.data.profiles[idx] = merged;
      } else {
        this.data.profiles.push(merged);
      }

      if (Object.keys(changedFields).length > 0) {
        await this.supabaseUpdate('profiles', { id: updated.id, ...changedFields }, updated.id);
      }
    }
  }

  public async updatePlan(updated: Partial<Plan> & { id: string }) {
    const idx = this.data.plans.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      const original = this.data.plans[idx];
      const changedFields: any = {};
      for (const key of Object.keys(updated)) {
        if ((updated as any)[key] !== (original as any)[key]) {
          changedFields[key] = (updated as any)[key];
        }
      }

      const merged = { ...original, ...updated };
      this.data.plans[idx] = merged;

      if (Object.keys(changedFields).length > 0) {
        await this.supabaseUpdate('plans', { id: updated.id, ...changedFields }, updated.id);
      }
    }
  }

  public async addPlan(plan: Plan) {
    this.data.plans.push(plan);
    await this.supabaseInsert('plans', plan);
  }

  public async updateWithdrawal(updated: Partial<Withdrawal> & { id: string }) {
    const idx = this.data.withdrawals.findIndex(w => w.id === updated.id);
    if (idx !== -1) {
      const original = this.data.withdrawals[idx];
      const changedFields: any = {};
      for (const key of Object.keys(updated)) {
        if ((updated as any)[key] !== (original as any)[key]) {
          changedFields[key] = (updated as any)[key];
        }
      }

      const merged = { ...original, ...updated };
      this.data.withdrawals[idx] = merged;

      if (Object.keys(changedFields).length > 0) {
        await this.supabaseUpdate('withdrawals', { id: updated.id, ...changedFields }, updated.id);
      }
    }
  }

  public async updateDeposit(updated: Partial<Deposit> & { id: string }) {
    const idx = this.data.deposits.findIndex(d => d.id === updated.id);
    if (idx !== -1) {
      const original = this.data.deposits[idx];
      const changedFields: any = {};
      for (const key of Object.keys(updated)) {
        if ((updated as any)[key] !== (original as any)[key]) {
          changedFields[key] = (updated as any)[key];
        }
      }

      const merged = { ...original, ...updated };
      this.data.deposits[idx] = merged;

      if (Object.keys(changedFields).length > 0) {
        await this.supabaseUpdate('deposits', { id: updated.id, ...changedFields }, updated.id);
      }
    }
  }

  public async updateAnnouncement(updated: Partial<Announcement> & { id: string }) {
    const idx = this.data.announcements.findIndex(a => a.id === updated.id);
    if (idx !== -1) {
      const original = this.data.announcements[idx];
      const changedFields: any = {};
      for (const key of Object.keys(updated)) {
        if ((updated as any)[key] !== (original as any)[key]) {
          changedFields[key] = (updated as any)[key];
        }
      }

      const merged = { ...original, ...updated };
      this.data.announcements[idx] = merged;

      if (Object.keys(changedFields).length > 0) {
        await this.supabaseUpdate('announcements', { id: updated.id, ...changedFields }, updated.id);
      }
    }
  }

  public async deleteAnnouncement(id: string) {
    this.data.announcements = this.data.announcements.filter(a => a.id !== id);
    await this.supabaseDelete('announcements', id);
  }

  public async deleteProfile(id: string) {
    this.data.profiles = this.data.profiles.filter(p => p.id !== id);
    this.data.transactions = this.data.transactions.filter(t => t.user_id !== id);
    this.data.deposits = this.data.deposits.filter(d => d.user_id !== id);
    this.data.withdrawals = this.data.withdrawals.filter(w => w.user_id !== id);
    this.data.notifications = this.data.notifications.filter(n => n.user_id !== id);
    this.data.activity_logs = this.data.activity_logs.filter(a => a.user_id !== id);
    await this.supabaseDelete('profiles', id);
  }

  public async exportDatabase() {
    return {
      profiles: this.getProfiles(),
      plans: this.getPlans(),
      transactions: this.getTransactions(),
      deposits: this.getDeposits(),
      withdrawals: this.getWithdrawals(),
      activity_logs: this.getActivityLogs(),
      notifications: this.getNotifications(),
      announcements: this.getAnnouncements()
    };
  }

  public async importDatabase(newData: any) {
    if (!newData || typeof newData !== 'object') {
      throw new Error('Invalid database backup format.');
    }

    this.data = {
      profiles: Array.isArray(newData.profiles) ? newData.profiles : this.data.profiles,
      plans: Array.isArray(newData.plans) ? newData.plans : this.data.plans,
      transactions: Array.isArray(newData.transactions) ? newData.transactions : this.data.transactions,
      deposits: Array.isArray(newData.deposits) ? newData.deposits : this.data.deposits,
      withdrawals: Array.isArray(newData.withdrawals) ? newData.withdrawals : this.data.withdrawals,
      activity_logs: Array.isArray(newData.activity_logs) ? newData.activity_logs : this.data.activity_logs,
      notifications: Array.isArray(newData.notifications) ? newData.notifications : this.data.notifications,
      announcements: Array.isArray(newData.announcements) ? newData.announcements : this.data.announcements
    };

    if (this.supabaseClient) {
      console.log('Initiating bulk restore/upsert to Supabase after manual database backup import...');
      const tables = ['profiles', 'plans', 'transactions', 'deposits', 'withdrawals', 'activity_logs', 'notifications', 'announcements'];
      for (const t of tables) {
        const rowsToSync = (this.data as any)[t === 'activity_logs' ? 'activity_logs' : t];
        if (rowsToSync && rowsToSync.length > 0) {
          await this.syncTableToSupabase(t, rowsToSync);
        }
      }
    }
  }
}

export const db = new Database();
