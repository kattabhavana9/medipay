import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Prescription, CostPrediction, PaymentPlan, Alert } from '../lib/supabase';
import Layout from '../components/Layout';
import { predictMonthlyCostTrend } from '../utils/costPrediction';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, AlertCircle, Activity, Calendar } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [latestPrediction, setLatestPrediction] = useState<CostPrediction | null>(null);
  const [activePaymentPlan, setActivePaymentPlan] = useState<PaymentPlan | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const graphData = predictMonthlyCostTrend(prescriptions);



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

        
{/* ================= Month at a Glance (Single Box) ================= */}
<div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 shadow-sm">
  <div className="flex items-start justify-between">
    <div>
      <h2 className="text-xl font-semibold text-gray-900">
        This Month at a Glance
      </h2>

      <p className="mt-2 text-gray-700">
        You are spending
        <span className="font-bold text-blue-700">
          {' '}₹{currentMonthlyCost.toFixed(2)}
        </span>{' '}
        per month on medicines.
      </p>

      <p className="mt-1 text-gray-700">
        Your EMI of
        <span className="font-bold text-indigo-700">
          {' '}₹{activePaymentPlan
            ? Number(activePaymentPlan.monthly_emi).toFixed(2)
            : '0.00'}
        </span>{' '}
        will continue for
        <span className="font-semibold">
          {' '}{activePaymentPlan?.tenure_months ?? 0} months
        </span>.
      </p>

      <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
        <Activity className="w-4 h-4" />
        Informational only. Cost predictions do not affect your EMI.
      </p>
    </div>

    <div className="bg-blue-100 p-4 rounded-xl">
      <TrendingUp className="w-8 h-8 text-blue-600" />
    </div>
  </div>
</div>

{/* ================= Cost Summary ================= */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* Monthly EMI */}
  <div className="bg-white rounded-xl p-6 border shadow-sm">
    <p className="text-sm text-gray-600">Monthly EMI</p>
    <p className="text-2xl font-bold text-gray-900 mt-2">
      ₹{activePaymentPlan
        ? Number(activePaymentPlan.monthly_emi).toFixed(2)
        : '0.00'}
    </p>
  </div>

  {/* Yearly EMI */}
  <div className="bg-white rounded-xl p-6 border shadow-sm">
    <p className="text-sm text-gray-600">Yearly EMI</p>
    <p className="text-2xl font-bold text-gray-900 mt-2">
      ₹{activePaymentPlan
        ? (Number(activePaymentPlan.monthly_emi) * 12).toFixed(2)
        : '0.00'}
    </p>
  </div>

  {/* Remaining Amount */}
  <div className="bg-white rounded-xl p-6 border shadow-sm">
    <p className="text-sm text-gray-600">Remaining Amount</p>
    <p className="text-2xl font-bold text-gray-900 mt-2">
      ₹{activePaymentPlan
        ? Number(activePaymentPlan.total_amount).toFixed(2)
        : '0.00'}
    </p>
  </div>
</div>

          

        {alerts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Alerts</h2>
            </div>
            {/* 🔹 Monthly Cost Trend (Informational) */}
{prescriptions.length > 0 && (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Monthly Cost Trend (Estimated)
      </h2>
      <TrendingUp className="w-5 h-5 text-blue-600" />
    </div>

    <ResponsiveContainer width="100%" height={400}>
                <LineChart data={latestPrediction.monthly_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ fill: '#2563eb', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>

    <p className="text-xs text-gray-500 mt-2">
      This chart is for awareness only and does not change your payment plan.
    </p>
  </div>
)}

            {/* <div className="space-y-3">
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
            </div> */}
          </div>
        )}

        

        {prescriptions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            {/* 🔹 EMI Progress */}
<div className="mt-6">
  <div className="flex justify-between text-sm text-gray-600 mb-1">
    <span>Payment Progress</span>
    <span>
      ₹{activePaymentPlan.monthly_emi} × {activePaymentPlan.tenure_months}
    </span>
  </div>

  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-green-600 h-2 rounded-full"
      style={{ width: '35%' }} // static visual OK
    />
  </div>
</div>

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
