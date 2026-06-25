import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Bus, Route, Schedule, Booking, Payment, Ticket, PricingRule
} from '../types';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Auto-clean Supabase URL if the REST endpoint /rest/v1/ was pasted
let supabaseUrl = process.env.SUPABASE_URL || '';
if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.slice(0, -9);
} else if (supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.slice(0, -8);
}
const supabaseKey = process.env.SUPABASE_KEY || '';

const useSupabase = !!(supabaseUrl && supabaseKey);

export interface DatabaseSchema {
  users: User[];
  buses: Bus[];
  routes: Route[];
  schedules: Schedule[];
  bookings: Booking[];
  payments: Payment[];
  tickets: Ticket[];
  pricingRules: PricingRule[];
}

let dbCache: DatabaseSchema | null = null;
let isInitializing = false;

// Initialize Supabase Client if env is set
const supabase = useSupabase 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------
// SEEDING AND UTILITY FUNCTIONS
// ---------------------------------------------------------------------
function createSeededDatabase(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);
  const operatorPasswordHash = bcrypt.hashSync('operator123', salt);
  const customerPasswordHash = bcrypt.hashSync('customer123', salt);

  const users: User[] = [
    {
      id: 'usr_admin',
      name: 'System Admin',
      email: 'admin@bus.com',
      phone: '123-456-7890',
      password_hash: adminPasswordHash,
      role: 'admin',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_operator',
      name: 'Bus Conductor / Operator',
      email: 'operator@bus.com',
      phone: '234-567-8901',
      password_hash: operatorPasswordHash,
      role: 'operator',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_customer',
      name: 'Ramesh Kumar',
      email: 'customer@bus.com',
      phone: '9876543210',
      password_hash: customerPasswordHash,
      role: 'customer',
      created_at: new Date().toISOString()
    }
  ];

  const buses: Bus[] = [
    {
      id: 'bus_001',
      bus_name: 'Zingbus Premium AC',
      bus_type: 'Luxury',
      capacity: 32,
      amenities: ['AC', 'WiFi', 'Charging Port', 'Water Bottle', 'Premium Audio'],
      rows: 8,
      cols: 4
    },
    {
      id: 'bus_002',
      bus_name: 'KPN Sleepers (Multi-Axle)',
      bus_type: 'Sleeper',
      capacity: 20,
      amenities: ['AC', 'WiFi', 'Charging Port', 'Blanket', 'Water Bottle', 'Sleeper Pod'],
      rows: 5,
      cols: 4
    },
    {
      id: 'bus_003',
      bus_name: 'VRL Travels Seater',
      bus_type: 'Seater',
      capacity: 40,
      amenities: ['AC', 'Charging Port'],
      rows: 10,
      cols: 4
    }
  ];

  const routes: Route[] = [
    {
      id: 'route_001',
      source: 'Mumbai',
      destination: 'Pune',
      distance: 150,
      duration: 180,
      boarding_points: ['Borivali East (National Park)', 'Andheri WEH (Bisleri)', 'Sion Circle (Highway)', 'Vashi Plaza (Below Flyover)'],
      dropping_points: ['Wakad (Ginger Hotel)', 'Chinchwad (Elpro Mall)', 'Swargate (Kothari Travels)', 'Pune Station (Stands)']
    },
    {
      id: 'route_002',
      source: 'Pune',
      destination: 'Mumbai',
      distance: 150,
      duration: 180,
      boarding_points: ['Pune Station (Stands)', 'Swargate (Kothari Travels)', 'Chinchwad (Elpro Mall)', 'Wakad (Ginger Hotel)'],
      dropping_points: ['Vashi Plaza (Below Flyover)', 'Sion Circle (Highway)', 'Andheri WEH (Bisleri)', 'Borivali East (National Park)']
    },
    {
      id: 'route_003',
      source: 'Bangalore',
      destination: 'Chennai',
      distance: 350,
      duration: 360,
      boarding_points: ['Majestic (KSR TC)', 'Indiranagar (Metro Stn)', 'Silk Board (Flyover Start)', 'Electronic City (Phase 1)'],
      dropping_points: ['Poonamallee (Bypass)', 'Koyambedu (Omni Bus Stand)', 'Guindy (Metro Station)', 'T. Nagar (Habibullah Road)']
    },
    {
      id: 'route_004',
      source: 'Chennai',
      destination: 'Bangalore',
      distance: 350,
      duration: 360,
      boarding_points: ['T. Nagar (Habibullah Road)', 'Guindy (Metro Station)', 'Koyambedu (Omni Bus Stand)', 'Poonamallee (Bypass)'],
      dropping_points: ['Electronic City (Phase 1)', 'Silk Board (Flyover Start)', 'Indiranagar (Metro Stn)', 'Majestic (KSR TC)']
    },
    {
      id: 'route_005',
      source: 'Delhi',
      destination: 'Jaipur',
      distance: 270,
      duration: 300,
      boarding_points: ['Kashmere Gate (ISBT)', 'Karol Bagh (Metro Stn)', 'Dhaula Kuan (Metro)', 'IFFCO Chowk (Gurugram)'],
      dropping_points: ['Sindhi Camp (Bus Stand)', 'Narayan Singh Circle', 'Transport Nagar (Entry)', 'Jaipur Bypass']
    }
  ];

  const todayStr = getFutureDateString(0);
  const tomorrowStr = getFutureDateString(1);
  const schedules: Schedule[] = [
    {
      id: 'sch_today_1',
      bus_id: 'bus_001',
      route_id: 'route_001',
      departure_time: `${todayStr}T08:00:00`,
      arrival_time: `${todayStr}T11:00:00`,
      base_fare: 400,
      seats_status: generateEmptySeats(32),
      waiting_list: [],
      gps_latitude: 19.0760,
      gps_longitude: 72.8777,
      gps_speed: 0,
      gps_status: 'Scheduled',
      gps_last_updated: new Date().toISOString()
    },
    {
      id: 'sch_today_2',
      bus_id: 'bus_002',
      route_id: 'route_003',
      departure_time: `${todayStr}T14:00:00`,
      arrival_time: `${todayStr}T20:00:00`,
      base_fare: 800,
      seats_status: generateEmptySeats(20),
      waiting_list: [],
      gps_latitude: 12.9716,
      gps_longitude: 77.5946,
      gps_speed: 0,
      gps_status: 'Scheduled',
      gps_last_updated: new Date().toISOString()
    },
    {
      id: 'sch_tomorrow_1',
      bus_id: 'bus_001',
      route_id: 'route_001',
      departure_time: `${tomorrowStr}T09:00:00`,
      arrival_time: `${tomorrowStr}T12:00:00`,
      base_fare: 400,
      seats_status: generateEmptySeats(32),
      waiting_list: []
    },
    {
      id: 'sch_tomorrow_2',
      bus_id: 'bus_003',
      route_id: 'route_002',
      departure_time: `${tomorrowStr}T16:00:00`,
      arrival_time: `${tomorrowStr}T19:00:00`,
      base_fare: 350,
      seats_status: generateEmptySeats(40),
      waiting_list: []
    }
  ];

  const pricingRules: PricingRule[] = [
    {
      id: 'pr_001',
      name: 'Weekend Dynamic Surge',
      multiplier: 1.15,
      type: 'time',
      applies_to: 'Saturday, Sunday'
    },
    {
      id: 'pr_002',
      name: 'Festive Season Premium',
      multiplier: 1.30,
      type: 'holiday',
      applies_to: 'Holidays & Festive Seasons'
    },
    {
      id: 'pr_003',
      name: 'High Demand Surge (< 20% remaining seats)',
      multiplier: 1.25,
      type: 'demand',
      applies_to: 'Occupancy > 80%'
    }
  ];

  return {
    users,
    buses,
    routes,
    schedules,
    bookings: [],
    payments: [],
    tickets: [],
    pricingRules
  };
}

