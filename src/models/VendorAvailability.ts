import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorAvailability extends Document {
    vendorId: mongoose.Types.ObjectId;
    date: Date;
    status: 'available' | 'pending' | 'booked';
    note?: string;
    createdAt: Date;
    updatedAt: Date;
}

const VendorAvailabilitySchema = new Schema<IVendorAvailability>({
    vendorId: {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['available', 'pending', 'booked'],
        required: true
    },
    note: { type: String }
}, {
    timestamps: true
});

// Ensure unique status per vendor per date
VendorAvailabilitySchema.index({ vendorId: 1, date: 1 }, { unique: true });

export default mongoose.model<IVendorAvailability>('VendorAvailability', VendorAvailabilitySchema);
