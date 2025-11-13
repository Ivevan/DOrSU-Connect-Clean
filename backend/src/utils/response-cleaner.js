/**
 * Response Cleaner Utility
 * Removes HTML artifacts and malformed URLs from AI responses
 */

import { Logger } from './logger.js';

export class ResponseCleaner {
  /**
   * Clean HTML artifacts from AI response
   * @param {string} text - Raw AI response text
   * @returns {string} - Cleaned text
   */
  static cleanHTMLArtifacts(text) {
    Logger.info('🧹🧹🧹 STARTING HTML CLEANUP (ULTRA-AGGRESSIVE MODE)...');
    Logger.info('📝 RAW AI Output (first 500 chars):', text.substring(0, 500));
    
    let cleaned = text;
    
    // STEP 0: NUCLEAR OPTION - Remove ALL HTML-like patterns FIRST
    // This catches EVERYTHING before other patterns
    cleaned = this.nuclearStripHTML(cleaned);
    
    // Step 0.1: EMERGENCY - Fix the EXACT pattern from user screenshots
    // Pattern: 2025/07/filename.pdf" class="md-link" target="blank"...
    cleaned = this.emergencyFixBrokenLinks(cleaned);
    
    // Step 0.2: Fix broken annual report links (AI outputting text instead of URL)
    cleaned = this.fixBrokenAnnualReportLinks(cleaned);
    
    // Step 0.3: Validate DOrSU links (prevent hallucinations)
    cleaned = this.validateDOrSULinks(cleaned);
    
    // Step 1: Fix broken HTML patterns - partial URLs with attributes for documents
    cleaned = this.fixBrokenDocumentLinks(cleaned);
    
    // Step 2: Fix partial URLs in general (any path with HTML attributes)
    cleaned = this.fixBrokenURLs(cleaned);
    
    // Step 3: Remove any remaining HTML attributes (aggressive)
    cleaned = this.removeHTMLAttributes(cleaned);
    
    // Step 4: Remove ALL anchor tags
    cleaned = this.removeAnchorTags(cleaned);
    
    // Step 5: Remove trailing quotes, brackets, and > after URLs
    cleaned = this.cleanTrailingCharacters(cleaned);
    
    // Step 6: Remove any remaining HTML tags
    cleaned = this.removeHTMLTags(cleaned);
    
    // Step 7: Remove isolated HTML-related words
    cleaned = this.removeHTMLKeywords(cleaned);
    
    // Step 8: Fix multiple spaces
    cleaned = this.fixSpacing(cleaned);
    
    // Step 9: Fix broken quotes after URLs
    cleaned = this.fixBrokenQuotes(cleaned);
    
    // Step 10: NUCLEAR OPTION - If HTML still detected, run multiple passes
    let maxPasses = 3;
    while (this.hasHTMLArtifacts(cleaned) && maxPasses > 0) {
      Logger.warn(`⚠️⚠️⚠️ HTML STILL DETECTED! Running nuclear cleanup (pass ${4 - maxPasses}/3)...`);
      cleaned = this.nuclearCleanup(cleaned);
      maxPasses--;
    }
    
    Logger.info('✅✅✅ CLEANUP COMPLETE!');
    Logger.info('📤 Sending (first 500 chars):', cleaned.substring(0, 500));
    return cleaned;
  }
  
