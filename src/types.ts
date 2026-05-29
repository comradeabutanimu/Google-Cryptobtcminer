/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  btc_balance: number;
  active_plan: string | null;
  active_plan_investment?: number;
  active_plan_hash_rate?: number;
  active_plan_rate?: number;
  plan_activated_at?: string;
  plan_expires_at?: string;
  last_mining_at?: string;
  is_admin: boolean;
  is_suspended: boolean;
  referral_code: string;
  referred_by: string | null;
  admin_note: string | null;
  created_at: string;
  settings: ProfileSettings;
  two_factor_enabled?: boolean;
  two_factor_secret?: string;
  detected_language?: string;
  known_ips?: string; // stringified list or comma-separated list of safe login IPs
}

export interface ProfileSettings {
  blurBalances: boolean;
  notifyDepositConfirm: boolean;
  notifyWithdrawUpdate: boolean;
  notifySecurityAlert: boolean;
  notifyPromotions: boolean;
  targetBtcPrice?: number | null;
  targetBtcPriceDirection?: 'above' | 'below' | null;
  targetBtcPriceTriggered?: boolean | null;
}

export interface Plan {
  id: string;
  name: string;
  price_btc: number;
  hash_rate: string;
  daily_earn_btc: number;
  duration_days: number;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'mining' | 'deposit' | 'withdrawal' | 'referral';
  description: string;
  amount_btc: number;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  amount_usd: number;
  amount_btc: number;
  invoice_id: string;
  nowpayments_payment_id: string;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount_btc: number;
  wallet_address: string;
  status: 'pending' | 'approved' | 'rejected';
  actioned_by: string | null;
  actioned_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string; // JSON string or text info
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export interface CoingeckoPrice {
  btc_usd: number;
  change_24h: number;
}
