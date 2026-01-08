import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, CostPrediction, PaymentPlan, Payment } from '../lib/supabase';
import { generateEMI, generateTransactionId } from '../utils/costPrediction';
import Layout from '../components/Layout';
import { CreditCard, Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react';

export default function PaymentPlanPage() {
  const { user } = useAuth();
  const [latestPrediction, setLatestPrediction] = useState<CostPrediction | null>(null);
  const [activePaymentPlan, setActivePaymentPlan] = useState<PaymentPlan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenureMonths, setTenureMonths] = useState(12);
  // 🔹 Filter payments for active plan
// 🔹 Filter payments for active plan
const planPayments = activePaymentPlan
  ? payments.filter(
      (p) => p.payment_plan_id === activePaymentPlan.id
    )
  : [];

// 🔹 EMI Progress Calculations (USE planPayments ONLY)
const totalEMIs = activePaymentPlan?.tenure_months ?? 0;
const paidEMIs = planPayments.length;

const totalPaidAmount = planPayments.reduce(
  (sum, p) => sum + Number(p.amount),
  0
);

const remainingEMIs = Math.max(totalEMIs - paidEMIs, 0);

const remainingAmount = activePaymentPlan
  ? Math.max(
      0,
      Number(activePaymentPlan.total_amount) - totalPaidAmount
    )
  : 0;

const progressPercentage = activePaymentPlan && totalEMIs > 0
  ? Math.min(100, (paidEMIs / totalEMIs) * 100)
  : 0;




  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
  // 1️⃣ Load latest prediction
  const { data: predictionData } = await supabase
    .from('cost_predictions')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (predictionData) {
    setLatestPrediction(predictionData);
  }

  // 2️⃣ Load active payment plan
  const { data: paymentPlanData } = await supabase
  .from('payment_plans')
  .select('*')
  .eq('user_id', user!.id)
  .eq('is_active', true)
  .maybeSingle();



  if (!paymentPlanData) {
    // No active plan → reset payments
    setActivePaymentPlan(null);
    setPayments([]);
    return;
  }

  setActivePaymentPlan(paymentPlanData);

  // 3️⃣ Load payments ONLY for this plan
  const { data: paymentsData } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user!.id)
    .eq('payment_plan_id', paymentPlanData.id)
    .order('created_at', { ascending: false })
    .limit(50);

  setPayments(paymentsData || []);
}

  async function createPaymentPlan() {
  if (!latestPrediction) {
    alert('Please generate a cost prediction first');
    return;
  }

  // 🔍 DEBUG LOGS — ADD HERE
  console.log("AUTH USER:", user);
  console.log("AUTH UID:", user?.id);
  console.log("PREDICTION:", latestPrediction);

  setLoading(true);


    try {
      if (activePaymentPlan) {
  await supabase
    .from('payment_plans')
    .update({ is_active: false })
    .eq('id', activePaymentPlan.id);
}


      const totalAmount = Number(latestPrediction.annual_predicted_cost);
      const monthlyEMI = generateEMI(totalAmount, tenureMonths);

      const { data, error } = await supabase
  .from('payment_plans')
  .insert({
    user_id: user!.id,
    prediction_id: latestPrediction.id,
    total_amount: totalAmount,
    monthly_emi: monthlyEMI,
    tenure_months: tenureMonths,
    auto_pay_enabled: false,
    is_active: true,
  })
  .select();

if (error) {
  console.error("SUPABASE ERROR:", error.message, error.details);
  throw error;
}

setActivePaymentPlan(data[0]);


      if (monthlyEMI > 500) {
        await supabase.from('alerts').insert({
  user_id: user!.id,
  alert_type: 'payment_completed',
  title: 'Payment Successful',
  message: `Payment of ₹${amount} completed`,
  severity: 'info',
  is_read: false, // ✅ ADD THIS
});

      }
    } catch (error) {
      console.error('Error creating payment plan:', error);
      
    } finally {
      setLoading(false);
    }
  }

  async function toggleAutoPay() {
    if (!activePaymentPlan) return;

    const newStatus = !activePaymentPlan.auto_pay_enabled;

    const { error } = await supabase
      .from('payment_plans')
      .update({ auto_pay_enabled: newStatus })
      .eq('id', activePaymentPlan.id);

    if (error) {
      console.error('Error toggling auto-pay:', error);
      alert('Failed to update auto-pay setting');
    } else {
      setActivePaymentPlan({ ...activePaymentPlan, auto_pay_enabled: newStatus });
    }
  }
  async function simulatePayment() {
  if (!activePaymentPlan) return;

  if (paidEMIs >= totalEMIs) {
    alert('Payment plan already completed');
    return;
  }

  setLoading(true);

  try {
    const transactionId = generateTransactionId();

    const isLastPayment = paidEMIs + 1 === totalEMIs;
    const paymentAmount = isLastPayment
      ? Number(activePaymentPlan.total_amount) - totalPaidAmount
      : Number(activePaymentPlan.monthly_emi);

    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: user!.id,
        payment_plan_id: activePaymentPlan.id,
        amount: Number(paymentAmount.toFixed(2)),
        payment_method: activePaymentPlan.auto_pay_enabled
          ? 'Auto Pay'
          : 'Manual Payment',
        status: 'completed',
        transaction_id: transactionId,
      })
      .select()
      .single();

    if (error) throw error;

    setPayments([data, ...payments]);

    const totalPaidEmis = paidEMIs + 1;

    // ✅ THIS BLOCK MUST STAY INSIDE simulatePayment
    if (totalPaidEmis >= activePaymentPlan.tenure_months) {
      await supabase
        .from('payment_plans')
        .update({
          is_active: false,
          auto_pay_enabled: false,
        })
        .eq('id', activePaymentPlan.id);

      await supabase.from('alerts').insert([
        {
          user_id: user!.id,
          alert_type: 'payment_plan_completed',
          title: 'Payment Plan Completed 🎉',
          message: `You have successfully completed your payment plan of ₹${Number(
            activePaymentPlan.total_amount
          ).toFixed(2)}.`,
          severity: 'success',
        },
        {
          user_id: user!.id,
          alert_type: 'next_steps',
          title: 'What’s Next?',
          message:
            'Upload a new prescription to generate your next cost prediction.',
          severity: 'info',
        },
      ]);
    }

    alert('Payment simulated successfully!');
  } catch (err) {
    console.error(err);
    alert('Failed to simulate payment');
  } finally {
    setLoading(false);
  }
}


  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Plan</h1>
          <p className="text-gray-600 mt-1">Manage your prescription payment plan and EMI</p>
        </div>

        {!latestPrediction ? (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">No Cost Prediction Available</p>
                <p className="text-sm text-gray-600 mt-1">
                  Generate a cost prediction first to create a payment plan.
                </p>
              </div>
            </div>
          </div>
        ) : !activePaymentPlan ? (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Payment Plan</h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{Number(latestPrediction.annual_predicted_cost).toFixed(2)}
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Tenure</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{tenureMonths} months</p>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Monthly EMI</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{generateEMI(Number(latestPrediction.annual_predicted_cost), tenureMonths).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Tenure (months)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[6, 12, 18, 24].map((months) => (
                    <button
                      key={months}
                      onClick={() => setTenureMonths(months)}
                      className={`py-3 rounded-lg border-2 font-medium transition-colors ${
                        tenureMonths === months
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {months} months
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={createPaymentPlan}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Plan...' : 'Create Payment Plan'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
  Payment Plan
  {!activePaymentPlan.is_active && (
    <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">
      Completed
    </span>
  )}
</h2>

                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    activePaymentPlan.auto_pay_enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {activePaymentPlan.auto_pay_enabled ? 'Auto-Pay Enabled' : 'Manual Payment'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <p className="text-sm text-gray-600">Total Amount</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{Number(activePaymentPlan.total_amount).toFixed(2)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-gray-600">Monthly EMI</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{Number(activePaymentPlan.monthly_emi).toFixed(2)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    <p className="text-sm text-gray-600">Tenure</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {activePaymentPlan.tenure_months} months
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
  <div className="flex justify-between text-sm text-gray-600">
    <span>EMIs Paid</span>
    <span>{paidEMIs} / {totalEMIs}</span>
  </div>

  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-blue-600 h-2 rounded-full transition-all"
      style={{ width: `${progressPercentage}%` }}
    />
  </div>

  <div className="grid grid-cols-2 gap-4 mt-4">
    <div className="bg-green-50 p-3 rounded-lg">
      <p className="text-sm text-gray-600">Amount Paid</p>
      <p className="text-lg font-bold text-gray-900">
        ₹{totalPaidAmount.toFixed(2)}
      </p>
    </div>

    <div className="bg-orange-50 p-3 rounded-lg">
      <p className="text-sm text-gray-600">Remaining Amount</p>
      <p className="text-lg font-bold text-gray-900">
        ₹{remainingAmount.toFixed(2)}
      </p>
    </div>
  </div>
</div>


              <div className="flex gap-4">
                <button
                  onClick={toggleAutoPay}
                  className="flex-1 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  {activePaymentPlan.auto_pay_enabled ? 'Disable Auto-Pay' : 'Enable Auto-Pay'}
                </button>

                <button
  onClick={simulatePayment}
  disabled={loading || !activePaymentPlan.is_active}
  className={`flex-1 py-3 rounded-lg font-medium transition-colors
    ${activePaymentPlan.is_active
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-gray-300 text-gray-600 cursor-not-allowed'}
  `}
>
  {activePaymentPlan.is_active ? 'Simulate Payment' : 'Plan Completed'}
</button>

              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Transaction History</h2>

              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No transactions yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Your payment history will appear here
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                          Transaction ID
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Method</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm text-gray-900 font-mono">
                            {payment.transaction_id}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {payment.payment_method}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                            ₹{Number(payment.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              <span>{payment.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
