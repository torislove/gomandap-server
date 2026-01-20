const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.admin = await Admin.findById(decoded.id);
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
};

// @desc    Login admin
// @route   POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate email & password
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an username and password'
      });
    }

    // Check for user
    const admin = await Admin.findOne({ username }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Create token
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '30d',
    });

    res.status(200).json({
      success: true,
      token,
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// @desc    Get current admin
// @route   GET /api/admin/me
router.get('/me', protect, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Update password
// @route   PUT /api/admin/updatepassword
router.put('/updatepassword', protect, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('+password');

    // Check current password
    if (!(await admin.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect current password'
      });
    }

    admin.password = req.body.newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// @desc    Create new admin
// @route   POST /api/admin/create
router.post('/create', protect, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const adminExists = await Admin.findOne({ username });

    if (adminExists) {
      return res.status(400).json({
        success: false,
        error: 'Admin already exists'
      });
    }

    const admin = await Admin.create({
      username,
      email,
      password,
    });

    res.status(201).json({
      success: true,
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

module.exports = router;
