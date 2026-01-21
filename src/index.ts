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

app.use('/*', cors());
app.use('/uploads/*', serveStatic({ root: './' }));

// Admin Routes
app.post('/api/admin/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ success: false, error: 'Please provide username and password' }, 400);
  }

  const admin = await Admin.findOne({ username });

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

// Vendor Routes
app.post('/api/vendors/signup', async (c) => {
  const { fullName, email, password, phone, businessName, vendorType } = await c.req.json();

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
        supportWhatsapp: body.supportWhatsapp
      });
    } else {
      settings.supportEmail = body.supportEmail;
      settings.supportPhone = body.supportPhone;
      settings.supportWhatsapp = body.supportWhatsapp;
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

// --- Bot Training & OCR Routes ---

// Get Training Data
app.get('/api/admin/bot/knowledge', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, error: 'No token provided' }, 401);
  try {
    const knowledge = await BotKnowledge.find().sort({ createdAt: -1 });
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
    const { question, answer } = await c.req.json();
    if (!question || !answer) return c.json({ success: false, error: 'Question and answer required' }, 400);

    const newItem = await botService.addKnowledge(question, answer);
    
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

const port = Number(process.env.PORT || 5000);
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
