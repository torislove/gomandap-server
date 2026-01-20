const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  // Personal & Business Basics
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  businessName: { type: String, required: true },
  vendorType: { type: String, required: true },
  
  // Location
  addressLine1: { type: String },
  addressLine2: { type: String },
  village: { type: String },
  mandal: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  mapsLink: { type: String },
  
  // Business Details
  experience: { type: String },
  description: { type: String },
  logo: { type: String }, // URL to storage
  photos: [{ type: String }], // Array of URLs
  
  // Pricing & Services (Flexible based on vendor type)
  pricing: { type: mongoose.Schema.Types.Mixed },
  services: { type: mongoose.Schema.Types.Mixed },
  details: { type: mongoose.Schema.Types.Mixed }, // Catch-all for type-specific details
  
  // Banking & Legal
  businessType: { type: String },
  registrationState: { type: String },
  registrationNumber: { type: String },
  registrationDoc: { type: String }, // URL to document
  bankName: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  beneficiaryName: { type: String },
  panNumber: { type: String },
  gstNumber: { type: String },
  upiId: { type: String },
  
  // Platform Status
  isVerified: { type: Boolean, default: false },
  onboardingStep: { type: Number, default: 1 },
  onboardingCompleted: { type: Boolean, default: false },
  feeAccepted: { type: Boolean, default: false },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vendor', vendorSchema);
