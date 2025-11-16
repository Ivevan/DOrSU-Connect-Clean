/**
 * GridFS Service
 * Handles file storage and retrieval using MongoDB GridFS
 * This is the standard way to store large files like images in MongoDB
 */

import { GridFSBucket } from 'mongodb';
import { getMongoDBService } from './mongodb.js';
import { Logger } from '../utils/logger.js';

class GridFSService {
  constructor() {
    this.bucket = null;
    this.bucketName = 'images'; // GridFS bucket name
  }

  /**
   * Initialize GridFS bucket
   */
  async initialize() {
    try {
      const mongoService = getMongoDBService();
      if (!mongoService.isConnected) {
        await mongoService.connect();
      }

      const db = mongoService.db;
      if (!db) {
        throw new Error('MongoDB database not available');
      }

      // Create GridFS bucket
      this.bucket = new GridFSBucket(db, {
        bucketName: this.bucketName,
      });

      Logger.success(`✅ GridFS bucket initialized: ${this.bucketName}`);
      return this.bucket;
    } catch (error) {
      Logger.error('Failed to initialize GridFS:', error);
      throw error;
    }
  }

  /**
   * Get GridFS bucket instance
   */
  async getBucket() {
    if (!this.bucket) {
      await this.initialize();
    }
    return this.bucket;
  }

  /**
   * Upload an image to GridFS
   * @param {Buffer} imageBuffer - Image file buffer
   * @param {string} filename - Original filename
   * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
   * @param {Object} metadata - Additional metadata (optional)
   * @returns {Promise<string>} - GridFS file ID
   */
  async uploadImage(imageBuffer, filename, mimeType, metadata = {}) {
    try {
      const bucket = await this.getBucket();
      
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const extension = filename.split('.').pop() || 'jpg';
      const uniqueFilename = `image_${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;

      return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(uniqueFilename, {
          contentType: mimeType,
          metadata: {
            originalFilename: filename,
            uploadedAt: new Date(),
            ...metadata,
          },
        });

        uploadStream.on('finish', () => {
          const fileId = uploadStream.id.toString();
          Logger.success(`✅ Image uploaded to GridFS: ${uniqueFilename} (ID: ${fileId})`);
          resolve(fileId);
        });

        uploadStream.on('error', (error) => {
          Logger.error('GridFS upload error:', error);
          reject(error);
        });

        // Write buffer to stream
        uploadStream.end(imageBuffer);
      });
    } catch (error) {
      Logger.error('Failed to upload image to GridFS:', error);
      throw error;
    }
  }

  /**
   * Download an image from GridFS
   * @param {string} fileId - GridFS file ID
   * @returns {Promise<{stream: ReadableStream, metadata: Object}>}
   */
  async downloadImage(fileId) {
    try {
      const bucket = await this.getBucket();
      const ObjectId = (await import('mongodb')).ObjectId;

      let objectId;
      try {
        objectId = new ObjectId(fileId);
      } catch (error) {
        throw new Error(`Invalid file ID: ${fileId}`);
      }

      // Check if file exists
      const files = await bucket.find({ _id: objectId }).toArray();
      if (files.length === 0) {
        throw new Error(`File not found: ${fileId}`);
      }

      const file = files[0];
      const downloadStream = bucket.openDownloadStream(objectId);

      return {
        stream: downloadStream,
        metadata: {
          filename: file.filename,
          contentType: file.contentType || 'image/jpeg',
          length: file.length,
          uploadDate: file.uploadDate,
        },
      };
    } catch (error) {
      Logger.error(`Failed to download image from GridFS (ID: ${fileId}):`, error);
      throw error;
    }
  }

  /**
   * Delete an image from GridFS
   * @param {string} fileId - GridFS file ID
   * @returns {Promise<boolean>}
   */
  async deleteImage(fileId) {
    try {
      const bucket = await this.getBucket();
      const ObjectId = (await import('mongodb')).ObjectId;

      let objectId;
      try {
        objectId = new ObjectId(fileId);
      } catch (error) {
        throw new Error(`Invalid file ID: ${fileId}`);
      }

      await bucket.delete(objectId);
      Logger.success(`✅ Image deleted from GridFS: ${fileId}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete image from GridFS (ID: ${fileId}):`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in GridFS
   * @param {string} fileId - GridFS file ID
   * @returns {Promise<boolean>}
   */
  async fileExists(fileId) {
    try {
      const bucket = await this.getBucket();
      const ObjectId = (await import('mongodb')).ObjectId;

      let objectId;
      try {
        objectId = new ObjectId(fileId);
      } catch (error) {
        return false;
      }

      const files = await bucket.find({ _id: objectId }).toArray();
      return files.length > 0;
    } catch (error) {
      Logger.error(`Failed to check file existence (ID: ${fileId}):`, error);
      return false;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - GridFS file ID
   * @returns {Promise<Object>}
   */
  async getFileMetadata(fileId) {
    try {
      const bucket = await this.getBucket();
      const ObjectId = (await import('mongodb')).ObjectId;

      let objectId;
      try {
        objectId = new ObjectId(fileId);
      } catch (error) {
        throw new Error(`Invalid file ID: ${fileId}`);
      }

      const files = await bucket.find({ _id: objectId }).toArray();
      if (files.length === 0) {
        throw new Error(`File not found: ${fileId}`);
      }

      return {
        id: files[0]._id.toString(),
        filename: files[0].filename,
        contentType: files[0].contentType || 'image/jpeg',
        length: files[0].length,
        uploadDate: files[0].uploadDate,
        metadata: files[0].metadata || {},
      };
    } catch (error) {
      Logger.error(`Failed to get file metadata (ID: ${fileId}):`, error);
      throw error;
    }
  }
}

// Singleton instance
let gridFSServiceInstance = null;

/**
 * Get GridFS service instance
 * @returns {GridFSService}
 */
export function getGridFSService() {
  if (!gridFSServiceInstance) {
    gridFSServiceInstance = new GridFSService();
  }
  return gridFSServiceInstance;
}

export default getGridFSService();

