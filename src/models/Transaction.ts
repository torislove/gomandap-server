import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    // Parties
    userId: { type: mongoose.Schema.Types.ObjectId, refPath: 'userType', required: true },
    userType: { type: String, enum: ['Client', 'Vendor', 'Admin'], required: true },

    // Context
    type: {
        type: String,
        enum: ['AD_PURCHASE', 'COMMISSION', 'REFUND', 'SUBSCRIPTION', 'VERIFICATION_FEE'],
        required: true
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId }, // e.g. AdvertisementId or BookingId
    referenceModel: { type: String }, // e.g. 'Advertisement'

    // Payment Details
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentGateway: { type: String, default: 'RAZORPAY' }, // or CASH_FREE, STRIPE
    gatewayTransactionId: { type: String }, // Payment Intent ID

    // Status
    status: {
        type: String,
        enum: ['INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED'],
        default: 'INITIATED'
    },

    metadata: { type: Object }, // Any extra gateway response data

    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
});

export const Transaction = mongoose.model('Transaction', TransactionSchema);
