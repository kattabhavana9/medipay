import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { calculateCurrentMonthlyCost } from '../utils/costPrediction';
import Layout from '../components/Layout';
import { Plus, Trash2 } from 'lucide-react';
import { Prescription } from '../lib/supabase';
import Tesseract from 'tesseract.js';
import {
  adjustPaymentPlanOnPrescriptionChange
} from '../services/emiService';






/* ---------------- CONFIG ---------------- */

const MEDICINE_KEYWORDS = [
  // Diabetes
  'metformin',
  'glimepiride',
  'gliclazide',
  'sitagliptin',
  'vildagliptin',
  'empagliflozin',
  'insulin',

  // Hypertension
  'amlodipine',
  'telmisartan',
  'losartan',
  'ramipril',
  'bisoprolol',
  'nebivolol',
  'hydrochlorothiazide',

  // Cholesterol / Cardiac
  'atorvastatin',
  'rosuvastatin',
  'fenofibrate',
  'aspirin',
  'clopidogrel',

  // Thyroid
  'levothyroxine',

  // Gastric
  'pantoprazole',
  'esomeprazole',

  // Bone / Deficiency
  'vitamin d',
  'cholecalciferol',
  'calcium',

  // Respiratory
  'montelukast',
  'budesonide',
  'salbutamol',
  'tiotropium',

  // Neurology / Mental health
  'levetiracetam',
  'gabapentin',
  'sertraline',

  // Others
  'allopurinol',
  'tamsulosin',
  'finasteride',

  // General
  'paracetamol',
  'azithromycin',
  'antibiotic',
  'cough syrup'
];


const BLOCK_WORDS = [
  'gst', 'invoice', 'tax', 'total', 'amount', 'bank',
  'ifsc', 'customer', 'address', 'date', 'signature'
];

/* ---------------- HELPERS ---------------- */

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/gi, ' ').trim();
}

function extractDosage(line: string) {
  return line.match(/\d+\s?(mg|ml|g)/i)?.[0] || 'As prescribed';
}

/* ---------------- COMPONENT ---------------- */

export default function Prescriptions() {
  const { user } = useAuth();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const totalMonthlyCost = calculateCurrentMonthlyCost(prescriptions);
  const [detectedMedicines, setDetectedMedicines] = useState<{
    name: string;
    dosage: string;
    quantity: number;
    monthly_cost: number;
    disease_type: string;
    selected: boolean;
  }[]>([]);

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    if (user) loadPrescriptions();
  }, [user]);

  async function loadPrescriptions() {
    const { data } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    setPrescriptions(data || []);
  }

  /* ---------------- OCR ---------------- */

  async function extractText(file: File) {
    const result = await Tesseract.recognize(file, 'eng');
    return result.data.text;
  }

  /* ---------------- OCR → MEDICINES ---------------- */

  async function detectMedicinesFromText(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const found: any[] = [];

    for (const line of lines) {
      const clean = normalize(line);
      if (BLOCK_WORDS.some(w => clean.includes(w))) continue;

      for (const keyword of MEDICINE_KEYWORDS) {
        if (clean.includes(keyword)) {
          const dosage = extractDosage(line);

          const { data } = await supabase
            .from('medicine_prices')
            .select('monthly_cost, disease_type')
            .ilike('medicine_name', `%${keyword}%`)
            .maybeSingle();

          if (!data) continue;

          found.push({
            name: keyword,
            dosage,
            quantity: 1,
            monthly_cost: data.monthly_cost,
            disease_type: data.disease_type,
            selected: false,
          });
        }
      }
    }

    // remove duplicates
    const unique = Array.from(
      new Map(found.map(m => [m.name, m])).values()
    );

    setDetectedMedicines(unique);
  }

  /* ---------------- SUBMIT ---------------- */

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);

  try {
    const selected = detectedMedicines.filter(m => m.selected);
    if (!selected.length) {
      alert('Select at least one medicine');
      return;
    }

    // 1️⃣ Insert medicines
    for (const med of selected) {
      await supabase.from('prescriptions').insert({
        user_id: user!.id,
        medicine_name: med.name,
        dosage: med.dosage,
        frequency: 'As prescribed',
        disease_type: med.disease_type,
        quantity: med.quantity,
        monthly_cost: med.monthly_cost * med.quantity,
      });
    }

    // 2️⃣ Reload prescriptions
    await loadPrescriptions();

    // 3️⃣ Adjust EXISTING payment plan
    await adjustPaymentPlanOnPrescriptionChange(user!.id);

    // 4️⃣ Reset UI
    setDetectedMedicines([]);
    setShowForm(false);

  } catch (err) {
    console.error(err);
    alert('Failed to add prescriptions');
  } finally {
    setLoading(false);
  }
}
async function deletePrescription(id: string) {
  await supabase.from('prescriptions').delete().eq('id', id);

  await loadPrescriptions();

  await adjustPaymentPlanOnPrescriptionChange(user!.id);
}



  return (
    <Layout>
      <div className="space-y-6">

        <div className="flex justify-between">
          <h1 className="text-3xl font-bold">Prescriptions</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            <Plus /> Add
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded space-y-4">

            <input
              type="file"
              accept="image/*"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await extractText(file);
                await detectMedicinesFromText(text);
              }}
            />

            {detectedMedicines.map((med, i) => (
              <div key={i} className="border p-3 rounded space-y-2">
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={med.selected}
                    onChange={() =>
                      setDetectedMedicines(prev =>
                        prev.map((m, idx) =>
                          idx === i ? { ...m, selected: !m.selected } : m
                        )
                      )
                    }
                  />
                  <strong>{med.name}</strong> ({med.dosage})
                </label>

                <div>
                  Qty:
                  <input
                    type="number"
                    min={1}
                    value={med.quantity}
                    onChange={e =>
                      setDetectedMedicines(prev =>
                        prev.map((m, idx) =>
                          idx === i ? { ...m, quantity: +e.target.value } : m
                        )
                      )
                    }
                    className="ml-2 w-20 border"
                  />
                </div>

                <p className="text-sm">
                  ₹{med.monthly_cost} × {med.quantity} = ₹
                  {med.monthly_cost * med.quantity}
                </p>
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded"
            >
              {loading ? 'Adding...' : 'Add Prescription'}
            </button>
          </form>
        )}

        <div className="bg-white p-4 rounded">
  <p className="font-bold">
    Total Monthly Cost: ₹{totalMonthlyCost.toFixed(2)}
  </p>

  {prescriptions.map(p => (
    <div key={p.id} className="flex justify-between border-b py-2">
      <div>
        <p className="font-semibold">{p.medicine_name}</p>
        <p className="text-sm">{p.dosage}</p>
      </div>

      <button
        onClick={() => deletePrescription(p.id)}
        className="text-red-600 hover:text-red-800"
      >
        <Trash2 />
      </button>
    </div>
  ))}
</div>


      </div>
    </Layout>
  );
}
