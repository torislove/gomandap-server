import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for Google Auth users
  googleId: { type: String }, // For Google Sign-In
  phone: { type: String }, // Primary Phone
  additionalPhones: [{ type: String }], // Multiple mobile numbers
  whatsappNumber: { type: String }, // WhatsApp Number
  businessName: { type: String }, // Can be optional initially
  vendorType: { type: String }, // Can be optional initially
  vendorCode: { type: String, unique: true, sparse: true },
  qrCodeUrl: { type: String },

  // Address Fields
  addressLine1: { type: String },
  addressLine2: { type: String },
  village: { type: String },
  mandal: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  mapsLink: { type: String },
  coordinates: {
    lat: { type: Number },
    lon: { type: Number }
  },

  // Media
  logo: { type: String }, // Stores Cloudinary URL
  gallery: [{ type: String }], // Array of Cloudinary URLs

  // Business Details
  description: { type: String },
  experience: { type: String },
  pricing: { type: Object, default: {} },
  services: { type: Object, default: {} },
  details: { type: Object, default: {} }, // Flexible field for vendor-specific details

  // Banking & Legal
  businessType: { type: String },
  registrationState: { type: String },
  registrationNumber: { type: String },
  registrationDocUrl: { type: String },
  bankAccountType: { type: String },
  bankName: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  beneficiaryName: { type: String },
  panNumber: { type: String },
  gstNumber: { type: String },
  upiId: { type: String },
  feeAccepted: { type: Boolean, default: false },

  // Search Optimization
  minPrice: { type: Number, index: true },
  maxPrice: { type: Number, index: true },

  // Advanced Features
  promoVideoUrl: { type: String },
  stats: {
    views: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }, // Added rating field
    bookingsLast30d: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 } // in minutes
  },

  // Monetization & Growth
  isSponsored: { type: Boolean, default: false, index: true }, // Top slot priority
  promotedUntil: { type: Date }, // Expiry for sponsorship
  subscriptionPlan: { type: String, enum: ['free', 'gold', 'platinum'], default: 'free' },
  storyUrl: { type: String }, // 24h Story URL
  storyExpiresAt: { type: Date },

  // Onboarding Status
  onboardingStep: { type: Number, default: 1 },
  onboardingCompleted: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  priority: { type: Number, default: 0 }, // Admin priority score (higher = top of list)
  fcmTokens: [{ type: String }], // For Push Notifications

  createdAt: { type: Date, default: Date.now }
});

export const Vendor = mongoose.model('Vendor', VendorSchema);
