import React, { useState } from 'react';
import { api, setAuthToken } from '../api';
import { User } from '../types';
import { 
  Mail, Lock, Phone, User as UserIcon, LogIn, UserPlus, ShieldAlert, 
  Bus as BusIcon, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthLayoutProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthLayout({ onAuthSuccess }: AuthLayoutProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isForgotPassword) {
        if (!email) throw new Error('Please enter your email address');
        const res = await api.auth.resetPassword(email);
        setSuccess(res.message);
        setIsForgotPassword(false);
      } else if (isLogin) {
        if (!email || !password) throw new Error('Email and password are required');
        const res = await api.auth.login({ email, password, rememberMe });
        setAuthToken(res.token);
        setSuccess('Logged in successfully!');
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 800);
      } else {
        if (!name || !email || !phone || !password || !confirmPassword) {
          throw new Error('All registration fields are required');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const res = await api.auth.register({ name, email, phone, password, confirmPassword });
        setAuthToken(res.token);
        setSuccess('Registration successful! Logging you in...');
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans relative overflow-hidden">
      
      {/* Decorative ambient visual background blur effects */}
      <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] bg-indigo-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] bg-blue-100/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Top Logo and Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="h-11 w-11 sm:h-14 sm:w-14 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100/80"
            >
              <BusIcon className="h-5 w-5 sm:h-7 sm:w-7" />
            </motion.div>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">RapidTransit</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">SMART BUS DEPARTURES</p>
          </div>
        </div>

        {/* Core Auth Card Container */}
        <div className="bg-white border border-slate-100 shadow-xl shadow-slate-100/40 rounded-3xl p-6 sm:p-8 space-y-6">
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-700 font-bold flex items-start"
              >
                <ShieldAlert className="h-4 w-4 text-rose-500 mr-2 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-xs text-emerald-800 font-bold flex items-start"
              >
                <Sparkles className="h-4 w-4 text-emerald-600 mr-2 shrink-0 mt-0.5" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isForgotPassword ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </div>
            ) : isLogin ? (
              <div className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Password</label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[9px] font-extrabold text-indigo-600 hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 rounded-lg cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2.5 block text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    Remember my access keys
                  </label>
                </div>

              </div>
            ) : (
              <div className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Full Name</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <UserIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="Jane Doe"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Phone Number</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Password</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                  <div className="relative rounded-2xl bg-slate-50 border border-slate-100 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-bold"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>

              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-md shadow-indigo-100/60 text-xs transition cursor-pointer disabled:opacity-50 tracking-wider uppercase"
            >
              {loading ? 'Processing transaction...' : isForgotPassword ? 'Send Reset Token' : isLogin ? 'Sign In Gate' : 'Launch Account'}
            </motion.button>
          </form>

          {/* Card footer alternative switch */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="text-center">
              <span className="text-slate-400 text-xs font-medium">
                {isForgotPassword ? 'Changed your mind?' : isLogin ? 'New around here?' : 'Already have an account?'}
              </span>
            </div>

            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="w-full text-center text-xs font-extrabold text-slate-500 hover:text-slate-900 uppercase tracking-widest cursor-pointer"
              >
                Back to Sign In
              </button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-slate-250 rounded-2xl shadow-3xs text-xs font-extrabold text-slate-600 hover:bg-slate-50 cursor-pointer bg-white transition"
              >
                {isLogin ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2 text-slate-450" />
                    Register New Account
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2 text-slate-450" />
                    Sign In with Existing Pass
                  </>
                )}
              </motion.button>
            )}
          </div>

        </div>


      </div>
    </div>
  );
}
