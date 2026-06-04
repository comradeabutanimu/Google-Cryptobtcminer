/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple client-side api proxy for CryptoBTC Miner Express endpoints
let authToken = localStorage.getItem('cryptobtc_miner_token') || null;

export const setToken = (token: string) => {
  authToken = token;
  localStorage.setItem('cryptobtc_miner_token', token);
};

export const getToken = (): string | null => {
  return authToken;
};

export const clearToken = () => {
  authToken = null;
  localStorage.removeItem('cryptobtc_miner_token');
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  // Set JSON content-type by default
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Set Auth token if loaded
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.error || `HTTP error ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // BTC Market Rates Proxy
  getBtcPrice: () => request<{ btc_usd: number; change_24h: number }>('/api/rates/btc'),

  // Auth
  signup: (body: any) => request<any>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  sendSignupOtp: (body: any) => request<any>('/api/auth/send-otp', { method: 'POST', body: JSON.stringify(body) }),
  verifySignupOtp: (body: any) => request<any>('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  verify2FaLogin: (body: any) => request<any>('/api/auth/verify-2fa-login', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (email: string) => request<any>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (body: any) => request<any>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

  // User details
  getProfile: () => request<any>('/api/user/profile'),
  updateProfile: (body: any) => request<any>('/api/user/profile/update', { method: 'POST', body: JSON.stringify(body) }),
  changePassword: (body: any) => request<any>('/api/user/change-password', { method: 'POST', body: JSON.stringify(body) }),
  saveLanguage: (language: string) => request<any>('/api/user/language', { method: 'POST', body: JSON.stringify({ language }) }),
  generate2Fa: () => request<any>('/api/user/generate-2fa', { method: 'POST' }),
  enable2Fa: (body: any) => request<any>('/api/user/enable-2fa', { method: 'POST', body: JSON.stringify(body) }),
  disable2Fa: (body: any) => request<any>('/api/user/disable-2fa', { method: 'POST', body: JSON.stringify(body) }),

  // Logs and notifications
  getNotifications: () => request<any[]>('/api/notifications'),
  readNotifications: () => request<any>('/api/notifications/read', { method: 'POST' }),
  getTransactions: () => request<any[]>('/api/transactions'),
  getActivityLogs: () => request<any[]>('/api/activity-logs'),
  getReferrals: () => request<any>('/api/referrals'),
  getAnnouncements: () => request<any[]>('/api/announcements'),

  // Financial steps
  createDeposit: (body: any) => request<any>('/api/deposit/create', { method: 'POST', body: JSON.stringify(body) }),
  createUsdtDeposit: (body: { currency: string; amount: number }) => request<any>('/api/deposit/nowpayments-usdt', { method: 'POST', body: JSON.stringify(body) }),
  getDepositStatus: (invoiceId: string) => request<any>(`/api/deposit/status/${invoiceId}`),
  sandboxTriggerConfirm: (invoiceId: string) => request<any>('/api/deposit/sandbox-trigger-confirm', { method: 'POST', body: JSON.stringify({ invoiceId }) }),
  createWithdrawal: (body: any) => request<any>('/api/withdraw', { method: 'POST', body: JSON.stringify(body) }),
  swapUsdToBtc: (amountUsd: number) => request<any>('/api/user/swap/usd-to-btc', { method: 'POST', body: JSON.stringify({ amountUsd }) }),
  createUsdtWithdrawal: (body: { amountUsd: number; walletAddress: string }) => request<any>('/api/withdraw/usdt', { method: 'POST', body: JSON.stringify(body) }),
  activatePlan: (planId: string) => request<any>('/api/user/plan/activate', { method: 'POST', body: JSON.stringify({ planId }) }),

  // Plans public access 
  getPlans: () => request<any[]>('/api/plans'),

  // Admin controls
  admin: {
    getUsers: () => request<any[]>('/api/admin/users'),
    updateUserBalance: (userId: string, balance: number) => request<any>(`/api/admin/users/${userId}/balance`, { method: 'POST', body: JSON.stringify({ btc_balance: balance }) }),
    updateUserSuspend: (userId: string, isSuspended: boolean) => request<any>(`/api/admin/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ is_suspended: isSuspended }) }),
    updateUserAdmin: (userId: string, isAdmin: boolean) => request<any>(`/api/admin/users/${userId}/admin`, { method: 'POST', body: JSON.stringify({ is_admin: isAdmin }) }),
    updateUserEmail: (userId: string, email: string) => request<any>(`/api/admin/users/${userId}/email`, { method: 'POST', body: JSON.stringify({ email }) }),
    updateUserNote: (userId: string, note: string) => request<any>(`/api/admin/users/${userId}/note`, { method: 'POST', body: JSON.stringify({ note }) }),
    getUserDetail: (userId: string) => request<any>(`/api/admin/users/${userId}/detail`),

    getWithdrawals: () => request<any[]>('/api/admin/withdrawals'),
    actionWithdrawal: (withdrawId: string, status: 'approved' | 'rejected') => request<any>(`/api/admin/withdrawals/${withdrawId}/action`, { method: 'POST', body: JSON.stringify({ status }) }),

    getDeposits: () => request<any[]>('/api/admin/deposits'),
    confirmDeposit: (depositId: string) => request<any>(`/api/admin/deposits/${depositId}/confirm`, { method: 'POST' }),

    getPlans: () => request<any[]>('/api/admin/plans'),
    editPlan: (body: any) => request<any>('/api/admin/plans/edit', { method: 'POST', body: JSON.stringify(body) }),
    addPlan: (body: any) => request<any>('/api/admin/plans/add', { method: 'POST', body: JSON.stringify(body) }),

    getAnnouncements: () => request<any[]>('/api/admin/announcements'),
    createAnnouncement: (message: string) => request<any>('/api/admin/announcements/create', { method: 'POST', body: JSON.stringify({ message }) }),
    toggleAnnouncement: (id: string, isActive: boolean) => request<any>(`/api/admin/announcements/${id}/toggle`, { method: 'POST', body: JSON.stringify({ is_active: isActive }) }),
    deleteAnnouncement: (id: string) => request<any>(`/api/admin/announcements/${id}/delete`, { method: 'POST' }),
    exportDatabase: () => request<any>('/api/admin/database/export'),
    importDatabase: (data: any) => request<any>('/api/admin/database/import', { method: 'POST', body: JSON.stringify(data) })
  }
};
