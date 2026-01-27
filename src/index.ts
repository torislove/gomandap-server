import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { Vendor } from './models/Vendor.js';
import { Client } from './models/Client.js';
import { Admin } from './models/Admin.js';
import { Notification } from './models/Notification.js';
import { Ticket } from './models/Ticket.js';
import { Settings } from './models/Settings.js';
import { botService } from './services/BotService.js';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { devStore, isDbConnected, setDbConnected } from './devStore.js';

dotenv.config();

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected');
  setDbConnected(true);
});
mongoose.connection.on('error', () => {
  console.log('Mongoose connection error');
  setDbConnected(false);
});
mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
  setDbConnected(false);
});

const ensureDb = async () => {
  if (!isDbConnected) {
    try {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap', { serverSelectionTimeoutMS: 5000 } as any);
      setDbConnected(true);
    } catch (err) {
      console.error('Atlas connection failed. Reason:', err instanceof Error ? err.message : err);
      try {
        console.log('Attempting local MongoDB fallback...');
        await mongoose.connect('mongodb://localhost:27017/gomandap', { serverSelectionTimeoutMS: 5000 } as any);
        setDbConnected(true);
        console.log('Local MongoDB connected.');
      } catch (err2) {
        console.error('Local MongoDB connection failed.');
        setDbConnected(false);
      }
    }
  }
  return isDbConnected;
};

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap', { serverSelectionTimeoutMS: 5000 } as any)
  .then(() => {
    console.log('MongoDB Connected');
    setDbConnected(true);
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    setDbConnected(false);
  });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const ALLOWED_FIELDS = {
  common: ['pricingPackages', 'photos', 'advancePayment', 'cancellationPolicy', 'minPrice', 'maxPrice'],
  mandap: [
    'capacity', 'selectedServices', 'occasions', 'venueType',
    'airConditioning', 'seatingCapacity', 'floatingCapacity', 'diningCapacity',
    'bridalSuite', 'guestRooms', 'dormitory', 'roomAmenities', 'cateringPolicy',
    'foodType', 'kitchenFacilities', 'parkingCar', 'parkingBike', 'valetParking',
    'powerBackup', 'electricityCharges', 'lift', 'wheelchair', 'avEquipment',
    'safetyFeatures', 'decorPolicy', 'havan', 'firecrackers', 'lateNightMusic',
    'overnightWedding', 'alcoholPolicy', 'perPlateVeg', 'perPlateNonVeg',
    'entertainmentName', 'miscellaneous', 'entertainmentSupport'
  ],
  catering: [
    'cuisines', 'dietaryOptions', 'serviceStyle', 'liveCounters', 'liveCounterItems',
    'logistics', 'minGuestCount', 'fssaiLicense', 'perPlateVeg', 'perPlateNonVeg'
  ],
  decor: [
    'decorThemes', 'decorOfferings', 'entertainmentServices', 'designVisualization',
    'customizationLevel', 'inventory'
  ],
  entertainment: [
    'teamSize', 'performanceDuration', 'performanceType', 'providedEquipment',
    'travelOutstation', 'travelExpenses', 'stayRequirement', 'selectedServices'
  ],
  photography: [
    'photographyStyles', 'eventTypes', 'deliverables', 'rawFootage', 'equipment',
    'startingPrice'
  ]
};

const filterDetails = (details: any, type: string) => {
  if (!details || typeof details !== 'object') return {};
  const allowed = new Set([...ALLOWED_FIELDS.common, ...(ALLOWED_FIELDS[type as keyof typeof ALLOWED_FIELDS] || [])]);
  const filtered: any = {};
  for (const key in details) {
    if (allowed.has(key)) {
      filtered[key] = details[key];
    }
  }
  return filtered;
};

const app = new Hono();

app.use('/*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://snapadda.com',
      'https://vendor.snapadda.com',
      'https://admin.snapadda.com'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return origin;
    
    // Allow allowed origins
    if (allowedOrigins.includes(origin)) return origin;
    
    // Allow localhost for development
    if (origin.startsWith('http://localhost')) return origin;
    
    // Block all other origins
    return undefined;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));
app.use('/uploads/*', serveStatic({ root: './' }));

// Admin Routes
app.post('/api/admin/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ success: false, error: 'Please provide username and password' }, 400);
  }

  const admin = await Admin.findOne({
    $or: [{ username }, { email: username }]
  });

  if (!admin) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const isMatch = await bcrypt.compare(password, admin.password as string);

  if (!isMatch) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const token = await sign({ id: admin._id }, process.env.JWT_SECRET || 'secret');

  return c.json({
    success: true,
    token,
    data: {
      id: admin._id,
      username: admin.username,
      email: admin.email
    }
  });
});

app.post('/api/admin/create', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const { username, email, password } = await c.req.json();

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await Admin.create({
      username,
      email,
      password: hashedPassword
    });

    return c.json({ success: true, data: { id: admin._id, username, email } }, 201);
  } catch (e) {
    return c.json({ success: false, error: 'Admin already exists or error' }, 400);
  }
});

app.get('/api/admin/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return c.json({ success: false, error: 'Admin not found' }, 404);
    return c.json({ success: true, data: admin });
  } catch (err) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
});

app.put('/api/admin/updatepassword', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const { currentPassword, newPassword } = await c.req.json();
  const token = authHeader.split(' ')[1];

  try {
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const admin = await Admin.findById(decoded.id);
    if (!admin) return c.json({ success: false, error: 'Admin not found' }, 404);

    const isMatch = await bcrypt.compare(currentPassword, admin.password as string);
    if (!isMatch) return c.json({ success: false, error: 'Incorrect current password' }, 400);

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return c.json({ success: false, error: 'Error updating password' }, 500);
  }
});


// Admin Image Upload
app.post('/api/admin/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['image'];

    if (file && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Try Cloudinary first
      try {
        const result: any = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'admins' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(buffer);
        });
        return c.json({ success: true, data: { imageUrl: result.secure_url } });
      } catch (cloudError) {
        console.error('Cloudinary failed, falling back to local storage:', cloudError);

        // Fallback to Local Storage
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);

        const imageUrl = `${PUBLIC_BASE_URL}/uploads/${fileName}`;
        return c.json({ success: true, data: { imageUrl } });
      }
    }

    return c.json({ success: false, error: 'No image file provided' }, 400);
  } catch (error) {
    console.error('Admin Upload Error:', error);
    return c.json({ success: false, error: 'Image upload failed' }, 500);
  }
});

app.put('/api/admin/profile', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const token = authHeader.split(' ')[1];
  const { profilePicture } = await c.req.json();

  try {
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const admin = await Admin.findById(decoded.id);

    if (!admin) return c.json({ success: false, error: 'Admin not found' }, 404);

    if (profilePicture) admin.profilePicture = profilePicture;

    await admin.save();

    return c.json({ success: true, data: admin });
  } catch (err) {
    return c.json({ success: false, error: 'Error updating profile' }, 500);
  }
});

