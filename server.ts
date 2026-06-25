import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { loadDatabase, saveDatabase, initializeDatabase } from './src/server/db';
import {
  User, Bus, Route, Schedule, Booking, Payment, Ticket, PricingRule,
  DashboardStats, PopularRouteStat, MonthlyRevenueStat, DailyRevenueStat, BookingStatus, Passenger
} from './src/types';

// Database is initialized asynchronously on server start

const app = express();
const PORT = 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'online_bus_system_jwt_secret_9812739';

// Parse JSON request bodies
app.use(express.json());

// Logger simulation helper
function logNotification(type: 'EMAIL' | 'SMS', recipient: string, subject: string, body: string) {
  console.log(`\n=== SIMULATED ${type} SENT ===`);
  console.log(`To: ${recipient}`);
  console.log(`Subject/Header: ${subject}`);
  console.log(`Body: ${body}`);
  console.log(`=============================\n`);
}

// ------------------------------------------------------------------
// AUTH MIDDLEWARES
// ------------------------------------------------------------------
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'operator' | 'customer';
    name: string;
  };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication token is missing' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = decoded;
    next();
  });
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied: Admin role required' });
    return;
  }
  next();
}

function requireOperatorOrAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== 'operator' && req.user.role !== 'admin')) {
    res.status(403).json({ error: 'Access denied: Operator or Admin role required' });
    return;
  }
  next();
}

// ------------------------------------------------------------------
// DYNAMIC PRICING CALCULATOR UTILITY
// ------------------------------------------------------------------
function calculatePriceMultiplier(schedule: Schedule, targetBus: Bus): { multiplier: number, appliedRules: string[] } {
  const currentDb = loadDatabase();
  let multiplier = 1.0;
  const appliedRules: string[] = [];

  // 1. Weekend surge check
  const depDate = new Date(schedule.departure_time);
  const day = depDate.getDay(); // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    const rule = currentDb.pricingRules.find(r => r.id === 'pr_001');
    if (rule) {
      multiplier *= rule.multiplier;
      appliedRules.push(rule.name);
    }
  }

  // 2. High Occupancy check
  const seats = Object.values(schedule.seats_status);
  const bookedCount = seats.filter(s => s !== null).length;
  const occupancyRate = bookedCount / targetBus.capacity;
  if (occupancyRate > 0.8) {
    const rule = currentDb.pricingRules.find(r => r.id === 'pr_003');
    if (rule) {
      multiplier *= rule.multiplier;
      appliedRules.push(rule.name);
    }
  }

  return { multiplier, appliedRules };
}

// ------------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ------------------------------------------------------------------

// Register user
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, phone, password, confirmPassword } = req.body;
  const currentDb = loadDatabase();

  if (!name || !email || !phone || !password || !confirmPassword) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' });
    return;
  }

  // Check unique constraints
  const emailExists = currentDb.users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (emailExists) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }

  const phoneExists = currentDb.users.some(u => u.phone === phone);
  if (phoneExists) {
    res.status(400).json({ error: 'Phone number already registered' });
    return;
  }

  // Hash password
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: `usr_${Date.now()}`,
    name,
    email: email.toLowerCase(),
    phone,
    password_hash,
    role: 'customer',
    created_at: new Date().toISOString()
  };

  currentDb.users.push(newUser);
  saveDatabase(currentDb);

  // Sign JWT
  const tokenPayload = { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  // Simulate notification
  logNotification(
    'EMAIL',
    newUser.email,
    'Welcome to Online Bus Ticket Booking System!',
    `Hello ${newUser.name},\n\nYour account has been successfully created. You can now login and book bus tickets dynamically!`
  );

  res.status(201).json({
    message: 'Registration successful',
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone, role: newUser.role }
  });
});

// Login User
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;
  const currentDb = loadDatabase();

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = currentDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const expiresIn = rememberMe ? '30d' : '24h';
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn });

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }
  });
});

// Verify Current User
app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const currentDb = loadDatabase();
  const user = currentDb.users.find(u => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }
  });
});

// Reset Password simulation
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email } = req.body;
  const currentDb = loadDatabase();
  const user = currentDb.users.find(u => u.email.toLowerCase() === email?.toLowerCase());

  if (!user) {
    res.status(404).json({ error: 'User with this email does not exist' });
    return;
  }

  // Simulate password reset token
  const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  logNotification(
    'EMAIL',
    user.email,
    'Password Reset Requested',
    `Hello ${user.name},\n\nWe received a request to reset your password. Use the verification token: ${resetToken} to set your new password.`
  );

  res.json({ message: 'Password reset link sent successfully to your email.' });
});


// ------------------------------------------------------------------
// BUSES CRUD API
// ------------------------------------------------------------------
app.get('/api/buses', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  res.json(currentDb.buses);
});

