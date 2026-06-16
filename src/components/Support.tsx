/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LifeBuoy, Mail, HelpCircle, ChevronDown, MessageSquare, ShieldCheck, Clock } from 'lucide-react';

export default function Support() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqItems = [
    {
      q: 'How long until cloud contracts activate after deposit?',
      a: 'Purchased plan nodes are provisioned immediately upon block confirmation of your BTC transfer. Standard SegWit transfers clear block audit in 10-25 minutes.'
    },
    {
      q: 'Can I choose to run multiple mining contracts concurrently?',
      a: 'Yes, users can purchase Starter and VIP hash power nodes together. Dividends accumulate independently based on plan specifics.'
    },
    {
      q: 'What is the daily payout schedule?',
      a: 'Cloud blocks dividends distribute to balances in pro-rated chunks. Our server updates logs block-by-block, allowing you to watch balances grow.'
    },
    {
      q: 'How does the affiliate referral system pay out rewards?',
      a: 'We provide 0.0001 BTC commissions for any referee purchasing active contracts. Payouts are credited instantly to your balance ledger.'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Intro Head */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-orange-50 rounded-xl">
              <LifeBuoy className="h-5 w-5 text-orange-500" />
            </span>
            <h4 className="text-lg font-bold text-gray-900">Contact Help Center</h4>
          </div>
          <p className="text-xs text-gray-400">Our support engineers operate 24/7 assisting with node diagnostics, deposits, and transfers.</p>
        </div>

        {/* Action triggers bottom bubble */}
        <button
          onClick={() => {
            const widgetTrigger = document.getElementById('chat-bubble-toggle');
            if (widgetTrigger) widgetTrigger.click();
          }}
          className="bg-orange-500 hover:bg-orange-600 px-5  py-2.5 font-bold text-white text-sm rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all flex items-center space-x-2 shrink-0"
        >
          <MessageSquare className="h-4.5 w-4.5" />
          <span>Launch Live Chat Messenger</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Area: Contacts fallbacks */}
        <div className="md:col-span-1 space-y-4">
          
          {/* Email Support Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="p-1 text-orange-500 bg-orange-50 rounded-md">
                <Mail className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Support</span>
            </div>
            <div>
              <a href="mailto:support@cyptobtcminer.com" className="text-sm font-bold text-gray-900 hover:text-orange-500 transition-colors">
                support@cyptobtcminer.com
              </a>
              <span className="text-[10px] text-gray-400 mt-1 block">Replies within 24 hours</span>
            </div>
          </div>

          {/* Operation Hours */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="p-1 text-[#F97316] bg-orange-50 rounded-md">
                <Clock className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Business Hours</span>
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900 block">24/7/365 Available</span>
              <span className="text-[10px] text-gray-400 mt-1 block">Includes global bank holidates</span>
            </div>
          </div>

          {/* Security Node certifications */}
          <div className="bg-orange-50/20 p-4 border border-orange-100/30 rounded-2xl space-y-1 text-center">
            <ShieldCheck className="h-4.5 w-4.5 text-orange-500 mx-auto" />
            <span className="text-xs font-bold text-orange-600 block">Encryption Secured</span>
            <span className="text-[10px] text-gray-500 leading-normal block">
              Support channel sessions utilize quantum-resistant SSL streams.
            </span>
          </div>

        </div>

        {/* Right Area: FAQ accordion */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <HelpCircle className="h-4.5 w-4.5 text-orange-500" />
            <h4 className="text-base font-bold text-gray-900">Self-Service Knowledgebase</h4>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left px-4 py-3.5 font-bold text-gray-900 text-sm hover:bg-gray-50/50 flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 transition-all duration-300">
                      <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