// Client Routes

// Client Auth: Signup
app.post('/api/auth/client/signup', async (c) => {
  const { name, email, phone, password } = await c.req.json();

  try {
    const ok = await ensureDb();
    if (!ok) return c.json({ success: false, error: 'Database not connected' }, 500);

    const existing = await Client.findOne({ email });
    if (existing) {
      return c.json({ success: false, error: 'Email already registered' }, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const client = await Client.create({
      displayName: name,
      email,
      password: hashedPassword,
      // phone is not in schema yet, adding it to logic if needed or ignoring
      loginHistory: [{
        timestamp: new Date(),
        ip: c.req.header('x-forwarded-for') || 'unknown',
        userAgent: c.req.header('user-agent')
      }]
    });

    const token = await sign({ id: client._id }, process.env.JWT_SECRET || 'secret');

    return c.json({
      success: true,
      token,
      user: {
        id: client._id,
        name: client.displayName,
        email: client.email
      }
    });
  } catch (err) {
    console.error('Client Signup Error:', err);
    return c.json({ success: false, error: 'Signup failed' }, 500);
  }
});

// Client Auth: Login
app.post('/api/auth/client/login', async (c) => {
  const { email, password } = await c.req.json();

  try {
    if (!isDbConnected && !process.env.MONGO_URI) {
      // Dev mode fallback if needed, but for now assuming DB
    }

    const client = await Client.findOne({ email });
    if (!client || !client.password) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const token = await sign({ id: client._id }, process.env.JWT_SECRET || 'secret');

    // Update login history
    await Client.updateOne({ _id: client._id }, {
      $set: { lastLogin: new Date() },
      $push: {
        loginHistory: {
          $each: [{
            timestamp: new Date(),
            ip: c.req.header('x-forwarded-for') || 'unknown',
            userAgent: c.req.header('user-agent')
          }],
          $slice: -50
        }
      }
    });

    return c.json({
      success: true,
      token,
      user: {
        id: client._id,
        name: client.displayName,
        email: client.email
      }
    });
  } catch (err) {
    console.error('Client Login Error:', err);
    return c.json({ success: false, error: 'Login failed' }, 500);
  }
});

app.post('/api/clients/sync', async (c) => {
  const body = await c.req.json();
  const { firebaseUid, email, displayName, photoURL, ip } = body;

  try {
    const ok = await ensureDb();
    if (!ok) return c.json({ success: false, error: 'Database not connected' }, 500);

    let client = await Client.findOne({ firebaseUid });

    const updateData: any = {
      email,
      displayName,
      photoURL,
      lastLogin: new Date(),
      lastLoginIp: ip || c.req.header('x-forwarded-for') || 'unknown',
    };

    if (client) {
      // Push to login history (keep last 50)
      await Client.updateOne(
        { firebaseUid },
        {
          $set: updateData,
          $push: {
            loginHistory: {
              $each: [{
                timestamp: new Date(),
                ip: updateData.lastLoginIp,
                userAgent: c.req.header('user-agent')
              }],
              $slice: -50
            }
          }
        }
      );
      client = await Client.findOne({ firebaseUid });
    } else {
      client = await Client.create({
        firebaseUid,
        ...updateData,
        loginHistory: [{
          timestamp: new Date(),
          ip: updateData.lastLoginIp,
          userAgent: c.req.header('user-agent')
        }]
      });
    }

    return c.json({ success: true, data: client });
  } catch (err) {
    console.error('Client Sync Error:', err);
    return c.json({ success: false, error: 'Sync failed' }, 500);
  }
});

// Admin Stats & Clients
app.get('/api/admin/clients', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    const clients = await Client.find().sort({ lastLogin: -1 });
    return c.json({ success: true, data: clients });
  } catch (err) {
    return c.json({ success: false, error: 'Error fetching clients' }, 500);
  }
});

// Client Favorites & Shortlist
app.post('/api/clients/favorites/:vendorId', async (c) => {
  const body = await c.req.json();
  const { firebaseUid } = body; // Assuming passed from frontend context or Auth header if migrated

  // Note: For now using firebaseUid from body to identify client as per existing pattern
  // Ideally should be from Auth token

  try {
    const client = await Client.findOne({ firebaseUid });
    if (!client) return c.json({ success: false, error: 'Client not found' }, 404);

    const vendorId = c.req.param('vendorId');
    if (!client.favorites.includes(vendorId as any)) {
      client.favorites.push(vendorId as any);
      await client.save();
    }

    return c.json({ success: true, data: client.favorites });
  } catch (err) {
    return c.json({ success: false, error: 'Error adding favorite' }, 500);
  }
});

app.delete('/api/clients/favorites/:vendorId', async (c) => {
  const body = await c.req.json(); // Need firebaseUid
  const { firebaseUid } = body;

  try {
    const client = await Client.findOne({ firebaseUid });
    if (!client) return c.json({ success: false, error: 'Client not found' }, 404);

    const vendorId = c.req.param('vendorId');
    client.favorites = client.favorites.filter(id => id.toString() !== vendorId);
    await client.save();

    return c.json({ success: true, data: client.favorites });
  } catch (err) {
    return c.json({ success: false, error: 'Error removing favorite' }, 500);
  }
});

app.get('/api/clients/:uid/favorites', async (c) => {
  const uid = c.req.param('uid');
  try {
    const client = await Client.findOne({ firebaseUid: uid }).populate('favorites');
    if (!client) return c.json({ success: false, error: 'Client not found' }, 404);
    return c.json({ success: true, data: client.favorites });
  } catch (err) {
    return c.json({ success: false, error: 'Error fetching favorites' }, 500);
  }
});

app.get('/api/admin/stats', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    const totalVendors = await Vendor.countDocuments({});
    const verifiedVendors = await Vendor.countDocuments({ isVerified: true });
    const totalClients = await Client.countDocuments({});
    const activeClientsToday = await Client.countDocuments({
      lastLogin: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    return c.json({
      success: true,
      data: {
        vendors: { total: totalVendors, verified: verifiedVendors },
        clients: { total: totalClients, activeToday: activeClientsToday }
      }
    });
  } catch (err) {
    return c.json({ success: false, error: 'Error fetching stats' }, 500);
  }
});

