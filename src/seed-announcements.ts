import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AnnouncementCard } from './models/AnnouncementCard.js';

dotenv.config();

const seedCards = [
    {
        title: '🎉 Grand Opening Sale!',
        description: 'Book your wedding venue this month and get 20% off on all packages! Limited time offer.',
        imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
        linkUrl: '/search?category=venue',
        linkText: 'Explore Venues',
        backgroundColor: '#6366f1',
        displayOrder: 0,
        isActive: true,
    },
    {
        title: '📸 Premium Photography Packages',
        description: 'Capture your special moments with our award-winning photographers. Now with free pre-wedding shoot!',
        imageUrl: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=800&q=80',
        linkUrl: '/search?category=photography',
        linkText: 'View Photographers',
        backgroundColor: '#ec4899',
        displayOrder: 1,
        isActive: true,
    },
    {
        title: '🍽️ Exquisite Catering Services',
        description: 'Multi-cuisine wedding catering with live counters. Special packages starting from ₹500 per plate.',
        imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
        linkUrl: '/search?category=catering',
        linkText: 'Explore Caterers',
        backgroundColor: '#f97316',
        displayOrder: 2,
        isActive: true,
    },
    {
        title: '🎨 Stunning Decor Themes',
        description: 'Transform your venue with breathtaking decor. From royal to modern themes, we have it all!',
        imageUrl: 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=800&q=80',
        linkUrl: '/search?category=decor',
        linkText: 'View Decor Options',
        backgroundColor: '#10b981',
        displayOrder: 3,
        isActive: true,
    },
    {
        title: '🎵 Live Entertainment',
        description: 'Make your celebration unforgettable with DJs, live bands, and traditional performers!',
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
        linkUrl: '/search?category=entertainment',
        linkText: 'Book Entertainment',
        backgroundColor: '#ef4444',
        displayOrder: 4,
        isActive: true,
    },
];

async function seedAnnouncementCards() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap');
        console.log('Connected to MongoDB');

        // Clear existing cards
        await AnnouncementCard.deleteMany({});
        console.log('Cleared existing announcement cards');

        // Insert seed data
        await AnnouncementCard.insertMany(seedCards);
        console.log(`✅ Seeded ${seedCards.length} announcement cards`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding announcement cards:', error);
        process.exit(1);
    }
}

seedAnnouncementCards();
