/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Copy, Check, Loader, X, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { Plan } from '../types.js';
import { api } from '../lib/api.js';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: Plan[];
  onDepositConfirmed: (balance: number) => void;
  toast: (msg: string, type: 'success' | 'error') => void;
  selectedPlanForModal: Plan | null;
}

export default function DepositModal({
  isOpen,
  onClose,
  plans,
  onDepositConfirmed,
  toast,
  selectedPlanForModal
}: DepositModalProps) {
  const [step, setStep] = useState<'select' | 'invoice'>('select');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [customAmountBtc, setCustomAmountBtc] = useState('');
  
  // Invoice states
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [payAddress, setPayAddress] = useState('');
  const [amountBtc, setAmountBtc] = useState(0);
  const [qrUrl, setQrUrl] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  const [copied, setCopied] = useState(false);

  // Sync passed selected plan
  useEffect(() => {
    if (selectedPlanForModal) {
      setSelectedPlan(selectedPlanForModal);
      setStep('invoice');
      handleCreateInvoice(selectedPlanForModal);
    } else {
      setStep('select');
      setSelectedPlan(null);
    }
  }, [selectedPlanForModal, isOpen]);

  // Status Poller every 15s
  useEffect(() => {
    if (!isOpen || step !== 'invoice' || !invoiceId || paymentStatus === 'confirmed') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.getDepositStatus(invoiceId);
        if (res.status === 'confirmed') {
          setPaymentStatus('confirmed');
          onDepositConfirmed(res.amount_btc);
          toast('Deposit confirmed! Your plan is now active.', 'success');
          clearInterval(interval);
        } else if (res.status === 'failed') {
          setPaymentStatus('failed');
          toast('Deposit verification failed. Please try again.', 'error');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Invoice poller error:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isOpen, step, invoiceId, paymentStatus]);

  if (!isOpen) return null;

  const handleCreateInvoice = async (planToBuy: Plan | null) => {
    setLoading(true);
    try {
      const payload: any = {};
      if (planToBuy) {
        payload.planId = planToBuy.id;
      } else {
        const amt = parseFloat(customAmountBtc);
        if (isNaN(amt) || amt <= 0) {
          throw new Error('Please submit a valid deposit amount');
        }
        // Multiply by live rate to get approximate USD
        payload.amountUsd = amt * 68420; 
      }

      const res = await api.createDeposit(payload);
      setInvoiceId(res.invoiceId);
      setPayAddress(res.payAddress);
      setAmountBtc(res.amountBtc);
      setQrUrl(res.qrurl);
      setInvoiceUrl(res.invoiceUrl || '');
      setIsSandbox(res.isSandbox);
      setPaymentStatus('pending');
      setStep('invoice');
    } catch (err: any) {
      toast(err.message || 'Failed to initiate NOWPayments billing invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(payAddress);
    setCopied(true);
    toast('BTC Wallet Address copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Run Sandbox Payout override instant validator
  const triggerSandboxConfirm = async () => {
    setLoading(true);
    try {
      const res = await api.sandboxTriggerConfirm(invoiceId);
      if (res.success) {
        setPaymentStatus('confirmed');
        onDepositConfirmed(amountBtc);
        toast('Deposit confirmed successfully by Sandbox payment server!', 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Sandbox trigger failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden border border-gray-100 flex flex-col">
        
        {/* Modal Head */}
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Purchase Hashpower Node</h3>
            <p className="text-xs text-gray-400">Mine instantly with instant-setup contracts</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 transition-colors p-1 bg-white border border-gray-100 rounded-lg hover:shadow-xs cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {loading && (
            <div className="absolute inset-0 z-30 bg-white/70 flex flex-col items-center justify-center space-y-3">
              <Loader className="h-10 w-10 text-orange-500 animate-spin" />
              <span className="text-sm font-semibold text-gray-700">Connecting payment server...</span>
            </div>
          )}

          {/* Step 1: Selection Form */}
          {step === 'select' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">Choose a Miner Plan</label>
                <div className="grid grid-cols-2 gap-4">
                  {plans.filter(p => p.price_btc > 0).map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl text-left border cursor-pointer transition-all duration-150 relative ${
                        selectedPlan?.id === plan.id
                          ? 'border-orange-500 bg-orange-50/20 shadow-xs'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <span className="block text-sm font-bold text-gray-900">{plan.name}</span>
                      <span className="block text-xs text-gray-400 mt-1">HashRate: {plan.hash_rate}</span>
                      <span className="block text-xs font-bold text-orange-500 mt-3 font-mono">{plan.price_btc} BTC</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Alternative Input */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Or Deposit Custom BTC Amount</label>
                  <span className="text-[10px] text-gray-400 font-medium">Min: 0.001 BTC</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-xs text-gray-400 font-bold font-mono">₿</span>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00500000"
                    value={customAmountBtc}
                    onChange={(e) => {
                      setCustomAmountBtc(e.target.value);
                      setSelectedPlan(null);
                    }}
                    className="w-full pl-8 pr-16 py-3 border border-gray-100 rounded-xl focus:border-orange-500 text-sm font-semibold font-mono"
                  />
                  <span className="absolute right-4 top-3 text-[10px] text-gray-400 font-semibold uppercase bg-gray-50 px-2 py-1 rounded-md">Bitcoin</span>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => handleCreateInvoice(selectedPlan)}
                disabled={!selectedPlan && !customAmountBtc}
                className="w-full bg-orange-500 hover:bg-orange-600 font-bold text-white py-3 px-4 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <span>Continue to Payout</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 2: Invoice Address Display */}
          {step === 'invoice' && (
            <div className="space-y-6">
              {/* Tracker Track Status Bar */}
              <div className="flex justify-between items-center p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Stages:</span>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-md font-bold ${paymentStatus === 'pending' ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                    {paymentStatus === 'pending' ? 'Waiting' : 'Verified'}
                  </span>
                  <span className="text-gray-300">→</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold ${paymentStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    Confirmed
                  </span>
                </div>
              </div>

              {/* QR and Amount */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-44 h-44 bg-gray-50 border border-gray-100 rounded-xl p-2.5 flex items-center justify-center">
                  <img src={qrUrl} alt="BTC Deposit QR address" className="w-full h-full object-contain" />
                </div>
                
                <div className="text-center">
                  <p className="text-xs text-gray-400">Send exactly this BTC amount to prevent issues</p>
                  <h2 className="text-2xl font-extrabold text-gray-900 font-mono tracking-tight mt-1.5 flex items-center justify-center">
                    ₿ {amountBtc.toFixed(8)}
                    <span className="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-0.5 rounded-md ml-2 uppercase font-sans">BTC</span>
                  </h2>
                </div>
              </div>

              {/* Wallet Address Clipboards */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bitcoin Receiving Address</label>
                <div className="flex border border-gray-100 rounded-xl overflow-hidden focus-within:border-orange-500">
                  <input
                    type="text"
                    readOnly
                    value={payAddress}
                    className="w-full px-4 py-3 bg-gray-50/50 text-xs text-gray-600 font-semibold font-mono outline-hidden select-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="bg-gray-50 border-l border-gray-100 px-4 hover:text-orange-500 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
                    title="Copy Address"
                  >
                    {copied ? <Check className="h-4.5 w-4.5 text-emerald-500" /> : <Copy className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {invoiceUrl && (
                <div className="pt-2">
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-sm py-3 px-4 rounded-xl shadow-xs hover:shadow-md transition-colors text-center cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Proceed to External Payment Page</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">
                    Click to open secure live invoice page on NOWPayments platform.
                  </p>
                </div>
              )}

              {/* Sandbox instructions if Sandbox fallback */}
              {isSandbox && (
                <div className="bg-orange-50/70 p-4 border border-orange-100 rounded-xl space-y-3">
                  <div className="flex items-start space-x-2">
                    <ShieldCheck className="h-4.5 w-4.5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-orange-600 block">Demonstration Sandbox Sandbox Mode active</span>
                      <p className="text-[11px] text-gray-600 leading-normal mt-0.5 font-normal">
                        To let you test without spending coins, our payment interface operates on test sandbox. You can click the sandbox button below to immediately mock payment receiving!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={triggerSandboxConfirm}
                    disabled={paymentStatus === 'confirmed'}
                    className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs py-2 px-3 rounded-lg shadow-xs hover:shadow-md transition-colors text-center cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap className="h-3.5 w-3.5 fill-white" />
                    <span>Send Mock Sandbox Payment (Free Test)</span>
                  </button>
                </div>
              )}

              {/* Normal status message */}
              {paymentStatus !== 'confirmed' ? (
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
                  <Loader className="h-3 w-3 animate-spin text-orange-500" />
                  <span>Monitoring Bitcoin node block ledger for confirmations...</span>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center text-emerald-700">
                  <span className="text-sm font-bold block">Deposit confirmed! Contract active.</span>
                  <p className="text-xs mt-1">We loaded your chosen plan hashpower on your dashboard.</p>
                </div>
              )}

              {/* Back out button if pending status */}
              {paymentStatus !== 'confirmed' && (
                <button
                  onClick={() => setStep('select')}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-gray-500 hover:text-gray-900 text-center"
                >
                  Change plan or custom amount
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