// Vendor Routes
app.post('/api/vendors/signup', async (c) => {
  const { fullName, email, password, phone, businessName, vendorType, whatsappNumber, additionalPhones } = await c.req.json();

  try {
    const ok = await ensureDb();
    if (!ok) return c.json({ success: false, error: 'Database not connected. Please whitelist your IP in Atlas or start local MongoDB.' }, 500);
    const existing = await Vendor.findOne({ email });
    if (existing) {
      return c.json({ success: false, error: 'Email already registered' }, 400);
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const vendor = await Vendor.create({
      fullName,
      email,
      password: hashedPassword,
      phone,
      additionalPhones: additionalPhones || [],
      whatsappNumber: whatsappNumber || '',
      businessName,
      vendorType,
      onboardingCompleted: false
    });
    const token = await sign({ id: vendor._id }, process.env.JWT_SECRET || 'secret');
    return c.json({ success: true, token, data: vendor });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error creating vendor';
    return c.json({ success: false, error: msg }, 500);
  }
});

app.post('/api/vendors/login', async (c) => {
  const { email, password } = await c.req.json();

  try {
    if (!isDbConnected) {
      const vendor = devStore.findByEmail(email);
      if (!vendor || !vendor.password) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }
      const isMatch = await bcrypt.compare(password, vendor.password);
      if (!isMatch) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }
      const token = await sign({ id: vendor._id }, process.env.JWT_SECRET || 'secret');
      return c.json({ success: true, token, data: vendor });
    } else {
      const vendor = await Vendor.findOne({ email });
      if (!vendor || !vendor.password) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }
      const isMatch = await bcrypt.compare(password, vendor.password);
      if (!isMatch) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }
      const token = await sign({ id: vendor._id }, process.env.JWT_SECRET || 'secret');
      return c.json({ success: true, token, data: vendor });
    }
  } catch (error) {
    return c.json({ success: false, error: 'Login failed' }, 500);
  }
});

app.post('/api/vendors/google', async (c) => {
  const { credential } = await c.req.json();

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) return c.json({ success: false, error: 'Invalid Google Token' }, 400);

    const { email, name, sub, picture } = payload;
    const emailStr = email || '';
    const nameStr = name || emailStr;
    const subStr = sub || '';
    const pictureStr = picture || '';

    if (!isDbConnected) {
      let vendor = devStore.findByEmail(emailStr);
      if (!vendor) {
        vendor = await devStore.createVendor({ fullName: nameStr, email: emailStr, googleId: subStr, logo: pictureStr });
      } else if (!vendor.googleId) {
        vendor.googleId = subStr;
      }
      const token = await sign({ id: vendor._id }, process.env.JWT_SECRET || 'secret');
      return c.json({ success: true, token, data: vendor });
    } else {
      let vendor = await Vendor.findOne({ email: emailStr });
      if (!vendor) {
        vendor = await Vendor.create({
          fullName: nameStr,
          email: emailStr,
          googleId: subStr,
          logo: pictureStr,
          onboardingCompleted: false
        });
      } else if (!vendor.googleId) {
        vendor.googleId = subStr;
        await vendor.save();
      }
      const token = await sign({ id: vendor._id }, process.env.JWT_SECRET || 'secret');
      return c.json({ success: true, token, data: vendor });
    }
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: 'Google Auth Failed' }, 500);
  }
});

// Update Vendor Profile (with coordinate extraction from mapsLink)
app.put('/api/vendors/profile', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendorId = decoded.id;

    const body = await c.req.json();
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return c.json({ success: false, error: 'Vendor not found' }, 404);

    // If mapsLink is provided, extract coordinates
    if (body.mapsLink && body.mapsLink !== vendor.mapsLink) {
      const coords = extractCoordinatesFromUrl(body.mapsLink);
      if (coords) {
        body.coordinates = { lat: coords.lat, lon: coords.lon };
        console.log(`Extracted coordinates from mapsLink: ${coords.lat}, ${coords.lon}`);
      }
    }

    // Update vendor fields
    Object.keys(body).forEach(key => {
      (vendor as any)[key] = body[key];
    });

    await vendor.save();
    return c.json({ success: true, data: vendor });
  } catch (err) {
    console.error('Vendor profile update error:', err);
    return c.json({ success: false, error: 'Failed to update profile' }, 500);
  }
});

app.get('/api/vendors/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendor = await Vendor.findById(decoded.id).select('-password');
    if (!vendor) return c.json({ success: false, error: 'Vendor not found' }, 404);
    return c.json({ success: true, data: vendor });
  } catch (err) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
});

app.get('/api/vendors', async (c) => {
  try {
    if (!isDbConnected) {
      const vendors = devStore.list();
      return c.json({ success: true, count: vendors.length, data: vendors });
    } else {
      const vendors = await Vendor.find().sort({ createdAt: -1 });
      return c.json({ success: true, count: vendors.length, data: vendors });
    }
  } catch (err) {
    return c.json({ success: false, error: 'Error fetching vendors' }, 500);
  }
});

// Search Vendors with filters
app.get('/api/vendors/search', async (c) => {
  try {
    const city = c.req.query('city');
    const vendorType = c.req.query('vendorType');
    const onboardingCompleted = c.req.query('onboardingCompleted');
    const lat = c.req.query('lat');
    const lon = c.req.query('lon');
    const radius = c.req.query('radius') || '50'; // km

    const query: any = {};

    if (city) {
      query.city = { $regex: new RegExp(city, 'i') };
    }
    if (vendorType) {
      query.vendorType = { $regex: new RegExp(vendorType, 'i') };
    }
    if (onboardingCompleted === 'true') {
      query.onboardingCompleted = true;
    }

    // Price Filtering
    const minPrice = c.req.query('minPrice');
    const maxPrice = c.req.query('maxPrice');

    if (minPrice || maxPrice) {
      query.$or = [
        // Match explicit number fields
        {
          minPrice: { $gte: Number(minPrice) || 0 },
          ...(maxPrice ? { maxPrice: { $lte: Number(maxPrice) } } : {})
        },
        // Fallback for legacy data (optional, but good for transition)
        // This is complex for mixed types, better to rely on script to migrate data first
      ];

      // Since $or is used, we need to merge with other fields carefully
      // If other fields exist, use $and
      if (Object.keys(query).length > 1) {
        const { $or, ...rest } = query;
        query.$and = [$or, rest];
        delete query.$or;
      }
    }

    const ok = await ensureDb();
    if (!ok) {
      return c.json({ success: true, count: 0, data: [] });
    }

    // Sort by priority (desc) then createdAt (desc)
    let vendors = await Vendor.find(query).sort({ priority: -1, createdAt: -1 });

    // If coordinates provided, filter by distance and calculate distance for each vendor
    if (lat && lon) {
      const userLat = parseFloat(lat);
      const userLon = parseFloat(lon);
      const maxRadius = parseFloat(radius);

      const vendorsWithDistance = vendors
        .map((v: any) => {
          const vendorObj = v.toObject ? v.toObject() : v;
          if (vendorObj.coordinates?.lat && vendorObj.coordinates?.lon) {
            const dist = haversineDistance(userLat, userLon, vendorObj.coordinates.lat, vendorObj.coordinates.lon);
            vendorObj.distance = Math.round(dist * 10) / 10; // Round to 1 decimal
            return { ...vendorObj, distance: vendorObj.distance };
          }
          vendorObj.distance = null;
          return vendorObj;
        })
        .filter((v: any) => {
          if (v.distance !== null) {
            return v.distance <= maxRadius;
          }
          return true; // Include vendors without coordinates
        })
        .sort((a: any, b: any) => {
          // Primary Sort: Priority (High to Low)
          if ((b.priority || 0) !== (a.priority || 0)) {
            return (b.priority || 0) - (a.priority || 0);
          }
          // Secondary Sort: Distance (Nearest first)
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });

      return c.json({ success: true, count: vendorsWithDistance.length, data: vendorsWithDistance });
    }

    return c.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) {
    console.error('Search vendors error:', err);
    return c.json({ success: false, error: 'Error searching vendors' }, 500);
  }
});


