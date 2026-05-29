/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Copy, Check, Loader, X, Zap, ArrowRight, ShieldCheck, AlertTriangle, RefreshCw, Wallet, Lock, TrendingUp, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api.js';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositConfirmed: (balance: number) => void;
  toast: (msg: string, type: 'success' | 'error') => void;
  selectedPlanForModal: { id: string; name: string; price_btc?: number; hash_rate?: string } | null;
  plans?: any;
}

// Exact specifications for Miner plans
const STATIC_USDT_PLANS = [
  {
    id: 'plan_starter',
    name: 'Starter Node',
    hashRate: '500 GH/s',
    priceUsdt: 500,
    dailyReturn: '1.5%',
    duration: 60,
    totalProfit: 450,
    totalReturn: 950,
    accent: 'from-[#F97316] to-[#EA580C]'
  },
  {
    id: 'plan_pro',
    name: 'Pro Node',
    hashRate: '3 TH/s',
    priceUsdt: 10000,
    dailyReturn: '3.0%',
    duration: 90,
    totalProfit: 27000,
    totalReturn: 37000,
    accent: 'from-[#F97316] to-[#EA580C]',
    popular: true
  },
  {
    id: 'plan_vip',
    name: 'VIP Supernode',
    hashRate: '15 TH/s',
    priceUsdt: 50000,
    dailyReturn: '3.0%',
    duration: 180,
    totalProfit: 270000,
    totalReturn: 320000,
    accent: 'from-[#F59E0B] to-[#D97706]'
  }
];

export function getPlanDetails(amountUsd: number) {
  if (amountUsd >= 50000) {
    return {
      id: 'plan_vip',
      name: 'VIP Supernode',
      dailyReturnPercent: '3.0%',
      dailyReturnRate: 0.03,
      durationDays: 180,
      hashRateGhs: Math.round(amountUsd / 3),
      accent: 'from-[#F59E0B] to-[#D97706]',
      description: '$50,000 minimum and above'
    };
  } else if (amountUsd >= 10000) {
    return {
      id: 'plan_pro',
      name: 'Pro Node',
      dailyReturnPercent: '3.0%',
      dailyReturnRate: 0.03,
      durationDays: 90,
      hashRateGhs: Math.round(amountUsd / 3),
      accent: 'from-[#F97316] to-[#EA580C]',
      description: '$10,000 to $49,999'
    };
  } else {
    return {
      id: 'plan_starter',
      name: 'Starter Node',
      dailyReturnPercent: '1.5%',
      dailyReturnRate: 0.015,
      durationDays: 60,
      hashRateGhs: Math.round(amountUsd),
      accent: 'from-[#F97316] to-[#EA580C]',
      description: '$500 to $9,999'
    };
  }
}

