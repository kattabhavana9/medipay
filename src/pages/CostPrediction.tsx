import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Prescription, CostPrediction } from '../lib/supabase';
import { predictAnnualCost } from '../utils/costPrediction';
import Layout from '../components/Layout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, DollarSign, Activity } from 'lucide-react';

export default function CostPredictionPage() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [predictions, setPredictions] = useState<CostPrediction[]>([]);
  const [latestPrediction, setLatestPrediction] = useState<CostPrediction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
  const [prescriptionsData, predictionsData] = await Promise.all([
    supabase
      .from('prescriptions')
      .select('*')
      .eq('user_id', user!.id), // ✅ NO is_active filter

    supabase
      .from('cost_predictions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
  ]);

  if (prescriptionsData.error) {
    console.error('Error loading prescriptions:', prescriptionsData.error);
  } else {
    setPrescriptions(prescriptionsData.data || []);
  }

  if (predictionsData.error) {
    console.error('Error loading predictions:', predictionsData.error);
  } else {
    setPredictions(predictionsData.data || []);
    if (predictionsData.data && predictionsData.data.length > 0) {
      setLatestPrediction(predictionsData.data[0]);
    }
  }
}


  async function generatePrediction() {
  if (prescriptions.length === 0) {
    alert('Please add prescriptions first');
    return;
  }

  setLoading(true);

  try {
    const { annualCost, monthlyBreakdown } = predictAnnualCost(prescriptions);

    const { data, error } = await supabase
      .from('cost_predictions')
      .insert({
        user_id: user!.id,
        annual_predicted_cost: annualCost,
        monthly_breakdown: monthlyBreakdown,
      })
      .select()
      .single();

    if (error) throw error;

    setLatestPrediction(data);
    setPredictions([data, ...predictions]);

    // 🔴 DEACTIVATE OLD PAYMENT PLAN
    await supabase
      .from('payment_plans')
      .update({
        is_active: false,
        auto_pay_enabled: false,
      })
      .eq('user_id', user!.id)
      .eq('is_active', true);

    // 🔔 ALERT
    await supabase.from('alerts').insert({
  user_id: user!.id,
  alert_type: 'prediction_generated',
  title: 'Cost Prediction Generated',
  message: `Your annual predicted cost is ₹${annualCost.toFixed(2)}`,
  severity: 'info',
  is_read: false, // ✅ ADD
});


  } catch (err) {
    console.error(err);
    alert('Failed to generate prediction');
  } finally {
    setLoading(false);
  }
}



  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cost Prediction</h1>
            <p className="text-gray-600 mt-1">AI-powered annual prescription cost analysis</p>
          </div>
          <button
            onClick={generatePrediction}
            disabled={loading || prescriptions.length === 0}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrendingUp className="w-5 h-5" />
            <span>{loading ? 'Generating...' : 'Generate Prediction'}</span>
          </button>
        </div>

        {prescriptions.length === 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Activity className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">No Active Prescriptions</p>
                <p className="text-sm text-gray-600 mt-1">
                  Add prescriptions first to generate cost predictions.
                </p>
              </div>
            </div>
          </div>
        )}

        {latestPrediction && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Annual Predicted Cost</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{Number(latestPrediction.annual_predicted_cost).toFixed(2)}
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
                    <p className="text-sm font-medium text-gray-600">Average Monthly Cost</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ₹{(Number(latestPrediction.annual_predicted_cost) / 12).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Prescriptions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{prescriptions.length}</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Activity className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                12-Month Cost Projection
              </h2>
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
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Monthly Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Month</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                        Predicted Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestPrediction.monthly_breakdown.map((month, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">{month.month}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                          ₹{month.cost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td className="py-3 px-4 text-sm font-bold text-gray-900">Total Annual Cost</td>
                      <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
                        ₹{Number(latestPrediction.annual_predicted_cost).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">About This Prediction</h3>
              <p className="text-sm text-gray-600">
                This prediction uses AI-powered analysis considering your current prescriptions, seasonal
                variations, and projected cost growth factors. The model applies a growth factor to account
                for typical medication price increases and seasonal adjustments based on historical healthcare
                spending patterns.
              </p>
            </div>
          </>
        )}

        {predictions.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Prediction History</h2>
            <div className="space-y-3">
              {predictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">
                        ₹{Number(prediction.annual_predicted_cost).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Generated on {new Date(prediction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Avg Monthly</p>
                      <p className="font-medium text-gray-900">
                        ₹{(Number(prediction.annual_predicted_cost) / 12).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
