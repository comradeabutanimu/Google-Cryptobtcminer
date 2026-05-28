/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Shield, Eye, EyeOff, Bell, Loader, Check, Smartphone, Lock, Copy, BellRing, X } from 'lucide-react';
import { Profile, ProfileSettings } from '../types.js';
import { api } from '../lib/api.js';

interface SettingsProps {
  profile: Profile;
  onProfileUpdated: (updatedProf: Profile) => void;
  toast: (msg: string, type: 'success' | 'error') => void;
}

export default function Settings({ profile, onProfileUpdated, toast }: SettingsProps) {
  const [activeSegment, setActiveSegment] = useState<'profile' | 'security' | 'privacy' | 'notifications'>('profile');
  
  // Profile settings state
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [loading, setLoading] = useState(false);

  // Security password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility controls
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA TOTP states
  const [twoFactorStep, setTwoFactorStep] = useState<'idle' | 'setup'>('idle');
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [loading2fa, setLoading2fa] = useState(false);

  // Privacy and Alerts settings
  const [blurBalances, setBlurBalances] = useState(profile.settings?.blurBalances ?? false);
  const [notifyDepositConfirm, setNotifyDepositConfirm] = useState(profile.settings?.notifyDepositConfirm ?? true);
  const [notifyWithdrawUpdate, setNotifyWithdrawUpdate] = useState(profile.settings?.notifyWithdrawUpdate ?? true);
  const [notifySecurityAlert, setNotifySecurityAlert] = useState(profile.settings?.notifySecurityAlert ?? true);
  const [notifyPromotions, setNotifyPromotions] = useState(profile.settings?.notifyPromotions ?? false);
  const [targetBtcPrice, setTargetBtcPrice] = useState<string>(profile.settings?.targetBtcPrice ? String(profile.settings.targetBtcPrice) : '');
  const [savingTarget, setSavingTarget] = useState(false);

  // Sync state with profile prop updates defensively
  React.useEffect(() => {
    setFullName(profile.full_name || '');
    setEmail(profile.email || '');
    if (profile.settings) {
      setBlurBalances(profile.settings.blurBalances ?? false);
      setNotifyDepositConfirm(profile.settings.notifyDepositConfirm ?? true);
      setNotifyWithdrawUpdate(profile.settings.notifyWithdrawUpdate ?? true);
      setNotifySecurityAlert(profile.settings.notifySecurityAlert ?? true);
      setNotifyPromotions(profile.settings.notifyPromotions ?? false);
      setTargetBtcPrice(profile.settings.targetBtcPrice ? String(profile.settings.targetBtcPrice) : '');
    }
  }, [profile]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.updateProfile({
        full_name: fullName,
        email: email
      });
      onProfileUpdated(res.profile);
      toast('Profile details updated successfully!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to preserve profile details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast('Confirm password mismatch. Please enter matching values.', 'error');
    }
    if (newPassword.length < 6) {
      return toast('New password must consist of at least 6 characters.', 'error');
    }

    setLoading(true);
    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword
      });
      toast(res.message || 'Security credentials updated.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast(err.message || 'Failed to rewrite security credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSettings = async (updates: Partial<ProfileSettings>) => {
    try {
      // Merge setting switches
      const nextSettings = {
        blurBalances,
        notifyDepositConfirm,
        notifyWithdrawUpdate,
        notifySecurityAlert,
        notifyPromotions,
        ...updates
      };
      
      const res = await api.updateProfile({ settings: nextSettings });
      onProfileUpdated(res.profile);
    } catch (err: any) {
      toast('Failed to preserve options.', 'error');
    }
  };

  const handleSaveTargetBtcPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBtcPrice || isNaN(Number(targetBtcPrice)) || Number(targetBtcPrice) <= 0) {
      return toast('Please enter a valid positive BTC price target (USD)', 'error');
    }
    
    setSavingTarget(true);
    try {
      const res = await api.updateProfile({
        settings: {
          blurBalances,
          notifyDepositConfirm,
          notifyWithdrawUpdate,
          notifySecurityAlert,
          notifyPromotions,
          targetBtcPrice: Number(targetBtcPrice)
        }
      });
      onProfileUpdated(res.profile);
      toast(`🎯 Target Alert Activated! We'll notify you when the market price hits $${Number(targetBtcPrice).toLocaleString()}`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update price alerts.', 'error');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleCancelTargetBtcPrice = async () => {
    setSavingTarget(true);
    try {
      const res = await api.updateProfile({
        settings: {
          blurBalances,
          notifyDepositConfirm,
          notifyWithdrawUpdate,
          notifySecurityAlert,
          notifyPromotions,
          targetBtcPrice: null
        }
      });
      onProfileUpdated(res.profile);
      setTargetBtcPrice('');
      toast('Target price alert cancelled.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to cancel price alerts.', 'error');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleGenerate2faSecret = async () => {
    setLoading2fa(true);
    try {
      const res = await api.generate2Fa();
      setGeneratedSecret(res.secret);
      setOtpauthUrl(res.otpauthUrl);
      setTwoFactorStep('setup');
      setTwoFactorCode('');
    } catch (err: any) {
      toast(err.message || 'Failed to generate 2FA secret.', 'error');
    } finally {
      setLoading2fa(false);
    }
  };

  const handleEnable2faSubmit = async () => {
    setLoading2fa(true);
    try {
      const res = await api.enable2Fa({
        code: twoFactorCode,
        secret: generatedSecret
      });
      onProfileUpdated(res.profile);
      toast('🔒 Two-Factor Authentication is now ENABLED! Protect your key.', 'success');
      setTwoFactorStep('idle');
      setTwoFactorCode('');
    } catch (err: any) {
      toast(err.message || 'Failed to verify 2FA token.', 'error');
    } finally {
      setLoading2fa(false);
    }
  };

  const handleDisable2fa = async () => {
    setLoading2fa(true);
    try {
      const res = await api.disable2Fa({
        code: twoFactorCode
      });
      onProfileUpdated(res.profile);
      toast('Unlocked! Two-Factor Authentication is disabled.', 'success');
      setTwoFactorCode('');
    } catch (err: any) {
      toast(err.message || 'Failed to deactivate 2FA.', 'error');
    } finally {
      setLoading2fa(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedSecret);
    setCopiedKey(true);
    toast('Secret key copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
      
      {/* Sidebar navigation tabs */}
      <div className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-4">
        
        {/* Profile */}
        <button
          onClick={() => setActiveSegment('profile')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-left flex items-center space-x-2.5 cursor-pointer whitespace-nowrap transition-all duration-150 ${
            activeSegment === 'profile'
              ? 'bg-orange-50 text-[#F97316]'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <User className="h-4 w-4" />
          <span>General Profile</span>
        </button>

        {/* Security */}
        <button
          onClick={() => setActiveSegment('security')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-left flex items-center space-x-2.5 cursor-pointer whitespace-nowrap transition-all duration-150 ${
            activeSegment === 'security'
              ? 'bg-orange-50 text-[#F97316]'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Security Options</span>
        </button>

        {/* Privacy */}
        <button
          onClick={() => setActiveSegment('privacy')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-left flex items-center space-x-2.5 cursor-pointer whitespace-nowrap transition-all duration-150 ${
            activeSegment === 'privacy'
              ? 'bg-orange-50 text-[#F97316]'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <EyeOff className="h-4 w-4" />
          <span>Privacy & Balance</span>
        </button>

        {/* Alerts notifications */}
        <button
          onClick={() => setActiveSegment('notifications')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-left flex items-center space-x-2.5 cursor-pointer whitespace-nowrap transition-all duration-150 ${
            activeSegment === 'notifications'
              ? 'bg-orange-50 text-[#F97316]'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Alert Switches</span>
        </button>

      </div>

      {/* Pane content panels */}
      <div className="flex-1 min-w-0">
        
        {/* General Profile Tab */}
        {activeSegment === 'profile' && (
          <form onSubmit={saveProfile} className="space-y-5">
            <div>
              <h4 className="text-base font-bold text-gray-900">General Profile Details</h4>
              <p className="text-xs text-gray-400">Modify your basic stats and notifications descriptors</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Full Registered Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Primary Account Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!profile.is_admin}
                  className={`w-full px-4 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-sm font-semibold ${!profile.is_admin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                />
                {!profile.is_admin && (
                  <p className="text-[10px] text-orange-600 font-semibold leading-normal">
                    To update your account primary email or sync security logs, please contact customer services support.
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center space-x-2"
            >
              {loading ? <Loader className="animate-spin h-4 w-4 text-white" /> : <Check className="h-4 w-4" />}
              <span>Save profile</span>
            </button>
          </form>
        )}

        {/* Security Section */}
        {activeSegment === 'security' && (
          <div className="space-y-8 flex-1">
            {/* Password Configurator */}
            <form onSubmit={changePassword} className="space-y-5 bg-gray-50/30 p-5 rounded-2xl border border-gray-100">
              <div>
                <h4 className="text-base font-bold text-gray-900">Security Credentials Customizer</h4>
                <p className="text-xs text-gray-400">Regularly rewrite your account passwords to prevent unauthorized access</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-10 py-2.5 border border-gray-105 rounded-xl focus:border-orange-500 text-sm font-semibold focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full pl-4 pr-10 py-2.5 border border-gray-105 rounded-xl focus:border-orange-500 text-sm font-semibold focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter to confirm"
                      className="w-full pl-4 pr-10 py-2.5 border border-gray-105 rounded-xl focus:border-orange-500 text-sm font-semibold focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword}
                className="px-5 py-2.5 font-bold text-sm bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center space-x-2"
              >
                {loading ? <Loader className="animate-spin h-4 w-4 text-white" /> : <Check className="h-4 w-4" />}
                <span>Change password</span>
              </button>
            </form>

            {/* Two-Factor Authentication Security Panel */}
            <div className="bg-gray-50/30 p-5 rounded-2xl border border-gray-100 space-y-4">
              <div>
                <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-orange-500" />
                  <span>Two-Factor Authentication (2FA)</span>
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">Protect and buffer your account with dynamic security keys on login</p>
              </div>

              {profile.two_factor_enabled ? (
                <div className="bg-emerald-50/40 border border-emerald-100/80 p-5 rounded-xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-emerald-100/50 text-emerald-600 rounded-lg flex items-center justify-center text-sm">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-emerald-900">Highly Secured Logins Active</h5>
                      <p className="text-xs text-emerald-700/80 mt-0.5 leading-normal">
                        Your profile is fortified. Submitting logins will request validation check with your authenticated profile.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-emerald-100/50 pt-4 space-y-2">
                    <span className="text-xs font-bold text-gray-500 uppercase block">Deactivate protection</span>
                    <div className="flex flex-wrap gap-2.5">
                      <input
                        type="text"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="6-Digit OTP"
                        className="w-36 px-4 py-2 border border-gray-200 bg-white rounded-xl text-center text-sm font-bold tracking-widest placeholder:tracking-normal placeholder:font-normal focus:outline-hidden focus:border-red-500"
                      />
                      <button
                        type="button"
                        disabled={loading2fa || twoFactorCode.length !== 6}
                        onClick={handleDisable2fa}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 font-bold text-white text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        {loading2fa ? 'Processing...' : 'Deactivate 2FA'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {twoFactorStep === 'idle' ? (
                    <div className="bg-orange-50/15 border border-orange-100/50 p-5 rounded-xl space-y-3">
                      <p className="text-xs text-gray-500 leading-normal">
                        Keep malicious agents out. Activating Two-Factor Authentication (TOTP) guarantees that only you are authorized to sign in.
                      </p>
                      <button
                        type="button"
                        onClick={handleGenerate2faSecret}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 font-bold text-white text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Smartphone className="h-4 w-4" />
                        <span>Configure Authenticator App</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-orange-50/30 border border-orange-100/50 p-5 rounded-xl space-y-5">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-orange-900 block font-sans">Step 1: Set Up Authenticator Client</span>
                        <p className="text-xs text-gray-500 leading-normal">
                          Open Google Authenticator, Authy, or Microsoft Authenticator and add a profile manually with the security secret key shown below:
                        </p>
                      </div>

                      {/* Manual secret holder */}
                      <div className="flex items-center justify-between p-3 bg-white border border-gray-150 rounded-xl">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-tight">Manual Secret Key</span>
                          <code className="text-xs font-mono font-bold text-orange-600 tracking-wider select-all break-all">{generatedSecret}</code>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className="p-2 border border-gray-100 hover:border-orange-200 rounded-lg hover:bg-orange-50/50 text-gray-400 hover:text-orange-500 transition-colors cursor-pointer"
                        >
                          {copiedKey ? <Check className="h-4.5 w-4.5 text-emerald-500 animate-pulse" /> : <Copy className="h-4.5 w-4.5" />}
                        </button>
                      </div>

                      {/* Verification layout */}
                      <div className="space-y-3 pt-2">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-orange-900 block font-sans">Step 2: Authenticate Live Sync</span>
                          <p className="text-xs text-gray-500">Enter the current 6-digit confirmation key displayed in your app to activate:</p>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          <input
                            type="text"
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="6-Digit OTP"
                            className="w-36 px-4 py-2 border border-blue-100 bg-white rounded-xl text-center text-sm font-bold tracking-widest placeholder:tracking-normal placeholder:font-normal focus:outline-hidden focus:border-orange-500"
                          />
                          <button
                            type="button"
                            disabled={loading2fa || twoFactorCode.length !== 6}
                            onClick={handleEnable2faSubmit}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                          >
                            {loading2fa ? 'Securing...' : 'Verify & Enable'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setTwoFactorStep('idle')}
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline font-semibold cursor-pointer block pt-1.5"
                        >
                          Cancel Setup
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privacy Segment */}
        {activeSegment === 'privacy' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-base font-bold text-gray-900">Privacy & Balances Masking</h4>
              <p className="text-xs text-gray-400">Toggle privacy maskings to blur financial figures in public terminals</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50/60 rounded-xl border border-gray-100">
              <div className="space-y-1 pr-6 flex-1">
                <span className="text-sm font-bold text-gray-900 block">Blur Account Balances</span>
                <p className="text-xs text-gray-500 leading-normal">
                  When enabled, all BTC holdings and USD equivalents across your screens will be blurred out. Click the eye filter in top bars to instantly toggle.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={blurBalances}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setBlurBalances(next);
                    handleToggleSettings({ blurBalances: next });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>
        )}

        {/* Delivery Notices */}
        {activeSegment === 'notifications' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-base font-bold text-gray-900">Delivery Alert Preferences</h4>
              <p className="text-xs text-gray-400">Toggle alerts delivery switches for security updates, payments, and newsletters</p>
            </div>

            <div className="space-y-4 divide-y divide-gray-50">
              
              {/* Option 1: Deposits */}
              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5 flex-1 pr-4">
                  <span className="text-sm font-semibold text-gray-900">Deposit confirmations</span>
                  <span className="text-xs text-gray-400 block font-normal">Receive alerts once NOWPayments logs clear block validation</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyDepositConfirm}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setNotifyDepositConfirm(next);
                      handleToggleSettings({ notifyDepositConfirm: next });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {/* Option 2: Withdraws */}
              <div className="flex items-center justify-between py-3 pt-4">
                <div className="space-y-0.5 flex-1 pr-4">
                  <span className="text-sm font-semibold text-gray-900">Withdrawal updates</span>
                  <span className="text-xs text-gray-400 block font-normal">Notify me when cash-out logs process or receive administrative reviews</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyWithdrawUpdate}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setNotifyWithdrawUpdate(next);
                      handleToggleSettings({ notifyWithdrawUpdate: next });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {/* Option 3: Security */}
              <div className="flex items-center justify-between py-3 pt-4">
                <div className="space-y-0.5 flex-1 pr-4">
                  <span className="text-sm font-semibold text-gray-900">Security alerts</span>
                  <span className="text-xs text-gray-400 block font-normal">Receive notice upon password modifications, admin notes or password resets</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifySecurityAlert}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setNotifySecurityAlert(next);
                      handleToggleSettings({ notifySecurityAlert: next });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {/* Option 4: Promos */}
              <div className="flex items-center justify-between py-3 pt-4">
                <div className="space-y-0.5 flex-1 pr-4">
                  <span className="text-sm font-semibold text-gray-900">Promotional updates</span>
                  <span className="text-xs text-gray-400 block font-normal">Allow marketing newsletters, discount announcements or new plan arrivals</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyPromotions}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setNotifyPromotions(next);
                      handleToggleSettings({ notifyPromotions: next });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {/* BTC Target Price notification threshold segment */}
              <div className="pt-6 mt-6 border-t border-gray-150">
                <div className="bg-orange-50/40 rounded-2xl border border-orange-100 p-5 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-orange-100/60 rounded-xl text-orange-600 mt-0.5">
                      <BellRing className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-gray-900">Custom Target BTC Price Alert</h5>
                      <p className="text-xs text-gray-500 leading-normal mt-0.5">
                        Configure a custom target Bitcoin price threshold. Our system will automatically trigger a delivery alert notification as soon as the market price reaches your specified value.
                      </p>
                    </div>
                  </div>

                  {profile.settings?.targetBtcPrice ? (
                    <div className="bg-white rounded-xl border border-orange-100/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Active Target Alert</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-extrabold text-neutral-900">
                            ${Number(profile.settings.targetBtcPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            profile.settings.targetBtcPriceDirection === 'above' 
                              ? 'bg-emerald-50 text-emerald-600' 
                              : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            Triggers if goes {profile.settings.targetBtcPriceDirection === 'above' ? 'Above' : 'Below'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelTargetBtcPrice}
                        disabled={savingTarget}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer select-none transition-all flex items-center justify-center space-x-1.5"
                      >
                        {savingTarget ? <Loader className="animate-spin h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        <span>Cancel Alert</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTargetBtcPrice} className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <span className="text-gray-400 text-sm font-bold">$</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          required
                          value={targetBtcPrice}
                          onChange={(e) => setTargetBtcPrice(e.target.value)}
                          placeholder="e.g. 75,000"
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 focus:border-orange-500 rounded-xl text-sm font-bold text-gray-900"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingTarget}
                        className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl cursor-pointer select-none transition-all flex items-center justify-center space-x-1.5 shrink-0 shadow-xs hover:shadow-md"
                      >
                        {savingTarget ? <Loader className="animate-spin h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                        <span>Set Alert Threshold</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