app.post('/api/buses', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { bus_name, bus_type, capacity, amenities, rows, cols } = req.body;
  if (!bus_name || !bus_type || !capacity || !rows || !cols) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  const currentDb = loadDatabase();
  const newBus: Bus = {
    id: `bus_${Date.now()}`,
    bus_name,
    bus_type,
    capacity: Number(capacity),
    amenities: amenities || [],
    rows: Number(rows),
    cols: Number(cols)
  };

  currentDb.buses.push(newBus);
  saveDatabase(currentDb);
  res.status(201).json(newBus);
});

app.put('/api/buses/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { bus_name, bus_type, capacity, amenities, rows, cols } = req.body;
  const currentDb = loadDatabase();
  const busIndex = currentDb.buses.findIndex(b => b.id === req.params.id);

  if (busIndex === -1) {
    res.status(404).json({ error: 'Bus not found' });
    return;
  }

  currentDb.buses[busIndex] = {
    ...currentDb.buses[busIndex],
    bus_name: bus_name || currentDb.buses[busIndex].bus_name,
    bus_type: bus_type || currentDb.buses[busIndex].bus_type,
    capacity: capacity ? Number(capacity) : currentDb.buses[busIndex].capacity,
    amenities: amenities || currentDb.buses[busIndex].amenities,
    rows: rows ? Number(rows) : currentDb.buses[busIndex].rows,
    cols: cols ? Number(cols) : currentDb.buses[busIndex].cols
  };

  saveDatabase(currentDb);
  res.json(currentDb.buses[busIndex]);
});

app.delete('/api/buses/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const busIndex = currentDb.buses.findIndex(b => b.id === req.params.id);

  if (busIndex === -1) {
    res.status(404).json({ error: 'Bus not found' });
    return;
  }

  // Soft warning if actively referenced
  const scheduleReferenced = currentDb.schedules.some(s => s.bus_id === req.params.id);
  if (scheduleReferenced) {
    res.status(400).json({ error: 'Cannot delete bus: It has active routes / schedules mapped to it.' });
    return;
  }

  currentDb.buses.splice(busIndex, 1);
  saveDatabase(currentDb);
  res.json({ message: 'Bus deleted successfully' });
});


// ------------------------------------------------------------------
// ROUTES CRUD API
// ------------------------------------------------------------------
app.get('/api/routes', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  res.json(currentDb.routes);
});

app.post('/api/routes', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { source, destination, distance, duration } = req.body;
  if (!source || !destination || !distance || !duration) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  const currentDb = loadDatabase();
  const newRoute: Route = {
    id: `route_${Date.now()}`,
    source,
    destination,
    distance: Number(distance),
    duration: Number(duration)
  };

  currentDb.routes.push(newRoute);
  saveDatabase(currentDb);
  res.status(201).json(newRoute);
});

app.put('/api/routes/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { source, destination, distance, duration } = req.body;
  const currentDb = loadDatabase();
  const routeIdx = currentDb.routes.findIndex(r => r.id === req.params.id);

  if (routeIdx === -1) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }

  currentDb.routes[routeIdx] = {
    ...currentDb.routes[routeIdx],
    source: source || currentDb.routes[routeIdx].source,
    destination: destination || currentDb.routes[routeIdx].destination,
    distance: distance ? Number(distance) : currentDb.routes[routeIdx].distance,
    duration: duration ? Number(duration) : currentDb.routes[routeIdx].duration
  };

  saveDatabase(currentDb);
  res.json(currentDb.routes[routeIdx]);
});

app.delete('/api/routes/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const routeIdx = currentDb.routes.findIndex(r => r.id === req.params.id);

  if (routeIdx === -1) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }

  const scheduleReferenced = currentDb.schedules.some(s => s.route_id === req.params.id);
  if (scheduleReferenced) {
    res.status(400).json({ error: 'Cannot delete route: It has active schedules.' });
    return;
  }

  currentDb.routes.splice(routeIdx, 1);
  saveDatabase(currentDb);
  res.json({ message: 'Route deleted successfully' });
});


// ------------------------------------------------------------------
// SCHEDULES & BUS SEARCH API
// ------------------------------------------------------------------

