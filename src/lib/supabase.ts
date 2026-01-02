import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  user_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  disease_type: string;
  monthly_cost: number;
  start_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CostPrediction {
  id: string;
  user_id: string;
  annual_predicted_cost: number;
  monthly_breakdown: { month: string; cost: number }[];
  prediction_date: string;
  created_at: string;
}

export interface PaymentPlan {
  id: string;
  user_id: string;
  prediction_id?: string;
  total_amount: number;
  monthly_emi: number;
  tenure_months: number;
  start_date: string;
  is_active: boolean;
  auto_pay_enabled: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  payment_plan_id?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  transaction_id: string;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}
