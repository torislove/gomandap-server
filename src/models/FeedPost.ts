import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, refPath: 'userModel', required: true },
    userModel: { type: String, enum: ['Client', 'Vendor'], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const FeedPostSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, refPath: 'authorModel', required: true },
    authorModel: { type: String, enum: ['Client', 'Vendor'], required: true },

    type: { type: String, enum: ['image', 'video'], default: 'image' },
    mediaUrl: { type: String, required: true },
    caption: { type: String },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'flagged'],
        default: 'pending'
    },

    moderationNotes: { type: String },
    flaggedFor: { type: String }, // e.g., 'sharing_contact_info'

    likes: [{
        userId: { type: mongoose.Schema.Types.ObjectId },
        userType: { type: String, enum: ['Client', 'Vendor'] }
    }],

    comments: [CommentSchema],

    stats: {
        views: { type: Number, default: 0 },
        shares: { type: Number, default: 0 }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexing for faster feed loading
FeedPostSchema.index({ status: 1, createdAt: -1 });

export const FeedPost = mongoose.model('FeedPost', FeedPostSchema);
