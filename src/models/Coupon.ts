import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema({
    // Identification
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String },

    // Scope
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }, // If null, it's a platform-wide coupon
    applicableCategories: [{ type: String }], // e.g. ['venue', 'photography']

    // Discount Logic
    discountType: { type: String, enum: ['PERCENTAGE', 'FLAT'], required: true },
    discountAmount: { type: Number, required: true }, // % value or Flat Amount
    maxDiscount: { type: Number }, // Cap for percentage based discounts
    minOrderValue: { type: Number, default: 0 },

    // Validity
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date },
    usageLimit: { type: Number }, // Total times this coupon can be used
    usagePerUser: { type: Number, default: 1 },

    isActive: { type: Boolean, default: true },

    // Tracking
    usageCount: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now }
});

export const Coupon = mongoose.model('Coupon', CouponSchema);
