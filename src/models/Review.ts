import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }, // Optional, verified stay

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    photos: [{ type: String }], // Cloudinary URLs

    vendorReply: {
        comment: { type: String },
        createdAt: { type: Date }
    },

    isVerifiedPurchase: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },

    likes: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ReviewSchema.index({ vendorId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', ReviewSchema);
