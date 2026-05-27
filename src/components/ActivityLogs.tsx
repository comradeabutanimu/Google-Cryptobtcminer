/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Clock, Eye, Shield, EyeOff, Terminal } from 'lucide-react';
import { ActivityLog } from '../types.js';

interface ActivityLogsProps {
  logs: ActivityLog[];
}

export default function ActivityLogs({ logs }: ActivityLogsProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 max-w-4xl mx-auto space-y-6">
      
      {/* Head */}
      <div>
        <h4 className="text-lg font-bold text-gray-900">Security Activity Logs</h4>
        <p className="text-xs text-gray-400">Chronological history of security events, profile updates and log-ins</p>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="py-3 px-4">When</th>
              <th className="py-3 px-4">Event Action</th>
              <th className="py-3 px-4">Details Summary</th>
              <th className="py-3 px-4 text-center">Diagnostics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {logs.length > 0 ? (
              logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                
                // Styling based on different action categories
                let badgeClass = 'bg-neutral-900 text-neutral-100'; // Default dark pill as requested
                if (log.action.includes('Login')) {
                  badgeClass = 'bg-[#1C1917] text-amber-200';
                } else if (log.action.includes('Confirm') || log.action.includes('Completed')) {
                  badgeClass = 'bg-[#1C1917] text-emerald-300';
                } else if (log.action.includes('Withdraw') || log.action.includes('Request')) {
                  badgeClass = 'bg-[#1C1917] text-sky-200';
                }

                return (
                  <tr key={log.id} className="hover:bg-gray-50/40 transition-colors">
                    
                    {/* Time */}
                    <td className="py-4 px-4 text-xs font-mono text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    {/* Action badge */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold leading-none font-sans uppercase tracking-wider ${badgeClass}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Summary */}
                    <td className="py-4 px-4 text-gray-600 font-medium">
                      <div className="max-w-xs md:max-w-md truncate" title={log.details}>
                        {log.details}
                      </div>

                      {/* Expandable JSON detail block */}
                      {isExpanded && (
                        <div className="mt-3.5 p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 text-left">
                          <div className="flex items-center space-x-1 mb-2">
                            <Terminal className="h-3.5 w-3.5 text-orange-500" />
                            <span className="text-[10px] text-orange-400 uppercase tracking-widest font-bold">Metadata logs:</span>
                          </div>
                          <pre className="text-[10px] text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify({
                              event_id: log.id,
                              trigger: log.action,
                              description: log.details,
                              ip_proxy: '203.0.113.82', // standard generic loop logs
                              security_cert: 'TLS_v1.3_Ed25519',
                              timestamp: log.created_at
                            }, null, 2)}
                          </pre>
                        </div>
                      )}
                    </td>

                    {/* Toggle metadata view */}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="text-gray-400 hover:text-orange-500 transition-colors cursor-pointer p-1"
                        title={isExpanded ? "Collapse logs" : "Expand JSON metadata"}
                      >
                        {isExpanded ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                    <Shield className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm font-medium">No activity registered</p>
                    <p className="text-xs text-gray-400 mt-1">Logs update automatically following secure actions.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
