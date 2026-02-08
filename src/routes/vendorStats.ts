import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { Vendor } from '../models/Vendor.js';
import { Booking } from '../models/Booking.js';
import { Enquiry } from '../models/Enquiry.js';
import { Review } from '../models/Review.js';

const app = new Hono();

// Get Vendor Stats
app.get('/vendor/stats', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ success: false, message: 'No token provided' }, 401);

    try {
        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
        const vendorId = decoded.id;

        // 1. Earnings (Kamai) - Sum of payments from confirmed/completed bookings
        // Note: Logic depends on how payments are tracked. For now, summing 'totalPaid' or 'totalAmount' of confirmed bookings
        const earningsAgg = await Booking.aggregate([
            { $match: { vendorId: vendorId, status: { $in: ['confirmed', 'completed'] } } }, // Adjust status as needed
            { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } } // Or totalPaid? Using totalAmount for "Booked Value"
        ]);
        const earnings = earningsAgg.length > 0 ? earningsAgg[0].total : 0;

        // 2. Active Inquiries - Count of pending bookings or enquiries
        const activeInquiries = await Booking.countDocuments({
            vendorId: vendorId,
            status: 'pending'
        });
        // If you have a separate Enquiry model linked to vendors
        const pendingEnquiries = await Enquiry.countDocuments({
            vendorId: vendorId,
            status: 'new'
        });
        const totalActive = activeInquiries + pendingEnquiries;

        // 3. Profile Visits & Rating (from Vendor model)
        const vendor = await Vendor.findById(vendorId).select('stats rating');
        const views = vendor?.stats?.views || 0;
        const rating = vendor?.rating || 0;

        // 4. Review Count
        const reviewCount = await Review.countDocuments({ vendorId: vendorId });

        return c.json({
            success: true,
            data: {
                earnings,
                activeInquiries: totalActive,
                profileVisits: views,
                rating,
                reviewCount
            }
        });
    } catch (error) {
        console.error('Stats Error:', error);
        return c.json({ success: false, message: 'Failed to fetch stats' }, 500);
    }
});

export default app;
