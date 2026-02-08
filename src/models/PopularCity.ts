import mongoose from 'mongoose';

const PopularCitySchema = new mongoose.Schema({
    city: {
        type: String,
        required: true,
        trim: true,
    },
    displayOrder: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the updatedAt timestamp before saving
PopularCitySchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export const PopularCity = mongoose.model('PopularCity', PopularCitySchema);
