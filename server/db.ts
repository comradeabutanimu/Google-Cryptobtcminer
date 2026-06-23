/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { 
  Profile, Plan, Transaction, Deposit, Withdrawal, ActivityLog, Notification, Announcement 
} from '../src/types.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

interface Schema {
  profiles: (Profile & { passwordHash: string })[];
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
    daily_earn_btc: 0.00024359, // equivalent to ($950 total return / 60 days) at $65,000 BTC reference price
    duration_days: 60,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    price_btc: 10000,
    hash_rate: '3 TH/s',
    daily_earn_btc: 0.00632479, // equivalent to ($37,000 total return / 90 days) at $65,000 BTC reference price
    duration_days: 90,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_vip',
    name: 'VIP',
    price_btc: 50000,
    hash_rate: '15 TH/s',
    daily_earn_btc: 0.03846154, // equivalent to ($2,500 daily return based on 5%) at $65,000 BTC reference price
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
  private supabaseClient = supabase;
  private availableTables = new Set<string>();
  private tableColumns = new Map<string, Set<string>>();

  constructor() {
    this.data = {
      profiles: [],
      plans: [], // Start empty, always load from Supabase
      transactions: [],
      deposits: [],
      withdrawals: [],
      activity_logs: [],
      notifications: [],
      announcements: DEFAULT_ANNOUNCEMENTS
    };
    this.init();
    this.bootstrapSupabase();
  }

