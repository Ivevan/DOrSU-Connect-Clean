/**
 * Markdown Formatter Utility
 * Enhanced markdown formatting inspired by the web version
 * Handles DOrSU-specific link formatting with friendly names
 */

export interface FormattedLink {
  text: string;
  url: string;
  emoji: string;
}

/**
 * Clean HTML artifacts from AI responses
 * This is critical to run FIRST before any other processing
 */
export function cleanHTMLArtifacts(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Pattern 1: Remove md-link class attributes
  cleaned = cleaned.replace(/["']\s*class=["']md-link["'][^>]*>/gi, '');
  
  // Pattern 2: Remove generic class attributes
  cleaned = cleaned.replace(/["']\s*class=[^>]*>/gi, '');
  
  // Pattern 3: Remove HTML attributes
  cleaned = cleaned.replace(/\s*(class|target|rel|href|title)=["'][^"']*["']/gi, '');
  
  // Pattern 4: Remove anchor tags
  cleaned = cleaned.replace(/<\/?a[^>]*>/gi, '');
  
  // Pattern 5: Remove trailing quotes from file extensions
  cleaned = cleaned.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)\d*["']/gi, '.$1');
  
  // Pattern 6: Remove angle brackets
  cleaned = cleaned.replace(/[<>]/g, '');
  
  // Pattern 7: Remove HTML entity names
  cleaned = cleaned.replace(/\s+(noopener|noreferrer|md-link|_blank|blank)\s+/gi, ' ');
  
  // Pattern 8: Fix numbered list bleeding into URLs (Report.pdf2. → Report.pdf)
  cleaned = cleaned.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)(\d+)(\.)/gi, '.$1\n\n$2$3');
  
  // Pattern 9: Remove trailing numbers without period
  cleaned = cleaned.replace(/\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx)(\d+)(\s)/gi, '.$1\n\n$2$3');
  
  return cleaned;
}

/**
 * Complete partial URLs (e.g., 2025/07/file.pdf → https://dorsu.edu.ph/wp-content/uploads/2025/07/file.pdf)
 * CRITICAL: Only complete URLs that aren't already complete to avoid doubling
 */