// Helper: Haversine distance in km
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Extract coordinates from Google Maps URL
function extractCoordinatesFromUrl(url: string): { lat: number; lon: number } | null {
  try {
    if (!url) return null;

    let lat: number | null = null;
    let lon: number | null = null;

    // 1. Coordinates in path (@lat,lon)
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lon = parseFloat(atMatch[2]);
    }

    // 2. Query params (?q=lat,lon or ?ll=lat,lon)
    if (!lat && !lon) {
      const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (qMatch) {
        lat = parseFloat(qMatch[1]);
        lon = parseFloat(qMatch[2]);
      }
    }

    // 3. Google Maps short URLs with !3d (latitude) and !4d (longitude)
    if (!lat && !lon) {
      const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
      if (dataMatch) {
        lat = parseFloat(dataMatch[1]);
        lon = parseFloat(dataMatch[2]);
      }
    }

    // 4. Place format: /place/.../@lat,lon
    if (!lat && !lon) {
      const placeMatch = url.match(/\/place\/[^/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (placeMatch) {
        lat = parseFloat(placeMatch[1]);
        lon = parseFloat(placeMatch[2]);
      }
    }

    // Validate coordinates are in valid ranges
    if (lat !== null && lon !== null) {
      // Latitude must be between -90 and 90
      // Longitude must be between -180 and 180
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        console.log(`✓ Extracted valid coordinates: lat=${lat}, lon=${lon} from ${url.substring(0, 50)}...`);
        return { lat, lon };
      } else {
        console.warn(`⚠ Invalid coordinate ranges detected: lat=${lat}, lon=${lon}. Possible lat/lon swap?`);

        // Check if swapping would make them valid (catch potential swap errors)
        if (lon >= -90 && lon <= 90 && lat >= -180 && lat <= 180) {
          console.warn(`⚠ Swapping lat/lon to correct values: lat=${lon}, lon=${lat}`);
          return { lat: lon, lon: lat };
        }
      }
    }

    return null;
  } catch (e) {
    console.error('Coordinate extraction error:', e);
    return null;
  }
}

// Seed all vendor categories around Pune (within 50km)
app.post('/api/vendors/seed/pune-all', async (c) => {
  try {
    const ok = await ensureDb();
    if (!ok) return c.json({ success: false, error: 'Database not connected' }, 500);

    // Pune center: 18.5204, 73.8567
    // Areas within 50km of Pune
    const puneAreas = [
      { name: 'Pune Central', lat: 18.5204, lon: 73.8567 },
      { name: 'Kothrud', lat: 18.5074, lon: 73.8077 },
      { name: 'Hinjewadi', lat: 18.5912, lon: 73.7388 },
      { name: 'Wakad', lat: 18.5989, lon: 73.7611 },
      { name: 'Baner', lat: 18.5596, lon: 73.7871 },
      { name: 'Hadapsar', lat: 18.5089, lon: 73.9260 },
      { name: 'Viman Nagar', lat: 18.5679, lon: 73.9143 },
      { name: 'Pimpri', lat: 18.6279, lon: 73.8009 },
      { name: 'Chinchwad', lat: 18.6298, lon: 73.7997 },
      { name: 'Lonavala', lat: 18.7546, lon: 73.4062 },
    ];

    const categories = [
      { type: 'mandap', prefix: 'gmmandap', names: ['Royal Palace Mandap', 'Shubham Mandap Hall', 'Divine Wedding Lawns', 'Mangal Karyalay', 'Sai Baba Mandap'] },
      { type: 'catering', prefix: 'gmcatering', names: ['Shree Caterers', 'Pune Food Masters', 'Annapurna Catering', 'Royal Feast Caterers', 'Swad Catering Services'] },
      { type: 'decor', prefix: 'gmdecor', names: ['Dream Decor Studio', 'Floral Fantasy', 'Wedding Bells Decor', 'Mangalya Decorators', 'Aura Decor Pune'] },
      { type: 'photography', prefix: 'gmstudio', names: ['Capture Moments Studio', 'Pune Pixel Studios', 'Wedding Story Films', 'Shutter Dreams', 'Picture Perfect Pune'] },
      { type: 'entertainment', prefix: 'gment', names: ['DJ Beats Pune', 'Sangeet Party Band', 'Rhythm Masters', 'Dance Floor DJs', 'Melody Makers Entertainment'] },
    ];

    const createdVendors: any[] = [];

    for (const category of categories) {
      for (let i = 0; i < category.names.length; i++) {
        const area = puneAreas[i % puneAreas.length];
        const randomOffset = () => (Math.random() - 0.5) * 0.1; // Small random offset

        const email = `${category.type}${i + 1}.pune@gomandap.local`;

        // Check if already exists
        const existing = await Vendor.findOne({ email });
        if (existing) {
          createdVendors.push(existing);
          continue;
        }

        const count = await Vendor.countDocuments({ vendorType: category.type });
        const code = `${category.prefix}${101 + count}`;

        const vendor = await Vendor.create({
          fullName: `${category.names[i]} Owner`,
          email,
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          businessName: category.names[i],
          vendorType: category.type,
          vendorCode: code,
          qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${category.type}/${code}`)}`,
          addressLine1: `${area.name} Main Road`,
          addressLine2: 'Near City Center',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: `41100${i}`,
          mapsLink: `https://maps.google.com/?q=${area.lat},${area.lon}`,
          coordinates: {
            lat: area.lat + randomOffset(),
            lon: area.lon + randomOffset()
          },
          logo: '',
          description: `Premium ${category.type} services in ${area.name}, Pune. We specialize in making your events memorable with top-quality services.`,
          experience: `${5 + i}`,
          pricing: { range: `₹${20 + i * 10}K – ₹${50 + i * 15}K` },
          services: { core: ['Premium Service', 'Custom Packages', '24/7 Support'] },
          details: {
            minPrice: `${20000 + i * 10000}`,
            maxPrice: `${100000 + i * 20000}`,
            rating: (4 + Math.random()).toFixed(1),
            reviews: Math.floor(50 + Math.random() * 200)
          },
          onboardingStep: 4,
          onboardingCompleted: true,
          isVerified: true,
          feeAccepted: true
        });

        createdVendors.push(vendor);
      }
    }

    return c.json({
      success: true,
      message: `Created/Found ${createdVendors.length} vendors in Pune area`,
      count: createdVendors.length,
      data: createdVendors
    }, 201);
  } catch (err) {
    console.error('Seed Pune vendors error:', err);
    return c.json({ success: false, error: 'Error seeding vendors' }, 500);
  }
});

