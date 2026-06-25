import React, { useState, useEffect } from 'react';
import { api, setAuthToken, getAuthToken } from './api';
import { User } from './types';
import AuthLayout from './components/AuthLayout';
import CustomerDashboard from './components/CustomerDashboard';
import OperatorDashboard from './components/OperatorDashboard';
import AdminDashboard from './components/AdminDashboard';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch (err) {
      console.error('Session validation failed:', err);
      setAuthToken(null); // Clear invalid token
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white mx-auto animate-spin">
            <RefreshCw className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500 font-mono tracking-wider">SECURE_TRANSIT_SESSION_BOOTING</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Dynamic routing based on authenticated user role */}
      {!user ? (
        <AuthLayout onAuthSuccess={handleAuthSuccess} />
      ) : (
        <>
          {user.role === 'customer' && (
            <CustomerDashboard user={user} onLogout={handleLogout} />
          )}
          {user.role === 'operator' && (
            <OperatorDashboard user={user} onLogout={handleLogout} />
          )}
          {user.role === 'admin' && (
            <AdminDashboard user={user} onLogout={handleLogout} />
          )}

        </>
      )}
    </div>
  );
}