export function completePartialURLs(text: string): string {
  if (!text) return '';
  
  // Pattern: Complete partial URLs (2025/07/...) but ONLY if not already in a complete URL
  // Negative lookbehind (?<!...) ensures we don't match if already part of a full URL
  return text.replace(
    /(Link:\s*)?(?<!https?:\/\/[^\s]*\/wp-content\/uploads\/)(\d{4}\/\d{2}\/[^\s"<>]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))/gi,
    (match, prefix, partialUrl, ext) => {
      // Double-check: if the match is already preceded by a URL, don't process it
      const precedingText = text.substring(Math.max(0, text.indexOf(match) - 100), text.indexOf(match));
      if (precedingText.includes('https://dorsu.edu.ph/wp-content/uploads/')) {
        // Already complete - return as is
        return match;
      }
      
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      return (prefix || '') + fullUrl;
    }
  );
}

/**
 * Extract and format links from text with friendly display names
 */
export function extractAndFormatLinks(text: string): { text: string; links: FormattedLink[] } {
  const links: FormattedLink[] = [];
  let formattedText = text;
  
  // URL regex to detect all URLs
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
  
  formattedText = formattedText.replace(urlRegex, (url) => {
    const cleanUrl = url.replace(/[.,;:!?]+$/, ''); // Remove trailing punctuation
    const linkInfo = getFriendlyLinkName(cleanUrl);
    
    links.push(linkInfo);
    
    // Return markdown format for react-native-markdown-display
    return `[${linkInfo.text}](${linkInfo.url})`;
  });
  
  return { text: formattedText, links };
}

/**
 * Get friendly display name for URLs with appropriate emoji
 */
export function getFriendlyLinkName(url: string): FormattedLink {
  const cleanUrl = url.trim();
  
  // Grade Inquiry Manual
  if (cleanUrl.includes('heyzine.com/flip-book/921ebac285')) {
    return {
      text: 'Grade Inquiry Manual',
      url: cleanUrl,
      emoji: '📖'
    };
  }
  
  // Pre-Admission User Manual
  if (cleanUrl.includes('heyzine.com/flip-book/9b5fdf090b')) {
    return {
      text: 'Pre-Admission User Manual',
      url: cleanUrl,
      emoji: '📖'
    };
  }
  
  // Annual Accomplishment Reports
  if (cleanUrl.includes('/wp-content/uploads/') && cleanUrl.includes('Annual')) {
    // Extract year from FILENAME (e.g., 2024-Annual-Accomplishment-Report.pdf)
    const filenameMatch = cleanUrl.match(/\/(\d{4})-Annual-Accomplishment-Report\.pdf$/i);
    if (filenameMatch) {
      const reportYear = filenameMatch[1];
      return {
        text: `${reportYear} Annual Report`,
        url: cleanUrl,
        emoji: '📄'
      };
    }
    return {
      text: 'Annual Report',
      url: cleanUrl,
      emoji: '📄'
    };
  }
  
  // News articles
  if (cleanUrl.includes('dorsu.edu.ph/news/')) {
    const newsMatch = cleanUrl.match(/\/news\/([^\/]+)\/?$/);
    if (newsMatch) {
      // Convert URL slug to readable title
      const slug = newsMatch[1];
      const title = slug
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      return {
        text: title,
        url: cleanUrl,
        emoji: '📰'
      };
    }
    return {
      text: 'News Article',
      url: cleanUrl,
      emoji: '📰'
    };
  }
  
  // Generic DOrSU website
  if (cleanUrl.includes('dorsu.edu.ph')) {
    return {
      text: 'DOrSU Website',
      url: cleanUrl,
      emoji: '🌐'
    };
  }
  
  // PDF files
  if (cleanUrl.match(/\.pdf$/i)) {
    const filename = cleanUrl.split('/').pop()?.replace('.pdf', '');
    if (filename) {
      return {
        text: filename.replace(/-/g, ' '),
        url: cleanUrl,
        emoji: '📄'
      };
    }
    return {
      text: 'PDF Document',
      url: cleanUrl,
      emoji: '📄'
    };
  }
  
  // Image files
  if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return {
      text: 'Image',
      url: cleanUrl,
      emoji: '🖼️'
    };
  }
  
  // Long URLs - truncate
  if (cleanUrl.length > 50) {
    return {
      text: cleanUrl.substring(0, 45) + '...',
      url: cleanUrl,
      emoji: '🔗'
    };
  }
  
  // Default - use URL as is
  return {
    text: cleanUrl,
    url: cleanUrl,
    emoji: '🔗'
  };
}

/**
 * Fix broken annual report links where AI outputs text instead of URL
 * Handles cases like: "Link: Annual Report reports document..." → proper URL
 */
export function fixBrokenAnnualReportLinks(text: string): string {
  if (!text) return '';
  
  // Pattern 1: "Link: Annual Report" without URL (usually followed by descriptive text)
  // This happens when AI forgets to output the actual URL
  // We need to look for year context to reconstruct the URL
  
  // Match patterns like:
  // "2021 Annual Accomplishment Report\n   Link: Annual Report reports document..."
  const pattern1 = /(\d{4})\s+Annual\s+Accomplishment\s+Report[^\n]*\n\s*Link:\s*Annual\s+Report(?!\s*https:)/gi;
  
  text = text.replace(pattern1, (match, year) => {
    const reconstructedUrl = `https://dorsu.edu.ph/wp-content/uploads/2025/07/${year}-Annual-Accomplishment-Report.pdf`;
    console.log(`🔧 Fixed broken ${year} annual report link → ${reconstructedUrl}`);
    return `${year} Annual Accomplishment Report\n   Link: ${reconstructedUrl}`;
  });
  
  // Pattern 2: "Link: 2021 Annual Report" without full URL
  const pattern2 = /Link:\s*(\d{4})\s+Annual\s+Report(?!\s*https:)/gi;
  
  text = text.replace(pattern2, (match, year) => {
    const reconstructedUrl = `https://dorsu.edu.ph/wp-content/uploads/2025/07/${year}-Annual-Accomplishment-Report.pdf`;
    console.log(`🔧 Fixed broken ${year} annual report link (pattern 2) → ${reconstructedUrl}`);
    return `Link: ${reconstructedUrl}`;
  });
  
  return text;
}

/**
 * Process AI response text with full formatting pipeline
 */
export function formatAIResponse(rawText: string): string {
  if (!rawText) return '';
  
  // Step 1: Clean HTML artifacts (CRITICAL - must run first!)
  let formatted = cleanHTMLArtifacts(rawText);
  
  // Step 2: Fix broken annual report links (before URL completion)
  formatted = fixBrokenAnnualReportLinks(formatted);
  
  // Step 3: Complete partial URLs
  formatted = completePartialURLs(formatted);
  
  // Step 4: Extract and format links with friendly names
  const { text: textWithFormattedLinks } = extractAndFormatLinks(formatted);
  
  return textWithFormattedLinks;
}

/**
 * Enhance bold formatting for important DOrSU entities
 */
export function enhanceBoldFormatting(text: string): string {
  let enhanced = text;
  
  // DOrSU-specific entities to bold (if not already bolded)
  const entities = {
    names: [
      'Dr. Roy G. Ponce', 'Roy G. Ponce',
      'Dr. Roy M. Padilla', 'Roy M. Padilla',
      'Dr. Danilo O. Jacobe', 'Danilo O. Jacobe',
    ],
    faculties: [
      'FACET', 'Faculty of Arts, Culture, Education, and Technology',
      'FTED', 'Faculty of Teacher Education',
      'FALS', 'Faculty of Arts, Languages, and Sciences',
    ],
    campuses: [
      'Main Campus', 'Mati Main Campus',
      'Baganga Campus', 'Banaybanay Campus',
    ],
    locations: ['Mati City', 'Davao Oriental', 'Philippines'],
  };
  
  // Auto-bold important entities (avoid double-bolding)
  Object.values(entities).flat().forEach(entity => {
    const escapedEntity = entity.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
    // Only bold if not already surrounded by **
    const regex = new RegExp(`(?<!\\*\\*)\\b${escapedEntity}\\b(?!\\*\\*)`, 'gi');
    enhanced = enhanced.replace(regex, (match) => `**${match}**`);
  });
  
  return enhanced;
}

/**
 * Get custom markdown styles for react-native-markdown-display
 */
export function getMarkdownStyles(theme: any) {
  return {
    body: { 
      color: theme.colors.text, 
      fontSize: theme.fontSize.scaleSize(15), 
      lineHeight: theme.fontSize.scaleSize(22)
    },
    heading1: { 
      fontSize: theme.fontSize.scaleSize(22), 
      fontWeight: '800' as '800', 
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8
    },
    heading2: { 
      fontSize: theme.fontSize.scaleSize(20), 
      fontWeight: '700' as '700', 
      color: theme.colors.text,
      marginTop: 14,
      marginBottom: 6
    },
    heading3: { 
      fontSize: theme.fontSize.scaleSize(18), 
      fontWeight: '700' as '700', 
      color: theme.colors.text,
      marginTop: 12,
      marginBottom: 6
    },
    strong: { 
      fontWeight: '700' as '700', 
      color: theme.colors.text 
    },
    em: { 
      fontStyle: 'italic' as 'italic',
      color: theme.colors.text
    },
    link: { 
      color: theme.isDarkMode ? '#60A5FA' : theme.colors.primary,  // Light blue for dark mode, primary for light mode
      textDecorationLine: 'underline' as 'underline',
      fontWeight: '600' as '600'  // Slightly bolder for better visibility
    },
    paragraph: { 
      marginTop: 0, 
      marginBottom: 10,
      lineHeight: theme.fontSize.scaleSize(22)
    },
    bullet_list: { 
      marginBottom: 10,
      marginTop: 4
    },
    ordered_list: { 
      marginBottom: 10,
      marginTop: 4
    },
    list_item: { 
      marginBottom: 6,
      lineHeight: theme.fontSize.scaleSize(22)
    },
    code_inline: { 
      backgroundColor: theme.colors.surfaceAlt, 
      color: theme.colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
      fontFamily: 'Courier New',
      fontSize: theme.fontSize.scaleSize(14)
    },
    code_block: {
      backgroundColor: theme.colors.surfaceAlt,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontFamily: 'Courier New'
    },
    fence: {
      backgroundColor: theme.colors.surfaceAlt,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontFamily: 'Courier New'
    },
    blockquote: {
      backgroundColor: theme.colors.surfaceAlt,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      paddingLeft: 12,
      paddingRight: 12,
      paddingVertical: 8,
      marginVertical: 8,
      fontStyle: 'italic' as 'italic'
    },
    table: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      marginVertical: 8
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: theme.colors.border
    },
    th: {
      fontWeight: '700' as '700',
      backgroundColor: theme.colors.surfaceAlt,
      padding: 8
    },
    td: {
      padding: 8
    }
  };
}