// Seed vendors in scenic village areas near Pune (Kamshet, Pawna, Sinhagad, Mulshi, Panshet)
app.post('/api/vendors/seed/pune-villages', async (c) => {
  try {
    const ok = await ensureDb();
    if (!ok) return c.json({ success: false, error: 'Database not connected' }, 500);

    // Scenic wedding destinations near Pune (within 50km of Pimpri-Chinchwad)
    const villages = [
      { name: 'Kamshet', lat: 18.7628, lon: 73.5492, city: 'Kamshet' },
      { name: 'Pawna Lake', lat: 18.6580, lon: 73.4800, city: 'Pawna Lake' },
      { name: 'Sinhagad', lat: 18.3661, lon: 73.7558, city: 'Sinhagad' },
      { name: 'Mulshi', lat: 18.5064, lon: 73.5103, city: 'Mulshi' },
      { name: 'Panshet', lat: 18.3319, lon: 73.6561, city: 'Panshet' },
    ];

    const categories = [
      { type: 'mandap', prefix: 'gmmandap', nameTemplate: (v: string) => `${v} Resort & Wedding Venue` },
      { type: 'catering', prefix: 'gmcatering', nameTemplate: (v: string) => `${v} Traditional Caterers` },
      { type: 'decor', prefix: 'gmdecor', nameTemplate: (v: string) => `${v} Nature Decorators` },
      { type: 'photography', prefix: 'gmstudio', nameTemplate: (v: string) => `${v} Destination Photography` },
      { type: 'entertainment', prefix: 'gment', nameTemplate: (v: string) => `${v} Live Entertainment` },
    ];

    const createdVendors: any[] = [];

    for (const village of villages) {
      for (const category of categories) {
        const email = `${category.type}.${village.name.toLowerCase().replace(/\s+/g, '')}.pune@gomandap.local`;

        // Check if already exists
        const existing = await Vendor.findOne({ email });
        if (existing) {
          createdVendors.push(existing);
          continue;
        }

        const count = await Vendor.countDocuments({ vendorType: category.type });
        const code = `${category.prefix}${101 + count}`;
        const randomOffset = () => (Math.random() - 0.5) * 0.02; // Small random offset

        const vendor = await Vendor.create({
          fullName: `${category.nameTemplate(village.name)} Owner`,
          email,
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          businessName: category.nameTemplate(village.name),
          vendorType: category.type,
          vendorCode: code,
          qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${category.type}/${code}`)}`,
          addressLine1: `${village.name} Main Road`,
          addressLine2: 'Scenic Destination',
          village: village.name,
          city: village.city,
          state: 'Maharashtra',
          pincode: '412106',
          mapsLink: `https://maps.google.com/?q=${village.lat},${village.lon}`,
          coordinates: {
            lat: village.lat + randomOffset(),
            lon: village.lon + randomOffset()
          },
          logo: '',
          description: `Premium ${category.type} services at ${village.name} - a scenic wedding destination near Pune. Perfect for destination weddings with stunning natural backdrop.`,
          experience: `${8 + Math.floor(Math.random() * 7)}`,
          pricing: { range: `₹${30 + Math.floor(Math.random() * 20)}K – ₹${80 + Math.floor(Math.random() * 50)}K` },
          services: { core: ['Destination Wedding', 'Premium Amenities', 'Nature Setting', 'Custom Packages'] },
          details: {
            minPrice: `${30000 + Math.floor(Math.random() * 20000)}`,
            maxPrice: `${150000 + Math.floor(Math.random() * 100000)}`,
            rating: (4.2 + Math.random() * 0.7).toFixed(1),
            reviews: Math.floor(80 + Math.random() * 150)
          },
          onboardingStep: 4,
          onboardingCompleted: true,
          isVerified: true,
          feeAccepted: true
        });

        createdVendors.push(vendor);
      }
    }

    return c.json({
      success: true,
      message: `Created/Found ${createdVendors.length} vendors in Pune village areas (Kamshet, Pawna, Sinhagad, Mulshi, Panshet)`,
      count: createdVendors.length,
      data: createdVendors
    }, 201);
  } catch (err) {
    console.error('Seed Pune villages error:', err);
    return c.json({ success: false, error: 'Error seeding village vendors' }, 500);
  }
});


app.get('/api/vendors/code/:code', async (c) => {
  const code = c.req.param('code');
  try {
    const ok = await ensureDb();
    if (!ok) return c.json({ success: false, error: 'Database not connected' }, 500);
    const vendor = await Vendor.findOne({ vendorCode: code });
    if (!vendor) return c.json({ success: false, error: 'Vendor not found' }, 404);
    return c.json({ success: true, data: vendor });
  } catch (err) {
    return c.json({ success: false, error: 'Error fetching vendor' }, 500);
  }
});

app.get('/api/health', async (c) => {
  const ok = await ensureDb();
  const ready = mongoose.connection.readyState === 1;
  return c.json({ success: true, dbConnected: ok && ready });
});

app.post('/api/vendors/onboarding', async (c) => {
  const body = await c.req.json();
  const { email } = body;

  try {
    if (!isDbConnected) {
      const vendor = devStore.upsertByEmail(email, body);
      return c.json({ success: true, data: vendor });
    } else {
      let vendor = await Vendor.findOne({ email });
      if (vendor) {
        const oldType = vendor.vendorType;

        // Filter details if present
        if (body.details && (vendor.vendorType || body.vendorType)) {
          const type = (body.vendorType || vendor.vendorType || '').toLowerCase();
          body.details = filterDetails(body.details, type);
        }

        Object.assign(vendor, body);

        // Check if vendorType has changed OR vendorCode is missing
        if ((vendor.vendorType || body.vendorType) && (!vendor.vendorCode || (oldType && vendor.vendorType !== oldType))) {
          const type = (body.vendorType || vendor.vendorType || '').toLowerCase();
          const prefix = type === 'mandap' ? 'gmmandap' :
            type === 'catering' ? 'gmcatering' :
              type === 'decor' ? 'gmdecor' :
                type === 'entertainment' ? 'gment' :
                  type === 'photography' ? 'gmstudio' : 'gmvendor';
          const count = await Vendor.countDocuments({ vendorType: type });
          const num = 101 + count;
          const code = `${prefix}${num}`;
          vendor.vendorCode = code;
          vendor.qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${type}/${code}`)}`;
        }
        await vendor.save();
      } else {
        const toCreate: any = { ...body };
        if (toCreate.vendorType && !toCreate.vendorCode) {
          const type = String(toCreate.vendorType).toLowerCase();
          const prefix = type === 'mandap' ? 'gmmandap' :
            type === 'catering' ? 'gmcatering' :
              type === 'decor' ? 'gmdecor' :
                type === 'entertainment' ? 'gment' :
                  type === 'photography' ? 'gmstudio' : 'gmvendor';
          const count = await Vendor.countDocuments({ vendorType: type });
          const num = 101 + count;
          const code = `${prefix}${num}`;
          toCreate.vendorCode = code;
          toCreate.qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${type}/${code}`)}`;
        }
        vendor = await Vendor.create(toCreate);
      }
      return c.json({ success: true, data: vendor });
    }
  } catch (err) {
    console.error(err);
    return c.json({ success: false, error: 'Error saving vendor' }, 500);
  }
});