  private init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          profiles: (parsed.profiles || []).map((p: any) => {
            if (p.active_plan === 'plan_free' || p.active_plan === 'free') {
              p.active_plan = null;
            }
            if (p.email && p.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
              p.is_suspended = false;
            }
            return p;
          }),
          plans: parsed.plans && parsed.plans.length > 0 ? parsed.plans : [],
          transactions: parsed.transactions || [],
          deposits: parsed.deposits || [],
          withdrawals: parsed.withdrawals || [],
          activity_logs: parsed.activity_logs || [],
          notifications: parsed.notifications || [],
          announcements: parsed.announcements || DEFAULT_ANNOUNCEMENTS
        };
      } else {
        this.save();
      }
      this.ensureSuperAdmin();
    } catch (err) {
      console.error('Error initializing database file; failing back to in-memory.', err);
    }
  }

  public async bootstrapSupabase() {
    if (!this.supabaseClient) {
      console.log('Supabase client is not initialized because SUPABASE_URL or SUPABASE_ANON_KEY is missing.');
      return;
    }

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
        if (profiles.length > 0) {
          this.data.profiles = profiles.map(p => {
            const unified = { ...p };
            // Auto map lowercased passwordhash or password_hash back to camelCase passwordHash for authentication security checks
            if (!unified.passwordHash && unified.passwordhash) {
              unified.passwordHash = unified.passwordhash;
            }
            if (!unified.passwordHash && unified.password_hash) {
              unified.passwordHash = unified.password_hash;
            }
            if (unified.email && unified.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
              unified.is_suspended = false;
            }
            return {
              ...unified,
              active_plan: unified.active_plan || null,
              plan_activated_at: unified.plan_activated_at || null,
              plan_expires_at: unified.plan_expires_at || null,
              last_mining_at: unified.last_mining_at || null,
              locked_capital: unified.locked_capital || 0,
              deposit_usd_value: unified.deposit_usd_value || 0,
              settings: typeof unified.settings === 'string' ? JSON.parse(unified.settings) : unified.settings
            };
          });
          console.log(`Loaded ${profiles.length} profiles from Supabase.`);
        } else {
          if (this.data.profiles.length > 0) {
            await this.syncTableToSupabase('profiles', this.data.profiles);
          }
        }
      } else if (pError) {
        if (pError.message.includes('Could not find the table') || pError.message.includes('relation "')) {
          console.warn('⚠️  Table "profiles" was not found in your Supabase schema cache. Follow the instructions to run the SQL migration script to create it.');
        } else {
          console.error('Error loading profiles from Supabase:', pError.message);
        }
      }

      // 2. Fetch Plans
      const { data: plans, error: plError } = await this.supabaseClient.from('plans').select('*');
      if (!plError && plans && plans.length > 0) {
        this.availableTables.add('plans');
        this.data.plans = plans;
        console.log('Plans loaded from Supabase: ' + plans.length + ' plans');
      } else if (!plError && plans && plans.length === 0) {
        this.availableTables.add('plans');
        // Only seed DEFAULT_PLANS if Supabase is completely empty
        await this.syncTableToSupabase('plans', DEFAULT_PLANS);
        this.data.plans = DEFAULT_PLANS;
        console.log('Seeded default plans to Supabase');
      } else {
        // Supabase error - keep existing plans if any, otherwise use defaults
        if (this.data.plans.length === 0) {
          this.data.plans = DEFAULT_PLANS;
        }
        console.log('Plans loaded from local storage: ' + this.data.plans.length + ' plans');
      }

      // 3. Fetch Transactions
      const { data: txs, error: txError } = await this.supabaseClient.from('transactions').select('*');
      if (!txError && txs) {
        this.availableTables.add('transactions');
        if (txs.length > 0) {
          this.data.transactions = txs;
          console.log(`Loaded ${txs.length} transactions from Supabase.`);
        } else if (this.data.transactions.length > 0) {
          await this.syncTableToSupabase('transactions', this.data.transactions);
        }
      } else if (txError) {
        if (txError.message.includes('Could not find the table') || txError.message.includes('relation "')) {
          console.warn('⚠️  Table "transactions" was not found in your Supabase schema cache.');
        } else {
          console.error('Error loading transactions from Supabase:', txError.message);
        }
      }

      // 4. Fetch Deposits
      const { data: deposits, error: depError } = await this.supabaseClient.from('deposits').select('*');
      if (!depError && deposits) {
        this.availableTables.add('deposits');
        if (deposits.length > 0) {
          this.data.deposits = deposits;
          console.log(`Loaded ${deposits.length} deposits from Supabase.`);
        } else if (this.data.deposits.length > 0) {
          await this.syncTableToSupabase('deposits', this.data.deposits);
        }
      } else if (depError) {
        if (depError.message.includes('Could not find the table') || depError.message.includes('relation "')) {
          console.warn('⚠️  Table "deposits" was not found in your Supabase schema cache.');
        } else {
          console.error('Error loading deposits from Supabase:', depError.message);
        }
      }

      // 5. Fetch Withdrawals
      const { data: withdrawals, error: wdError } = await this.supabaseClient.from('withdrawals').select('*');
      if (!wdError && withdrawals) {
        this.availableTables.add('withdrawals');
        if (withdrawals.length > 0) {
          this.data.withdrawals = withdrawals;
          console.log(`Loaded ${withdrawals.length} withdrawals from Supabase.`);
        } else if (this.data.withdrawals.length > 0) {
          await this.syncTableToSupabase('withdrawals', this.data.withdrawals);
        }
      } else if (wdError) {
        if (wdError.message.includes('Could not find the table') || wdError.message.includes('relation "')) {
          console.warn('⚠️  Table "withdrawals" was not found in your Supabase schema cache.');
        } else {
          console.error('Error loading withdrawals from Supabase:', wdError.message);
        }
      }

      // 6. Fetch Activity Logs
      const { data: logs, error: lError } = await this.supabaseClient.from('activity_logs').select('*');
      if (!lError && logs) {
        this.availableTables.add('activity_logs');
        if (logs.length > 0) {
          this.data.activity_logs = logs;
          console.log(`Loaded ${logs.length} activity_logs from Supabase.`);
        } else if (this.data.activity_logs.length > 0) {
          await this.syncTableToSupabase('activity_logs', this.data.activity_logs);
        }
      } else if (lError) {
        if (lError.message.includes('Could not find the table') || lError.message.includes('relation "')) {
          console.warn('⚠️  Table "activity_logs" was not found in your Supabase schema cache.');
        } else {
          console.error('Error loading activity_logs from Supabase:', lError.message);
        }
      }

      // 7. Fetch Notifications
      const { data: notifs, error: nError } = await this.supabaseClient.from('notifications').select('*');
      if (!nError && notifs) {
        this.availableTables.add('notifications');
        if (notifs.length > 0) {
          this.data.notifications = notifs;
          console.log(`Loaded ${notifs.length} notifications from Supabase.`);
        } else if (this.data.notifications.length > 0) {
          await this.syncTableToSupabase('notifications', this.data.notifications);
        }
      } else if (nError) {
        if (nError.message.includes('Could not find the table') || nError.message.includes('relation "')) {
          console.warn('⚠️  Table "notifications" was not found in your Supabase schema cache.');
        } else {
          console.error('Error loading notifications from Supabase:', nError.message);
        }
      }

      // 8. Fetch Announcements
      const { data: anns, error: annError } = await this.supabaseClient.from('announcements').select('*');
      if (!annError && anns) {
        this.availableTables.add('announcements');
        if (anns.length > 0) {
          this.data.announcements = anns;
          console.log(`Loaded ${anns.length} announcements from Supabase.`);
        } else {
          await this.syncTableToSupabase('announcements', this.data.announcements);
        }
      } else if (annError) {
        if (annError.message.includes('Could not find the table') || annError.message.includes('relation "')) {
          console.warn('⚠️  Table "announcements" was not found in your Supabase schema cache.');
        } else {
          console.error('Error loading announcements from Supabase:', annError.message);
        }
      }

      this.save();
      this.ensureSuperAdmin();
      console.log('Finished initializing Supabase detection/sync context.');
    } catch (err: any) {
      console.error('Unexpected error during Supabase boot seeding:', err.message);
    }
  }

  private ensureSuperAdmin() {
    const email = 'comradeabutanimu@gmail.com';
    const found = this.data.profiles.find(p => p.email && p.email.toLowerCase() === email);
    if (!found) {
      const adminProfile: any = {
        id: 'usr_comrade_super_admin',
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
        passwordHash: 'Dauda@2026',
        two_factor_enabled: false,
        two_factor_secret: null
      };
      this.data.profiles.push(adminProfile);
      this.save();
      this.supabaseInsert('profiles', adminProfile);
      console.log('Super Admin user created successfully.');
    } else {
      let modified = false;
      if (!found.is_admin) {
        found.is_admin = true;
        modified = true;
      }
      if (found.passwordHash !== 'Dauda@2026') {
        found.passwordHash = 'Dauda@2026';
        modified = true;
      }
      if (found.is_suspended) {
        found.is_suspended = false;
        modified = true;
      }
      if (modified) {
        this.save();
        this.supabaseUpdate('profiles', found, found.id);
        console.log('Super Admin profile updated with correct credentials.');
      }
    }
  }

  private filterRowColumns(tableName: string, row: any): any {
    const cleaned = { ...row };
    // Always strip known non-column helper keys
    delete cleaned.detected_language;

    const columns = this.tableColumns.get(tableName);
    if (!columns || columns.size === 0) {
      // Preserve passwordHash safely if columns have not been fetched yet
      return cleaned;
    }

    const filtered: any = {};
    for (const key of Object.keys(cleaned)) {
      const keyLower = key.toLowerCase();
      // Keep passwordHash key mapped correctly to whichever casing columns exist (e.g., password_hash or passwordhash)
      if (key === 'passwordHash') {
        const foundColumn = Array.from(columns).find(
          c => c.toLowerCase() === 'passwordhash' || c.toLowerCase() === 'password_hash'
        );
        if (foundColumn) {
          filtered[foundColumn] = cleaned[key];
          continue;
        }
      }

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
      // Auto register columns to avoid empty filtering
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
        if (error.message.includes('relation "') || error.message.includes('Could not find')) {
          console.warn(`Supabase dynamic sync: Table "${tableName}" does not exist in Supabase yet. Run the scheme setup script.`);
        } else {
          console.warn(`Supabase dynamic sync status for upsert in "${tableName}": info - ${error.message}`);
        }
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
      // Auto register columns to avoid empty filtering
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
        if (error.message.includes('relation "') || error.message.includes('Could not find')) {
          console.warn(`Supabase dynamic sync: Table "${tableName}" does not exist in Supabase. Signups won't save permanently until Supabase script is executed.`);
        } else {
          console.warn(`Supabase dynamic sync status for INSERT in "${tableName}": info - ${error.message}`);
        }
      } else {
        if (!this.availableTables.has(tableName)) {
          console.log(`Supabase dynamic sync: Table "${tableName}" successfully verified & synced dynamically!`);
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
      // Auto register columns to avoid empty filtering
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
        if (error.message.includes('relation "') || error.message.includes('Could not find')) {
          console.warn(`Supabase dynamic sync: Table "${tableName}" does not exist in Supabase. Changes won't save permanently until Supabase script is executed.`);
        } else {
          console.warn(`Supabase dynamic sync status for UPDATE in "${tableName}": info - ${error.message}`);
        }
      } else {
        if (!this.availableTables.has(tableName)) {
          console.log(`Supabase dynamic sync: Table "${tableName}" successfully verified & synced dynamically!`);
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
        if (error.message.includes('relation "') || error.message.includes('Could not find')) {
          console.warn(`Supabase dynamic sync: Table "${tableName}" does not exist in Supabase.`);
        } else {
          console.warn(`Supabase dynamic sync status for DELETE in "${tableName}": info - ${error.message}`);
        }
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
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  // Helper getters
  public getProfiles() {
    return this.data.profiles;
  }

  public getPlans() {
    return this.data.plans;
  }

  public getTransactions() {
    return this.data.transactions;
  }

  public getDeposits() {
    return this.data.deposits;
  }

  public getWithdrawals() {
    return this.data.withdrawals;
  }

  public getActivityLogs() {
    return this.data.activity_logs;
  }

  public getNotifications() {
    return this.data.notifications;
  }

  public getAnnouncements() {
    return this.data.announcements;
  }

  // Helpers to add data
  public addProfile(profile: Profile & { passwordHash: string }) {
    if (profile.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
      profile.is_admin = true;
    }
    this.data.profiles.push(profile);
    this.save();
    this.supabaseInsert('profiles', profile);
  }

  public addTransaction(tx: Transaction) {
    this.data.transactions.push(tx);
    this.save();
    this.supabaseInsert('transactions', tx);
  }

  public addDeposit(dep: Deposit) {
    this.data.deposits.push(dep);
    this.save();
    this.supabaseInsert('deposits', dep);
  }

  public addWithdrawal(wd: Withdrawal) {
    this.data.withdrawals.push(wd);
    this.save();
    this.supabaseInsert('withdrawals', wd);
  }

  public addActivityLog(log: ActivityLog) {
    this.data.activity_logs.push(log);
    this.save();
    this.supabaseInsert('activity_logs', log);
  }

  public addNotification(notif: Notification) {
    this.data.notifications.push(notif);
    this.save();
    this.supabaseInsert('notifications', notif);
  }

  public addAnnouncement(ann: Announcement) {
    this.data.announcements.push(ann);
    this.save();
    this.supabaseInsert('announcements', ann);
  }

  public updateProfile(updated: Profile) {
    if (updated.email && updated.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
      updated.is_suspended = false;
    }
    const idx = this.data.profiles.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      const original = this.data.profiles[idx];
      const merged = { ...original, ...updated };
      if (merged.email && merged.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
        merged.is_suspended = false;
      }
      this.data.profiles[idx] = merged;
      this.save();
      this.supabaseUpdate('profiles', merged, updated.id);
    }
  }

  public updatePlan(updated: Plan) {
    const idx = this.data.plans.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      this.data.plans[idx] = updated;
      this.save();
      this.supabaseUpdate('plans', updated, updated.id);
    }
  }

  public addPlan(plan: Plan) {
    this.data.plans.push(plan);
    this.save();
    this.supabaseInsert('plans', plan);
  }

  public updateWithdrawal(updated: Withdrawal) {
    const idx = this.data.withdrawals.findIndex(w => w.id === updated.id);
    if (idx !== -1) {
      this.data.withdrawals[idx] = updated;
      this.save();
      this.supabaseUpdate('withdrawals', updated, updated.id);
    }
  }

  public updateDeposit(updated: Deposit) {
    const idx = this.data.deposits.findIndex(d => d.id === updated.id);
    if (idx !== -1) {
      this.data.deposits[idx] = updated;
      this.save();
      this.supabaseUpdate('deposits', updated, updated.id);
    }
  }

  public updateAnnouncement(updated: Announcement) {
    const idx = this.data.announcements.findIndex(a => a.id === updated.id);
    if (idx !== -1) {
      this.data.announcements[idx] = updated;
      this.save();
      this.supabaseUpdate('announcements', updated, updated.id);
    }
  }

  public deleteAnnouncement(id: string) {
    this.data.announcements = this.data.announcements.filter(a => a.id !== id);
    this.save();
    this.supabaseDelete('announcements', id);
  }

  public deleteProfile(id: string) {
    this.data.profiles = this.data.profiles.filter(p => p.id !== id);
    this.data.transactions = this.data.transactions.filter(t => t.user_id !== id);
    this.data.deposits = this.data.deposits.filter(d => d.user_id !== id);
    this.data.withdrawals = this.data.withdrawals.filter(w => w.user_id !== id);
    this.data.notifications = this.data.notifications.filter(n => n.user_id !== id);
    this.data.activity_logs = this.data.activity_logs.filter(a => a.user_id !== id);
    this.save();
    this.supabaseDelete('profiles', id);
  }

  public exportDatabase() {
    return this.data;
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

    this.save();

    if (this.supabaseClient) {
      console.log('Initiating bulk restore/upsert to Supabase after manual database backup import...');
      const tables = ['profiles', 'plans', 'transactions', 'deposits', 'withdrawals', 'activity_logs', 'notifications', 'announcements'];
      for (const t of tables) {
        if (this.availableTables.has(t)) {
          const rowsToSync = (this.data as any)[t === 'activity_logs' ? 'activity_logs' : t];
          if (rowsToSync && rowsToSync.length > 0) {
            await this.syncTableToSupabase(t, rowsToSync);
          }
        }
      }
    }
  }
}

export const db = new Database();
