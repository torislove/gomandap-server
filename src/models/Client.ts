import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
    firebaseUid: { type: String, unique: true, sparse: true }, // Sparse index allows null/undefined to be non-unique (multple nulls)
    password: { type: String }, // For traditional auth
    email: { type: String, required: true, unique: true },
    displayName: { type: String },
    photoURL: { type: String },

    // Activity Tracking
    lastLogin: { type: Date, default: Date.now },
    lastLoginIp: { type: String },
    lastLocation: {
        city: { type: String },
        country: { type: String },
        lat: { type: Number },
        lon: { type: Number }
    },

    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: { type: String },
        userAgent: { type: String }
    }],

    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
    fcmTokens: [{ type: String }], // For Push Notifications
    createdAt: { type: Date, default: Date.now }
});

export const Client = mongoose.model('Client', ClientSchema);
