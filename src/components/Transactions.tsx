/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Download, Upload, Cpu, HeartHandshake, ChevronLeft, ChevronRight, Inbox, Calendar, Filter, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { Transaction } from '../types.js';

interface TransactionsProps {
  transactions: Transaction[];
}

export default function Transactions({ transactions }: TransactionsProps) {
  const [filter, setFilter] = useState<'all' | 'mining' | 'deposit' | 'withdrawal' | 'referral'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Render correct category pill highlights with status and date-range constraints
  const filteredTxs = transactions.filter((tx) => {
    // 1. Type category filter
    if (filter !== 'all' && tx.type !== filter) {
      return false;
    }

    // 2. Status filter
    if (statusFilter !== 'all') {
      if (tx.status !== statusFilter) {
        return false;
      }
    }

    // 3. Date range filter
    if (startDate) {
      const startDateTime = new Date(startDate + 'T00:00:00').getTime();
      const txTime = new Date(tx.created_at).getTime();
      if (txTime < startDateTime) {
        return false;
      }
    }

    if (endDate) {
      const endDateTime = new Date(endDate + 'T23:59:59').getTime();
      const txTime = new Date(tx.created_at).getTime();
      if (txTime > endDateTime) {
        return false;
      }
    }

    return true;
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

  const handleResetFilters = () => {
    setFilter('all');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    try {
      if (!filteredTxs || filteredTxs.length === 0) {
        return;
      }
      
      const headers = ['Date & Time', 'Transaction ID', 'Type', 'Description', 'Amount (BTC)', 'Status'];
      const rows = filteredTxs.map(tx => [
        new Date(tx.created_at).toLocaleString(),
        tx.id,
        tx.type.toUpperCase(),
        tx.description,
        (tx.type === 'withdrawal' ? '-' : '+') + tx.amount_btc.toFixed(8),
        tx.status.toUpperCase()
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ledger_payment_history_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      console.error(e);
    }
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

      {/* Date Range Picker and Status Filters Bar */}
      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50 space-y-4">
        
        {/* Date Range Preset Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-sans mr-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span>Range Shortcuts:</span>
          </span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: '7days', label: '7 Days' },
            { id: '30days', label: '30 Days' },
            { id: 'thismonth', label: 'This Month' },
          ].map((preset) => {
            const today = new Date();
            const formatDate = (date: Date) => {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
            };

            let isActive = false;
            if (preset.id === 'all') {
              isActive = !startDate && !endDate;
            } else if (preset.id === 'today') {
              const tStr = formatDate(today);
              isActive = startDate === tStr && endDate === tStr;
            } else if (preset.id === '7days') {
              const past = new Date();
              past.setDate(today.getDate() - 7);
              isActive = startDate === formatDate(past) && endDate === formatDate(today);
            } else if (preset.id === '30days') {
              const past = new Date();
              past.setDate(today.getDate() - 30);
              isActive = startDate === formatDate(past) && endDate === formatDate(today);
            } else if (preset.id === 'thismonth') {
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
              isActive = startDate === formatDate(firstDay) && endDate === formatDate(today);
            }

            return (
              <button
                key={preset.id}
                onClick={() => {
                  const today = new Date();
                  const formatDate = (date: Date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                  };

                  if (preset.id === 'all') {
                    setStartDate('');
                    setEndDate('');
                  } else if (preset.id === 'today') {
                    const todayStr = formatDate(today);
                    setStartDate(todayStr);
                    setEndDate(todayStr);
                  } else if (preset.id === '7days') {
                    const past = new Date();
                    past.setDate(today.getDate() - 7);
                    setStartDate(formatDate(past));
                    setEndDate(formatDate(today));
                  } else if (preset.id === '30days') {
                    const past = new Date();
                    past.setDate(today.getDate() - 30);
                    setStartDate(formatDate(past));
                    setEndDate(formatDate(today));
                  } else if (preset.id === 'thismonth') {
                    const first = new Date(today.getFullYear(), today.getMonth(), 1);
                    setStartDate(formatDate(first));
                    setEndDate(formatDate(today));
                  }
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-500 border-orange-500 text-white shadow-xs'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 md:hover:scale-102 hover:shadow-xs'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Inputs and Filters Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Start Date */}
            <div className="space-y-1 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5 font-sans">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span>Start Date</span>
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none transition-all placeholder-gray-400"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5 font-sans">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span>End Date</span>
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none transition-all placeholder-gray-400"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-1 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5 font-sans">
                <Filter className="h-3 w-3 text-gray-400" />
                <span>Status Ledger</span>
              </span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Confirmed / Completed</option>
                <option value="failed">Failed / Rejected</option>
              </select>
            </div>
          </div>

          {/* Buttons Action Panel */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-end">
            {/* Clear/Reset Button */}
            {(startDate || endDate || statusFilter !== 'all' || filter !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-extrabold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 border border-neutral-200/50 h-[36px]"
                title="Reset Date and Status Filters to Default"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            {/* Export to CSV Button */}
            {filteredTxs.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="cursor-pointer bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-extrabold text-[10px] uppercase tracking-wider px-4.5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 border-b-2 border-orange-700 h-[36px] shadow-xs"
                title="Export Current Filtered Ledger to CSV file for Tax or Records"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
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
