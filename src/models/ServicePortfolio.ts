import mongoose from 'mongoose';

export interface IServicePortfolio extends mongoose.Document {
    vendorId: mongoose.Types.ObjectId;
    category: string; // wedding, corporate, birthday, etc.
    serviceType: string; // buffet, plated, cocktail (for catering)
    title: string;
    description: string;
    images: {
        _id?: mongoose.Types.ObjectId;
        url: string;
        publicId: string; // Cloudinary public ID for deletion
        caption?: string;
        isPrimary: boolean;
        uploadedAt: Date;
    }[];
    pricing: {
        basePrice: number;
        pricingModel: 'per-plate' | 'per-hour' | 'per-event' | 'per-person' | 'fixed';
        minQuantity?: number;
        maxQuantity?: number;
        additionalCharges?: {
            name: string;
            amount: number;
            type: 'fixed' | 'percentage';
        }[];
    };
    features: string[];
    specifications?: {
        name: string;
        value: string;
    }[];
    isActive: boolean;
    displayOrder: number;
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const ServicePortfolioSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true,
    },
    category: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    serviceType: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    images: [{
        url: {
            type: String,
            required: true,
        },
        publicId: {
            type: String,
            required: true,
        },
        caption: String,
        isPrimary: {
            type: Boolean,
            default: false,
        },
        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    }],
    pricing: {
        basePrice: {
            type: Number,
            required: true,
            min: 0,
        },
        pricingModel: {
            type: String,
            enum: ['per-plate', 'per-hour', 'per-event', 'per-person', 'fixed'],
            required: true,
        },
        minQuantity: Number,
        maxQuantity: Number,
        additionalCharges: [{
            name: String,
            amount: Number,
            type: {
                type: String,
                enum: ['fixed', 'percentage'],
            },
        }],
    },
    features: [{
        type: String,
    }],
    specifications: [{
        name: String,
        value: String,
    }],
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    displayOrder: {
        type: Number,
        default: 0,
    },
    viewCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Compound index for efficient queries
ServicePortfolioSchema.index({ vendorId: 1, category: 1, isActive: 1 });
ServicePortfolioSchema.index({ vendorId: 1, displayOrder: 1 });

export const ServicePortfolio = mongoose.model<IServicePortfolio>(
    'ServicePortfolio',
    ServicePortfolioSchema
);
