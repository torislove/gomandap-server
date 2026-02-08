import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
    bookingId: string;
    clientId: mongoose.Types.ObjectId;
    vendorId: mongoose.Types.ObjectId;

    // Multi-Service Selection
    selectedServices: {
        portfolioItemId?: mongoose.Types.ObjectId;
        packageId?: mongoose.Types.ObjectId; // Legacy support
        serviceName: string;
        category: string;
        serviceType: string;
        quantity?: number;
        basePrice: number;
        finalPrice: number;
        customizations?: {
            name: string;
            value: string;
            additionalCost?: number;
        }[];
    }[];

    // Enhanced Event Details
    eventDetails: {
        eventDate: Date;
        eventType: string;
        eventLocation: string;
        venueType?: string;
        startTime?: string;
        endTime?: string;
        duration?: number;
        guestCount: number;
        dietaryRestrictions?: string[];
        specialRequests?: string;
        setupRequirements?: string;
    };

    // Enhanced Pricing
    pricing: {
        subtotal: number;
        taxAmount: number;
        platformFee: number;
        discountAmount: number;
        totalAmount: number;
        advancePayment: number;
        balancePayment: number;
        totalPaid: number;
    };

    // Status & Workflow
    status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
    paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';

    // Metadata
    createdBy: 'client' | 'admin' | 'vendor';
    timeline: {
        createdAt: Date;
        confirmedAt?: Date;
        vendorAcceptedAt?: Date;
        paymentReceivedAt?: Date;
        completedAt?: Date;
        cancelledAt?: Date;
    };
    cancelReason?: string;
    adminNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
    bookingId: {
        type: String,
        unique: true,
        index: true,
    },
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
        index: true,
    },
    vendorId: {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true,
    },

    // New Service Structure
    selectedServices: [{
        portfolioItemId: { type: Schema.Types.ObjectId, ref: 'ServicePortfolio' },
        packageId: { type: Schema.Types.ObjectId, ref: 'VendorPackage' },
        serviceName: String,
        category: String,
        serviceType: String,
        quantity: Number,
        basePrice: Number,
        finalPrice: Number,
        customizations: [{
            name: String,
            value: String,
            additionalCost: Number
        }]
    }],

    // Event Details
    eventDetails: {
        eventDate: { type: Date, required: true },
        eventType: { type: String, required: true },
        eventLocation: { type: String, required: true },
        venueType: String,
        startTime: String,
        endTime: String,
        duration: Number,
        guestCount: { type: Number, required: true },
        dietaryRestrictions: [String],
        specialRequests: String,
        setupRequirements: String
    },

    // Pricing
    pricing: {
        subtotal: { type: Number, required: true },
        taxAmount: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true },
        advancePayment: { type: Number, required: true },
        balancePayment: { type: Number, required: true },
        totalPaid: { type: Number, default: 0 }
    },

    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'partial', 'paid', 'refunded'],
        default: 'unpaid'
    },

    createdBy: {
        type: String,
        enum: ['client', 'admin', 'vendor'],
        default: 'client'
    },

    timeline: {
        createdAt: { type: Date, default: Date.now },
        confirmedAt: Date,
        vendorAcceptedAt: Date,
        paymentReceivedAt: Date,
        completedAt: Date,
        cancelledAt: Date
    },

    cancelReason: String,
    adminNotes: String
}, {
    timestamps: true
});

// Indexes for common queries
BookingSchema.index({ 'eventDetails.eventDate': 1 });
BookingSchema.index({ vendorId: 1, status: 1 });
BookingSchema.index({ clientId: 1, status: 1 });

// Generate Booking ID
BookingSchema.pre('save', async function (next) {
    if (!this.bookingId) {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        this.bookingId = `BK${year}${month}${random}`;
    }
    next();
});

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
