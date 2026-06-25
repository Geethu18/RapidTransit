/**
 * Shared Type Definitions for Online Bus Ticket Booking System
 */

export type UserRole = 'admin' | 'operator' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash?: string; // Hidden in API responses
  role: UserRole;
  created_at: string;
}

export type BusType = 'Sleeper' | 'Seater' | 'Luxury';

export interface Bus {
  id: string;
  bus_name: string;
  bus_type: BusType;
  capacity: number;
  amenities: string[];
  rows: number;
  cols: number; // e.g. 4 for a 2+2 layout, 3 for 1+2
}

export interface Route {
  id: string;
  source: string;
  destination: string;
  distance: number; // in km
  duration: number; // in minutes
  boarding_points?: string[]; // e.g. ["Station Gate 1", "Main Bus Stop"]
  dropping_points?: string[]; // e.g. ["Depot A", "Terminal Bypass"]
}

export interface Schedule {
  id: string;
  bus_id: string;
  route_id: string;
  departure_time: string; // ISO string or format
  arrival_time: string; // ISO string
  base_fare: number;
  seats_status: Record<string, string | null>; // Maps Seat Label (e.g., "A1") -> User ID (or null if available)
  waiting_list: string[]; // List of User IDs in waiting list order
  gps_latitude?: number;
  gps_longitude?: number;
  gps_speed?: number; // in km/h
  gps_status?: string; // 'Scheduled' | 'En Route' | 'Delayed' | 'Completed'
  gps_last_updated?: string;
}

export type BookingStatus = 'Confirmed' | 'Cancelled' | 'Completed' | 'Pending';

export interface Passenger {
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  seat_number: string;
}

export interface Booking {
  id: string;
  user_id: string;
  schedule_id: string;
  booking_status: BookingStatus;
  total_amount: number;
  seats: string[];
  passenger_details: Passenger[];
  created_at: string;
  boarding_point?: string;
  dropping_point?: string;
}

export type PaymentStatus = 'Paid' | 'Refunded' | 'Failed';

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  payment_status: PaymentStatus;
  transaction_reference: string;
  created_at: string;
}

export type TicketStatus = 'Confirmed' | 'Cancelled' | 'Boarded';

export interface Ticket {
  id: string;
  booking_id: string;
  qr_code: string; // Base64 data URL
  ticket_status: TicketStatus;
}

// Analytical Metrics interfaces
export interface DashboardStats {
  totalBookings: number;
  activeRoutes: number;
  revenue: number;
  occupancyRate: number;
  busUtilization: number;
}

export interface PopularRouteStat {
  routeId: string;
  source: string;
  destination: string;
  bookingCount: number;
  revenue: number;
}

export interface MonthlyRevenueStat {
  month: string;
  revenue: number;
  bookings: number;
}

export interface DailyRevenueStat {
  date: string;
  revenue: number;
  bookings: number;
}

// Pricing rules configured by Admin
export interface PricingRule {
  id: string;
  name: string;
  multiplier: number; // e.g., 1.2 for 20% increase
  type: 'demand' | 'holiday' | 'time'; // dynamic pricing type
  applies_to: string; // e.g., "Weekend", "Sleeper", "Remaining seats < 20%"
}
