const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const { upload } = require('../config/r2');

// @desc    Upload vendor image
// @route   POST /api/vendors/upload
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    res.status(200).json({
      success: true,
      data: {
        imageUrl: req.file.location || `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${req.file.key}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Image upload failed' });
  }
});

// @desc    Get all vendors
// @route   GET /api/vendors
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// @desc    Register/Update vendor onboarding data
// @route   POST /api/vendors/onboarding
router.post('/onboarding', async (req, res) => {
  try {
    const { email, ...updateData } = req.body;
    
    let vendor = await Vendor.findOne({ email });
    
    if (vendor) {
      // Update existing vendor
      vendor = await Vendor.findOneAndUpdate(
        { email },
        { $set: updateData },
        { new: true }
      );
    } else {
      // Create new vendor entry
      vendor = await Vendor.create({
        email,
        ...updateData
      });
    }
    
    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// @desc    Get vendor status
// @route   GET /api/vendors/:email
router.get('/:email', async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ email: req.params.email });
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

module.exports = router;