// Search buses schedules
app.get('/api/schedules/search', (req: Request, res: Response) => {
  const { source, destination, date, sortBy } = req.query;
  const currentDb = loadDatabase();

  if (!source || !destination || !date) {
    res.status(400).json({ error: 'Source, destination, and travel date are required.' });
    return;
  }

  // Filter routes first
  const matchingRoutes = currentDb.routes.filter(
    r => r.source.toLowerCase() === (source as string).toLowerCase() &&
      r.destination.toLowerCase() === (destination as string).toLowerCase()
  );

  if (matchingRoutes.length === 0) {
    res.json([]);
    return;
  }

  const routeIds = matchingRoutes.map(r => r.id);

  // Find schedules on that day (matches YYYY-MM-DD)
  const queryDate = date as string; // YYYY-MM-DD
  const filteredSchedules = currentDb.schedules.filter(s => {
    return routeIds.includes(s.route_id) && s.departure_time.startsWith(queryDate);
  });

  // Hydrate with Bus and Route info
  const results = filteredSchedules.map(schedule => {
    const bus = currentDb.buses.find(b => b.id === schedule.bus_id)!;
    const route = matchingRoutes.find(r => r.id === schedule.route_id)!;

    // Calculate available seats count
    const totalSeats = Object.keys(schedule.seats_status).length;
    const reservedSeats = Object.values(schedule.seats_status).filter(s => s !== null).length;
    const availableSeats = totalSeats - reservedSeats;

    // Pricing multiplier calculation
    const pricing = calculatePriceMultiplier(schedule, bus);
    const dynamicPrice = Math.round(schedule.base_fare * pricing.multiplier);

    return {
      schedule_id: schedule.id,
      bus_name: bus.bus_name,
      bus_type: bus.bus_type,
      amenities: bus.amenities,
      source: route.source,
      destination: route.destination,
      departure_time: schedule.departure_time,
      arrival_time: schedule.arrival_time,
      duration: route.duration,
      available_seats: availableSeats,
      total_seats: totalSeats,
      base_fare: schedule.base_fare,
      fare: dynamicPrice,
      pricing_rules_applied: pricing.appliedRules,
      is_full: availableSeats <= 0,
      waiting_list_count: schedule.waiting_list.length
    };
  });

  // Sorting
  if (sortBy === 'lowest_price') {
    results.sort((a, b) => a.fare - b.fare);
  } else if (sortBy === 'earliest_departure') {
    results.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
  } else if (sortBy === 'fastest_route') {
    results.sort((a, b) => a.duration - b.duration);
  }

  res.json(results);
});

// Admin list schedules
app.get('/api/schedules', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  // Hydrate
  const hydrated = currentDb.schedules.map(s => {
    const bus = currentDb.buses.find(b => b.id === s.bus_id);
    const route = currentDb.routes.find(r => r.id === s.route_id);
    return {
      ...s,
      bus,
      route,
      available_seats: Object.values(s.seats_status).filter(x => x === null).length,
      total_seats: Object.keys(s.seats_status).length
    };
  });
  res.json(hydrated);
});

// Get schedule details including seat occupancy map and specific fare
app.get('/api/schedules/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const schedule = currentDb.schedules.find(s => s.id === req.params.id);

  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  const bus = currentDb.buses.find(b => b.id === schedule.bus_id)!;
  const route = currentDb.routes.find(r => r.id === schedule.route_id)!;

  // Calculate dynamic fare
  const pricing = calculatePriceMultiplier(schedule, bus);
  const dynamicPrice = Math.round(schedule.base_fare * pricing.multiplier);

  res.json({
    schedule,
    bus,
    route,
    fare_details: {
      base_fare: schedule.base_fare,
      dynamic_fare: dynamicPrice,
      service_charge: 5,
      taxes: Math.round(dynamicPrice * 0.08), // 8% Tax
      total_fare: dynamicPrice + 5 + Math.round(dynamicPrice * 0.08),
      pricing_rules_applied: pricing.appliedRules
    }
  });
});

// Create schedule
app.post('/api/schedules', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { bus_id, route_id, departure_time, arrival_time, base_fare } = req.body;
  if (!bus_id || !route_id || !departure_time || !arrival_time || !base_fare) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  const currentDb = loadDatabase();
  const bus = currentDb.buses.find(b => b.id === bus_id);
  const route = currentDb.routes.find(r => r.id === route_id);

  if (!bus) {
    res.status(400).json({ error: 'Invalid Bus ID' });
    return;
  }
  if (!route) {
    res.status(400).json({ error: 'Invalid Route ID' });
    return;
  }

  // Generate dynamic seat map labels
  const seats_status: Record<string, string | null> = {};
  const rows = bus.rows;
  const cols = bus.cols;
  const colLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, cols);

  let count = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (count < bus.capacity) {
        const seatLabel = `${colLabels[c]}${r}`;
        seats_status[seatLabel] = null;
        count++;
      }
    }
  }

  const newSchedule: Schedule = {
    id: `sched_${Date.now()}`,
    bus_id,
    route_id,
    departure_time,
    arrival_time,
    base_fare: Number(base_fare),
    seats_status,
    waiting_list: []
  };

  currentDb.schedules.push(newSchedule);
  saveDatabase(currentDb);
  res.status(201).json(newSchedule);
});

