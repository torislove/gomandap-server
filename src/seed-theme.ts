import mongoose from 'mongoose';
import { Theme } from './models/Theme.js';
import { PromoBanner } from './models/PromoBanner.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap';

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        // 1. Seed Default "Modern Royal" Theme
        await Theme.deleteMany({ name: 'Modern Royal' });
        const royalTheme = new Theme({
            name: 'Modern Royal',
            isActive: true,
            colors: {
                primary: '#1a237e',
                secondary: '#D4AF37',
                accent: '#ff6f00',
                background: '#060412'
            },
            backgroundConfig: {
                type: 'royal',
                intensity: 0.6,
                speed: 1.2
            },
            uiConfig: {
                borderRadius: '1.25rem',
                glassIntensity: 0.4,
                fontFamily: 'Inter'
            }
        });
        await royalTheme.save();
        console.log('✅ Modern Royal Theme seeded.');

        // 2. Seed Initial Promo Banners
        await PromoBanner.deleteMany({});
        const promos = [
            {
                title: 'GoMandap Elite',
                subtitle: 'Book Your Dream Venue with 20% OFF',
                imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=1200',
                targetLink: '/search?category=venue',
                order: 1,
                designConfig: {
                    bgColor: '#1a237e',
                    accentColor: '#D4AF37'
                }
            },
            {
                title: 'Royal Catering',
                subtitle: 'Gourmet Flavors for Your Big Day',
                imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=1200',
                targetLink: '/search?category=catering',
                order: 2,
                designConfig: {
                    bgColor: '#4a148c',
                    accentColor: '#ff6f00'
                }
            },
            {
                title: 'Magic Studios',
                subtitle: 'Capture Every Royal Moment',
                imageUrl: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&q=80&w=1200',
                targetLink: '/search?category=photography',
                order: 3,
                designConfig: {
                    bgColor: '#0A041A',
                    accentColor: '#D4AF37'
                }
            }
        ];
        await PromoBanner.insertMany(promos);
        console.log('✅ Promo Banners seeded.');

        console.log('Seed complete! 🚀');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
