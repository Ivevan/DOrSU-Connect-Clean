import AdminDataService from '../AdminDataService';

describe('AdminDataService', () => {
  beforeEach(() => {
    // Reset any mocks if needed
    jest.clearAllMocks();
  });

  describe('getPosts', () => {
    it('should return an array of posts', async () => {
      const posts = await AdminDataService.getPosts();
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });

    it('should return posts sorted with pinned first', async () => {
      const posts = await AdminDataService.getPosts();
      const pinnedIndex = posts.findIndex(p => p.isPinned);
      const unpinnedIndex = posts.findIndex(p => !p.isPinned);
      
      if (pinnedIndex !== -1 && unpinnedIndex !== -1) {
        expect(pinnedIndex).toBeLessThan(unpinnedIndex);
      }
    });

    it('should return posts sorted by date (newest first) within pinned/unpinned groups', async () => {
      const posts = await AdminDataService.getPosts();
      
      // Check pinned posts are sorted by date
      const pinnedPosts = posts.filter(p => p.isPinned);
      for (let i = 0; i < pinnedPosts.length - 1; i++) {
        const current = new Date(pinnedPosts[i].isoDate || pinnedPosts[i].date).getTime();
        const next = new Date(pinnedPosts[i + 1].isoDate || pinnedPosts[i + 1].date).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('getPostById', () => {
    it('should return a post when given a valid id', async () => {
      const posts = await AdminDataService.getPosts();
      if (posts.length > 0) {
        const firstPost = posts[0];
        const foundPost = await AdminDataService.getPostById(firstPost.id);
        expect(foundPost).toBeDefined();
        expect(foundPost.id).toBe(firstPost.id);
      }
    });

    it('should return null when given an invalid id', async () => {
      const result = await AdminDataService.getPostById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle numeric id strings', async () => {
      const posts = await AdminDataService.getPosts();
      if (posts.length > 0) {
        const firstPost = posts[0];
        const foundPost = await AdminDataService.getPostById(Number(firstPost.id));
        expect(foundPost).toBeDefined();
        expect(foundPost.id).toBe(firstPost.id);
      }
    });
  });

  describe('createPost', () => {
    it('should create a new post with required fields', async () => {
      const newPost = {
        title: 'Test Post',
        description: 'Test Description',
        category: 'Test',
        date: 'Nov 10, 2025',
      };

      const created = await AdminDataService.createPost(newPost);
      expect(created).toBeDefined();
      expect(created.title).toBe(newPost.title);
      expect(created.description).toBe(newPost.description);
      expect(created.category).toBe(newPost.category);
      expect(created.id).toBeDefined();
    });

    it('should use default values for missing fields', async () => {
      const created = await AdminDataService.createPost({});
      expect(created.title).toBe('Untitled');
      expect(created.description).toBe('');
      expect(created.category).toBe('General');
      expect(created.isPinned).toBe(false);
      expect(created.isUrgent).toBe(false);
      expect(created.source).toBe('Admin');
    });

    it('should normalize images array', async () => {
      const newPost = {
        title: 'Test Post',
        images: ['image1.jpg', 'image2.jpg'],
      };

      const created = await AdminDataService.createPost(newPost);
      expect(Array.isArray(created.images)).toBe(true);
      expect(created.images.length).toBe(2);
      expect(created.image).toBe('image1.jpg');
    });

    it('should handle single image string', async () => {
      const newPost = {
        title: 'Test Post',
        images: 'single-image.jpg',
      };

      const created = await AdminDataService.createPost(newPost);
      expect(Array.isArray(created.images)).toBe(true);
      expect(created.images.length).toBe(1);
      expect(created.image).toBe('single-image.jpg');
    });

    it('should generate isoDate from date string', async () => {
      const newPost = {
        title: 'Test Post',
        date: 'Nov 10, 2025',
      };

      const created = await AdminDataService.createPost(newPost);
      expect(created.isoDate).toBeDefined();
      expect(typeof created.isoDate).toBe('string');
    });
  });

  describe('updatePost', () => {
    it('should update an existing post', async () => {
      const posts = await AdminDataService.getPosts();
      if (posts.length > 0) {
        const postToUpdate = posts[0];
        const updates = {
          title: 'Updated Title',
          description: 'Updated Description',
        };

        const updated = await AdminDataService.updatePost(postToUpdate.id, updates);
        expect(updated).toBeDefined();
        expect(updated.title).toBe(updates.title);
        expect(updated.description).toBe(updates.description);
        expect(updated.id).toBe(postToUpdate.id);
      }
    });

    it('should return null when updating non-existent post', async () => {
      const result = await AdminDataService.updatePost('non-existent-id', { title: 'New Title' });
      expect(result).toBeNull();
    });

    it('should preserve existing fields when not updating them', async () => {
      const posts = await AdminDataService.getPosts();
      if (posts.length > 0) {
        const postToUpdate = posts[0];
        const originalCategory = postToUpdate.category;
        const updates = { title: 'Updated Title' };

        const updated = await AdminDataService.updatePost(postToUpdate.id, updates);
        expect(updated.category).toBe(originalCategory);
      }
    });

    it('should update boolean flags correctly', async () => {
      const posts = await AdminDataService.getPosts();
      if (posts.length > 0) {
        const postToUpdate = posts[0];
        const updates = {
          isPinned: true,
          isUrgent: false,
        };

        const updated = await AdminDataService.updatePost(postToUpdate.id, updates);
        expect(updated.isPinned).toBe(true);
        expect(updated.isUrgent).toBe(false);
      }
    });
  });

  describe('deletePost', () => {
    it('should delete an existing post', async () => {
      // First create a post to delete
      const newPost = await AdminDataService.createPost({
        title: 'Post to Delete',
        description: 'This will be deleted',
      });

      const result = await AdminDataService.deletePost(newPost.id);
      expect(result).toBe(true);

      // Verify it's deleted
      const found = await AdminDataService.getPostById(newPost.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent post', async () => {
      const result = await AdminDataService.deletePost('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('togglePin', () => {
    it('should toggle pin status of a post', async () => {
      const posts = await AdminDataService.getPosts();
      if (posts.length > 0) {
        const postToToggle = posts[0];
        const originalPinStatus = postToToggle.isPinned;

        const updated = await AdminDataService.togglePin(postToToggle.id);
        expect(updated).toBeDefined();
        expect(updated.isPinned).toBe(!originalPinStatus);
      }
    });

    it('should return null when toggling non-existent post', async () => {
      const result = await AdminDataService.togglePin('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard statistics', async () => {
      const dashboard = await AdminDataService.getDashboard();
      expect(dashboard).toBeDefined();
      expect(typeof dashboard.totalUpdates).toBe('number');
      expect(typeof dashboard.pinned).toBe('number');
      expect(typeof dashboard.urgent).toBe('number');
      expect(Array.isArray(dashboard.recentUpdates)).toBe(true);
    });

    it('should return correct counts', async () => {
      const dashboard = await AdminDataService.getDashboard();
      const posts = await AdminDataService.getPosts();

      expect(dashboard.totalUpdates).toBe(posts.length);
      expect(dashboard.pinned).toBe(posts.filter(p => p.isPinned).length);
      expect(dashboard.urgent).toBe(posts.filter(p => p.isUrgent).length);
    });

    it('should return recent updates sorted by date', async () => {
      const dashboard = await AdminDataService.getDashboard();
      const recentUpdates = dashboard.recentUpdates;

      if (recentUpdates.length > 1) {
        for (let i = 0; i < recentUpdates.length - 1; i++) {
          const current = new Date(recentUpdates[i].date).getTime();
          const next = new Date(recentUpdates[i + 1].date).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('should limit recent updates to 20', async () => {
      const dashboard = await AdminDataService.getDashboard();
      expect(dashboard.recentUpdates.length).toBeLessThanOrEqual(20);
    });

    it('should map post properties correctly', async () => {
      const dashboard = await AdminDataService.getDashboard();
      if (dashboard.recentUpdates.length > 0) {
        const update = dashboard.recentUpdates[0];
        expect(update).toHaveProperty('title');
        expect(update).toHaveProperty('date');
        expect(update).toHaveProperty('tag');
        expect(update).toHaveProperty('description');
        expect(update).toHaveProperty('pinned');
        expect(update).toHaveProperty('source');
      }
    });
  });
});