  /**
   * NUCLEAR OPTION - Strip ALL HTML-like patterns first
   * This is the most aggressive cleanup that runs BEFORE everything else
   */
  static nuclearStripHTML(text) {
    Logger.warn('☢️☢️☢️ NUCLEAR HTML STRIP ACTIVATED');
    
    // Pattern 1: Remove ANY text containing 'class=' or 'target=' or 'rel=' AND the text after >
    text = text.replace(/([^\s]+)(["'][^"']*(?:class|target|rel|href|title)=["'][^"']*["'][^>]*>)([^\n]*)/gi, (match, url, htmlStuff, textAfter) => {
      Logger.warn('  ☢️ Found HTML attributes attached to URL:', match.substring(0, 80));
      const cleanUrl = url.replace(/["'].*$/, '');
      Logger.info('  ✅ Extracted clean URL:', cleanUrl);
      Logger.info('  🗑️ Removed trailing text:', textAfter.substring(0, 50));
      return cleanUrl + '\n';
    });
    
    // Pattern 2: Fix excessive asterisks (****text** → **text**)
    text = text.replace(/\*{4,}([^*]+)\*{2,}/g, '**$1**');
    Logger.info('  🔧 Fixed excessive asterisks');
    
    // Pattern 3: Add line breaks between numbered items that got merged
    // Fixes: Report.pdf2. → Report.pdf\n2.
    text = text.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)(\d+\.)/gi, '.$1\n\n$2');
    Logger.info('  🔧 Fixed merged line breaks');
    
    // Pattern 4: Remove standalone HTML attribute blocks
    text = text.replace(/["']\s*class=["'][^"']*["']\s*target=["'][^"']*["']\s*rel=["'][^"']*["'][^>]*/gi, '');
    
    // Pattern 5: Remove ANY remaining HTML attributes
    text = text.replace(/\s*(?:class|target|rel|href|title)=["'][^"']*["']/gi, '');
    
    // Pattern 6: Remove orphaned quotes after URLs
    text = text.replace(/(https?:\/\/[^\s"'<>]+|[^\s"'<>]+\.(pdf|jpg|png|doc|docx|xls|xlsx))["']/gi, '$1');
    
    // Pattern 7: Remove trailing numbers from file extensions
    text = text.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)\d+/gi, '.$1');
    
    // Pattern 8: Add space between URL and following capital letter
    text = text.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)([A-Z])/gi, '.$1 $2');
    
    // Pattern 9: Remove HTML keywords
    text = text.replace(/\s+(noopener|noreferrer|md-link|_blank|blank)\s+/gi, ' ');
    
    // Pattern 10: Remove angle brackets
    text = text.replace(/[<>]/g, '');
    
    Logger.info('  ☢️ Nuclear strip complete');
    return text;
  }
  
  /**
   * EMERGENCY FIX - Pattern exactly matching user's screenshots
   * Pattern: "2025/07/2021-Annual-Accomplishment-Report.pdf" class="md-link" target="blank" rel="noopener noreferrer" title="Open in new tab">2025 Annual Report
   * Also handles: "...Report.pdf**2024**" class="..." (bold markdown interfering)
   */
  static emergencyFixBrokenLinks(text) {
    // ULTRA-AGGRESSIVE Pattern 0: Match the EXACT broken pattern from screenshot
    // Pattern: Link: 2025/07/filename.pdf2" class="md-link" target="blank"...
    const regex0 = /Link:\s*(\d{4}\/\d{2}\/[^\s"]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))\d*["'][^>]*>/gi;
    
    text = text.replace(regex0, (match, partialUrl, ext) => {
      Logger.warn('🚨🚨🚨 ULTRA-AGGRESSIVE - Found EXACT screenshot pattern:', match.substring(0, 80));
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      Logger.info('  ✅ FIXED TO:', fullUrl);
      return `Link: ${fullUrl}`;
    });
    
    // ULTRA-CRITICAL: Fix numbered list bleeding into URLs (HIGHEST PRIORITY!)
    // Pattern: Report.pdf2. → Report.pdf\n\n2.
    // Pattern: Report.pdf2 → Report.pdf\n\n2
    text = text.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)(\d+)(\.|\s)/gi, (match, ext, num, after) => {
      Logger.warn(`  🚨🚨🚨 CAUGHT numbered list bleeding: ${match} → .${ext}\\n\\n${num}${after}`);
      return `.${ext}\n\n${num}${after}`;
    });
    
    // CRITICAL: Remove ANY remaining text IMMEDIATELY after URLs (bold, asterisks, etc.)
    // Fixes: url.pdf**2024** → url.pdf
    // Fixes: url.pdf** → url.pdf
    text = text.replace(/(https?:\/\/[^\s]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))(\*\*\d*\*\*|\*\*)/gi, '$1');
    Logger.info('  🔧 Removed bold/asterisks after URLs');
    
