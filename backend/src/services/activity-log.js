/**
 * Activity Log Service
 * Handles logging and retrieval of user activities
 */

import { Logger } from '../utils/logger.js';

export class ActivityLogService {
  constructor(mongoService) {
    this.mongoService = mongoService;
  }

  /**
   * Log a user activity
   * @param {string} userId - User ID who performed the action
   * @param {string} action - Action type
   * @param {object} details - Action-specific details
   * @param {object} metadata - Additional metadata (ipAddress, userAgent, timestamp)
   */
  async logActivity(userId, action, details = {}, metadata = {}) {
    try {
      if (!this.mongoService) {
        Logger.warn('MongoDB service not available, skipping activity log');
        return null;
      }

      return await this.mongoService.logActivity(userId, action, details, metadata);
    } catch (error) {
      Logger.error('ActivityLogService: Failed to log activity:', error);
      // Don't throw - logging failures shouldn't break the main flow
      return null;
    }
  }

  /**
   * Get activity logs with filtering
   * @param {object} filters - Filter options
   * @param {number} limit - Maximum number of results
   * @param {number} skip - Number of results to skip
   * @returns {Promise<object>} Object with logs and total count
   */
  async getActivityLogs(filters = {}, limit = 100, skip = 0) {
    try {
      if (!this.mongoService) {
        Logger.warn('MongoDB service not available');
        return { logs: [], total: 0 };
      }

      const logs = await this.mongoService.getActivityLogs(filters, limit, skip);
      const total = await this.mongoService.getActivityLogCount(filters);

      return { logs, total };
    } catch (error) {
      Logger.error('ActivityLogService: Failed to get activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity logs for a specific user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of results
   * @param {number} skip - Number of results to skip
   * @returns {Promise<object>} Object with logs and total count
   */
  async getActivityLogsByUser(userId, limit = 100, skip = 0) {
    return this.getActivityLogs({ userId }, limit, skip);
  }

  /**
   * Get activity logs by action type
   * @param {string} action - Action type
   * @param {number} limit - Maximum number of results
   * @param {number} skip - Number of results to skip
   * @returns {Promise<object>} Object with logs and total count
   */
  async getActivityLogsByAction(action, limit = 100, skip = 0) {
    return this.getActivityLogs({ action }, limit, skip);
  }
}