export default function DepositModal({
  isOpen,
  onClose,
  onDepositConfirmed,
  toast,
  selectedPlanForModal
}: DepositModalProps) {
  const [step, setStep] = useState<'select' | 'invoice'>('select');
  const [depositAmount, setDepositAmount] = useState<string>('500');
  const [selectedNetwork, setSelectedNetwork] = useState<'usdtbsc' | 'usdttrc20'>('usdttrc20');
  
  // Invoice states
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [invoiceId, setInvoiceId] = useState<string>('');
  const [payAddress, setPayAddress] = useState<string>('');
  const [amountUsdt, setAmountUsdt] = useState<number>(0);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isSandbox, setIsSandbox] = useState<boolean>(true);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  const [copied, setCopied] = useState<boolean>(false);

  // Map parent component selected plan transitions
  useEffect(() => {
    if (isOpen) {
      if (selectedPlanForModal) {
        const idMatched = selectedPlanForModal.id;
        if (idMatched === 'plan_vip' || idMatched === 'vip' || selectedPlanForModal.name.toLowerCase().includes('vip')) {
          setDepositAmount('50000');
        } else if (idMatched === 'plan_pro' || idMatched === 'pro' || selectedPlanForModal.name.toLowerCase().includes('pro')) {
          setDepositAmount('10000');
        } else {
          setDepositAmount('500');
        }
      } else {
        setDepositAmount('500');
      }
      setStep('select');
      setErrorMsg('');
    }
  }, [selectedPlanForModal, isOpen]);

  // Status Poller every 10s for active USDT invoice
  useEffect(() => {
    if (!isOpen || step !== 'invoice' || !invoiceId || paymentStatus === 'confirmed') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.getDepositStatus(invoiceId);
        if (res.status === 'confirmed') {
          setPaymentStatus('confirmed');
          onDepositConfirmed(res.amount_usd);
          toast('Deposit confirmed! Your miner is now active.', 'success');
          clearInterval(interval);
        } else if (res.status === 'failed') {
          setPaymentStatus('failed');
          toast('Deposit transaction has failed.', 'error');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Invoice poller error:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen, step, invoiceId, paymentStatus]);

  if (!isOpen) return null;

  // Handle address retrieval and trigger server-side proxy
  const handleInitiatePayout = async () => {
    setLoading(true);
    setErrorMsg('');
    
    // Determine dynamic USDT invoice value
    const orderAmount = parseFloat(depositAmount);
    if (isNaN(orderAmount) || orderAmount < 500) {
      toast('Minimum deposit amount is 500 USDT (Starter plan price).', 'error');
      setLoading(false);
      return;
    }

    try {
      // Securely invoke our server proxy backend to query GET/POST v1/payment
      const res = await api.createUsdtDeposit({
        currency: selectedNetwork,
        amount: orderAmount
      });

      if (res && res.payAddress) {
        setInvoiceId(res.invoiceId);
        setPayAddress(res.payAddress);
        setAmountUsdt(res.amount);
        setQrUrl(res.qrurl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(res.payAddress)}&color=000000&bgcolor=ffffff`);
        setIsSandbox(res.isSandbox || false);
        setPaymentStatus('pending');
        setStep('invoice');
      } else {
        setErrorMsg('Unable to retrieve wallet address. Please try again.');
      }
    } catch (err: any) {
      console.error('USDT address fetch failure:', err);
      setErrorMsg('Unable to retrieve wallet address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!payAddress) return;
    navigator.clipboard.writeText(payAddress);
    setCopied(true);
    toast('USDT deposit wallet address copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Run Sandbox Mock payment override validator for testing
  const triggerSandboxConfirm = async () => {
    setLoading(true);
    try {
      const res = await api.sandboxTriggerConfirm(invoiceId);
      if (res.success) {
        setPaymentStatus('confirmed');
        onDepositConfirmed(amountUsdt);
        toast('Mock transaction confirmed successfully instantly!', 'success');
      }
    } catch (err: any) {
      toast(err?.message || 'Error executing mock validation', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Real-time projected calculator values
  const getCalculatorValues = () => {
    const amount = parseFloat(depositAmount) || 0;
    const plan = getPlanDetails(amount);
    
    const dailyProfit = amount * plan.dailyReturnRate;
    const totalProfit = dailyProfit * plan.durationDays;
    const totalReturn = amount + totalProfit;

    return {
      amount,
      planId: plan.id,
      planName: plan.name,
      ratePercentage: plan.dailyReturnPercent,
      duration: plan.durationDays,
      hashRateGhs: plan.hashRateGhs,
      dailyProfit,
      totalProfit,
      totalReturn,
      accent: plan.accent,
      description: plan.description
    };
  };

  const calcValues = getCalculatorValues();

  return (
    <div id="usdt-deposit-modal" className="fixed inset-0 z-50 overflow-y-auto bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-[#0D1015] text-[#F0F2F5] rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden border border-[#232832] flex flex-col">
        
        {/* Modal Head */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#1F222B] bg-[#11151D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#F97316] shadow-[0_0_15px_rgba(249,115,22,0.15)]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                Activate Mining Contract
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Institutional-grade Bitcoin cloud mining nodes</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1.5 bg-[#171B26] border border-[#252A36] rounded-xl hover:bg-[#1C2030] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-6 overflow-y-auto max-h-[80vh] relative">
          
          {loading && (
            <div id="modal-loading-screen" className="absolute inset-0 z-30 bg-[#0D1015]/95 flex flex-col items-center justify-center space-y-4 animate-fade-in">
              <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
                <Loader className="h-10 w-10 text-[#F97316] animate-spin" />
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-white block">Connecting secure nodes...</span>
                <p className="text-xs text-gray-400 mt-1 max-w-[240px]">Syncing secure payment routes for high-speed block hashing</p>
              </div>
            </div>
          )}

          {/* Error Visual Handling */}
          {errorMsg && (
            <div id="modal-error-screen" className="space-y-6 py-4">
              <div className="flex items-center space-x-4 p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-left">
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400">Connection Error</h4>
                  <p className="text-xs text-rose-200 font-medium mt-1 leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleInitiatePayout}
                  className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Secure Connection</span>
                </button>
                <button
                  onClick={() => {
                    setErrorMsg('');
                    setStep('select');
                  }}
                  className="w-full bg-[#12161F] hover:bg-[#181D2A] border border-[#232832] text-gray-300 font-bold py-3 px-4 rounded-xl text-xs transition-all text-center cursor-pointer"
                >
                  Go Back to Selector
                </button>
              </div>
            </div>
          )}

          {/* Standard steps */}
          {!errorMsg && (
            <>
              {/* STEP 1: Plan Selector */}
              {step === 'select' && (
                <div className="space-y-5">
                  
                  {/* Premium Amount Input with Auto Detection */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3 text-left">
                      Enter Deposit Amount (USDT)
                    </label>
                    <div className="relative mb-5">
                      <span className="absolute left-4 top-3 text-lg text-[#F97316] font-extrabold font-mono">$</span>
                      <input
                        type="number"
                        min="500"
                        placeholder="e.g. 5000"
                        value={depositAmount}
                        onChange={(e) => {
                          setDepositAmount(e.target.value);
                        }}
                        className="w-full pl-9 pr-16 py-2.5 bg-[#12161F] text-white border-2 border-[#252A36] rounded-2xl focus:border-[#F97316] focus:outline-none text-base font-extrabold font-mono transition-all"
                      />
                      <span className="absolute right-4 top-2 text-xs text-gray-300 font-extrabold uppercase bg-[#1D222F] px-3 py-1.5 rounded-lg border border-[#3E455A]">
                        USDT
                      </span>
                    </div>

                    {/* Quick Presets Row */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-bold mb-5">
                      <button
                        type="button"
                        onClick={() => setDepositAmount('500')}
                        className={`py-2 px-2 rounded-xl border text-center transition-all ${
                          calcValues.planId === 'plan_starter' && calcValues.amount === 500
                            ? 'bg-[#1E1C13] border-[#F97316] text-[#F97316] font-extrabold ring-1 ring-[#F97316]/30'
                            : 'bg-[#12161F] border-[#252A36] text-gray-400 hover:bg-[#161B28]'
                        }`}
                      >
                        Starter Contract ($500)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositAmount('10000')}
                        className={`py-2 px-2 rounded-xl border text-center transition-all ${
                          calcValues.planId === 'plan_pro' && calcValues.amount === 10000
                            ? 'bg-[#1E1C13] border-[#F97316] text-[#F97316] font-extrabold ring-1 ring-[#F97316]/30'
                            : 'bg-[#12161F] border-[#252A36] text-gray-400 hover:bg-[#161B28]'
                        }`}
                      >
                        Pro Contract ($10,000)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositAmount('50000')}
                        className={`py-2 px-2 rounded-xl border text-center transition-all ${
                          calcValues.planId === 'plan_vip' && calcValues.amount === 50000
                            ? 'bg-[#1E1C13] border-[#F97316] text-[#F97316] font-extrabold ring-1 ring-[#F97316]/30'
                            : 'bg-[#12161F] border-[#252A36] text-gray-400 hover:bg-[#161B28]'
                        }`}
                      >
                        VIP Contract ($50,000)
                      </button>
                    </div>

                    {/* Auto-detected Plan details */}
                    <div className="bg-[#12161F] border border-[#252A36] rounded-2xl p-4 text-left relative overflow-hidden mb-5">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#1F222B]">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">
                          Assigned Mining Plan
                        </span>
                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-[#F97316]/10 border border-[#F97316]/25 text-[#F97316]">
                          Auto-Detected
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white block">
                              {calcValues.planName}
                            </span>
                            {calcValues.planId === 'plan_pro' && (
                              <span className="bg-[#F97316] text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                                MOST POPULAR
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 block mt-1">
                            Qualified range: {calcValues.description}
                          </span>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <span className="text-[9px] text-[#F97316] block font-extrabold uppercase tracking-widest">Hash Rate</span>
                          <span className="text-sm font-black text-white font-mono leading-none block mt-1">
                            {calcValues.hashRateGhs >= 1000
                              ? `${(calcValues.hashRateGhs / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} TH/s`
                              : `${calcValues.hashRateGhs.toLocaleString()} GH/s`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Premium Payment Network Toggles */}
                  <div className="border-t border-[#1F222B] pt-5 text-left">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                      Select USDT Payment Network
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedNetwork('usdtbsc')}
                        className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex items-center gap-3 ${
                          selectedNetwork === 'usdtbsc'
                            ? 'bg-[#1C1713] border-[#F97316] text-white shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                            : 'bg-[#12161F] border-[#252A36] text-gray-400 hover:border-neutral-700 hover:bg-[#161B28]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${selectedNetwork === 'usdtbsc' ? 'bg-[#F3BA2F] text-black font-extrabold' : 'bg-neutral-800 text-neutral-400'}`}>
                          BSC
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-white leading-none">USDT-BEP20</span>
                          <span className="block text-[9px] text-gray-400 mt-1">Smart Chain</span>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setSelectedNetwork('usdttrc20')}
                        className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 flex items-center gap-3 ${
                          selectedNetwork === 'usdttrc20'
                            ? 'bg-[#1C1713] border-[#F97316] text-white shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                            : 'bg-[#12161F] border-[#252A36] text-gray-400 hover:border-neutral-700 hover:bg-[#161B28]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${selectedNetwork === 'usdttrc20' ? 'bg-[#EC0623] text-white font-extrabold' : 'bg-neutral-800 text-neutral-400'}`}>
                          TRX
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-white leading-none">USDT-TRC20</span>
                          <span className="block text-[9px] text-gray-400 mt-1">TRON Network</span>
                        </div>
                        
                        {/* Recommended Badge */}
                        <span className="absolute -top-2 right-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-[8px] tracking-wide uppercase px-2 py-0.5 rounded-full shadow-lg">
                          Recommended
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Calculator Widget */}
                  <div className="border-t border-[#1F222B] pt-5 text-left">
                    {/* Integrated Dynamic Profit Calculator Widget */}
                    <div className="bg-[#12161F] border border-[#252A36] rounded-2xl p-4 space-y-3 shadow-inner">
                      <div className="flex items-center justify-between border-b border-[#252A36] pb-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <TrendingUp className="h-4 w-4 text-[#F97316]" />
                          <span className="text-[10px] uppercase tracking-widest text-[#F97316]">Projected Earnings Calculator</span>
                        </div>
                        <span className="text-[10px] font-extrabold bg-[#1C1713] border border-[#F97316]/20 px-2 py-0.5 rounded-md text-[#F97316]">
                          {calcValues.ratePercentage} Daily Yield
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 text-left">
                          <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Estimated Profit</span>
                          <span className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono">
                            ${calcValues.dailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT <span className="text-[9px] font-sans font-medium text-gray-400">/day</span>
                          </span>
                        </div>
                        <div className="space-y-1 text-left border-l border-[#252A36] pl-4">
                          <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Plan Duration</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
                            {calcValues.duration} Days
                          </span>
                        </div>
                        <div className="space-y-1 text-left border-t border-[#252A36] pt-2.5">
                          <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Total Net Profit</span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#F97316] font-mono">
                            ${calcValues.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                          </span>
                        </div>
                        <div className="space-y-1 text-left border-t border-[#252A36] pt-2.5 border-l border-[#252A36] pl-4">
                          <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Total Est. Return</span>
                          <span className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono">
                            ${calcValues.totalReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secure checkout continue */}
                  <div className="pt-3">
                    <button
                      onClick={handleInitiatePayout}
                      disabled={loading || calcValues.amount < 500}
                      className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold py-3.5 px-4 rounded-xl shadow-[0_4px_20px_rgba(249,115,22,0.15)] hover:shadow-[0_4px_25px_rgba(249,115,22,0.3)] transition-all flex items-center justify-center space-x-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none border-b-2 border-[#C2410C]"
                    >
                      {loading ? (
                        <>
                          <Loader className="animate-spin h-4 w-4" />
                          <span>PROVISIONING SECURE NODE...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 text-orange-200" />
                          <span>Secure Checkout →</span>
                        </>
                      )}
                    </button>

                    {/* Trust and encryption Badge */}
                    <div className="text-[10px] text-gray-400 tracking-wider text-center block mt-4 border-t border-[#202530] pt-4 flex items-center justify-center gap-1.5 font-bold uppercase select-none">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#F97316]" />
                      <span>SSL Secured</span>
                      <span className="text-gray-600">•</span>
                      <span>Instant Activation</span>
                      <span className="text-gray-600">•</span>
                      <span>256-bit Encryption</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Invoice Address Display */}
              {step === 'invoice' && (
                <div className="space-y-6">
                  
                  {/* Status track visual card wrapper */}
                  <div className="flex justify-between items-center p-3.5 bg-[#12161F] border border-[#252A36] rounded-xl text-left">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invoice Stage:</span>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-md font-bold ${paymentStatus === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse' : 'bg-neutral-800 text-gray-400'}`}>
                        {paymentStatus === 'pending' ? 'Waiting Transfer' : 'Processing'}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold ${paymentStatus === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-neutral-800 text-gray-400'}`}>
                        Confirmed
                      </span>
                    </div>
                  </div>

                  {/* QR barcode mapping and target deposit amount */}
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-40 h-40 bg-white border border-[#252A36] rounded-2xl p-2.5 flex items-center justify-center shadow-md">
                      <img src={qrUrl} alt="Deposit QR barcode address" className="w-full h-full object-contain" />
                    </div>
                    
                    <div className="text-center">
                      <p className="text-xs text-gray-400 font-medium">Transmit exactly this USDT amount below</p>
                      <h2 className="text-2xl font-extrabold text-[#F97316] font-mono tracking-tight mt-1 animate-pulse flex items-center justify-center">
                        ${amountUsdt.toLocaleString()}
                        <span className="text-[10px] text-white font-semibold bg-neutral-800 border border-[#252A36] px-2 py-0.5 rounded-md ml-1.5 uppercase font-sans">
                          USDT
                        </span>
                      </h2>
                    </div>
                  </div>

                  {/* Destination Wallet Address display */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Dedicated USDT Destination Address ({selectedNetwork === 'usdttrc20' ? 'TRON TRC20' : 'BSC BEP20'})
                    </label>
                    <div className="flex border border-[#252A36] rounded-xl overflow-hidden focus-within:border-[#F97316] bg-[#12161F]">
                      <input
                        type="text"
                        readOnly
                        value={payAddress}
                        className="w-full px-4 py-3 bg-transparent text-xs text-gray-300 font-semibold font-mono focus:outline-none select-all"
                      />
                      <button
                        onClick={copyToClipboard}
                        className="bg-[#1C202F] border-l border-[#252A36] px-4 hover:text-[#F97316] hover:bg-[#1E253A] transition-colors cursor-pointer flex items-center justify-center focus:outline-none"
                        title="Copy Address"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-gray-300" />}
                      </button>
                    </div>
                  </div>

                  {/* Sandbox confirmation simulation toggle */}
                  {isSandbox && (
                    <div className="bg-emerald-500/5 p-4 border border-emerald-500/10 rounded-2xl text-left space-y-3.5">
                      <div className="flex items-start space-x-2.5">
                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-emerald-400 block">Interactive Trial Sandbox Active</span>
                          <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5 font-medium">
                            To facilitate immediate sandbox checkout reviews within this developer preview container, you can bypass real crypto assets. Clicking below mocks instant network confirmation!
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={triggerSandboxConfirm}
                        disabled={paymentStatus === 'confirmed' || loading}
                        className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs py-3 px-3 rounded-xl shadow-xs hover:shadow-md transition-all text-center cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed select-none focus:outline-none"
                      >
                        {loading ? (
                          <>
                            <Loader className="animate-spin h-3.5 w-3.5" />
                            <span>Processing sandbox payment...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 fill-white" />
                            <span>Send Mock Sandbox Payment (Free Test)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Process wait status notifications */}
                  {paymentStatus !== 'confirmed' ? (
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 font-medium">
                      <Loader className="h-3 w-3 animate-spin text-[#F97316]" />
                      <span>Tracking decentralized blockchain confirmation logs...</span>
                    </div>
                  ) : (
                    <div id="payment-completed-banner" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl p-4 text-center animate-slide-up">
                      <span className="text-sm font-bold block">Invoice confirmed successfully!</span>
                      <p className="text-xs mt-1.5 font-medium">We credited your active deposit balance with ${amountUsdt} USDT. Cloud mining has fired up immediately!</p>
                    </div>
                  )}

                  {/* Back tracking select reset button */}
                  {paymentStatus !== 'confirmed' && (
                    <button
                      onClick={() => setStep('select')}
                      className="w-full py-2 px-4 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer focus:outline-none"
                    >
                      Change plan choice or payment network
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
