/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { 
  Profile, Plan, Transaction, Deposit, Withdrawal, ActivityLog, Notification, Announcement 
} from '../src/types.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

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
    // Elevate the designated super-admin profile specifically
    if (profile.email.toLowerCase() === 'comradeabutanimu@gmail.com') {
      profile.is_admin = true;
    }
    this.data.profiles.push(profile);
    this.save();
  }

  public addTransaction(tx: Transaction) {
    this.data.transactions.push(tx);
    this.save();
  }

  public addDeposit(dep: Deposit) {
    this.data.deposits.push(dep);
    this.save();
  }

  public addWithdrawal(wd: Withdrawal) {
    this.data.withdrawals.push(wd);
    this.save();
  }

  public addActivityLog(log: ActivityLog) {
    this.data.activity_logs.push(log);
    this.save();
  }

  public addNotification(notif: Notification) {
    this.data.notifications.push(notif);
    this.save();
  }

  public addAnnouncement(ann: Announcement) {
    this.data.announcements.push(ann);
    this.save();
  }

  public updateProfile(updated: Profile) {
    const idx = this.data.profiles.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      const original = this.data.profiles[idx];
      this.data.profiles[idx] = { ...original, ...updated };
      this.save();
    }
  }

  public updatePlan(updated: Plan) {
    const idx = this.data.plans.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      this.data.plans[idx] = updated;
      this.save();
    }
  }

  public addPlan(plan: Plan) {
    this.data.plans.push(plan);
    this.save();
  }

  public updateWithdrawal(updated: Withdrawal) {
    const idx = this.data.withdrawals.findIndex(w => w.id === updated.id);
    if (idx !== -1) {
      this.data.withdrawals[idx] = updated;
      this.save();
    }
  }

  public updateDeposit(updated: Deposit) {
    const idx = this.data.deposits.findIndex(d => d.id === updated.id);
    if (idx !== -1) {
      this.data.deposits[idx] = updated;
      this.save();
    }
  }

  public updateAnnouncement(updated: Announcement) {
    const idx = this.data.announcements.findIndex(a => a.id === updated.id);
    if (idx !== -1) {
      this.data.announcements[idx] = updated;
      this.save();
    }
  }

  public deleteAnnouncement(id: string) {
    this.data.announcements = this.data.announcements.filter(a => a.id !== id);
    this.save();
  }
}

export const db = new Database();
