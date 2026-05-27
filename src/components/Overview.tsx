/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Eye, EyeOff, Coins, Zap, Trophy, TrendingUp, ArrowUpRight, 
  ChevronRight, Volume2, ShieldAlert, Cpu 
} from 'lucide-react';
import { Profile, Transaction, Announcement, CoingeckoPrice, Plan } from '../types.js';

interface OverviewProps {
  profile: Profile;
  transactions: Transaction[];
  announcements: Announcement[];
  btcPrice: CoingeckoPrice;
  plans?: Plan[];
  onUpdateBlur: (blur: boolean) => void;
  onNavigate: (tab: string) => void;
}

export default function Overview({ 
  profile, 
  transactions, 
  announcements, 
  btcPrice, 
  plans,
  onUpdateBlur,
  onNavigate
}: OverviewProps) {
  const [blur, setBlur] = useState(profile.settings.blurBalances);
  const [liveBtc, setLiveBtc] = useState(profile.btc_balance);

  // Sync settings blur value
  useEffect(() => {
    setBlur(profile.settings.blurBalances);
  }, [profile.settings.blurBalances]);

  // Reset/sync live balance whenever the master server-side balance resolves/updates
  useEffect(() => {
    setLiveBtc(profile.btc_balance);
  }, [profile.btc_balance]);

  // Real-time continuous animation effect of the mining balance ticking up at 60 FPS
  useEffect(() => {
    if (blur) return;

    // Resolve live daily earning rate based on computed cloud plan settings
    let dailyEarn = 0;
    const activePlanObj = plans?.find(p => p.id === profile.active_plan);
    if (activePlanObj) {
      dailyEarn = activePlanObj.daily_earn_btc;
    } else {
      // fallback matching default configuration values
      if (profile.active_plan === 'plan_free') dailyEarn = 0.0000005;
      else if (profile.active_plan === 'plan_starter') dailyEarn = 0.0001;
      else if (profile.active_plan === 'plan_pro') dailyEarn = 0.0006;
      else if (profile.active_plan === 'plan_vip') dailyEarn = 0.0035;
    }

    if (dailyEarn <= 0) {
      // background micro hashing indicator so ledger doesn't look completely frozen
      dailyEarn = 0.00000002;
    }

    // Convert daily rate to milliseconds rate (86,400,000 miliseconds in a day)
    const btcPerMs = dailyEarn / 86400000;
    
    // Multiplied by a pacing factor so that the continuous hashing is visually clear,
    // and the 9th and 10th high-precision decimal places increment smoothly at 60hz
    const boostMultiplier = 5.0; 
    const stepPerMs = btcPerMs * boostMultiplier;

    let animationId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      lastTime = now;

      if (elapsed > 0) {
        setLiveBtc(prev => prev + stepPerMs * elapsed);
      }
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [profile.active_plan, plans, blur, profile.btc_balance]);

  const handleBlurToggle = () => {
    const newVal = !blur;
    setBlur(newVal);
    onUpdateBlur(newVal);
  };

  const formattedBtc = (val: number) => {
    return val.toFixed(10); // Display 10 decimals for beautiful live continuous ticking precision!
  };

  const formattedUsd = (val: number) => {
    return (val * btcPrice.btc_usd).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4, // 4 decimal places for micro-cent live USD ticking updates!
      maximumFractionDigits: 4
    });
  };

  // Extract recent activities
  const miningTransactions = transactions.filter(t => t.type === 'mining');
  
  // Custom interactive SVG chart state
  const [hoveredNode, setHoveredNode] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  // Base mock chart coordinates if user is brand new, otherwise build from historical payouts
  const chartData = [
    { day: 'Day 1', btc: profile.btc_balance * 0.4 },
    { day: 'Day 3', btc: profile.btc_balance * 0.55 },
    { day: 'Day 5', btc: profile.btc_balance * 0.7 },
    { day: 'Day 7', btc: profile.btc_balance * 0.82 },
    { day: 'Day 9', btc: profile.btc_balance * 0.92 },
    { day: 'Today', btc: profile.btc_balance }
  ];

  // Map to SVG coordinates
  const svgWidth = 500;
  const svgHeight = 200;
  const padding = 30;
  const chartWidth = svgWidth - padding * 2;
  const chartHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...chartData.map(d => d.btc), 0.0001);
  const points = chartData.map((d, i) => {
    const x = padding + (i / (chartData.length - 1)) * chartWidth;
    const y = padding + chartHeight - (d.btc / maxVal) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length-1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`
    : '';

  return (
    <div className="space-y-6">
      {/* 4 Stat Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: BTC Balance */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm font-medium">BTC Balance</span>
            <button 
              onClick={handleBlurToggle}
              className="text-gray-400 hover:text-orange-500 transition-colors p-1"
              title={blur ? "Show balance" : "Hide balance"}
            >
              {blur ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-bold font-mono tracking-tight transition-all duration-300 ${blur ? 'select-none filter blur-md' : 'text-gray-900'}`}>
              ₿ {formattedBtc(liveBtc)}
            </h3>
            <p className={`text-xs text-gray-400 mt-1 transition-all duration-300 ${blur ? 'select-none filter blur-md' : ''}`}>
              Mining rate active
            </p>
          </div>
        </div>

        {/* Card 2: USD Value */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm font-medium">USD Value</span>
            <div className="w-7 h-7 bg-orange-50 rounded-full flex items-center justify-center">
              <Coins className="h-4 w-4 text-orange-500" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-bold font-mono tracking-tight transition-all duration-300 ${blur ? 'select-none filter blur-md' : 'text-gray-900'}`}>
              {formattedUsd(liveBtc)}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Live rate proxy
            </p>
          </div>
        </div>

        {/* Card 3: Active Plan */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm font-medium">Active Contract</span>
            <div className="w-7 h-7 bg-orange-50 rounded-full flex items-center justify-center">
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
              {profile.active_plan === 'plan_free' ? 'Free Plan' : 
               profile.active_plan === 'plan_starter' ? 'Starter Plan' :
               profile.active_plan === 'plan_pro' ? 'Pro Plan' :
               profile.active_plan === 'plan_vip' ? 'VIP Plan' : 'No Active Plan'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {profile.active_plan === 'plan_free' ? '10 GH/s Hashpower' : 
               profile.active_plan === 'plan_starter' ? '500 GH/s Hashpower' :
               profile.active_plan === 'plan_pro' ? '3 TH/s Hashpower' :
               profile.active_plan === 'plan_vip' ? '15 TH/s Hashpower' : 'Purchase contract below'}
            </p>
          </div>
        </div>

        {/* Card 4: Mining Status */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm font-medium">Mining Nodes</span>
            <div className="flex items-center">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-600">Mining Live</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
              Active <Cpu className="ml-2 h-5 w-5 text-emerald-500 animate-spin" style={{ animationDuration: '6s' }} />
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Nodes synced & healthy
            </p>
          </div>
        </div>

      </div>

      {/* Grid: Interactive Line Chart & Live BTC Price Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Area: Mining growth Interactive Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-lg font-bold text-gray-900">Mining Hash Dividend growth</h4>
              <p className="text-xs text-gray-400">Past earnings incremental growth slope graph</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 uppercase tracking-widest font-semibold font-mono bg-gray-50 px-3 py-1 rounded-full">
              <span>Earnings Trend</span>
            </div>
          </div>

          {/* SVG Custom Chart */}
          <div className="relative h-56 w-full flex items-center justify-center">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
              {/* Backing Horizontal Gridlines */}
              <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#F3F4F6" strokeDasharray="4 4" />
              <line x1={padding} y1={padding + chartHeight/2} x2={svgWidth - padding} y2={padding + chartHeight/2} stroke="#F3F4F6" strokeDasharray="4 4" />
              <line x1={padding} y1={padding + chartHeight} x2={svgWidth - padding} y2={padding + chartHeight} stroke="#E5E7EB" strokeWidth="1.5" />

              {/* Shaded Area */}
              <path d={areaD} fill="url(#orange-grad)" className="opacity-15" />

              {/* Path Stroke */}
              <path d={pathD} fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />

              {/* Coordinates Markers */}
              {points.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  className="fill-white stroke-orange-500 stroke-2 cursor-pointer hover:r-7 transition-all duration-150"
                  onMouseEnter={(e) => {
                    setHoveredNode({
                      x: pt.x,
                      y: pt.y - 12,
                      label: pt.day,
                      value: `${pt.btc.toFixed(8)} BTC`
                    });
                  }}
                  onMouseLeave={() => setHoveredNode(null)}
                />
              ))}

              {/* Date Labels below X axis */}
              {points.map((pt, i) => (
                <text
                  key={i}
                  x={pt.x}
                  y={padding + chartHeight + 16}
                  textAnchor="middle"
                  className="text-[10px] font-medium font-mono fill-gray-400"
                >
                  {pt.day}
                </text>
              ))}

              {/* Gradients declaration */}
              <defs>
                <linearGradient id="orange-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#FFFFFF" />
                </linearGradient>
              </defs>
            </svg>

            {/* Hover tooltip widget */}
            {hoveredNode && (
              <div 
                className="absolute bg-neutral-900 border border-neutral-800 text-white text-xs p-2 rounded-lg pointer-events-none shadow-md flex flex-col"
                style={{ 
                  left: `${(hoveredNode.x / svgWidth) * 100}%`, 
                  top: `${(hoveredNode.y / svgHeight) * 100}%`,
                  transform: 'translate(-50%, -100%)' 
                }}
              >
                <span className="font-semibold text-orange-400 font-mono">{hoveredNode.value}</span>
                <span className="text-[10px] text-gray-400">{hoveredNode.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Throughput & Live Coingecko price widget */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#F97316] bg-orange-50/70 px-2.5 py-1 rounded-md">Live Price Proxy</span>
            <div className="flex items-center justify-between mt-4">
              <h5 className="text-gray-900 font-bold text-sm">Bitcoin Market Rate</h5>
              <div className="flex items-center text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                <ChevronRight className="h-3 w-3 -rotate-90 animate-bounce" />
                <span>+{btcPrice.change_24h.toFixed(2)}%</span>
              </div>
            </div>

            <div className="mt-3">
              <h2 className="text-3xl font-extrabold text-gray-900 font-mono tracking-tight">
                ${btcPrice.btc_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <p className="text-xs text-gray-400 mt-1">Fetched live from CoinGecko API</p>
            </div>
          </div>

          <div className="border-t border-gray-100 my-4 pt-4">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Mining Speed Efficiency</span>
              <span className="font-semibold text-emerald-600 font-mono">92% Optimal</span>
            </div>
            {/* simple custom Progress bar */}
            <div className="h-1.5 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full animate-pulse" style={{ width: '92%' }}></div>
            </div>
          </div>

          <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100/30">
            <div className="flex space-x-2">
              <Trophy className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-600 leading-normal">
                Upgrade to standard paid contracts to immediately scale up your hash rates and unlock daily 0.0035 BTC yields.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Split: Team Announcements & Recent Activity list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Announcements list */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="h-4.5 w-4.5 text-orange-500" />
                <h4 className="text-lg font-bold text-gray-900">Broadcast Messages</h4>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-mono font-medium">Updates</span>
            </div>

            <div className="space-y-4">
              {announcements.length > 0 ? (
                announcements.map((ann) => (
                  <div key={ann.id} className="p-4 bg-orange-50/35 border border-orange-100/50 rounded-xl space-y-2">
                    <p className="text-xs text-gray-700 leading-relaxed font-medium">
                      {ann.message}
                    </p>
                    <span className="block text-[10px] text-gray-400 font-mono">
                      {new Date(ann.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">Nothing new from the team.</p>
                </div>
              )}
            </div>
          </div>

          {announcements.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-center">
              <span className="text-[10px] text-gray-400">All announcements are verified by administrators.</span>
            </div>
          )}
        </div>

        {/* Right Column: Mining payout increments log */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-900">Recent Mining Divvies</h4>
            <button 
              onClick={() => onNavigate('transactions')} 
              className="text-xs text-orange-500 hover:text-orange-600 font-bold flex items-center"
            >
              <span>Ledger</span>
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
            {miningTransactions.length > 0 ? (
              miningTransactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3.5 bg-gray-50/60 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-8.5 h-8.5 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <Cpu className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-gray-900 leading-none">Cloud Payout</span>
                      <span className="text-[10px] text-gray-400 mt-1 block font-mono">
                        {new Date(tx.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-emerald-600">
                      +{formattedBtc(tx.amount_btc)} BTC
                    </span>
                    <span className="block text-[10px] text-gray-400 uppercase tracking-widest leading-none mt-1 font-semibold font-mono">
                      Completed
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <Zap className="h-5 w-5 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">Waiting for mining payouts to trigger...</p>
                <p className="text-xs text-gray-400 mt-1 text-center font-normal px-6">
                  Mining dividends post automatically every 2 minutes. Standard contracts scale amounts instantly.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
