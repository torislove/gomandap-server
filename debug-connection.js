import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from current directory
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('--- GoMandap Server Connection Debugger ---');
console.log(`Node Version: ${process.version}`);
console.log(`Current Directory: ${process.cwd()}`);
console.log(`MONGO_URI from env: ${process.env.MONGO_URI ? 'Set (Hidden)' : 'Not Set'}`);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gomandap';

console.log(`Attempting to connect to: ${MONGO_URI.includes('mongodb+srv') ? 'Atlas Cloud DB' : 'Local DB'}`);

async function testConnection() {
  try {
    const start = Date.now();
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const duration = Date.now() - start;
    console.log(`✅ SUCCESS: Connected to MongoDB in ${duration}ms`);
    console.log(`   Database Name: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    
    // Check if we can read vendors
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   Collections found: ${collections.map(c => c.name).join(', ')}`);
    
    await mongoose.disconnect();
    console.log('--- End of Test ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ FAILED: Could not connect to MongoDB');
    console.error('   Error:', err.message);
    
    if (MONGO_URI.includes('mongodb+srv')) {
        console.log('\nPossible Causes (Atlas):');
        console.log('1. IP Address not whitelisted in MongoDB Atlas Network Access.');
        console.log('2. Incorrect Username/Password.');
        console.log('3. Firewall/Network blocking outbound connection.');
    } else {
        console.log('\nPossible Causes (Local):');
        console.log('1. MongoDB service is not running.');
        console.log('2. Port 27017 is blocked.');
    }
    process.exit(1);
  }
}

testConnection();
