/**
 * DOrSU News Scraper Service
 * Scrapes news and updates from the official DOrSU website
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from '../utils/logger.js';

export class NewsScraperService {
  constructor(mongoService = null) {
    this.mongoService = mongoService;
    this.baseUrl = 'https://dorsu.edu.ph';
    this.newsUrl = 'https://dorsu.edu.ph/news/';
    this.lastScrapeTime = null;
    this.cachedNews = [];
    this.scrapeInterval = 3600000; // 1 hour in milliseconds
  }

  /**
   * Scrape news from DOrSU website
   */
  async scrapeNews() {
    try {
      Logger.info('🌐 Scraping news from DOrSU website...');
      
      const response = await axios.get(this.baseUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const newsItems = [];

      // Scrape news items from the homepage
      $('.news-item, .post, article, .entry').each((index, element) => {
        try {
          const $item = $(element);
          
          // Skip if this element is an image or contains only images
          if ($item.is('img') || $item.prop('tagName') === 'IMG') {
            return; // Skip image elements
          }
          
          // Extract title - get text only, no HTML
          let title = $item.find('h3, h2, .entry-title, .post-title').first().text().trim();
          
          // If no title from headers, try the first link text (but not images)
          if (!title || title.length < 5) {
            const $link = $item.find('a').not('a img').first();
            title = $link.text().trim();
          }
          
          // Clean title: remove HTML tags, attributes, and artifacts
          title = title.replace(/<[^>]*>/g, ''); // Remove HTML tags
          title = title.replace(/\s+/g, ' ').trim(); // Clean whitespace
          
          // Skip if title contains HTML-like patterns or is too short
          const hasHTMLArtifacts = /(<|>|class=|src=|href=|img|loading|lazy|decoding)/i.test(title);
          if (hasHTMLArtifacts || title.length < 10) {
            return; // Skip invalid titles
          }
          
          // Extract link - get the most complete URL possible
          let link = $item.find('a').not('a:has(img)').first().attr('href');
          
          // Skip if link is an image
          if (link && (link.includes('.jpg') || link.includes('.png') || link.includes('.gif') || link.includes('.jpeg'))) {
            return; // Skip image links
          }
          
          // Clean and normalize the link
          if (link) {
            link = link.trim();
            
            // Remove any fragments or query parameters that might be broken
            if (link.includes('?')) {
              link = link.split('?')[0];
            }
            if (link.includes('#')) {
              link = link.split('#')[0];
            }
            
            // Ensure it's a complete URL
            if (link.startsWith('/')) {
              link = this.baseUrl + link;
            } else if (!link.startsWith('http')) {
              link = this.baseUrl + '/' + link;
            }
            
            // Ensure trailing slash for consistency (but not for PDFs)
            if (!link.endsWith('/') && !link.includes('.pdf')) {
              link = link + '/';
            }
          }
          
          // Extract date - text only
          const dateText = $item.find('.date, .post-date, time, .published').first().text().trim();
          
          // Extract excerpt/description - text only, no HTML
          let excerpt = $item.find('p, .excerpt, .post-excerpt, .entry-summary').first().text().trim();
          excerpt = excerpt.replace(/<[^>]*>/g, ''); // Remove HTML
          excerpt = excerpt.replace(/\s+/g, ' ').trim(); // Clean whitespace
          
          // Extract author if available - text only
          const author = $item.find('.author, .by-author, .entry-author').first().text().trim();

          // Validate: only add if we have valid text title and link
          const isValidTitle = title && 
                               title.length > 10 && 
                               title.length < 200 &&
                               !title.toLowerCase().includes('skip to content') &&
                               !title.toLowerCase().includes('menu') &&
                               !/^[^a-zA-Z]+$/.test(title); // Must contain letters
          
          const isValidLink = link && 
                             link.startsWith('http') && 
                             !link.includes('.jpg') && 
                             !link.includes('.png');
          
          if (isValidTitle && isValidLink) {
            newsItems.push({
              title: title,
              link: link,
              date: dateText || 'Recent',
              excerpt: excerpt ? excerpt.substring(0, 150) : 'Click to read more',
              author: author || 'DOrSU-PIO',
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          Logger.warn('Error parsing news item:', err.message);
        }
      });

      // If no news found with above selectors, try alternative approach
      if (newsItems.length === 0) {
        $('h3, h2').each((index, element) => {
          const $heading = $(element);
          
          // Get text only, no HTML
          let title = $heading.text().trim();
          
          // Clean title: remove HTML tags and artifacts
          title = title.replace(/<[^>]*>/g, '');
          title = title.replace(/\s+/g, ' ').trim();
          
          // Skip if title contains HTML-like patterns
          const hasHTMLArtifacts = /(<|>|class=|src=|href=|img|loading|lazy|decoding)/i.test(title);
          if (hasHTMLArtifacts) {
            return; // Skip invalid titles
          }
          
          let link = $heading.find('a').attr('href') || $heading.parent('a').attr('href');
          
          // Skip if link is an image
          if (link && (link.includes('.jpg') || link.includes('.png') || link.includes('.gif') || link.includes('.jpeg'))) {
            return;
          }
          
          // Clean and normalize the link
          if (link) {
            link = link.trim();
            
            // Remove fragments and query params
            if (link.includes('?')) {
              link = link.split('?')[0];
            }
            if (link.includes('#')) {
              link = link.split('#')[0];
            }
            
            if (link.startsWith('/')) {
              link = this.baseUrl + link;
            } else if (!link.startsWith('http')) {
              link = this.baseUrl + '/' + link;
            }
            
            // Ensure trailing slash
            if (!link.endsWith('/') && !link.includes('.pdf')) {
              link = link + '/';
            }
          }
          
          // Validate before adding
          const isValidTitle = title && 
                               title.length > 10 && 
                               title.length < 200 &&
                               !title.toLowerCase().includes('about') && 
                               !title.toLowerCase().includes('vision') &&
                               !title.toLowerCase().includes('menu') &&
                               !/^[^a-zA-Z]+$/.test(title);
          
          const isValidLink = link && 
                             link.startsWith('http') && 
                             !link.includes('.jpg') && 
                             !link.includes('.png');
          
          if (isValidTitle && isValidLink) {
            newsItems.push({
              title: title,
              link: link,
              date: 'Recent',
              excerpt: 'Click to read more',
              author: 'DOrSU-PIO',
              scrapedAt: new Date().toISOString()
            });
          }
        });
      }

      // Limit to 15 most recent news items
      const limitedNews = newsItems.slice(0, 15);
      
      this.cachedNews = limitedNews;
      this.lastScrapeTime = new Date();

      Logger.success(`✅ Scraped ${limitedNews.length} news items from DOrSU website`);

      // Save to MongoDB if available
      if (this.mongoService && limitedNews.length > 0) {
        await this.saveNewsToMongo(limitedNews);
      }

      return {
        success: true,
        count: limitedNews.length,
        news: limitedNews,
        scrapedAt: this.lastScrapeTime
      };

    } catch (error) {
      Logger.error('Failed to scrape news:', error.message);
      return {
        success: false,
        error: error.message,
        news: this.cachedNews // Return cached news if scraping fails
      };
    }
  }

  /**
   * Save news to MongoDB
   */
  async saveNewsToMongo(newsItems) {
    try {
      const collection = this.mongoService.db.collection('news');
      
      // Clear old news
      await collection.deleteMany({});
      
      // Filter and validate items before saving
      const validItems = newsItems.filter(item => {
        // Final validation: ensure no HTML artifacts in title
        const hasHTML = /<|>|class=|src=|href=/i.test(item.title);
        return !hasHTML && item.title && item.link;
      });
      
      // Insert new news with metadata
      const newsDocuments = validItems.map((item, index) => {
        const id = this.generateNewsId(item.title, index);
        return {
          ...item,
          _id: id,
          updatedAt: new Date()
        };
      });

      if (newsDocuments.length > 0) {
        await collection.insertMany(newsDocuments);
        Logger.success(`💾 Saved ${newsDocuments.length} news items to MongoDB`);
      } else {
        Logger.warn('⚠️ No valid news items to save to MongoDB');
      }
    } catch (error) {
      Logger.error('Failed to save news to MongoDB:', error.message);
    }
  }

  /**
   * Generate unique ID for news item
   * @param {string} title - News title
   * @param {number} index - Index for uniqueness
   */
  generateNewsId(title, index = 0) {
    // Clean title first: remove any remaining HTML, special chars
    let cleanTitle = title
      .toLowerCase()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^a-z0-9\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim()
      .substring(0, 50); // Limit length
    
    // Remove leading/trailing hyphens
    cleanTitle = cleanTitle.replace(/^-+|-+$/g, '');
    
    // Ensure ID is not empty and is valid
    if (!cleanTitle || cleanTitle.length < 5) {
      cleanTitle = `news-item-${Date.now()}-${index}`;
    }
    
    // Add index for uniqueness
    return index > 0 ? `${cleanTitle}-${index}` : cleanTitle;
  }

  /**
   * Get news from cache or MongoDB
   */
  async getNews() {
    try {
      // Try MongoDB first
      if (this.mongoService) {
        const collection = this.mongoService.db.collection('news');
        const newsFromDb = await collection.find({}).sort({ scrapedAt: -1 }).limit(15).toArray();
        
        if (newsFromDb.length > 0) {
          Logger.info(`📰 Retrieved ${newsFromDb.length} news items from MongoDB`);
          return newsFromDb;
        }
      }

      // Fallback to cached news
      if (this.cachedNews.length > 0) {
        Logger.info(`📰 Retrieved ${this.cachedNews.length} news items from cache`);
        return this.cachedNews;
      }

      // If no cached news, scrape fresh
      const result = await this.scrapeNews();
      return result.news || [];

    } catch (error) {
      Logger.error('Failed to get news:', error.message);
      return this.cachedNews;
    }
  }

  /**
   * Format news for AI response
   */
  formatNewsForAI(newsItems) {
    if (!newsItems || newsItems.length === 0) {
      return 'No recent news available.';
    }

    let formatted = '# Recent DOrSU News & Updates\n\n';
    
    newsItems.forEach((item, index) => {
      formatted += `${index + 1}. **${item.title}**\n`;
      formatted += `   Date: ${item.date}\n`;
      if (item.excerpt && item.excerpt !== 'Click to read more') {
        formatted += `   ${item.excerpt}\n`;
      }
      formatted += `   Link: ${item.link}\n\n`;
    });

    formatted += `\nLast updated: ${new Date().toLocaleDateString()}\n`;
    formatted += `Source: ${this.baseUrl}`;

    return formatted;
  }

  /**
   * Start auto-scraping (runs periodically)
   */
  startAutoScraping() {
    // Initial scrape
    this.scrapeNews();

    // Set up periodic scraping (every hour)
    setInterval(async () => {
      Logger.info('⏰ Auto-scraping DOrSU news...');
      await this.scrapeNews();
    }, this.scrapeInterval);

    Logger.success('🔄 Auto-scraping enabled (every 1 hour)');
  }

  /**
   * Check if news needs refresh
   */
  needsRefresh() {
    if (!this.lastScrapeTime) return true;
    
    const timeSinceLastScrape = Date.now() - this.lastScrapeTime.getTime();
    return timeSinceLastScrape > this.scrapeInterval;
  }
}

// Singleton instance
let newsScraper = null;

export function getNewsScraperService(mongoService = null) {
  if (!newsScraper) {
    newsScraper = new NewsScraperService(mongoService);
  }
  return newsScraper;
}

export default NewsScraperService;

