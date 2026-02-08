import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  type: {
    type: String,
    default: 'general',
    unique: true
  },
  supportEmail: {
    type: String,
    default: 'support@gomandap.com'
  },
  supportPhone: {
    type: String,
    default: '+91 98765 43210'
  },
  supportWhatsapp: {
    type: String,
    default: '+91 98765 43210'
  },
  // Growth Support Fee Configuration
  growthFeeAmount: {
    type: Number,
    default: 500,
    min: 0
  },
  growthFeePeriod: {
    type: String,
    enum: ['month', 'year'],
    default: 'year'
  },

  // Card Customization (Theme Engine)
  cardTheme: {
    style: { type: String, default: 'glass' }, // glass, minimal, bold
    primaryColor: { type: String, default: '#D4AF37' },
    borderRadius: { type: String, default: 'lg' }, // sm, md, lg, full
    showPrice: { type: Boolean, default: true },
    showBadge: { type: Boolean, default: true }
  },

  // City Management (Quick Commerce)
  cities: [{
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String }, // Cloudinary URL
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isPopular: { type: Boolean, default: false }
  }]
}, {
  timestamps: true
});

export const Settings = mongoose.model('Settings', SettingsSchema);
