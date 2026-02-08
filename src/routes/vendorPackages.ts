import express from 'express';
import { VendorPackage } from '../models/VendorPackage.js';
import { verify } from 'hono/jwt';

const router = express.Router();

// Get all packages for a specific vendor (Public)
router.get('/vendors/:vendorId/packages', async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { activeOnly } = req.query;

        const query: any = { vendorId };
        if (activeOnly === 'true') {
            query.isActive = true;
        }

        const packages = await VendorPackage.find(query).sort({ price: 1 });
        res.json({ success: true, data: packages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch packages' });
    }
});

// Get vendor's own packages (Vendor Auth)
router.get('/vendor/packages', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

        const packages = await VendorPackage.find({ vendorId: decoded.id }).sort({ createdAt: -1 });
        res.json({ success: true, data: packages });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
});

// Create new package (Vendor Auth)
router.post('/vendor/packages', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

        const packageData = {
            ...req.body,
            vendorId: decoded.id,
        };

        const newPackage = await VendorPackage.create(packageData);
        res.status(201).json({ success: true, data: newPackage });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create package' });
    }
});

// Update package (Vendor Auth)
router.put('/vendor/packages/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

        const { id } = req.params;

        // Ensure vendor owns this package
        const existingPackage = await VendorPackage.findOne({ _id: id, vendorId: decoded.id });
        if (!existingPackage) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }

        const updatedPackage = await VendorPackage.findByIdAndUpdate(
            id,
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        res.json({ success: true, data: updatedPackage });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update package' });
    }
});

// Delete package (Vendor Auth)
router.delete('/vendor/packages/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

        const { id } = req.params;

        const deletedPackage = await VendorPackage.findOneAndDelete({ _id: id, vendorId: decoded.id });
        if (!deletedPackage) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }

        res.json({ success: true, message: 'Package deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete package' });
    }
});

// Toggle package active status (Vendor Auth)
router.patch('/vendor/packages/:id/toggle', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded: any = await verify(token, process.env.JWT_SECRET || 'secret', 'HS256');

        const { id } = req.params;

        const packageDoc = await VendorPackage.findOne({ _id: id, vendorId: decoded.id });
        if (!packageDoc) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }

        packageDoc.isActive = !packageDoc.isActive;
        await packageDoc.save();

        res.json({ success: true, data: packageDoc });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle package status' });
    }
});

export default router;
