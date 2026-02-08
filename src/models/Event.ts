import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String, // Wedding, Reception, Sangeet, Birthday, etc.
        required: true
    },
    dates: [{
        type: Date
    }],
    location: {
        city: String,
        state: String
    },
    budget: {
        min: Number,
        max: Number
    },
    guestCount: Number,

    // Vendors associated with this event
    shortlistedVendors: [{
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        category: String,
        notes: String,
        addedAt: { type: Date, default: Date.now }
    }],

    bookedVendors: [{
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        bookingId: String, // Ref to Booking model
        status: String
    }],

    status: {
        type: String,
        enum: ['planning', 'booked', 'completed', 'cancelled'],
        default: 'planning'
    }
}, { timestamps: true });

export const Event = mongoose.model('Event', EventSchema);
