import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorPackage extends Document {
    vendorId: mongoose.Types.ObjectId;
    packageName: string;
    description: string;
    price: number;
    currency: string;
    duration?: string;
    services: string[];
    features: string[];
    isActive: boolean;
    maxBookings?: number;
    createdAt: Date;
    updatedAt: Date;
}

const VendorPackageSchema = new Schema<IVendorPackage>({
    vendorId: {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true,
    },
    packageName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'INR',
        enum: ['INR', 'USD'],
    },
    duration: {
        type: String,
        trim: true,
    },
    services: [{
        type: String,
        trim: true,
    }],
    features: [{
        type: String,
        trim: true,
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
    maxBookings: {
        type: Number,
        min: 0,
    },
}, {
    timestamps: true,
});

// Indexes
VendorPackageSchema.index({ vendorId: 1, isActive: 1 });
VendorPackageSchema.index({ price: 1 });

export const VendorPackage = mongoose.model<IVendorPackage>('VendorPackage', VendorPackageSchema);