function getFutureDateString(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function generateEmptySeats(capacity: number): Record<string, string | null> {
  const seats: Record<string, string | null> = {};
  const rows = Math.ceil(capacity / 4);
  const colLabels = ['A', 'B', 'C', 'D'];
  
  let count = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      if (count < capacity) {
        const seatLabel = `${colLabels[c]}${r}`;
        seats[seatLabel] = null;
        count++;
      }
    }
  }
  return seats;
}

// ---------------------------------------------------------------------
// DATABASE LOAD AND SAVE API
// ---------------------------------------------------------------------

export async function initializeDatabase(): Promise<void> {
  if (isInitializing) return;
  isInitializing = true;

  if (useSupabase && supabase) {
    console.log('[Database] Connecting to Supabase Cloud PostgreSQL...');
    try {
      // 1. Fetch count of users to check if empty & test database connection
      const { count, error: countErr } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (countErr) {
        throw new Error(`Connection test failed: ${countErr.message}`);
      }

      if (count === 0) {
        console.log('[Database] Supabase is empty. Seeding default tables...');
        const initialDb = createSeededDatabase();
        
        await safeInsert(supabase, 'users', initialDb.users);
        await safeInsert(supabase, 'buses', initialDb.buses);
        await safeInsert(supabase, 'routes', initialDb.routes);
        await safeInsert(supabase, 'schedules', initialDb.schedules);
        await safeInsert(supabase, 'pricing_rules', initialDb.pricingRules);
        
        dbCache = initialDb;
        console.log('[Database] Supabase database seeding complete!');
      } else {
        // Fetch all tables in parallel to populate cache
        console.log('[Database] Loading tables from Supabase...');
        const [
          usersRes,
          busesRes,
          routesRes,
          schedulesRes,
          bookingsRes,
          paymentsRes,
          ticketsRes,
          pricingRulesRes
        ] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('buses').select('*'),
          supabase.from('routes').select('*'),
          supabase.from('schedules').select('*'),
          supabase.from('bookings').select('*'),
          supabase.from('payments').select('*'),
          supabase.from('tickets').select('*'),
          supabase.from('pricing_rules').select('*')
        ]);

        // Throw error if any query fails (prevents silent failures resulting in empty cache)
        if (usersRes.error) throw new Error(`Failed to load users: ${usersRes.error.message}`);
        if (busesRes.error) throw new Error(`Failed to load buses: ${busesRes.error.message}`);
        if (routesRes.error) throw new Error(`Failed to load routes: ${routesRes.error.message}`);
        if (schedulesRes.error) throw new Error(`Failed to load schedules: ${schedulesRes.error.message}`);
        if (bookingsRes.error) throw new Error(`Failed to load bookings: ${bookingsRes.error.message}`);
        if (paymentsRes.error) throw new Error(`Failed to load payments: ${paymentsRes.error.message}`);
        if (ticketsRes.error) throw new Error(`Failed to load tickets: ${ticketsRes.error.message}`);
        if (pricingRulesRes.error) throw new Error(`Failed to load pricing_rules: ${pricingRulesRes.error.message}`);

        dbCache = {
          users: usersRes.data || [],
          buses: busesRes.data || [],
          routes: routesRes.data || [],
          schedules: schedulesRes.data || [],
          bookings: bookingsRes.data || [],
          payments: paymentsRes.data || [],
          tickets: ticketsRes.data || [],
          pricingRules: pricingRulesRes.data || []
        };
        console.log('[Database] Successfully loaded Supabase state into cache!');
      }
    } catch (err: any) {
      console.error('\n======================================================');
      console.error('[Database] Failed to connect/load Supabase database!');
      console.error('Error Details:', err.message);
      console.error('======================================================');
      console.log('[Database] Falling back to local JSON database file...');
      loadLocalDatabase();
    }
  } else {
    console.log('[Database] Using Local JSON Database File');
    loadLocalDatabase();
  }
}

