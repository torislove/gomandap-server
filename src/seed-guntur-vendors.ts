import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Vendor } from './models/Vendor.js';

dotenv.config();

const gunturVendors = [
    {
        // 1. Premium Venue
        fullName: 'Rajesh Kumar',
        email: 'rajesh@royalgunturpalace.com',
        password: 'vendor123',
        phone: '+919876543210',
        whatsappNumber: '+919876543210',
        businessName: 'Royal Guntur Palace',
        vendorType: 'venue',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Arundelpet, Guntur, Andhra Pradesh 522002',
        businessDescription: 'Premium wedding venue in the heart of Guntur with traditional South Indian architecture and modern amenities. Perfect for grand Telugu weddings.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            capacity: 1500,
            selectedServices: ['venue', 'catering', 'decoration'],
            occasions: ['wedding', 'reception', 'engagement'],
            venueType: 'banquet',
            airConditioning: true,
            seatingCapacity: 1000,
            floatingCapacity: 1500,
            diningCapacity: 800,
            bridalSuite: true,
            guestRooms: 15,
            parkingCar: 100,
            parkingBike: 200,
            valetParking: true,
            powerBackup: true,
            lift: true,
            wheelchair: true,
            perPlateVeg: 500,
            perPlateNonVeg: 700,
            minPrice: 150000,
            maxPrice: 500000,
            photos: [
                'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
                'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800'
            ],
        },
    },
    {
        // 2. Traditional Catering
        fullName: 'Lakshmi Narayana',
        email: 'lakshmi@andhraswadcatering.com',
        password: 'vendor123',
        phone: '+919876543211',
        whatsappNumber: '+919876543211',
        businessName: 'Andhra Swad Caterers',
        vendorType: 'catering',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Brodipet, Guntur, Andhra Pradesh 522002',
        businessDescription: 'Authentic Andhra cuisine specialists serving traditional Telugu wedding feasts with signature Guntur spices and flavors.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            cuisines: ['South Indian', 'North Indian', 'Andhra Special', 'Traditional Telugu'],
            dietaryOptions: ['vegetarian', 'non-vegetarian', 'jain'],
            serviceStyle: ['buffet', 'plated', 'family-style'],
            liveCounters: true,
            liveCounterItems: ['Dosa', 'Panipuri', 'Ice Cream'],
            minGuestCount: 100,
            fssaiLicense: 'FSSAI-AP-2024-12345',
            perPlateVeg: 400,
            perPlateNonVeg: 600,
            minPrice: 40000,
            maxPrice: 300000,
            photos: [
                'https://images.unsplash.com/photo-1555244162-803834f70033?w=800',
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'
            ],
        },
    },
    {
        // 3. Wedding Photography
        fullName: 'Arun Prakash',
        email: 'arun@memoriesbyarun.com',
        password: 'vendor123',
        phone: '+919876543212',
        whatsappNumber: '+919876543212',
        businessName: 'Memories by Arun Photography',
        vendorType: 'photography',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Lakshmipuram, Guntur, Andhra Pradesh 522007',
        businessDescription: 'Award-winning wedding photography capturing traditional Telugu wedding moments with cinematic excellence.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            photographyStyles: ['Candid', 'Traditional', 'Cinematic', 'Pre-wedding'],
            eventTypes: ['Wedding', 'Reception', 'Engagement', 'Pre-wedding Shoot'],
            deliverables: {
                photos: 1500,
                albums: 2,
                videos: 1,
                duration: '2 days'
            },
            rawFootage: true,
            equipment: ['Canon R5', 'Sony A7IV', 'DJI Drone', 'Gimbal'],
            startingPrice: 75000,
            minPrice: 75000,
            maxPrice: 250000,
            photos: [
                'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800',
                'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800'
            ],
        },
    },
    {
        // 4. Decor Specialist
        fullName: 'Vani Reddy',
        email: 'vani@royaldecorguntur.com',
        password: 'vendor123',
        phone: '+919876543213',
        whatsappNumber: '+919876543213',
        businessName: 'Royal Decor Guntur',
        vendorType: 'decor',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Kothapeta, Guntur, Andhra Pradesh 522001',
        businessDescription: 'Traditional South Indian wedding decor with marigold specialization. Creating stunning mandap decorations for Telugu weddings.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            decorThemes: ['Traditional', 'Royal', 'Floral', 'Modern Fusion'],
            decorOfferings: ['Mandap', 'Stage', 'Entrance', 'Ceiling', 'Table Settings'],
            designVisualization: true,
            customizationLevel: 'full',
            inventory: ['Marigold Flowers', 'Jasmine', 'Rose', 'Fabric Draping', 'LED Lights'],
            minPrice: 50000,
            maxPrice: 400000,
            photos: [
                'https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=800',
                'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800'
            ],
        },
    },
    {
        // 5. Traditional Music & Entertainment
        fullName: 'Murali Krishna',
        email: 'murali@telugumelodies.com',
        password: 'vendor123',
        phone: '+919876543214',
        whatsappNumber: '+919876543214',
        businessName: 'Telugu Melodies Live Band',
        vendorType: 'entertainment',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Pattabhipuram, Guntur, Andhra Pradesh 522006',
        businessDescription: 'Traditional Telugu wedding music band specializing in Nadaswaram, Tavil, and devotional songs for wedding ceremonies.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            teamSize: 8,
            performanceDuration: '4-6 hours',
            performanceType: ['Live Band', 'Traditional Music', 'Devotional Songs'],
            providedEquipment: true,
            travelOutstation: true,
            selectedServices: ['Nadaswaram', 'Tavil', 'Shehnai', 'Keertanas'],
            minPrice: 25000,
            maxPrice: 100000,
            photos: [
                'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
            ],
        },
    },
    {
        // 6. Budget-Friendly Venue
        fullName: 'Srinivas Rao',
        email: 'srini@mangalabhavanguntur.com',
        password: 'vendor123',
        phone: '+919876543215',
        whatsappNumber: '+919876543215',
        businessName: 'Mangala Bhavan',
        vendorType: 'venue',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Nagarampalem, Guntur, Andhra Pradesh 522004',
        businessDescription: 'Traditional kalyana mandapam for intimate Telugu weddings with authentic South Indian ambiance.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            capacity: 500,
            selectedServices: ['venue'],
            occasions: ['wedding', 'reception'],
            venueType: 'traditional-hall',
            airConditioning: true,
            seatingCapacity: 300,
            floatingCapacity: 500,
            diningCapacity: 250,
            parkingCar: 30,
            parkingBike: 60,
            powerBackup: true,
            perPlateVeg: 300,
            perPlateNonVeg: 450,
            minPrice: 50000,
            maxPrice: 150000,
            photos: [
                'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800'
            ],
        },
    },
    {
        // 7. Modern DJ & Entertainment
        fullName: 'Karthik Reddy',
        email: 'karthik@beatzmusicguntur.com',
        password: 'vendor123',
        phone: '+919876543216',
        whatsappNumber: '+919876543216',
        businessName: 'Beatz Music & DJ Services',
        vendorType: 'entertainment',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Nallapadu, Guntur, Andhra Pradesh 522005',
        businessDescription: 'Professional DJ services for sangeet and reception parties. Mixing Telugu hits with Bollywood chartbusters.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            teamSize: 3,
            performanceDuration: '4-8 hours',
            performanceType: ['DJ', 'Sound System', 'LED Lights'],
            providedEquipment: true,
            travelOutstation: true,
            selectedServices: ['DJ Services', 'Sound System', 'LED Dance Floor', 'Cold Pyro'],
            minPrice: 30000,
            maxPrice: 120000,
            photos: [
                'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800'
            ],
        },
    },
    {
        // 8. Homely Catering
        fullName: 'Padma Vati',
        email: 'padma@gunturtraditionalcaters.com',
        password: 'vendor123',
        phone: '+919876543217',
        whatsappNumber: '+919876543217',
        businessName: 'Guntur Traditional Homely Caterers',
        vendorType: 'catering',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Chilakaluripet Road, Guntur, Andhra Pradesh 522003',
        businessDescription: 'Home-style cooking for weddings. Authentic Guntur recipes passed down through generations.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            cuisines: ['Traditional Telugu', 'Andhra Homestyle'],
            dietaryOptions: ['vegetarian', 'non-vegetarian'],
            serviceStyle: ['buffet'],
            liveCounters: false,
            minGuestCount: 50,
            fssaiLicense: 'FSSAI-AP-2024-12346',
            perPlateVeg: 250,
            perPlateNonVeg: 400,
            minPrice: 15000,
            maxPrice: 100000,
            photos: [
                'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800'
            ],
        },
    },
    {
        // 9. Candid Photography
        fullName: 'Priya Sharma',
        email: 'priya@candidsbypriya.com',
        password: 'vendor123',
        phone: '+919876543218',
        whatsappNumber: '+919876543218',
        businessName: 'Candids by Priya',
        vendorType: 'photography',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Autonagar, Guntur, Andhra Pradesh 522001',
        businessDescription: 'Female wedding photographer specializing in candid moments and bridal portraits with a feminine touch.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            photographyStyles: ['Candid', 'Portrait', 'Bridal'],
            eventTypes: ['Wedding', 'Pre-wedding', 'Bride Preparation'],
            deliverables: {
                photos: 800,
                albums: 1,
                videos: 0,
                duration: '1 day'
            },
            rawFootage: false,
            equipment: ['Canon 5D Mark IV', 'Natural Light'],
            startingPrice: 40000,
            minPrice: 40000,
            maxPrice: 120000,
            photos: [
                'https://images.unsplash.com/photo-1522413452208-996ff3f3e740?w=800'
            ],
        },
    },
    {
        // 10. Floral Decor Specialist
        fullName: 'Ravi Teja',
        email: 'ravi@gunturflowerdecor.com',
        password: 'vendor123',
        phone: '+919876543219',
        whatsappNumber: '+919876543219',
        businessName: 'Guntur Flower Decor Studio',
        vendorType: 'decor',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        address: 'Gorantla, Guntur, Andhra Pradesh 522034',
        businessDescription: 'Fresh flower specialists using local Guntur marigolds, jasmine, and roses for authentic Telugu wedding decorations.',
        isVerified: true,
        onboardingCompleted: true,
        details: {
            decorThemes: ['Floral Traditional', 'Marigold Special', 'Jasmine Dreams'],
            decorOfferings: ['Mandap', 'Car Decoration', 'Garlands', 'Bridal Entry'],
            designVisualization: false,
            customizationLevel: 'moderate',
            inventory: ['Marigold', 'Jasmine', 'Rose', 'Kanakambaram'],
            minPrice: 20000,
            maxPrice: 150000,
            photos: [
                'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800'
            ],
        },
    },
];

