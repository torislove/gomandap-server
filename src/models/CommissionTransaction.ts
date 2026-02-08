import mongoose, { Schema, Document } from 'mongoose';

export interface ICommissionTransaction extends Document {
    bookingId: mongoose.Types.ObjectId;
    vendorId: mongoose.Types.ObjectId;
    clientId: mongoose.Types.ObjectId;

    // Financial breakdown
    totalAmount: number;
    platformCommission: number;
    platformCommissionRate: number; // Percentage (e.g., 15)
    vendorPayout: number;

    // Status tracking
    status: 'pending' | 'settled' | 'refunded' | 'disputed';
    adminPayoutStatus: 'pending' | 'settled' | 'withdrawn';
    vendorPayoutStatus: 'pending' | 'escrowed' | 'released' | 'held';

    // Timestamps
    createdAt: Date;
    settledAt?: Date;
    adminWithdrawnAt?: Date;
    vendorReleasedAt?: Date;

    // Payment gateway references
    paymentGatewayTxnId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;

    // Dispute handling
    disputeRaised: boolean;
    disputeReason?: string;
    disputeResolvedAt?: Date;

    // Notes
    adminNotes?: string;
}

const CommissionTransactionSchema = new Schema<ICommissionTransaction>({
    bookingId: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true
    },
    vendorId: {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true
    },
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },

    totalAmount: { type: Number, required: true },
    platformCommission: { type: Number, required: true },
    platformCommissionRate: { type: Number, required: true, default: 15 },
    vendorPayout: { type: Number, required: true },

    status: {
        type: String,
        enum: ['pending', 'settled', 'refunded', 'disputed'],
        default: 'pending',
        index: true
    },
    adminPayoutStatus: {
        type: String,
        enum: ['pending', 'settled', 'withdrawn'],
        default: 'pending'
    },
    vendorPayoutStatus: {
        type: String,
        enum: ['pending', 'escrowed', 'released', 'held'],
        default: 'pending'
    },

    settledAt: { type: Date },
    adminWithdrawnAt: { type: Date },
    vendorReleasedAt: { type: Date },

    paymentGatewayTxnId: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },

    disputeRaised: { type: Boolean, default: false },
    disputeReason: { type: String },
    disputeResolvedAt: { type: Date },

    adminNotes: { type: String }
}, {
    timestamps: true
});

// Indexes for performance
CommissionTransactionSchema.index({ createdAt: -1 });
CommissionTransactionSchema.index({ status: 1, adminPayoutStatus: 1 });

export default mongoose.model<ICommissionTransaction>('CommissionTransaction', CommissionTransactionSchema);
