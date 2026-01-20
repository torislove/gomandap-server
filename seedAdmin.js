const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to DB
connectDB();

const createAdmin = async () => {
  try {
    // Check if admin exists
    const adminExists = await Admin.findOne({ username: 'admin' });

    if (adminExists) {
      console.log('Admin user already exists');
      process.exit();
    }

    // Create admin user
    await Admin.create({
      username: 'admin',
      email: 'admin@gomandap.com',
      password: 'adminpassword123', // You should change this after first login or via env var
    });

    console.log('Admin user created successfully');
    console.log('Username: admin');
    console.log('Password: adminpassword123');
    process.exit();
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();
