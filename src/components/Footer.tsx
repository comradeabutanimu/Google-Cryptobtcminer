/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapPin, Mail, Phone, ShieldCheck, Twitter, Send, Youtube, Facebook, Linkedin, CreditCard } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0D0F14] text-neutral-400 py-16 border-t border-[#1C212E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          
          {/* Tagline & Corporate details Column */}
          <div className="md:col-span-4 space-y-6">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('home')}>
              <div className="w-9 h-9 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                <span className="text-white text-lg font-bold">₿</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                CryptoBTC<span className="text-orange-500 font-extrabold ml-1">Miner</span>
              </span>
            </div>
            
            <p className="text-sm text-neutral-400 leading-relaxed">
              Industrial standard grade Bitcoin cloud mining services. Skip electricity overheads and hardware capital expenses—watch your digital wallet build daily with enterprise security.
            </p>

            {/* Registration & Audits info */}
            <div className="space-y-3.5 pt-2 border-t border-[#1C212E]/70">
              <div className="flex items-center text-xs space-x-2 text-neutral-400">
                <span className="inline-block px-2 py-0.5 rounded-md bg-[#252A36]/60 text-[#F97316] font-bold">REG</span>
                <span className="font-mono text-neutral-300">UK Company House Registered #14392019</span>
              </div>
              <div className="flex items-start text-xs space-x-2 text-neutral-400">
                <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                <span className="text-neutral-300 leading-relaxed font-semibold">
                  Level 27, One Canada Square, Canary Wharf, London, E14 5AB, United Kingdom
                </span>
              </div>
            </div>
          </div>

          {/* Platform Columns */}
          <div className="md:col-span-2">
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase mb-5 border-l-2 border-orange-500 pl-3">Platform</h3>
            <ul className="space-y-3 text-sm font-semibold">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-orange-500 transition-colors cursor-pointer text-left">
                  Home Landing
                </button>
              </li>
              <li>
                <button onClick={() => { onNavigate('home'); setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-orange-500 transition-colors cursor-pointer text-left">
                  Hashpower Plans
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('register')} className="hover:text-orange-500 transition-colors cursor-pointer text-left">
                  Create Account
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('login')} className="hover:text-orange-500 transition-colors cursor-pointer text-left">
                  Client Dashboard
                </button>
              </li>
            </ul>
          </div>

          {/* Support Columns */}
          <div className="md:col-span-2">
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase mb-5 border-l-2 border-orange-500 pl-3">Support</h3>
            <ul className="space-y-3 text-sm font-semibold">
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors" onClick={() => { onNavigate('home'); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>
                  FAQ Instructions
                </span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors">
                  Online Tidio Help
                </span>
              </li>
              <li>
                <div className="flex items-center space-x-1.5 hover:text-orange-500 cursor-pointer transition-colors">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Uptime Status (99.98%)</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Legal columns */}
          <div className="md:col-span-2">
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase mb-5 border-l-2 border-orange-500 pl-3">Regulatory</h3>
            <ul className="space-y-3 text-sm font-semibold">
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors block">Terms of Service</span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors block">Privacy Policy</span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors block">AML & KYC Policy</span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors block">Risk Disclaimer</span>
              </li>
            </ul>
          </div>

          {/* All Social channels with beautiful icons */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase border-l-2 border-orange-500 pl-3">Communities</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Stay updated with daily coin market audits and cloud terminal schedules.
            </p>
            <div className="grid grid-cols-4 gap-2 pt-1">
              <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-[#12161F] hover:bg-orange-500 border border-[#252A36] flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm group" title="Join Telegram Channel">
                <Send className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-[#12161F] hover:bg-orange-500 border border-[#252A36] flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm group" title="Follow Twitter/X">
                <Twitter className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://youtube.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-[#12161F] hover:bg-orange-500 border border-[#252A36] flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm group" title="YouTube Tutorials">
                <Youtube className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-[#12161F] hover:bg-orange-500 border border-[#252A36] flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm group" title="Join Facebook Community">
                <Facebook className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
              </a>
              <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-[#12161F] hover:bg-orange-500 border border-[#252A36] flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm group" title="LinkedIn Corporate">
                <Linkedin className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </div>

        </div>

        {/* Payment logos and final copyright */}
        <div className="border-t border-[#1C212E] pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1.5 text-center md:text-left">
            <p className="text-xs text-neutral-500">
              &copy; {currentYear} CryptoBTC Miner Corp. (UK No. 14392019). Fully accredited Cloud Hashrate broker.
            </p>
            <p className="text-[11px] text-neutral-600">
              Risk Notice: Cryptocurrency mining contract valuation floats with network difficulty. Maximize safety yields cautiously.
            </p>
          </div>

          {/* Payment Method Badges: USDT, BTC, ETH */}
          <div className="flex flex-wrap gap-2 justify-center items-center">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mr-2 flex items-center gap-1.5">
              <CreditCard className="h-3 w-3 text-neutral-500" />
              Supported Nets:
            </span>
            <div className="flex items-center space-x-2 bg-[#12161F] px-3 py-1.5 rounded-lg border border-[#252A36] text-[11px] font-mono font-bold text-neutral-300 shadow-sm hover:border-[#F97316]/50 transition-all">
              <span className="text-[#F97316] font-bold font-sans">USDT</span>
              <span className="text-[9px] text-neutral-500">TRC20/ERC20/BEP20</span>
            </div>
            <div className="flex items-center space-x-2 bg-[#12161F] px-3 py-1.5 rounded-lg border border-[#252A36] text-[11px] font-mono font-bold text-neutral-300 shadow-sm hover:border-[#F97316]/50 transition-all">
              <span className="text-orange-500 font-bold font-sans">₿ BTC</span>
              <span className="text-[9px] text-neutral-500">NATIVE</span>
            </div>
            <div className="flex items-center space-x-2 bg-[#12161F] px-3 py-1.5 rounded-lg border border-[#252A36] text-[11px] font-mono font-bold text-neutral-300 shadow-sm hover:border-[#F97316]/50 transition-all">
              <span className="text-violet-400 font-bold font-sans">Ξ ETH</span>
              <span className="text-[9px] text-neutral-500">ERC20</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}

