import mongoose from 'mongoose';

const PromoBannerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subtitle: { type: String },
    imageUrl: { type: String, required: true },
    targetLink: { type: String },

    // Styling overrides from Admin
    designConfig: {
        bgColor: { type: String, default: '#1a237e' },
        textColor: { type: String, default: '#ffffff' },
        accentColor: { type: String, default: '#D4AF37' },
        fontFamily: { type: String, default: 'serif' }
    },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // Performance Tracking
    stats: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 }
    },

    createdAt: { type: Date, default: Date.now }
});

export const PromoBanner = mongoose.model('PromoBanner', PromoBannerSchema);
