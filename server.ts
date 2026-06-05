/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { 
  Profile, Plan, Transaction, Deposit, Withdrawal, ActivityLog, Notification, Announcement 
} from './src/types.js';
import { generateSecret, verifyTOTP } from './server/totp.js';

// Configure Brevo REST API transactional email delivery service
const sendEmail = async (to: string, subject: string, htmlContent: string) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[BREVO ERROR] BREVO_API_KEY not configured');
    return { success: false, error: new Error('BREVO_API_KEY not configured') };
  }

  console.log(`[Brevo] Sending dispatch request to ${to} for "${subject}"`);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'CryptoBTC Miner',
          email: 'support@cyptobtcminer.com'
        },
        to: [
          {
            email: to
          }
        ],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[BREVO ERROR] API request failed with status ${response.status}:`, errText);
      return { success: false, error: new Error(`Brevo responded with status ${response.status}: ${errText}`) };
    }

    const data = await response.json() as { messageId?: string; message?: string };
    console.log(`[BREVO SUCCESS] Dispatched message to ${to}. Message ID: ${data.messageId || 'Success'}`);
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error(`[BREVO CRITICAL ERROR] Failed to send email via Brevo REST API:`, err.message || err);
    return { success: false, error: err };
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API CORS fallback (not strictly required since we proxy, but clean)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'src/assets/images/favicon_1779933297334.png'));
  });

  let cachedBtcPrice = 68420.0;
  let lastBtcFetchAt = 0;

  async function updateCachedBtcPrice() {
    const now = Date.now();
    
    // Main fetch: CoinGecko
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        if (data.bitcoin?.usd) {
          cachedBtcPrice = Number(data.bitcoin.usd);
          lastBtcFetchAt = now;
          console.log(`[BTC Price Core] Fetched from CoinGecko: $${cachedBtcPrice}`);
          return;
        }
      }
    } catch (e: any) {
      console.warn(`[BTC Price Core] CoinGecko fetch failed: ${e.message || e}`);
    }

    // Fallback 1: Blockchain.info Ticker
    try {
      const response = await fetch('https://blockchain.info/ticker');
      if (response.ok) {
        const data = await response.json();
        if (data.USD?.last) {
          cachedBtcPrice = Number(data.USD.last);
          lastBtcFetchAt = now;
          console.log(`[BTC Price Core] Fetched from Blockchain.info fallback: $${cachedBtcPrice}`);
          return;
        }
      }
    } catch (e: any) {
      console.warn(`[BTC Price Core] Blockchain.info fallback failed: ${e.message || e}`);
    }

    // Fallback 2: Coinbase Spot Price
    try {
      const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      if (response.ok) {
        const data = await response.json();
        if (data.data?.amount) {
          cachedBtcPrice = Number(data.data.amount);
          lastBtcFetchAt = now;
          console.log(`[BTC Price Core] Fetched from Coinbase fallback: $${cachedBtcPrice}`);
          return;
        }
      }
    } catch (e: any) {
      console.warn(`[BTC Price Core] Coinbase fallback failed: ${e.message || e}`);
    }

    console.log(`[BTC Price Core] Utilizing last known price: $${cachedBtcPrice}`);
  }

  function activateDynamicPlanForUser(user: any, amountUsd: number) {
    let planId = 'plan_starter';
    let rate = 0.015;
    let durationDays = 60;
    let hashRateGhs = Math.round(amountUsd);

    if (amountUsd >= 50000) {
      planId = 'plan_vip';
      rate = 0.05;
      durationDays = 180;
      hashRateGhs = Math.round(amountUsd / 3);
    } else if (amountUsd >= 10000) {
      planId = 'plan_pro';
      rate = 0.03;
      durationDays = 90;
      hashRateGhs = Math.round(amountUsd / 3);
    }

    user.active_plan = planId;
    user.active_plan_investment = amountUsd;
    user.active_plan_rate = rate;
    user.active_plan_hash_rate = hashRateGhs;
    user.plan_activated_at = new Date().toISOString();
    user.plan_expires_at = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    user.last_mining_at = new Date().toISOString();
    user.locked_capital = amountUsd;
    user.deposit_usd_value = amountUsd;
  }

  function creditReferralCommission(depositorId: string, amountUsd: number, amountBtc = 0) {
    const profiles = db.getProfiles();
    const depositor = profiles.find(p => p.id === depositorId);
    if (!depositor || !depositor.referred_by) {
      return;
    }

    const referrer = profiles.find(p => p.id === depositor.referred_by);
    if (!referrer) {
      return;
    }

    const btcPrice = cachedBtcPrice || 68420.0;
    let finalUsd = amountUsd;
    if (finalUsd <= 0 && amountBtc > 0) {
      finalUsd = Number((amountBtc * btcPrice).toFixed(2));
    }

    if (finalUsd <= 0) {
      return;
    }

    const commissionUsd = finalUsd * 0.10;
    const commissionBtc = Number((commissionUsd / btcPrice).toFixed(8));

    if (commissionBtc <= 0) {
      return;
    }

    referrer.btc_balance = Number((referrer.btc_balance + commissionBtc).toFixed(8));
    db.updateProfile(referrer);

    db.addTransaction({
      id: 'tx_ref_comm_' + Math.random().toString(36).substr(2, 9),
      user_id: referrer.id,
      type: 'referral',
      description: `Referral commission from ${depositor.full_name || depositor.email} ($${finalUsd} USDT deposit)`,
      amount_btc: commissionBtc,
      status: 'completed',
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: referrer.id,
      message: `You earned ${commissionBtc.toFixed(8)} BTC referral commission from your referral's deposit of $${finalUsd}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: referrer.id,
      action: 'Referral Commission Paid',
      details: `Earned ${commissionBtc} BTC commission from referral ${depositor.id} deposit of $${finalUsd} USD.`,
      created_at: new Date().toISOString()
    });

    console.log(`[Referral Engine] Credited ${commissionBtc} BTC referral commission to referrer ${referrer.email} for depositor ${depositor.email}'s deposit of $${finalUsd}`);
  }

  const processMining = (user: any) => {
    if (user.is_suspended) {
      return;
    }

    // Auto-detect and align active_plan based on locked_capital or deposit_usd_value if present
    const capitalDetect = Number(user.locked_capital || user.deposit_usd_value || 0);
    if (capitalDetect >= 50000 && user.active_plan !== 'plan_vip') {
      console.log(`[Mining Payout Engine] Auto-aligning user ${user.email} (${user.id}) to VIP plan based on locked capital of $${capitalDetect}`);
      activateDynamicPlanForUser(user, capitalDetect);
    } else if (capitalDetect >= 10000 && capitalDetect < 50000 && user.active_plan !== 'plan_pro') {
      console.log(`[Mining Payout Engine] Auto-aligning user ${user.email} (${user.id}) to Pro plan based on locked capital of $${capitalDetect}`);
      activateDynamicPlanForUser(user, capitalDetect);
    } else if (capitalDetect >= 500 && capitalDetect < 10000 && !user.active_plan) {
      console.log(`[Mining Payout Engine] Auto-aligning user ${user.email} (${user.id}) to Starter plan based on locked capital of $${capitalDetect}`);
      activateDynamicPlanForUser(user, capitalDetect);
    }

    if (!user.active_plan) {
      return;
    }

    const now = Date.now();

    // 1. Calculate profit based on the user's actual deposited USD amount stored in locked_capital or deposit_usd_value field (or active_plan_investment or fallback values)
    let usdAmount = Number(user.locked_capital || user.deposit_usd_value || user.active_plan_investment || 0);
    
    // Fallback based on plan if usdAmount is 0/undefined
    if (usdAmount <= 0) {
      if (user.active_plan === 'plan_starter') {
        usdAmount = 500;
      } else if (user.active_plan === 'plan_pro') {
        usdAmount = 10000;
      } else if (user.active_plan === 'plan_vip') {
        usdAmount = 50000;
      }
    }

    // Use the actual plan rate (VIP=5%, Pro=3%, Starter=1.5%)
    let dailyReturnRate = 0.015;
    if (user.active_plan === 'plan_vip') {
      dailyReturnRate = 0.05;
    } else if (user.active_plan === 'plan_pro') {
      dailyReturnRate = 0.03;
    } else if (user.active_plan === 'plan_starter') {
      dailyReturnRate = 0.015;
    } else if (user.active_plan_rate) {
      dailyReturnRate = user.active_plan_rate;
    }

    const dailyUsdProfit = usdAmount * dailyReturnRate;

    // Convert daily profit percentage to per-minute rate (divide by 1440 minutes in a day)
    const usdProfitPerMinute = dailyUsdProfit / 1440;

    // Convert USD profit to BTC using live CoinGecko price
    const btcPriceToUse = cachedBtcPrice || 68420.0;
    const btcProfitPerMinute = usdProfitPerMinute / btcPriceToUse;

    // Define expiry duration and dates
    if (!user.plan_activated_at) {
      user.plan_activated_at = user.created_at || new Date().toISOString();
    }
    if (!user.plan_expires_at) {
      const durationDays = user.active_plan === 'plan_starter' ? 60 : user.active_plan === 'plan_pro' ? 90 : 180;
      const planDurationMs = durationDays * 24 * 60 * 60 * 1000;
      const startMs = new Date(user.plan_activated_at).getTime();
      user.plan_expires_at = new Date(startMs + planDurationMs).toISOString();
    }
    if (!user.last_mining_at) {
      user.last_mining_at = user.plan_activated_at || new Date().toISOString();
    }

    const expiryTime = new Date(user.plan_expires_at).getTime();
    const lastTime = new Date(user.last_mining_at).getTime();

    if (lastTime >= expiryTime) {
      // Plan has expired already
      const planName = user.active_plan === 'plan_starter' ? 'Starter Plan' : user.active_plan === 'plan_pro' ? 'Pro Plan' : 'VIP Plan';
      user.active_plan = null;
      const lockedVal = Number(user.locked_capital || user.deposit_usd_value || 0);
      if (lockedVal > 0) {
        user.usd_balance = Number(((user.usd_balance || 0) + lockedVal).toFixed(2));
        user.locked_capital = 0;
        user.deposit_usd_value = 0;
        console.log(`[Mining Payout Engine] Unlocked $${lockedVal} USD during pre-expiration check.`);
      }
      db.updateProfile(user);
      return;
    }

    const activeEnd = Math.min(now, expiryTime);
    const elapsedMs = activeEnd - lastTime;

    if (elapsedMs > 0) {
      // Calculate how many minutes (or fractions) have elapsed
      const elapsedMinutes = elapsedMs / 60000.0;
      const earned = elapsedMinutes * btcProfitPerMinute;

      const planName = user.active_plan === 'plan_starter' ? 'Starter Plan' : user.active_plan === 'plan_pro' ? 'Pro Plan' : 'VIP Plan';

      console.log(`[Mining Engine Cycle] Processing payouts:`);
      console.log(` - User ID & Email: ${user.id} (${user.email})`);
      console.log(` - Active Plan: ${user.active_plan} (${planName})`);
      console.log(` - Locked Capital: $${usdAmount} USD (Field sources: locked_capital=${user.locked_capital || 'null'}, deposit_usd_value=${user.deposit_usd_value || 'null'}, active_plan_investment=${user.active_plan_investment || 'null'})`);
      console.log(` - BTC Price: $${btcPriceToUse}`);
      console.log(` - Calculated profit per minute: ${btcProfitPerMinute.toFixed(10)} BTC`);
      console.log(` - Elapsed milliseconds: ${elapsedMs} ms (${elapsedMinutes.toFixed(4)} minutes)`);
      console.log(` - Calculated earnings this cycle: ${earned.toFixed(10)} BTC`);

      if (earned >= 0.00000001) {
        user.btc_balance = Number((user.btc_balance + earned).toFixed(8));
        console.log(` -> SUCCESS: Credited ${earned.toFixed(8)} BTC to user balance. New Balance: ${user.btc_balance} BTC`);

        db.addTransaction({
          id: 'tx_pay_' + Math.random().toString(36).substr(2, 9),
          user_id: user.id,
          type: 'mining',
          description: `Cloud mining payout block term (${planName})`,
          amount_btc: Number(earned.toFixed(8)),
          status: 'completed',
          created_at: new Date(activeEnd).toISOString()
        });

        db.addNotification({
          id: 'not_m_' + Math.random().toString(36).substr(2, 9),
          user_id: user.id,
          message: `Cloud payout credited +${earned.toFixed(8)} BTC to your profile balance!`,
          is_read: false,
          created_at: new Date(activeEnd).toISOString()
        });

        // ONLY shift last_mining_at forward when an actual payout is credited!
        // This preserves the elapsed fractions of minutes/seconds across successive fast API polls!
        user.last_mining_at = new Date(activeEnd).toISOString();
      } else {
        console.log(` -> HOLD: Earning of ${earned.toFixed(12)} BTC is below the 1 satoshi minimum (0.00000001 BTC). Holding last_mining_at to accumulate on next cycle.`);
      }
    }

    // Turn off plan if we reached raw expiration
    if (now >= expiryTime) {
      const planName = user.active_plan === 'plan_starter' ? 'Starter Plan' : user.active_plan === 'plan_pro' ? 'Pro Plan' : 'VIP Plan';
      const durationDays = user.active_plan === 'plan_starter' ? 60 : user.active_plan === 'plan_pro' ? 90 : 180;
      user.active_plan = null;

      const lockedVal = Number(user.locked_capital || user.deposit_usd_value || 0);
      if (lockedVal > 0) {
        user.usd_balance = Number(((user.usd_balance || 0) + lockedVal).toFixed(2));
        user.locked_capital = 0;
        user.deposit_usd_value = 0;
        console.log(`[Mining Payout Engine] Unlocked $${lockedVal} USD upon expiration.`);
      }

      db.addNotification({
        id: 'not_exp_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        message: `Your cloud mining contract (${planName}) has reached its maturity term of ${durationDays} days and stopped. Buy a new contract to continue.`,
        is_read: false,
        created_at: new Date(expiryTime).toISOString()
      });

      db.addNotification({
        id: 'not_unlock_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        message: `Your deposit of of $${usdAmount} USDT has unlocked and is now available for withdrawal.`,
        is_read: false,
        created_at: new Date(expiryTime).toISOString()
      });

      db.addActivityLog({
        id: 'act_exp_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        action: 'Contract Expired',
        details: `Your cloud mining contract (${planName}) has expired after ${durationDays} days. Principal $${usdAmount} USD unlocked.`,
        created_at: new Date(expiryTime).toISOString()
      });
    }

    db.updateProfile(user);
  };

  // Simple Authenticator Middleware based on User Identification Header
  const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing session' });
    }
    const token = authHeader.split(' ')[1];
    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === token);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    if (user.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact customer services.' });
    }
    processMining(user);
    (req as any).user = user;
    next();
  };

  const adminAuthenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    authenticate(req, res, () => {
      const user = (req as any).user;
      if (!user.is_admin) {
        return res.status(403).json({ error: 'Forbidden: Admin access only' });
      }
      next();
    });
  };

  // --- PUBLIC API ENDPOINTS ---

  // BTC Market Rates Proxy (Utilizes standard neutral path to prevent client-side ad-blocks)
  app.get('/api/rates/btc', async (req, res) => {
    try {
      // Small timeout fetching to avoid stalling developer environment
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true', {
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (!response.ok) {
        throw new Error('CoinGecko server error');
      }
      const data = await response.json();
      res.json({
        btc_usd: data.bitcoin?.usd || 68420.0,
        change_24h: data.bitcoin?.usd_24h_change || 1.84
      });
    } catch (e) {
      // Fallback if CoinGecko is rate limited or offline
      res.json({
        btc_usd: 68420.0 + (Math.random() * 200 - 100),
        change_24h: 1.84
      });
    }
  });

  // OTP Pending Registries map
  const pendingRegistrations = new Map<string, { otp: string; data: any; expiresAt: number }>();
  const forgotPasswordOtps = new Map<string, { otp: string; expiresAt: number }>();
  const lastForgotPasswordRequest = new Map<string, number>();

  // Auth: Send Signup OTP
  app.post('/api/auth/send-otp', async (req, res) => {
    const { name, email, password, referralCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email and password are required' });
    }

    const profiles = db.getProfiles();
    const existing = profiles.find(p => p.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: 'An account with that email already exists' });
    }

    // Generate a secure 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in pending registrees memory map
    pendingRegistrations.set(email.toLowerCase().trim(), {
      otp,
      data: { name, email, password, referralCode },
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins expiry
    });

    console.log(`[AUTH CLIENT] Sent 6-digit registration OTP verification code to ${email}: ${otp}`);

    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const logoUrl = `${baseUrl}/logo.png`;

    // High-contrast premium styled HTML Email template
    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #FAFAF9; color: #1C1917;">
        <div style="background-color: #0C0A09; padding: 30px; border-radius: 20px; text-align: center; border: 1px solid #27272A; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);">
          <div style="font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.025em; margin-bottom: 24px;">
            <img src="${logoUrl}" alt="" style="height: 32px; width: 32px; vertical-align: middle; margin-right: 12px; object-fit: contain;" />CRYPTO<span style="color: #F97316;">BTC</span>MINER
          </div>
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #A8A29E; margin-bottom: 12px;">
            Register Account Verification
          </div>
          <h1 style="font-size: 20px; font-weight: 500; color: #FFFFFF; margin: 0 0 24px 0; line-height: 1.4;">
            Hello ${name}, verify your registration to activate cloud mining.
          </h1>
          
          <div style="background-color: #1C1917; border: 1px solid #292524; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #78716C; margin-bottom: 8px;">
              Your 6-Digit Protection OTP
            </div>
            <div style="font-size: 40px; font-weight: 900; font-family: monospace; letter-spacing: 0.25em; color: #F97316; margin: 10px 0;">
              ${otp}
            </div>
            <div style="font-size: 12px; color: #A8A29E; margin-top: 8px;">
               Expires in exactly 15 minutes.
            </div>
          </div>
          
          <p style="font-size: 13px; color: #78716C; line-height: 1.6; margin: 0 0 24px 0;">
            This one-time authentication code is required to establish your secure digital wallet and startup terms. Please do not share this password with anyone. We will never ask you for this.
          </p>
          
          <div style="border-top: 1px solid #1C1917; padding-top: 20px; font-size: 11px; color: #57534E; line-height: 1.5;">
            If you did not initiate this activation request, please immediately ignore this message or report it directly to <a href="mailto:support@cryptobtcminer.com" style="color: #F97316; text-decoration: none;">support@cryptobtcminer.com</a>.
          </div>
        </div>
      </div>
    `;

    // Ensure email is sent immediately after user submits registration form with 3x retry mechanism
    let emailSent = false;
    let attemptsCount = 0;
    while (attemptsCount < 3) {
      attemptsCount++;
      console.log(`[SMTP] Registration verification email attempt ${attemptsCount}/3 for ${email}`);
      const stepRes = await sendEmail(email.toLowerCase().trim(), "Verify Your Crypto BTC Miner Registration", emailHtml);
      if (stepRes && stepRes.success) {
        emailSent = true;
        break;
      }
      if (attemptsCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    if (!emailSent) {
      return res.status(500).json({ 
        error: 'Failed to send verification email. Please check your email address or try again.' 
      });
    }

    res.json({ 
      success: true, 
      message: `Verification email sent to ${email.toLowerCase().trim()}`, 
      email: email.toLowerCase().trim()
    });

  });

  // Auth: Verify Signup OTP & Complete Account Creation
  app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit OTP code are required' });
    }

    const emailKey = email.toLowerCase().trim();
    const record = pendingRegistrations.get(emailKey);
    if (!record) {
      return res.status(400).json({ error: 'No active registration OTP request found for this email. Please try again.' });
    }

    if (Date.now() > record.expiresAt) {
      pendingRegistrations.delete(emailKey);
      return res.status(400).json({ error: 'The 6-digit OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect verification OTP entered. Please try again.' });
    }

    // OTP is correct! Now create account using record data
    const { name, password, referralCode } = record.data;
    const profiles = db.getProfiles();
    
    // Safety check just in case someone registered in between
    const existing = profiles.find(p => p.email.toLowerCase() === emailKey);
    if (existing) {
      pendingRegistrations.delete(emailKey);
      return res.status(400).json({ error: 'An account with that email already exists' });
    }

    const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
    const refCode = Math.random().toString(36).substr(2, 6).toUpperCase();

    // Check referring
    let referredBy: string | null = null;
    if (referralCode) {
      const referrer = profiles.find(p => p.referral_code.toUpperCase() === referralCode.trim().toUpperCase());
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // New user plan: NO default active plan assigned (set to null)
    const newProfile: Profile & { passwordHash: string } = {
      id: userId,
      email: emailKey,
      full_name: name,
      btc_balance: 0.00000000,
      active_plan: null, // NO default active plan
      plan_activated_at: undefined,
      plan_expires_at: undefined,
      last_mining_at: undefined,
      is_admin: false,
      is_suspended: false,
      referral_code: refCode,
      referred_by: referredBy,
      admin_note: null,
      created_at: new Date().toISOString(),
      passwordHash: password,
      settings: {
        blurBalances: false,
        notifyDepositConfirm: true,
        notifyWithdrawUpdate: true,
        notifySecurityAlert: true,
        notifyPromotions: false
      }
    };

    // Credit referrer if code match
    if (referredBy) {
      const referrer = profiles.find(p => p.id === referredBy);
      if (referrer) {
        referrer.btc_balance += 10.00; // Credit 10 USDT
        db.updateProfile(referrer);

        db.addTransaction({
          id: 'tx_' + Math.random().toString(36).substr(2, 9),
          user_id: referrer.id,
          type: 'referral',
          description: `Referral bonus for inviting ${name}`,
          amount_btc: 10.00,
          status: 'completed',
          created_at: new Date().toISOString()
        });

        db.addNotification({
          id: 'not_' + Math.random().toString(36).substr(2, 9),
          user_id: referrer.id,
          message: `Congratulations! Referral bonus for inviting ${name} (+10.00 USDT) is credited.`,
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
    }

    db.addProfile(newProfile);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      action: 'Registration (OTP Verified)',
      details: `Account created and verified for ${emailKey}. Referred by code: ${referralCode || 'None'}. Plan state is inactive, ready to purchase.`,
      created_at: new Date().toISOString()
    });

    // Remove pending record once complete
    pendingRegistrations.delete(emailKey);

    // Dispatch a beautiful warm Welcome Email to the newly registered customer
    const welcomeDate = new Date();
    const formattedDate = welcomeDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const logoUrl = `${baseUrl}/logo.png`;

    const welcomeHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #FAFAF9; color: #1C1917;">
        <div style="background-color: #0C0A09; padding: 40px 30px; border-radius: 24px; border: 1px solid #27272A; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3); text-align: left;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.025em; margin-bottom: 8px;">
              <img src="${logoUrl}" alt="" style="height: 32px; width: 32px; vertical-align: middle; margin-right: 12px; object-fit: contain;" />CRYPTO<span style="color: #F97316;">BTC</span>MINER
            </div>
            <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #F97316;">
              Welcome to the Future of Cloud Mining
            </div>
          </div>

          <h2 style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 16px 0; border-bottom: 1px solid #1C1917; padding-bottom: 12px;">
            Hello ${name},
          </h2>
          
          <p style="font-size: 15px; color: #D6D3D1; line-height: 1.6; margin: 0 0 20px 0;">
            A warm welcome to <strong>Crypto BTC Miner</strong>! We are absolutely thrilled to have you join our premier global cloud mining network. Your account is now fully verified, active, and your free high-performance 10 GH/s starter mining contract is automatically online.
          </p>

          <div style="background-color: #151414; border: 1px solid #292421; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #8C8A88; margin-bottom: 12px; border-bottom: 1px solid #292421; padding-bottom: 6px;">
              ACCOUNT INFORMATION DETAILED REGISTER
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #E7E5E4;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #A8A29E; width: 140px;">Username / Name:</td>
                <td style="padding: 6px 0; font-weight: 500;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #A8A29E;">Registered Email:</td>
                <td style="padding: 6px 0; font-weight: 500; font-family: monospace;">${emailKey}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #A8A29E;">Creation Date:</td>
                <td style="padding: 6px 0; font-weight: 500;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #A8A29E;">Account Status:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #10B981;">ACTIVE & SECURED</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #A8A29E; line-height: 1.6; margin: 0 0 16px 0; padding-left: 4px; border-left: 3px solid #F97316;">
            <strong>Security Reminder:</strong> To preserve maximum safety of your portfolio, your secure password is <strong>not</strong> displayed in this email. Please make sure to treat your credentials with absolute discretion and keep them private.
          </p>

          <h3 style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin: 24px 0 12px 0;">
            Steps to Begin Mining Operations:
          </h3>
          <ol style="font-size: 14px; color: #D6D3D1; line-height: 1.6; margin: 0 0 24px 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;"><strong>Sign In:</strong> Navigate to the <a href="https://cryptobtcminer.com" style="color: #F97316; text-decoration: underline;">Crypto BTC Miner Login Portal</a>.</li>
            <li style="margin-bottom: 8px;"><strong>Use Credentials:</strong> Input your registered email address (<code>${emailKey}</code>) and your selected secure password.</li>
            <li style="margin-bottom: 8px;"><strong>Explore Contracts:</strong> Boost your active hashing throughput under the 'Mining Plans' panel to accelerate your daily BTC earnings.</li>
            <li style="margin-bottom: 8px;"><strong>Setup 2FA:</strong> Enable Two-Factor Authentication under the 'Settings' tab to enforce bank-grade protection over your fund withdrawals.</li>
          </ol>

          <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="https://cryptobtcminer.com/login" style="background-color: #F97316; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2); transition: all 0.2s ease;">
              Access Mining Dashboard →
            </a>
          </div>

          <div style="border-top: 1px solid #1C1917; margin-top: 30px; padding-top: 20px; font-size: 11px; color: #57534E; line-height: 1.5; text-align: center;">
            Need help? Reach out directly via our real-time in-app Tidio Chat or contact elite engineering operations at <a href="mailto:support@cryptobtcminer.com" style="color: #F97316; text-decoration: none;">support@cryptobtcminer.com</a>.
          </div>
        </div>
      </div>
    `;

    // Dispatch the welcome email asynchronously
    sendEmail(emailKey, "Successful Registration - Welcome to Crypto BTC Miner", welcomeHtml).catch(err => {
      console.error('Error sending welcome email to user:', err);
    });

    res.json({ token: userId, profile: newProfile });
  });

  // Backend helper for capturing IP, looking up location, sending notification alerts and recording trusted IPs
  const processUserLoginSecurity = async (req: express.Request, user: any) => {
    const clientIp = (req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || 'Unknown Browser / Device';
    
    let country = 'United Kingdom';
    let city = 'London';
    let countryCode = 'GB';

    try {
      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && !clientIp.startsWith('::ffff:')) {
        const gRes = await fetch(`https://ipapi.co/${clientIp}/json/`).catch(() => null);
        if (gRes && gRes.ok) {
          const data = await gRes.json();
          if (data && !data.error) {
            country = data.country_name || 'Unknown Country';
            city = data.city || 'Unknown City';
            countryCode = data.country || 'GB';
          }
        } else {
          const gRes2 = await fetch(`http://ip-api.com/json/${clientIp}`).catch(() => null);
          if (gRes2 && gRes2.ok) {
            const data2 = await gRes2.json();
            if (data2 && data2.status === 'success') {
              country = data2.country || 'Unknown Country';
              city = data2.city || 'Unknown City';
              countryCode = data2.countryCode || 'GB';
            }
          }
        }
      }
    } catch (err) {
      console.warn('[GEOLOCATION] Geocoding lookup failed for IP:', clientIp, err);
    }

    let knownIpsList: string[] = [];
    if (user.known_ips) {
      try {
        knownIpsList = JSON.parse(user.known_ips);
      } catch (_) {
        knownIpsList = user.known_ips.split(',').map((ip: string) => ip.trim()).filter(Boolean);
      }
    }

    const isNewIp = knownIpsList.length > 0 && !knownIpsList.includes(clientIp);

    if (isNewIp) {
      const lockLink = `${req.protocol}://${req.get('host')}/api/auth/lock-account?user_id=${user.id}`;
      const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #FAFAF9; color: #1C1917;">
          <div style="background-color: #0C0A09; padding: 40px 30px; border-radius: 24px; border: 1px solid #EF4444; box-shadow: 0 10px 30px -10px rgba(239, 68, 68, 0.2); text-align: left;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
              <div style="font-size: 24px; font-weight: 800; color: #EF4444; letter-spacing: -0.025em; margin-bottom: 6px;">
                UNKNOWN IP ADDRESS LOGIN ALERT
              </div>
              <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #EF4444;">
                Security Monitoring Service
              </div>
            </div>

            <p style="font-size: 15px; color: #D6D3D1; line-height: 1.6; margin: 0 0 20px 0;">
              Hello ${user.full_name || 'Member'},
            </p>

            <p style="font-size: 15px; color: #D6D3D1; line-height: 1.6; margin: 0 0 20px 0;">
              We detected a successful login to your <strong>Crypto BTC Miner</strong> profile from an unrecognized IP address. To preserve your portfolio, please verify if this request is yours:
            </p>

            <div style="background-color: #151414; border: 1px solid #292421; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #EF4444; margin-bottom: 12px; border-bottom: 1px solid #292421; padding-bottom: 6px;">
                LOG DETAILS REGISTER
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #E7E5E4;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #A8A29E; width: 140px;">Estimated Location:</td>
                  <td style="padding: 6px 0; font-weight: 500; color: #FFFFFF;">${city}, ${country}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #A8A29E;">IP Address:</td>
                  <td style="padding: 6px 0; font-weight: 500; font-family: monospace; color: #FFFFFF;">${clientIp}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #A8A29E;">Device / Browser:</td>
                  <td style="padding: 6px 0; font-weight: 500;">${userAgent}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #A8A29E;">Access Date:</td>
                  <td style="padding: 6px 0; font-weight: 500;">${formattedDate}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #1C1917; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
              <h4 style="margin: 0 0 8px 0; color: #EF4444; font-size: 14px; font-weight: bold;">Did you NOT authorize this action?</h4>
              <p style="margin: 0; color: #A8A29E; font-size: 13px; line-height: 1.5;">
                If this login was not triggered by you, someone else might have gained access to your credentials. Your funds are at risk. Please lock your account immediately to block any withdrawal activities.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${lockLink}" style="background-color: #EF4444; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); transition: all 0.2s ease;">
                🔒 This Wasn't Me - Lock My Account Now
              </a>
            </div>

            <div style="border-top: 1px solid #1C1917; margin-top: 30px; padding-top: 20px; font-size: 11px; color: #57534E; line-height: 1.5; text-align: center;">
              Crypto BTC Miner, Global Cyber-Security Desk. Contact support at <a href="mailto:support@cryptobtcminer.com" style="color: #F97316; text-decoration: none;">support@cryptobtcminer.com</a>
            </div>
          </div>
        </div>
      `;

      sendEmail(user.email, `⚠️ New login to your account from ${city}, ${country}`, emailHtml).catch(err => {
        console.error('[SMTP ALERT ERROR] Failed to dispatch login alert:', err);
      });

      db.addNotification({
        id: 'not_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        message: `Security warning trigger: We detected a login from an unknown location (${city}, ${country}). An alert mail has been dispatched.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    if (!knownIpsList.includes(clientIp)) {
      knownIpsList.push(clientIp);
      user.known_ips = JSON.stringify(knownIpsList);
      if (!user.detected_language) {
        const langMapping: Record<string, string> = {
          'SA': 'ar', 'AE': 'ar', 'QA': 'ar', 'EG': 'ar', 'DZ': 'ar', 'JO': 'ar', 'LB': 'ar', 'OM': 'ar', 'YE': 'ar', 'IQ': 'ar', 'KW': 'ar', 'BH': 'ar',
          'FR': 'fr', 'CA': 'fr', 'CD': 'fr', 'CG': 'fr', 'CI': 'fr', 'SN': 'fr', 'NE': 'fr', 'ML': 'fr',
          'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es', 'VE': 'es',
          'PT': 'pt', 'BR': 'pt', 'AO': 'pt', 'MZ': 'pt',
          'CN': 'zh',
          'IN': 'hi',
          'RU': 'ru',
          'NG': 'en',
          'KE': 'sw', 'TZ': 'sw', 'UG': 'sw'
        };
        user.detected_language = langMapping[countryCode] || 'en';
      }
      db.updateProfile(user);
    }
  };

  // Lock account endpoint triggered directly by emails
  app.get('/api/auth/lock-account', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send('<h1>Error</h1><p>Invalid account identification link.</p>');
    }

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === user_id);

    if (!user) {
      return res.status(404).send('<h1>Error</h1><p>Account profile not found.</p>');
    }

    user.is_suspended = true;
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Account Locked Alert',
      details: 'Account secured and locked immediately via verification email links.',
      created_at: new Date().toISOString()
    });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Profile Secured - Crypto BTC Miner</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0C0A09; color: #FFFFFF; text-align: center; padding: 60px 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #1C1917; padding: 40px; border-radius: 20px; border: 1px solid #EF4444; box-shadow: 0 10px 40px rgba(239, 68, 68, 0.1); }
          h1 { color: #EF4444; font-size: 24px; margin-bottom: 16px; }
          p { color: #D6D3D1; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
          .badge { font-weight: bold; background: rgba(239, 68, 68, 0.2); color: #EF4444; padding: 8px 16px; border-radius: 9999px; display: inline-block; margin-bottom: 20px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
          .support { font-size: 13px; color: #78716C; margin-top: 30px; border-top: 1px solid #2E2A27; padding-top: 20px; }
          a { color: #F97316; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="font-size: 50px; margin-bottom: 12px;">🔒</div>
          <div class="badge">Profile Locked & Secured</div>
          <h1>Account Locked Successfully</h1>
          <p>The profile <strong>${user.email}</strong> is now locked. All active logins are neutralized, and further cloud withdrawals have been deactivated automatically to secure your assets.</p>
          <p>Please reset your email password and contact support to re-verify identity.</p>
          <div class="support">
            Need assistance? Reach operations immediately at <a href="mailto:support@cryptobtcminer.com">support@cryptobtcminer.com</a>.
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Auth: Register (Disabled directly - must go through OTP send/verify)
  app.post('/api/auth/signup', (req, res) => {
    return res.status(400).json({ error: 'Direct registration is disabled. Please verify your email with a 6-digit OTP code to complete account creation.' });
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
    
    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact customer services.' });
    }

    // Toggle 2FA gate if enabled
    if (user.two_factor_enabled) {
      return res.json({ require_2fa: true, email: user.email });
    }

    await processUserLoginSecurity(req, user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Login',
      details: 'Logged into the system successfully.',
      created_at: new Date().toISOString()
    });

    res.json({ token: user.id, profile: user });
  });

  // Verify dynamic 2FA Login Form
  app.post('/api/auth/verify-2fa-login', async (req, res) => {
    const { email, password, code } = req.body;
    if (!email || !password || !code) {
      return res.status(400).json({ error: 'Email, password, and 2FA verification code are required.' });
    }

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: 'Incorrect email or password credentials' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact customer services.' });
    }

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Two-Factor Authentication is not activated on this profile.' });
    }

    const isValid = verifyTOTP(code, user.two_factor_secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit authentication code. Please check your app.' });
    }

    await processUserLoginSecurity(req, user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: '2FA Login',
      details: 'Passed 2FA safety gate and completed login sequence safely.',
      created_at: new Date().toISOString()
    });

    res.json({ token: user.id, profile: user });
  });

  // OTP-based Forgot Password recovery trigger
  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    const emailKey = email.toLowerCase().trim();
    const profiles = db.getProfiles();
    const user = profiles.find(p => p.email.toLowerCase() === emailKey);
    
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact customer services.' });
    }

    // Cooldown timer (5 minutes) check
    const lastRequest = lastForgotPasswordRequest.get(emailKey);
    const now = Date.now();
    if (lastRequest && (now - lastRequest < 300000)) {
      const remainingBytes = 300000 - (now - lastRequest);
      const remainingSecs = Math.ceil(remainingBytes / 1000);
      const remainingMins = Math.floor(remainingSecs / 60);
      const remainingSecsMod = remainingSecs % 60;
      
      let waitString = '';
      if (remainingMins > 0) {
        waitString = `${remainingMins}m ${remainingSecsMod}s`;
      } else {
        waitString = `${remainingSecsMod}s`;
      }
      return res.status(429).json({ error: `Please wait ${waitString} before requesting another code.` });
    }

    // Set last request timestamp
    lastForgotPasswordRequest.set(emailKey, now);

    // Generate 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    forgotPasswordOtps.set(emailKey, {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins expiry
    });

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Forgot Password OTP Requested',
      details: 'Requested security modification validation code.',
      created_at: new Date().toISOString()
    });

    console.log(`[AUTH CLIENT] Sent 6-digit password reset OTP verification code to ${email}: ${otp}`);

    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const logoUrl = `${baseUrl}/logo.png`;

    // High-contrast premium styled HTML Email template
    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #FAFAF9; color: #1C1917;">
        <div style="background-color: #0C0A09; padding: 30px; border-radius: 20px; text-align: center; border: 1px solid #27272A; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);">
          <div style="font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.025em; margin-bottom: 24px;">
            <img src="${logoUrl}" alt="" style="height: 32px; width: 32px; vertical-align: middle; margin-right: 12px; object-fit: contain;" />CRYPTO<span style="color: #F97316;">BTC</span>MINER
          </div>
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #A8A29E; margin-bottom: 12px;">
            Security Recovery Code
          </div>
          <h1 style="font-size: 20px; font-weight: 500; color: #FFFFFF; margin: 0 0 24px 0; line-height: 1.4;">
            Did you request a password reset for your cloud mining account?
          </h1>
          
          <div style="background-color: #1C1917; border: 1px solid #292524; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #78716C; margin-bottom: 8px;">
              Your 6-Digit Password Reset OTP
            </div>
            <div style="font-size: 40px; font-weight: 900; font-family: monospace; letter-spacing: 0.25em; color: #F97316; margin: 10px 0;">
              ${otp}
            </div>
            <div style="font-size: 12px; color: #A8A29E; margin-top: 8px;">
              Expires in exactly 15 minutes.
            </div>
          </div>
          
          <p style="font-size: 13px; color: #78716C; line-height: 1.6; margin: 0 0 24px 0;">
            Use the security password reset token above to update your security credentials. If you did not initiate this change yourself, someone may be trying to access your miner profile.
          </p>
          
          <div style="border-top: 1px solid #1C1917; padding-top: 20px; font-size: 11px; color: #57534E; line-height: 1.5;">
            To secure your account immediately, do not verify or register this code, and reach out to our emergency support operations at <a href="mailto:support@cryptobtcminer.com" style="color: #F97316; text-decoration: none;">support@cryptobtcminer.com</a>.
          </div>
        </div>
      </div>
    `;

    // Ensure reset email is sent immediately on form submission with up to 3x retry mechanism
    let emailSent = false;
    let attemptsCount = 0;
    while (attemptsCount < 3) {
      attemptsCount++;
      console.log(`[SMTP] Forgot password reset attempt ${attemptsCount}/3 for ${emailKey}`);
      const stepRes = await sendEmail(emailKey, "Reset Your Crypto BTC Cloud Password", emailHtml);
      if (stepRes && stepRes.success) {
        emailSent = true;
        break;
      }
      if (attemptsCount < 3) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    if (!emailSent) {
      return res.status(500).json({ error: 'Could not send reset email. Please try again.' });
    }

    res.json({ 
      success: true, 
      message: `Password reset link sent to ${emailKey}`, 
      email: emailKey
    });

  });

  // Password reset execution using 6-digit OTP
  app.post('/api/auth/reset-password', (req, res) => {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, verification code and new password are required.' });
    }
    
    const emailKey = email.toLowerCase().trim();
    const record = forgotPasswordOtps.get(emailKey);
    if (!record) {
      return res.status(400).json({ error: 'No active password recovery request found for this email address. Please request a new OTP.' });
    }

    if (Date.now() > record.expiresAt) {
      forgotPasswordOtps.delete(emailKey);
      return res.status(400).json({ error: 'The verification OTP has expired. Please request a new OTP.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid verification OTP code. Please check and try again.' });
    }

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.email.toLowerCase() === emailKey);
    if (!user) {
      forgotPasswordOtps.delete(emailKey);
      return res.status(404).json({ error: 'Recovery validation failed: associated account is missing.' });
    }

    user.passwordHash = password;
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Password Reset Completed',
      details: 'Security credentials updated securely via verified password-reset OTP.',
      created_at: new Date().toISOString()
    });

    // Clear verification map record
    forgotPasswordOtps.delete(emailKey);

    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const logoUrl = `${baseUrl}/logo.png`;

    // Send security notification email to confirm password update
    const resetSuccessHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #FAFAF9; color: #1C1917;">
        <div style="background-color: #0C0A09; padding: 40px 30px; border-radius: 24px; border: 1px solid #27272A; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3); text-align: left;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.025em; margin-bottom: 8px;">
              <img src="${logoUrl}" alt="" style="height: 32px; width: 32px; vertical-align: middle; margin-right: 12px; object-fit: contain;" />CRYPTO<span style="color: #F97316;">BTC</span>MINER
            </div>
            <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #F97316;">
              Security Confirmation Notification
            </div>
          </div>

          <h2 style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 16px 0; border-bottom: 1px solid #1C1917; padding-bottom: 12px;">
            Secure Update Completed,
          </h2>
          
          <p style="font-size: 15px; color: #D6D3D1; line-height: 1.6; margin: 0 0 20px 0;">
            This notification confirms that the password associated with your account <strong>${emailKey}</strong> has been successfully updated on <strong>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</strong>.
          </p>

          <p style="font-size: 14px; color: #A8A29E; line-height: 1.6; margin: 0 0 20px 0;">
            Your new credentials are fully active. For security policy reasons, the email does <strong>not</strong> contain your new password. You can now securely log in to your active mining dashboard using your new password.
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://cryptobtcminer.com/login" style="background-color: #F97316; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 12px; display: inline-block;">
              Go to Login Page
            </a>
          </div>

          <div style="background-color: #1C1917; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px; margin-top: 24px;">
            <h4 style="margin: 0 0 8px 0; color: #EF4444; font-size: 14px; font-weight: bold;">Did you not request this password change?</h4>
            <p style="margin: 0; color: #A8A29E; font-size: 13px; line-height: 1.5;">
              If you did NOT trigger or authorize this credentials modification, your profile security could be compromised. Please immediately reset your email password and contact our elite emergency response desk at <a href="mailto:support@cryptobtcminer.com" style="color: #F97316; text-decoration: none; font-weight: bold;">support@cryptobtcminer.com</a>.
            </p>
          </div>

          <div style="border-top: 1px solid #1C1917; margin-top: 30px; padding-top: 20px; font-size: 11px; color: #57534E; line-height: 1.5; text-align: center;">
            Crypto BTC Miner, Security Operations Team.
          </div>
        </div>
      </div>
    `;

    sendEmail(emailKey, "Password Reset Confirmed - Crypto BTC Miner", resetSuccessHtml).catch(err => {
      console.error('Error sending reset confirmation email:', err);
    });

    res.json({ success: true, message: 'Password updated successfully. You can now login.' });
  });

  // Get active plans list
  app.get('/api/plans', (req, res) => {
    res.json(db.getPlans().filter(p => p.is_active));
  });

  // --- MEMEBER PROTECTED ENDPOINTS ---

  // Get self profile
  app.get('/api/user/profile', authenticate, (req, res) => {
    res.json((req as any).user);
  });

  // Save manually updated language to user profile
  app.post('/api/user/language', authenticate, (req, res) => {
    const user = (req as any).user;
    const { language } = req.body;
    if (language) {
      user.detected_language = language;
      db.updateProfile(user);
    }
    res.json({ success: true, profile: user });
  });

  // Activate/purchase a plan directly using balance or activate the Free plan
  app.post('/api/user/plan/activate', authenticate, async (req, res) => {
    const user = (req as any).user;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const plans = db.getPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan || !plan.is_active) {
      return res.status(404).json({ error: 'Active plan not found' });
    }

    if (plan.price_btc === 0) {
      user.active_plan = plan.id;
      user.plan_activated_at = new Date().toISOString();
      user.plan_expires_at = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
      user.last_mining_at = new Date().toISOString();
      db.updateProfile(user);

      db.addTransaction({
        id: 'tx_act_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        type: 'mining',
        description: `${plan.name} plan activated (hashpower online)`,
        amount_btc: 0,
        status: 'completed',
        created_at: new Date().toISOString()
      });

      db.addActivityLog({
        id: 'act_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        action: 'Plan Activated',
        details: `${plan.name} plan activated. Hash rate: ${plan.hash_rate}. Duration: ${plan.duration_days} days.`,
        created_at: new Date().toISOString()
      });

      return res.json({ success: true, profile: user, message: `${plan.name} miner has been successfully activated!` });
    } else {
      // Purchase with existing BTC balance
      // Let's get the standard BTC rate to convert USDT price to BTC balance deduction
      let btcUsdPrice = 68420.0;
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          btcUsdPrice = data.bitcoin?.usd || 68420.0;
        }
      } catch (err) {
        // ignore
      }

      const PriceInBtc = Number((plan.price_btc / btcUsdPrice).toFixed(8));

      if (user.btc_balance >= PriceInBtc) {
        user.btc_balance = Number((user.btc_balance - PriceInBtc).toFixed(8));
        
        // Properly set locked_capital, deposit_usd_value, and activate dynamic parameters for background mining
        user.locked_capital = Number(plan.price_btc);
        user.deposit_usd_value = Number(plan.price_btc);
        activateDynamicPlanForUser(user, plan.price_btc);
        
        db.updateProfile(user);

        db.addTransaction({
          id: 'tx_pay_' + Math.random().toString(36).substr(2, 9),
          user_id: user.id,
          type: 'deposit', // purchased contract
          description: `Bitcoin hash power purchase (${plan.name} Plan)`,
          amount_btc: -PriceInBtc,
          status: 'completed',
          created_at: new Date().toISOString()
        });

        db.addActivityLog({
          id: 'act_' + Math.random().toString(36).substr(2, 9),
          user_id: user.id,
          action: 'Contract Purchased',
          details: `Purchased ${plan.name} cloud mining contract for ${PriceInBtc.toFixed(8)} BTC. Duration: ${plan.duration_days} days.`,
          created_at: new Date().toISOString()
        });

        return res.json({ success: true, profile: user, message: `${plan.name} cloud miner successfully purchased using your BTC balance!` });
      } else {
        return res.status(400).json({ error: `Insufficient BTC balance to activate plan. Please deposit to your wallet or select a free option.` });
      }
    }
  });

  // Track profile configuration saves
  app.post('/api/user/profile/update', authenticate, (req, res) => {
    const user = (req as any).user as Profile;
    const { full_name, email, settings } = req.body;

    if (full_name) user.full_name = full_name;
    
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      if (!user.is_admin) {
        return res.status(403).json({ error: 'You are not allowed to change your email address. Please contact customer services.' });
      }
      const profiles = db.getProfiles();
      const existing = profiles.find(p => p.email.toLowerCase() === email.toLowerCase().trim() && p.id !== user.id);
      if (existing) {
        return res.status(400).json({ error: 'An account with that email already exists' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (settings) {
      user.settings = { ...user.settings, ...settings };
    }

    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Settings Updated',
      details: 'Redefined personal statistics or alert switches.',
      created_at: new Date().toISOString()
    });

    res.json({ profile: user });
  });

  // Security password rewrites from settings dashboard
  app.post('/api/user/change-password', authenticate, (req, res) => {
    const user = (req as any).user;
    const { currentPassword, newPassword } = req.body;
    if (user.passwordHash !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    user.passwordHash = newPassword;
    db.updateProfile(user);
    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Password Saved',
      details: 'User password rewritten.',
      created_at: new Date().toISOString()
    });
    res.json({ message: 'Password changed successfully.' });
  });

  // Generate 2FA Secret Key
  app.post('/api/user/generate-2fa', authenticate, (req, res) => {
    const user = (req as any).user;
    if (user.two_factor_enabled) {
      return res.status(400).json({ error: 'Two-Factor Authentication is already enabled on your account.' });
    }
    const secret = generateSecret(16);
    const otpauthUrl = `otpauth://totp/CryptoBTCMiner:${encodeURIComponent(user.email)}?secret=${secret}&issuer=CryptoBTC%20Miner`;
    res.json({ secret, otpauthUrl });
  });

  // Complete and Activate 2FA Security
  app.post('/api/user/enable-2fa', authenticate, (req, res) => {
    const user = (req as any).user;
    const { code, secret } = req.body;
    if (!code || !secret) {
      return res.status(400).json({ error: 'Verification code and secret key are required.' });
    }

    const isValid = verifyTOTP(code, secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code. Please synchronize or check your authenticator code.' });
    }

    user.two_factor_secret = secret;
    user.two_factor_enabled = true;
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: '2FA Enabled',
      details: 'Activated Two-Factor Authentication security protection on login.',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Deactivate 2FA Security
  app.post('/api/user/disable-2fa', authenticate, (req, res) => {
    const user = (req as any).user;
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required.' });
    }
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Two-Factor Authentication is not enabled on this profile.' });
    }

    const isValid = verifyTOTP(code, user.two_factor_secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit confirmation code. 2FA deactivation failed.' });
    }

    user.two_factor_secret = undefined;
    user.two_factor_enabled = false;
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: '2FA Disabled',
      details: 'Deactivated Two-Factor Authentication login safety layer.',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Get notifications
  app.get('/api/notifications', authenticate, (req, res) => {
    const user = (req as any).user;
    const notes = db.getNotifications().filter(n => n.user_id === user.id);
    res.json(notes.sort((a,b) => b.created_at.localeCompare(a.created_at)));
  });

  // Dismiss user notifications
  app.post('/api/notifications/read', authenticate, (req, res) => {
    const user = (req as any).user;
    const notes = db.getNotifications().filter(n => n.user_id === user.id);
    notes.forEach(n => { n.is_read = true; });
    db.save();
    res.json({ message: 'Notifications marked as read' });
  });

  // Core transaction tracking
  app.get('/api/transactions', authenticate, (req, res) => {
    const user = (req as any).user;
    const txs = db.getTransactions().filter(t => t.user_id === user.id);
    res.json(txs.sort((a,b) => b.created_at.localeCompare(a.created_at)));
  });

  // Active Logs list
  app.get('/api/activity-logs', authenticate, (req, res) => {
    const user = (req as any).user;
    const logs = db.getActivityLogs().filter(l => l.user_id === user.id);
    res.json(logs.sort((a,b) => b.created_at.localeCompare(a.created_at)));
  });

  // Referrals table
  app.get('/api/referrals', authenticate, (req, res) => {
    const user = (req as any).user;
    const profiles = db.getProfiles();
    const subReferrals = profiles.filter(p => p.referred_by === user.id);
    
    // total earned from referrals
    const txs = db.getTransactions().filter(t => t.user_id === user.id && t.type === 'referral');
    const totalEarned = txs.reduce((sum, current) => sum + current.amount_btc, 0);

    res.json({
      referral_code: user.referral_code,
      total_referral_count: subReferrals.length,
      total_earned_btc: totalEarned,
      referrals: subReferrals.map(p => ({
        name: p.full_name,
        email: p.email,
        date: p.created_at,
        status: p.active_plan ? 'Active Miner' : 'Registered'
      }))
    });
  });

  // Global Announcements for Dashboard Overview
  app.get('/api/announcements', authenticate, (req, res) => {
    const list = db.getAnnouncements().filter(a => a.is_active);
    res.json(list.sort((a,b) => b.created_at.localeCompare(a.created_at)));
  });

  // --- DEPOSIT NOWPAYMENTS HANDLER & MODAL ---

  app.post('/api/deposit/create', authenticate, async (req, res) => {
    const user = (req as any).user;
    const { planId, amountUsd } = req.body;

    const plan = db.getPlans().find(p => p.id === planId);
    if (!plan && !amountUsd) {
      return res.status(400).json({ error: 'Valid Plan ID or USD payment amount requested' });
    }

    const usdEquivalent = plan ? plan.price_btc : Number(amountUsd);

    if (usdEquivalent < 500) {
      return res.status(400).json({ error: 'Minimum deposit is $500 USDT (Starter plan price).' });
    }

    let btcUsdPrice = 68420.0;
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        btcUsdPrice = data.bitcoin?.usd || 68420.0;
      }
    } catch (_) {
      // ignore
    }

    const priceBtc = usdEquivalent / btcUsdPrice;
    const invoiceId = 'nowp_' + Math.random().toString(36).substr(2, 9);
    
    // Mock BTC receiving address for sandbox
    const testDepositBtcAddress = 'bc1q' + Math.random().toString(36).substr(2, 10) + Math.random().toString(36).substr(2, 10).toLowerCase();

    // Trace deposit record
    const deposit: Deposit = {
      id: 'dep_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      amount_usd: Math.round(usdEquivalent),
      amount_btc: Number(priceBtc.toFixed(8)),
      invoice_id: invoiceId,
      nowpayments_payment_id: invoiceId,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.addDeposit(deposit);

    // Regardless of how the deposit is confirmed, start mining as soon as USDT / capital is locked
    activateDynamicPlanForUser(user, Math.round(usdEquivalent));
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Deposit Initiated',
      details: `Initiated deposit invoice ${invoiceId} for ${priceBtc} BTC (${plan ? plan.name : 'Custom'} Plan). Cloud mining started instantly.`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_mining_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Your contract has been initiated! Cloud mining has started instantly with $${Math.round(usdEquivalent)} USDT locked.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    // Handle standard API integration if NOWPayments token exists, otherwise fallback elegantly
    const nowPayApiKey = process.env.VITE_NOWPAYMENTS_API_KEY || process.env.NOWPAYMENTS_API_KEY;
    const isSandboxEnv = process.env.VITE_NOWPAYMENTS_SANDBOX === 'true' || process.env.NOWPAYMENTS_SANDBOX === 'true';
    const nowPayBaseUrl = isSandboxEnv ? 'https://api-sandbox.nowpayments.io/v1' : 'https://api.nowpayments.io/v1';

    if (nowPayApiKey && nowPayApiKey !== 'MY_NOWPAYMENTS_API_KEY' && nowPayApiKey.length > 5) {
      try {
        const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
        const host = req.get('host');
        const defaultAppUrl = `${protocol}://${host}`;
        const ipnCallbackUrl = (process.env.APP_URL || defaultAppUrl) + '/api/payments/webhook';

        console.log(`Creating NowPayments invoice on: ${nowPayBaseUrl}/invoice with IPN callback: ${ipnCallbackUrl}`);

        const response = await fetch(`${nowPayBaseUrl}/invoice`, {
          method: 'POST',
          headers: {
            'x-api-key': nowPayApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            price_amount: usdEquivalent,
            price_currency: 'usd',
            pay_currency: 'btc',
            ipn_callback_url: ipnCallbackUrl,
            order_id: invoiceId,
            order_description: `Purchase of ${plan ? plan.name : 'Custom'} Hashpower Plan`
          })
        });

        if (response.ok) {
          const rawInvoice = await response.json();
          // Update details with actual NOWPayments parameters if success
          if (rawInvoice.invoice_url || rawInvoice.pay_address) {
            deposit.invoice_id = rawInvoice.id || invoiceId;
            deposit.nowpayments_payment_id = rawInvoice.id || invoiceId;
            db.updateDeposit(deposit);
            
            return res.json({
              invoiceId: rawInvoice.id,
              payAddress: rawInvoice.pay_address || testDepositBtcAddress,
              amountBtc: rawInvoice.pay_amount || priceBtc,
              qrurl: rawInvoice.invoice_url 
                ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(rawInvoice.invoice_url)}`
                : `${nowPayBaseUrl}/qr-code?payment_id=${rawInvoice.id}`,
              invoiceUrl: rawInvoice.invoice_url,
              isSandbox: isSandboxEnv
            });
          }
        } else {
          const errText = await response.text();
          console.error(`NOWPayments API responded with an error status ${response.status}: ${errText}`);
        }
      } catch (e) {
        console.error('NOWPayments API call failed; switching strictly to sandbox mock simulation.', e);
      }
    }

    // Elegant Sandbox Mock Payout Invoice Backing
    res.json({
      invoiceId: invoiceId,
      payAddress: testDepositBtcAddress,
      amountBtc: Number(priceBtc.toFixed(8)),
      qrurl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=bitcoin:${testDepositBtcAddress}?amount=${priceBtc}`,
      isSandbox: true,
      selectedPlanName: plan ? plan.name : 'Custom'
    });
  });

  app.post('/api/deposit/nowpayments-usdt', authenticate, async (req, res) => {
    const user = (req as any).user;
    const { currency, amount } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Please enter a valid deposit amount.' });
    }

    const usdAmount = Number(amount);
    
    if (usdAmount < 500) {
      return res.status(400).json({ error: 'Minimum deposit is 500 USDT (Starter plan price).' });
    }

    const invoiceId = 'usdt_' + Math.random().toString(36).substr(2, 9);
    
    const nowPayApiKey = process.env.VITE_NOWPAYMENTS_API_KEY || process.env.NOWPAYMENTS_API_KEY;
    const isSandboxEnv = process.env.VITE_NOWPAYMENTS_SANDBOX === 'true' || process.env.NOWPAYMENTS_SANDBOX === 'true';
    const nowPayBaseUrl = isSandboxEnv ? 'https://api-sandbox.nowpayments.io/v1' : 'https://api.nowpayments.io/v1';

    let address = '';

    if (nowPayApiKey && nowPayApiKey !== 'MY_NOWPAYMENTS_API_KEY' && nowPayApiKey.length > 5) {
      try {
        // Try requested GET method per standard instruction
        const getUrl = `${nowPayBaseUrl}/payment?currency=${currency}&price_amount=${usdAmount}`;
        const getRes = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'x-api-key': nowPayApiKey,
            'Content-Type': 'application/json'
          }
        });

        if (getRes.ok) {
          const getData = await getRes.json();
          if (getData && getData.pay_address) {
            address = getData.pay_address;
          } else if (getData && Array.isArray(getData.data) && getData.data.length > 0) {
            address = getData.data[0].pay_address;
          }
        }

        // If GET doesn't return address, fall back to POST /v1/payment to create the address
        if (!address) {
          const paymentPayload: any = {
            price_amount: usdAmount,
            price_currency: 'usd',
            pay_currency: currency,
            order_id: invoiceId,
            order_description: `Purchase of Node`
          };
          if (currency !== 'eth' && currency !== 'btc') {
            paymentPayload.pay_amount = usdAmount;
          }

          const postRes = await fetch(`${nowPayBaseUrl}/payment`, {
            method: 'POST',
            headers: {
              'x-api-key': nowPayApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentPayload)
          });

          if (postRes.ok) {
            const rawPayment = await postRes.json();
            if (rawPayment && rawPayment.pay_address) {
              address = rawPayment.pay_address;
            }
          }
        }
      } catch (err) {
        console.error('NOWPayments API call error, using local/sandbox modes:', err);
      }
    }

    // Default Sandbox / Mock addresses if API failed or no token was defined
    if (!address) {
      if (isSandboxEnv || !nowPayApiKey || nowPayApiKey === 'MY_NOWPAYMENTS_API_KEY' || nowPayApiKey.length <= 5) {
        const mockUsdtBsc = '0x' + Math.random().toString(36).substr(2, 10).toUpperCase() + Math.random().toString(16).substr(2, 10).toLowerCase();
        const mockUsdtTrc20 = 'T' + Math.random().toString(36).substr(2, 9).toUpperCase() + Math.random().toString(16).substr(2, 9).toUpperCase();
        const mockEth = '0x' + Math.random().toString(36).substr(2, 10).toUpperCase() + Math.random().toString(16).substr(2, 10).toLowerCase();
        const mockBtc = 'bc1' + Math.random().toString(36).substr(2, 12).toLowerCase() + Math.random().toString(16).substr(2, 12).toLowerCase();
        address = currency === 'usdtbsc' ? mockUsdtBsc : currency === 'eth' ? mockEth : currency === 'btc' ? mockBtc : mockUsdtTrc20;
      } else {
        return res.status(400).json({ error: 'Unable to retrieve wallet address. Please try again.' });
      }
    }

    const deposit: Deposit = {
      id: 'dep_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      amount_usd: usdAmount,
      amount_btc: 0, // Zero BTC since we are USDT exclusive
      invoice_id: invoiceId,
      nowpayments_payment_id: invoiceId,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.addDeposit(deposit);

    // Regardless of how the deposit is confirmed, start mining as soon as USDT / capital is locked
    activateDynamicPlanForUser(user, usdAmount);
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Deposit Initiated',
      details: `Initiated deposit invoice ${invoiceId} for ${usdAmount} USDT via ${currency.toUpperCase()}. Cloud mining started instantly.`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_mining_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Your contract has been initiated! Cloud mining has started instantly with $${usdAmount} USDT locked.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({
      invoiceId: invoiceId,
      payAddress: address,
      amount: usdAmount,
      currency: currency,
      qrurl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(address)}`,
      isSandbox: isSandboxEnv || !nowPayApiKey || nowPayApiKey === 'MY_NOWPAYMENTS_API_KEY' || nowPayApiKey.length <= 5
    });
  });

  // Polling check of payment invoice status
  app.get('/api/deposit/status/:invoiceId', authenticate, (req, res) => {
    const { invoiceId } = req.params;
    const user = (req as any).user;
    const deposits = db.getDeposits();
    const depIndex = deposits.find(d => d.invoice_id === invoiceId && d.user_id === user.id);

    if (!depIndex) {
      return res.status(404).json({ error: 'Invoice tracking record not found' });
    }

    res.json({
      status: depIndex.status, // 'pending' | 'confirmed' | 'failed'
      amount_btc: depIndex.amount_btc,
      amount_usd: depIndex.amount_usd
    });
  });

  // Sandbox Test Trigger to manually test and trigger fake invoice confirmation
  app.post('/api/deposit/sandbox-trigger-confirm', authenticate, (req, res) => {
    const { invoiceId } = req.body;
    const user = (req as any).user;
    const deposit = db.getDeposits().find(d => d.invoice_id === invoiceId && d.user_id === user.id);

    if (!deposit) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (deposit.status !== 'pending') {
      return res.json({ success: true, status: deposit.status, message: 'Deposit has already been processed.' });
    }

    // Executting Payout confirmations
    deposit.status = 'confirmed';
    if (deposit.amount_btc === 0 && deposit.amount_usd > 0) {
      deposit.amount_btc = Number((deposit.amount_usd / (cachedBtcPrice || 68420.0)).toFixed(8));
    }
    db.updateDeposit(deposit);

    // Confirm and activate dynamic contract node based on USDT investment amount, which locks the capital instantly
    activateDynamicPlanForUser(user, deposit.amount_usd);
    db.updateProfile(user);

    // Apply referral commission credit
    creditReferralCommission(user.id, deposit.amount_usd, deposit.amount_btc);

    // Record complete logs and notifies
    db.addTransaction({
      id: 'tx_pay_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      type: 'deposit',
      description: `Bitcoin hash power purchase deposit (+${deposit.amount_usd} USDT)`,
      amount_btc: deposit.amount_btc,
      status: 'completed',
      created_at: new Date().toISOString()
    });

    const pName = user.active_plan === 'plan_starter' ? 'Starter Plan' : user.active_plan === 'plan_pro' ? 'Pro Plan' : 'VIP Plan';

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Deposit Completed',
      details: `Sandbox test credit process confirmed successfully. Paid $${deposit.amount_usd} USDT. Contract: ${pName} activated successfully.`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Deposit confirmed! Paid $${deposit.amount_usd} USDT. Your active ${pName} miner is online and working now.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Withdraw Request
  app.post('/api/withdraw', authenticate, (req, res) => {
    const user = (req as any).user;
    const { amount, walletAddress } = req.body;

    const btcAmount = Number(amount);
    if (!btcAmount || btcAmount <= 0) {
      return res.status(400).json({ error: 'Please submit a valid BTC withdrawal amount.' });
    }

    if (!walletAddress || walletAddress.trim().length < 24) {
      return res.status(400).json({ error: 'Please specify a valid, full BTC crypto receiving address.' });
    }

    // Calculate locked principal
    let lockedUsd = 0;
    const now = Date.now();
    let isLocked = false;
    let expiryDateString = '';

    if (user.active_plan) {
      const expiryTime = user.plan_expires_at ? new Date(user.plan_expires_at).getTime() : 0;
      if (expiryTime > now) {
        isLocked = true;
        lockedUsd = user.active_plan_investment || 0;
        if (lockedUsd <= 0) {
          if (user.active_plan === 'plan_starter') lockedUsd = 500;
          else if (user.active_plan === 'plan_pro') lockedUsd = 10000;
          else if (user.active_plan === 'plan_vip') lockedUsd = 50000;
        }
        
        // Formatted date [expiry date]
        expiryDateString = new Date(user.plan_expires_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }

    const btcUsdPrice = cachedBtcPrice || 68420.0;
    const lockedBtc = isLocked && btcUsdPrice > 0 ? Number((lockedUsd / btcUsdPrice).toFixed(8)) : 0;
    const availableBtc = Number(Math.max(0, user.btc_balance - lockedBtc).toFixed(8));

    // Rule 2 & 5: Minimum withdrawal check ($7 USD worth of BTC)
    const minWithdrawalBtc = Number((7 / btcUsdPrice).toFixed(8));
    if (btcAmount < minWithdrawalBtc) {
      return res.status(400).json({ error: `Minimum withdrawal amount is $7 worth of BTC (${minWithdrawalBtc.toFixed(8)} BTC).` });
    }

    // Rule 5 validation: If amount includes locked principal
    if (btcAmount > availableBtc) {
      if (isLocked) {
        return res.status(400).json({ error: `Your deposit of ${lockedUsd} USDT is locked until ${expiryDateString}. Only mining profits are withdrawable.` });
      } else if (user.btc_balance < btcAmount) {
        return res.status(400).json({ error: 'Insufficient BTC balance for this withdrawal.' });
      }
    }

    // Subtract and log immediately
    user.btc_balance = Number((user.btc_balance - btcAmount).toFixed(8));
    db.updateProfile(user);

    const withdrawal: Withdrawal = {
      id: 'wth_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      amount_btc: btcAmount,
      wallet_address: walletAddress.trim(),
      status: 'pending',
      actioned_by: null,
      actioned_at: null,
      created_at: new Date().toISOString()
    };

    db.addWithdrawal(withdrawal);

    // Record pending transaction
    db.addTransaction({
      id: 'tx_wd_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      type: 'withdrawal',
      description: `Withdrawal request to ${walletAddress.substring(0, 8)}... (${btcAmount} BTC)`,
      amount_btc: btcAmount,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Withdrawal Initiated',
      details: `Requested withdrawal of ${btcAmount} BTC to ${walletAddress}`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Withdrawal of ${btcAmount} BTC has been initiated and is pending administrator review.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // POST /api/user/swap/usd-to-btc
  app.post('/api/user/swap/usd-to-btc', authenticate, (req, res) => {
    const user = (req as any).user;
    const { amountUsd } = req.body;
    const val = Number(amountUsd);

    if (!val || val <= 0) {
      return res.status(400).json({ error: 'Please specify a valid USD amount to swap.' });
    }

    const currentUsdBalance = user.usd_balance || 0;
    if (currentUsdBalance < val) {
      return res.status(400).json({ error: `Insufficient unlocked USD balance. You only have $${currentUsdBalance.toFixed(2)} USD.` });
    }

    const btcPrice = cachedBtcPrice || 68420.0;
    const btcToCredit = Number((val / btcPrice).toFixed(8));

    user.usd_balance = Number((currentUsdBalance - val).toFixed(2));
    user.btc_balance = Number((user.btc_balance + btcToCredit).toFixed(8));
    db.updateProfile(user);

    db.addTransaction({
      id: 'tx_swap_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      type: 'deposit',
      description: `Swapped $${val.toFixed(2)} USD to BTC (+${btcToCredit} BTC)`,
      amount_btc: btcToCredit,
      status: 'completed',
      created_at: new Date().toISOString()
    });

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Currency Swap',
      details: `Swapped $${val.toFixed(2)} USD to ${btcToCredit} BTC at exchange rate $${btcPrice}`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Successfully swapped $${val.toFixed(2)} USD to ${btcToCredit} BTC!`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // POST /api/withdraw/usdt
  app.post('/api/withdraw/usdt', authenticate, (req, res) => {
    const user = (req as any).user;
    const { amountUsd, walletAddress } = req.body;
    const val = Number(amountUsd);

    if (!val || val <= 0) {
      return res.status(400).json({ error: 'Please specify a valid USDT withdrawal amount.' });
    }

    if (!walletAddress || walletAddress.trim().length < 10) {
      return res.status(400).json({ error: 'Please specify a valid TRC-20 or ERC-20 destination address.' });
    }

    const currentUsdBalance = user.usd_balance || 0;
    if (currentUsdBalance < val) {
      return res.status(400).json({ error: `Insufficient unlocked USD balance. You only have $${currentUsdBalance.toFixed(2)} USD.` });
    }

    if (val < 10) {
      return res.status(400).json({ error: 'Minimum USDT withdrawal is $10 USDT.' });
    }

    user.usd_balance = Number((currentUsdBalance - val).toFixed(2));
    db.updateProfile(user);

    const withdrawal: Withdrawal = {
      id: 'wth_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      amount_btc: 0,
      amount_usd: val,
      currency: 'USDT',
      wallet_address: walletAddress.trim(),
      status: 'pending',
      actioned_by: null,
      actioned_at: null,
      created_at: new Date().toISOString()
    };
    db.addWithdrawal(withdrawal);

    db.addTransaction({
      id: 'tx_wd_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      type: 'withdrawal',
      description: `USDT Withdrawal request to ${walletAddress.substring(0, 8)}... ($${val} USDT)`,
      amount_btc: 0,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'USDT Withdrawal Request',
      details: `Requested USDT withdrawal of $${val} to ${walletAddress}`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Your USDT withdrawal of $${val} is pending review.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // NOWPayments IPN Webhook callback (optional, but awesome support!)
  app.post('/api/payments/webhook', (req, res) => {
    const { payment_status, order_id, pay_address, pay_amount, invoice_id } = req.body;
    console.log('Received NOWPayments Webhook IPN:', req.body);
    
    // Auto-confirm if finished
    if (payment_status === 'confirmed' || payment_status === 'finished') {
      const deposits = db.getDeposits();
      const deposit = deposits.find(d => d.invoice_id === invoice_id || d.invoice_id === order_id);
      
      if (deposit && deposit.status === 'pending') {
        deposit.status = 'confirmed';
        db.updateDeposit(deposit);

        const profiles = db.getProfiles();
        const user = profiles.find(p => p.id === deposit.user_id);
        
        if (user) {
          if (deposit.amount_btc === 0 && deposit.amount_usd > 0) {
            deposit.amount_btc = Number((deposit.amount_usd / (cachedBtcPrice || 68420.0)).toFixed(8));
          }
          
          activateDynamicPlanForUser(user, deposit.amount_usd);
          db.updateProfile(user);

          // Apply referral commission credit
          creditReferralCommission(user.id, deposit.amount_usd, deposit.amount_btc);

          db.addTransaction({
            id: 'tx_pay_hk_' + Math.random().toString(36).substr(2, 9),
            user_id: user.id,
            type: 'deposit',
            description: `NowPayments IPN Deposit completion (+${deposit.amount_usd} USDT)`,
            amount_btc: deposit.amount_btc,
            status: 'completed',
            created_at: new Date().toISOString()
          });

          const pName = user.active_plan === 'plan_starter' ? 'Starter Plan' : user.active_plan === 'plan_pro' ? 'Pro Plan' : 'VIP Plan';

          db.addNotification({
            id: 'not_' + Math.random().toString(36).substr(2, 9),
            user_id: user.id,
            message: `Deposit invoice verified! Your transaction of ${deposit.amount_usd} USDT is completed and mining ${pName} contract is activated.`,
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      }
    }
    
    res.sendStatus(200);
  });

  // --- ADMINISTRATOR API MODULES ---

  // Admin: Get all users
  app.get('/api/admin/users', adminAuthenticate, (req, res) => {
    const adminUser = (req as any).user;
    let profiles = db.getProfiles();
    
    // Hide super-admin comradeabutanimu@gmail.com from other admins
    if (adminUser.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      profiles = profiles.filter(p => p.email.toLowerCase() !== 'comradeabutanimu@gmail.com');
    }

    // Return standard profiles without sensitive details (but password can stay hidden)
    res.json(profiles.map(p => {
      const { passwordHash, ...rest } = p;
      return rest;
    }));
  });

  // Admin: Edit individual user balance
  app.post('/api/admin/users/:userId/balance', adminAuthenticate, (req, res) => {
    const { userId } = req.params;
    const { btc_balance } = req.body;

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'Selected user profile does not exist' });
    }

    // Protect super-admin account from other admins
    if (user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    const previousBalance = user.btc_balance;
    const newBalance = Number(btc_balance);
    user.btc_balance = Number(newBalance.toFixed(8));
    db.updateProfile(user);

    // Save logs
    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Balance Modified',
      details: `Administrator modified balance from ${previousBalance} to ${newBalance} BTC.`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      message: `Your balance was updated to ${user.btc_balance} BTC.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Admin: Suspend toggle
  app.post('/api/admin/users/:userId/suspend', adminAuthenticate, (req, res) => {
    const { userId } = req.params;
    const { is_suspended } = req.body;

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    if (user.id === (req as any).user.id) {
      return res.status(400).json({ error: 'You are forbidden from suspending your own administrator account.' });
    }

    // Protect super-admin account from other admins
    if (user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    user.is_suspended = Boolean(is_suspended);
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: user.is_suspended ? 'Suspended' : 'Unsuspended',
      details: `Administrator updated suspension badge to ${user.is_suspended}.`,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Admin: Grant or Revoke Admin rights
  app.post('/api/admin/users/:userId/admin', adminAuthenticate, (req, res) => {
    const { userId } = req.params;
    const { is_admin } = req.body;

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    if (user.id === (req as any).user.id) {
      return res.status(400).json({ error: 'You cannot revoke your own super-admin permission' });
    }

    // Protect super-admin account from other admins
    if (user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    user.is_admin = Boolean(is_admin);
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Admin Rights Changed',
      details: `Admin privileges updated to ${user.is_admin}.`,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Admin: edit note
  app.post('/api/admin/users/:userId/note', adminAuthenticate, (req, res) => {
    const { userId } = req.params;
    const { note } = req.body;

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Protect super-admin account from other admins
    if (user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    user.admin_note = note;
    db.updateProfile(user);

    res.json({ success: true, profile: user });
  });

  // Admin: change user email address
  app.post('/api/admin/users/:userId/email', adminAuthenticate, (req, res) => {
    const { userId } = req.params;
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Protect super-admin account from other admins
    if (user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    const existing = profiles.find(p => p.email.toLowerCase() === email.toLowerCase().trim() && p.id !== userId);
    if (existing) {
      return res.status(400).json({ error: 'An account with that email already exists' });
    }

    const oldEmail = user.email;
    user.email = email.toLowerCase().trim();
    db.updateProfile(user);

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      action: 'Email Changed by Admin',
      details: `Email address updated from ${oldEmail} to ${user.email} by administrator.`,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, profile: user });
  });

  // Admin: user specific details (payout lists, log histories)
  app.get('/api/admin/users/:userId/detail', adminAuthenticate, (req, res) => {
    const { userId } = req.params;
    
    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === userId);

    if (user && user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view the details of this account.' });
    }

    const txs = db.getTransactions().filter(t => t.user_id === userId);
    const logs = db.getActivityLogs().filter(l => l.user_id === userId);
    const deps = db.getDeposits().filter(d => d.user_id === userId);
    const wds = db.getWithdrawals().filter(w => w.user_id === userId);

    res.json({
      transactions: txs.sort((a,b) => b.created_at.localeCompare(a.created_at)),
      activity_logs: logs.sort((a,b) => b.created_at.localeCompare(a.created_at)),
      deposits: deps.sort((a,b) => b.created_at.localeCompare(a.created_at)),
      withdrawals: wds.sort((a,b) => b.created_at.localeCompare(a.created_at))
    });
  });

  // Admin: Get all withdrawals
  app.get('/api/admin/withdrawals', adminAuthenticate, (req, res) => {
    const adminUser = (req as any).user;
    const withdrawals = db.getWithdrawals();
    const profiles = db.getProfiles();

    let merged = withdrawals.map(w => {
      const u = profiles.find(p => p.id === w.user_id);
      return {
        ...w,
        user_email: u ? u.email : 'unknown'
      };
    });

    // Hide withdrawals belonging to comradeabutanimu@gmail.com from other admins
    if (adminUser.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      merged = merged.filter(w => w.user_email.toLowerCase() !== 'comradeabutanimu@gmail.com');
    }

    res.json(merged.sort((a,b) => b.created_at.localeCompare(a.created_at)));
  });

  // Admin: Action withdrawals
  app.post('/api/admin/withdrawals/:withdrawId/action', adminAuthenticate, (req, res) => {
    const { withdrawId } = req.params;
    const { status } = req.body; // 'approved' | 'rejected'

    const withdrawals = db.getWithdrawals();
    const wth = withdrawals.find(w => w.id === withdrawId);

    if (!wth) {
      return res.status(404).json({ error: 'Withdrawal tracking log not found' });
    }

    if (wth.status !== 'pending') {
      return res.status(400).json({ error: 'This withdrawal has already been finalized.' });
    }

    const profiles = db.getProfiles();
    const targetUser = profiles.find(p => p.id === wth.user_id);

    // Guard comradeabutanimu@gmail.com from other admins
    if (targetUser && targetUser.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    wth.status = status;
    wth.actioned_by = (req as any).user.email;
    wth.actioned_at = new Date().toISOString();
    db.updateWithdrawal(wth);

    // Update the transaction status on the client register
    const originalTxs = db.getTransactions();
    const relevantTx = originalTxs.find(t => t.user_id === wth.user_id && t.type === 'withdrawal' && t.status === 'pending');
    if (relevantTx) {
      relevantTx.status = status === 'approved' ? 'completed' : 'failed';
    }

    // If rejected, refund the BTC balance safely
    if (status === 'rejected' && targetUser) {
      targetUser.btc_balance = Number((targetUser.btc_balance + wth.amount_btc).toFixed(8));
      db.updateProfile(targetUser);
    }

    db.addActivityLog({
      id: 'act_' + Math.random().toString(36).substr(2, 9),
      user_id: wth.user_id,
      action: status === 'approved' ? 'Withdrawal Approved' : 'Withdrawal Rejected',
      details: `${status === 'approved' ? 'Dispensed' : 'Rejected'} withdrawal of ${wth.amount_btc} BTC. Approved by: ${(req as any).user.email}`,
      created_at: new Date().toISOString()
    });

    db.addNotification({
      id: 'not_' + Math.random().toString(36).substr(2, 9),
      user_id: wth.user_id,
      message: `Your withdrawal of ${wth.amount_btc} BTC has been ${status}. ${status === 'rejected' ? 'Your BTC balance has been refunded.' : ''}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, withdrawal: wth });
  });

  // Admin: Get all deposit invoices
  app.get('/api/admin/deposits', adminAuthenticate, (req, res) => {
    const adminUser = (req as any).user;
    const deposits = db.getDeposits();
    const profiles = db.getProfiles();
    
    let merged = deposits.map(d => {
      const u = profiles.find(p => p.id === d.user_id);
      return {
        ...d,
        user_email: u ? u.email : 'unknown'
      };
    });

    // Hide deposits belonging to comradeabutanimu@gmail.com from other admins
    if (adminUser.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      merged = merged.filter(d => d.user_email.toLowerCase() !== 'comradeabutanimu@gmail.com');
    }

    res.json(merged.sort((a,b) => b.created_at.localeCompare(a.created_at)));
  });

  // Admin Manual Overrides for Deposits
  app.post('/api/admin/deposits/:depositId/confirm', adminAuthenticate, (req, res) => {
    const { depositId } = req.params;
    const deposits = db.getDeposits();
    const depositIndex = deposits.find(d => d.id === depositId);

    if (!depositIndex) {
      return res.status(404).json({ error: 'Deposit record not found' });
    }

    const profiles = db.getProfiles();
    const user = profiles.find(p => p.id === depositIndex.user_id);

    // Guard comradeabutanimu@gmail.com from other admins
    if (user && user.email.toLowerCase() === 'comradeabutanimu@gmail.com' && (req as any).user.email.toLowerCase() !== 'comradeabutanimu@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify the super administrator account.' });
    }

    if (depositIndex.status !== 'pending') {
      return res.json({ success: true, message: 'Deposit has already been processed.' });
    }

    depositIndex.status = 'confirmed';
    if (depositIndex.amount_btc === 0 && depositIndex.amount_usd > 0) {
      depositIndex.amount_btc = Number((depositIndex.amount_usd / (cachedBtcPrice || 68420.0)).toFixed(8));
    }
    db.updateDeposit(depositIndex);

    if (user) {
      // Confirm and activate dynamic contract node based on USDT investment amount, which locks the capital instantly
      activateDynamicPlanForUser(user, depositIndex.amount_usd);
      db.updateProfile(user);

      // Apply referral commission credit
      creditReferralCommission(user.id, depositIndex.amount_usd, depositIndex.amount_btc);

      db.addTransaction({
        id: 'tx_pay_man_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        type: 'deposit',
        description: `Manual admin invoice unlock (+${depositIndex.amount_btc} BTC)`,
        amount_btc: depositIndex.amount_btc,
        status: 'completed',
        created_at: new Date().toISOString()
      });

      db.addNotification({
        id: 'not_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        message: `Admin manual check cleared! Your account is active with ${depositIndex.amount_btc} BTC credit.`,
        is_read: false,
        created_at: new Date().toISOString()
      });

      db.addActivityLog({
        id: 'act_' + Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        action: 'Deposit Completed',
        details: `Manual admin override triggered. Confirmed credit of ${depositIndex.amount_btc} BTC. Action by: ${(req as any).user.email}`,
        created_at: new Date().toISOString()
      });
    }

    res.json({ success: true, deposit: depositIndex });
  });

  // Admin Master Plan List
  app.get('/api/admin/plans', adminAuthenticate, (req, res) => {
    res.json(db.getPlans());
  });

  // Admin Edit Plan
  app.post('/api/admin/plans/edit', adminAuthenticate, (req, res) => {
    const { id, name, price_btc, hash_rate, daily_earn_btc, duration_days, is_active } = req.body;
    
    const plan = db.getPlans().find(p => p.id === id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    plan.name = name;
    plan.price_btc = Number(price_btc);
    plan.hash_rate = hash_rate;
    plan.daily_earn_btc = Number(daily_earn_btc);
    plan.duration_days = Number(duration_days);
    plan.is_active = Boolean(is_active);

    db.updatePlan(plan);
    res.json({ success: true, plan });
  });

  // Admin Add Plan
  app.post('/api/admin/plans/add', adminAuthenticate, (req, res) => {
    const { name, price_btc, hash_rate, daily_earn_btc, duration_days } = req.body;

    if (!name || isNaN(Number(price_btc)) || !hash_rate || isNaN(Number(daily_earn_btc))) {
      return res.status(400).json({ error: 'Please enter all numerical plan options.' });
    }

    const newPlan: Plan = {
      id: 'plan_' + Math.random().toString(36).substr(2, 9),
      name,
      price_btc: Number(price_btc),
      hash_rate,
      daily_earn_btc: Number(daily_earn_btc),
      duration_days: Number(duration_days) || 30,
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.addPlan(newPlan);
    res.json({ success: true, plan: newPlan });
  });

  // Admin: Get all announcements
  app.get('/api/admin/announcements', adminAuthenticate, (req, res) => {
    res.json(db.getAnnouncements());
  });

  // Admin: Create announcement
  app.post('/api/admin/announcements/create', adminAuthenticate, (req, res) => {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Announcement message is required' });
    }

    const ann: Announcement = {
      id: 'ann_' + Math.random().toString(36).substr(2, 9),
      message: message.trim(),
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.addAnnouncement(ann);
    res.json({ success: true, announcement: ann });
  });

  // Admin: Toggle announcement
  app.post('/api/admin/announcements/:id/toggle', adminAuthenticate, (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    const ann = db.getAnnouncements().find(a => a.id === id);
    if (!ann) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    ann.is_active = Boolean(is_active);
    db.updateAnnouncement(ann);
    res.json({ success: true, announcement: ann });
  });

  // Admin: Delete announcement
  app.post('/api/admin/announcements/:id/delete', adminAuthenticate, (req, res) => {
    const { id } = req.params;
    db.deleteAnnouncement(id);
    res.json({ success: true });
  });

  // Admin: Export entire database backup JSON
  app.get('/api/admin/database/export', adminAuthenticate, (req, res) => {
    try {
      const data = db.exportDatabase();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export database.' });
    }
  });

  // Admin: Import entire database backup JSON
  app.post('/api/admin/database/import', adminAuthenticate, async (req, res) => {
    try {
      await db.importDatabase(req.body);
      res.json({ success: true, message: 'Database backup imported and synced successfully!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to import database backup.' });
    }
  });

  // Admin: Get Supabase integration status and diagnostics
  app.get('/api/admin/supabase/status', adminAuthenticate, (req, res) => {
    try {
      const isConfigured = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
      res.json({
        configured: isConfigured,
        url: process.env.SUPABASE_URL || null,
        availableTables: Array.from((db as any).availableTables || []),
        discoveredColumns: Object.fromEntries(
          Array.from(((db as any).tableColumns || new Map()).entries()).map(([k, v]) => [k, Array.from(v as any)])
        )
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch Supabase status.' });
    }
  });

  // Admin: Trigger manual recheck and dynamic sync with Supabase
  app.post('/api/admin/supabase/sync', adminAuthenticate, async (req, res) => {
    try {
      await db.bootstrapSupabase();
      res.json({
        success: true,
        message: 'Discovered tables successfully. Sync completed!',
        availableTables: Array.from((db as any).availableTables || []),
        discoveredColumns: Object.fromEntries(
          Array.from(((db as any).tableColumns || new Map()).entries()).map(([k, v]) => [k, Array.from(v as any)])
        )
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to trigger Supabase sync.' });
    }
  });


  // --- DAILY AND LIVE SIMULATED CRON MINING ENGINE ---
  // To keep the user experience incredibly fluid, our server performs 
  // background mining payouts every 60 seconds for any active cloud miners,
  // making sure they are persisted automatically even when the user is logged out.
  setInterval(async () => {
    try {
      await updateCachedBtcPrice();
      const profiles = db.getProfiles();
      profiles.forEach(user => {
        if (user.active_plan && !user.is_suspended) {
          processMining(user);
        }
      });
    } catch (err) {
      console.error('Error running background mining interval:', err);
    }
  }, 60000); // Trigger payouts every 60 seconds automatically!


  // --- VITE DEV / PRODUCTION INTERLOCKS ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CryptoBTC Miner full-stack core operational on http://localhost:${PORT}`);
  });
}

startServer();
