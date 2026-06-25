import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User } from '../types';
import { 
  Search, Calendar, MapPin, Bus as BusIcon, Info, Users, CreditCard, 
  Ticket, CheckCircle2, AlertCircle, Trash2, ArrowUpDown, X, Download, 
  ChevronRight, ArrowRight, UserCheck, CalendarDays, RefreshCw, LogOut, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function CustomerDashboard({ user, onLogout }: CustomerDashboardProps) {
  // Navigation: 'search' | 'history'
  const [activeTab, setActiveTab] = useState<'search' | 'history'>('search');

  // Search form state
  const [source, setSource] = useState('Mumbai');
  const [destination, setDestination] = useState('Pune');
  const [travelDate, setTravelDate] = useState(() => {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [sortBy, setSortBy] = useState('earliest_departure');

  // Search Results
  const [schedules, setSchedules] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Seat Selection View
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [scheduleDetails, setScheduleDetails] = useState<any | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // New features states
  const [selectedBoardingPoint, setSelectedBoardingPoint] = useState('');
  const [selectedDroppingPoint, setSelectedDroppingPoint] = useState('');
  const [isOffline, setIsOffline] = useState(() => !!(window as any).isOfflineSimulated);
  const [trackingBooking, setTrackingBooking] = useState<any | null>(null);
  const [trackingScheduleDetails, setTrackingScheduleDetails] = useState<any | null>(null);

  // Booking Flow State
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // History State
  const [bookings, setBookings] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancellationStatus, setCancellationStatus] = useState<string | null>(null);

  // Active Ticket Modal
  const [viewingTicketBooking, setViewingTicketBooking] = useState<any | null>(null);

  // Predefined sources & destinations for easy discovery
  const stations = ['Mumbai', 'Pune', 'Bangalore', 'Chennai', 'Delhi', 'Jaipur', 'Goa', 'Hyderabad'];

  // Helper to resolve coordinates
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

  // Offline Simulator Toggle Handler
  const handleToggleOffline = () => {
    const newVal = !isOffline;
    (window as any).isOfflineSimulated = newVal;
    setIsOffline(newVal);
    if (newVal) {
      setActiveTab('history');
      setSelectedSchedule(null);
    } else {
      fetchHistory();
    }
  };

  // Poll GPS Telemetry for Live Tracking Modal
  useEffect(() => {
    if (!trackingBooking) {
      setTrackingScheduleDetails(null);
      return;
    }

    const fetchLiveGPS = async () => {
      try {
        const details = await api.schedules.get(trackingBooking.schedule_id);
        setTrackingScheduleDetails(details);
      } catch (err) {
        console.error('Error fetching live GPS:', err);
      }
    };

    fetchLiveGPS();
    const interval = setInterval(fetchLiveGPS, 4000);
    return () => clearInterval(interval);
  }, [trackingBooking]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearched(true);
    setSelectedSchedule(null);
    setScheduleDetails(null);
    setSelectedSeats([]);
    setPassengerDetails([]);
    setBookingSuccess(null);
    setBookingError(null);

    try {
      const results = await api.schedules.search({
        source,
        destination,
        date: travelDate,
        sortBy
      });
      setSchedules(results);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSchedule = async (sched: any) => {
    setSelectedSchedule(sched);
    setDetailsLoading(true);
    setSelectedSeats([]);
    setPassengerDetails([]);
    setBookingSuccess(null);
    setBookingError(null);

    try {
      const details = await api.schedules.get(sched.schedule_id);
      setScheduleDetails(details);
      if (details.route.boarding_points && details.route.boarding_points.length > 0) {
        setSelectedBoardingPoint(details.route.boarding_points[0]);
      } else {
        setSelectedBoardingPoint('');
      }
      if (details.route.dropping_points && details.route.dropping_points.length > 0) {
        setSelectedDroppingPoint(details.route.dropping_points[0]);
      } else {
        setSelectedDroppingPoint('');
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSeatClick = (seatLabel: string, isReserved: boolean) => {
    if (isReserved) return;
    
    if (selectedSeats.includes(seatLabel)) {
      const updatedSeats = selectedSeats.filter(s => s !== seatLabel);
      setSelectedSeats(updatedSeats);
      setPassengerDetails(passengerDetails.filter(p => p.seat_number !== seatLabel));
    } else {
      if (selectedSeats.length >= 6) {
        alert('You can book a maximum of 6 seats at once.');
        return;
      }
      const updatedSeats = [...selectedSeats, seatLabel];
      setSelectedSeats(updatedSeats);
      setPassengerDetails([
        ...passengerDetails,
        { name: '', age: '', gender: 'Male', seat_number: seatLabel }
      ]);
    }
  };

  const handlePassengerChange = (seatNumber: string, field: string, value: any) => {
    setPassengerDetails(passengerDetails.map(p => {
      if (p.seat_number === seatNumber) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleConfirmBooking = async () => {
    for (const p of passengerDetails) {
      if (!p.name.trim() || !p.age) {
        setBookingError('Please enter full passenger name and age for all seats.');
        return;
      }
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      const res = await api.bookings.create({
        schedule_id: selectedSchedule.schedule_id,
        seats: selectedSeats,
        passenger_details: passengerDetails.map(p => ({
          name: p.name,
          age: Number(p.age),
          gender: p.gender,
          seat_number: p.seat_number
        })),
        boarding_point: selectedBoardingPoint,
        dropping_point: selectedDroppingPoint
      });
      setBookingSuccess(res);
      setSelectedSchedule(null);
      setScheduleDetails(null);
      setSelectedSeats([]);
      setPassengerDetails([]);
    } catch (err: any) {
      setBookingError(err.message || 'Failed to complete booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleJoinWaitingList = async () => {
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await api.bookings.create({
        schedule_id: selectedSchedule.schedule_id,
        joinWaitingList: true
      });
      setBookingSuccess({
        message: `Successfully joined the waiting list at position #${res.waiting_list_position}.`,
        waitingList: true,
        position: res.waiting_list_position
      });
      setSelectedSchedule(null);
      setScheduleDetails(null);
    } catch (err: any) {
      setBookingError(err.message || 'Failed to join waiting list.');
    } finally {
      setBookingLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await api.bookings.my();
      setBookings(history);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking? A 10% administration charge will apply (90% refund). This action cannot be undone.')) {
      return;
    }

    setCancellationStatus(null);
    try {
      const res = await api.bookings.cancel(bookingId);
      setCancellationStatus(`Booking cancelled. Refund of ₹${res.refund_amount} initiated back to your source account.`);
      fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
    }
  };

  const renderSeatMap = () => {
    if (!scheduleDetails) return null;
    const { bus, schedule } = scheduleDetails;
    
    const colLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, bus.cols);
    const rows = Array.from({ length: bus.rows }, (_, i) => i + 1);

    return (
      <div className="border border-slate-100/80 rounded-3xl p-3 sm:p-6 bg-slate-50/60 flex flex-col items-center overflow-x-auto">
        <div className="w-full max-w-xs bg-slate-200/80 text-center py-1.5 sm:py-2 rounded-xl text-slate-600 font-extrabold text-[8px] sm:text-[10px] tracking-widest mb-4 sm:mb-8 uppercase">
          FRONT / ENGINE SECTION
        </div>

        <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${bus.cols + (bus.cols > 2 ? 1 : 0)}, minmax(0, 1fr))` }}>
          {rows.map((rowNum) => {
            return (
              <React.Fragment key={`row-${rowNum}`}>
                {colLabels.map((colLabel, colIdx) => {
                  const seatLabel = `${colLabel}${rowNum}`;
                  const reservedBy = schedule.seats_status[seatLabel];
                  const isReserved = reservedBy !== null && reservedBy !== undefined;
                  const isSelected = selectedSeats.includes(seatLabel);
                  
                  const isWindow = colLabel === 'A' || colLabel === 'D';
                  
                  return (
                    <motion.button
                      key={seatLabel}
                      whileTap={{ scale: isReserved ? 1 : 0.9 }}
                      onClick={() => handleSeatClick(seatLabel, isReserved)}
                      disabled={isReserved}
                      className={`h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                        isReserved 
                          ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200/40'
                          : isWindow
                          ? 'bg-white hover:bg-indigo-50/50 border-indigo-100 text-indigo-600 font-semibold'
                          : 'bg-white hover:bg-slate-100/50 border-slate-200 text-slate-700 font-medium'
                      }`}
                    >
                      {/* Premium Samsung/iOS Seat Styling Accent */}
                      <span className={`absolute top-0.5 sm:top-1 left-1 sm:left-1.5 right-1 sm:right-1.5 h-1 sm:h-1.5 rounded-t-sm ${
                        isReserved ? 'bg-slate-300/60' : isSelected ? 'bg-indigo-400/80' : 'bg-slate-100'
                      }`} />
                      
                      <span className="text-[9px] sm:text-[11px] font-extrabold mt-1 sm:mt-1.5">{seatLabel}</span>
                      <span className="text-[6px] sm:text-[7px] tracking-wider uppercase opacity-80 scale-90 font-bold">
                        {isReserved ? 'No' : isWindow ? 'Win' : 'Std'}
                      </span>
                    </motion.button>
                  );
                })}

                {bus.cols > 2 && <div className="w-2 sm:w-4 h-9 sm:h-12 flex items-center justify-center" key={`aisle-${rowNum}`}>
                  <span className="w-0.5 sm:w-1 h-2 sm:h-3 bg-slate-200 rounded-full" />
                </div>}
              </React.Fragment>
            );
          })}
        </div>

        {/* Dynamic Interactive Legend */}
        <div className="mt-4 sm:mt-8 pt-3 sm:pt-6 border-t border-slate-200/60 w-full grid grid-cols-2 gap-2 sm:gap-3.5 max-w-sm text-[10px] sm:text-xs font-semibold text-slate-600">
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-100">
            <div className="h-3.5 w-3.5 sm:h-5 sm:w-5 bg-white border border-slate-200 rounded-md sm:rounded-lg shrink-0" />
            <span>Standard</span>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-indigo-50">
            <div className="h-3.5 w-3.5 sm:h-5 sm:w-5 bg-white border border-indigo-100 rounded-md sm:rounded-lg flex items-center justify-center text-[6px] sm:text-[8px] text-indigo-600 font-bold shrink-0">W</div>
            <span>Window</span>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-indigo-50 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-indigo-100">
            <div className="h-3.5 w-3.5 sm:h-5 sm:w-5 bg-indigo-600 rounded-md sm:rounded-lg shadow-2xs shadow-indigo-200 shrink-0" />
            <span className="text-indigo-950 font-bold">Selected</span>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-slate-100 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200">
            <div className="h-3.5 w-3.5 sm:h-5 sm:w-5 bg-slate-200 rounded-md sm:rounded-lg shrink-0" />
            <span className="text-slate-500 font-normal">Reserved</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans pb-24 md:pb-8">
      
      {/* Dynamic Samsung/iPhone inspired top notification/status bar context */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 px-3 py-2.5 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          
          <div className="flex items-center space-x-2 sm:space-x-3.5 shrink-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <BusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">RapidTransit</span>
                <span className="bg-indigo-50 text-indigo-600 text-[8px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.2 rounded-full uppercase tracking-wider">v2.0</span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hello, {user.name.split(' ')[0]}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            <button
              onClick={handleToggleOffline}
              className={`text-[10px] sm:text-xs font-extrabold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full transition flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                isOffline ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <RefreshCw className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${isOffline ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isOffline ? 'Offline Mode' : 'Simulate Offline'}</span>
              <span className="sm:hidden">{isOffline ? 'Offline' : 'Offline'}</span>
            </button>

            {/* Desktop top bar navigation */}
            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  if (isOffline) {
                    alert("Ticket searches and checkouts are disabled while offline. Opening local cached boarding passes under 'My Bookings'.");
                    return;
                  }
                  setActiveTab('search');
                  setSelectedSchedule(null);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === 'search' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-900'
                } ${isOffline ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Search & Book
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                My Bookings
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
        
        {isOffline && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wide">Offline Mode Enabled</h4>
              <p className="text-xs text-rose-600 mt-1 leading-relaxed">
                You are currently simulating an offline environment. Bus schedule searches and ticket checkout are suspended. 
                You can review previously loaded bookings and scan boarding QR codes locally under **My Bookings**.
              </p>
            </div>
          </div>
        )}

        {/* Alerts / Banner Notifications */}
        <AnimatePresence>
          {bookingSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 shadow-xs relative overflow-hidden"
            >
              {/* Samsung style background glowing decor */}
              <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-3.5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-extrabold text-emerald-950">
                    {bookingSuccess.waitingList ? 'Queued on Waiting List' : 'Ticket Reservation Booked!'}
                  </h3>
                  <p className="text-xs text-emerald-700/90 mt-1 leading-relaxed max-w-2xl">
                    {bookingSuccess.waitingList 
                      ? `Your name has been logged. Should a vacancy arise, your reservation triggers automatically. Position: #${bookingSuccess.position}`
                      : `Reservation #${bookingSuccess.booking?.id} has been securely finalized and processed. Check your boarding cards below.`}
                  </p>
                  <div className="mt-4 flex gap-3.5">
                    <button
                      onClick={() => {
                        setBookingSuccess(null);
                        setActiveTab('history');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-sm transition cursor-pointer"
                    >
                      View QR Tickets
                    </button>
                    <button
                      onClick={() => setBookingSuccess(null)}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-extrabold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {cancellationStatus && (
            <motion.div 
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-blue-50 border border-blue-100 rounded-3xl p-5 shadow-3xs flex items-start"
            >
              <Info className="h-5 w-5 text-blue-600 mr-3 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-blue-900 font-bold leading-relaxed">{cancellationStatus}</p>
                <button onClick={() => setCancellationStatus(null)} className="text-[10px] text-blue-600 hover:underline mt-1 font-extrabold block uppercase tracking-wider">Close Alert</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'search' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Search Parameter Side Panel (Minimal Samsung Style Widget Container) */}
            <div className="lg:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Search className="h-4 w-4" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Where to next?</h2>
              </div>
              
              <form onSubmit={handleSearch} className="space-y-4">
                
                {/* Custom Samsung/iOS-like stacked select input */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-3">
                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Departure Station</span>
                    <div className="mt-1 flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="block w-full border-0 bg-transparent text-slate-850 font-extrabold focus:ring-0 text-sm p-0 cursor-pointer"
                      >
                        {stations.map(s => (
                          <option key={`src-${s}`} value={s} disabled={s === destination}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Interchanging divider icon */}
                  <div className="border-t border-slate-200/60 relative py-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-white border border-slate-100 p-1 rounded-lg text-slate-400 shadow-3xs">
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Destination Station</span>
                    <div className="mt-1 flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="block w-full border-0 bg-transparent text-slate-850 font-extrabold focus:ring-0 text-sm p-0 cursor-pointer"
                      >
                        {stations.map(s => (
                          <option key={`dest-${s}`} value={s} disabled={s === source}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Departure Date</span>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                    <input
                      type="date"
                      required
                      value={travelDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="block w-full border-0 bg-transparent text-slate-850 font-extrabold focus:ring-0 text-sm p-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                  <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Sort Departure Schedules</span>
                  <div className="flex items-center space-x-2">
                    <ArrowUpDown className="h-4 w-4 text-indigo-500 shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="block w-full border-0 bg-transparent text-slate-850 font-extrabold focus:ring-0 text-sm p-0 cursor-pointer"
                    >
                      <option value="earliest_departure">Earliest departure</option>
                      <option value="lowest_price">Lowest base fare</option>
                      <option value="fastest_route">Fastest travel duration</option>
                    </select>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={searchLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-2xl shadow-sm text-xs transition cursor-pointer disabled:opacity-50 tracking-wider uppercase"
                >
                  {searchLoading ? 'Scanning departures...' : 'Search Available Buses'}
                </motion.button>
              </form>
            </div>

            {/* Central Booking Grid */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search Results */}
              {searched && !selectedSchedule && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-5">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                        Departures: {source} to {destination}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold">{travelDate}</p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      {schedules.length} buses found
                    </span>
                  </div>

                  {schedules.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl space-y-4">
                      <div className="h-14 w-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                        <BusIcon className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">No buses scheduled for this date</p>
                        <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                          We run new schedules daily. Please ask an Admin or Operator to seed / set up some active routes first!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {schedules.map((sched) => (
                        <div
                          key={sched.schedule_id}
                          className="border border-slate-100 rounded-2xl p-5 hover:border-indigo-400 hover:bg-slate-50/40 transition relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-3xs"
                        >
                          <div className="space-y-3.5 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[9px] rounded-full uppercase tracking-wider">
                                {sched.bus_type}
                              </span>
                              <h4 className="font-extrabold text-slate-850 text-xs">{sched.bus_name}</h4>
                            </div>

                            {/* Apple style Departure / Destination Timeline display */}
                            <div className="flex items-center space-x-4 max-w-md">
                              <div className="text-left shrink-0">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Depart</span>
                                <span className="font-extrabold text-slate-800 text-sm">
                                  {new Date(sched.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              
                              <div className="flex-1 flex items-center space-x-1.5 opacity-60">
                                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full shrink-0" />
                                <span className="h-0.5 flex-1 bg-dashed border-t border-slate-300" />
                                <span className="text-[9px] font-mono font-bold text-indigo-600 px-1.5 bg-indigo-50/80 rounded">
                                  {Math.floor(sched.duration / 60)}h {sched.duration % 60}m
                                </span>
                                <span className="h-0.5 flex-1 bg-dashed border-t border-slate-300" />
                                <span className="h-1.5 w-1.5 bg-rose-500 rounded-full shrink-0" />
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Arrive</span>
                                <span className="font-extrabold text-slate-800 text-sm">
                                  {new Date(sched.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {sched.amenities.map((amenity: string) => (
                                <span key={amenity} className="bg-slate-50 text-slate-500 px-2 py-0.5 text-[9px] rounded-md font-medium border border-slate-100">
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="md:text-right flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                            <div>
                              <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Seat Ticket Fare</div>
                              <div className="text-lg font-extrabold text-slate-900 flex items-baseline">
                                ₹{sched.fare}
                                {sched.pricing_rules_applied.length > 0 && (
                                  <span className="text-[8px] text-amber-600 font-extrabold ml-1.5 bg-amber-50 px-1.5 py-0.5 rounded-md uppercase tracking-wide">Surge</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 text-[10px] font-bold">
                              {sched.is_full ? (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 uppercase tracking-wide">
                                  Sold Out (Queue: {sched.waiting_list_count})
                                </span>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-wide">
                                  {sched.available_seats} / {sched.total_seats} Seats Remaining
                                </span>
                              )}
                            </div>

                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleSelectSchedule(sched)}
                              className={`mt-4 w-full md:w-auto py-2 px-5 rounded-xl font-extrabold text-xs shadow-3xs cursor-pointer transition ${sched.is_full ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                            >
                              {sched.is_full ? 'Join Waiting List' : 'Reserve Seats'}
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Specific Seat Selection view */}
              {selectedSchedule && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
                  
                  {/* Selected Bus Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <button
                        onClick={() => {
                          setSelectedSchedule(null);
                          setScheduleDetails(null);
                        }}
                        className="text-[10px] font-extrabold text-indigo-600 hover:underline mb-1 cursor-pointer block uppercase tracking-wider"
                      >
                        ← Back to Departures
                      </button>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {selectedSchedule.bus_name} • {selectedSchedule.bus_type}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        {selectedSchedule.source} to {selectedSchedule.destination} ({selectedSchedule.travel_date || travelDate})
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Fare Per Seat</div>
                      <div className="text-base font-extrabold text-slate-900">₹{selectedSchedule.fare}</div>
                    </div>
                  </div>

                  {detailsLoading ? (
                    <div className="text-center py-16">
                      <div className="animate-pulse flex flex-col items-center space-y-3">
                        <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                        <p className="text-[11px] text-slate-500 font-bold tracking-wider uppercase">Loading interactive seat plan...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                      
                      {/* Left: Seat map */}
                      <div className="md:col-span-7">
                        <div className="text-xs font-bold text-slate-800 mb-4 flex items-center justify-between">
                          <span>Select Seating Positions</span>
                          <span className="text-[10px] text-slate-400 font-semibold">(Maximum 6 tickets)</span>
                        </div>
                        
                        {selectedSchedule.is_full ? (
                          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-6 text-center space-y-4">
                            <AlertCircle className="h-8 w-8 text-amber-600 mx-auto" />
                            <h4 className="font-extrabold text-amber-950 text-xs uppercase tracking-wide">No Open Seats Remaining</h4>
                            <p className="text-xs text-amber-800/90 leading-relaxed">
                              This bus departure is fully registered. Join the automated Wait List queue. If any booking is canceled, you'll be promoted in order automatically!
                            </p>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={handleJoinWaitingList}
                              disabled={bookingLoading}
                              className="mt-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2 px-5 rounded-xl shadow-xs transition"
                            >
                              {bookingLoading ? 'Registering...' : 'Register on Waiting List'}
                            </motion.button>
                          </div>
                        ) : (
                          renderSeatMap()
                        )}
                      </div>

                      {/* Right: Pricing calculation & passenger details */}
                      <div className="md:col-span-5 space-y-4">
                        {!selectedSchedule.is_full && (
                          <>
                            {/* Fare Details Card */}
                            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                              <h4 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Dynamic Bill Estimation</h4>
                              {selectedSeats.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">Select seats on the map to calculate pricing</p>
                              ) : (
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between text-slate-600 font-semibold">
                                    <span>Dynamic Fare ({selectedSeats.length} × ₹{scheduleDetails.fare_details.dynamic_fare})</span>
                                    <span>₹{scheduleDetails.fare_details.dynamic_fare * selectedSeats.length}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600 font-semibold">
                                    <span>Service booking surcharge</span>
                                    <span>₹{scheduleDetails.fare_details.service_charge * selectedSeats.length}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600 font-semibold">
                                    <span>Taxes & Cess (8%)</span>
                                    <span>₹{scheduleDetails.fare_details.taxes * selectedSeats.length}</span>
                                  </div>

                                  {scheduleDetails.fare_details.pricing_rules_applied.length > 0 && (
                                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-[10px] text-amber-800 space-y-1 mt-2 font-medium">
                                      <span className="font-extrabold block">Dynamic Surge Adjustments:</span>
                                      {scheduleDetails.fare_details.pricing_rules_applied.map((rule: string) => (
                                        <div key={rule}>• {rule}</div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-indigo-950 text-sm">
                                    <span>Total Price</span>
                                    <span>₹{scheduleDetails.fare_details.total_fare * selectedSeats.length}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Passenger Details fields */}
                            {selectedSeats.length > 0 && (
                              <div className="space-y-4 border-t border-slate-100 pt-4">
                                <h4 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Passenger Profiles</h4>
                                {bookingError && <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-150 p-2.5 rounded-xl">{bookingError}</p>}
                                
                                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                                  {passengerDetails.map((passenger) => (
                                    <div key={`p-form-${passenger.seat_number}`} className="bg-white border border-slate-100 p-4 rounded-xl space-y-3 shadow-3xs">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                          Seat Position {passenger.seat_number}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <input
                                            type="text"
                                            placeholder="Full Name"
                                            required
                                            value={passenger.name}
                                            onChange={(e) => handlePassengerChange(passenger.seat_number, 'name', e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            type="number"
                                            placeholder="Age"
                                            required
                                            min="1"
                                            max="110"
                                            value={passenger.age}
                                            onChange={(e) => handlePassengerChange(passenger.seat_number, 'age', e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                                          />
                                          <select
                                            value={passenger.gender}
                                            onChange={(e) => handlePassengerChange(passenger.seat_number, 'gender', e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                                          >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Boarding & Dropping Points Selector */}
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                                  <h4 className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                                    Boarding & Dropping Points
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase mb-1">Boarding Stop</label>
                                      <select
                                        value={selectedBoardingPoint}
                                        onChange={(e) => setSelectedBoardingPoint(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
                                      >
                                        {scheduleDetails?.route?.boarding_points?.map((pt: string) => (
                                          <option key={pt} value={pt}>{pt}</option>
                                        )) || <option value="">Default Boarding Point</option>}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase mb-1">Dropping Stop</label>
                                      <select
                                        value={selectedDroppingPoint}
                                        onChange={(e) => setSelectedDroppingPoint(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-slate-700"
                                      >
                                        {scheduleDetails?.route?.dropping_points?.map((pt: string) => (
                                          <option key={pt} value={pt}>{pt}</option>
                                        )) || <option value="">Default Dropping Point</option>}
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                <motion.button
                                  whileTap={{ scale: 0.98 }}
                                  onClick={handleConfirmBooking}
                                  disabled={bookingLoading}
                                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-2xl shadow-sm text-xs transition cursor-pointer disabled:opacity-50 tracking-wider uppercase"
                                >
                                  {bookingLoading ? 'Finalizing booking...' : 'Pay & Confirm Booking'}
                                </motion.button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* Call-to-action help if first load */}
              {!searched && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-xs text-center max-w-xl mx-auto my-6 space-y-4">
                  <div className="h-14 w-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Plan your next departure</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Select cities and dates in the planner tool. Our system dynamic algorithms adjust ticketing prices in real-time according to seat configurations and scheduling constraints.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Bookings History and Tickets download */
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Ticket className="h-4 w-4" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">My Travel Boarding Cards</h2>
              </div>
              
              <button
                onClick={fetchHistory}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 py-1.5 px-3.5 rounded-xl cursor-pointer transition flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Sync Log
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-16">
                <div className="animate-pulse flex flex-col items-center space-y-2">
                  <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Syncing ledger...</p>
                </div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl space-y-4">
                <div className="h-14 w-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                  <Ticket className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">No active reservations</p>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Once you confirm a travel booking departure, your digital boarding ticket cards will list out instantly here!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {bookings.map((booking) => (
                  <div key={booking.id} className="border border-slate-100 rounded-2xl p-3 sm:p-5 hover:border-indigo-100 bg-slate-50/20 relative flex flex-col justify-between items-start gap-3 sm:gap-5 shadow-3xs">
                    
                    <div className="space-y-3.5 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">ID: {booking.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                          booking.booking_status === 'Confirmed' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/50' 
                            : booking.booking_status === 'Cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {booking.booking_status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">Booked: {new Date(booking.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Offline Cached
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          {booking.route.source} to {booking.route.destination}
                        </h4>
                        <div className="text-xs text-slate-500 font-semibold space-y-1">
                          <div><span className="text-slate-400">Bus Operator:</span> {booking.bus.bus_name} ({booking.bus.bus_type})</div>
                          <div><span className="text-slate-400">Seats Reserved:</span> {booking.seats.join(', ')}</div>
                          <div><span className="text-slate-400">Scheduled Departure:</span> {new Date(booking.schedule.departure_time).toLocaleString()}</div>
                          {booking.boarding_point && (
                            <div><span className="text-slate-400">Boarding Point:</span> {booking.boarding_point}</div>
                          )}
                          {booking.dropping_point && (
                            <div><span className="text-slate-400">Dropping Point:</span> {booking.dropping_point}</div>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-slate-200/60 pt-3">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Registered Passengers</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {booking.passenger_details.map((passenger: any, idx: number) => (
                            <div key={idx} className="bg-white border border-slate-100 p-2 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                              <span className="font-bold text-slate-800">{passenger.name} ({passenger.age}, {passenger.gender.charAt(0)})</span>
                              <span className="bg-indigo-50 text-indigo-700 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-md">Seat {passenger.seat_number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/60 pt-3 sm:pt-4 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      <div>
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Charge</div>
                        <div className="text-lg font-extrabold text-slate-950">₹{booking.total_amount}</div>
                        {booking.payment && (
                          <div className="text-[8px] font-mono text-slate-400">Txn: {booking.payment.transaction_reference}</div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {booking.booking_status === 'Confirmed' && (
                          <>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setTrackingBooking(booking)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl shadow-xs cursor-pointer flex items-center"
                            >
                              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                              Track
                              <span className="hidden sm:inline">&nbsp;Live Bus</span>
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setViewingTicketBooking(booking)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl shadow-xs cursor-pointer flex items-center"
                            >
                              <Ticket className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                              QR Pass
                              <span className="hidden sm:inline">&nbsp;Boarding</span>
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCancelBooking(booking.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-extrabold text-[10px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl cursor-pointer transition flex items-center"
                            >
                              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                              Cancel
                            </motion.button>
                          </>
                        )}
                        {booking.booking_status === 'Cancelled' && (
                          <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 py-1.5 px-3 rounded-xl uppercase tracking-wider border border-rose-100">
                            Refund Processed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating interactive iPhone/Samsung bottom bar for mobile screens */}
      <nav data-mobile-nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl py-2 px-3 shadow-lg flex justify-around items-center">
        <button
          onClick={() => { setActiveTab('search'); setSelectedSchedule(null); }}
          className={`flex flex-col items-center space-y-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${activeTab === 'search' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <Search className="h-4 w-4" />
          <span className="text-[8px] uppercase tracking-wider">Plan Journey</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center space-y-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${activeTab === 'history' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <Ticket className="h-4 w-4" />
          <span className="text-[8px] uppercase tracking-wider">Boarding Cards</span>
        </button>
      </nav>

      {/* Premium Apple Wallet Boarding Pass Modal popup */}
      <AnimatePresence>
        {viewingTicketBooking && (
          <div data-modal-overlay className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative"
            >
              
              {/* Premium Samsung header banner */}
              <div className="bg-indigo-600 px-4 sm:px-6 py-3 sm:py-4 text-white flex justify-between items-center relative">
                {/* Background ambient lighting blur */}
                <div className="absolute -top-12 -left-12 h-24 w-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">Boarding Passes</h3>
                  <p className="text-[10px] text-indigo-150 font-mono">Reference: {viewingTicketBooking.id}</p>
                </div>
                <button
                  onClick={() => setViewingTicketBooking(null)}
                  className="text-white/80 hover:text-white bg-indigo-700 hover:bg-indigo-800 p-1.5 rounded-xl cursor-pointer transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-5 text-center">
                
                {/* Boarding Pass details */}
                <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <h4 className="font-extrabold text-base text-slate-900 leading-tight">
                    {viewingTicketBooking.route.source} to {viewingTicketBooking.route.destination}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold">
                    {new Date(viewingTicketBooking.schedule.departure_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider bg-indigo-50/50 inline-block px-2.5 py-0.5 rounded-full mt-1">
                    {viewingTicketBooking.bus.bus_name} ({viewingTicketBooking.bus.bus_type})
                  </p>
                  {(viewingTicketBooking.boarding_point || viewingTicketBooking.dropping_point) && (
                    <div className="text-[10px] text-slate-500 font-semibold mt-2 border-t border-slate-200/60 pt-2 grid grid-cols-2 gap-2 text-left">
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase font-extrabold tracking-wider">Boarding Stop</span>
                        <span className="text-slate-800 text-[10px] font-bold leading-tight block">{viewingTicketBooking.boarding_point || 'Default'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase font-extrabold tracking-wider">Dropping Stop</span>
                        <span className="text-slate-800 text-[10px] font-bold leading-tight block">{viewingTicketBooking.dropping_point || 'Default'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Apple Wallet Style Multiple Perforated Boarding Passes */}
                <div className="space-y-5 max-h-[350px] overflow-y-auto pr-1">
                  {viewingTicketBooking.tickets.map((ticket: any, idx: number) => (
                    <div key={ticket.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs flex flex-col">
                      
                      {/* Top stub */}
                      <div className="bg-slate-50 px-4 py-2.5 flex justify-between items-center text-xs font-bold text-slate-700 border-b border-slate-100">
                        <span>Passenger: {viewingTicketBooking.passenger_details[idx]?.name}</span>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[9px]">Seat {viewingTicketBooking.seats[idx]}</span>
                      </div>

                      {/* Apple style physical ticket tearing perforated separator */}
                      <div className="relative py-2.5 bg-white">
                        <div className="absolute -left-2 top-1.5 h-3.5 w-3.5 bg-slate-950/60 rounded-full" />
                        <div className="absolute -right-2 top-1.5 h-3.5 w-3.5 bg-slate-950/60 rounded-full" />
                        <div className="tear-off-line h-1 w-full opacity-60" />
                      </div>

                      {/* QR Ticket code display area */}
                      <div className="p-4 flex flex-col items-center space-y-3">
                        <div className="flex justify-center">
                          <img
                            src={ticket.qr_code}
                            alt="Boarding QR Code"
                            referrerPolicy="no-referrer"
                            className="h-32 w-32 sm:h-44 sm:w-44 bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200"
                          />
                        </div>

                        <div className="text-[9px] font-mono text-slate-400">
                          KEY ID: {ticket.id}
                        </div>

                        <div className="bg-slate-50 border border-slate-100 py-1.5 px-3 rounded-xl text-[9px] text-slate-600 font-bold inline-block leading-normal">
                          Verification Check: Scan QR at Bus Gate
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 flex gap-3">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center cursor-pointer transition gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Print pass
                  </button>
                  <button
                    onClick={() => setViewingTicketBooking(null)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition shadow-3xs"
                  >
                    Close Passes
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}

        {/* Live GPS Tracking Modal */}
        {trackingBooking && (
          <div data-modal-overlay className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative"
            >
              <div className="bg-emerald-600 px-4 sm:px-6 py-3 sm:py-4 text-white flex justify-between items-center relative">
                <div className="absolute -top-12 -left-12 h-24 w-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1 sm:gap-1.5">
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> Live Tracking
                  </h3>
                  <p className="text-[10px] text-emerald-100 font-mono">Bus: {trackingBooking.bus.bus_name}</p>
                </div>
                <button
                  onClick={() => setTrackingBooking(null)}
                  className="text-white/80 hover:text-white bg-emerald-700 hover:bg-emerald-800 p-1.5 rounded-xl cursor-pointer transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 sm:p-5 space-y-4 sm:space-y-6">
                
                {/* Route Header Info */}
                <div className="text-center space-y-1">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active Travel Corridor</div>
                  <div className="font-extrabold text-slate-800 text-base flex items-center justify-center gap-2">
                    <span>{trackingBooking.route.source}</span>
                    <ArrowRight className="h-4 w-4 text-indigo-500 animate-pulse" />
                    <span>{trackingBooking.route.destination}</span>
                  </div>
                </div>

                {/* Telemetry Dashboard Cards */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-center">
                  <div className="bg-slate-50 border border-slate-100 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                    <span className="block text-[7px] sm:text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Speed</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 font-mono">
                      {trackingScheduleDetails?.schedule?.gps_speed ?? 0} <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 font-sans">km/h</span>
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                    <span className="block text-[7px] sm:text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Progress</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 font-mono">
                      {(() => {
                        const srcCoords = getCityCoords(trackingBooking.route.source);
                        const destCoords = getCityCoords(trackingBooking.route.destination);
                        const lat = trackingScheduleDetails?.schedule?.gps_latitude ?? srcCoords.lat;
                        const lon = trackingScheduleDetails?.schedule?.gps_longitude ?? srcCoords.lon;
                        const total = Math.sqrt(Math.pow(destCoords.lat - srcCoords.lat, 2) + Math.pow(destCoords.lon - srcCoords.lon, 2));
                        const cur = Math.sqrt(Math.pow(lat - srcCoords.lat, 2) + Math.pow(lon - srcCoords.lon, 2));
                        let pct = total > 0 ? (cur / total) * 100 : 0;
                        if (pct > 100) pct = 100;
                        if (pct < 0) pct = 0;
                        if (trackingScheduleDetails?.schedule?.gps_status === 'Completed') pct = 100;
                        return Math.round(pct);
                      })()}%
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                    <span className="block text-[7px] sm:text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Status</span>
                    <span className={`text-[10px] sm:text-xs font-extrabold block uppercase tracking-wider ${
                      (trackingScheduleDetails?.schedule?.gps_status ?? 'Scheduled') === 'Delayed' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {trackingScheduleDetails?.schedule?.gps_status ?? 'Scheduled'}
                    </span>
                  </div>
                </div>

                {/* Animated Transit Line Progress */}
                {(() => {
                  const srcCoords = getCityCoords(trackingBooking.route.source);
                  const destCoords = getCityCoords(trackingBooking.route.destination);
                  const lat = trackingScheduleDetails?.schedule?.gps_latitude ?? srcCoords.lat;
                  const lon = trackingScheduleDetails?.schedule?.gps_longitude ?? srcCoords.lon;
                  const total = Math.sqrt(Math.pow(destCoords.lat - srcCoords.lat, 2) + Math.pow(destCoords.lon - srcCoords.lon, 2));
                  const cur = Math.sqrt(Math.pow(lat - srcCoords.lat, 2) + Math.pow(lon - srcCoords.lon, 2));
                  let pct = total > 0 ? (cur / total) * 100 : 0;
                  if (pct > 100) pct = 100;
                  if (pct < 0) pct = 0;
                  if (trackingScheduleDetails?.schedule?.gps_status === 'Completed') pct = 100;

                  return (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-3xl p-3 sm:p-5 relative overflow-hidden flex flex-row items-center justify-between">
                      {/* Vertical line track */}
                      <div className="relative w-1.5 sm:w-2 bg-slate-200 h-48 sm:h-64 rounded-full transition-all flex-shrink-0">
                        {/* Dynamic progress bar fill */}
                        <div 
                          className="absolute top-0 left-0 w-full bg-emerald-500 rounded-full transition-all duration-1000" 
                          style={{ height: `${pct}%` }}
                        />
                        {/* Bus icon container */}
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 bg-indigo-600 border-2 border-white text-white p-0.5 sm:p-1 rounded-full shadow-lg transition-all duration-1000 flex items-center justify-center cursor-pointer" 
                          style={{ top: `calc(${pct}% - 12px)` }}
                        >
                          <BusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                        </div>
                      </div>

                      {/* Stops list aligned along transit line */}
                      <div className="flex-1 pl-3 sm:pl-6 h-48 sm:h-64 flex flex-col justify-between text-[10px] sm:text-xs py-1">
                        <div className="flex flex-col text-left">
                          <span className="text-[7px] sm:text-[8px] font-extrabold text-slate-400 uppercase tracking-wide">Origin</span>
                          <span className="font-extrabold text-slate-800 text-[10px] sm:text-xs">{trackingBooking.route.source}</span>
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-[7px] sm:text-[8px] font-extrabold text-indigo-500 uppercase tracking-wide">Boarding</span>
                          <span className="font-bold text-slate-700 text-[10px] sm:text-xs truncate max-w-[140px] sm:max-w-none">{trackingBooking.boarding_point || 'Primary Terminal'}</span>
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-[7px] sm:text-[8px] font-extrabold text-indigo-500 uppercase tracking-wide">Dropping</span>
                          <span className="font-bold text-slate-700 text-[10px] sm:text-xs truncate max-w-[140px] sm:max-w-none">{trackingBooking.dropping_point || 'Destination Terminal'}</span>
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-[7px] sm:text-[8px] font-extrabold text-slate-400 uppercase tracking-wide">Destination</span>
                          <span className="font-extrabold text-slate-800 text-[10px] sm:text-xs">{trackingBooking.route.destination}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Footer status text */}
                <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                  Coordinates: {trackingScheduleDetails?.schedule?.gps_latitude ? `${trackingScheduleDetails.schedule.gps_latitude.toFixed(4)}, ${trackingScheduleDetails.schedule.gps_longitude.toFixed(4)}` : 'Awaiting GPS lock...'}
                </div>

                <div className="border-t border-slate-100 pt-4 text-center">
                  <button
                    onClick={() => setTrackingBooking(null)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
                  >
                    Close Live Tracking
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
