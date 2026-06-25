import { 
  User, Bus, Route, Schedule, Booking, Payment, Ticket, PricingRule,
  DashboardStats, PopularRouteStat, MonthlyRevenueStat, DailyRevenueStat
} from './types';

const API_BASE = '/api';

// Set token in localStorage
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('bus_auth_token', token);
  } else {
    localStorage.removeItem('bus_auth_token');
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('bus_auth_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

export const api = {
  // Auth API
  auth: {
    login: (credentials: { email: string; password?: string; rememberMe?: boolean }) => 
      request<{ message: string; token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),
    
    register: (details: any) => 
      request<{ message: string; token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(details)
      }),
    
    me: () => request<{ user: User }>('/auth/me'),
    
    resetPassword: (email: string) => 
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
  },

  // Buses API
  buses: {
    list: () => request<Bus[]>('/buses'),
    create: (bus: Omit<Bus, 'id'>) => 
      request<Bus>('/buses', {
        method: 'POST',
        body: JSON.stringify(bus)
      }),
    update: (id: string, bus: Partial<Bus>) => 
      request<Bus>(`/buses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(bus)
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/buses/${id}`, {
        method: 'DELETE'
      })
  },

  // Routes API
  routes: {
    list: () => request<Route[]>('/routes'),
    create: (route: Omit<Route, 'id'>) => 
      request<Route>('/routes', {
        method: 'POST',
        body: JSON.stringify(route)
      }),
    update: (id: string, route: Partial<Route>) => 
      request<Route>(`/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(route)
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/routes/${id}`, {
        method: 'DELETE'
      })
  },

  // Schedules API
  schedules: {
    list: () => request<any[]>('/schedules'),
    search: (params: { source: string; destination: string; date: string; sortBy?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return request<any[]>(`/schedules/search?${query}`);
    },
    get: (id: string) => request<{
      schedule: Schedule;
      bus: Bus;
      route: Route;
      fare_details: {
        base_fare: number;
        dynamic_fare: number;
        service_charge: number;
        taxes: number;
        total_fare: number;
        pricing_rules_applied: string[];
      }
    }>(`/schedules/${id}`),
    create: (schedule: Omit<Schedule, 'id' | 'seats_status' | 'waiting_list'>) => 
      request<Schedule>('/schedules', {
        method: 'POST',
        body: JSON.stringify(schedule)
      }),
    update: (id: string, schedule: Partial<Schedule>) => 
      request<Schedule>(`/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(schedule)
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/schedules/${id}`, {
        method: 'DELETE'
      }),
    updateGPS: (id: string, coords: { latitude: number; longitude: number; speed: number; status: string }) =>
      request<any>(`/schedules/${id}/gps`, {
        method: 'POST',
        body: JSON.stringify(coords)
      })
  },

  // Bookings Workflow API
  bookings: {
    create: (details: { schedule_id: string; seats?: string[]; passenger_details?: any[]; joinWaitingList?: boolean; boarding_point?: string; dropping_point?: string }) => 
      request<{ message: string; booking?: Booking; payment?: Payment; waiting_list_position?: number }>('/bookings', {
        method: 'POST',
        body: JSON.stringify(details)
      }),
    my: async () => {
      if ((window as any).isOfflineSimulated) {
        const cached = localStorage.getItem('cached_my_bookings');
        if (cached) {
          return JSON.parse(cached);
        }
        throw new Error('Offline: No cached bookings found.');
      }
      try {
        const res = await request<any[]>('/bookings/my');
        localStorage.setItem('cached_my_bookings', JSON.stringify(res));
        return res;
      } catch (err) {
        const cached = localStorage.getItem('cached_my_bookings');
        if (cached) {
          console.warn('Network failed, serving bookings from offline cache.');
          return JSON.parse(cached);
        }
        throw err;
      }
    },
    all: () => request<any[]>('/bookings/all'),
    cancel: (id: string) => 
      request<{ message: string; refund_amount: number; waiting_list_promoted: string | null }>(`/bookings/${id}/cancel`, {
        method: 'POST'
      })
  },

  // QR Ticket Boarding API
  tickets: {
    verify: (ticketId: string) => request<{
      ticket_id: string;
      booking_id: string;
      ticket_status: string;
      passenger_name: string;
      seat: string;
      source: string;
      destination: string;
      bus_name: string;
      bus_type: string;
      departure_time: string;
      total_amount: number;
    }>(`/tickets/verify/${ticketId}`),
    board: (ticketId: string) => 
      request<{ message: string; ticket_status: string }>(`/tickets/board/${ticketId}`, {
        method: 'POST'
      })
  },

  // Pricing Rules API
  pricingRules: {
    list: () => request<PricingRule[]>('/pricing-rules'),
    create: (rule: Omit<PricingRule, 'id'>) => 
      request<PricingRule>('/pricing-rules', {
        method: 'POST',
        body: JSON.stringify(rule)
      }),
    update: (id: string, rule: Partial<PricingRule>) => 
      request<PricingRule>(`/pricing-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(rule)
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/pricing-rules/${id}`, {
        method: 'DELETE'
      })
  },

  // Admin Analytics API
  admin: {
    analytics: () => request<{
      stats: DashboardStats;
      popularRoutes: PopularRouteStat[];
      monthlyRevenue: MonthlyRevenueStat[];
      dailyRevenue: DailyRevenueStat[];
    }>('/admin/analytics')
  }
};