// Update schedule
app.put('/api/schedules/:id', authenticateToken, requireOperatorOrAdmin, (req: AuthRequest, res: Response) => {
  const { departure_time, arrival_time, base_fare } = req.body;
  const currentDb = loadDatabase();
  const index = currentDb.schedules.findIndex(s => s.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  currentDb.schedules[index] = {
    ...currentDb.schedules[index],
    departure_time: departure_time || currentDb.schedules[index].departure_time,
    arrival_time: arrival_time || currentDb.schedules[index].arrival_time,
    base_fare: base_fare ? Number(base_fare) : currentDb.schedules[index].base_fare
  };

  saveDatabase(currentDb);
  res.json(currentDb.schedules[index]);
});

// Delete schedule
app.delete('/api/schedules/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const index = currentDb.schedules.findIndex(s => s.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  // Warning if bookings are made
  const hasBookings = currentDb.bookings.some(b => b.schedule_id === req.params.id && b.booking_status !== 'Cancelled');
  if (hasBookings) {
    res.status(400).json({ error: 'Cannot delete schedule: Active bookings already exist.' });
    return;
  }

  currentDb.schedules.splice(index, 1);
  saveDatabase(currentDb);
  res.json({ message: 'Schedule deleted successfully' });
});

// Update schedule GPS coordinates (Operators and Admins)
app.post('/api/schedules/:id/gps', authenticateToken, requireOperatorOrAdmin, (req: AuthRequest, res: Response) => {
  const { latitude, longitude, speed, status } = req.body;
  const scheduleId = req.params.id;

  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'Latitude and longitude are required.' });
    return;
  }

  const currentDb = loadDatabase();
  const scheduleIdx = currentDb.schedules.findIndex(s => s.id === scheduleId);
  if (scheduleIdx === -1) {
    res.status(404).json({ error: 'Schedule not found.' });
    return;
  }

  const schedule = currentDb.schedules[scheduleIdx];
  schedule.gps_latitude = Number(latitude);
  schedule.gps_longitude = Number(longitude);
  schedule.gps_speed = speed !== undefined ? Number(speed) : schedule.gps_speed;
  schedule.gps_status = status || schedule.gps_status || 'En Route';
  schedule.gps_last_updated = new Date().toISOString();

  saveDatabase(currentDb);
  res.json({ message: 'GPS coordinates updated successfully.', schedule });
});


// ------------------------------------------------------------------
// BOOKINGS WORKFLOW API
// ------------------------------------------------------------------

