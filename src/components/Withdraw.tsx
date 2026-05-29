/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Upload, HelpCircle, ShieldAlert } from 'lucide-react';
import { Profile } from '../types.js';
import { api } from '../lib/api.js';

interface WithdrawProps {
  profile: Profile;
  onWithdrawRequested: (profile: Profile) => void;
  toast: (msg: string, type: 'success' | 'error') => void;
}

export default function Withdraw({ profile, onWithdrawRequested, toast }: WithdrawProps) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const maxWithdraw = profile.btc_balance;
  const minWithdraw = 0.0001;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < minWithdraw) {
      return toast(`Minimum withdrawal amount is ${minWithdraw} BTC.`, 'error');
    }
    if (amt > maxWithdraw) {
      return toast('Insufficient BTC balance available.', 'error');
    }
    if (address.trim().length < 10) {
      return toast('Please submit a valid Bitcoin wallet address.', 'error');
    }

    setLoading(true);
    try {
      const res = await api.createWithdrawal({
        amount: amt,
        walletAddress: address
      });
      if (res.success) {
        onWithdrawRequested(res.profile);
        toast(`Withdrawal request for ${amt} BTC submitted successfully for admin review!`, 'success');
        setAmount('');
        setAddress('');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to submit withdrawal request.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 max-w-2xl mx-auto space-y-6">
      
      {/* Title */}
      <div>
        <h4 className="text-lg font-bold text-gray-900">Request BTC Cash-out</h4>
        <p className="text-xs text-gray-400">Withdraw your accrued cloud mining dividends to your secure Bitcoin wallet</p>
      </div>

      {/* Available Indicator */}
      <div className="p-4 bg-orange-50/30 border border-orange-100/50 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Available for Cash-out</span>
          <h2 className="text-2xl font-extrabold text-gray-900 font-mono tracking-tight mt-1">
            {profile.btc_balance.toFixed(8)} BTC
          </h2>
        </div>
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-xs">
          <Upload className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Inputs Form */}
      <form onSubmit={handleWithdraw} className="space-y-5">
        
        {/* Destination Wallet Address */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Bitcoin Destination Wallet Address</label>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkf35rvgmd"
            className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-mono font-semibold"
          />
          <span className="text-[10px] text-gray-400 block leading-normal">
            Supports standard BTC network transfer addresses (Bech32, SegWit, or Legacy).
          </span>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-400">
            <label>Amount (BTC)</label>
            <button
              type="button"
              onClick={() => setAmount(profile.btc_balance.toString())}
              className="text-orange-500 hover:text-orange-600 font-bold uppercase tracking-wide cursor-pointer text-[10px]"
            >
              Use Max
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              required
              step="0.000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.005"
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:border-orange-500 text-sm font-semibold font-mono"
            />
            <span className="absolute right-4 top-3 text-[10px] text-gray-400 font-semibold uppercase bg-gray-50 px-2 py-1 rounded-md">BTC</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Minimum cash-out: <strong>{minWithdraw} BTC</strong></span>
            <span>Fee: <strong>0.00005 BTC</strong> blockchain gas</span>
          </div>
        </div>

        {/* Security Alert Card */}
        <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/50 flex space-x-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-600 leading-normal font-normal">
            Bitcoin transactions are irreversible. Ensure you verify that your receiving address is entered correctly before submitting. Withdrawals are processed within 1–4 hours following approval checks.
          </p>
        </div>

        {/* Button */}
        <button
          type="submit"
          disabled={loading || !amount || !address}
          className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3.5 px-4 rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all duration-150 text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <LoaderIcon />
              <span>Processing Withdraw Request...</span>
            </>
          ) : (
            <span>Request Withdrawal</span>
          )}
        </button>

      </form>

    </div>
  );
}

function LoaderIcon() {
  return (
    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
