import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Prescription } from '../lib/supabase';
import { checkCostThreshold, calculateCurrentMonthlyCost } from '../utils/costPrediction';
import Layout from '../components/Layout';
import { Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

export default function Prescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [costWarning, setCostWarning] = useState<{
    isHigh: boolean;
    message: string;
    severity: 'info' | 'warning' | 'error';
  } | null>(null);

  const [formData, setFormData] = useState({
    medicine_name: '',
    dosage: '',
    frequency: '',
    disease_type: '',
    monthly_cost: '',
  });

  useEffect(() => {
    if (user) {
      loadPrescriptions();
    }
  }, [user]);

  async function loadPrescriptions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading prescriptions:', error);
  } else {
    setPrescriptions(data || []);
  }
}


  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'monthly_cost' && value) {
      const newCost = parseFloat(value);
      const currentTotal = calculateCurrentMonthlyCost(prescriptions);
      const projectedTotal = currentTotal + newCost;
      const warning = checkCostThreshold(projectedTotal);
      setCostWarning(warning);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);

  try {
    // ✅ ALWAYS get real Supabase auth user
    const { data: { user }, error: authError } =
      await supabase.auth.getUser();

    if (authError || !user) {
      alert("You are not logged in");
      return;
    }

    // 1️⃣ Insert prescription
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        user_id: user.id,
        medicine_name: formData.medicine_name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        disease_type: formData.disease_type,
        monthly_cost: Number(formData.monthly_cost),
      })
      .select()
      .single();

    if (error) throw error;

    // 🔴 2️⃣ IMPORTANT: Invalidate active payment plan
    await supabase
      .from('payment_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    // 🔔 3️⃣ Alert for plan reset
    await supabase.from('alerts').insert({
      user_id: user.id,
      alert_type: 'plan_invalidated',
      title: 'Payment Plan Reset',
      message: 'Your payment plan was reset due to prescription changes.',
      severity: 'info',
    });

    // 4️⃣ Existing high-cost alert (unchanged)
    if (costWarning?.isHigh) {
      await supabase.from('alerts').insert({
        user_id: user.id,
        alert_type: 'high_cost',
        title: 'High Cost Alert',
        message: costWarning.message,
        severity: costWarning.severity,
      });
    }

    // 5️⃣ UI updates
    setPrescriptions([data, ...prescriptions]);
    setShowForm(false);
    setCostWarning(null);
    setFormData({
      medicine_name: '',
      dosage: '',
      frequency: '',
      disease_type: '',
      monthly_cost: '',
    });

  } catch (err: any) {
    console.error("Insert failed:", err);
    alert(err.message || "Failed to add prescription");
  } finally {
    setLoading(false);
  }
}



  async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this prescription?')) return;

  try {
    // 1️⃣ Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2️⃣ Delete prescription
    const { error } = await supabase
      .from('prescriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prescription:', error);
      alert('Failed to delete prescription');
      return;
    }

    // 🔴 3️⃣ Invalidate active payment plan
    await supabase
      .from('payment_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    // 🔔 4️⃣ Insert alert
    await supabase.from('alerts').insert({
      user_id: user.id,
      alert_type: 'plan_invalidated',
      title: 'Payment Plan Reset',
      message: 'Your payment plan was reset due to prescription deletion.',
      severity: 'info',
    });

    // 5️⃣ Update UI
    setPrescriptions(prescriptions.filter((p) => p.id !== id));

  } catch (err) {
    console.error(err);
    alert('Something went wrong while deleting prescription');
  }
}


  const totalMonthlyCost = calculateCurrentMonthlyCost(prescriptions);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
            <p className="text-gray-600 mt-1">Manage your prescription medications</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Prescription</span>
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">New Prescription</h2>

            {costWarning && (
              <div
                className={`p-4 rounded-lg border mb-6 ${
                  costWarning.severity === 'error'
                    ? 'bg-red-50 border-red-200'
                    : costWarning.severity === 'warning'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {costWarning.isHigh ? (
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">Real-Time Cost Check</p>
                    <p className="text-sm text-gray-600 mt-1">{costWarning.message}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    name="medicine_name"
                    value={formData.medicine_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Metformin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dosage
                  </label>
                  <input
                    type="text"
                    name="dosage"
                    value={formData.dosage}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 500mg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <input
                    type="text"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Twice daily"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disease Type
                  </label>
                  <input
                    type="text"
                    name="disease_type"
                    value={formData.disease_type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Type 2 Diabetes"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Cost (₹)
                  </label>
                  <input
                    type="number"
                    name="monthly_cost"
                    value={formData.monthly_cost}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 45.00"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setCostWarning(null);
                    setFormData({
                      medicine_name: '',
                      dosage: '',
                      frequency: '',
                      disease_type: '',
                      monthly_cost: '',
                    });
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Add Prescription'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Prescriptions</h2>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Monthly Cost</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalMonthlyCost.toFixed(2)}</p>
            </div>
          </div>

          {prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No prescriptions added yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-blue-600 font-medium hover:underline"
              >
                Add your first prescription
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {prescription.medicine_name}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Dosage</p>
                          <p className="text-sm text-gray-900">{prescription.dosage}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Frequency</p>
                          <p className="text-sm text-gray-900">{prescription.frequency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Disease Type</p>
                          <p className="text-sm text-gray-900">{prescription.disease_type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Monthly Cost</p>
                          <p className="text-sm font-bold text-gray-900">
                            ₹{Number(prescription.monthly_cost).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(prescription.id)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
