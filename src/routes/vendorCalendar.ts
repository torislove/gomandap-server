import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import VendorAvailability from '../models/VendorAvailability.js';
import { Booking } from '../models/Booking.js';

const app = new Hono<{
    Variables: {
        vendorId: string;
    }
}>();

// Auth Middleware
const auth = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ success: false, message: 'Unauthorized' }, 401);
    try {
        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');
        c.set('vendorId', decoded.id);
        await next();
    } catch (err) {
        return c.json({ success: false, message: 'Invalid token' }, 401);
    }
};

app.use('*', auth);

// Get combined calendar data
app.get('/', async (c) => {
    try {
        const vendorId = c.get('vendorId');
        const { start, end } = c.req.query();

        const startDate = start ? new Date(start) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const endDate = end ? new Date(end) : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);

        // 1. Fetch system bookings
        // Note: status filter might need adjustment based on your Booking model enum
        const bookings = await Booking.find({
            vendorId,
            'eventDetails.eventDate': { $gte: startDate, $lte: endDate },
            status: { $in: ['confirmed', 'pending', 'completed'] }
        }).select('eventDetails.eventDate status pricing.totalAmount');

        // 2. Fetch manual availability overrides
        const manualAvailability = await VendorAvailability.find({
            vendorId,
            date: { $gte: startDate, $lte: endDate }
        });

        return c.json({
            success: true,
            data: {
                bookings,
                manualAvailability
            }
        });
    } catch (error) {
        console.error('Calendar Fetch Error:', error);
        return c.json({ success: false, message: 'Failed to fetch calendar data' }, 500);
    }
});

// Update manual status for a date
app.post('/update', async (c) => {
    try {
        const vendorId = c.get('vendorId');
        const { date, status, note } = await c.req.json();

        if (!date || !status) return c.json({ success: false, message: 'Date and status required' }, 400);

        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // If status is 'available', we remove the override to let system logic (or default open) prevail
        if (status === 'available') {
            await VendorAvailability.findOneAndDelete({ vendorId, date: targetDate });
            return c.json({ success: true, message: 'Date cleared' });
        }

        // Upsert status
        const availability = await VendorAvailability.findOneAndUpdate(
            { vendorId, date: targetDate },
            { status, note },
            { new: true, upsert: true }
        );

        return c.json({ success: true, data: availability });
    } catch (error) {
        console.error('Calendar Update Error:', error);
        return c.json({ success: false, message: 'Failed to update calendar' }, 500);
    }
});

export default app;