// Notification Routes

// Send Notification (Admin Only)
app.post('/api/notifications/send', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256'); // Verify Admin Token

    const { recipientType, recipientId, recipientVendorType, title, message, type } = await c.req.json();

    const notification = await Notification.create({
      recipientType,
      recipientId,
      recipientVendorType,
      title,
      message,
      type
    });

    return c.json({ success: true, data: notification });
  } catch (err) {
    console.error('Send Notification Error:', err);
    return c.json({ success: false, error: 'Failed to send notification' }, 500);
  }
});

// Get Vendor Notifications
app.get('/api/notifications/vendor', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendorId = decoded.id as string;

    // Fetch vendor to know their type
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return c.json({ success: false, error: 'Vendor not found' }, 404);

    const notifications = await Notification.find({
      $or: [
        { recipientType: 'all' },
        { recipientType: 'vendorType', recipientVendorType: vendor.vendorType },
        { recipientType: 'specific', recipientId: vendorId }
      ]
    }).sort({ createdAt: -1 });

    return c.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Fetch Notification Error:', err);
    return c.json({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
});

// Mark Notification as Read
app.put('/api/notifications/:id/read', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const notificationId = c.req.param('id');

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendorId = decoded.id as string;

    const notification = await Notification.findById(notificationId);
    if (!notification) return c.json({ success: false, error: 'Notification not found' }, 404);

    if (!notification.readBy.includes(vendorId)) {
      notification.readBy.push(vendorId);
      await notification.save();
    }

    return c.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    console.error('Mark Read Error:', err);
    return c.json({ success: false, error: 'Failed to mark as read' }, 500);
  }
});

app.post('/api/vendors/seed/mandap', async (c) => {
  try {
    if (!isDbConnected) {
      return c.json({ success: false, error: 'Database not connected' }, 500);
    }
    const payload = await c.req.json().catch(() => ({}));
    const email = String(payload.email || 'mandap.demo@gomandap.local').toLowerCase();
    let vendor = await Vendor.findOne({ email });
    if (vendor) {
      return c.json({ success: true, data: vendor });
    }
    const type = 'mandap';
    const count = await Vendor.countDocuments({ vendorType: type });
    const num = 101 + count;
    const prefix = 'gmmandap';
    const code = `${prefix}${num}`;
    const details = {
      minPrice: '150000',
      maxPrice: '500000',
      capacity: '800',
      selectedServices: ['Decor', 'Lighting', 'Stage Setup', 'Seating', 'Sound'],
      occasions: ['Wedding', 'Engagement', 'Reception', 'Sangeet', 'Haldi'],
      venueType: 'Indoor/Outdoor',
      airConditioning: 'Yes',
      seatingCapacity: '600',
      floatingCapacity: '1200',
      diningCapacity: '400',
      bridalSuite: 'Yes',
      guestRooms: '10',
      dormitory: 'Yes',
      roomAmenities: ['WiFi', 'TV', 'AC'],
      cateringPolicy: 'External allowed',
      foodType: 'Veg/Non-Veg',
      kitchenFacilities: ['Prep Area', 'Cold Storage'],
      parkingCar: '150',
      parkingBike: '300',
      valetParking: 'Available',
      powerBackup: 'Yes',
      electricityCharges: 'Included',
      lift: 'Yes',
      wheelchair: 'Yes',
      avEquipment: ['Projector', 'PA System'],
      safetyFeatures: ['Fire Extinguishers', 'Emergency Exits'],
      decorPolicy: 'In-house or external',
      havan: 'Allowed',
      firecrackers: 'Allowed within rules',
      lateNightMusic: 'Till 11 PM',
      overnightWedding: 'Allowed',
      alcoholPolicy: 'Allowed as per law',
      perPlateVeg: '400',
      perPlateNonVeg: '600',
      advancePayment: '20%',
      cancellationPolicy: 'Full refund upto 7 days',
      entertainmentName: 'Resident DJ',
      miscellaneous: ['Stage Carpets', 'Flower Backdrops']
    };
    vendor = await Vendor.create({
      fullName: payload.fullName || 'Demo Mandap',
      email,
      phone: payload.phone || '9876543210',
      businessName: payload.businessName || 'Royal Mandap & Events',
      vendorType: type,
      vendorCode: code,
      qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(`gomandap://vendor/${type}/${code}`)}`,
      addressLine1: payload.addressLine1 || '123 Wedding Street',
      addressLine2: payload.addressLine2 || 'Near City Hall',
      village: payload.village || 'Demo Village',
      mandal: payload.mandal || 'Central Zone',
      city: payload.city || 'Hyderabad',
      state: payload.state || 'Telangana',
      pincode: payload.pincode || '500001',
      mapsLink: payload.mapsLink || 'https://maps.app.goo.gl/demo',
      logo: payload.logo || '',
      description: payload.description || 'Premium mandap and venue services with full decor and amenities.',
      experience: payload.experience || '10',
      pricing: { range: '₹1.5L – ₹5L' },
      services: { core: ['Decor', 'Lighting', 'Stage', 'Seating', 'Sound'] },
      details,
      businessType: payload.businessType || 'Proprietorship',
      registrationState: payload.registrationState || 'Telangana',
      registrationNumber: payload.registrationNumber || 'TS-PR-123456',
      registrationDocUrl: payload.registrationDocUrl || '',
      bankAccountType: payload.bankAccountType || 'Current',
      bankName: payload.bankName || 'HDFC Bank',
      accountNumber: payload.accountNumber || '1234567890',
      ifscCode: payload.ifscCode || 'HDFC0001234',
      beneficiaryName: payload.beneficiaryName || 'Demo Mandap',
      panNumber: payload.panNumber || 'ABCDE1234F',
      gstNumber: payload.gstNumber || '29AAAAA0000A1Z5',
      upiId: payload.upiId || 'royalmandap@okhdfcbank',
      feeAccepted: true,
      onboardingStep: 4,
      onboardingCompleted: true,
    });
    return c.json({ success: true, data: vendor }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ success: false, error: 'Error seeding mandap vendor' }, 500);
  }
});

// Image Upload Route (Cloudinary)
app.post('/api/vendors/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['image'];

    if (file && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Try Cloudinary first
      try {
        const result: any = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'vendors', resource_type: 'auto' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(buffer);
        });
        return c.json({ success: true, data: { imageUrl: result.secure_url } });
      } catch (cloudError) {
        console.error('Cloudinary failed, falling back to local storage:', cloudError);

        // Fallback to Local Storage
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);

        const imageUrl = `${PUBLIC_BASE_URL}/uploads/${fileName}`;
        return c.json({ success: true, data: { imageUrl } });
      }
    }

    return c.json({ success: false, error: 'No image file provided' }, 400);
  } catch (error) {
    console.error('Upload Error:', error);
    return c.json({ success: false, error: 'Image upload failed' }, 500);
  }
});

// --- Chat / Support Ticket Routes ---

// Create a new ticket (Vendor)
app.post('/api/chat/start', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendorId = decoded.id;
    const { subject, initialMessage } = await c.req.json();

    const ticket = await Ticket.create({
      vendorId,
      subject: subject || 'New Support Request',
      messages: [{
        sender: 'vendor',
        text: initialMessage,
        timestamp: new Date()
      }]
    });

    // Bot Auto-reply
    let botResponse = await botService.processMessage(initialMessage);

    // Fallback to Ollama (DeepSeek) if NLP doesn't have an answer
    if (!botResponse) {
      try {
        botResponse = await aiService.chat(initialMessage);
      } catch (e) {
        console.error('AI Service Error:', e);
      }
    }

    if (botResponse) {
      ticket.messages.push({
        sender: 'bot',
        text: botResponse,
        timestamp: new Date()
      });
    } else {
      // Fallback generic message only if AI also fails
      ticket.messages.push({
        sender: 'bot',
        text: `Ticket #${ticket._id.toString().slice(-6)} created. I've notified our support team.`,
        timestamp: new Date()
      });
    }

    await ticket.save();

    return c.json({ success: true, data: ticket });
  } catch (err) {
    console.error('Create Ticket Error:', err);
    return c.json({ success: false, error: 'Failed to create ticket' }, 500);
  }
});