    // Pattern 1: Year/month/filename with ANY characters (including markdown) before class=
    // Handles: pdf**2024**" class= OR pdf2" class= OR pdf" class=
    const regex1 = /(\d{4}\/\d{2}\/[^\s"]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))[^<\n]*?["']\s*class=[^>]*>([^<\n]*)/gi;
    
    text = text.replace(regex1, (match, partialUrl, ext, linkText) => {
      Logger.warn('🚨 EMERGENCY Pattern 1 - Found broken link with interference:', match.substring(0, 100));
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return `Link: ${fullUrl}`;
    });
    
    // Pattern 2: Partial URL followed by anything then quote and class
    const regex2 = /(\d{4}\/\d{2}\/[^\s"]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))[^\s<]*["']\s+class=/gi;
    text = text.replace(regex2, (match, partialUrl, ext) => {
      Logger.warn('🚨 EMERGENCY Pattern 2 - Found broken link:', match.substring(0, 80));
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return `Link: ${fullUrl} `;
    });
    
    // Pattern 3: wp-content paths with interference
    const regex3 = /(wp-content\/uploads\/[^\s"]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))[^\s<]*["']\s+class=/gi;
    text = text.replace(regex3, (match, partialUrl, ext) => {
      Logger.warn('🚨 EMERGENCY Pattern 3 - Found wp-content broken link');
      const fullUrl = `https://dorsu.edu.ph/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return `Link: ${fullUrl} `;
    });
    
    // Pattern 4: Full https URLs followed by interference and class=
    const regex4 = /(https:\/\/dorsu\.edu\.ph\/[^\s"]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))[^\s<]*["']\s+class=/gi;
    text = text.replace(regex4, (match, fullUrl, ext) => {
      Logger.warn('🚨 EMERGENCY Pattern 4 - Found full URL with HTML cruft');
      Logger.info('  ✅ Cleaned:', fullUrl);
      return `Link: ${fullUrl} `;
    });
    
    return text;
  }
  
  /**
   * Fix broken annual report links where AI outputs text instead of URL
   * Pattern: "2021 Annual Accomplishment Report\n   Link: Annual Report reports document..."
   * Should be: "2021 Annual Accomplishment Report\n   Link: https://dorsu.edu.ph/..."
   */
  static fixBrokenAnnualReportLinks(text) {
    Logger.info('🔧 Checking for broken annual report links...');
    
    // Pattern 1: "YEAR Annual Accomplishment Report" followed by "Link: Annual Report" (without URL)
    const pattern1 = /(\d{4})\s+Annual\s+Accomplishment\s+Report([^\n]*)\n\s*Link:\s*Annual\s+Report(?!\s*https:)/gi;
    
    text = text.replace(pattern1, (match, year, rest) => {
      Logger.warn(`🚨 Found broken ${year} annual report link without URL`);
      const reconstructedUrl = `https://dorsu.edu.ph/wp-content/uploads/2025/07/${year}-Annual-Accomplishment-Report.pdf`;
      Logger.info(`  ✅ Reconstructed: ${reconstructedUrl}`);
      return `${year} Annual Accomplishment Report${rest}\n   Link: ${reconstructedUrl}`;
    });
    
    // Pattern 2: "Link: YEAR Annual Report" without full URL
    const pattern2 = /Link:\s*(\d{4})\s+Annual\s+(?:Accomplishment\s+)?Report(?!\s*https:)/gi;
    
    text = text.replace(pattern2, (match, year) => {
      Logger.warn(`🚨 Found broken ${year} annual report link (pattern 2)`);
      const reconstructedUrl = `https://dorsu.edu.ph/wp-content/uploads/2025/07/${year}-Annual-Accomplishment-Report.pdf`;
      Logger.info(`  ✅ Reconstructed: ${reconstructedUrl}`);
      return `Link: ${reconstructedUrl}`;
    });
    
    // Pattern 3: Just "Annual Report" after "Link:" (generic case)
    const pattern3 = /Link:\s*Annual\s+Report(?!\s*https:)/gi;
    
    if (pattern3.test(text)) {
      Logger.warn('🚨 Found generic "Link: Annual Report" without URL - needs year context');
      // This is harder to fix without year context, but we can at least log it
    }
    
    return text;
  }
  
  /**
   * Validate DOrSU links - ensure they're properly formatted and not hallucinated
   * Valid formats:
   * - https://dorsu.edu.ph/...
   * - https://www.facebook.com/dorsuofficial
   * Invalid: partial URLs, wrong domains
   */
  static validateDOrSULinks(text) {
    // Find all URL-like patterns
    const urlPattern = /(?:Link:|Visit:|Website:|URL:)\s*([^\s\n]+)/gi;
    
    text = text.replace(urlPattern, (match, url) => {
      // Check if it's a valid complete URL
      if (url.startsWith('https://dorsu.edu.ph/') || 
          url.startsWith('https://www.facebook.com/dorsu') ||
          url.startsWith('https://facebook.com/dorsu')) {
        // Valid URL - keep as is
        return match;
      }
      
      // Check if it's a partial path that needs completion
      if (url.match(/^\d{4}\/\d{2}\//)) {
        // Year/month path - complete it
        Logger.warn('⚠️ Found partial URL, completing:', url);
        const completeUrl = `https://dorsu.edu.ph/wp-content/uploads/${url}`;
        Logger.info('  ✅ Completed to:', completeUrl);
        return match.replace(url, completeUrl);
      }
      
      if (url.startsWith('wp-content/')) {
        // wp-content path - complete it
        Logger.warn('⚠️ Found wp-content partial URL, completing:', url);
        const completeUrl = `https://dorsu.edu.ph/${url}`;
        Logger.info('  ✅ Completed to:', completeUrl);
        return match.replace(url, completeUrl);
      }
      
      // If it's not a recognized pattern, log warning
      if (!url.startsWith('https://')) {
        Logger.warn('🔴 POSSIBLE HALLUCINATED LINK:', url);
      }
      
      return match;
    });
    
    return text;
  }
  
  /**
   * Fix broken PDF/document links with HTML attributes
   */
  static fixBrokenDocumentLinks(text) {
    // Pattern 1: Most common - partial URL with quotes and HTML attributes
    const pattern1 = /([^\s"<>]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))["']\s*class=["'][^"']*["']\s*target=["'][^"']*["']\s*rel=["'][^"']*["'][^>]*>([^\n<]+)/gi;
    
    text = text.replace(pattern1, (match, partialUrl, ext, linkText) => {
      Logger.warn('🔴 Pattern 1 - Found broken PDF/document link:', partialUrl);
      const fullUrl = partialUrl.startsWith('http') 
        ? partialUrl 
        : `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return fullUrl;
    });
    
    // Pattern 2: URL followed by quote and class attribute
    const pattern2 = /([^\s"<>]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))["']\s+class=/gi;
    text = text.replace(pattern2, (match, partialUrl) => {
      Logger.warn('🔴 Pattern 2 - Found broken link:', partialUrl);
      const fullUrl = partialUrl.startsWith('http') 
        ? partialUrl 
        : `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return fullUrl + ' ';
    });
    
    return text;
  }
  
  /**
   * Fix partial URLs with HTML attributes
   */
  static fixBrokenURLs(text) {
    // Pattern 1: Full pattern with all HTML attributes
    const pattern1 = /([^\s"<>]+\/[^\s"<>]+)["']\s*class=["'][^"']*["']\s*target=["'][^"']*["']\s*rel=["'][^"']*["'][^>]*>([^\n<]+)/gi;
    
    text = text.replace(pattern1, (match, partialUrl, linkText) => {
      Logger.warn('🔴 Pattern 1 - Found broken URL:', partialUrl);
      const fullUrl = partialUrl.startsWith('http') 
        ? partialUrl 
        : `https://dorsu.edu.ph/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return fullUrl;
    });
    
    // Pattern 2: Date-based paths (2025/07/filename)
    const pattern2 = /(\d{4}\/\d{2}\/[^\s"<>]+)["']\s*class=/gi;
    text = text.replace(pattern2, (match, partialUrl) => {
      Logger.warn('🔴 Pattern 2 - Found date-based broken URL:', partialUrl);
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return fullUrl + ' ';
    });
    
    // Pattern 3: wp-content paths
    const pattern3 = /(wp-content\/uploads\/[^\s"<>]+)["']\s*class=/gi;
    text = text.replace(pattern3, (match, partialUrl) => {
      Logger.warn('🔴 Pattern 3 - Found wp-content broken URL:', partialUrl);
      const fullUrl = `https://dorsu.edu.ph/${partialUrl}`;
      Logger.info('  ✅ Fixed to:', fullUrl);
      return fullUrl + ' ';
    });
    
    return text;
  }
  
  /**
   * Remove HTML attributes (aggressive - multiple patterns)
   */
  static removeHTMLAttributes(text) {
    // Remove attributes with quotes
    text = text.replace(/\s*class=["'][^"']*["']/gi, '');
    text = text.replace(/\s*target=["'][^"']*["']/gi, '');
    text = text.replace(/\s*rel=["'][^"']*["']/gi, '');
    text = text.replace(/\s*href=["'][^"']*["']/gi, '');
    text = text.replace(/\s*id=["'][^"']*["']/gi, '');
    text = text.replace(/\s*style=["'][^"']*["']/gi, '');
    text = text.replace(/\s*title=["'][^"']*["']/gi, '');
    
    // Remove attributes without quotes
    text = text.replace(/\s+class=[^\s>]+/gi, '');
    text = text.replace(/\s+target=[^\s>]+/gi, '');
    text = text.replace(/\s+rel=[^\s>]+/gi, '');
    text = text.replace(/\s+href=[^\s>]+/gi, '');
    
    // Remove standalone attribute names
    text = text.replace(/\s+(class|target|rel|href|id|style|title)=/gi, ' ');
    
    return text;
  }
  
  /**
   * Remove anchor tags
   */
  static removeAnchorTags(text) {
    return text
      .replace(/<a\s+[^>]*>/gi, '')
      .replace(/<\/a>/gi, '');
  }
  
  /**
   * Clean trailing characters after URLs
   */
  static cleanTrailingCharacters(text) {
    return text.replace(/(https?:\/\/[^\s"'<>)\]]+)["'\s)>\]]+/gi, '$1');
  }
  
  /**
   * Remove HTML tags
   */
  static removeHTMLTags(text) {
    return text.replace(/<[^>]+>/g, '');
  }
  
  /**
   * Remove HTML-related keywords
   */
  static removeHTMLKeywords(text) {
    return text.replace(/\s+(noopener|noreferrer|md-link|_blank|blank|href)\s+/gi, ' ');
  }
  
  /**
   * Fix spacing issues
   */
  static fixSpacing(text) {
    return text.replace(/  +/g, ' ');
  }
  
  /**
   * Fix broken quotes after URLs
   */
  static fixBrokenQuotes(text) {
    return text.replace(/(https?:\/\/[^\s"'<>]+)["']+/g, '$1');
  }
  
  /**
   * Check if text has HTML artifacts
   */
  static hasHTMLArtifacts(text) {
    return /class=|target=|rel=|<a\s/i.test(text);
  }
  
  /**
   * Nuclear cleanup - remove everything between quotes containing HTML keywords
   */
  static nuclearCleanup(text) {
    Logger.warn('🚨 Running NUCLEAR cleanup...');
    
    // Pattern 1: Remove everything from quote+class until the next space
    text = text.replace(/"[\s]*class=["'][^"']*["'][\s]*target=["'][^"']*["'][\s]*rel=["'][^"']*["'][\s]*[^>]*>/gi, '');
    
    // Pattern 2: Remove quoted strings containing HTML keywords
    text = text.replace(/"[^"]*(?:class|target|rel|href|md-link)[^"]*"/gi, '');
    
    // Pattern 3: Remove HTML attribute patterns without quotes  
    text = text.replace(/\s+(?:class|target|rel|href|title)=[^\s]+/gi, '');
    
    // Pattern 4: Remove standalone HTML keywords that appear after URLs
    text = text.replace(/(https?:\/\/[^\s"'<>]+)\s+class=/gi, '$1 ');
    text = text.replace(/(https?:\/\/[^\s"'<>]+)["']\s+class=/gi, '$1 ');
    
    // Pattern 5: Remove all variations of class/target/rel
    text = text.replace(/class=["'][^"']*["']/gi, '');
    text = text.replace(/target=["'][^"']*["']/gi, '');
    text = text.replace(/rel=["'][^"']*["']/gi, '');
    text = text.replace(/title=["'][^"']*["']/gi, '');
    text = text.replace(/href=["'][^"']*["']/gi, '');
    
    // Pattern 6: Remove md-link references
    text = text.replace(/["']md-link["']/gi, '');
    text = text.replace(/md-link/gi, '');
    text = text.replace(/["']blank["']/gi, '');
    text = text.replace(/["']noopener noreferrer["']/gi, '');
    
    // Pattern 7: Clean up any quote followed immediately by space and attribute
    text = text.replace(/["']\s+(class|target|rel|href|title)=/gi, ' ');
    
    // Pattern 8: Remove "Open in new tab" text artifacts
    text = text.replace(/["']Open in new tab["']/gi, '');
    
    Logger.info('✅ Nuclear cleanup complete');
    return text;
  }
}

export default ResponseCleaner;

