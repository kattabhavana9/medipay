/*
  # MediPay Database Schema

  ## Overview
  Creates the complete database schema for the MediPay prescription cost and payment planning system.

  ## New Tables
  
  ### 1. `profiles`
  User profile information extending Supabase auth.users
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `phone` (text) - Contact number
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `prescriptions`
  Stores prescription and medicine information
  - `id` (uuid, primary key) - Unique prescription ID
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `medicine_name` (text) - Name of the medicine
  - `dosage` (text) - Dosage information
  - `frequency` (text) - How often taken (daily, weekly, etc.)
  - `disease_type` (text) - Disease/condition being treated
  - `monthly_cost` (decimal) - Monthly cost of prescription
  - `start_date` (date) - When prescription started
  - `is_active` (boolean) - Whether prescription is currently active
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `cost_predictions`
  Stores AI-generated cost predictions
  - `id` (uuid, primary key) - Unique prediction ID
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `annual_predicted_cost` (decimal) - Predicted annual cost
  - `monthly_breakdown` (jsonb) - Month-by-month cost breakdown
  - `prediction_date` (date) - When prediction was generated
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `payment_plans`
  EMI and payment plan information
  - `id` (uuid, primary key) - Unique plan ID
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `prediction_id` (uuid, foreign key) - References cost_predictions(id)
  - `total_amount` (decimal) - Total amount to be paid
  - `monthly_emi` (decimal) - Monthly EMI amount
  - `tenure_months` (integer) - Number of months
  - `start_date` (date) - Plan start date
  - `is_active` (boolean) - Whether plan is active
  - `auto_pay_enabled` (boolean) - Auto-pay toggle
  - `created_at` (timestamptz) - Record creation timestamp

  ### 5. `payments`
  Transaction history and payment records
  - `id` (uuid, primary key) - Unique payment ID
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `payment_plan_id` (uuid, foreign key) - References payment_plans(id)
  - `amount` (decimal) - Payment amount
  - `payment_date` (date) - When payment was made
  - `payment_method` (text) - Payment method used
  - `status` (text) - Payment status (pending, completed, failed)
  - `transaction_id` (text) - Transaction reference
  - `created_at` (timestamptz) - Record creation timestamp

  ### 6. `alerts`
  System alerts and notifications
  - `id` (uuid, primary key) - Unique alert ID
  - `user_id` (uuid, foreign key) - References profiles(id)
  - `alert_type` (text) - Type of alert (high_cost, payment_due, prescription_change)
  - `title` (text) - Alert title
  - `message` (text) - Alert message
  - `severity` (text) - Alert severity (info, warning, error)
  - `is_read` (boolean) - Whether alert has been read
  - `created_at` (timestamptz) - Alert creation timestamp

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Authenticated access required for all operations
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  medicine_name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  disease_type text NOT NULL,
  monthly_cost decimal(10, 2) NOT NULL,
  start_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prescriptions"
  ON prescriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prescriptions"
  ON prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prescriptions"
  ON prescriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prescriptions"
  ON prescriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create cost_predictions table
CREATE TABLE IF NOT EXISTS cost_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  annual_predicted_cost decimal(10, 2) NOT NULL,
  monthly_breakdown jsonb NOT NULL,
  prediction_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cost_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own predictions"
  ON cost_predictions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON cost_predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create payment_plans table
CREATE TABLE IF NOT EXISTS payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  prediction_id uuid REFERENCES cost_predictions(id) ON DELETE SET NULL,
  total_amount decimal(10, 2) NOT NULL,
  monthly_emi decimal(10, 2) NOT NULL,
  tenure_months integer NOT NULL DEFAULT 12,
  start_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  auto_pay_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment plans"
  ON payment_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment plans"
  ON payment_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment plans"
  ON payment_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  payment_plan_id uuid REFERENCES payment_plans(id) ON DELETE SET NULL,
  amount decimal(10, 2) NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'Auto Pay',
  status text DEFAULT 'completed',
  transaction_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text DEFAULT 'info',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_is_active ON prescriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_cost_predictions_user_id ON cost_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_user_id ON payment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);