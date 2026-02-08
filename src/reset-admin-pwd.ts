import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Admin } from './models/Admin.js';

dotenv.config();

console.log('Script started...');
console.log('MONGO_URI loaded:', process.env.MONGO_URI ? 'Yes' : 'No');

async function resetPassword() {
    console.log('Attempting DB connection...');
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap', {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('MongoDB Connected successfully');

        const hashedPassword = await bcrypt.hash('gomandap123', 10);
        console.log('Generated hash for: gomandap123');

        // Find if any admin exists
        const admins = await Admin.find({});
        console.log(`Found ${admins.length} admin(s)`);

        if (admins.length > 0) {
            for (const admin of admins) {
                admin.password = hashedPassword;
                await admin.save();
                console.log(`Password reset for user: ${admin.username}`);
            }
        } else {
            // Create a default admin if none exist
            console.log('No admins found, creating default admin...');
            const newAdmin = new Admin({
                username: 'admin',
                email: 'admin@gomandap.com',
                password: hashedPassword,
                role: 'admin'
            });
            await newAdmin.save();
            console.log('Default admin created with username: admin');
        }

        console.log('Password reset complete: gomandap123');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        process.exit(1);
    }
}

resetPassword();
