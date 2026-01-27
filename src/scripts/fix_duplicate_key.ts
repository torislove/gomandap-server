import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Fix path to point to root .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const fixIndex = async () => {
    console.log('Connecting to MongoDB...');
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing in .env");
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected successfully.');

        const collection = mongoose.connection.collection('vendors');

        // Check indexes
        const indexes = await collection.indexes();
        console.log('Current Indexes:', indexes.map(i => i.name));

        const indexName = "vendorCode_1";
        const exists = indexes.find(i => i.name === indexName);

        if (exists) {
            console.log(`Dropping index: ${indexName}...`);
            await collection.dropIndex(indexName);
            console.log('Index dropped successfully!');
        } else {
            console.log(`Index ${indexName} does not exist. Nothing to do.`);
        }

    } catch (err) {
        console.error('Operation failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
};

fixIndex();