// Create booking / Join waiting list
app.post('/api/bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { schedule_id, seats, passenger_details, joinWaitingList, boarding_point, dropping_point } = req.body;
  const userId = req.user!.id;

  if (!schedule_id) {
    res.status(400).json({ error: 'Schedule ID is required.' });
    return;
  }

  const currentDb = loadDatabase();
  const scheduleIdx = currentDb.schedules.findIndex(s => s.id === schedule_id);
  if (scheduleIdx === -1) {
    res.status(404).json({ error: 'Schedule not found.' });
    return;
  }

  const schedule = currentDb.schedules[scheduleIdx];
  const bus = currentDb.buses.find(b => b.id === schedule.bus_id)!;
  const route = currentDb.routes.find(r => r.id === schedule.route_id)!;

  // Calculate dynamic pricing
  const pricing = calculatePriceMultiplier(schedule, bus);
  const dynamicPrice = Math.round(schedule.base_fare * pricing.multiplier);
  const serviceCharge = 5;
  const taxes = Math.round(dynamicPrice * 0.08);

  // If user is joining Waiting List
  if (joinWaitingList) {
    // Add to waiting list
    if (schedule.waiting_list.includes(userId)) {
      res.status(400).json({ error: 'You are already in the waiting list for this schedule.' });
      return;
    }

    schedule.waiting_list.push(userId);
    saveDatabase(currentDb);

    logNotification(
      'EMAIL',
      req.user!.email,
      'Waiting List Confirmation',
      `Hello ${req.user!.name},\n\nYou have successfully joined the waiting list for Bus: ${bus.bus_name} (Route: ${route.source} to ${route.destination}).\nYour position is #${schedule.waiting_list.length}. We will notify you if a seat becomes available.`
    );

    res.json({
      message: 'Joined waiting list successfully',
      waiting_list_position: schedule.waiting_list.length,
      schedule_id: schedule.id
    });
    return;
  }

  // Standard Booking
  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    res.status(400).json({ error: 'Seats selection is required.' });
    return;
  }

  if (!passenger_details || !Array.isArray(passenger_details) || passenger_details.length !== seats.length) {
    res.status(400).json({ error: 'Please enter passenger details matching all selected seats.' });
    return;
  }

  // 1. Detect seat conflicts / double booking
  const conflictedSeats = seats.filter(seat => schedule.seats_status[seat] !== null);
  if (conflictedSeats.length > 0) {
    res.status(400).json({ error: `The following seats are already reserved: ${conflictedSeats.join(', ')}. Please select other seats.` });
    return;
  }

  // 2. Reserve seats in DB
  seats.forEach(seat => {
    schedule.seats_status[seat] = userId;
  });

  const totalFare = (dynamicPrice + serviceCharge + taxes) * seats.length;
  const bookingId = `bk_${Date.now()}`;

  // Create Booking
  const newBooking: Booking = {
    id: bookingId,
    user_id: userId,
    schedule_id: schedule.id,
    booking_status: 'Confirmed',
    total_amount: totalFare,
    seats,
    passenger_details: passenger_details as Passenger[],
    created_at: new Date().toISOString(),
    boarding_point,
    dropping_point
  };

  currentDb.bookings.push(newBooking);

  // Create Payment
  const paymentId = `pay_${Date.now()}`;
  const newPayment: Payment = {
    id: paymentId,
    booking_id: bookingId,
    amount: totalFare,
    payment_status: 'Paid',
    transaction_reference: `TXN_${Math.floor(100000000 + Math.random() * 900000000)}`,
    created_at: new Date().toISOString()
  };
  currentDb.payments.push(newPayment);

  // Generate Tickets & simulate unique QR code data URLs using our parameters
  seats.forEach((seat, idx) => {
    const ticketId = `tkt_${Date.now()}_${idx}`;
    // Simulating QR Code content
    const qrDataStr = JSON.stringify({
      ticketId,
      bookingId,
      passenger: passenger_details[idx].name,
      seat,
      route: `${route.source} -> ${route.destination}`,
      departure: schedule.departure_time,
      boarding_point,
      dropping_point
    });

    // Quick encoded token to render standard canvas QR or URL
    const mockQrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataStr)}`;

    const newTicket: Ticket = {
      id: ticketId,
      booking_id: bookingId,
      qr_code: mockQrDataUrl,
      ticket_status: 'Confirmed'
    };
    currentDb.tickets.push(newTicket);
  });

  saveDatabase(currentDb);

  // Send Ticket Emails/SMS
  logNotification(
    'EMAIL',
    req.user!.email,
    'Booking Confirmation - Online Bus System',
    `Hello ${req.user!.name},\n\nYour booking #${bookingId} is CONFIRMED!\n\nBus: ${bus.bus_name}\nRoute: ${route.source} to ${route.destination}\nBoarding Point: ${boarding_point || 'N/A'}\nDropping Point: ${dropping_point || 'N/A'}\nDeparture: ${new Date(schedule.departure_time).toLocaleString()}\nSeats: ${seats.join(', ')}\nTotal Amount: $${totalFare}\n\nAttached are your QR tickets for quick boarding!`
  );

  res.status(201).json({
    message: 'Booking completed successfully!',
    booking: newBooking,
    payment: newPayment
  });
});

// Fetch user booking history
app.get('/api/bookings/my', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const myBookings = currentDb.bookings.filter(b => b.user_id === req.user!.id);

  // Hydrate with schedule, route, bus, tickets, payments
  const hydrated = myBookings.map(b => {
    const schedule = currentDb.schedules.find(s => s.id === b.schedule_id);
    const bus = schedule ? currentDb.buses.find(bus => bus.id === schedule.bus_id) : undefined;
    const route = schedule ? currentDb.routes.find(r => r.id === schedule.route_id) : undefined;
    const tickets = currentDb.tickets.filter(t => t.booking_id === b.id);
    const payment = currentDb.payments.find(p => p.booking_id === b.id);

    return {
      ...b,
      schedule,
      bus,
      route,
      tickets,
      payment
    };
  });

  // Sort: upcoming first
  hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(hydrated);
});

// List all bookings (Admins and Operators)
app.get('/api/bookings/all', authenticateToken, requireOperatorOrAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const hydrated = currentDb.bookings.map(b => {
    const schedule = currentDb.schedules.find(s => s.id === b.schedule_id);
    const bus = schedule ? currentDb.buses.find(bus => bus.id === schedule.bus_id) : undefined;
    const route = schedule ? currentDb.routes.find(r => r.id === schedule.route_id) : undefined;
    const user = currentDb.users.find(u => u.id === b.user_id);
    const payment = currentDb.payments.find(p => p.booking_id === b.id);
    const tickets = currentDb.tickets.filter(t => t.booking_id === b.id);

    return {
      ...b,
      schedule,
      bus,
      route,
      user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : { name: 'Anonymous' },
      payment,
      tickets
    };
  });

  hydrated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(hydrated);
});

