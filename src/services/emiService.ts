// src/services/emiService.ts
import { supabase } from '../lib/supabase';
import { calculateCurrentMonthlyCost } from '../utils/costPrediction';

/**
 * ✅ Adjust ACTIVE payment plan when prescriptions change
 * ❌ DOES NOT reset paid EMIs
 * ❌ DOES NOT create new plan
 */
export async function adjustPaymentPlanOnPrescriptionChange(
  userId: string
) {
  // 1️⃣ Get active payment plan
  const { data: plan } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!plan) return;

  // 2️⃣ Get latest prescriptions
  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select('monthly_cost')
    .eq('user_id', userId);

  if (!prescriptions?.length) return;

  const newMonthlyCost =
    calculateCurrentMonthlyCost(prescriptions);

  // 3️⃣ Get payments already made
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_plan_id', plan.id);

  const paidEMIs = payments?.length ?? 0;
  const totalPaidAmount =
    payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

  // 4️⃣ Recalculate totals
  const newTotalAmount =
    newMonthlyCost * plan.tenure_months;

  const remainingMonths = Math.max(
    plan.tenure_months - paidEMIs,
    1
  );

  const remainingAmount = Math.max(
    newTotalAmount - totalPaidAmount,
    0
  );

  const newMonthlyEmi = Math.round(
    remainingAmount / remainingMonths
  );

  // 5️⃣ Update plan WITHOUT touching paid data
  await supabase
    .from('payment_plans')
    .update({
      total_amount: newTotalAmount,
      monthly_emi: newMonthlyEmi,
    })
    .eq('id', plan.id);
}
