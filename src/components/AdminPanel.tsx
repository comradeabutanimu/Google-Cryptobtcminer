/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, Download, Upload, Cpu, Volume2, Shield, Search, 
  Check, X, Ban, Eye, Settings, Plus, Trash, ShieldCheck, 
  Terminal, Sliders, Briefcase, FileText, Database, ShieldAlert
} from 'lucide-react';
import { Profile, Plan, Transaction, Deposit, Withdrawal, Announcement } from '../types.js';
import { api } from '../lib/api.js';

interface AdminPanelProps {
  toast: (msg: string, type: 'success' | 'error') => void;
}

export default function AdminPanel({ toast }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'withdrawals' | 'deposits' | 'plans' | 'announcements' | 'database'>('users');
  const [loading, setLoading] = useState(false);

  // Database Tab state
  const [dbImporting, setDbImporting] = useState(false);
  const [dbExporting, setDbExporting] = useState(false);

  // Users Tab state
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userBalances, setUserBalances] = useState<{ [key: string]: string }>({});
  
  // User Detail modal
  const [detailUser, setDetailUser] = useState<Profile | null>(null);
  const [detailHistory, setDetailHistory] = useState<{
    transactions: Transaction[];
    activity_logs: any[];
    deposits: Deposit[];
    withdrawals: Withdrawal[];
  } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Withdrawals tab state
  const [withdrawals, setWithdrawals] = useState<(Withdrawal & { user_email: string })[]>([]);
  const [withdrawFilter, setWithdrawFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Deposits tab state
  const [deposits, setDeposits] = useState<(Deposit & { user_email: string })[]>([]);

  // Plans tab state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editedPlans, setEditedPlans] = useState<{ [key: string]: Partial<Plan> }>({});
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  // Add plan form
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanHashRate, setNewPlanHashRate] = useState('');
  const [newPlanDailyEarn, setNewPlanDailyEarn] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('90');

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncementText, setNewAnnouncementText] = useState('');

  // Initial loader
  useEffect(() => {
    loadTabContent();
  }, [activeTab]);

  const loadTabContent = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await api.admin.getUsers();
        setUsers(res);
        // seed inline balance inputs state
        const bals: { [key: string]: string } = {};
        res.forEach((u: Profile) => {
          bals[u.id] = u.btc_balance.toString();
        });
        setUserBalances(bals);
      } else if (activeTab === 'withdrawals') {
        const res = await api.admin.getWithdrawals();
        setWithdrawals(res);
      } else if (activeTab === 'deposits') {
        const res = await api.admin.getDeposits();
        setDeposits(res);
      } else if (activeTab === 'plans') {
        const res = await api.admin.getPlans();
        setPlans(res);
      } else if (activeTab === 'announcements') {
        const res = await api.admin.getAnnouncements();
        setAnnouncements(res);
      } else if (activeTab === 'database') {
        // No data fetching required for stats/config layout
      }
    } catch (err: any) {
      toast(err.message || 'Error syncing dashboard panels.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // User details loader
  const handleOpenUserDetail = async (user: Profile) => {
    setLoading(true);
    try {
      const details = await api.admin.getUserDetail(user.id);
      setDetailUser(user);
      setDetailHistory(details);
      setAdminNote(user.admin_note || '');
      setEditEmail(user.email);
    } catch (err: any) {
      toast('Failed to load user historical logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserNote = async () => {
    if (!detailUser) return;
    try {
      const res = await api.admin.updateUserNote(detailUser.id, adminNote);
      if (res.success) {
        toast('Admin operational note saved successfully.', 'success');
        // Refresh detail users local cache list
        setUsers(users.map(u => u.id === detailUser.id ? { ...u, admin_note: adminNote } : u));
        setDetailUser({ ...detailUser, admin_note: adminNote });
      }
    } catch (err) {
      toast('Failed to update admin notes.', 'error');
    }
  };

  // Inline users modify actions
  const handleSaveUserBalance = async (userId: string) => {
    const rawAmt = userBalances[userId];
    const num = parseFloat(rawAmt);
    if (isNaN(num) || num < 0) {
      return toast('Please enter a valid numeric Bitcoin balance.', 'error');
    }
    try {
      const res = await api.admin.updateUserBalance(userId, num);
      if (res.success) {
        toast('User holding balance updated successfully!', 'success');
        setUsers(users.map(u => u.id === userId ? { ...u, btc_balance: num } : u));
      }
    } catch (err) {
      toast('Balance update failed.', 'error');
    }
  };

  const handleToggleSuspend = async (user: Profile) => {
    try {
      const nextState = !user.is_suspended;
      const res = await api.admin.updateUserSuspend(user.id, nextState);
      if (res.success) {
        toast(`User ${user.email} was successfully ${nextState ? 'SUSPENDED' : 'UNSUSPENDED'}.`, 'success');
        setUsers(users.map(u => u.id === user.id ? { ...u, is_suspended: nextState } : u));
      }
    } catch (err: any) {
      toast(err.message || 'Failed suspension toggle.', 'error');
    }
  };

  const handleToggleAdminRights = async (user: Profile) => {
    try {
      const nextState = !user.is_admin;
      const res = await api.admin.updateUserAdmin(user.id, nextState);
      if (res.success) {
        toast(`Administrator rights updated for ${user.email}!`, 'success');
        setUsers(users.map(u => u.id === user.id ? { ...u, is_admin: nextState } : u));
      }
    } catch (err: any) {
      toast(err.message || 'Permission amendment prohibited.', 'error');
    }
  };

  // Action withdrawals
  const handleActionWithdrawal = async (wdId: string, isApproval: boolean) => {
    try {
      const statusSelected = isApproval ? 'approved' : 'rejected';
      const res = await api.admin.actionWithdrawal(wdId, statusSelected);
      if (res.success) {
        toast(`Withdrawal request marked ${statusSelected} successfully!`, 'success');
        loadTabContent(); // Refresh withdrawals
      }
    } catch (err: any) {
      toast(err.message || 'Action failed on payout.', 'error');
    }
  };

  // Manual Deposit Overrides
  const handleConfirmDepositOverride = async (depId: string) => {
    try {
      const res = await api.admin.confirmDeposit(depId);
      if (res.success) {
        toast('Invoice status forced to completed. Credited coins to client user balance!', 'success');
        loadTabContent(); // Refresh deposits
      }
    } catch (err: any) {
      toast(err.message || 'Override override aborted.', 'error');
    }
  };

  // Plans Management
  const handleStartEditPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setEditedPlans({
      ...editedPlans,
      [plan.id]: {
        name: plan.name,
        price_btc: plan.price_btc,
        hash_rate: plan.hash_rate,
        daily_earn_btc: plan.daily_earn_btc,
        duration_days: plan.duration_days,
        is_active: plan.is_active
      }
    });
  };

  const handleSavePlan = async (planId: string) => {
    const changes = editedPlans[planId];
    if (!changes) return;

    try {
      const res = await api.admin.editPlan({ id: planId, ...changes });
      if (res.success) {
        toast('Membership mining plan changes sync complete.', 'success');
        setEditingPlanId(null);
        loadTabContent();
      }
    } catch (err: any) {
      toast(err.message || 'Error updating plan options.', 'error');
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pB = parseFloat(newPlanPrice);
      const dy = parseFloat(newPlanDailyEarn);
      const dur = parseInt(newPlanDuration);

      if (!newPlanName || isNaN(pB) || !newPlanHashRate || isNaN(dy)) {
        throw new Error('Please populate all options.');
      }

      const res = await api.admin.addPlan({
        name: newPlanName,
        price_btc: pB,
        hash_rate: newPlanHashRate,
        daily_earn_btc: dy,
        duration_days: dur
      });

      if (res.success) {
        toast(`New cloud mining node plan '${newPlanName}' successfully pre-loaded.`, 'success');
        setShowAddPlanModal(false);
        setNewPlanName('');
        setNewPlanPrice('');
        setNewPlanHashRate('');
        setNewPlanDailyEarn('');
        loadTabContent();
      }
    } catch (err: any) {
      toast(err.message || 'Failed to create plan.', 'error');
    }
  };

  // Announcements Management
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementText.trim()) return;
    try {
      const res = await api.admin.createAnnouncement(newAnnouncementText);
      if (res.success) {
        toast('Campaign message dispatched across overview dashboards!', 'success');
        setNewAnnouncementText('');
        loadTabContent();
      }
    } catch (err: any) {
      toast('Campaign broadcast failure.', 'error');
    }
  };

  const handleToggleAnnouncement = async (ann: Announcement) => {
    try {
      const nextToggle = !ann.is_active;
      const res = await api.admin.toggleAnnouncement(ann.id, nextToggle);
      if (res.success) {
        toast(`Announcement is now ${nextToggle ? 'ENABLED' : 'DISABLED'}.`, 'success');
        setAnnouncements(announcements.map(a => a.id === ann.id ? { ...a, is_active: nextToggle } : a));
      }
    } catch (err) {
      toast('Failed toggle announcement.', 'error');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const res = await api.admin.deleteAnnouncement(id);
      if (res.success) {
        toast('Selected announcement deleted.', 'success');
        setAnnouncements(announcements.filter(a => a.id !== id));
      }
    } catch (err) {
      toast('Failed deletion.', 'error');
    }
  };

  const handleExportDatabase = async () => {
    setDbExporting(true);
    try {
      const data = await api.admin.exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cryptobtc_database_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('Database backup JSON exported successfully! Keep this file safe.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to export database backup.', 'error');
    } finally {
      setDbExporting(false);
    }
  };

  const handleImportDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Importing a database backup will merge/overwrite the current active memory state. Are you sure you want to proceed?')) {
      e.target.value = '';
      return;
    }

    setDbImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          await api.admin.importDatabase(parsed);
          toast('Database backup JSON successfully imported and synced!', 'success');
          loadTabContent(); // reload dashboards
        } catch (err: any) {
          toast(err.message || 'Invalid JSON format in the backup file.', 'error');
        } finally {
          setDbImporting(false);
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      toast(err.message || 'Failed to read backup file.', 'error');
      setDbImporting(false);
      e.target.value = '';
    }
  };

  // Filtering users query locally
  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter withdrawals
  const filteredWds = withdrawals.filter(w => {
    if (withdrawFilter === 'all') return true;
    return w.status === withdrawFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Upper operations core bar */}
      <div className="bg-neutral-900 text-white rounded-2xl p-6 border border-neutral-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-orange-500 rounded-xl">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <span className="text-sm font-bold tracking-widest uppercase text-orange-400">Master Operations Center</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mt-1.5">Platform Command Portal</h2>
        </div>

        {/* Action Panel Tabs Selector */}
        <div className="flex flex-wrap gap-1.5 bg-neutral-800/80 p-1.5 rounded-xl border border-neutral-700/50">
          {[
            { id: 'users', label: 'Users', icon: <Users className="h-3.5 w-3.5" /> },
            { id: 'withdrawals', label: 'Withdraws', icon: <Upload className="h-3.5 w-3.5" /> },
            { id: 'deposits', label: 'Deposits', icon: <Download className="h-3.5 w-3.5" /> },
            { id: 'plans', label: 'Contracts', icon: <Cpu className="h-3.5 w-3.5" /> },
            { id: 'announcements', label: 'News', icon: <Volume2 className="h-3.5 w-3.5" /> },
            { id: 'database', label: 'Database Sync', icon: <Database className="h-3.5 w-3.5" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20">
          <svg className="animate-spin h-8 w-8 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">

          {/* ==================== TABS 1: USERS SECTION ==================== */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
              
              {/* Search filter bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900">User accounts & wallets</h4>
                  <p className="text-xs text-gray-400">Total users registered: {users.length}</p>
                </div>
                
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by full name or email..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-gray-100 rounded-xl focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-4">Joined date</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4 text-right" style={{ minWidth: '160px' }}>BTC Balance</th>
                      <th className="py-3 px-4 text-center">Plan</th>
                      <th className="py-3 px-4 text-center">Suspended</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-4 whitespace-nowrap font-mono text-gray-400">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 font-semibold text-gray-900">
                            <div className="flex flex-col">
                              <span>{user.email}</span>
                              <span className="text-[10px] text-gray-400 font-mono font-normal">{user.id}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-semibold text-gray-900">{user.full_name}</td>
                          
                          {/* Inline balance edit as requested */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1 border border-gray-100/80 rounded-lg overflow-hidden bg-gray-50/50 focus-within:ring-2 focus-within:ring-orange-500/20">
                              <span className="text-[10px] font-bold pl-2 text-gray-400 font-mono">₿</span>
                              <input
                                type="text"
                                value={userBalances[user.id] || '0.00000000'}
                                onChange={(e) => setUserBalances({ ...userBalances, [user.id]: e.target.value })}
                                className="w-24 px-1 text-right font-mono font-bold text-xs bg-transparent outline-hidden"
                              />
                              <button
                                onClick={() => handleSaveUserBalance(user.id)}
                                className="bg-orange-50 text-orange-500 hover:bg-orange-100 px-2 py-1 font-extrabold text-[10px] uppercase border-l border-gray-100 cursor-pointer"
                                title="Press to Save modified balance in database"
                              >
                                Save
                              </button>
                            </div>
                          </td>

                          {/* Plan pill */}
                          <td className="py-4 px-4 text-center font-bold font-sans uppercase">
                            <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100">
                              {user.active_plan === 'plan_free' ? 'Free' : 
                               user.active_plan === 'plan_starter' ? 'Starter' :
                               user.active_plan === 'plan_pro' ? 'Pro' :
                               user.active_plan === 'plan_vip' ? 'VIP' : 'Inactive'}
                            </span>
                          </td>

                          {/* Suspended toggle pill */}
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => handleToggleSuspend(user)}
                              className={`inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer leading-5 select-none uppercase ${
                                user.is_suspended
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                  : 'bg-neutral-900 text-neutral-100'
                              }`}
                            >
                              {user.is_suspended ? 'YES Suspended' : 'NO Active'}
                            </button>
                          </td>

                          {/* Quick details */}
                          <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenUserDetail(user)}
                              className="px-2 py-1 text-[10px] font-bold bg-gray-50 text-gray-600 hover:text-gray-900 border border-gray-100 rounded-lg cursor-pointer"
                            >
                              View Detail
                            </button>
                            <button
                              onClick={() => handleToggleAdminRights(user)}
                              className={`px-2 py-1 text-[10px] font-bold border rounded-lg cursor-pointer capitalize ${
                                user.is_admin
                                  ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600'
                                  : 'bg-white border-gray-100 text-gray-500 hover:text-gray-900'
                              }`}
                            >
                              {user.is_admin ? 'Supervisor Admin' : 'Make Admin'}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400">
                          Search returned zero profiles matching query values.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== TABS 2: WITHDRAWALS ==================== */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-6">
              
              {/* Info summary boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Accumulated Pending Cash-outs</span>
                    <h2 className="text-2xl font-extrabold text-orange-500 font-mono tracking-tight mt-1">
                      {withdrawals.filter(w => w.status === 'pending').length} requests
                    </h2>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <Upload className="h-5 w-5 text-orange-500" />
                  </div>
                </div>

                {/* status classification filter */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Filter Ledger:</span>
                  <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setWithdrawFilter(f)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                          withdrawFilter === f ? 'bg-white text-orange-500 shadow-xs' : 'text-gray-500'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ledger ledger */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        <th className="py-3 px-4">When</th>
                        <th className="py-3 px-4">User Email</th>
                        <th className="py-3 px-4 text-right">Sum requested (BTC)</th>
                        <th className="py-3 px-4">Receiving address</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Amends Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {filteredWds.length > 0 ? (
                        filteredWds.map(wd => (
                          <tr key={wd.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-4 font-mono text-gray-400 whitespace-nowrap">
                              {new Date(wd.created_at).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 font-bold text-gray-900">{wd.user_email}</td>
                            <td className="py-4 px-4 text-right font-bold text-sky-600 font-mono">
                              {wd.amount_btc.toFixed(8)} BTC
                            </td>
                            <td className="py-4 px-4 font-mono text-xs text-gray-500 font-semibold">{wd.wallet_address}</td>
                            <td className="py-4 px-4 text-center font-bold">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] uppercase ${
                                wd.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                wd.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                                'bg-amber-50 text-amber-600 animate-pulse'
                              }`}>
                                {wd.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap space-x-1">
                              {wd.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleActionWithdrawal(wd.id, true)}
                                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-1 font-bold rounded-lg cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleActionWithdrawal(wd.id, false)}
                                    className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1 font-bold rounded-lg cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-400 block leading-tight text-right">
                                  Actioned by:<br/>
                                  <strong className="text-gray-600">{wd.actioned_by}</strong>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-gray-400">
                            No withdrawals recorded for this selection filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ==================== TABS 3: DEPOSITS OVERRIDES ==================== */}
          {activeTab === 'deposits' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Deposits logged</span>
                    <h2 className="text-2xl font-extrabold text-[#F97316] font-mono tracking-tight mt-1">
                      {deposits.length} invoices
                    </h2>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <Download className="h-5 w-5 text-orange-500" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Blocked Pending Verification</span>
                    <h2 className="text-2xl font-extrabold text-amber-500 font-mono tracking-tight mt-1">
                      {deposits.filter(d => d.status === 'pending').length} invoices
                    </h2>
                  </div>
                  <div className="w-10 h-10 bg-amber-55 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Sliders className="h-5 w-5 text-amber-500 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        <th className="py-3 px-4">When</th>
                        <th className="py-3 px-4">User email</th>
                        <th className="py-3 px-4 text-right">Sum USD ($)</th>
                        <th className="py-3 px-4 text-right">Sum BTC (₿)</th>
                        <th className="py-3 px-4">Invoice ID</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Diagnostic Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {deposits.length > 0 ? (
                        deposits.map(dep => (
                          <tr key={dep.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-4 font-mono text-gray-400 whitespace-nowrap">
                              {new Date(dep.created_at).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 font-bold text-gray-900">{dep.user_email}</td>
                            <td className="py-4 px-4 text-right font-medium text-gray-600">${dep.amount_usd}</td>
                            <td className="py-4 px-4 text-right font-bold text-emerald-600 font-mono">
                              ₿ {dep.amount_btc.toFixed(8)}
                            </td>
                            <td className="py-4 px-4 font-mono text-gray-400 text-[10px] whitespace-nowrap">{dep.invoice_id}</td>
                            <td className="py-4 px-4 text-center font-bold">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] uppercase ${
                                dep.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' :
                                dep.status === 'failed' ? 'bg-rose-50 text-rose-600' :
                                'bg-amber-50 text-amber-500 animate-pulse'
                              }`}>
                                {dep.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {dep.status === 'pending' ? (
                                <button
                                  onClick={() => handleConfirmDepositOverride(dep.id)}
                                  className="bg-orange-50 hover:bg-orange-100 border border-orange-150 inline-flex items-center px-3 py-1 font-bold text-[#F97316] rounded-lg cursor-pointer"
                                  title="Manually force confirmation and credit user balance"
                                >
                                  Mark confirmed
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-400">No deposits recorded on platform ledger.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ==================== TABS 4: PRODUCTS CONTRACTS ==================== */}
          {activeTab === 'plans' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
              
              {/* Head addition action */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Custom Cloud Plans config</h4>
                  <p className="text-xs text-gray-400">Configure catalog prices, duration terms and hashing speeds</p>
                </div>

                <button
                  onClick={() => setShowAddPlanModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white px-4 py-2.5 rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add new plan</span>
                </button>
              </div>

              {/* Plans catalog list table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-4">Plan Name</th>
                      <th className="py-3 px-4 text-right">Price (BTC)</th>
                      <th className="py-3 px-4">Hash rate output</th>
                      <th className="py-3 px-4 text-right">Earning yield (BTC/day)</th>
                      <th className="py-3 px-4 text-center">Expiry (days)</th>
                      <th className="py-3 px-4 text-center">Active status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs font-semibold">
                    {plans.map(p => {
                      const isEdit = editingPlanId === p.id;
                      const model = {
                        name: p.name,
                        price_btc: p.price_btc,
                        hash_rate: p.hash_rate,
                        daily_earn_btc: p.daily_earn_btc,
                        duration_days: p.duration_days,
                        is_active: p.is_active,
                        ...(editedPlans[p.id] || {})
                      };

                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          
                          {/* Name edit */}
                          <td className="py-4 px-4 font-bold text-gray-900 text-sm">
                            {isEdit ? (
                              <input
                                type="text"
                                value={model.name || ''}
                                onChange={(e) => setEditedPlans({
                                  ...editedPlans,
                                  [p.id]: { ...model, name: e.target.value }
                                })}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-28 text-gray-900"
                              />
                            ) : (
                              <span>{p.name}</span>
                            )}
                          </td>

                          {/* Price edit */}
                          <td className="py-4 px-4 text-right font-mono font-bold">
                            {isEdit ? (
                              <input
                                type="number"
                                step="0.001"
                                value={model.price_btc || 0}
                                onChange={(e) => setEditedPlans({
                                  ...editedPlans,
                                  [p.id]: { ...model, price_btc: parseFloat(e.target.value) }
                                })}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-20 text-right font-mono"
                              />
                            ) : (
                              <span>{p.price_btc === 0 ? 'Free' : `${p.price_btc} BTC`}</span>
                            )}
                          </td>

                          {/* Hashrate edit */}
                          <td className="py-4 px-4 text-gray-600">
                            {isEdit ? (
                              <input
                                type="text"
                                value={model.hash_rate || ''}
                                onChange={(e) => setEditedPlans({
                                  ...editedPlans,
                                  [p.id]: { ...model, hash_rate: e.target.value }
                                })}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-24 text-gray-900"
                              />
                            ) : (
                              <span>{p.hash_rate}</span>
                            )}
                          </td>

                          {/* yield edit */}
                          <td className="py-4 px-4 text-right font-mono text-emerald-600 font-bold">
                            {isEdit ? (
                              <input
                                type="number"
                                step="0.000001"
                                value={model.daily_earn_btc || 0}
                                onChange={(e) => setEditedPlans({
                                  ...editedPlans,
                                  [p.id]: { ...model, daily_earn_btc: parseFloat(e.target.value) }
                                })}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-28 text-right font-mono text-emerald-600"
                              />
                            ) : (
                              <span>{p.daily_earn_btc.toFixed(8)} BTC</span>
                            )}
                          </td>

                          {/* duration edit */}
                          <td className="py-4 px-4 text-center text-gray-500 font-mono">
                            {isEdit ? (
                              <input
                                type="number"
                                value={model.duration_days || 30}
                                onChange={(e) => setEditedPlans({
                                  ...editedPlans,
                                  [p.id]: { ...model, duration_days: parseInt(e.target.value) }
                                })}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-16 text-center font-mono"
                              />
                            ) : (
                              <span>{p.duration_days} days</span>
                            )}
                          </td>

                          {/* status edit toggle */}
                          <td className="py-4 px-4 text-center">
                            {isEdit ? (
                              <input
                                type="checkbox"
                                checked={model.is_active || false}
                                onChange={(e) => setEditedPlans({
                                  ...editedPlans,
                                  [p.id]: { ...model, is_active: e.target.checked }
                                })}
                                className="rounded border-gray-200 focus:ring-orange-500 text-orange-500"
                              />
                            ) : (
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] uppercase font-bold ${
                                p.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {p.is_active ? 'Enabled' : 'Disabled'}
                              </span>
                            )}
                          </td>

                          {/* actions plans */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            {isEdit ? (
                              <div className="flex justify-end space-x-1">
                                <button
                                  onClick={() => handleSavePlan(p.id)}
                                  className="bg-emerald-500 text-white hover:bg-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingPlanId(null)}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-500 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditPlan(p)}
                                className="bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                              >
                                Edit config
                              </button>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== TABS 5: ANNOUNCEMENTS MESSAGES ==================== */}
          {activeTab === 'announcements' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Form poster left */}
              <div className="md:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Broadcast Campaign Poster</h4>
                  <p className="text-xs text-gray-400">Post notifications displayed across all user overview dashboards</p>
                </div>

                <form onSubmit={handlePostAnnouncement} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Message Body</label>
                    <textarea
                      required
                      value={newAnnouncementText}
                      onChange={(e) => setNewAnnouncementText(e.target.value)}
                      placeholder="e.g. Server updates check underway. Miners are operating uninterruptedly..."
                      className="w-full px-4.5 py-3 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-semibold leading-relaxed h-32 outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-600 font-bold text-white text-xs py-3.5 px-4 rounded-xl cursor-pointer text-center flex items-center justify-center space-x-1 shadow-xs hover:shadow-md transition-all"
                  >
                    <Sliders className="h-4 w-4" />
                    <span>Post Live Broadcast</span>
                  </button>
                </form>
              </div>

              {/* Announcements list right */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
                <h4 className="text-base font-bold text-gray-900">Historical publications list</h4>
                
                <div className="space-y-4">
                  {announcements.length > 0 ? (
                    announcements.map(ann => (
                      <div key={ann.id} className="p-4 border border-gray-50 bg-gray-50/50 rounded-xl flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-xs text-gray-700 font-semibold leading-normal">{ann.message}</p>
                          <span className="block text-[10px] text-gray-400 font-mono">Posted: {new Date(ann.created_at).toLocaleString()}</span>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {/* Active toggle */}
                          <button
                            onClick={() => handleToggleAnnouncement(ann)}
                            className={`px-2 py-1 text-[9px] font-extrabold rounded-md cursor-pointer border uppercase tracking-wider ${
                              ann.is_active
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                : 'bg-gray-100 border-gray-200 text-gray-500'
                            }`}
                          >
                            {ann.is_active ? 'Active' : 'Muted'}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">No active broadcast campaigns logged.</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ==================== TABS 6: DATABASE ADMIN SYNC SECTION ==================== */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              
              {/* Main info banner */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
                <div className="flex items-start space-x-3.5">
                  <span className="p-3 bg-rose-50 rounded-xl mt-1 text-rose-500 shrink-0">
                    <ShieldAlert className="h-6 w-6" />
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-gray-900">Prevent Deployment Wipes & Manage Persistence</h4>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      This application is deployed as a stateless container. Every time you push a code change, a brand new container is provisioned. 
                      Since container local storage is completely ephemeral, any active user modifications, profiles, or deposits saved inside the temporary 
                      <code>/data/db.json</code> file will be replaced by the default repository file upon deploying.
                    </p>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      To prevent this permanently, you should configure a cloud-hosted database like <strong>Supabase</strong> by setting up 
                      <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in your environment variables. 
                      If you do not have Supabase configured yet, you can use the secure utility below to download a manual backup and restore it anytime in one click.
                    </p>
                  </div>
                </div>

                {/* Hot Action triggers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50 font-sans">
                  
                  {/* Export Panel */}
                  <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-100 space-y-3.5 flex flex-col justify-between">
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-800">1. Cold Database Export</h5>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                        Export your live production context (including user balances, accounts, and transaction histories) into a single, secure, human-readable JSON backup file. Keep this file stored privately.
                      </p>
                    </div>

                    <button
                      onClick={handleExportDatabase}
                      disabled={dbExporting}
                      className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 font-bold text-white text-xs py-3.5 rounded-xl cursor-pointer text-center flex items-center justify-center space-x-1.5 transition-colors mt-2"
                    >
                      <Download className="h-4 w-4 text-orange-500" />
                      <span>{dbExporting ? 'Generating Export...' : 'Download Database Backup (JSON)'}</span>
                    </button>
                  </div>

                  {/* Import Panel */}
                  <div className="p-5 bg-orange-50/20 rounded-xl border border-orange-100/50 space-y-3.5 flex flex-col justify-between">
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-orange-700">2. Restore Database State</h5>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed font-sans">
                        Restore or merge your saved JSON database state back into the active environment memory. If Supabase is connected, the system will automatically rebuild and sync all records in the cloud!
                      </p>
                    </div>

                    <div className="relative mt-2">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportDatabase}
                        disabled={dbImporting}
                        id="db-backup-upload"
                        className="hidden"
                      />
                      <label
                        htmlFor="db-backup-upload"
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-bold text-white text-xs py-3.5 rounded-xl cursor-pointer text-center flex items-center justify-center space-x-1.5 transition-colors shadow-xs hover:shadow-md block"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{dbImporting ? 'Processing Restore...' : 'Restore / Upload Backup (JSON)'}</span>
                      </label>
                    </div>
                  </div>

                </div>
              </div>

              {/* Supabase Schema Instructions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">Seamless Supabase Cloud Setup</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      To automate synchronization and achieve zero-maintenance durable persistence, run the following SQL statements inside the 
                      <strong>SQL Editor</strong> page of your Supabase project dashboard.
                    </p>
                    <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center">
                      <Check className="h-3.5 w-3.5 mr-1 shrink-0" />
                      Zero Destructive Queries: Safe to deploy alongside existing active tables.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const sqlCode = `-- --- MASTER CRYPTOBTC MINER DATABASE SETUP SCHEMA ---
-- Run this script inside your Supabase SQL Editor to instantly provision necessary tables.
-- DO NOT include any DROP TABLE commands to preserve and prevent overwriting existing structures!

-- Create Profile Schema
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  btc_balance DOUBLE PRECISION DEFAULT 0.0,
  active_plan TEXT,
  active_plan_investment DOUBLE PRECISION,
  active_plan_hash_rate DOUBLE PRECISION,
  active_plan_rate DOUBLE PRECISION,
  plan_activated_at TEXT,
  plan_expires_at TEXT,
  last_mining_at TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  referral_code TEXT,
  referred_by TEXT,
  admin_note TEXT,
  settings TEXT, -- JSON structure formatted as string
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  known_ips TEXT,
  created_at TEXT NOT NULL
);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_btc DOUBLE PRECISION NOT NULL,
  hash_rate TEXT NOT NULL,
  daily_earn_btc DOUBLE PRECISION NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  amount_btc DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_usd DOUBLE PRECISION,
  amount_btc DOUBLE PRECISION NOT NULL,
  invoice_id TEXT,
  nowpayments_payment_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_btc DOUBLE PRECISION NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL,
  actioned_by TEXT,
  actioned_at TEXT,
  created_at TEXT NOT NULL
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL
);`;
                      navigator.clipboard.writeText(sqlCode);
                      toast('Supabase SQL migration script copied to clipboard!', 'success');
                    }}
                    className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-3 py-2 rounded-lg cursor-pointer flex items-center space-x-1 uppercase transition-colors shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Copy Setup Script</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-500 font-mono">SUPABASE_PROVISIONING_SCHEMA.sql</span>
                  </div>

                  <pre className="p-4.5 bg-neutral-900 text-neutral-300 font-mono text-[10px] rounded-xl overflow-x-auto max-h-96 leading-relaxed border border-neutral-800">
{`-- --- MASTER CRYPTOBTC MINER DATABASE SETUP SCHEMA ---
-- Run this script inside your Supabase SQL Editor to instantly provision necessary tables.
-- DO NOT include any DROP TABLE commands to preserve and prevent overwriting existing structures!

-- Create Profile Schema
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  btc_balance DOUBLE PRECISION DEFAULT 0.0,
  active_plan TEXT,
  active_plan_investment DOUBLE PRECISION,
  active_plan_hash_rate DOUBLE PRECISION,
  active_plan_rate DOUBLE PRECISION,
  plan_activated_at TEXT,
  plan_expires_at TEXT,
  last_mining_at TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  referral_code TEXT,
  referred_by TEXT,
  admin_note TEXT,
  settings TEXT, -- JSON structure formatted as string
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  known_ips TEXT,
  created_at TEXT NOT NULL
);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_btc DOUBLE PRECISION NOT NULL,
  hash_rate TEXT NOT NULL,
  daily_earn_btc DOUBLE PRECISION NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  amount_btc DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_usd DOUBLE PRECISION,
  amount_btc DOUBLE PRECISION NOT NULL,
  invoice_id TEXT,
  nowpayments_payment_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_btc DOUBLE PRECISION NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL,
  actioned_by TEXT,
  actioned_at TEXT,
  created_at TEXT NOT NULL
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL
);`}
                  </pre>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==================== USER DETAIL MODAL POPUP ==================== */}
      {detailUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col h-[85vh]">
            
            {/* Modal Heading Head */}
            <div className="flex justify-between items-center px-6 py-4.5 bg-neutral-900 text-white">
              <div>
                <h3 className="text-base font-bold flex items-center">
                  <ShieldCheck className="text-orange-500 mr-2 h-5 w-5" />
                  <span>Profile Inspector Logs — {detailUser.email}</span>
                </h3>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">UID: {detailUser.id}</p>
              </div>
              <button
                onClick={() => { setDetailUser(null); setDetailHistory(null); }}
                className="text-neutral-400 hover:text-white p-1 border border-neutral-800 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scroll body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              {/* Top basic card splits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Details split */}
                <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-4.5 space-y-3.5 text-xs font-semibold flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold mb-3">General Profile info</span>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Full Name</span>
                        <span className="text-gray-900">{detailUser.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Joined Date</span>
                        <span className="text-gray-900">{new Date(detailUser.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current balance</span>
                        <span className="text-[#F97316] font-bold font-mono">₿ {detailUser.btc_balance.toFixed(8)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Referral code</span>
                        <span className="text-gray-700 font-mono text-[10px] bg-white px-1.5 border border-gray-100 rounded-md">{detailUser.referral_code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200/60 pt-3 mt-2 space-y-2">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold">Admin: Change Email</label>
                    <div className="flex space-x-1.5">
                      <input 
                        type="email" 
                        value={editEmail} 
                        onChange={(e) => setEditEmail(e.target.value)} 
                        placeholder="new-email@domain.com"
                        className="flex-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold outline-hidden focus:border-orange-500 bg-white" 
                      />
                      <button 
                        onClick={async () => {
                          if (!editEmail || !editEmail.includes('@')) {
                            return toast('Please enter a valid email address.', 'error');
                          }
                          try {
                            const res = await api.admin.updateUserEmail(detailUser.id, editEmail.trim().toLowerCase());
                            if (res.success || res.profile) {
                              toast('User email updated successfully!', 'success');
                              // Update local users lists
                              setUsers(users.map(u => u.id === detailUser.id ? { ...u, email: editEmail.trim().toLowerCase() } : u));
                              setDetailUser({ ...detailUser, email: editEmail.trim().toLowerCase() });
                            }
                          } catch (err: any) {
                            toast(err.message || 'Failed to update email address.', 'error');
                          }
                        }}
                        className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>

                {/* Operations logs notes */}
                <div className="border border-gray-100 rounded-xl p-4.5 md:col-span-2 flex flex-col justify-between whitespace-nowrap space-y-3">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold leading-none">Internal admin notes (Editable)</span>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Enter security notes or diagnostics details for this user..."
                    className="w-full flex-1 p-3 border border-gray-100 rounded-xl text-xs font-semibold leading-relaxed outline-hidden"
                  />
                  <div className="text-right">
                    <button
                      onClick={handleSaveUserNote}
                      className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      Save Admin Note
                    </button>
                  </div>
                </div>

              </div>

              {/* Logs history columns split */}
              {detailHistory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* Ledger transactions */}
                  <div className="space-y-3.5">
                    <div className="flex items-center space-x-1.5">
                      <FileText className="text-orange-500 h-4 w-4" />
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Payments Ledger lists ({detailHistory.transactions.length})</span>
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-y-auto max-h-56 divide-y divide-gray-50">
                      {detailHistory.transactions.length > 0 ? (
                        detailHistory.transactions.map((t, idx) => (
                          <div key={idx} className="p-3 text-[11px] hover:bg-gray-55/35 transition-colors flex justify-between items-center bg-gray-50/20">
                            <div>
                              <strong className="block text-gray-900 capitalize leading-tight">{t.type} info</strong>
                              <span className="text-[10px] text-gray-400 block font-mono mt-0.5 leading-none">{new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                            <span className={`font-mono font-bold ${t.type === 'withdrawal' ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {t.type === 'withdrawal' ? '-' : '+'}{t.amount_btc.toFixed(8)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-xs text-gray-400">No transaction records detected.</div>
                      )}
                    </div>
                  </div>

                  {/* Activity logs */}
                  <div className="space-y-3.5">
                    <div className="flex items-center space-x-1.5">
                      <Terminal className="text-orange-500 h-4 w-4" />
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Security Activity Audit ({detailHistory.activity_logs.length})</span>
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-y-auto max-h-56 divide-y divide-gray-50 font-semibold text-[11px] text-gray-600">
                      {detailHistory.activity_logs.length > 0 ? (
                        detailHistory.activity_logs.map((l, idx) => (
                          <div key={idx} className="p-3 hover:bg-gray-50/50 flex flex-col justify-between gap-1">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-extrabold text-neutral-900 uppercase tracking-wider bg-gray-50 px-2.5 py-0.5 border border-gray-100 rounded-md">{l.action}</span>
                              <span className="text-[9px] text-gray-400 font-mono">{new Date(l.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-normal font-medium mt-1">{l.details}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-xs text-gray-400">No activity logs recorded.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Modal bottom exit bar */}
            <div className="px-6 py-4.5 border-t border-gray-100 text-right bg-gray-50/50">
              <button
                onClick={() => { setDetailUser(null); setDetailHistory(null); }}
                className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== ADD PLAN CATALOGUE MODAL ==================== */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden border border-gray-100 flex flex-col">
            
            <div className="flex justify-between items-center px-6 py-4.5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Add New Cloud Mining Plan</h3>
                <p className="text-[10px] text-gray-400">Create entries to append into user options catalogue</p>
              </div>
              <button
                onClick={() => setShowAddPlanModal(false)}
                className="text-gray-400 hover:text-gray-900 p-1 border border-gray-100 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddPlan} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Plan Identifier Name</label>
                <input
                  type="text"
                  required
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. Master Enterprise"
                  className="w-full px-4.5 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Price (BTC)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(e.target.value)}
                    placeholder="e.50"
                    className="w-full px-4.5 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Hash power speed</label>
                  <input
                    type="text"
                    required
                    value={newPlanHashRate}
                    onChange={(e) => setNewPlanHashRate(e.target.value)}
                    placeholder="e.g. 50 TH/s"
                    className="w-full px-4.5 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Daily Yield (BTC)</label>
                  <input
                    type="number"
                    step="0.00000001"
                    required
                    value={newPlanDailyEarn}
                    onChange={(e) => setNewPlanDailyEarn(e.target.value)}
                    placeholder="0.015"
                    className="w-full px-4.5 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-mono font-bold text-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Duration Term (days)</label>
                  <input
                    type="number"
                    required
                    value={newPlanDuration}
                    onChange={(e) => setNewPlanDuration(e.target.value)}
                    placeholder="180"
                    className="w-full px-4.5 py-2.5 border border-gray-100 rounded-xl focus:border-orange-500 text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-3 rounded-xl cursor-pointer mt-2 text-center shadow-xs hover:shadow-md transition-colors"
              >
                Create Mining Plan Template
              </button>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