// Cancel booking (with waiting list auto promotion!)
app.post('/api/bookings/:id/cancel', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const bookingIdx = currentDb.bookings.findIndex(b => b.id === req.params.id);

  if (bookingIdx === -1) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const booking = currentDb.bookings[bookingIdx];

  // Restrict so only the owner of the booking OR an admin can cancel it
  if (req.user!.role !== 'admin' && booking.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Unauthorized cancellation request' });
    return;
  }

  if (booking.booking_status === 'Cancelled') {
    res.status(400).json({ error: 'Booking is already cancelled.' });
    return;
  }

  const schedule = currentDb.schedules.find(s => s.id === booking.schedule_id);
  const bus = schedule ? currentDb.buses.find(b => b.id === schedule.bus_id) : undefined;
  const route = schedule ? currentDb.routes.find(r => r.id === schedule.route_id) : undefined;

  // 1. Cancel booking and associated tickets & payments
  booking.booking_status = 'Cancelled';

  // Release seat blocks
  if (schedule) {
    booking.seats.forEach(seat => {
      schedule.seats_status[seat] = null;
    });
  }

  // Refund Payment
  const payment = currentDb.payments.find(p => p.booking_id === booking.id);
  if (payment) {
    payment.payment_status = 'Refunded';
  }

  // Update Ticket Status
  const tickets = currentDb.tickets.filter(t => t.booking_id === booking.id);
  tickets.forEach(t => {
    t.ticket_status = 'Cancelled';
  });

  // Calculate cancellation refund (90% refund policy)
  const refundAmount = Math.round(booking.total_amount * 0.9);

  // 2. WAITING LIST AUTOMATIC PROMOTION!
  // If there is anyone on the waiting list, promote them to fill this newly available slot!
  let promotedUser: User | undefined;
  if (schedule && schedule.waiting_list.length > 0) {
    const nextUserId = schedule.waiting_list.shift(); // Remove first customer from waiting list
    promotedUser = currentDb.users.find(u => u.id === nextUserId);

    if (promotedUser) {
      // Allocate the freed seats automatically to the promoted user!
      // We automatically select the same seats that were just freed, up to what is available
      const seatsToAutoAssign = booking.seats.slice(0, 1); // Auto promote 1 seat for simplicity

      seatsToAutoAssign.forEach(seat => {
        schedule.seats_status[seat] = promotedUser!.id;
      });

      const pricing = bus ? calculatePriceMultiplier(schedule, bus) : { multiplier: 1, appliedRules: [] };
      const dynamicPrice = Math.round(schedule.base_fare * pricing.multiplier);
      const totalFare = dynamicPrice + 5 + Math.round(dynamicPrice * 0.08); // Single seat total

      const newPromotedBookingId = `bk_promo_${Date.now()}`;
      const promotedBooking: Booking = {
        id: newPromotedBookingId,
        user_id: promotedUser.id,
        schedule_id: schedule.id,
        booking_status: 'Confirmed',
        total_amount: totalFare,
        seats: seatsToAutoAssign,
        passenger_details: [
          { name: promotedUser.name, age: 30, gender: 'Other', seat_number: seatsToAutoAssign[0] }
        ],
        created_at: new Date().toISOString()
      };

      currentDb.bookings.push(promotedBooking);

      currentDb.payments.push({
        id: `pay_promo_${Date.now()}`,
        booking_id: newPromotedBookingId,
        amount: totalFare,
        payment_status: 'Paid',
        transaction_reference: `TXN_WL_${Math.floor(100000000 + Math.random() * 900000000)}`,
        created_at: new Date().toISOString()
      });

      // Generate Ticket with QR
      const routeStr = route ? `${route.source} -> ${route.destination}` : 'Unknown Route';
      const qrDataStr = JSON.stringify({
        ticketId: `tkt_promo_${Date.now()}`,
        bookingId: newPromotedBookingId,
        passenger: promotedUser.name,
        seat: seatsToAutoAssign[0],
        route: routeStr,
        departure: schedule.departure_time
      });
      const mockQrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataStr)}`;

      currentDb.tickets.push({
        id: `tkt_wl_${Date.now()}`,
        booking_id: newPromotedBookingId,
        qr_code: mockQrDataUrl,
        ticket_status: 'Confirmed'
      });

      // Send email notifications to the promoted passenger!
      logNotification(
        'EMAIL',
        promotedUser.email,
        'WAITING LIST PROMOTION: Ticket Confirmed!',
        `Hello ${promotedUser.name},\n\nGreat news! A seat became available on Bus: ${bus ? bus.bus_name : 'Your Bus'} (${routeStr}).\n\nYou have been automatically promoted from the waiting list. Your booking reference is ${newPromotedBookingId} for Seat ${seatsToAutoAssign.join(', ')}.\nEnjoy your trip!`
      );
    }
  }

  saveDatabase(currentDb);

  // Send cancellation email to original user
  const user = currentDb.users.find(u => u.id === booking.user_id)!;
  if (user) {
    logNotification(
      'EMAIL',
      user.email,
      'Booking Cancellation Confirmation',
      `Hello ${user.name},\n\nYour booking #${booking.id} has been cancelled successfully.\n\nA refund of $${refundAmount} has been initiated back to your original payment method.\nTransaction Reference: RFD_${Date.now()}`
    );
  }

  res.json({
    message: 'Booking cancelled successfully. Refund initiated.',
    refund_amount: refundAmount,
    waiting_list_promoted: promotedUser ? promotedUser.name : null
  });
});


