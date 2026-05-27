/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bell, BellOff, CheckCheck, Circle, Sparkles } from 'lucide-react';
import { Notification } from '../types.js';

interface NotificationsProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
}

export default function Notifications({ notifications, onMarkAllRead }: NotificationsProps) {
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 max-w-3xl mx-auto space-y-6">
      
      {/* Head */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-5">
        <div>
          <h4 className="text-lg font-bold text-gray-900">Notifications & Alerts</h4>
          <p className="text-xs text-gray-400">Account security, deposit confirmations, and mining block reports</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-orange-500 hover:text-orange-600 font-bold border border-orange-100 hover:border-orange-200 bg-orange-50/40 px-3.5 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3.5">
        {notifications.length > 0 ? (
          notifications.map((notif) => {
            const isUnread = !notif.is_read;
            return (
              <div
                key={notif.id}
                className={`p-4 rounded-xl border transition-colors flex items-start justify-between gap-4 ${
                  isUnread
                    ? 'bg-orange-50/20 border-orange-100/60 shadow-xs'
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex space-x-3.5 items-start">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    isUnread ? 'bg-orange-100/50 text-orange-500' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {isUnread ? <Sparkles className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </div>

                  <div className="space-y-1">
                    <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {notif.message}
                    </p>
                    <span className="block text-[10px] text-gray-400 font-mono">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <div className="p-1 text-orange-500" title="Unread Notice">
                    <Circle className="h-2 w-2 fill-orange-500 stroke-none" />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <BellOff className="h-5.5 w-5.5 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-800">No Notifications</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm text-center font-normal">
              You are all caught up! New mining results or deposit verification triggers will post here.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