async function seedGunturVendors() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap');
        console.log('✅ Connected to MongoDB');

        // Hash passwords for all vendors
        const salt = await bcrypt.genSalt(10);

        for (const vendorData of gunturVendors) {
            // Check if vendor already exists
            const existing = await Vendor.findOne({ email: vendorData.email });
            if (existing) {
                console.log(`⏭️  Vendor ${vendorData.businessName} already exists, skipping...`);
                continue;
            }

            vendorData.password = await bcrypt.hash(vendorData.password, salt);
            await Vendor.create(vendorData);
            console.log(`✅ Created: ${vendorData.businessName} (${vendorData.vendorType})`);
        }

        console.log('\n🎉 Successfully seeded 10 Guntur vendors across all categories!');
        console.log('\nVendor Summary:');
        console.log('- 2 Venues (Premium & Budget)');
        console.log('- 2 Catering Services (Traditional & Homely)');
        console.log('- 2 Photography (Cinematic & Candid)');
        console.log('- 2 Decor (Premium & Floral Specialist)');
        console.log('- 2 Entertainment (Traditional Band & Modern DJ)');
        console.log('\nAll vendors are from Guntur, Andhra Pradesh');
        console.log('Default password for all: vendor123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding vendors:', error);
        process.exit(1);
    }
}

seedGunturVendors();
