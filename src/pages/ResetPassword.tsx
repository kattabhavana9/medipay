import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password updated successfully. You can now log in.');
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-20 bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Reset Password</h1>

        {message && <p className="text-green-600 mb-3">{message}</p>}
        {error && <p className="text-red-600 mb-3">{error}</p>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <input
            type="password"
            required
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border p-3 rounded"
          />

          <button className="w-full bg-blue-600 text-white py-3 rounded">
            Update Password
          </button>
        </form>
      </div>
    </Layout>
  );
}
