
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Admin } from '../models/Admin.js';
import path from 'path';

// Load env vars from server root (one level up from src/scripts, or two levels?)
// src/scripts -> src -> server root. So ../../.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap';

const resetPassword = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const admins = await Admin.find({});
        if (admins.length === 0) {
            console.log('No admin accounts found.');
            // Create one? No, user implied resetting existing.
        } else {
            console.log(`Found ${admins.length} admin(s). Resetting passwords...`);
            const hashedPassword = await bcrypt.hash('gomandap123', 10);

            for (const admin of admins) {
                admin.password = hashedPassword;
                await admin.save();
                console.log(`✅ Password updated for admin: ${admin.email}`);
            }
        }
    } catch (error) {
        console.error('Error resetting password:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    }
};

resetPassword();
