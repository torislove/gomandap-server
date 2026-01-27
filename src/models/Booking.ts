import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },
    eventDate: {
        type: Date,
        required: true
    },
    eventType: {
        type: String,
        required: true
    },
    guestCount: {
        type: Number
    },
    message: {
        type: String
    },
    totalAmount: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export const Booking = mongoose.model('Booking', BookingSchema);
