/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Users, Copy, Check, Gift, Coins, Trophy, Inbox } from 'lucide-react';
import { api } from '../lib/api.js';

interface ReferralRecord {
  name: string;
  email: string;
  date: string;
  status: string;
}

interface ReferralData {
  referral_code: string;
  total_referral_count: number;
  total_earned_btc: number;
  referrals: ReferralRecord[];
}

interface ReferralsProps {
  toast: (msg: string, type: 'success' | 'error') => void;
}

export default function Referrals({ toast }: ReferralsProps) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getReferrals();
        setData(res);
      } catch (err: any) {
        toast(err.message || 'Failed to fetch referral commission tables.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoaderIcon />
      </div>
    );
  }

  // Derive register URL
  const refereeUrl = `${window.location.origin}/register?ref=${data.referral_code}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(refereeUrl);
    setCopied(true);
    toast('Referral sign-up link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Upper Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card Left: Referral Link Copy */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-orange-50 rounded-lg">
                <Gift className="h-4.5 w-4.5 text-[#F97316]" />
              </span>
              <h4 className="text-base font-bold text-gray-900">Affiliate Referral Code</h4>
            </div>
            <p className="text-xs text-gray-400">Invite colleagues to CryptoBTC Miner! For every contract signup, you will immediately receive 0.0001 BTC as dividend cash bonuses!</p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Your Invitation Link</span>
            <div className="flex border border-gray-100 rounded-xl overflow-hidden focus-within:border-orange-500">
              <input
                type="text"
                readOnly
                value={refereeUrl}
                className="w-full px-4 py-3 bg-gray-50/50 text-[11px] text-gray-500 font-semibold font-mono outline-hidden select-all"
              />
              <button
                onClick={copyUrl}
                className="bg-gray-50 border-l border-gray-100 px-4 hover:text-orange-500 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
              >
                {copied ? <Check className="h-4.5 w-4.5 text-emerald-500" /> : <Copy className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Card Right: Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Subcard 1: Total Referrals */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex flex-col justify-between">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider block">Invited Miners</span>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-3xl font-extrabold text-gray-900 font-mono tracking-tight">
                {data.total_referral_count}
              </h2>
              <div className="w-8 h-8 bg-orange-55 bg-orange-50 rounded-xl flex items-center justify-center">
                <Users className="h-4 w-4 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Subcard 2: Commission earned */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex flex-col justify-between">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider block">Bonus Earnings</span>
            <div className="mt-4 flex flex-col justify-between">
              <h2 className="text-lg font-bold text-emerald-600 font-mono tracking-tight">
                ₿ {data.total_earned_btc.toFixed(8)}
              </h2>
              <span className="text-[10px] text-gray-400 mt-2 block font-normal">Credited instantly</span>
            </div>
          </div>

        </div>

      </div>

      {/* Referral Table Ledger */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-4">Your Invited Users</h4>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="py-3 px-4">User Email</th>
                <th className="py-3 px-4">Joined At</th>
                <th className="py-3 px-4 text-center">Status Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {data.referrals.length > 0 ? (
                data.referrals.map((ref, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    
                    {/* User */}
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      <div>
                        <span className="block">{ref.name}</span>
                        <span className="text-xs text-gray-400 block font-normal mt-0.5">{ref.email}</span>
                      </div>
                    </td>

                    {/* Joined Date */}
                    <td className="py-4 px-4 text-xs font-mono text-gray-500">
                      {new Date(ref.date).toLocaleDateString()}
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold leading-none ${
                        ref.status === 'Active Miner'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {ref.status}
                      </span>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <Trophy className="h-8 w-8 text-gray-200 mb-2" />
                      <p className="text-sm font-semibold text-gray-800">No referrals yet</p>
                      <p className="text-xs text-gray-400 mt-1">Copy and share your invitation code above to earn Bitcoin!</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function LoaderIcon() {
  return (
    <svg className="animate-spin h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
