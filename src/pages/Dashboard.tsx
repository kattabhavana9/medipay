import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Prescription, CostPrediction, PaymentPlan, Alert } from '../lib/supabase';
import Layout from '../components/Layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, AlertCircle, Activity, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [latestPrediction, setLatestPrediction] = useState<CostPrediction | null>(null);
  const [activePaymentPlan, setActivePaymentPlan] = useState<PaymentPlan | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  async function loadDashboardData() {
  setLoading(true);

  const [
    prescriptionsRes,
    predictionRes,
    activePlanRes,
    alertsRes,
  ] = await Promise.all([
    supabase.from('prescriptions').select('*').eq('user_id', user!.id),

    supabase
      .from('cost_predictions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // ✅ ONLY ACTIVE PLAN
    supabase
      .from('payment_plans')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .maybeSingle(),

    supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  setPrescriptions(prescriptionsRes.data ?? []);
  setLatestPrediction(predictionRes.data ?? null);
  setActivePaymentPlan(activePlanRes.data ?? null);
  setAlerts(alertsRes.data ?? []);

  setLoading(false);
}




  const currentMonthlyCost = prescriptions.reduce(
  (sum, p) => sum + Number(p.monthly_cost),
  0
);


  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Activity className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your prescription costs and payment plans</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Monthly Cost</p>
<p className="text-3xl font-bold text-gray-900 mt-2">
  ₹{Number(currentMonthlyCost || 0).toFixed(2)}
</p>

              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
  <div className="flex items-center justify-between">
    <div>
  <p className="text-3xl font-bold text-gray-900 mt-2">
    ₹{activePaymentPlan
      ? (Number(activePaymentPlan.monthly_emi) * 12).toFixed(2)
      : '0.00'}
  </p>

  <p className="text-sm text-gray-500">
    {activePaymentPlan ? 'Yearly EMI' : 'No Active EMI'}
  </p>
</div>

    <div className="bg-orange-100 p-3 rounded-lg">
      <CreditCard className="w-6 h-6 text-orange-600" />
    </div>
  </div>
</div>


          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600"></p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  <p className="text-3xl font-bold text-gray-900 mt-2">
  ₹{activePaymentPlan
    ? Number(activePaymentPlan.monthly_emi).toFixed(2)
    : '0.00'}
</p>

<p className="text-sm text-gray-500">
  {activePaymentPlan ? 'Monthly EMI' : 'No Active EMI'}
</p>


                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Prescriptions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{prescriptions.length}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Alerts</h2>
            </div>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.severity === 'error'
                      ? 'bg-red-50 border-red-200'
                      : alert.severity === 'warning'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <p className="font-medium text-gray-900">{alert.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {latestPrediction && latestPrediction.monthly_breakdown && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Cost Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={latestPrediction.monthly_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activePaymentPlan && latestPrediction && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">EMI Breakdown</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Array.from({ length: 6 }, (_, i) => ({
                    month: `Month ${i + 1}`,
                    emi: Number(activePaymentPlan.monthly_emi),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="emi" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {prescriptions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Prescriptions</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Medicine</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Dosage</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Frequency</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Disease Type</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Monthly Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((prescription) => (
                    <tr key={prescription.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm text-gray-900">{prescription.medicine_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{prescription.dosage}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{prescription.frequency}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{prescription.disease_type}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                        ₹{Number(prescription.monthly_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activePaymentPlan && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Payment Plan</h2>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                activePaymentPlan.auto_pay_enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {activePaymentPlan.auto_pay_enabled ? 'Auto-Pay Enabled' : 'Manual Payment'}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ₹{Number(activePaymentPlan.total_amount).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monthly EMI</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ₹{Number(activePaymentPlan.monthly_emi).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tenure</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {activePaymentPlan.tenure_months} months
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
