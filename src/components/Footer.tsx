/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface FooterProps {
  onNavigate: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-400 py-12 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Tagline Column */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('home')}>
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-xs">
                <span className="text-white text-base font-bold">₿</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                CryptoBTC<span className="text-orange-500 font-extrabold ml-1">Miner</span>
              </span>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Industrial standard grade Bitcoin cloud mining services. Skip electricity overheads and hardware capital expenses—watch your digital wallet build daily.
            </p>
          </div>

          {/* Platform Columns */}
          <div>
            <h3 className="text-white font-semibold text-sm tracking-wider uppercase mb-4">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-orange-500 transition-colors">
                  Home Landing
                </button>
              </li>
              <li>
                <button onClick={() => { onNavigate('home'); setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-orange-500 transition-colors">
                  Hashpower Plans
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('register')} className="hover:text-orange-500 transition-colors">
                  Create Account
                </button>
              </li>
            </ul>
          </div>

          {/* Support Columns */}
          <div>
            <h3 className="text-white font-semibold text-sm tracking-wider uppercase mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors" onClick={() => { onNavigate('home'); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>
                  FAQ Instructions
                </span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors">
                  Online Live Tidio Chat
                </span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors">
                  System Status (99.98%)
                </span>
              </li>
            </ul>
          </div>

          {/* Legal columns */}
          <div>
            <h3 className="text-white font-semibold text-sm tracking-wider uppercase mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors">Terms of Service</span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors">Privacy Policy</span>
              </li>
              <li>
                <span className="hover:text-orange-500 cursor-pointer transition-colors">Mining Disclaimers</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-neutral-500">
            &copy; {currentYear} CryptoBTC Miner Inc. All rights reserved. Registered cloud hashpower operator.
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0 text-xs text-neutral-500">
            <span>Powered by NOWPayments API Core</span>
            <span>·</span>
            <span>Real-time Mining Nodes active</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
