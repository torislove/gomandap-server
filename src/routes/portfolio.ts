import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { ServicePortfolio } from '../models/ServicePortfolio.js';
import { v2 as cloudinary } from 'cloudinary';

const app = new Hono();

// JWT middleware for vendor routes
const jwtMiddleware = jwt({
    secret: process.env.JWT_SECRET || 'your-secret-key',
    alg: 'HS256'
});

// Cloudinary configuration (assumes already configured in main app)
// If not configured, add this to your index.ts:
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// ============================================
// PUBLIC ROUTES
// ============================================

// Get vendor's public portfolio (for clients)
app.get('/vendors/:vendorId/portfolio', async (c) => {
    try {
        const { vendorId } = c.req.param();
        const { category, serviceType } = c.req.query();

        const filter: any = { vendorId, isActive: true };
        if (category) filter.category = category.toLowerCase();
        if (serviceType) filter.serviceType = serviceType.toLowerCase();

        const portfolio = await ServicePortfolio.find(filter)
            .sort({ displayOrder: 1, createdAt: -1 })
            .select('-__v');

        return c.json({ success: true, data: portfolio });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to fetch portfolio' }, 500);
    }
});

// Get portfolio categories for a vendor
app.get('/vendors/:vendorId/portfolio/categories', async (c) => {
    try {
        const { vendorId } = c.req.param();

        const categories = await ServicePortfolio.distinct('category', {
            vendorId,
            isActive: true,
        });

        return c.json({ success: true, data: categories });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to fetch categories' }, 500);
    }
});

// Get specific portfolio item (public)
app.get('/portfolio/:id', async (c) => {
    try {
        const { id } = c.req.param();

        const item = await ServicePortfolio.findById(id).populate('vendorId', 'businessName vendorType city');

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        // Increment view count
        item.viewCount += 1;
        await item.save();

        return c.json({ success: true, data: item });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to fetch portfolio item' }, 500);
    }
});

// ============================================
// VENDOR ROUTES (Protected)
// ============================================

// Get vendor's own portfolio
app.get('/vendor/portfolio', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;

        const { category } = c.req.query();

        const filter: any = { vendorId };
        if (category) filter.category = category.toLowerCase();

        const portfolio = await ServicePortfolio.find(filter)
            .sort({ displayOrder: 1, createdAt: -1 });

        return c.json({ success: true, data: portfolio });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to fetch portfolio' }, 500);
    }
});

// Create portfolio item
app.post('/vendor/portfolio', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const body = await c.req.json();

        const portfolioData = {
            ...body,
            vendorId,
            category: body.category?.toLowerCase(),
            serviceType: body.serviceType?.toLowerCase(),
        };

        const newItem = await ServicePortfolio.create(portfolioData);

        return c.json({ success: true, data: newItem }, 201);
    } catch (error) {
        console.error('Create portfolio error:', error);
        return c.json({ success: false, message: 'Failed to create portfolio item' }, 500);
    }
});

// Update portfolio item
app.put('/vendor/portfolio/:id', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const { id } = c.req.param();
        const body = await c.req.json();

        const item = await ServicePortfolio.findOne({ _id: id, vendorId });

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        // Update fields
        Object.assign(item, {
            ...body,
            category: body.category?.toLowerCase(),
            serviceType: body.serviceType?.toLowerCase(),
        });

        await item.save();

        return c.json({ success: true, data: item });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to update portfolio item' }, 500);
    }
});

// Delete portfolio item
app.delete('/vendor/portfolio/:id', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const { id } = c.req.param();

        const item = await ServicePortfolio.findOne({ _id: id, vendorId });

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        // Delete images from Cloudinary
        if (item.images && item.images.length > 0) {
            for (const image of item.images) {
                if (image.publicId) {
                    try {
                        await cloudinary.uploader.destroy(image.publicId);
                    } catch (err) {
                        console.error('Failed to delete image from Cloudinary:', err);
                    }
                }
            }
        }

        await ServicePortfolio.deleteOne({ _id: id });

        return c.json({ success: true, message: 'Portfolio item deleted' });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to delete portfolio item' }, 500);
    }
});

// Toggle active status
app.patch('/vendor/portfolio/:id/toggle', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const { id } = c.req.param();

        const item = await ServicePortfolio.findOne({ _id: id, vendorId });

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        item.isActive = !item.isActive;
        await item.save();

        return c.json({ success: true, data: item });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to toggle status' }, 500);
    }
});

// Upload images to portfolio item
app.post('/vendor/portfolio/:id/images', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const { id } = c.req.param();
        const body = await c.req.json();

        const item = await ServicePortfolio.findOne({ _id: id, vendorId });

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        const { imageUrl, caption, isPrimary } = body;

        // If this is set as primary, unset other primary images
        if (isPrimary) {
            item.images.forEach((img) => {
                img.isPrimary = false;
            });
        }

        // Extract publicId from Cloudinary URL
        const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];

        item.images.push({
            url: imageUrl,
            publicId,
            caption,
            isPrimary: isPrimary || false,
            uploadedAt: new Date(),
        });

        await item.save();

        return c.json({ success: true, data: item });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to add image' }, 500);
    }
});

// Delete image from portfolio item
app.delete('/vendor/portfolio/:id/images/:imageId', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const { id, imageId } = c.req.param();

        const item = await ServicePortfolio.findOne({ _id: id, vendorId });

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        const imageIndex = item.images.findIndex((img) => img._id?.toString() === imageId);

        if (imageIndex === -1) {
            return c.json({ success: false, message: 'Image not found' }, 404);
        }

        const image = item.images[imageIndex];

        // Delete from Cloudinary
        if (image.publicId) {
            try {
                await cloudinary.uploader.destroy(image.publicId);
            } catch (err) {
                console.error('Failed to delete from Cloudinary:', err);
            }
        }

        item.images.splice(imageIndex, 1);
        await item.save();

        return c.json({ success: true, data: item });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to delete image' }, 500);
    }
});

// Update display order
app.patch('/vendor/portfolio/:id/order', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;
        const { id } = c.req.param();
        const { displayOrder } = await c.req.json();

        const item = await ServicePortfolio.findOne({ _id: id, vendorId });

        if (!item) {
            return c.json({ success: false, message: 'Portfolio item not found' }, 404);
        }

        item.displayOrder = displayOrder;
        await item.save();

        return c.json({ success: true, data: item });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to update order' }, 500);
    }
});

// Get portfolio statistics
app.get('/vendor/portfolio/stats', jwtMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const vendorId = payload.id;

        const stats = await ServicePortfolio.aggregate([
            { $match: { vendorId: vendorId } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalViews: { $sum: '$viewCount' },
                    activeCount: {
                        $sum: { $cond: ['$isActive', 1, 0] },
                    },
                },
            },
        ]);

        const totalItems = await ServicePortfolio.countDocuments({ vendorId });
        const totalImages = await ServicePortfolio.aggregate([
            { $match: { vendorId: vendorId } },
            { $unwind: '$images' },
            { $count: 'total' },
        ]);

        return c.json({
            success: true,
            data: {
                totalItems,
                totalImages: totalImages[0]?.total || 0,
                byCategory: stats,
            },
        });
    } catch (error) {
        return c.json({ success: false, message: 'Failed to fetch stats' }, 500);
    }
});

export default app;
