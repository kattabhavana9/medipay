import { Prescription } from '../lib/supabase';

export function calculateCurrentMonthlyCost(prescriptions: Prescription[]) {
  return prescriptions.reduce(
    (sum, p) => sum + Number(p.monthly_cost || 0),
    0
  );
}


export function predictAnnualCost(prescriptions: Prescription[]): {
  annualCost: number;
  monthlyBreakdown: { month: string; cost: number }[];
} {
  const currentMonthlyCost = calculateCurrentMonthlyCost(prescriptions);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonth = new Date().getMonth();
  const monthlyBreakdown: { month: string; cost: number }[] = [];

  let totalCost = 0;

  for (let i = 0; i < 12; i++) {
    const monthIndex = (currentMonth + i) % 12;

    // ✅ CONSTANT COST (no increase)
    const monthlyCost = currentMonthlyCost;

    monthlyBreakdown.push({
      month: monthNames[monthIndex],
      cost: Math.round(monthlyCost * 100) / 100,
    });

    totalCost += monthlyCost;
  }

  return {
    annualCost: Math.round(totalCost * 100) / 100,
    monthlyBreakdown,
  };
}

export function predictMonthlyCostTrend(
  prescriptions: Prescription[]
) {
  const baseCost = calculateCurrentMonthlyCost(prescriptions);

  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];

  const prediction = months.map((m, i) => {
    // 0.5% increase per month (very realistic)
    const factor = 1 + i * 0.005;
    return {
      month: m,
      cost: Math.round(baseCost * factor)
    };
  });

  return prediction;
}


export function generateEMI(totalAmount: number, tenureMonths: number = 12): number {
  return Math.round((totalAmount / tenureMonths) * 100) / 100;
}

export function checkCostThreshold(monthlyCost: number): {
  isHigh: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
} {
  const threshold = 1000;
  const criticalThreshold = 2000;

  if (monthlyCost >= criticalThreshold) {
    return {
      isHigh: true,
      message: `High monthly cost detected: ₹${monthlyCost.toFixed(2)}. This exceeds the critical threshold. Consider reviewing your prescriptions or exploring generic alternatives.`,
      severity: 'error',
    };
  } else if (monthlyCost >= threshold) {
    return {
      isHigh: true,
      message: `Your monthly cost of ₹${monthlyCost.toFixed(2)} is above average. We can help you set up a payment plan.`,
      severity: 'warning',
    };
  }

  return {
    isHigh: false,
    message: `Your monthly cost of ₹${monthlyCost.toFixed(2)} is within the normal range.`,
    severity: 'info',
  };
}

export function generateTransactionId(): string {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}
