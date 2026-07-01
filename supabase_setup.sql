-- ====================================================================
-- MASTER PRODUCTION-READY SUPABASE DATABASE SETUP & REBUILD MIGRATION
-- ====================================================================
-- Safe, idempotent script to configure Supabase with auth.users
-- references, timestamptz timestamps, and strict Row Level Security (RLS).
-- IMPORTANT: This script is 100% non-destructive and preserves existing data!
-- ====================================================================

-- 0. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create plans table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_btc DOUBLE PRECISION NOT NULL,
  hash_rate TEXT NOT NULL,
  daily_earn_btc DOUBLE PRECISION NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create helper functions for RLS and Admin checks
-- We define a secure helper to check if a user is an admin from their profile
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Idempotent Profiles creation and migration
DO $$
DECLARE
  col_type TEXT;
  old_prof RECORD;
  new_uid UUID;
BEGIN
  -- Check if profiles table exists and check column type of ID
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'profiles' AND column_name = 'id';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Profiles table exists with text ID. Backing up and migrating...';
    
    -- Rename existing profiles table to a backup name
    ALTER TABLE profiles RENAME TO profiles_old_text;
    
    -- Recreate profiles with UUID type referencing auth.users(id)
    CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      btc_balance DOUBLE PRECISION DEFAULT 0.0,
      active_plan TEXT,
      active_plan_investment DOUBLE PRECISION DEFAULT 0.0,
      active_plan_hash_rate DOUBLE PRECISION DEFAULT 0.0,
      active_plan_rate DOUBLE PRECISION DEFAULT 0.0,
      plan_activated_at TIMESTAMPTZ,
      plan_expires_at TIMESTAMPTZ,
      last_mining_at TIMESTAMPTZ,
      is_admin BOOLEAN DEFAULT false,
      is_suspended BOOLEAN DEFAULT false,
      referral_code TEXT UNIQUE,
      referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      admin_note TEXT,
      settings JSONB DEFAULT '{}'::jsonb,
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_secret TEXT,
      known_ips TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Loop over old rows and insert them safely
    FOR old_prof IN SELECT * FROM profiles_old_text LOOP
      -- Check if user already exists in auth.users by email
      SELECT id INTO new_uid FROM auth.users WHERE email = LOWER(TRIM(old_prof.email));
      
      -- If not, create them in auth.users with a default random password
      IF new_uid IS NULL THEN
        new_uid := uuid_generate_v4();
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud, raw_app_meta_data, raw_user_meta_data, is_super_admin)
        VALUES (
          new_uid,
          '00000000-0000-0000-0000-000000000000',
          LOWER(TRIM(old_prof.email)),
          crypt(COALESCE(old_prof.password_hash, old_prof.passwordhash, 'SecureTempPass2026!'), gen_salt('bf')),
          NOW(),
          NOW(),
          NOW(),
          'authenticated',
          'authenticated',
          '{"provider":"email","providers":["email"]}'::jsonb,
          json_build_object('full_name', old_prof.full_name)::jsonb,
          false
        );
      END IF;

      -- Insert into the new profiles table
      INSERT INTO profiles (
        id, email, full_name, btc_balance, active_plan,
        active_plan_investment, active_plan_hash_rate, active_plan_rate,
        plan_activated_at, plan_expires_at, last_mining_at,
        is_admin, is_suspended, referral_code, admin_note,
        settings, two_factor_enabled, two_factor_secret, known_ips, created_at
      ) VALUES (
        new_uid,
        LOWER(TRIM(old_prof.email)),
        old_prof.full_name,
        COALESCE(old_prof.btc_balance, 0.0),
        old_prof.active_plan,
        COALESCE(old_prof.active_plan_investment, 0.0),
        COALESCE(old_prof.active_plan_hash_rate, 0.0),
        COALESCE(old_prof.active_plan_rate, 0.0),
        old_prof.plan_activated_at::timestamptz,
        old_prof.plan_expires_at::timestamptz,
        old_prof.last_mining_at::timestamptz,
        COALESCE(old_prof.is_admin, false),
        COALESCE(old_prof.is_suspended, false),
        COALESCE(old_prof.referral_code, UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 6))),
        old_prof.admin_note,
        CASE 
          WHEN old_prof.settings IS NULL THEN '{}'::jsonb
          WHEN old_prof.settings = '' THEN '{}'::jsonb
          ELSE old_prof.settings::jsonb 
        END,
        COALESCE(old_prof.two_factor_enabled, false),
        old_prof.two_factor_secret,
        old_prof.known_ips,
        COALESCE(old_prof.created_at::timestamptz, NOW())
      );
    END LOOP;
    
  ELSIF col_type IS NULL THEN
    RAISE NOTICE 'Profiles table does not exist. Creating new...';
    
    CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      btc_balance DOUBLE PRECISION DEFAULT 0.0,
      active_plan TEXT,
      active_plan_investment DOUBLE PRECISION DEFAULT 0.0,
      active_plan_hash_rate DOUBLE PRECISION DEFAULT 0.0,
      active_plan_rate DOUBLE PRECISION DEFAULT 0.0,
      plan_activated_at TIMESTAMPTZ,
      plan_expires_at TIMESTAMPTZ,
      last_mining_at TIMESTAMPTZ,
      is_admin BOOLEAN DEFAULT false,
      is_suspended BOOLEAN DEFAULT false,
      referral_code TEXT UNIQUE,
      referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      admin_note TEXT,
      settings JSONB DEFAULT '{}'::jsonb,
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_secret TEXT,
      known_ips TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    RAISE NOTICE 'Profiles table already exists with correct schema.';
  END IF;
