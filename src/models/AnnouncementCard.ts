import mongoose from 'mongoose';

const AnnouncementCardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        required: true,
        maxlength: 500,
    },
    imageUrl: {
        type: String,
        default: '',
    },
    linkUrl: {
        type: String,
        default: '',
    },
    linkText: {
        type: String,
        default: 'Learn More',
    },
    displayOrder: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    startDate: {
        type: Date,
        default: null,
    },
    endDate: {
        type: Date,
        default: null,
    },
    backgroundColor: {
        type: String,
        default: '#1a237e',
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

// Update timestamp before saving
AnnouncementCardSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export const AnnouncementCard = mongoose.model('AnnouncementCard', AnnouncementCardSchema);
