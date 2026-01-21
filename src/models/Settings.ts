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
  }
}, {
  timestamps: true
});

export const Settings = mongoose.model('Settings', SettingsSchema);