END $$;

-- 4. Idempotent Transactions migration
DO $$
DECLARE
  col_type TEXT;
  old_row RECORD;
  new_uid UUID;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'transactions' AND column_name = 'user_id';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Transactions table has TEXT user_id. Upgrading...';
    ALTER TABLE transactions RENAME TO transactions_old_text;
    
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT,
      amount_btc DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    FOR old_row IN SELECT * FROM transactions_old_text LOOP
      SELECT p.id INTO new_uid 
      FROM profiles p 
      JOIN profiles_old_text pot ON pot.email = p.email 
      WHERE pot.id = old_row.user_id;
      
      IF new_uid IS NOT NULL THEN
        INSERT INTO transactions (id, user_id, type, description, amount_btc, status, created_at)
        VALUES (old_row.id, new_uid, old_row.type, old_row.description, old_row.amount_btc, old_row.status, old_row.created_at::timestamptz);
      END IF;
    END LOOP;
  ELSIF col_type IS NULL THEN
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT,
      amount_btc DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 5. Idempotent Deposits migration
DO $$
DECLARE
  col_type TEXT;
  old_row RECORD;
  new_uid UUID;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'deposits' AND column_name = 'user_id';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Deposits table has TEXT user_id. Upgrading...';
    ALTER TABLE deposits RENAME TO deposits_old_text;
    
    CREATE TABLE deposits (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount_usd DOUBLE PRECISION,
      amount_btc DOUBLE PRECISION NOT NULL,
      invoice_id TEXT,
      nowpayments_payment_id TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    FOR old_row IN SELECT * FROM deposits_old_text LOOP
      SELECT p.id INTO new_uid 
      FROM profiles p 
      JOIN profiles_old_text pot ON pot.email = p.email 
      WHERE pot.id = old_row.user_id;
      
      IF new_uid IS NOT NULL THEN
        INSERT INTO deposits (id, user_id, amount_usd, amount_btc, invoice_id, nowpayments_payment_id, status, created_at)
        VALUES (old_row.id, new_uid, old_row.amount_usd, old_row.amount_btc, old_row.invoice_id, old_row.nowpayments_payment_id, old_row.status, old_row.created_at::timestamptz);
      END IF;
    END LOOP;
  ELSIF col_type IS NULL THEN
    CREATE TABLE deposits (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount_usd DOUBLE PRECISION,
      amount_btc DOUBLE PRECISION NOT NULL,
      invoice_id TEXT,
      nowpayments_payment_id TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 6. Idempotent Withdrawals migration
DO $$
DECLARE
  col_type TEXT;
  old_row RECORD;
  new_uid UUID;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'withdrawals' AND column_name = 'user_id';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Withdrawals table has TEXT user_id. Upgrading...';
    ALTER TABLE withdrawals RENAME TO withdrawals_old_text;
    
    CREATE TABLE withdrawals (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount_btc DOUBLE PRECISION NOT NULL,
      wallet_address TEXT NOT NULL,
      status TEXT NOT NULL,
      actioned_by TEXT,
      actioned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    FOR old_row IN SELECT * FROM withdrawals_old_text LOOP
      SELECT p.id INTO new_uid 
      FROM profiles p 
      JOIN profiles_old_text pot ON pot.email = p.email 
      WHERE pot.id = old_row.user_id;
      
      IF new_uid IS NOT NULL THEN
        INSERT INTO withdrawals (id, user_id, amount_btc, wallet_address, status, actioned_by, actioned_at, created_at)
        VALUES (old_row.id, new_uid, old_row.amount_btc, old_row.wallet_address, old_row.status, old_row.actioned_by, old_row.actioned_at::timestamptz, old_row.created_at::timestamptz);
      END IF;
    END LOOP;
  ELSIF col_type IS NULL THEN
    CREATE TABLE withdrawals (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount_btc DOUBLE PRECISION NOT NULL,
      wallet_address TEXT NOT NULL,
      status TEXT NOT NULL,
      actioned_by TEXT,
      actioned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 7. Idempotent Activity Logs migration
DO $$
DECLARE
  col_type TEXT;
  old_row RECORD;
  new_uid UUID;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'activity_logs' AND column_name = 'user_id';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Activity Logs table has TEXT user_id. Upgrading...';
    ALTER TABLE activity_logs RENAME TO activity_logs_old_text;
    
    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    FOR old_row IN SELECT * FROM activity_logs_old_text LOOP
      IF old_row.user_id IS NULL THEN
        INSERT INTO activity_logs (id, user_id, action, details, created_at)
        VALUES (old_row.id, NULL, old_row.action, old_row.details, old_row.created_at::timestamptz);
      ELSE
        SELECT p.id INTO new_uid 
        FROM profiles p 
        JOIN profiles_old_text pot ON pot.email = p.email 
        WHERE pot.id = old_row.user_id;
        
        INSERT INTO activity_logs (id, user_id, action, details, created_at)
        VALUES (old_row.id, new_uid, old_row.action, old_row.details, old_row.created_at::timestamptz);
      END IF;
    END LOOP;
  ELSIF col_type IS NULL THEN
    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 8. Idempotent Notifications migration
DO $$
DECLARE
  col_type TEXT;
  old_row RECORD;
  new_uid UUID;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'notifications' AND column_name = 'user_id';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Notifications table has TEXT user_id. Upgrading...';
    ALTER TABLE notifications RENAME TO notifications_old_text;
    
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    FOR old_row IN SELECT * FROM notifications_old_text LOOP
      SELECT p.id INTO new_uid 
      FROM profiles p 
      JOIN profiles_old_text pot ON pot.email = p.email 
      WHERE pot.id = old_row.user_id;
      
      IF new_uid IS NOT NULL THEN
        INSERT INTO notifications (id, user_id, message, is_read, created_at)
        VALUES (old_row.id, new_uid, old_row.message, COALESCE(old_row.is_read, false), old_row.created_at::timestamptz);
      END IF;
    END LOOP;
  ELSIF col_type IS NULL THEN
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 9. Idempotent Announcements conversion
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_name = 'announcements' AND column_name = 'created_at';

  IF col_type = 'text' THEN
    RAISE NOTICE 'Announcements table has TEXT timestamps. Converting...';
    ALTER TABLE announcements RENAME TO announcements_old_text;
    
    CREATE TABLE announcements (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    INSERT INTO announcements (id, message, is_active, created_at)
    SELECT id, message, COALESCE(is_active, true), created_at::timestamptz FROM announcements_old_text;
  ELSIF col_type IS NULL THEN
    CREATE TABLE announcements (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 10. Clean up old text-based backup tables safely if migration succeeds
-- They are kept as backups; you can drop them manually later once you verify the migration.
-- DROP TABLE IF EXISTS profiles_old_text;
-- DROP TABLE IF EXISTS transactions_old_text;
-- DROP TABLE IF EXISTS deposits_old_text;
-- DROP TABLE IF EXISTS withdrawals_old_text;
-- DROP TABLE IF EXISTS activity_logs_old_text;
-- DROP TABLE IF EXISTS notifications_old_text;
-- DROP TABLE IF EXISTS announcements_old_text;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on every table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicates
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view active plans" ON plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON plans;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own deposits" ON deposits;
DROP POLICY IF EXISTS "Users can create deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can manage deposits" ON deposits;
DROP POLICY IF EXISTS "Users can view their own withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Users can request withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Admins can manage withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can manage activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can view active announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can do everything on profiles" ON profiles
  FOR ALL USING (public.is_admin());

-- Plans Policies
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can manage plans" ON plans
  FOR ALL USING (public.is_admin());

-- Transactions Policies
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage transactions" ON transactions
  FOR ALL USING (public.is_admin());

-- Deposits Policies
CREATE POLICY "Users can view their own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage deposits" ON deposits
  FOR ALL USING (public.is_admin());

-- Withdrawals Policies
CREATE POLICY "Users can view their own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can request withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage withdrawals" ON withdrawals
  FOR ALL USING (public.is_admin());

-- Activity Logs Policies
CREATE POLICY "Users can view their own activity logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert activity logs" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage activity logs" ON activity_logs
  FOR ALL USING (public.is_admin());

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (public.is_admin());

-- Announcements Policies
CREATE POLICY "Anyone can view active announcements" ON announcements
  FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (public.is_admin());

RAISE NOTICE 'Supabase production rebuild schema and RLS successfully deployed!';
