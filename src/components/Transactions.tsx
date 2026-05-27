/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Download, Upload, Cpu, HeartHandshake, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Transaction } from '../types.js';

interface TransactionsProps {
  transactions: Transaction[];
}

export default function Transactions({ transactions }: TransactionsProps) {
  const [filter, setFilter] = useState<'all' | 'mining' | 'deposit' | 'withdrawal' | 'referral'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Render correct category pill highlights
  const filteredTxs = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  // Pagination bounds
  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTxs.slice(indexOfFirstItem, indexOfLastItem);

  const formatBtc = (val: number) => {
    return val.toFixed(8);
  };

  const handleFilterChange = (type: typeof filter) => {
    setFilter(type);
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
      
      {/* Header with Title and Sorting Options */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">Financial Transaction Ledger</h4>
          <p className="text-xs text-gray-400">Ledger of mining payouts, deposits, and withdrawn amounts</p>
        </div>

        {/* Categories Switches */}
        <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl scrollbar-hidden overflow-x-auto max-w-full">
          {(['all', 'mining', 'deposit', 'withdrawal', 'referral'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => handleFilterChange(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all duration-150 ${
                filter === cat
                  ? 'bg-white text-orange-500 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-right">Amount (BTC)</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {currentItems.length > 0 ? (
              currentItems.map((tx) => {
                const isDebit = tx.type === 'withdrawal';
                const typeIcon = 
                  tx.type === 'mining' ? <Cpu className="h-4 w-4 text-emerald-500" /> :
                  tx.type === 'deposit' ? <Download className="h-4 w-4 text-sky-500" /> :
                  tx.type === 'withdrawal' ? <Upload className="h-4 w-4 text-rose-500" /> :
                  <HeartHandshake className="h-4 w-4 text-purple-500" />;

                return (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    
                    {/* Date */}
                    <td className="py-4 px-4 text-xs font-mono text-gray-500 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>

                    {/* Type Badge */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center">
                          {typeIcon}
                        </div>
                        <span className="font-bold capitalize text-gray-900">{tx.type}</span>
                      </div>
                    </td>

                    {/* Desc */}
                    <td className="py-4 px-4 text-gray-600 font-medium">
                      {tx.description}
                    </td>

                    {/* Amount */}
                    <td className={`py-4 px-4 text-right font-bold font-mono ${
                      isDebit ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {isDebit ? '-' : '+'}{formatBtc(tx.amount_btc)}
                    </td>

                    {/* Status badges */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold leading-none capitalize ${
                        tx.status === 'completed' ? 'bg-orange-50 text-[#F97316]' :
                        tx.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {tx.status}
                      </span>
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                    <Inbox className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm font-medium">No transactions recorded</p>
                    <p className="text-xs text-gray-400 mt-1">This ledger is empty for the current selection.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-5 text-sm">
          <p className="text-gray-400">
            Showing <strong className="text-gray-900">{indexOfFirstItem + 1}</strong> to{' '}
            <strong className="text-gray-900">{Math.min(indexOfLastItem, filteredTxs.length)}</strong> of{' '}
            <strong className="text-gray-905">{filteredTxs.length}</strong> transactions
          </p>

          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
