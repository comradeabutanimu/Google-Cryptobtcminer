/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cpu, Zap, Calendar, TrendingUp } from 'lucide-react';
import { Plan } from '../types.js';

interface PlansProps {
  plans: Plan[];
  activePlanId?: string | null;
  onSelectPlan: (plan: Plan) => void;
  isDashboard?: boolean;
}

export default function Plans({ plans, activePlanId, onSelectPlan, isDashboard = false }: PlansProps) {
  return (
    <div className="flex flex-wrap justify-center items-stretch gap-8 w-full max-w-6xl mx-auto">
      {plans.map((plan) => {
        const isPro = plan.id === 'plan_pro';
        const isActive = activePlanId === plan.id;

        return (
          <div
            key={plan.id}
            className={`relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between w-full max-w-[380px] md:max-w-[340px] lg:max-w-[290px] xl:max-w-[340px] shrink-0 ${
              isActive
                ? 'bg-neutral-800 text-white border-2 border-[#F97316] ring-4 ring-[#F97316]/10 scale-102 shadow-lg'
                : isPro
                ? 'bg-[#F97316] text-white shadow-xl scale-102 border border-[#EA580C]'
                : isDashboard
                ? 'bg-white text-[#1A1A1A] border border-[#E7E7E4] shadow-xs hover:shadow-md hover:border-gray-350'
                : 'bg-neutral-900 text-white border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {/* "Most Popular" Indicator */}
            {isPro && (
              <span className={`absolute -top-3 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                isActive ? 'bg-[#F97316] text-white' : 'bg-neutral-900 text-[#F97316]'
              }`}>
                Most Popular
              </span>
            )}

            {/* "Active Plan" Indicator */}
            {isActive && (
              <span className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#F97316] text-white">
                Active Miner
              </span>
            )}

            <div>
              {/* Plan Title */}
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-bold tracking-tight ${
                  isActive ? 'text-white' : isPro ? 'text-white' : isDashboard ? 'text-[#1A1A1A]' : 'text-white'
                }`}>
                  {plan.name}
                </h3>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isPro || isActive ? 'bg-white/10' : isDashboard ? 'bg-orange-50' : 'bg-neutral-800'
                }`}>
                  <Cpu className={`h-4 w-4 ${isPro || isActive ? 'text-white' : 'text-[#F97316]'}`} />
                </div>
              </div>

              {/* Pricing Row */}
              <div className="mt-4 flex items-baseline">
                <span className={`text-3xl font-extrabold tracking-tight ${
                  isActive ? 'text-white' : isPro ? 'text-white' : isDashboard ? 'text-[#1A1A1A]' : 'text-white'
                }`}>
                  {plan.price_btc.toLocaleString()} USDT
                </span>
                <span className={`text-xs ml-1 font-medium ${
                  isPro || isActive ? 'text-white/70' : isDashboard ? 'text-gray-500' : 'text-neutral-400'
                }`}>
                  contract
                </span>
              </div>

              {/* Divider */}
              <div className={`my-5 border-t ${
                isPro || isActive ? 'border-white/10' : 'border-[#E7E7E4] dark:border-neutral-800'
              }`} />

              {/* Specifications List */}
              <ul className="space-y-3.5">
                <li className="flex items-center space-x-3 text-sm">
                  <Zap className={`h-4 w-4 shrink-0 ${isPro || isActive ? 'text-white' : 'text-[#F97316]'}`} />
                  <span className={isPro || isActive ? 'text-white/90' : isDashboard ? 'text-[#4B5563]' : 'text-[#D1D5DB]'}>
                    Hash Rate: <strong>{plan.hash_rate}</strong>
                  </span>
                </li>
                <li className="flex items-center space-x-3 text-sm">
                  <TrendingUp className={`h-4 w-4 shrink-0 ${isPro || isActive ? 'text-white' : 'text-[#F97316]'}`} />
                  <span className={isPro || isActive ? 'text-white/90' : isDashboard ? 'text-[#4B5563]' : 'text-[#D1D5DB]'}>
                    Daily Return: <strong>{plan.id === 'plan_starter' ? '1.5%' : '3%'} / day</strong>
                  </span>
                </li>
                <li className={`flex items-center space-x-3 text-sm ${isPro || isActive ? 'text-emerald-200' : 'text-emerald-600'}`}>
                  <TrendingUp className={`h-4 w-4 shrink-0 ${isPro || isActive ? 'text-emerald-200' : 'text-emerald-500'}`} />
                  <span>
                    Daily Profit: <strong>{plan.id === 'plan_starter' ? '$7.50/day' : plan.id === 'plan_pro' ? '$300.00/day' : '$1,500.00/day'}</strong>
                  </span>
                </li>
                <li className="flex items-center space-x-3 text-sm">
                  <Calendar className={`h-4 w-4 shrink-0 ${isPro || isActive ? 'text-white' : 'text-[#F97316]'}`} />
                  <span className={isPro || isActive ? 'text-white/90' : isDashboard ? 'text-[#4B5563]' : 'text-[#D1D5DB]'}>
                    Duration: <strong>{plan.duration_days} days</strong>
                  </span>
                </li>
                <li className="flex items-center space-x-3 text-sm">
                  <span className={`h-4 w-4 shrink-0 flex items-center justify-center font-extrabold text-xs leading-none ${isPro || isActive ? 'text-white' : 'text-[#F97316]'}`}>$</span>
                  <span className={isPro || isActive ? 'text-white/90' : isDashboard ? 'text-[#4B5563]' : 'text-[#D1D5DB]'}>
                    Total Profit: <strong>{plan.id === 'plan_starter' ? '$450 USDT' : plan.id === 'plan_pro' ? '$27,000 USDT' : '$270,000 USDT'}</strong>
                  </span>
                </li>
                <li className={`flex items-center space-x-3 text-sm border-t border-dashed pt-2.5 mt-2.5 ${isPro || isActive ? 'border-white/20' : 'border-[#E7E7E4]'}`}>
                  <span className={`h-4 w-4 shrink-0 flex items-center justify-center font-extrabold text-xs leading-none ${isPro || isActive ? 'text-white' : 'text-[#F97316]'}`}>Σ</span>
                  <span className={isPro || isActive ? 'text-white/90' : isDashboard ? 'text-[#4B5563]' : 'text-[#D1D5DB]'}>
                    Total Return: <strong>{plan.id === 'plan_starter' ? '$950' : plan.id === 'plan_pro' ? '$37,000' : '$320,000'}</strong> <span className="text-[10px] opacity-75 font-normal">(capital + profit)</span>
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="mt-8">
              {isActive ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-center border border-white/20 bg-white/5 text-white/80 cursor-not-allowed"
                >
                  Mining Now
                </button>
              ) : (
                <button
                  onClick={() => onSelectPlan(plan)}
                  className={`w-full py-2.5 px-4 rounded-full text-sm font-bold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-center ${
                    isPro
                      ? 'bg-neutral-900 border border-neutral-900 text-white hover:bg-neutral-800 hover:border-neutral-800'
                      : isActive
                      ? 'bg-[#F97316] text-white hover:bg-[#EA580C]'
                      : isDashboard
                      ? 'bg-[#F97316] text-white hover:bg-[#EA580C]'
                      : 'bg-[#F97316] text-white hover:bg-[#EA580C]'
                  }`}
                >
                  Choose Plan
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
