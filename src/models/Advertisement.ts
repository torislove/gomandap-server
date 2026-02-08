import mongoose from 'mongoose';

const AdvertisementSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },

    // Slot Configuration
    slotType: {
        type: String,
        enum: ['HOME_BANNER', 'SEARCH_TOP', 'CATEGORY_FEATURED', 'SIDEBAR'],
        required: true
    },

    // Display Content
    title: { type: String }, // Optional custom title
    imageUrl: { type: String }, // Optional custom banner
    targetLink: { type: String }, // Internal deep link or vendor profile

    // Duration & Scheduling
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    durationDays: { type: Number, required: true },

    // Financials
    pricePaid: { type: Number, required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },

    // Status
    status: {
        type: String,
        enum: ['PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED'],
        default: 'PENDING_APPROVAL'
    },

    // Analytics
    stats: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 }
    },

    createdAt: { type: Date, default: Date.now }
});

AdvertisementSchema.index({ status: 1, startDate: 1, endDate: 1 });

export const Advertisement = mongoose.model('Advertisement', AdvertisementSchema);
