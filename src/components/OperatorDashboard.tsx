import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User } from '../types';
import { QRScannerSim } from './QRScannerSim';
import { 
  Bus, Calendar, MapPin, Search, CheckCircle, Clock, AlertTriangle, 
  ShieldCheck, Ticket, UserCheck, RefreshCw, ChevronLeft, ChevronRight,
  Sparkles, LogOut, ClipboardList, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OperatorDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function OperatorDashboard({ user, onLogout }: OperatorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'trips'>('board');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripBookings, setTripBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // GPS Simulation States
  const [simulatingTripId, setSimulatingTripId] = useState<string | null>(null);
  const [simSpeed, setSimSpeed] = useState<number>(65);
  const [simStatus, setSimStatus] = useState<string>('En Route');

  // GPS coordinates simulation helper
  const getCityCoords = (city: string): { lat: number; lon: number } => {
    const norm = city.toLowerCase().trim();
    if (norm.includes('mumbai')) return { lat: 19.0760, lon: 72.8777 };
    if (norm.includes('pune')) return { lat: 18.5204, lon: 73.8567 };
    if (norm.includes('bangalore') || norm.includes('bengaluru')) return { lat: 12.9716, lon: 77.5946 };
    if (norm.includes('chennai')) return { lat: 13.0827, lon: 80.2707 };
    if (norm.includes('delhi')) return { lat: 28.6139, lon: 77.2090 };
    if (norm.includes('jaipur')) return { lat: 26.9124, lon: 75.7873 };
    return { lat: 19.0760, lon: 72.8777 };
  };

  useEffect(() => {
    if (!simulatingTripId) return;

    const currentSched = schedules.find(s => s.id === simulatingTripId);
    if (!currentSched || !currentSched.route) return;

    const sourceCoords = getCityCoords(currentSched.route.source);
    const destCoords = getCityCoords(currentSched.route.destination);

    let progressPct = 0;
    if (currentSched.gps_latitude && currentSched.gps_longitude) {
      const totalDist = Math.sqrt(Math.pow(destCoords.lat - sourceCoords.lat, 2) + Math.pow(destCoords.lon - sourceCoords.lon, 2));
      const currentDist = Math.sqrt(Math.pow(currentSched.gps_latitude - sourceCoords.lat, 2) + Math.pow(currentSched.gps_longitude - sourceCoords.lon, 2));
      progressPct = totalDist > 0 ? (currentDist / totalDist) * 100 : 0;
    }

    const interval = setInterval(async () => {
      progressPct += 10; // Increment progress by 10% per step
      if (progressPct >= 100) {
        progressPct = 100;
        setSimulatingTripId(null);
      }

      const lat = sourceCoords.lat + (destCoords.lat - sourceCoords.lat) * (progressPct / 100);
      const lon = sourceCoords.lon + (destCoords.lon - sourceCoords.lon) * (progressPct / 100);
      const finalStatus = progressPct >= 100 ? 'Completed' : simStatus;

      try {
        await api.schedules.updateGPS(simulatingTripId, {
          latitude: lat,
          longitude: lon,
          speed: progressPct >= 100 ? 0 : simSpeed,
          status: finalStatus
        });

        setSchedules(prev => prev.map(s => {
          if (s.id === simulatingTripId) {
            return {
              ...s,
              gps_latitude: lat,
              gps_longitude: lon,
              gps_speed: progressPct >= 100 ? 0 : simSpeed,
              gps_status: finalStatus,
              gps_last_updated: new Date().toISOString()
            };
          }
          return s;
        }));
      } catch (err) {
        console.error('GPS update failed:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [simulatingTripId, simSpeed, simStatus, schedules]);

  // Calendar Selection State - defaults to June 24, 2026 to fit metadata.
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2026, 5, 24));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 5, 1));

  // QR Scanning Simulation State
  const [ticketInput, setTicketInput] = useState('');
  const [scannedTicket, setScannedTicket] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [boardSuccess, setBoardSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, [activeTab]);

  useEffect(() => {
    if (schedules.length > 0) {
      const sorted = [...schedules].sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
      const firstDate = new Date(sorted[0].departure_time);
      setSelectedDate(firstDate);
      setCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
    }
  }, [schedules.length]);

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getFilteredSchedules = () => {
    if (!selectedDate) return schedules;
    return schedules.filter(s => isSameDay(new Date(s.departure_time), selectedDate));
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const data = await api.schedules.list();
      setSchedules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getGroupedSchedules = (schedulesList: any[]) => {
    const sorted = [...schedulesList].sort((a, b) => 
      new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
    );

    const groups: { [date: string]: { [route: string]: any[] } } = {};

    sorted.forEach(s => {
      const dateKey = new Date(s.departure_time).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const routeKey = s.route ? `${s.route.source} → ${s.route.destination}` : 'Unknown Route';

      if (!groups[dateKey]) {
        groups[dateKey] = {};
      }
      if (!groups[dateKey][routeKey]) {
        groups[dateKey][routeKey] = [];
      }
      groups[dateKey][routeKey].push(s);
    });

    return groups;
  };

  const handleFetchTripBookings = async (schedId: string) => {
    setSelectedTripId(schedId);
    setBookingsLoading(true);
    try {
      const allBookings = await api.bookings.all();
      const filtered = allBookings.filter(b => b.schedule_id === schedId);
      setTripBookings(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleVerifyTicket = async (ticketId: string) => {
    if (!ticketId.trim()) return;
    setScanLoading(true);
    setScanError(null);
    setScannedTicket(null);
    setBoardSuccess(null);

    try {
      const res = await api.tickets.verify(ticketId);
      setScannedTicket(res);
    } catch (err: any) {
      setScanError(err.message || 'Invalid Boarding Pass QR Code');
    } finally {
      setScanLoading(false);
    }
  };

  const handleConfirmBoarding = async (ticketId: string) => {
    setScanLoading(true);
    try {
      const res = await api.tickets.board(ticketId);
      setBoardSuccess(res.message);
      if (scannedTicket) {
        setScannedTicket({ ...scannedTicket, ticket_status: 'Boarded' });
      }
      if (selectedTripId) {
        handleFetchTripBookings(selectedTripId);
      }
    } catch (err: any) {
      setScanError(err.message || 'Failed to confirm customer check-in');
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans pb-24 md:pb-8">
      
      {/* Sleek top navigation header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 px-3 py-2.5 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          
          <div className="flex items-center space-x-2 sm:space-x-3.5 shrink-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">RapidTransit Gate</span>
                <span className="bg-emerald-50 text-emerald-700 text-[8px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.2 rounded-full uppercase tracking-wider">Gate OP</span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operator: {user.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* Desktop tabs navigation */}
            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => { setActiveTab('board'); setSelectedTripId(null); }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'board' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Boarding Check-In
              </button>
              <button
                onClick={() => setActiveTab('trips')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'trips' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Occupancy Monitor
              </button>
            </div>

            <button
              onClick={onLogout}
              className="text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 sm:p-2 rounded-xl transition cursor-pointer flex items-center gap-1"
            >
              <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>

        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {activeTab === 'board' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: QR Verification Input Console & Calendar */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-5">
                <div className="space-y-1">
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="h-4 w-4 mr-1.5 text-emerald-600" />
                    QR Boarding Gate
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Position the boarding pass QR code inside the camera viewfinder to instantly verify and check-in passengers.
                  </p>
                </div>

                {/* QR Scanner Component Integration */}
                <QRScannerSim onScanSuccess={(id) => { setTicketInput(id); handleVerifyTicket(id); }} isLoading={scanLoading} />

                {/* QR Verification form / manual entry fallback */}
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Manual Reference Input</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. tkt_17192131923"
                        value={ticketInput}
                        onChange={(e) => setTicketInput(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 font-mono font-bold"
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleVerifyTicket(ticketInput)}
                        disabled={scanLoading || !ticketInput.trim()}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 transition"
                      >
                        {scanLoading ? 'Loading' : 'Verify'}
                      </motion.button>
                    </div>
                  </div>

                  {scanError && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 font-bold flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-rose-500 shrink-0" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  {boardSuccess && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-xs text-emerald-800 font-bold flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600 shrink-0" />
                      <span>{boardSuccess}</span>
                    </div>
                  )}

                  {/* Scanned ticket verification display card */}
                  <AnimatePresence>
                    {scannedTicket && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="border border-slate-100 rounded-2xl p-4 bg-slate-50 space-y-4 shadow-3xs"
                      >
                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60">
                          <div>
                            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">GATE TICKET VERIFICATION</span>
                            <h3 className="text-sm font-extrabold text-slate-850 mt-0.5">{scannedTicket.passenger_name}</h3>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${
                            scannedTicket.ticket_status === 'Boarded'
                              ? 'bg-emerald-100 text-emerald-800'
                              : scannedTicket.ticket_status === 'Cancelled'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {scannedTicket.ticket_status}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs font-semibold text-slate-600">
                          <div className="flex justify-between">
                            <span>Route Departure:</span>
                            <span className="text-slate-800">{scannedTicket.source} to {scannedTicket.destination}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Assigned Bus:</span>
                            <span className="text-slate-800">{scannedTicket.bus_name} ({scannedTicket.bus_type})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Allocated Seat:</span>
                            <span className="text-indigo-600 font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">Seat {scannedTicket.seat}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Departure Time:</span>
                            <span className="text-slate-800">{new Date(scannedTicket.departure_time).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200/60 pt-2 font-bold text-slate-800">
                            <span>Payment Ledger:</span>
                            <span className="text-emerald-700">Paid (₹{scannedTicket.total_amount})</span>
                          </div>
                        </div>

                        {scannedTicket.ticket_status === 'Confirmed' && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleConfirmBoarding(scannedTicket.ticket_id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs cursor-pointer transition flex items-center justify-center space-x-1.5"
                          >
                            <UserCheck className="h-4 w-4" />
                            <span>Confirm Passenger Boarding</span>
                          </motion.button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Interactive Calendar Card */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Shifts Calendar</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                    <button
                      onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] font-extrabold text-slate-700 min-w-[85px] text-center uppercase tracking-wider">
                      {currentMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-8 w-8" />
                  ))}

                  {Array.from({ length: getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum);
                    const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
                    const hasSchedules = schedules.some(s => isSameDay(new Date(s.departure_time), dayDate));

                    return (
                      <button
                        key={`day-${dayNum}`}
                        onClick={() => setSelectedDate(dayDate)}
                        className={`h-8 w-8 rounded-xl text-xs font-extrabold flex flex-col items-center justify-center relative cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        <span>{dayNum}</span>
                        {hasSchedules && !isSelected && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-1 border-t border-slate-100">
                  <span>
                    {selectedDate
                      ? `DATE: ${selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'SHOWING ALL DATES'}
                  </span>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-indigo-600 font-extrabold hover:underline cursor-pointer uppercase tracking-wider text-[9px]"
                    >
                      Show all dates
                    </button>
                  )}
                </div>
              </div>

              {/* Schedules departing on selectedDate */}
              {selectedDate && (
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Shifts on {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                      {getFilteredSchedules().length} departures
                    </span>
                  </div>

                  {getFilteredSchedules().length === 0 ? (
                    <p className="text-center py-4 text-[11px] text-slate-400 font-medium italic">No active shifts for this date.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {getFilteredSchedules().map(sched => (
                        <div key={sched.id} className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl flex justify-between items-center text-xs hover:border-slate-300 transition">
                          <div className="space-y-0.5">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-[11px]">
                              <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[8px] font-bold rounded uppercase">
                                {sched.bus?.bus_type}
                              </span>
                              {sched.bus?.bus_name}
                            </div>
                            <div className="text-[10px] font-bold text-slate-600">
                              {sched.route?.source} to {sched.route?.destination}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {new Date(sched.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <div className="text-[9px] text-slate-400 font-bold font-mono mb-1.5 uppercase">
                              {sched.total_seats - sched.available_seats}/{sched.total_seats} booked
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleFetchTripBookings(sched.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-3 rounded-lg cursor-pointer transition uppercase tracking-wide"
                            >
                              Load
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Live Departures and passenger manifest lists */}
            <div className="lg:col-span-7 space-y-6">
              {selectedTripId ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                    <div>
                      <button
                        onClick={() => setSelectedTripId(null)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:underline mb-1 cursor-pointer block uppercase tracking-wider"
                      >
                        ← Back to Shifts List
                      </button>
                      <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                        Manifest Passengers list
                      </h3>
                      <p className="text-xs text-slate-450 font-medium">
                        Verify and check-in passenger bookings on the current schedule below.
                      </p>
                    </div>

                    <button
                      onClick={() => handleFetchTripBookings(selectedTripId)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                  {/* GPS Simulation Panel */}
                  {(() => {
                    const sched = schedules.find(s => s.id === selectedTripId);
                    if (!sched || !sched.route) return null;

                    const isSimulating = simulatingTripId === selectedTripId;
                    const sourceCoords = getCityCoords(sched.route.source);
                    const destCoords = getCityCoords(sched.route.destination);
                    let progressPct = 0;
                    if (sched.gps_latitude && sched.gps_longitude) {
                      const totalDist = Math.sqrt(Math.pow(destCoords.lat - sourceCoords.lat, 2) + Math.pow(destCoords.lon - sourceCoords.lon, 2));
                      const currentDist = Math.sqrt(Math.pow(sched.gps_latitude - sourceCoords.lat, 2) + Math.pow(sched.gps_longitude - sourceCoords.lon, 2));
                      progressPct = Math.round(totalDist > 0 ? (currentDist / totalDist) * 100 : 0);
                    }
                    if (sched.gps_status === 'Completed') progressPct = 100;

                    return (
                      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Live GPS Simulator
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            isSimulating ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-650'
                          }`}>
                            {isSimulating ? 'Sharing GPS...' : 'GPS Idle'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="text-slate-400 font-bold uppercase text-[9px]">Route Path</div>
                            <div className="font-extrabold text-slate-800">{sched.route.source} → {sched.route.destination}</div>
                            <div className="text-[10px] text-slate-500 font-semibold">Progress: {progressPct}% ({sched.gps_status || 'Scheduled'})</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-400 font-bold uppercase text-[9px]">Coordinates Telemetry</div>
                            <div className="font-mono text-[10px] text-slate-600 font-medium">
                              {sched.gps_latitude ? `${sched.gps_latitude.toFixed(4)}, ${sched.gps_longitude.toFixed(4)}` : 'No GPS Locked'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">Speed: {sched.gps_speed || 0} km/h</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-205/50">
                          {isSimulating ? (
                            <button
                              onClick={() => setSimulatingTripId(null)}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold py-1.5 px-3 rounded-lg cursor-pointer transition uppercase tracking-wider"
                            >
                              Stop Simulation
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (sched.gps_status === 'Completed') {
                                  try {
                                    await api.schedules.updateGPS(sched.id, {
                                      latitude: sourceCoords.lat,
                                      longitude: sourceCoords.lon,
                                      speed: 0,
                                      status: 'Scheduled'
                                    });
                                    setSchedules(prev => prev.map(s => {
                                      if (s.id === sched.id) {
                                        return { ...s, gps_latitude: sourceCoords.lat, gps_longitude: sourceCoords.lon, gps_speed: 0, gps_status: 'Scheduled' };
                                      }
                                      return s;
                                    }));
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }
                                setSimulatingTripId(sched.id);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold py-1.5 px-3 rounded-lg cursor-pointer transition uppercase tracking-wider"
                            >
                              {sched.gps_status === 'Completed' ? 'Restart & Simulate GPS' : 'Start GPS Simulation'}
                            </button>
                          )}

                          <div className="flex items-center space-x-1 ml-auto">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Speed:</span>
                            <select
                              value={simSpeed}
                              onChange={(e) => setSimSpeed(Number(e.target.value))}
                              className="bg-white border border-slate-200 text-[10px] font-bold rounded-md px-1.5 py-0.5 outline-none"
                            >
                              <option value="40">40 km/h</option>
                              <option value="65">65 km/h</option>
                              <option value="90">90 km/h</option>
                            </select>
                          </div>

                          <div className="flex items-center space-x-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Status:</span>
                            <select
                              value={simStatus}
                              onChange={(e) => setSimStatus(e.target.value)}
                              className="bg-white border border-slate-200 text-[10px] font-bold rounded-md px-1.5 py-0.5 outline-none"
                            >
                              <option value="En Route">En Route</option>
                              <option value="Delayed">Delayed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {bookingsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-pulse flex flex-col items-center space-y-2">
                        <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Syncing Manifest...</p>
                      </div>
                    </div>
                  ) : tripBookings.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 font-medium italic">
                      No passengers registered on this schedule yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tripBookings.map((bk) => (
                        <div key={bk.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40 space-y-3.5 shadow-3xs">
                          <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200/60 pb-2">
                            <span className="text-slate-500 font-mono">BOOKING ID: {bk.id}</span>
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                              bk.booking_status === 'Confirmed' ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                            }`}>{bk.booking_status}</span>
                          </div>

                          <div className="space-y-2">
                            {bk.passenger_details.map((passenger: any, idx: number) => {
                              const tkt = bk.tickets && bk.tickets[idx];
                              const isBoarded = tkt?.ticket_status === 'Boarded';
                              const isCancelled = bk.booking_status === 'Cancelled' || tkt?.ticket_status === 'Cancelled';

                              return (
                                <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-2.5 sm:p-3 border border-slate-100 rounded-xl shadow-3xs gap-2">
                                  <div>
                                    <div className="text-xs font-extrabold text-slate-800">
                                      {passenger.name} ({passenger.age} yr, {passenger.gender})
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400 font-semibold mt-0.5">
                                      Seat Position: <strong className="text-slate-700">{passenger.seat_number}</strong> | Key: {tkt?.id || 'tkt_demo'}
                                    </div>
                                  </div>

                                  <div className="flex gap-1.5 shrink-0">
                                    {isCancelled ? (
                                      <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 border border-rose-100 py-1 px-2.5 rounded-lg uppercase tracking-wide">Cancelled</span>
                                    ) : isBoarded ? (
                                      <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 py-1 px-2.5 rounded-lg flex items-center gap-1 uppercase tracking-wide">
                                        <CheckCircle className="h-3.5 w-3.5" /> Checked-in
                                      </span>
                                    ) : (
                                      <>
                                        <motion.button
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => {
                                            setTicketInput(tkt?.id || '');
                                            handleVerifyTicket(tkt?.id || '');
                                          }}
                                          className="text-[9px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 py-1 px-2.5 rounded-lg cursor-pointer transition uppercase tracking-wide"
                                        >
                                          Select QR
                                        </motion.button>
                                        <motion.button
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => handleConfirmBoarding(tkt?.id)}
                                          className="text-[9px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 py-1 px-2.5 rounded-lg cursor-pointer transition uppercase tracking-wide"
                                        >
                                          Board
                                        </motion.button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Scheduled Departures Manifest</h3>
                    <button onClick={fetchSchedules} className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-pulse text-xs font-bold text-slate-400 uppercase">Fetching schedules...</div>
                    </div>
                  ) : schedules.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 font-medium italic">No route schedules seeded. Set some up in the Admin portal.</div>
                  ) : (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {Object.entries(getGroupedSchedules(getFilteredSchedules())).map(([date, routesObj]) => (
                        <div key={date} className="space-y-2.5">
                          <div className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl flex items-center gap-1.5 uppercase tracking-wider">
                            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                            Departure Date: {date}
                          </div>
                          <div className="space-y-3.5 pl-1">
                            {Object.entries(routesObj).map(([routeStr, items]) => (
                              <div key={routeStr} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 space-y-3">
                                <div className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                                  <span>{routeStr}</span>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{items.length} departures</span>
                                </div>
                                <div className="space-y-2">
                                  {items.map((sched) => (
                                    <div key={sched.id} className="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center text-xs shadow-3xs hover:border-indigo-300 transition">
                                      <div className="space-y-0.5">
                                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                          <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[8px] font-bold rounded uppercase">
                                            {sched.bus?.bus_type}
                                          </span>
                                          {sched.bus?.bus_name}
                                        </div>
                                        <div className="text-[10px] text-slate-405 font-bold flex items-center gap-1 mt-0.5">
                                          <Clock className="h-3 w-3 text-slate-450" />
                                          {new Date(sched.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      </div>
                                      <div className="text-right flex items-center gap-3">
                                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                                          {sched.total_seats - sched.available_seats}/{sched.total_seats} booked
                                        </span>
                                        <motion.button
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => handleFetchTripBookings(sched.id)}
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] py-1 px-3 rounded-lg cursor-pointer transition uppercase tracking-wide shadow-3xs"
                                        >
                                          Open Manifest
                                        </motion.button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Trips Tab details */
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Fleet Departure Capacity Manager</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium mt-1">
                Real-time dashboard for bus capacity tracking. View seat layouts and occupancy density.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-pulse text-xs font-bold text-slate-400 uppercase">Updating fleet database...</div>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-medium italic">No active schedules registered.</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(getGroupedSchedules(getFilteredSchedules())).map(([date, routesObj]) => (
                  <div key={date} className="space-y-4 border border-slate-100 p-5 rounded-3xl bg-slate-50/20">
                    <div className="text-xs font-extrabold text-slate-850 border-b border-slate-200/60 pb-2.5 flex items-center gap-2 uppercase tracking-wide">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      Departure Date: {date}
                    </div>
                    <div className="space-y-4 pl-1">
                      {Object.entries(routesObj).map(([routeStr, items]) => (
                        <div key={routeStr} className="space-y-3">
                          <div className="flex items-center space-x-2 pl-1">
                            <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{routeStr}</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map((sched) => {
                              const occupancyRate = sched.total_seats > 0 ? Math.round(((sched.total_seats - sched.available_seats) / sched.total_seats) * 100) : 0;
                              return (
                                <div key={sched.id} className="border border-slate-100 rounded-2xl p-4 bg-white flex flex-col justify-between gap-4 shadow-3xs hover:border-indigo-150 transition">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-extrabold rounded-md uppercase tracking-wider">
                                        Shift {sched.id}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">
                                        Time: {new Date(sched.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <div className="text-xs font-extrabold text-slate-850">
                                      {sched.bus?.bus_name} ({sched.bus?.bus_type})
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold">
                                      Route Distance: {sched.route?.distance} km | Ticket Fare: ₹{sched.base_fare}
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 pt-2 border-t border-slate-100 font-semibold text-slate-600">
                                    <div className="flex justify-between text-[10px] font-bold">
                                      <span>Occupancy Rate</span>
                                      <span>{occupancyRate}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-300 ${occupancyRate > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`} style={{ width: `${occupancyRate}%` }} />
                                    </div>
                                    <div className="text-[9px] text-slate-400 text-right font-bold">
                                      {sched.total_seats - sched.available_seats} of {sched.total_seats} seats booked
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating interactive iPhone/Samsung style bottom bar for mobile screens */}
      <nav data-mobile-nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl py-2 px-3 shadow-lg flex justify-around items-center">
        <button
          onClick={() => { setActiveTab('board'); setSelectedTripId(null); }}
          className={`flex flex-col items-center space-y-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${activeTab === 'board' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <UserCheck className="h-4 w-4" />
          <span className="text-[8px] uppercase tracking-wider">Check-In</span>
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex flex-col items-center space-y-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${activeTab === 'trips' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <ClipboardList className="h-4 w-4" />
          <span className="text-[8px] uppercase tracking-wider">Monitor</span>
        </button>
      </nav>

    </div>
  );
}
