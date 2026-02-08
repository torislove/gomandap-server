import { Hono } from 'hono';
import { Vendor } from '../models/Vendor.js';

const app = new Hono();

// Helper to calculate distance (Haversine Formula) in km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

app.get('/search', async (c) => {
    try {
        const query = c.req.query();
        const lat = parseFloat(query.lat || '');
        const lon = parseFloat(query.lon || '');
        const radius = parseFloat(query.radius || '50');
        const city = query.city;
        const type = query.type;
        const minPrice = query.minPrice ? parseFloat(query.minPrice) : 0;
        const maxPrice = query.maxPrice ? parseFloat(query.maxPrice) : Infinity;

        // Base Filter
        let filter: any = {
            isVerified: true,
            // onboardingCompleted: true, // Temporarily disabled for testing if needed, but safer to keep
            businessName: { $exists: true, $ne: '' }
        };

        if (type && type !== 'all') {
            filter.vendorType = type;
        }

        // Price Filter
        if (minPrice > 0 || maxPrice < Infinity) {
            const priceField = type === 'catering' ? 'details.perPlateVeg' : 'minPrice';
            // For catering, we might check perPlate. For others, minPrice.
            // But standardization is better. The Vendor model has 'minPrice' at root.
            filter.minPrice = { $gte: minPrice };
            if (maxPrice < Infinity) {
                // If maxPrice is huge, ignore it to avoid filtering out "onwards" pricing
                if (maxPrice < 1000000) {
                    filter.minPrice = { ...filter.minPrice, $lte: maxPrice };
                }
            }
        }

        // --- ADVANCED FILTERS MAPPING ---

        // 1. Capacity (Mandap/Venue)
        if (query.capacity) {
            const cap = parseFloat(query.capacity);
            // Search vendors where capacity >= requested (approximately)
            // Stored in 'details.capacity' (string or number?)
            // If string "500-1000", regex or bounds? 
            // Simplified: Regex for now or partial match
            // Ideally, backend should normalize capacity to number.
            // For now, let's assume loose matching if string, or check numeric fields if they exist.
            // Vendor model has 'details.selectedServices' etc. 
            // In Index.ts ALLOWED_FIELDS: 'capacity' is allowed.
            filter['details.capacity'] = { $regex: new RegExp(query.capacity, 'i') }; // Very basic
        }

        // 2. Amenities (Generic Multi-select) mapped to specific boolean fields
        if (query.amenities) {
            const amenities = query.amenities.split(',');
            const amenityMap: Record<string, string> = {
                'AC': 'details.airConditioning',
                'Parking': 'details.parkingCar',
                'Valet Parking': 'details.valetParking',
                'Power Backup': 'details.powerBackup',
                'Electricity Backup': 'details.powerBackup',
                'Bridal Room': 'details.bridalSuite',
                'Wheelchair Access': 'details.wheelchair',
                'Sound System': 'details.avEquipment',
                'Lift': 'details.lift'
            };

            amenities.forEach(a => {
                const dbField = amenityMap[a];
                if (dbField) {
                    // Check if field exists and is true (or string 'true' / 'Yes')
                    // Accommodate chaos: boolean true, string "true", string "Yes"
                    filter[dbField] = { $in: [true, 'true', 'Yes', 'yes'] };
                }
            });
        }

        // 3. Venue Type (Multi-select)
        if (query.venueType) {
            const types = query.venueType.split(',');
            filter['details.venueType'] = { $in: types }; // Matches if array contains one of these, or string matches
        }

        // 4. Food & Decor Policy (Radio)
        if (query.foodPolicy) filter['details.cateringPolicy'] = query.foodPolicy;
        if (query.decorPolicy) filter['details.decorPolicy'] = query.decorPolicy;

        // 5. Catering Specifics
        if (query.cuisines) {
            const cuisines = query.cuisines.split(',');
            filter['details.cuisines'] = { $in: cuisines.map(c => new RegExp(c, 'i')) };
        }
        if (query.dietaryOptions) {
            const diet = query.dietaryOptions.split(',');
            filter['details.dietaryOptions'] = { $in: diet };
        }

        // 6. Generic Service/Category Fields
        if (query.decorThemes) filter['details.decorThemes'] = { $in: query.decorThemes.split(',') };
        if (query.photographyStyles) filter['details.photographyStyles'] = { $in: query.photographyStyles.split(',') };
        if (query.equipment) filter['details.equipment'] = { $in: query.equipment.split(',') };


        // Location (City)
        if (city) {
            const cityRegex = new RegExp(city, 'i');
            filter.$or = [
                { city: cityRegex },
                { village: cityRegex },
                { mandal: cityRegex },
                { addressLine1: cityRegex }
            ];
        }

        console.log('Search Filter:', JSON.stringify(filter));

        let vendors = await Vendor.find(filter).select('-password -fcmTokens').lean();

        // Distance Calculation
        if (!isNaN(lat) && !isNaN(lon)) {
            vendors = vendors.map((v: any) => {
                let dist = Infinity;
                if (v.coordinates?.lat && v.coordinates?.lon) {
                    dist = getDistanceFromLatLonInKm(lat, lon, v.coordinates.lat, v.coordinates.lon);
                }
                return { ...v, distance: dist };
            });
            vendors = vendors.filter((v: any) => v.distance <= radius);
            vendors.sort((a: any, b: any) => a.distance - b.distance);
        } else {
            // Priority Sort
            vendors.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
        }

        // Hide Demo Accounts
        vendors = vendors.filter((v: any) => !v.businessName?.toLowerCase().includes('demo'));

        return c.json({ success: true, count: vendors.length, data: vendors });
    } catch (err: any) {
        console.error('Search Error:', err);
        return c.json({ success: false, error: 'Search failed' }, 500);
    }
});

export default app;
