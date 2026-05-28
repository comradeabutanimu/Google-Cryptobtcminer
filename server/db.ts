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
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
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
    id: 'plan_free',
    name: 'Free',
    price_btc: 0,
    hash_rate: '10 GH/s',
    daily_earn_btc: 0.0000005,
    duration_days: 30,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_starter',
    name: 'Starter',
    price_btc: 0.005,
    hash_rate: '500 GH/s',
    daily_earn_btc: 0.0001,
    duration_days: 60,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    price_btc: 0.025,
    hash_rate: '3 TH/s',
    daily_earn_btc: 0.0006,
    duration_days: 90,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'plan_vip',
    name: 'VIP',
    price_btc: 0.1,
    hash_rate: '15 TH/s',
    daily_earn_btc: 0.0035,
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
          profiles: parsed.profiles || [],
          plans: parsed.plans || DEFAULT_PLANS,
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
    } catch (err) {
      console.error('Error initializing database file; failing back to in-memory.', err);
    }
  }

  private async bootstrapSupabase() {
    if (!this.supabaseClient) {
      console.log('Supabase client is not initialized because SUPABASE_URL or SUPABASE_ANON_KEY is missing.');
      return;
    }

    console.log('Initiating bootstrap sync from Supabase...');

    try {
      // 1. Fetch Profiles
      const { data: profiles, error: pError } = await this.supabaseClient.from('profiles').select('*');
      if (!pError && profiles) {
        if (profiles.length > 0) {
          this.data.profiles = profiles.map(p => ({
            ...p,
            settings: typeof p.settings === 'string' ? JSON.parse(p.settings) : p.settings
          }));
          console.log(`Loaded ${profiles.length} profiles from Supabase.`);
        } else {
          if (this.data.profiles.length > 0) {
            await this.syncTableToSupabase('profiles', this.data.profiles);
          }
        }
      } else if (pError) {
        console.error('Error loading profiles from Supabase:', pError.message);
      }

      // 2. Fetch Plans
      const { data: plans, error: plError } = await this.supabaseClient.from('plans').select('*');
      if (!plError && plans) {
        if (plans.length > 0) {
          this.data.plans = plans;
          console.log(`Loaded ${plans.length} plans from Supabase.`);
        } else {
          await this.syncTableToSupabase('plans', this.data.plans);
        }
      } else if (plError) {
        console.error('Error loading plans from Supabase:', plError.message);
      }

      // 3. Fetch Transactions
      const { data: txs, error: txError } = await this.supabaseClient.from('transactions').select('*');
      if (!txError && txs) {
        if (txs.length > 0) {
          this.data.transactions = txs;
          console.log(`Loaded ${txs.length} transactions from Supabase.`);
        } else if (this.data.transactions.length > 0) {
          await this.syncTableToSupabase('transactions', this.data.transactions);
        }
      } else if (txError) {
        console.error('Error loading transactions from Supabase:', txError.message);
      }

      // 4. Fetch Deposits
      const { data: deposits, error: depError } = await this.supabaseClient.from('deposits').select('*');
      if (!depError && deposits) {
        if (deposits.length > 0) {
          this.data.deposits = deposits;
          console.log(`Loaded ${deposits.length} deposits from Supabase.`);
        } else if (this.data.deposits.length > 0) {
          await this.syncTableToSupabase('deposits', this.data.deposits);
        }
      } else if (depError) {
        console.error('Error loading deposits from Supabase:', depError.message);
      }

      // 5. Fetch Withdrawals
      const { data: withdrawals, error: wdError } = await this.supabaseClient.from('withdrawals').select('*');
      if (!wdError && withdrawals) {
        if (withdrawals.length > 0) {
          this.data.withdrawals = withdrawals;
          console.log(`Loaded ${withdrawals.length} withdrawals from Supabase.`);
        } else if (this.data.withdrawals.length > 0) {
          await this.syncTableToSupabase('withdrawals', this.data.withdrawals);
        }
      } else if (wdError) {
        console.error('Error loading withdrawals from Supabase:', wdError.message);
      }

      // 6. Fetch Activity Logs
      const { data: logs, error: lError } = await this.supabaseClient.from('activity_logs').select('*');
      if (!lError && logs) {
        if (logs.length > 0) {
          this.data.activity_logs = logs;
          console.log(`Loaded ${logs.length} activity_logs from Supabase.`);
        } else if (this.data.activity_logs.length > 0) {
          await this.syncTableToSupabase('activity_logs', this.data.activity_logs);
        }
      } else if (lError) {
        console.error('Error loading activity_logs from Supabase:', lError.message);
      }

      // 7. Fetch Notifications
      const { data: notifs, error: nError } = await this.supabaseClient.from('notifications').select('*');
      if (!nError && notifs) {
        if (notifs.length > 0) {
          this.data.notifications = notifs;
          console.log(`Loaded ${notifs.length} notifications from Supabase.`);
        } else if (this.data.notifications.length > 0) {
          await this.syncTableToSupabase('notifications', this.data.notifications);
        }
      } else if (nError) {
        console.error('Error loading notifications from Supabase:', nError.message);
      }

      // 8. Fetch Announcements
      const { data: anns, error: annError } = await this.supabaseClient.from('announcements').select('*');
      if (!annError && anns) {
        if (anns.length > 0) {
          this.data.announcements = anns;
          console.log(`Loaded ${anns.length} announcements from Supabase.`);
        } else {
          await this.syncTableToSupabase('announcements', this.data.announcements);
        }
      } else if (annError) {
        console.error('Error loading announcements from Supabase:', annError.message);
      }

      this.save();
      console.log('Successfully completed bootstrap sync from Supabase.');
    } catch (err: any) {
      console.error('Unexpected error during Supabase boot seeding:', err.message);
    }
  }

  private async syncTableToSupabase(tableName: string, rows: any[]) {
    if (!this.supabaseClient || rows.length === 0) return;
    try {
      const formattedRows = rows.map(r => {
        if (tableName === 'profiles') {
          return {
            ...r,
            settings: typeof r.settings === 'object' ? JSON.stringify(r.settings) : r.settings
          };
        }
        return r;
      });

      const { error } = await this.supabaseClient.from(tableName).upsert(formattedRows);
      if (error) {
        console.warn(`Could not seed initial rows to Supabase table "${tableName}":`, error.message);
      } else {
        console.log(`Successfully seeded ${rows.length} rows to Supabase table "${tableName}".`);
      }
    } catch (e: any) {
      console.warn(`Exception seeding initial rows to Supabase table "${tableName}":`, e.message);
    }
  }

  private async supabaseInsert(tableName: string, row: any) {
    if (!this.supabaseClient) return;
    try {
      const formattedRow = { ...row };
      if (tableName === 'profiles' && typeof row.settings === 'object') {
        formattedRow.settings = JSON.stringify(row.settings);
      }
      const { error } = await this.supabaseClient.from(tableName).insert(formattedRow);
      if (error) {
        console.error(`Supabase INSERT failed for ${tableName}:`, error.message);
      }
    } catch (err: any) {
      console.error(`Supabase INSERT exception for ${tableName}:`, err.message);
    }
  }

  private async supabaseUpdate(tableName: string, row: any, id: string) {
    if (!this.supabaseClient) return;
    try {
      const formattedRow = { ...row };
      if (tableName === 'profiles' && typeof row.settings === 'object') {
        formattedRow.settings = JSON.stringify(row.settings);
      }
      const { error } = await this.supabaseClient.from(tableName).update(formattedRow).eq('id', id);
      if (error) {
        console.error(`Supabase UPDATE failed for ${tableName}:`, error.message);
      }
    } catch (err: any) {
      console.error(`Supabase UPDATE exception for ${tableName}:`, err.message);
    }
  }

  private async supabaseDelete(tableName: string, id: string) {
    if (!this.supabaseClient) return;
    try {
      const { error } = await this.supabaseClient.from(tableName).delete().eq('id', id);
      if (error) {
        console.error(`Supabase DELETE failed for ${tableName}:`, error.message);
      }
    } catch (err: any) {
      console.error(`Supabase DELETE exception for ${tableName}:`, err.message);
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
    const idx = this.data.profiles.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      const original = this.data.profiles[idx];
      const merged = { ...original, ...updated };
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
}

export const db = new Database();