// ------------------------------------------------------------------
// OPERATOR QR TICKETING API
// ------------------------------------------------------------------

// Verify QR ticket details
app.get('/api/tickets/verify/:ticketId', authenticateToken, requireOperatorOrAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const ticket = currentDb.tickets.find(t => t.id === req.params.ticketId);

  if (!ticket) {
    res.status(404).json({ error: 'Invalid QR ticket or reference.' });
    return;
  }

  const booking = currentDb.bookings.find(b => b.id === ticket.booking_id);
  if (!booking) {
    res.status(404).json({ error: 'Associated booking not found.' });
    return;
  }
  const schedule = currentDb.schedules.find(s => s.id === booking.schedule_id);
  const route = schedule ? currentDb.routes.find(r => r.id === schedule.route_id) : undefined;
  const bus = schedule ? currentDb.buses.find(b => b.id === schedule.bus_id) : undefined;
  const passenger = booking.passenger_details[0]; // Fetch main passenger details for boarding match

  res.json({
    ticket_id: ticket.id,
    booking_id: booking.id,
    ticket_status: ticket.ticket_status,
    passenger_name: passenger ? passenger.name : 'Unknown Passenger',
    seat: booking.seats.join(', '),
    source: route ? route.source : 'Unknown',
    destination: route ? route.destination : 'Unknown',
    bus_name: bus ? bus.bus_name : 'Unknown Bus',
    bus_type: bus ? bus.bus_type : 'Unknown Type',
    departure_time: schedule ? schedule.departure_time : 'Unknown Time',
    total_amount: booking.total_amount
  });
});

// Confirm boarding / Mark boarded
app.post('/api/tickets/board/:ticketId', authenticateToken, requireOperatorOrAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const ticketIdx = currentDb.tickets.findIndex(t => t.id === req.params.ticketId);

  if (ticketIdx === -1) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const ticket = currentDb.tickets[ticketIdx];
  if (ticket.ticket_status === 'Boarded') {
    res.status(400).json({ error: 'Passenger is already boarded.' });
    return;
  }
  if (ticket.ticket_status === 'Cancelled') {
    res.status(400).json({ error: 'This ticket was cancelled. Boarding rejected.' });
    return;
  }

  ticket.ticket_status = 'Boarded';
  saveDatabase(currentDb);

  const booking = currentDb.bookings.find(b => b.id === ticket.booking_id);
  const user = booking ? currentDb.users.find(u => u.id === booking.user_id) : undefined;
  if (user) {
    logNotification(
      'SMS',
      user.phone,
      'Boarding Confirmation',
      `Dear ${user.name}, you have successfully boarded your bus. Enjoy your trip!`
    );
  }

  res.json({
    message: 'Passenger checked in and marked as boarded successfully.',
    ticket_status: 'Boarded'
  });
});


// ------------------------------------------------------------------
// PRICING RULES CRUD API (Admin)
// ------------------------------------------------------------------
app.get('/api/pricing-rules', authenticateToken, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  res.json(currentDb.pricingRules);
});

app.post('/api/pricing-rules', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { name, multiplier, type, applies_to } = req.body;
  if (!name || !multiplier || !type || !applies_to) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }

  const currentDb = loadDatabase();
  const newRule: PricingRule = {
    id: `pr_${Date.now()}`,
    name,
    multiplier: Number(multiplier),
    type,
    applies_to
  };

  currentDb.pricingRules.push(newRule);
  saveDatabase(currentDb);
  res.status(201).json(newRule);
});

app.put('/api/pricing-rules/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { name, multiplier, type, applies_to } = req.body;
  const currentDb = loadDatabase();
  const index = currentDb.pricingRules.findIndex(r => r.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Pricing rule not found' });
    return;
  }

  currentDb.pricingRules[index] = {
    ...currentDb.pricingRules[index],
    name: name || currentDb.pricingRules[index].name,
    multiplier: multiplier ? Number(multiplier) : currentDb.pricingRules[index].multiplier,
    type: type || currentDb.pricingRules[index].type,
    applies_to: applies_to || currentDb.pricingRules[index].applies_to
  };

  saveDatabase(currentDb);
  res.json(currentDb.pricingRules[index]);
});