// Get Vendor Tickets
app.get('/api/chat/vendor', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendorId = decoded.id;

    const tickets = await Ticket.find({ vendorId }).sort({ lastMessageAt: -1 });
    return c.json({ success: true, data: tickets });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch tickets' }, 500);
  }
});

// Get Admin Tickets (All)
app.get('/api/chat/admin', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    // Verify admin token (assuming similar secret for simplicity, or check logic)
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    // Populate vendor details
    const tickets = await Ticket.find({})
      .populate('vendorId', 'businessName fullName email')
      .sort({ lastMessageAt: -1 });

    return c.json({ success: true, data: tickets });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch tickets' }, 500);
  }
});

// Get Single Ticket
app.get('/api/chat/:id', async (c) => {
  const ticketId = c.req.param('id');
  try {
    const ticket = await Ticket.findById(ticketId).populate('vendorId', 'businessName fullName');
    if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);
    return c.json({ success: true, data: ticket });
  } catch (err) {
    return c.json({ success: false, error: 'Error fetching ticket' }, 500);
  }
});

// Send Message (Vendor or Admin)
app.post('/api/chat/:id/message', async (c) => {
  const ticketId = c.req.param('id');
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const { text, sender } = await c.req.json(); // sender: 'vendor' or 'admin'
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);

    ticket.messages.push({
      sender,
      text,
      timestamp: new Date()
    });
    ticket.lastMessageAt = new Date();

    // If vendor replies, maybe reopen if resolved?
    if (sender === 'vendor' && ticket.status === 'resolved') {
      ticket.status = 'open';
    }

    // Auto-reply for vendor messages
    if (sender === 'vendor') {
      let botResponse = await botService.processMessage(text);

      if (!botResponse) {
        try {
          botResponse = await aiService.chat(text);
        } catch (e) {
          console.error('AI Chat Error:', e);
        }
      }

      if (botResponse) {
        ticket.messages.push({
          sender: 'bot',
          text: botResponse,
          timestamp: new Date()
        });
      }
    }

    await ticket.save();
    return c.json({ success: true, data: ticket });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to send message' }, 500);
  }
});

// Guest Chat Endpoint
app.post('/api/chat/guest', async (c) => {
  try {
    const { text } = await c.req.json();
    if (!text) return c.json({ success: false, error: 'Text required' }, 400);

    const botResponse = await botService.processMessage(text);
    return c.json({
      success: true,
      data: {
        response: botResponse || "I'm sorry, I couldn't understand that. Please sign up to talk to a human agent."
      }
    });
  } catch (err) {
    return c.json({ success: false, error: 'Guest chat failed' }, 500);
  }
});

// Update Ticket Status (Admin)
app.put('/api/chat/:id/status', async (c) => {
  const ticketId = c.req.param('id');
  try {
    const { status } = await c.req.json();
    const ticket = await Ticket.findByIdAndUpdate(ticketId, { status }, { new: true });
    return c.json({ success: true, data: ticket });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to update status' }, 500);
  }
});

// --- Settings Routes ---

app.get('/api/settings', async (c) => {
  try {
    let settings = await Settings.findOne({ type: 'general' });
    if (!settings) {
      settings = await Settings.create({ type: 'general' });
    }
    return c.json({ success: true, data: settings });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch settings' }, 500);
  }
});

app.put('/api/settings', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    const body = await c.req.json();
    let settings = await Settings.findOne({ type: 'general' });

    if (!settings) {
      settings = await Settings.create({
        type: 'general',
        supportEmail: body.supportEmail,
        supportPhone: body.supportPhone,
        supportWhatsapp: body.supportWhatsapp,
        growthFeeAmount: body.growthFeeAmount ?? 500,
        growthFeePeriod: body.growthFeePeriod ?? 'year'
      });
    } else {
      if (body.supportEmail !== undefined) settings.supportEmail = body.supportEmail;
      if (body.supportPhone !== undefined) settings.supportPhone = body.supportPhone;
      if (body.supportWhatsapp !== undefined) settings.supportWhatsapp = body.supportWhatsapp;
      if (body.growthFeeAmount !== undefined) settings.growthFeeAmount = body.growthFeeAmount;
      if (body.growthFeePeriod !== undefined) settings.growthFeePeriod = body.growthFeePeriod;
      await settings.save();
    }

    return c.json({ success: true, data: settings });
  } catch (err) {
    console.error('Update Settings Error:', err);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});


import { createWorker } from 'tesseract.js';
import { BotKnowledge } from './models/BotKnowledge.js';
import { aiService } from './services/AIService.js';

// --- Booking Routes ---

import { Booking } from './models/Booking.js';
import { Enquiry } from './models/Enquiry.js';

