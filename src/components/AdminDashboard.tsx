import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User, Bus, Route, Schedule, Booking, PricingRule, DashboardStats } from '../types';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Bus as BusIcon, Route as RouteIcon, Calendar, Percent, Landmark, TrendingUp, Users, 
  MapPin, Clock, Settings, FileSpreadsheet, Plus, Trash2, Edit3, Search, RefreshCw, X, ShieldCheck,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'buses' | 'routes' | 'schedules' | 'bookings' | 'pricing'>('analytics');

  // Analytics states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [popularRoutes, setPopularRoutes] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Entities states
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);

  // Search filter for bookings
  const [bookingSearch, setBookingSearch] = useState('');

  // Admin Calendar and Selection States
  const [schedulesSelectedDate, setSchedulesSelectedDate] = useState<Date | null>(new Date(2026, 5, 24));
  const [schedulesCurrentMonth, setSchedulesCurrentMonth] = useState<Date>(new Date(2026, 5, 1));

  const [bookingsSelectedDate, setBookingsSelectedDate] = useState<Date | null>(new Date(2026, 5, 24));
  const [bookingsCurrentMonth, setBookingsCurrentMonth] = useState<Date>(new Date(2026, 5, 1));

  useEffect(() => {
    if (schedules.length > 0) {
      const sorted = [...schedules].sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
      const firstDate = new Date(sorted[0].departure_time);
      
      setSchedulesSelectedDate(firstDate);
      setSchedulesCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
      
      setBookingsSelectedDate(firstDate);
      setBookingsCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
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

  const getFilteredAdminSchedules = () => {
    if (!schedulesSelectedDate) return schedules;
    return schedules.filter(s => isSameDay(new Date(s.departure_time), schedulesSelectedDate));
  };

  // Form states & Modals
  const [showBusModal, setShowBusModal] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [busForm, setBusForm] = useState({
    bus_name: '',
    bus_type: 'Luxury' as any,
    capacity: 32,
    amenities: 'AC, WiFi, Charging Port',
    rows: 8,
    cols: 4
  });

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeForm, setRouteForm] = useState({
    source: '',
    destination: '',
    distance: 100,
    duration: 120
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    bus_id: '',
    route_id: '',
    departure_time: '',
    arrival_time: '',
    base_fare: 40
  });

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState<PricingRule | null>(null);
  const [pricingForm, setPricingForm] = useState({
    name: '',
    multiplier: 1.15,
    type: 'time' as any,
    applies_to: ''
  });

  // Helpers to group schedules and bookings
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

  const getGroupedBookings = (bookingsList: any[]) => {
    const groups: { [scheduleId: string]: { schedule: any; bookings: any[] } } = {};

    bookingsList.forEach(b => {
      const sId = b.schedule_id || 'unassigned';
      if (!groups[sId]) {
        groups[sId] = {
          schedule: b.schedule ? {
            ...b.schedule,
            bus: b.bus,
            route: b.route
          } : null,
          bookings: []
        };
      }
      groups[sId].bookings.push(b);
    });

    return Object.values(groups).sort((a, b) => {
      if (!a.schedule) return 1;
      if (!b.schedule) return -1;
      return new Date(a.schedule.departure_time).getTime() - new Date(b.schedule.departure_time).getTime();
    });
  };

  useEffect(() => {
    fetchAnalytics();
    fetchEntities();
  }, [activeTab]);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.admin.analytics();
      setStats(res.stats);
      setPopularRoutes(res.popularRoutes);
      setMonthlyRevenue(res.monthlyRevenue);
      setDailyRevenue(res.dailyRevenue);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const b = await api.buses.list();
      setBuses(b);

      const r = await api.routes.list();
      setRoutes(r);

      const s = await api.schedules.list();
      setSchedules(s);

      const bk = await api.bookings.all();
      setBookings(bk);

      const p = await api.pricingRules.list();
      setPricingRules(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // BUS MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const handleBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...busForm,
      capacity: Number(busForm.capacity),
      rows: Number(busForm.rows),
      cols: Number(busForm.cols),
      amenities: busForm.amenities.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      if (editingBus) {
        await api.buses.update(editingBus.id, payload);
      } else {
        await api.buses.create(payload);
      }
      setShowBusModal(false);
      setEditingBus(null);
      fetchEntities();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleEditBus = (bus: Bus) => {
    setEditingBus(bus);
    setBusForm({
      bus_name: bus.bus_name,
      bus_type: bus.bus_type,
      capacity: bus.capacity,
      amenities: bus.amenities.join(', '),
      rows: bus.rows,
      cols: bus.cols
    });
    setShowBusModal(true);
  };

  const handleDeleteBus = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this bus?')) return;
    try {
      await api.buses.delete(id);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // -------------------------------------------------------------
  // ROUTE MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoute) {
        await api.routes.update(editingRoute.id, routeForm);
      } else {
        await api.routes.create(routeForm);
      }
      setShowRouteModal(false);
      setEditingRoute(null);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setRouteForm({
      source: route.source,
      destination: route.destination,
      distance: route.distance,
      duration: route.duration
    });
    setShowRouteModal(true);
  };

  const handleDeleteRoute = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this route?')) return;
    try {
      await api.routes.delete(id);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // -------------------------------------------------------------
  // SCHEDULES MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await api.schedules.update(editingSchedule.id, scheduleForm);
      } else {
        await api.schedules.create(scheduleForm);
      }
      setShowScheduleModal(false);
      setEditingSchedule(null);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditSchedule = (sched: any) => {
    setEditingSchedule(sched);
    setScheduleForm({
      bus_id: sched.bus_id,
      route_id: sched.route_id,
      departure_time: sched.departure_time,
      arrival_time: sched.arrival_time,
      base_fare: sched.base_fare
    });
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await api.schedules.delete(id);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // -------------------------------------------------------------
  // BOOKINGS MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const handleCancelBookingAdmin = async (id: string) => {
    if (!window.confirm('Cancel this booking as Admin? This initiates a 90% refund and triggers waiting list promotions.')) return;
    try {
      const res = await api.bookings.cancel(id);
      let alertMsg = 'Booking cancelled successfully.';
      if (res.waiting_list_promoted) {
        alertMsg += ` Waitlist passenger promoted automatically: ${res.waiting_list_promoted}`;
      }
      alert(alertMsg);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // -------------------------------------------------------------
  // PRICING MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPricing) {
        await api.pricingRules.update(editingPricing.id, pricingForm);
      } else {
        await api.pricingRules.create(pricingForm);
      }
      setShowPricingModal(false);
      setEditingPricing(null);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditPricing = (rule: PricingRule) => {
    setEditingPricing(rule);
    setPricingForm({
      name: rule.name,
      multiplier: rule.multiplier,
      type: rule.type,
      applies_to: rule.applies_to
    });
    setShowPricingModal(true);
  };

  const handleDeletePricing = async (id: string) => {
    if (!window.confirm('Delete this pricing rule?')) return;
    try {
      await api.pricingRules.delete(id);
      fetchEntities();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // -------------------------------------------------------------
  // CSV EXPORT GENERATOR UTILITY
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    if (bookings.length === 0) return;
    
    // Header Row
    const headers = ['Booking ID', 'Passenger(s)', 'Route', 'Scheduled Trip Date', 'Bus Type', 'Base Fare', 'Total Amount', 'Status', 'Date Booked'];
    const csvRows = [headers.join(',')];

    bookings.forEach(b => {
      const passengerNames = b.passenger_details?.map((p: any) => p.name).join(' | ') || '';
      const routeStr = b.route ? `"${b.route.source} to ${b.route.destination}"` : '"Unknown Route"';
      const scheduledDateStr = b.schedule ? `"${new Date(b.schedule.departure_time).toLocaleString()}"` : '"Unknown Date"';
      const row = [
        b.id,
        `"${passengerNames}"`,
        routeStr,
        scheduledDateStr,
        b.bus?.bus_type || 'N/A',
        b.schedule ? `₹${b.schedule.base_fare}` : 'N/A',
        `₹${b.total_amount}`,
        b.booking_status,
        new Date(b.created_at).toLocaleDateString()
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Online_Bus_System_Bookies_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered bookings list based on search key
  const filteredBookings = bookings.filter(b => {
    const searchKey = bookingSearch.toLowerCase();
    const matchesSearch = (
      b.id.toLowerCase().includes(searchKey) ||
      b.user?.email?.toLowerCase().includes(searchKey) ||
      b.user?.name?.toLowerCase().includes(searchKey) ||
      b.route?.source?.toLowerCase().includes(searchKey) ||
      b.route?.destination?.toLowerCase().includes(searchKey)
    );

    if (!matchesSearch) return false;

    if (bookingsSelectedDate) {
      const departureTime = b.schedule?.departure_time;
      if (!departureTime) return false;
      return isSameDay(new Date(departureTime), bookingsSelectedDate);
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Header bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center flex-wrap gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-xs">
                <Settings className="h-4 w-4 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-bold text-slate-950">Online Bus System</h1>
                <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold font-mono uppercase tracking-wider">Enterprise Administration Hub</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <div className="hidden lg:flex space-x-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Analytics & Visualizations
                </button>
                <button
                  onClick={() => setActiveTab('buses')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'buses' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Buses
                </button>
                <button
                  onClick={() => setActiveTab('routes')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'routes' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Routes
                </button>
                <button
                  onClick={() => setActiveTab('schedules')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'schedules' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Schedules
                </button>
                <button
                  onClick={() => setActiveTab('bookings')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'bookings' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All Bookings
                </button>
                <button
                  onClick={() => setActiveTab('pricing')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'pricing' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Pricing Rules
                </button>
              </div>

              <button
                onClick={onLogout}
                className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="lg:hidden flex overflow-x-auto bg-white border-b border-slate-200 scrollbar-none">
        {['analytics', 'buses', 'routes', 'schedules', 'bookings', 'pricing'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`whitespace-nowrap px-4 py-3 text-xs font-semibold border-b-2 capitalize transition ${activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* TAB 1: ANALYTICS & VISUALIZATIONS */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Quick Metrics Cards */}
            {analyticsLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-white border border-slate-200 h-28 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              stats && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Revenue Cash</span>
                      <Landmark className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">₹{stats.revenue}</div>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Simulated full sales</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Bookings</span>
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">{stats.totalBookings}</div>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Confirmed & Checked</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Active Routes</span>
                      <RouteIcon className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">{stats.activeRoutes}</div>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Hub network links</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Fleet Occupancy</span>
                      <Percent className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">{stats.occupancyRate}%</div>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Average seat utilization</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs col-span-2 lg:col-span-1">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Bus Utilization</span>
                      <BusIcon className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-2">{stats.busUtilization}%</div>
                    <p className="text-[9px] text-slate-400 font-mono mt-1">Fleet active on schedules</p>
                  </div>
                </div>
              )
            )}

            {/* Recharts Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily revenue trend */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">Daily Sales & Bookings Progress</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenue}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Popular Routes */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">Popular Transit Links</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={popularRoutes}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="destination" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip formatter={(value, name) => [name === 'bookingCount' ? `${value} Bookings` : `₹${value}`, name === 'bookingCount' ? 'Tickets' : 'Revenue']} />
                      <Bar dataKey="bookingCount" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom Section: Active Pricing surge alerts */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-2xs">
              <h4 className="text-sm font-extrabold text-amber-900 mb-2">Automated Optimization Alert Rules</h4>
              <p className="text-xs text-amber-800 leading-relaxed mb-3">
                Pricing scales automatically depending on standard schedules rules. Weekend surges (+15%) and demand spikes (+25%) apply dynamically when occupancy exceeds 80% per departure, optimizing total ticket revenue.
              </p>
              <div className="flex gap-2">
                {pricingRules.map(rule => (
                  <span key={rule.id} className="bg-white border border-amber-300 rounded px-2.5 py-1 text-[10px] text-amber-900 font-bold">
                    {rule.name} ({rule.multiplier}x)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BUS MANAGEMENT CRUD */}
        {activeTab === 'buses' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Manage Fleet (Buses)</h2>
                <p className="text-xs text-slate-500">Configure buses, seater/sleeper categories, and capacities.</p>
              </div>
              <button
                onClick={() => {
                  setEditingBus(null);
                  setBusForm({ bus_name: '', bus_type: 'Luxury', capacity: 32, amenities: 'AC, WiFi, Charging Port', rows: 8, cols: 4 });
                  setShowBusModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center cursor-pointer shadow-3xs"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Fleet Bus
              </button>
            </div>

            {loading ? (
              <p className="text-center py-10 text-xs text-slate-500 animate-pulse">Loading buses...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {buses.map((bus) => (
                  <div key={bus.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 relative bg-slate-50/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-600 font-bold">
                          {bus.bus_type}
                        </span>
                        <h3 className="font-bold text-slate-950 mt-1.5 text-sm">{bus.bus_name}</h3>
                        <p className="text-xs text-slate-400 font-mono">ID: {bus.id}</p>
                      </div>

                      <div className="flex space-x-1.5">
                        <button
                          onClick={() => handleEditBus(bus)}
                          className="p-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBus(bus.id)}
                          className="p-1.5 border border-red-200 bg-white hover:bg-red-50 rounded text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Capacity:</span>
                        <span className="font-bold text-slate-800">{bus.capacity} Seats ({bus.rows}R × {bus.cols}C Grid)</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Amenities:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bus.amenities.map(a => (
                            <span key={a} className="bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 text-[9px]">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ROUTE MANAGEMENT CRUD */}
        {activeTab === 'routes' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Manage Route Links</h2>
                <p className="text-xs text-slate-500">Add or edit distances and duration timings across operational channels.</p>
              </div>
              <button
                onClick={() => {
                  setEditingRoute(null);
                  setRouteForm({ source: '', destination: '', distance: 100, duration: 120 });
                  setShowRouteModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center cursor-pointer shadow-3xs"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Route Link
              </button>
            </div>

            {loading ? (
              <p className="text-center py-10 text-xs text-slate-500">Loading route link charts...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {routes.map((route) => (
                  <div key={route.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 relative bg-slate-50/20 flex justify-between items-center">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-1.5">
                        <RouteIcon className="h-4 w-4 text-slate-500" />
                        <h4 className="font-extrabold text-slate-950 text-sm">
                          {route.source} to {route.destination}
                        </h4>
                      </div>
                      <div className="text-xs text-slate-600">
                        Distance: <strong>{route.distance} km</strong> | Estimated Duration: <strong>{Math.floor(route.duration / 60)}h {route.duration % 60}m</strong>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {route.id}</p>
                    </div>

                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => handleEditRoute(route)}
                        className="p-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded text-slate-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRoute(route.id)}
                        className="p-1.5 border border-red-200 bg-white hover:bg-red-50 rounded text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SCHEDULE MANAGEMENT CRUD */}
        {activeTab === 'schedules' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 flex-wrap gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Configure Fleet Schedules</h2>
                <p className="text-xs text-slate-500">Assign buses and schedule departures with dynamic seat availability checks.</p>
              </div>
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setScheduleForm({ bus_id: buses[0]?.id || '', route_id: routes[0]?.id || '', departure_time: '', arrival_time: '', base_fare: 40 });
                  setShowScheduleModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center cursor-pointer shadow-3xs"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Schedule Departure
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Calendar Date Selector */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-800" />
                      <span className="text-xs font-bold text-slate-900">Select Departure Date</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSchedulesCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[11px] font-bold text-slate-700 min-w-[95px] text-center">
                        {schedulesCurrentMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => setSchedulesCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: getFirstDayOfMonth(schedulesCurrentMonth.getFullYear(), schedulesCurrentMonth.getMonth()) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-7 w-7" />
                    ))}

                    {Array.from({ length: getDaysInMonth(schedulesCurrentMonth.getFullYear(), schedulesCurrentMonth.getMonth()) }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const dayDate = new Date(schedulesCurrentMonth.getFullYear(), schedulesCurrentMonth.getMonth(), dayNum);
                      const isSelected = schedulesSelectedDate && isSameDay(dayDate, schedulesSelectedDate);
                      const hasSchedules = schedules.some(s => isSameDay(new Date(s.departure_time), dayDate));

                      return (
                        <button
                          key={`day-${dayNum}`}
                          onClick={() => setSchedulesSelectedDate(dayDate)}
                          className={`h-7 w-7 rounded-lg text-xs font-bold flex flex-col items-center justify-center relative cursor-pointer transition ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-3xs'
                              : 'text-slate-700 hover:bg-slate-100'
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

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pt-1">
                    <span>
                      {schedulesSelectedDate
                        ? `Selected: ${schedulesSelectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'Showing All Dates'}
                    </span>
                    {schedulesSelectedDate && (
                      <button
                        onClick={() => setSchedulesSelectedDate(null)}
                        className="text-slate-900 font-bold hover:underline cursor-pointer text-[10px]"
                      >
                        Show All Dates
                      </button>
                    )}
                  </div>
                </div>

                {schedulesSelectedDate && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                    <span className="font-bold text-slate-700">Day Overview</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-3xs">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Total Shifts</div>
                        <div className="text-sm font-extrabold text-slate-800">{getFilteredAdminSchedules().length}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-3xs">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Buses Used</div>
                        <div className="text-sm font-extrabold text-slate-800">
                          {new Set(getFilteredAdminSchedules().map(s => s.bus_id)).size}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Dynamic Schedule Tables */}
              <div className="lg:col-span-8 space-y-6">
                {loading ? (
                  <p className="text-center py-10 text-xs text-slate-500">Loading schedules...</p>
                ) : getFilteredAdminSchedules().length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                    No schedules configured for this date.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(getGroupedSchedules(getFilteredAdminSchedules())).map(([date, routesObj]) => (
                      <div key={date} className="border border-slate-200 rounded-xl p-4 bg-slate-50/10 space-y-4">
                        <div className="text-xs font-bold text-slate-800 bg-slate-100/80 px-3 py-2 rounded-lg flex items-center gap-1.5 border border-slate-200">
                          <Calendar className="h-4 w-4 text-slate-600" />
                          Departure Date: {date}
                        </div>

                        <div className="space-y-4 pl-1">
                          {Object.entries(routesObj).map(([routeStr, items]) => (
                            <div key={routeStr} className="space-y-2">
                              <div className="flex items-center space-x-2 pl-1">
                                <MapPin className="h-3.5 w-3.5 text-indigo-600" />
                                <h4 className="text-xs font-bold text-slate-900">{routeStr}</h4>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold font-mono">
                                  {items.length} departures
                                </span>
                              </div>

                              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                                  <thead className="bg-slate-50 font-bold text-slate-500 uppercase">
                                    <tr>
                                      <th className="px-4 py-2.5">Assigned Fleet</th>
                                      <th className="px-4 py-2.5">Departure Time</th>
                                      <th className="px-4 py-2.5">Base Fare</th>
                                      <th className="px-4 py-2.5">Occupied Seats</th>
                                      <th className="px-4 py-2.5 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150 text-slate-800">
                                    {items.map((s) => (
                                      <tr key={s.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2.5">
                                          <div className="font-semibold text-slate-900">{s.bus?.bus_name}</div>
                                          <div className="text-[10px] text-slate-400">{s.bus?.bus_type}</div>
                                        </td>
                                        <td className="px-4 py-2.5 font-medium flex items-center gap-1">
                                          <Clock className="h-3 w-3 text-slate-400" />
                                          {new Date(s.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-2.5 font-bold text-slate-900">₹{s.base_fare}</td>
                                        <td className="px-4 py-2.5">
                                          <span className="font-bold text-indigo-700">{s.total_seats - s.available_seats}</span>
                                          <span className="text-slate-400"> of {s.total_seats} seats</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right flex justify-end items-center space-x-1.5 h-full">
                                          <button
                                            onClick={() => handleEditSchedule(s)}
                                            className="p-1 border border-slate-200 bg-white hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                                          >
                                            <Edit3 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteSchedule(s.id)}
                                            className="p-1 border border-red-200 bg-white hover:bg-red-50 rounded text-red-600 cursor-pointer"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ALL BOOKINGS LEDGER */}
        {activeTab === 'bookings' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 flex-wrap gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">System Bookings Registry</h2>
                <p className="text-xs text-slate-500">Monitor passenger bookings, cancel transactions, or extract database audit sheets.</p>
              </div>

              <div className="flex space-x-2 w-full md:w-auto">
                <button
                  onClick={fetchEntities}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs py-2 px-3 rounded-lg flex items-center cursor-pointer transition shadow-3xs"
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Refresh
                </button>
                <button
                  onClick={handleExportCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center cursor-pointer transition shadow-3xs"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                  Export CSV Audit Sheet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Calendar selector & Search */}
              <div className="lg:col-span-4 space-y-4">
                <div className="mb-2 relative rounded-md shadow-3xs w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search Booking ID, Email, Customer..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
                  />
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-800" />
                      <span className="text-xs font-bold text-slate-900">Select Booking Date</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setBookingsCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[11px] font-bold text-slate-700 min-w-[95px] text-center">
                        {bookingsCurrentMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => setBookingsCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: getFirstDayOfMonth(bookingsCurrentMonth.getFullYear(), bookingsCurrentMonth.getMonth()) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-7 w-7" />
                    ))}

                    {Array.from({ length: getDaysInMonth(bookingsCurrentMonth.getFullYear(), bookingsCurrentMonth.getMonth()) }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const dayDate = new Date(bookingsCurrentMonth.getFullYear(), bookingsCurrentMonth.getMonth(), dayNum);
                      const isSelected = bookingsSelectedDate && isSameDay(dayDate, bookingsSelectedDate);
                      
                      const hasBookings = bookings.some(b => {
                        const depTime = b.schedule?.departure_time;
                        return depTime && isSameDay(new Date(depTime), dayDate);
                      });

                      return (
                        <button
                          key={`day-${dayNum}`}
                          onClick={() => setBookingsSelectedDate(dayDate)}
                          className={`h-7 w-7 rounded-lg text-xs font-bold flex flex-col items-center justify-center relative cursor-pointer transition ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-3xs'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{dayNum}</span>
                          {hasBookings && !isSelected && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pt-1">
                    <span>
                      {bookingsSelectedDate
                        ? `Selected: ${bookingsSelectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'Showing All Dates'}
                    </span>
                    {bookingsSelectedDate && (
                      <button
                        onClick={() => setBookingsSelectedDate(null)}
                        className="text-slate-900 font-bold hover:underline cursor-pointer text-[10px]"
                      >
                        Show All Dates
                      </button>
                    )}
                  </div>
                </div>

                {bookingsSelectedDate && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                    <span className="font-bold text-slate-700">Bookings Overview</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-3xs">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bookings</div>
                        <div className="text-sm font-extrabold text-slate-805">
                          {filteredBookings.length}
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-3xs">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Revenue</div>
                        <div className="text-sm font-extrabold text-emerald-700">
                          ₹{filteredBookings.reduce((sum, b) => sum + (b.booking_status === 'Confirmed' ? b.total_amount : 0), 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Bookings Ledger Entries */}
              <div className="lg:col-span-8 space-y-6">
                {loading ? (
                  <p className="text-center py-10 text-xs text-slate-500 animate-pulse">Loading transaction database...</p>
                ) : filteredBookings.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                    No bookings matching criteria on this date.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {getGroupedBookings(filteredBookings).map((group, idx) => {
                      const s = group.schedule;
                      const bks = group.bookings;
                      const totalSeatsBooked = bks.reduce((acc, b) => acc + b.seats.length, 0);
                      const totalRevenue = bks.reduce((acc, b) => acc + (b.booking_status === 'Confirmed' ? b.total_amount : 0), 0);

                      return (
                        <div key={s?.id || `unassigned-${idx}`} className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-slate-50/10 animate-fade-in">
                          
                          {/* Schedule Summary Banner */}
                          <div className="bg-slate-100/85 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <BusIcon className="h-4 w-4 text-slate-600" />
                                <span className="font-extrabold text-slate-900 text-xs">
                                  {s ? `${s.bus?.bus_name} (${s.bus?.bus_type})` : 'Unassigned/Deleted Bus'}
                                </span>
                                {s?.route && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">
                                    {s.route.source} → {s.route.destination}
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-[11px] text-slate-500 flex items-center space-x-3 flex-wrap">
                                {s ? (
                                  <span className="flex items-center">
                                    <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                                    {new Date(s.departure_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                    <span className="mx-1.5">•</span>
                                    <Clock className="h-3 w-3 mr-1 text-slate-400" />
                                    {new Date(s.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : (
                                  <span>No schedule detail</span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 text-[10px] font-mono">
                              <div className="bg-white border border-slate-250 px-2 py-1 rounded-md">
                                <span className="text-slate-400 font-bold">PASSENGERS:</span>{' '}
                                <strong className="text-slate-700 font-extrabold">{totalSeatsBooked}</strong>
                              </div>
                              <div className="bg-white border border-slate-250 px-2 py-1 rounded-md">
                                <span className="text-slate-400 font-bold">REVENUE:</span>{' '}
                                <strong className="text-emerald-700 font-extrabold">₹{totalRevenue}</strong>
                              </div>
                            </div>
                          </div>

                          {/* Passenger list/table inside this bus schedule */}
                          <div className="overflow-x-auto bg-white">
                            <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                <tr>
                                  <th className="px-4 py-2.5">Booking ID</th>
                                  <th className="px-4 py-2.5">Customer Profile</th>
                                  <th className="px-4 py-2.5">Passengers Details</th>
                                  <th className="px-4 py-2.5">Allocated Seats</th>
                                  <th className="px-4 py-2.5">Fare Paid</th>
                                  <th className="px-4 py-2.5">Status</th>
                                  <th className="px-4 py-2.5 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-800">
                                {bks.map((b) => (
                                  <tr key={b.id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 font-semibold">{b.id}</td>
                                    <td className="px-4 py-2.5">
                                      <div className="font-bold text-slate-900">{b.user?.name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{b.user?.email}</div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="space-y-0.5">
                                        {b.passenger_details?.map((p: any, pIdx: number) => (
                                          <div key={pIdx} className="text-[10px] text-slate-600 font-medium">
                                            • {p.name} ({p.age} yr, {p.gender})
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold font-mono text-[10px]">
                                        {b.seats.join(', ')}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 font-bold text-emerald-800 font-mono">₹{b.total_amount}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        b.booking_status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                      }`}>{b.booking_status}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right flex justify-end items-center">
                                      {b.booking_status === 'Confirmed' ? (
                                        <button
                                          onClick={() => handleCancelBookingAdmin(b.id)}
                                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition shadow-3xs animate-fade-in"
                                        >
                                          Force Cancel
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 py-1 px-2 rounded">Refunded</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DYNAMIC PRICING MULTIPLIERS */}
        {activeTab === 'pricing' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Dynamic Pricing Scales & Surge</h2>
                <p className="text-xs text-slate-500">Configure surge multipliers automatically based on peak times, occupancy rates, or weekend demand.</p>
              </div>
              <button
                onClick={() => {
                  setEditingPricing(null);
                  setPricingForm({ name: '', multiplier: 1.15, type: 'time', applies_to: '' });
                  setShowPricingModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center cursor-pointer shadow-3xs"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Surge Rule
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricingRules.map((rule) => (
                <div key={rule.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 relative bg-slate-50/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 font-extrabold px-2 py-0.5 rounded uppercase">
                        {rule.type} Rule
                      </span>
                      <h3 className="font-extrabold text-slate-900 mt-2 text-sm">{rule.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">Multiplier: {rule.multiplier}x</p>
                    </div>

                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => handleEditPricing(rule)}
                        className="p-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded text-slate-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePricing(rule.id)}
                        className="p-1.5 border border-red-200 bg-white hover:bg-red-50 rounded text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 text-xs font-semibold text-slate-700">
                    Applies to trigger conditions: <br />
                    <span className="text-slate-500 font-normal italic mt-1 block">{rule.applies_to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* -------------------------------------------------------------
          MODALS FOR ENTITY CRUD CREATIONS & EDITS
         ------------------------------------------------------------- */}
      
      {/* 1. BUS FORM MODAL */}
      {showBusModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingBus ? 'Edit Fleet Bus' : 'Register New Bus'}</h3>
              <button onClick={() => setShowBusModal(false)} className="text-white hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleBusSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Bus Name</label>
                <input
                  type="text"
                  required
                  value={busForm.bus_name}
                  onChange={(e) => setBusForm({ ...busForm, bus_name: e.target.value })}
                  placeholder="e.g. Metro Super Coach"
                  className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Bus Type</label>
                  <select
                    value={busForm.bus_type}
                    onChange={(e) => setBusForm({ ...busForm, bus_type: e.target.value as any })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  >
                    <option value="Sleeper">Sleeper</option>
                    <option value="Seater">Seater</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Capacity</label>
                  <input
                    type="number"
                    required
                    value={busForm.capacity}
                    onChange={(e) => setBusForm({ ...busForm, capacity: Number(e.target.value) })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Seat Rows</label>
                  <input
                    type="number"
                    required
                    value={busForm.rows}
                    onChange={(e) => setBusForm({ ...busForm, rows: Number(e.target.value) })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Seat Cols</label>
                  <input
                    type="number"
                    required
                    value={busForm.cols}
                    onChange={(e) => setBusForm({ ...busForm, cols: Number(e.target.value) })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Amenities (Comma separated)</label>
                <input
                  type="text"
                  value={busForm.amenities}
                  onChange={(e) => setBusForm({ ...busForm, amenities: e.target.value })}
                  className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
                  placeholder="AC, WiFi, Blanket, Water"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowBusModal(false)} className="flex-1 bg-slate-100 py-2 rounded text-xs font-bold hover:bg-slate-200">Cancel</button>
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-xs font-bold">Save Fleet Bus</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ROUTE FORM MODAL */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingRoute ? 'Edit Route Link' : 'Create Route Link'}</h3>
              <button onClick={() => setShowRouteModal(false)} className="text-white hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleRouteSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Source City</label>
                  <input
                    type="text"
                    required
                    value={routeForm.source}
                    onChange={(e) => setRouteForm({ ...routeForm, source: e.target.value })}
                    placeholder="e.g. Seattle"
                    className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Destination City</label>
                  <input
                    type="text"
                    required
                    value={routeForm.destination}
                    onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })}
                    placeholder="e.g. Portland"
                    className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Distance (km)</label>
                  <input
                    type="number"
                    required
                    value={routeForm.distance}
                    onChange={(e) => setRouteForm({ ...routeForm, distance: Number(e.target.value) })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Duration (mins)</label>
                  <input
                    type="number"
                    required
                    value={routeForm.duration}
                    onChange={(e) => setRouteForm({ ...routeForm, duration: Number(e.target.value) })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowRouteModal(false)} className="flex-1 bg-slate-100 py-2 rounded text-xs font-bold hover:bg-slate-200">Cancel</button>
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-xs font-bold">Save Route Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SCHEDULES FORM MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingSchedule ? 'Modify Schedule' : 'Create Schedule'}</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-white hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Select Bus Fleet</label>
                  <select
                    value={scheduleForm.bus_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, bus_id: e.target.value })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1"
                  >
                    {buses.map(b => (
                      <option key={b.id} value={b.id}>{b.bus_name} ({b.bus_type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Select Route Link</label>
                  <select
                    value={scheduleForm.route_id}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, route_id: e.target.value })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1"
                  >
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.source} to {r.destination}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Departure Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleForm.departure_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, departure_time: e.target.value })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Arrival Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleForm.arrival_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, arrival_time: e.target.value })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Base Fare Price (₹)</label>
                <input
                  type="number"
                  required
                  value={scheduleForm.base_fare}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, base_fare: Number(e.target.value) })}
                  className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="flex-1 bg-slate-100 py-2 rounded text-xs font-bold hover:bg-slate-200">Cancel</button>
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-xs font-bold">Save Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. PRICING SURGE FORM MODAL */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingPricing ? 'Edit Dynamic Pricing Surge' : 'Add Dynamic Pricing Surge'}</h3>
              <button onClick={() => setShowPricingModal(false)} className="text-white hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handlePricingSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Rule Name</label>
                <input
                  type="text"
                  required
                  value={pricingForm.name}
                  onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                  placeholder="e.g. Peak Weekend Rate"
                  className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={pricingForm.multiplier}
                    onChange={(e) => setPricingForm({ ...pricingForm, multiplier: Number(e.target.value) })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Surge Type</label>
                  <select
                    value={pricingForm.type}
                    onChange={(e) => setPricingForm({ ...pricingForm, type: e.target.value as any })}
                    className="mt-1 block w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  >
                    <option value="time">Time</option>
                    <option value="demand">Demand</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Applies To / Trigger</label>
                <input
                  type="text"
                  required
                  value={pricingForm.applies_to}
                  onChange={(e) => setPricingForm({ ...pricingForm, applies_to: e.target.value })}
                  placeholder="e.g. Saturdays and Sundays"
                  className="mt-1 block w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowPricingModal(false)} className="flex-1 bg-slate-100 py-2 rounded text-xs font-bold hover:bg-slate-200">Cancel</button>
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-xs font-bold">Save pricing surge</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
