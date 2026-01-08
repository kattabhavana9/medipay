import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  supabase,
  Prescription,
  PaymentPlan,
  Payment,
} from '../lib/supabase';
import Layout from '../components/Layout';
import { TrendingUp, Activity } from 'lucide-react';

/* ---------- Small reusable card ---------- */
function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">
        ₹{Number(value || 0).toFixed(2)}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [activePaymentPlan, setActivePaymentPlan] =
    useState<PaymentPlan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------- Load Dashboard Data ---------- */
  useEffect(() => {
    if (user) loadDashboardData();
  }, [user]);

  async function loadDashboardData() {
    setLoading(true);

    const [
      prescriptionsRes,
      activePlanRes,
      paymentsRes,
    ] = await Promise.all([
      supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', user!.id),

      supabase
        .from('payment_plans')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle(),

      supabase
        .from('payments')
        .select('*')
        .eq('user_id', user!.id),
    ]);

    setPrescriptions(prescriptionsRes.data ?? []);
    setActivePaymentPlan(activePlanRes.data ?? null);
    setPayments(paymentsRes.data ?? []);

    setLoading(false);
  }

  /* ---------- Calculations ---------- */

  const currentMonthlyCost = prescriptions.reduce(
    (sum, p) => sum + Number(p.monthly_cost || 0),
    0
  );

  const totalEmis = activePaymentPlan?.tenure_months ?? 0;

  const paidEmis = activePaymentPlan
    ? payments.filter(
        p => p.payment_plan_id === activePaymentPlan.id
      ).length
    : 0;

  const remainingEmis = Math.max(totalEmis - paidEmis, 0);

  const progressPercent =
    totalEmis > 0
      ? Math.round((paidEmis / totalEmis) * 100)
      : 0;

  const remainingAmount =
    activePaymentPlan
      ? Math.max(
          Number(activePaymentPlan.total_amount) -
            paidEmis * Number(activePaymentPlan.monthly_emi),
          0
        )
      : 0;

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Activity className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  /* ---------- UI ---------- */
  return (
    <Layout>
  <div className="space-y-8 animate-fade-in">

    {/* ===== HEADER ===== */}
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-600 mt-1">
        Overview of your medicines and payment plan
      </p>
    </div>

    {/* ===== MONTH AT A GLANCE ===== */}
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl p-6 shadow-md transition-all hover:scale-[1.01]">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">
            This Month at a Glance
          </h2>

          <p className="mt-3 text-white/90">
            Monthly medicine cost:
            <span className="font-bold text-white">
              {' '}₹{currentMonthlyCost.toFixed(2)}
            </span>
          </p>

          <p className="mt-1 text-white/90">
            EMI:
            <span className="font-bold text-white">
              {' '}₹{activePaymentPlan?.monthly_emi ?? 0}
            </span>{' '}
            for {totalEmis} months
          </p>

          <p className="mt-3 text-xs text-white/70">
            Informational only · EMI never changes
          </p>
        </div>

        <div className="bg-white/20 p-4 rounded-xl">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
      </div>
    </div>

    {/* ===== COST SUMMARY ===== */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SummaryCard label="Monthly EMI" value={activePaymentPlan?.monthly_emi} />
      <SummaryCard
        label="Yearly EMI"
        value={
          activePaymentPlan
            ? activePaymentPlan.monthly_emi * 12
            : 0
        }
      />
      <SummaryCard label="Remaining Amount" value={remainingAmount} />
    </div>

    {/* ===== EMI PROGRESS ===== */}
    {activePaymentPlan && (
      <div className="bg-white rounded-xl p-6 border shadow-sm transition-all hover:shadow-md">
        <div className="flex justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            Payment Progress
          </p>
          <p className="text-sm text-gray-500">
            {paidEmis} / {totalEmis} EMIs
          </p>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-xs text-gray-500 mt-2">
          {progressPercent}% completed
        </p>
      </div>
    )}

    {/* ===== ACTIVE PRESCRIPTIONS ===== */}
    {prescriptions.length > 0 && (
      <div className="bg-white rounded-xl p-6 border shadow-sm transition-all hover:shadow-md">
        <h2 className="text-lg font-semibold mb-4">
          Active Prescriptions
        </h2>

        <table className="w-full">
          <thead>
            <tr className="border-b text-gray-600 text-sm">
              <th className="text-left py-2">Medicine</th>
              <th className="text-left py-2">Dosage</th>
              <th className="text-right py-2">Monthly Cost</th>
            </tr>
          </thead>

          <tbody>
            {prescriptions.map(p => (
              <tr
                key={p.id}
                className="border-b hover:bg-gray-50 transition"
              >
                <td className="py-2 font-medium">{p.medicine_name}</td>
                <td className="py-2 text-gray-600">{p.dosage}</td>
                <td className="py-2 text-right font-semibold">
                  ₹{Number(p.monthly_cost).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

  </div>
</Layout>

  );
}


/* ===== Small helper ===== */
// function SummaryCard({ label, value }: { label: string; value?: number }) {
//   return (
//     <div className="bg-white rounded-xl p-6 border shadow-sm">
//       <p className="text-sm text-gray-600">{label}</p>
//       <p className="text-2xl font-bold text-gray-900 mt-2">
//         ₹{Number(value ?? 0).toFixed(2)}
//       </p>
//     </div>
//   );
// }

