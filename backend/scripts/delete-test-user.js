/**
 * Script to delete a test user from both Firebase and MongoDB
 * Usage: node scripts/delete-test-user.js <email>
 * Example: node scripts/delete-test-user.js test@example.com
 */

import { getMongoDBService } from '../src/services/mongodb.js';
import { Logger } from '../src/utils/logger.js';

async function deleteTestUser(email) {
  try {
    if (!email) {
      Logger.error('❌ Please provide an email address');
      Logger.info('Usage: node scripts/delete-test-user.js <email>');
      Logger.info('Example: node scripts/delete-test-user.js test@example.com');
      process.exit(1);
    }

    Logger.info(`🗑️ Starting deletion process for: ${email}`);
    
    const mongoService = getMongoDBService();
    
    // Ensure MongoDB is connected
    if (!mongoService.isConnected) {
      await mongoService.connect();
    }
    
    // Find user by email
    const user = await mongoService.findUser(email.toLowerCase());
    
    if (!user) {
      Logger.warn(`⚠️ User not found in MongoDB: ${email}`);
      Logger.info('   The user may only exist in Firebase. Please delete from Firebase Console manually.');
      Logger.info('   Firebase Console → Authentication → Users → Find user → Delete');
      process.exit(0);
    }
    
    const userId = user._id || user.id;
    Logger.info(`📋 Found user in MongoDB: ${userId}`);
    
    // Delete user from MongoDB
    const result = await mongoService.deleteUser(userId);
    
    if (result.success) {
      Logger.success(`✅ User deleted from MongoDB: ${email}`);
      Logger.info(`   User ID: ${userId}`);
      Logger.info('');
      Logger.info('⚠️ IMPORTANT: You also need to delete the user from Firebase Console:');
      Logger.info('   1. Go to Firebase Console → Authentication → Users');
      Logger.info(`   2. Search for: ${email}`);
      Logger.info('   3. Click on the user');
      Logger.info('   4. Click "Delete user" button');
      Logger.info('');
      Logger.info('   Or use Firebase CLI:');
      Logger.info(`   firebase auth:users:delete ${email}`);
    } else {
      Logger.error(`❌ Failed to delete user: ${result.message}`);
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    Logger.error('❌ Error deleting test user:', error);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];
deleteTestUser(email);

