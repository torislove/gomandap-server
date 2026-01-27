
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const LOG_FILE = 'reset_log.txt';

function log(msg) {
    fs.appendFileSync(LOG_FILE, msg + '\n');
    console.log(msg);
}

log(`Script started at ${new Date().toISOString()}`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const REMOTE_URI = process.env.MONGO_URI;
const LOCAL_URI = 'mongodb://localhost:27017/gomandap';

log(`Loaded env. Remote URI defined: ${!!REMOTE_URI}`);

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    role: { type: String, default: 'admin' },
    createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

const connectDB = async () => {
    try {
        if (REMOTE_URI) {
            log('Attempting to connect to Remote DB...');
            await mongoose.connect(REMOTE_URI, { serverSelectionTimeoutMS: 5000 });
            log('Connected to Remote DB.');
            return;
        }
    } catch (e) {
        log(`Remote DB connection failed: ${e.message}`);
    }

    try {
        log('Attempting to connect to Local DB...');
        await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
        log('Connected to Local DB.');
    } catch (e) {
        log(`Local DB connection failed: ${e.message}`);
        throw e;
    }
};

const resetPassword = async () => {
    try {
        await connectDB();

        const admins = await Admin.find({});
        if (admins.length === 0) {
            log('No admin accounts found.');
        } else {
            log(`Found ${admins.length} admin(s). Resetting passwords...`);
            const hashedPassword = await bcrypt.hash('gomandap123', 10);

            for (const admin of admins) {
                admin.password = hashedPassword;
                await admin.save();
                log(`✅ Password updated for admin: ${admin.email}`);
            }
        }
    } catch (error) {
        log(`Error resetting password: ${error.message}`);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        log('Disconnected. Exiting.');
        process.exit(0);
    }
};

resetPassword();
