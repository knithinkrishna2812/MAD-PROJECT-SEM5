import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set this to true to run COMPLETELY client-side WITHOUT any backend server!
// Set this to false to connect to the local Django server or Render API.
const USE_MOCK_API = true;

const USE_LOCAL_API = false;
const LOCAL_IP = '10.0.2.2';

const API_URL = USE_LOCAL_API
  ? `http://${LOCAL_IP}:8000/api/`
  : 'https://sharebite-backend.onrender.com/api/';

console.log('Using API URL:', USE_MOCK_API ? 'CLIENT-SIDE OFFLINE MOCK' : API_URL);

// Base Axios instance for real API
const realApi = axios.create({
  baseURL: API_URL,
  timeout: 6000,
  headers: {
    'Content-Type': 'application/json',
  },
});

realApi.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- OFFLINE MOCK DATA SYSTEM ---
const MOCK_STORAGE_KEYS = {
  USERS: 'mock_users',
  LISTINGS: 'mock_listings',
  CLAIMS: 'mock_claims',
  CURRENT_USER: 'mock_current_user',
};

// Pre-seeded mock database
const INITIAL_USERS = [
  {
    id: 1,
    username: 'nithin_ngo',
    password: '123',
    role: 'ngo',
    email: 'contact@chennaihope.org',
    address: 'Tower Park, Anna Nagar, Chennai, Tamil Nadu 600040',
    latitude: 13.0850,
    longitude: 80.2100,
  },
  {
    id: 2,
    username: 'nithin',
    password: '123',
    role: 'individual',
    email: 'nithin@gmail.com',
    address: 'Valluvar Kottam, Nungambakkam, Chennai, Tamil Nadu 600034',
    latitude: 13.0560,
    longitude: 80.2430,
  }
];

const INITIAL_LISTINGS = [
  {
    id: 1,
    title: 'Surplus Fresh Rice & Curry',
    food_type: 'prepared',
    quantity: '10 portions',
    description: 'Fresh prepared meals from lunch buffet. Kept refrigerated.',
    pickup_location: 'Koyambedu Metro Station, Koyambedu, Chennai, Tamil Nadu 600107',
    latitude: 13.0733,
    longitude: 80.2084,
    status: 'available',
    phone_number: '9485735683',
    provider_username: 'nithin',
    provider: {
      id: 2,
      username: 'nithin',
    },
    created_at: new Date().toISOString(),
    expiry_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
  },
  {
    id: 2,
    title: 'Bakery Bread and Buns',
    food_type: 'bakery',
    quantity: '5 bags',
    description: 'Fresh baked goods from yesterday evening. Good condition.',
    pickup_location: 'Vadapalani Murugan Temple, Vadapalani, Chennai, Tamil Nadu 600026',
    latitude: 13.0520,
    longitude: 80.2110,
    status: 'available',
    phone_number: '9745752416',
    provider_username: 'nithin',
    provider: {
      id: 2,
      username: 'nithin',
    },
    created_at: new Date().toISOString(),
    expiry_date: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
  }
];

// Seed storage if empty
const initializeMockData = async () => {
  try {
    const users = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.USERS);
    if (!users) {
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    const listings = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
    if (!listings || !listings.includes('expiry_date') || !listings.includes('provider')) {
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.LISTINGS, JSON.stringify(INITIAL_LISTINGS));
    }
    const claims = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CLAIMS);
    if (!claims || claims.includes('"listing":') || claims.includes('"receiver":')) {
      // Clear claims or reset to empty array because they use the old schema
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.CLAIMS, JSON.stringify([]));
    }
  } catch (e) {
    console.error('Error seeding mock data:', e);
  }
};

// Start seeding asynchronously
if (USE_MOCK_API) {
  initializeMockData();
}

