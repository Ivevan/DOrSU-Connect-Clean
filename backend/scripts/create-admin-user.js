/**
 * Script to create admin user in MongoDB
 * Usage: node scripts/create-admin-user.js
 */

import bcrypt from 'bcryptjs';
import { getMongoDBService } from '../src/services/mongodb.js';
import { Logger } from '../src/utils/logger.js';

async function createAdminUser() {
  try {
    Logger.info('🚀 Starting admin user creation...');
    
    const mongoService = getMongoDBService();
    
    // Ensure MongoDB is connected
    if (!mongoService.isConnected) {
      await mongoService.connect();
    }
    
    const adminEmail = 'admin';
    const adminPassword = '12345';
    const adminUsername = 'admin';
    
    // Check if admin user already exists
    const existingUser = await mongoService.findUser(adminEmail);
    if (existingUser) {
      Logger.warn(`⚠️ Admin user with email "${adminEmail}" already exists`);
      Logger.info('   Skipping creation. User ID:', existingUser._id || existingUser.id);
      process.exit(0);
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    
    // Create admin user object
    const adminUser = {
      username: adminUsername,
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      role: 'admin', // Add admin role
      isAdmin: true, // Flag for admin access
    };
    
    // Save to database
    const savedUser = await mongoService.createUser(adminUser);
    
    Logger.success(`✅ Admin user created successfully!`);
    Logger.info(`   Email: ${adminEmail}`);
    Logger.info(`   Username: ${adminUsername}`);
    Logger.info(`   User ID: ${savedUser._id || savedUser.id}`);
    Logger.info(`   Role: admin`);
    
    process.exit(0);
  } catch (error) {
    Logger.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser();

