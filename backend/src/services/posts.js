/**
 * Posts Service
 * Handles all post/announcement related endpoints and operations
 */

import { Logger } from '../utils/logger.js';
import { parseMultipartFormData } from '../utils/multipart-parser.js';
import { authMiddleware } from './auth.js';
import { getGridFSService } from './gridfs.js';

export class PostService {
  constructor(mongoService, authService) {
    this.mongoService = mongoService;
    this.authService = authService;
    this.port = Number.parseInt(process.env.PORT || '3000', 10);
  }

  /**
   * Helper method to send JSON response
   */
  sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
    res.end(json);
  }

  /**
   * Extract post ID from URL, handling query parameters and trailing slashes
   */
  extractPostId(url) {
    let postId = url.split('/api/admin/posts/')[1];
    if (postId) {
      // Remove query parameters if any
      postId = postId.split('?')[0].split('#')[0];
      // Remove trailing slash if any
      postId = postId.replace(/\/$/, '');
    }
    return postId || null;
  }

  /**
   * Determine base URL from request or environment
   */
  getBaseUrl(req) {
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      // Try to detect from request headers (works for production deployments)
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 
                      (req.connection?.encrypted ? 'https' : 'http') ||
                      'http';
      if (host) {
        baseUrl = `${protocol}://${host}`;
        Logger.info(`📡 Detected base URL from request: ${baseUrl}`);
      } else {
        baseUrl = `http://localhost:${this.port}`;
        Logger.warn(`⚠️ Using fallback localhost URL. Set BASE_URL env var for production!`);
      }
    }
    return baseUrl;
  }

  /**
   * Handle post routes
   * Returns true if the route was handled, false otherwise
   */
  async handleRoute(req, res, method, url, rawUrl) {
    // Create post
    if (method === 'POST' && url === '/api/admin/create-post') {
      return await this.handleCreatePost(req, res);
    }

    // Get posts
    if (method === 'GET' && url === '/api/admin/posts') {
      return await this.handleGetPosts(req, res, rawUrl);
    }

    // Update post (PUT)
    if (method === 'PUT' && url.startsWith('/api/admin/posts/')) {
      return await this.handleUpdatePost(req, res, url);
    }

    // Delete post (DELETE)
    if (method === 'DELETE' && url.startsWith('/api/admin/posts/')) {
      return await this.handleDeletePost(req, res, url);
    }

    // Route not handled by this service
    return false;
  }

  /**
   * Create a new post (event/announcement)
   */
  async handleCreatePost(req, res) {
    Logger.info(`📝 POST /api/admin/create-post - Request received`);
    Logger.info(`📝 Content-Type: ${req.headers['content-type'] || 'missing'}`);
    Logger.info(`📝 Content-Length: ${req.headers['content-length'] || 'missing'}`);
    
    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('❌ Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('❌ Unauthorized request to create-post');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    // Check if user is admin or moderator
    const isAdmin = auth.isAdmin === true;
    const isModerator = auth.role === 'moderator';
    if (!isAdmin && !isModerator) {
      Logger.warn(`❌ Forbidden: User ${auth.userId} (role: ${auth.role || 'user'}) attempted to create post`);
      this.sendJson(res, 403, { error: 'Forbidden: Admin or Moderator access required' });
      return true;
    }

    Logger.info(`✅ Authorization successful for create-post - User: ${auth.userId}, Role: ${auth.role || 'admin'}`);

    try {
      const contentType = req.headers['content-type'] || '';
      Logger.info(`📝 Parsing multipart data, Content-Type: ${contentType}`);
      
      if (!contentType.includes('multipart/form-data')) {
        Logger.warn(`❌ Invalid Content-Type: ${contentType}`);
        this.sendJson(res, 400, { error: 'Content-Type must be multipart/form-data' });
        return true;
      }

      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        Logger.warn('❌ Missing boundary in Content-Type');
        this.sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
        return true;
      }

      Logger.info(`📝 Parsing multipart form data with boundary: ${boundary.substring(0, 20)}...`);
      const parts = await parseMultipartFormData(req, boundary);
      Logger.info(`📝 Parsed ${parts.length} parts from multipart data`);
      parts.forEach((part, index) => {
        Logger.info(`📝 Part ${index + 1}: name=${part.name}, filename=${part.filename || 'none'}, size=${part.data.length} bytes`);
      });
      
      // Extract form fields
      const titlePart = parts.find(p => p.name === 'title');
      const descriptionPart = parts.find(p => p.name === 'description');
      const categoryPart = parts.find(p => p.name === 'category');
      const datePart = parts.find(p => p.name === 'date');
      const imagePart = parts.find(p => p.filename);
      
      Logger.info(`📝 Extracted parts: title=${!!titlePart}, description=${!!descriptionPart}, category=${!!categoryPart}, date=${!!datePart}, image=${!!imagePart}`);

      if (!titlePart || !datePart) {
        this.sendJson(res, 400, { error: 'Title and date are required' });
        return true;
      }

      const title = titlePart.data.toString('utf8').trim();
      const description = descriptionPart ? descriptionPart.data.toString('utf8').trim() : '';
      const category = categoryPart ? categoryPart.data.toString('utf8').trim() : 'General';
      const dateStr = datePart.data.toString('utf8').trim();
      
      // Validate date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        this.sendJson(res, 400, { error: 'Invalid date format' });
        return true;
      }

      // Handle image upload if present using GridFS
      let imageFileId = null;
      if (imagePart) {
        Logger.info(`📸 Image part found: filename=${imagePart.filename}, contentType=${imagePart.contentType}, size=${imagePart.data.length}`);
        try {
          const gridFSService = getGridFSService();
          const imageBuffer = Buffer.from(imagePart.data);
          const imageMimeType = imagePart.contentType || 'image/jpeg';
          const originalFilename = imagePart.filename || `image_${Date.now()}.jpg`;
          
          Logger.info(`📤 Uploading image to GridFS: ${originalFilename}, size: ${imageBuffer.length} bytes`);
          
          // Upload to GridFS
          imageFileId = await gridFSService.uploadImage(
            imageBuffer,
            originalFilename,
            imageMimeType,
            {
              postTitle: title,
              uploadedBy: auth.userId || 'admin',
            }
          );
          
          Logger.success(`📸 Image uploaded to GridFS: ${imageFileId}`);
        } catch (error) {
          Logger.error('❌ Failed to upload image to GridFS:', error);
          Logger.error('Error details:', error.message, error.stack);
          // Continue without image rather than failing the entire post creation
        }
      } else {
        Logger.info('ℹ️ No image part found in request');
      }

      // Create event/announcement document
      const baseUrl = this.getBaseUrl(req);
      
      const event = {
        title,
        description,
        category,
        type: category === 'Event' ? 'event' : 'announcement', // Explicit type field
        date: date.toISOString(),
        isoDate: date.toISOString(),
        imageFileId: imageFileId, // GridFS file ID
        image: imageFileId ? `${baseUrl}/api/images/${imageFileId}` : null, // Full URL for image retrieval
        images: imageFileId ? [`${baseUrl}/api/images/${imageFileId}`] : [],
        source: 'Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: auth.userId || 'admin',
      };
      // Insert into MongoDB posts collection
      const postsCollection = this.mongoService.getCollection('posts');
      const result = await postsCollection.insertOne(event);

      Logger.success(`✅ Event/Announcement created: ${title} (ID: ${result.insertedId})`);

      this.sendJson(res, 200, {
        success: true,
        message: 'Event/Announcement created successfully',
        event: {
          id: result.insertedId.toString(),
          ...event,
        },
      });
      return true;
    } catch (error) {
      Logger.error('Post creation error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to create post' });
      return true;
    }
  }

  /**
   * Get posts from MongoDB
   */
  async handleGetPosts(req, res, rawUrl) {
    Logger.info(`📝 Posts endpoint: GET ${rawUrl}`);
    // Check authentication
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    try {
      const postsCollection = this.mongoService.getCollection('posts');
      
      // Parse query parameters from rawUrl (includes query string)
      const urlParts = rawUrl.split('?');
      const queryParams = urlParts.length > 1 ? new URLSearchParams(urlParts[1]) : new URLSearchParams();
      const limit = parseInt(queryParams.get('limit') || '100', 10);
      const skip = parseInt(queryParams.get('skip') || '0', 10);
      const category = queryParams.get('category');
      
      // Build query
      const query = {};
      if (category) {
        query.category = category;
      }

      // Fetch posts sorted by date (newest first)
      const posts = await postsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      // Convert MongoDB _id to id string
      const formattedPosts = posts.map(post => ({
        id: post._id.toString(),
        title: post.title || '',
        description: post.description || '',
        category: post.category || 'General',
        date: post.date || post.isoDate || new Date().toISOString(),
        isoDate: post.isoDate || post.date || new Date().toISOString(),
        image: post.image || null,
        images: post.images || (post.image ? [post.image] : []),
        imageFileId: post.imageFileId || null,
        type: post.type || (post.category === 'Event' ? 'event' : 'announcement'),
        source: post.source || 'Admin',
        createdAt: post.createdAt || new Date(),
        updatedAt: post.updatedAt || new Date(),
        createdBy: post.createdBy || 'admin',
        isPinned: post.isPinned || false,
        isUrgent: post.isUrgent || false,
      }));

      this.sendJson(res, 200, {
        success: true,
        posts: formattedPosts,
        total: formattedPosts.length,
      });
      return true;
    } catch (error) {
      Logger.error('Failed to get posts:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to fetch posts' });
      return true;
    }
  }

  /**
   * Update a post
   */
  async handleUpdatePost(req, res, url) {
    Logger.info(`📝 PUT /api/admin/posts - Request received`);
    const postId = this.extractPostId(url);
    
    if (!postId || postId.trim() === '') {
      Logger.warn('❌ PUT /api/admin/posts: Post ID missing or empty');
      this.sendJson(res, 400, { error: 'Post ID required' });
      return true;
    }
    
    Logger.info(`📝 PUT /api/admin/posts: Post ID = ${postId}`);

    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('❌ Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('❌ Unauthorized request to update post');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    Logger.info('✅ Authentication successful for update post');

    try {
      const contentType = req.headers['content-type'] || '';
      let updateData = {};
      let imageFileId = null;

      // Handle multipart/form-data (if image is being updated)
      if (contentType.includes('multipart/form-data')) {
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
          this.sendJson(res, 400, { error: 'Missing boundary in Content-Type' });
          return true;
        }

        const parts = await parseMultipartFormData(req, boundary);
        
        // Extract form fields
        const titlePart = parts.find(p => p.name === 'title');
        const descriptionPart = parts.find(p => p.name === 'description');
        const categoryPart = parts.find(p => p.name === 'category');
        const datePart = parts.find(p => p.name === 'date');
        const imagePart = parts.find(p => p.filename);

        if (titlePart) updateData.title = titlePart.data.toString('utf8').trim();
        if (descriptionPart) updateData.description = descriptionPart.data.toString('utf8').trim();
        if (categoryPart) updateData.category = categoryPart.data.toString('utf8').trim();
        if (datePart) {
          const dateStr = datePart.data.toString('utf8').trim();
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            updateData.date = date.toISOString();
            updateData.isoDate = date.toISOString();
          }
        }

        // Handle image upload if present
        if (imagePart) {
          Logger.info(`📸 Image part found for update: filename=${imagePart.filename}, size=${imagePart.data.length}`);
          try {
            const gridFSService = getGridFSService();
            const imageBuffer = Buffer.from(imagePart.data);
            const imageMimeType = imagePart.contentType || 'image/jpeg';
            const originalFilename = imagePart.filename || `image_${Date.now()}.jpg`;
            
            // Upload to GridFS
            imageFileId = await gridFSService.uploadImage(
              imageBuffer,
              originalFilename,
              imageMimeType,
              {
                postTitle: updateData.title || 'Updated Post',
                uploadedBy: auth.userId || 'admin',
              }
            );
            
            // Determine base URL
            const baseUrl = this.getBaseUrl(req);
            
            updateData.imageFileId = imageFileId;
            updateData.image = `${baseUrl}/api/images/${imageFileId}`;
            updateData.images = [`${baseUrl}/api/images/${imageFileId}`];
            
            Logger.success(`📸 Image uploaded to GridFS for update: ${imageFileId}`);
          } catch (error) {
            Logger.error('❌ Failed to upload image to GridFS:', error);
            // Continue without image update
          }
        }
      } else {
        // Handle JSON body (no image update)
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        
        if (chunks.length === 0) {
          this.sendJson(res, 400, { error: 'No request body provided' });
          return true;
        }
        
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          updateData = JSON.parse(body);
        } catch (parseError) {
          Logger.error('Failed to parse JSON body:', parseError);
          this.sendJson(res, 400, { error: 'Invalid JSON body' });
          return true;
        }
      }

      if (Object.keys(updateData).length === 0) {
        this.sendJson(res, 400, { error: 'No update data provided' });
        return true;
      }

      // Update the post in MongoDB
      const postsCollection = this.mongoService.getCollection('posts');
      const { ObjectId } = await import('mongodb');
      
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId);
      } catch (error) {
        Logger.error(`❌ Invalid ObjectId format: ${postId}`, error);
        this.sendJson(res, 400, { error: 'Invalid post ID format' });
        return true;
      }

      updateData.updatedAt = new Date();

      Logger.info(`📝 Updating post in MongoDB: ${postId}`);
      const result = await postsCollection.updateOne(
        { _id: postObjectId },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        Logger.warn(`⚠️ Post not found: ${postId}`);
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }
      
      Logger.info(`✅ Post updated: ${postId}, modifiedCount: ${result.modifiedCount}`);

      // Fetch updated post
      const updatedPost = await postsCollection.findOne({ _id: postObjectId });

      Logger.success(`✅ Post updated: ${postId}`);

      this.sendJson(res, 200, {
        success: true,
        message: 'Post updated successfully',
        post: {
          id: updatedPost._id.toString(),
          title: updatedPost.title || '',
          description: updatedPost.description || '',
          category: updatedPost.category || 'General',
          date: updatedPost.date || updatedPost.isoDate || new Date().toISOString(),
          isoDate: updatedPost.isoDate || updatedPost.date || new Date().toISOString(),
          image: updatedPost.image || null,
          images: updatedPost.images || (updatedPost.image ? [updatedPost.image] : []),
          imageFileId: updatedPost.imageFileId || null,
          type: updatedPost.type || (updatedPost.category === 'Event' ? 'event' : 'announcement'),
          source: updatedPost.source || 'Admin',
          createdAt: updatedPost.createdAt || new Date(),
          updatedAt: updatedPost.updatedAt || new Date(),
          createdBy: updatedPost.createdBy || 'admin',
          isPinned: updatedPost.isPinned || false,
          isUrgent: updatedPost.isUrgent || false,
        },
      });
      return true;
    } catch (error) {
      Logger.error('Post update error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to update post' });
      return true;
    }
  }

  /**
   * Delete a post
   */
  async handleDeletePost(req, res, url) {
    Logger.info(`📝 DELETE /api/admin/posts - Request received`);
    const postId = this.extractPostId(url);
    
    if (!postId || postId.trim() === '') {
      Logger.warn('❌ DELETE /api/admin/posts: Post ID missing or empty');
      this.sendJson(res, 400, { error: 'Post ID required' });
      return true;
    }
    
    Logger.info(`📝 DELETE /api/admin/posts: Post ID = ${postId}`);

    // Check authentication
    if (!this.authService || !this.mongoService) {
      Logger.error('❌ Services not available');
      this.sendJson(res, 503, { error: 'Services not available' });
      return true;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      Logger.warn('❌ Unauthorized request to delete post');
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    Logger.info('✅ Authentication successful for delete post');

    try {
      const postsCollection = this.mongoService.getCollection('posts');
      const { ObjectId } = await import('mongodb');
      
      let postObjectId;
      try {
        postObjectId = new ObjectId(postId);
      } catch (error) {
        Logger.error(`❌ Invalid ObjectId format: ${postId}`, error);
        this.sendJson(res, 400, { error: 'Invalid post ID format' });
        return true;
      }

      Logger.info(`📝 Finding post in MongoDB: ${postId}`);
      // Get post to check for imageFileId before deletion
      const postToDelete = await postsCollection.findOne({ _id: postObjectId });
      
      if (!postToDelete) {
        Logger.warn(`⚠️ Post not found for deletion: ${postId}`);
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }
      
      Logger.info(`✅ Post found for deletion: ${postId}`);

      // Delete image from GridFS if it exists
      if (postToDelete.imageFileId) {
        try {
          const gridFSService = getGridFSService();
          await gridFSService.deleteImage(postToDelete.imageFileId);
          Logger.info(`🗑️ Deleted image from GridFS: ${postToDelete.imageFileId}`);
        } catch (imageError) {
          Logger.warn('⚠️ Failed to delete image from GridFS:', imageError);
          // Continue with post deletion even if image deletion fails
        }
      }

      // Delete the post from MongoDB
      const result = await postsCollection.deleteOne({ _id: postObjectId });

      if (result.deletedCount === 0) {
        this.sendJson(res, 404, { error: 'Post not found' });
        return true;
      }

      Logger.success(`✅ Post deleted: ${postId}`);

      this.sendJson(res, 200, {
        success: true,
        message: 'Post deleted successfully',
      });
      return true;
    } catch (error) {
      Logger.error('Post deletion error:', error);
      this.sendJson(res, 500, { error: error.message || 'Failed to delete post' });
      return true;
    }
  }
}

// Singleton instance
let postServiceInstance = null;

/**
 * Get or create PostService instance
 */
export function getPostService(mongoService, authService) {
  if (!postServiceInstance) {
    postServiceInstance = new PostService(mongoService, authService);
  }
  return postServiceInstance;
}