app.delete('/api/pricing-rules/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();
  const index = currentDb.pricingRules.findIndex(r => r.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: 'Pricing rule not found' });
    return;
  }

  currentDb.pricingRules.splice(index, 1);
  saveDatabase(currentDb);
  res.json({ message: 'Pricing rule deleted successfully' });
});


// ------------------------------------------------------------------
// ADMIN DASHBOARD & ANALYTICS API (Admin)
// ------------------------------------------------------------------
app.get('/api/admin/analytics', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const currentDb = loadDatabase();

  const totalBookings = currentDb.bookings.filter(b => b.booking_status !== 'Cancelled').length;
  const activeRoutes = currentDb.routes.length;

  // Calculate total paid revenue
  const revenue = currentDb.payments
    .filter(p => p.payment_status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  // Average occupancy rate calculation across all schedules
  let totalCapacity = 0;
  let occupiedSeats = 0;
  currentDb.schedules.forEach(schedule => {
    const bus = currentDb.buses.find(b => b.id === schedule.bus_id);
    if (bus) {
      totalCapacity += bus.capacity;
      const occupied = Object.values(schedule.seats_status).filter(x => x !== null).length;
      occupiedSeats += occupied;
    }
  });
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedSeats / totalCapacity) * 100) : 0;

  // Bus Utilization (percentage of buses that have scheduled trips)
  const activeBusIds = new Set(currentDb.schedules.map(s => s.bus_id));
  const busUtilization = currentDb.buses.length > 0 ? Math.round((activeBusIds.size / currentDb.buses.length) * 100) : 0;

  // Monthly revenue analytics (grouped by month of booking creation)
  const monthlyMap: Record<string, { revenue: number; bookings: number }> = {};
  currentDb.bookings.forEach(b => {
    if (b.booking_status === 'Cancelled') return;
    const date = new Date(b.created_at);
    const month = date.toLocaleString('default', { month: 'short' });
    if (!monthlyMap[month]) {
      monthlyMap[month] = { revenue: 0, bookings: 0 };
    }
    monthlyMap[month].revenue += b.total_amount;
    monthlyMap[month].bookings += 1;
  });

  const monthlyRevenue: MonthlyRevenueStat[] = Object.keys(monthlyMap).map(month => ({
    month,
    revenue: monthlyMap[month].revenue,
    bookings: monthlyMap[month].bookings
  }));

  // Daily revenue analytics (past 7 days)
  const dailyMap: Record<string, { revenue: number; bookings: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    dailyMap[dateStr] = { revenue: 0, bookings: 0 };
  }

  currentDb.bookings.forEach(b => {
    if (b.booking_status === 'Cancelled') return;
    const d = new Date(b.created_at);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (dailyMap[dateStr] !== undefined) {
      dailyMap[dateStr].revenue += b.total_amount;
      dailyMap[dateStr].bookings += 1;
    }
  });

  const dailyRevenue: DailyRevenueStat[] = Object.keys(dailyMap).map(date => ({
    date,
    revenue: dailyMap[date].revenue,
    bookings: dailyMap[date].bookings
  }));

  // Popular Routes Stat
  const routeMap: Record<string, { count: number; rev: number; src: string; dest: string }> = {};
  currentDb.bookings.forEach(b => {
    if (b.booking_status === 'Cancelled') return;
    const schedule = currentDb.schedules.find(s => s.id === b.schedule_id);
    if (schedule) {
      const route = currentDb.routes.find(r => r.id === schedule.route_id);
      if (route) {
        if (!routeMap[route.id]) {
          routeMap[route.id] = { count: 0, rev: 0, src: route.source, dest: route.destination };
        }
        routeMap[route.id].count += 1;
        routeMap[route.id].rev += b.total_amount;
      }
    }
  });

  const popularRoutes: PopularRouteStat[] = Object.keys(routeMap).map(routeId => ({
    routeId,
    source: routeMap[routeId].src,
    destination: routeMap[routeId].dest,
    bookingCount: routeMap[routeId].count,
    revenue: routeMap[routeId].rev
  })).sort((a, b) => b.bookingCount - a.bookingCount);

  res.json({
    stats: {
      totalBookings,
      activeRoutes,
      revenue,
      occupancyRate,
      busUtilization
    },
    popularRoutes,
    monthlyRevenue,
    dailyRevenue
  });
});


// ------------------------------------------------------------------
// VITE DEV SERVER AND PRODUCTION SERVING LAYER
// ------------------------------------------------------------------
async function startServer() {
  await initializeDatabase();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA routing fallback
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Bus Ticket Engine] Running on http://localhost:${PORT}`);
  });
}

startServer();
