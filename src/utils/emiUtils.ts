// src/utils/emiUtils.ts
export function startEmiPlan(
  monthlyCost: number,
  tenureMonths = 12
) {
  const totalAmount = monthlyCost * tenureMonths;

  return {
    total_tenure: tenureMonths,
    paid_months: 0,
    total_paid: 0,
    outstanding_amount: totalAmount,
    current_emi: Math.round(totalAmount / tenureMonths),
  };
}