// Helper to parse FormData into a plain JS object for mock processing
const parseData = (data) => {
  if (data && data._parts) {
    const obj = {};
    for (const [key, value] of data._parts) {
      if (value && typeof value === 'object' && value.uri) {
        obj[key] = value.uri;
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
  return data;
};

// Helper to throw Axios-like errors
const throwAxiosError = (data, status = 400) => {
  const err = new Error('Request failed');
  err.response = { data, status };
  throw err;
};

// Mock API Implementation
const mockApi = {
  get: async (url, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 200)); // Sim response latency
    
    if (url.includes('auth/profile/')) {
      const currentUserStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
      if (!currentUserStr) return throwAxiosError({ detail: 'Authentication credentials were not provided.' }, 401);
      return { data: JSON.parse(currentUserStr), status: 200 };
    }
    
    if (url.includes('listings/')) {
      const listingsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
      const listings = JSON.parse(listingsStr || '[]');
      
      // Check if fetching own listings
      if (url.includes('listings/my_listings/')) {
        const currentUserStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
        const currentUser = JSON.parse(currentUserStr || '{}');
        const myListings = listings.filter(l => l.provider?.id === currentUser.id || l.provider_username === currentUser.username);
        return { data: myListings, status: 200 };
      }
      
      // Check if there is an ID at the end of the URL, e.g., "listings/1/"
      const match = url.match(/listings\/(\d+)\/?/);
      if (match) {
        const listingId = parseInt(match[1]);
        const listing = listings.find(l => l.id === listingId);
        if (!listing) return throwAxiosError({ detail: 'Not found.' }, 404);
        return { data: listing, status: 200 };
      }
      
      return { data: listings, status: 200 };
    }
    
    if (url.includes('claims/')) {
      const claimsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CLAIMS);
      const claims = JSON.parse(claimsStr || '[]');
      
      const listingsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
      const listings = JSON.parse(listingsStr || '[]');
      
      const usersStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.USERS);
      const users = JSON.parse(usersStr || '[]');
      
      const currentUserStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
      const currentUser = JSON.parse(currentUserStr || '{}');
      
      // Filter claims to only show:
      // 1. Claims created by the current user (receiver_id matches current user ID)
      // 2. Claims made on listings owned by the current user (provider matches current user)
      const myClaims = claims.filter(claim => {
        const listing = listings.find(l => l.id === claim.listing_id);
        const isReceiver = claim.receiver_id === currentUser.id;
        const isProvider = listing && (listing.provider?.id === currentUser.id || listing.provider_username === currentUser.username);
        return isReceiver || isProvider;
      });
      
      const hydratedClaims = myClaims.map(claim => {
        const listing = listings.find(l => l.id === claim.listing_id);
        const receiver = users.find(u => u.id === claim.receiver_id);
        return {
          ...claim,
          listing: listing ? {
            ...listing,
            provider_name: listing.provider_username || (users.find(u => u.id === listing.provider?.id)?.username) || 'nithin'
          } : null,
          receiver: receiver ? {
            id: receiver.id,
            username: receiver.username,
            email: receiver.email,
            role: receiver.role,
          } : null
        };
      });
      
      return { data: hydratedClaims, status: 200 };
    }

    if (url.includes('analytics/dashboard/')) {
      const currentUserStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
      if (!currentUserStr) return throwAxiosError({ detail: 'Authentication credentials were not provided.' }, 401);
      const currentUser = JSON.parse(currentUserStr);
      
      const listingsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
      const listings = JSON.parse(listingsStr || '[]');
      
      const claimsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CLAIMS);
      const claims = JSON.parse(claimsStr || '[]');
      
      // Filter user listings & claims
      const userListings = listings.filter(l => l.provider?.id === currentUser.id || l.provider_username === currentUser.username);
      const userClaims = claims.filter(c => c.receiver_id === currentUser.id);
      
      // Calculate active, completed, total stats
      const total_listings = userListings.length;
      const completed_listings = userListings.filter(l => l.status === 'completed').length;
      const active_listings = userListings.filter(l => l.status === 'available' || l.status === 'claimed').length;
      
      const total_claims = userClaims.length;
      const completed_claims = userClaims.filter(c => c.status === 'completed').length;
      const pending_claims = userClaims.filter(c => c.status === 'pending' || c.status === 'confirmed').length;
      
      // Calculate dynamic community impact (based on completed claims in the system)
      const completedSystemClaims = claims.filter(c => c.status === 'completed');
      
      let meals_saved = 0;
      completedSystemClaims.forEach(claim => {
        const listing = listings.find(l => l.id === claim.listing_id);
        if (listing) {
          const match = listing.quantity.match(/(\d+)/);
          const quantityNum = match ? parseInt(match[1]) : 5;
          meals_saved += quantityNum;
        }
      });
      
      // If user has zero rescued meals, preseed with a base offset (like 25) so dashboard shows numbers on first load
      if (meals_saved === 0) {
        meals_saved = 25;
      }
      
      const weight_kg = meals_saved * 0.45; // 0.45 kg per meal
      const carbon_footprint_kg = weight_kg * 2.5; // 2.5 kg CO2 per kg food
      
      return {
        data: {
          impact: {
            meals_saved: meals_saved,
            weight_kg: weight_kg,
            carbon_footprint_kg: carbon_footprint_kg,
          },
          stats: {
            total_listings,
            completed_listings,
            active_listings,
            total_claims,
            completed_claims,
            pending_claims,
          }
        },
        status: 200
      };
    }

    return throwAxiosError({ detail: 'Not Found' }, 404);
  },

  post: async (url, rawData, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const data = parseData(rawData);
    
    // 1. REGISTRATION
    if (url.includes('auth/register/')) {
      const usersStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.USERS);
      const users = JSON.parse(usersStr || '[]');
      
      const exists = users.some(u => u.username === data.username);
      if (exists) {
        return throwAxiosError({ username: ['A user with that username already exists.'] }, 400);
      }
      
      const newUser = {
        id: users.length + 1,
        ...data,
        latitude: data.role === 'ngo' ? 13.0850 : 13.0560, // Default coordinates if empty
        longitude: data.role === 'ngo' ? 80.2100 : 80.2430,
        is_verified: true,
        created_at: new Date().toISOString()
      };
      
      users.push(newUser);
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.USERS, JSON.stringify(users));
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
      await AsyncStorage.setItem('userToken', 'mock-access-token');
      
      return {
        data: {
          user: newUser,
          access: 'mock-access-token',
          refresh: 'mock-refresh-token'
        },
        status: 201
      };
    }
    
    // 2. LOGIN
    if (url.includes('auth/login/')) {
      const usersStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.USERS);
      const users = JSON.parse(usersStr || '[]');
      
      const user = users.find(u => u.username === data.username && u.password === data.password);
      if (!user) {
        return throwAxiosError({ detail: 'Invalid credentials' }, 401);
      }
      
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      await AsyncStorage.setItem('userToken', 'mock-access-token');
      
      return {
        data: {
          user: user,
          access: 'mock-access-token',
          refresh: 'mock-refresh-token'
        },
        status: 200
      };
    }
    
    // 3. CREATE LISTING
    if (url.includes('listings/')) {
      const listingsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
      const listings = JSON.parse(listingsStr || '[]');
      
      const currentUserStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
      const currentUser = JSON.parse(currentUserStr || '{}');
      
      const newListing = {
        id: listings.length + 1,
        ...data,
        status: 'available',
        provider_username: currentUser.username,
        provider: {
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
        },
        // Geocode default fallbacks for demo coordinates based on entered string names
        latitude: data.pickup_location.toLowerCase().includes('koyambedu') ? 13.0733
                  : data.pickup_location.toLowerCase().includes('vadapalani') ? 13.0520
                  : 13.0850,
        longitude: data.pickup_location.toLowerCase().includes('koyambedu') ? 80.2084
                   : data.pickup_location.toLowerCase().includes('vadapalani') ? 80.2110
                   : 80.2100,
        created_at: new Date().toISOString()
      };
      
      listings.push(newListing);
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.LISTINGS, JSON.stringify(listings));
      return { data: newListing, status: 201 };
    }
    
    // 4. CLAIM LISTING
    if (url.includes('claims/')) {
      const claimsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CLAIMS);
      const claims = JSON.parse(claimsStr || '[]');
      
      const listingsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
      const listings = JSON.parse(listingsStr || '[]');
      
      const usersStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.USERS);
      const users = JSON.parse(usersStr || '[]');
      
      const currentUserStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
      const currentUser = JSON.parse(currentUserStr || '{}');
      
      const listingId = data.listing_id;
      
      // Update listing status to claimed
      const listingIndex = listings.findIndex(l => l.id === listingId);
      if (listingIndex !== -1) {
        listings[listingIndex].status = 'claimed';
        await AsyncStorage.setItem(MOCK_STORAGE_KEYS.LISTINGS, JSON.stringify(listings));
      }
      
      const newClaim = {
        id: claims.length + 1,
        listing_id: listingId,
        receiver_id: currentUser.id,
        status: 'pending',
        message: data.message || '',
        created_at: new Date().toISOString()
      };
      
      claims.push(newClaim);
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.CLAIMS, JSON.stringify(claims));
      
      const listing = listings.find(l => l.id === listingId);
      
      return {
        data: {
          ...newClaim,
          listing: listing ? {
            ...listing,
            provider_name: listing.provider_username || 'nithin'
          } : null,
          receiver: {
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
          }
        },
        status: 201
      };
    }
    
    return throwAxiosError({ detail: 'Not Found' }, 404);
  },

  patch: async (url, rawData, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const data = parseData(rawData);
    
    // UPDATE CLAIM STATUS (e.g. confirm, in_progress, completed)
    if (url.includes('claims/')) {
      const parts = url.split('/');
      const claimId = parseInt(parts[parts.length - 2] || parts[parts.length - 1]);
      
      const claimsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.CLAIMS);
      const claims = JSON.parse(claimsStr || '[]');
      
      const listingsStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.LISTINGS);
      const listings = JSON.parse(listingsStr || '[]');
      
      const usersStr = await AsyncStorage.getItem(MOCK_STORAGE_KEYS.USERS);
      const users = JSON.parse(usersStr || '[]');
      
      const claimIndex = claims.findIndex(c => c.id === claimId);
      if (claimIndex === -1) return throwAxiosError({ detail: 'Claim not found.' }, 404);
      
      claims[claimIndex].status = data.status;
      await AsyncStorage.setItem(MOCK_STORAGE_KEYS.CLAIMS, JSON.stringify(claims));
      
      // If completed, update listing status as well
      if (data.status === 'completed') {
        const listingIndex = listings.findIndex(l => l.id === claims[claimIndex].listing_id);
        if (listingIndex !== -1) {
          listings[listingIndex].status = 'completed';
          await AsyncStorage.setItem(MOCK_STORAGE_KEYS.LISTINGS, JSON.stringify(listings));
        }
      }
      
      const claim = claims[claimIndex];
      const listing = listings.find(l => l.id === claim.listing_id);
      const receiver = users.find(u => u.id === claim.receiver_id);
      
      return {
        data: {
          ...claim,
          listing: listing ? {
            ...listing,
            provider_name: listing.provider_username || 'nithin'
          } : null,
          receiver: receiver ? {
            id: receiver.id,
            username: receiver.username,
            email: receiver.email,
            role: receiver.role,
          } : null
        },
        status: 200
      };
    }
    
    return throwAxiosError({ detail: 'Not Found' }, 404);
  },
  
  put: async (url, data, config = {}) => {
    return mockApi.patch(url, data, config);
  },

  delete: async (url, config = {}) => {
    return { data: { success: true }, status: 200 };
  }
};

// Export correct instance based on toggle
const api = USE_MOCK_API ? mockApi : realApi;

export default api;
export { API_URL };
