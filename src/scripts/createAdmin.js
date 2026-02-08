
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const LOG_FILE = 'create_admin_log.txt';

function log(msg) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    fs.appendFileSync(LOG_FILE, logMsg + '\n');
    console.log(logMsg);
}

log('Script started...');

const rootEnv = path.resolve(process.cwd(), '.env');
const serverEnv = path.resolve(process.cwd(), 'server', '.env');
const scriptRelativeEnv = path.resolve(new URL(import.meta.url).pathname, '../../../../.env'); // from src/scripts to server/.env

if (fs.existsSync(rootEnv)) {
    log(`Loading env from CWD: ${rootEnv}`);
    dotenv.config({ path: rootEnv });
} else if (fs.existsSync(serverEnv)) {
    log(`Loading env from server folder: ${serverEnv}`);
    dotenv.config({ path: serverEnv });
} else if (fs.existsSync(scriptRelativeEnv)) {
    log(`Loading env relative to script: ${scriptRelativeEnv}`);
    dotenv.config({ path: scriptRelativeEnv });
} else {
    log('No specific .env found, using default dotenv.config()');
    dotenv.config();
}

const REMOTE_URI = process.env.MONGO_URI;
const LOCAL_URI = 'mongodb://localhost:27017/gomandap';

log(`Loaded env. Remote URI present: ${!!REMOTE_URI}`);

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
    let connected = false;

    if (REMOTE_URI) {
        try {
            log('Attempting to connect to Remote DB...');
            await mongoose.connect(REMOTE_URI, { serverSelectionTimeoutMS: 5000 });
            log('Connected to Remote DB.');
            connected = true;
        } catch (e) {
            log(`Remote DB connection failed: ${e.message}`);
        }
    }

    if (!connected) {
        try {
            log('Attempting to connect to Local DB...');
            await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
            log('Connected to Local DB.');
            connected = true;
        } catch (e) {
            log(`Local DB connection failed: ${e.message}`);
            throw e;
        }
    }
};

const createOrUpdateAdmin = async () => {
    try {
        await connectDB();

        const username = 'admin';
        const email = 'admin@gomandap.com';
        const password = 'gomandap123';

        log(`Checking for admin user: ${username} / ${email}`);

        let admin = await Admin.findOne({ $or: [{ username }, { email }] });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        if (admin) {
            log(`Admin found (ID: ${admin._id}). Updating password...`);
            admin.password = hashedPassword;
            // Ensure both fields match our known credentials if possible, or just update password
            admin.username = username;
            admin.email = email;
            await admin.save();
            log('✅ Admin password updated to: gomandap123');
        } else {
            log('Admin not found. Creating new admin user...');
            admin = await Admin.create({
                username,
                email,
                password: hashedPassword,
                role: 'admin'
            });
            log(`✅ Admin user created! ID: ${admin._id}`);
        }

    } catch (error) {
        log(`❌ Error: ${error.message}`);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        log('Disconnected. Exiting.');
        process.exit(0);
    }
};

createOrUpdateAdmin();