// Create Booking (Client)
app.post('/api/bookings', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const clientId = decoded.id;

    const { vendorId, eventDate, eventType, guestCount, message } = await c.req.json();

    if (!vendorId || !eventDate || !eventType) {
      return c.json({ success: false, error: 'Vendor, Event Date, and Event Type are required.' }, 400);
    }

    // Verify vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return c.json({ success: false, error: 'Selected vendor not found.' }, 404);
    }

    const booking = await Booking.create({
      clientId,
      vendorId,
      eventDate,
      eventType,
      guestCount,
      message,
      status: 'pending'
    });

    // Optional: Send notification to Vendor here

    return c.json({ success: true, data: booking });
  } catch (err) {
    console.error('Create Booking Error:', err);
    return c.json({ success: false, error: 'Failed to create booking' }, 500);
  }
});

// Get All Bookings (Admin)
app.get('/api/admin/bookings', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    const bookings = await Booking.find()
      .populate('clientId', 'displayName email')
      .populate('vendorId', 'businessName vendorType')
      .sort({ createdAt: -1 });

    return c.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch bookings' }, 500);
  }
});

// Get Vendor Bookings
app.get('/api/vendor/bookings', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const vendorId = decoded.id;

    const bookings = await Booking.find({ vendorId })
      .populate('clientId', 'displayName email phone')
      .sort({ createdAt: -1 });

    return c.json({ success: true, data: bookings });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch bookings' }, 500);
  }
});

// Get Client Bookings
app.get('/api/client/bookings', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
    const clientId = decoded.id;

    const bookings = await Booking.find({ clientId })
      .populate('vendorId', 'businessName logo city')
      .sort({ createdAt: -1 });

    return c.json({ success: true, data: bookings });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch bookings' }, 500);
  }
});


// --------------------------------------------------------------------------
// Custom Enquiry Routes
// --------------------------------------------------------------------------

// Create Custom Enquiry
app.post('/api/enquiries', async (c) => {
  try {
    const body = await c.req.json();
    const { name, phone, email, location, eventType, eventDate, guestCount, budget, services, message, clientId, vendorId, source } = body;

    // Basic Validation
    if (!name || !phone) {
      return c.json({ success: false, error: "Name and Phone are required." }, 400);
    }

    const newEnquiry = new Enquiry({
      clientId: clientId || undefined,
      vendorId: vendorId || undefined, // Link to specific vendor if provided
      name,
      phone,
      email,
      location,
      eventType,
      eventDate,
      guestCount,
      budget,
      services,
      message,
      source: source || 'website',
      status: 'new'
    });

    await newEnquiry.save();

    return c.json({ success: true, data: newEnquiry });
  } catch (err: any) {
    console.error("Enquiry Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Get Admin Enquiries
app.get('/api/admin/enquiries', async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ success: false, error: "Unauthorized" }, 401);

    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    return c.json({ success: true, data: enquiries });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


// --- Bot Training & OCR Routes ---

// Get Training Data
app.get('/api/admin/bot/knowledge', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);
  try {
    const audience = c.req.query('audience');
    const query: any = {};
    if (audience && audience !== 'all') {
      query.targetAudience = audience;
    }
    const knowledge = await BotKnowledge.find(query).sort({ createdAt: -1 });
    return c.json({ success: true, data: knowledge });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch knowledge' }, 500);
  }
});

// Add Text Training Data
app.post('/api/admin/bot/train', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const { question, answer, targetAudience } = await c.req.json();
    if (!question || !answer) return c.json({ success: false, error: 'Question and answer required' }, 400);

    const newItem = await botService.addKnowledge(question, answer, targetAudience || 'general');

    // Trigger retrain (async)
    botService.retrain();

    return c.json({ success: true, data: newItem });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to add training data' }, 500);
  }
});

// Delete Knowledge Item
app.delete('/api/admin/bot/knowledge/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const id = c.req.param('id');

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    await BotKnowledge.findByIdAndDelete(id);
    // Trigger retrain
    botService.retrain();
    return c.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete knowledge' }, 500);
  }
});

// OCR Route (Image -> Text)
app.post('/api/admin/bot/ocr', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const body = await c.req.parseBody();
    const file = body['image'];

    if (file && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const worker = await createWorker('eng');
      const ret = await worker.recognize(buffer);
      const text = ret.data.text;
      await worker.terminate();

      return c.json({ success: true, data: { text } });
    }
    return c.json({ success: false, error: 'No image provided' }, 400);
  } catch (err) {
    console.error('OCR Error:', err);
    return c.json({ success: false, error: 'OCR processing failed' }, 500);
  }
});

// --- Advanced AI Routes ---

app.post('/api/admin/ai/ingest/pdf', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (file && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const kb = await aiService.ingestPDF(buffer, file.name);
      return c.json({ success: true, data: kb });
    }
    return c.json({ success: false, error: 'No file provided' }, 400);
  } catch (err) {
    console.error('PDF Ingest Error:', err);
    return c.json({ success: false, error: 'Failed to ingest PDF' }, 500);
  }
});

app.post('/api/admin/ai/ingest/web', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const { url } = await c.req.json();
    if (!url) return c.json({ success: false, error: 'URL required' }, 400);

    const kb = await aiService.ingestWeb(url);
    return c.json({ success: true, data: kb });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to ingest Web' }, 500);
  }
});

app.post('/api/admin/ai/chat', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ success: false, error: 'Query required' }, 400);

    const response = await aiService.chat(query);
    return c.json({ success: true, data: { response } });
  } catch (err) {
    return c.json({ success: false, error: 'AI Chat failed' }, 500);
  }
});

// Update Vendor Status (Admin)
app.put('/api/admin/vendors/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);

  const vendorId = c.req.param('id');
  const body = await c.req.json();

  try {
    const token = authHeader.split(' ')[1];
    await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return c.json({ success: false, error: 'Vendor not found' }, 404);

    if (typeof body.isVerified !== 'undefined') vendor.isVerified = body.isVerified;
    if (typeof body.onboardingCompleted !== 'undefined') vendor.onboardingCompleted = body.onboardingCompleted;
    if (typeof body.onboardingStep !== 'undefined') vendor.onboardingStep = body.onboardingStep;
    if (typeof body.priority !== 'undefined') vendor.priority = body.priority;
    if (typeof body.phone !== 'undefined') vendor.phone = body.phone;
    if (typeof body.additionalPhones !== 'undefined') vendor.additionalPhones = body.additionalPhones;
    if (typeof body.whatsappNumber !== 'undefined') vendor.whatsappNumber = body.whatsappNumber;

    await vendor.save();

    // If "sent back" (onboardingCompleted set to false), try to send a notification
    if (body.onboardingCompleted === false && body.reason) {
      await Notification.create({
        recipientType: 'specific',
        recipientId: vendorId,
        recipientVendorType: vendor.vendorType,
        title: 'Onboarding Update',
        message: `Action Required: ${body.reason}`,
        type: 'alert'
      });
    }

    return c.json({ success: true, data: vendor });
  } catch (err) {
    console.error('Update Vendor Error:', err);
    return c.json({ success: false, error: 'Failed to update vendor' }, 500);
  }
});

const port = Number(process.env.PORT || 5000);
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