async function safeInsert(supabase: any, table: string, data: any[]) {
  const { error } = await supabase.from(table).insert(data);
  if (error) throw new Error(`Failed to seed ${table}: ${error.message}`);
}

function loadLocalDatabase() {
  ensureDataDirectory();

  if (!fs.existsSync(DB_FILE)) {
    const initialDb = createSeededDatabase();
    saveLocalDatabase(initialDb);
    dbCache = initialDb;
    return;
  }

  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    dbCache = JSON.parse(rawData);
  } catch (err) {
    console.error('Error loading database, resetting to default seeds:', err);
    const initialDb = createSeededDatabase();
    saveLocalDatabase(initialDb);
    dbCache = initialDb;
  }
}

function saveLocalDatabase(db: DatabaseSchema) {
  ensureDataDirectory();
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }
  loadLocalDatabase();
  return dbCache!;
}

export function saveDatabase(db: DatabaseSchema) {
  dbCache = db;

  if (useSupabase && supabase) {
    syncToSupabase(db).catch(err => {
      console.error('[Database] Async background Supabase sync failed:', err.message);
    });
  } else {
    saveLocalDatabase(db);
  }
}

// ---------------------------------------------------------------------
// BACKROUND SUPABASE TRANSACTION SYNCHRONIZATION ALGORITHM
// ---------------------------------------------------------------------
async function syncToSupabase(data: DatabaseSchema) {
  if (!supabase) return;
  console.log('[Database] Syncing memory changes to Supabase in background...');

  try {
    await syncTable(supabase, 'users', data.users);
    await syncTable(supabase, 'buses', data.buses);
    await syncTable(supabase, 'routes', data.routes);
    await syncTable(supabase, 'schedules', data.schedules);
    await syncTable(supabase, 'bookings', data.bookings);
    await syncTable(supabase, 'payments', data.payments);
    await syncTable(supabase, 'tickets', data.tickets);
    await syncTable(supabase, 'pricing_rules', data.pricingRules);

    console.log('[Database] Supabase synchronization complete!');
  } catch (err: any) {
    console.error('[Database] Error synchronizing tables:', err.message);
  }
}

async function syncTable(supabase: any, tableName: string, memoryList: any[]) {
  if (memoryList.length > 0) {
    const { error: upsertErr } = await supabase.from(tableName).upsert(memoryList);
    if (upsertErr) throw upsertErr;
  }

  const { data: dbItems, error: selectErr } = await supabase.from(tableName).select('id');
  if (selectErr) throw selectErr;

  const memoryIds = new Set(memoryList.map(item => item.id));
  const deletedIds = dbItems
    .map((item: any) => item.id)
    .filter((id: string) => !memoryIds.has(id));

  if (deletedIds.length > 0) {
    const { error: deleteErr } = await supabase.from(tableName).delete().in('id', deletedIds);
    if (deleteErr) throw deleteErr;
  }
}
