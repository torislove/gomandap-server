import mongoose from 'mongoose';

const ThemeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: false },

    // Core Colors
    colors: {
        primary: { type: String, default: '#1a237e' },
        secondary: { type: String, default: '#D4AF37' },
        accent: { type: String, default: '#ff6f00' },
        background: { type: String, default: '#060412' }
    },

    // Background Engine Config
    backgroundConfig: {
        type: {
            type: String,
            enum: ['royal', 'festive', 'nature', 'minimal'],
            default: 'royal'
        },
        intensity: { type: Number, default: 0.5 },
        speed: { type: Number, default: 1 }
    },

    // Theme Specific UI Tweaks
    uiConfig: {
        borderRadius: { type: String, default: '1rem' },
        glassIntensity: { type: Number, default: 0.5 },
        fontFamily: { type: String, default: 'Inter' }
    },

    createdAt: { type: Date, default: Date.now }
});

// Ensure only one theme is active at a time
ThemeSchema.pre('save', async function (next) {
    if (this.isActive) {
        await mongoose.model('Theme').updateMany({ _id: { $ne: this._id } }, { isActive: false });
    }
    next();
});

export const Theme = mongoose.model('Theme', ThemeSchema);
