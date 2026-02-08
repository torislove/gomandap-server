import { Hono } from 'hono';
import CommissionTransaction from '../models/CommissionTransaction.js';
import { Booking } from '../models/Booking.js';

const app = new Hono();

// Simple auth check middleware
const requireAdmin = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    await next();
};

// Get real-time revenue statistics
app.get('/admin/revenue/stats', requireAdmin, async (c) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));

        // Total revenue (all-time)
        const totalRevenue = await CommissionTransaction.aggregate([
            { $match: { status: { $in: ['settled', 'pending'] } } },
            { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);

        // Settled revenue (available for withdrawal)
        const settledRevenue = await CommissionTransaction.aggregate([
            { $match: { adminPayoutStatus: 'settled' } },
            { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);

        // Pending commission (in escrow)
        const pendingCommission = await CommissionTransaction.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);

        // Monthly revenue
        const monthlyRevenue = await CommissionTransaction.aggregate([
            { $match: { createdAt: { $gte: startOfMonth }, status: { $ne: 'refunded' } } },
            { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);

        // Today's revenue
        const todayRevenue = await CommissionTransaction.aggregate([
            { $match: { createdAt: { $gte: startOfToday }, status: { $ne: 'refunded' } } },
            { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);

        // Commission by vendor type
        const commissionByType = await CommissionTransaction.aggregate([
            { $match: { status: { $ne: 'refunded' } } },
            {
                $lookup: {
                    from: 'vendors',
                    localField: 'vendorId',
                    foreignField: '_id',
                    as: 'vendor'
                }
            },
            { $unwind: '$vendor' },
            {
                $group: {
                    _id: '$vendor.vendorType',
                    totalCommission: { $sum: '$platformCommission' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Recent transactions
        const recentTransactions = await CommissionTransaction.find()
            .populate('vendorId', 'businessName vendorCode vendorType')
            .populate('clientId', 'displayName email')
            .populate('bookingId', 'eventDetails')
            .sort({ createdAt: -1 })
            .limit(10);

        return c.json({
            success: true,
            data: {
                totalRevenue: totalRevenue[0]?.total || 0,
                settledRevenue: settledRevenue[0]?.total || 0,
                pendingCommission: pendingCommission[0]?.total || 0,
                monthlyRevenue: monthlyRevenue[0]?.total || 0,
                todayRevenue: todayRevenue[0]?.total || 0,
                commissionByType,
                recentTransactions
            }
        });
    } catch (error) {
        console.error('Error fetching revenue stats:', error);
        return c.json({ success: false, message: 'Failed to fetch revenue statistics' }, 500);
    }
});

// Get monthly revenue trend (last 12 months)
app.get('/admin/revenue/trend', requireAdmin, async (c) => {
    try {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyTrend = await CommissionTransaction.aggregate([
            { $match: { createdAt: { $gte: twelveMonthsAgo }, status: { $ne: 'refunded' } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    revenue: { $sum: '$platformCommission' },
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        return c.json({ success: true, data: monthlyTrend });
    } catch (error) {
        console.error('Error fetching revenue trend:', error);
        return c.json({ success: false, message: 'Failed to fetch revenue trend' }, 500);
    }
});

// Get top earning vendors
app.get('/admin/revenue/top-vendors', requireAdmin, async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');

        const topVendors = await CommissionTransaction.aggregate([
            { $match: { status: { $ne: 'refunded' } } },
            {
                $group: {
                    _id: '$vendorId',
                    totalCommission: { $sum: '$platformCommission' },
                    bookingCount: { $sum: 1 }
                }
            },
            { $sort: { totalCommission: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'vendors',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'vendor'
                }
            },
            { $unwind: '$vendor' },
            {
                $project: {
                    vendorName: '$vendor.businessName',
                    vendorType: '$vendor.vendorType',
                    totalCommission: 1,
                    bookingCount: 1
                }
            }
        ]);

        return c.json({ success: true, data: topVendors });
    } catch (error) {
        console.error('Error fetching top vendors:', error);
        return c.json({ success: false, message: 'Failed to fetch top vendors' }, 500);
    }
});

// Create commission transaction (called when booking is created/confirmed)
app.post('/admin/revenue/create', requireAdmin, async (c) => {
    try {
        const body = await c.req.json();
        const { bookingId, totalAmount, commissionRate = 15 } = body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return c.json({ success: false, message: 'Booking not found' }, 404);
        }

        const platformCommission = (totalAmount * commissionRate) / 100;
        const vendorPayout = totalAmount - platformCommission;

        const transaction = new CommissionTransaction({
            bookingId,
            vendorId: booking.vendorId,
            clientId: booking.clientId,
            totalAmount,
            platformCommission,
            platformCommissionRate: commissionRate,
            vendorPayout,
            status: 'pending'
        });

        await transaction.save();

        return c.json({ success: true, data: transaction });
    } catch (error) {
        console.error('Error creating commission transaction:', error);
        return c.json({ success: false, message: 'Failed to create commission transaction' }, 500);
    }
});

// Mark commission as settled (when payment is received)
app.patch('/admin/revenue/:id/settle', requireAdmin, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { paymentGatewayTxnId } = body;

        const transaction = await CommissionTransaction.findByIdAndUpdate(
            id,
            {
                status: 'settled',
                adminPayoutStatus: 'settled',
                settledAt: new Date(),
                paymentGatewayTxnId
            },
            { new: true }
        );

        return c.json({ success: true, data: transaction });
    } catch (error) {
        console.error('Error settling commission:', error);
        return c.json({ success: false, message: 'Failed to settle commission' }, 500);
    }
});

// Get all transactions with filters
app.get('/admin/revenue/transactions', requireAdmin, async (c) => {
    try {
        const status = c.req.query('status');
        const vendorId = c.req.query('vendorId');
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');

        const filter: any = {};
        if (status) filter.status = status;
        if (vendorId) filter.vendorId = vendorId;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const transactions = await CommissionTransaction.find(filter)
            .populate('vendorId', 'businessName vendorCode vendorType')
            .populate('clientId', 'displayName email phone')
            .populate('bookingId', 'eventDetails status')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await CommissionTransaction.countDocuments(filter);

        return c.json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return c.json({ success: false, message: 'Failed to fetch transactions' }, 500);
    }
});

export default app;
