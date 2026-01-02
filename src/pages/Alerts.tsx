import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Alert } from '../lib/supabase';
import Layout from '../components/Layout';
import { Bell, AlertCircle, Info, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
  if (user) loadAlerts();
}, [user]);

async function loadAlerts() {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
  } else {
    setAlerts(data || []);
  }
}


  async function markAsRead(alertId: string) {
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (error) {
      console.error('Error marking alert as read:', error);
    } else {
      setAlerts(
        alerts.map((alert) =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      );
    }
  }

  async function deleteAlert(alertId: string) {
    const { error } = await supabase.from('alerts').delete().eq('id', alertId);

    if (error) {
      console.error('Error deleting alert:', error);
    } else {
      setAlerts(alerts.filter((alert) => alert.id !== alertId));
    }
  }

  async function markAllAsRead() {
    const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('Error marking all as read:', error);
    } else {
      setAlerts(alerts.map((alert) => ({ ...alert, is_read: true })));
    }
  }

  function getAlertIcon(severity: string) {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  }

  function getAlertStyles(severity: string, isRead: boolean) {
    const baseStyles = 'border rounded-lg p-4 transition-all';

    if (isRead) {
      return `${baseStyles} bg-gray-50 border-gray-200 opacity-70`;
    }

    switch (severity) {
      case 'error':
        return `${baseStyles} bg-red-50 border-red-200`;
      case 'warning':
        return `${baseStyles} bg-orange-50 border-orange-200`;
      default:
        return `${baseStyles} bg-blue-50 border-blue-200`;
    }
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
            <p className="text-gray-600 mt-1">
              Stay informed about your prescription costs and payments
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            {unreadCount > 0 && (
              <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                {unreadCount} unread
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Mark all as read</span>
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {filter === 'unread' ? 'No unread alerts' : 'No alerts yet'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {filter === 'unread'
                ? 'All caught up!'
                : "You'll receive notifications about costs and payments here"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className={getAlertStyles(alert.severity, alert.is_read)}>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.severity)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {!alert.is_read && (
                          <button
                            onClick={() => markAsRead(alert.id)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteAlert(alert.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete alert"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {!alert.is_read && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Alert Types</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-medium">High Cost:</span> Triggered when your monthly prescription
              costs exceed thresholds
            </p>
            <p>
              <span className="font-medium">Payment Due:</span> Reminders for upcoming EMI payments
            </p>
            <p>
              <span className="font-medium">Prescription Changes:</span> Notifications when
              prescriptions are added or modified
            </p>
            <p>
              <span className="font-medium">Plan Updates:</span> Changes to your payment plan or cost
              predictions
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
