/**
 * Response Formatter Service
 * Handles formatting, sanitization, and enhancement of AI responses
 * Uses: marked (markdown), sanitize-html (security), handlebars (templates), chalk (terminal colors)
 */

import chalk from 'chalk';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export class ResponseFormatter {
  constructor() {
    // Configure marked for safe, consistent markdown rendering
    marked.setOptions({
      headerIds: false,
      mangle: false,
      breaks: true,  // Convert \n to <br>
      gfm: true,     // GitHub Flavored Markdown
      sanitize: false  // We'll use sanitize-html instead
    });

    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  registerHandlebarsHelpers() {
    // Helper to bold text
    Handlebars.registerHelper('bold', function(text) {
      return new Handlebars.SafeString(`**${text}**`);
    });

    // Helper to format lists
    Handlebars.registerHelper('list', function(items, options) {
      const type = options.hash.type || 'bullet';
      return items.map((item, i) => {
        const prefix = type === 'numbered' ? `${i + 1}.` : '•';
        return `${prefix} ${item}`;
      }).join('\n');
    });

    // Helper to format tables
    Handlebars.registerHelper('table', function(headers, rows) {
      let result = '| ' + headers.join(' | ') + ' |\n';
      result += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
      rows.forEach(row => {
        result += '| ' + row.join(' | ') + ' |\n';
      });
      return new Handlebars.SafeString(result);
    });
  }

  /**
   * Format AI response with markdown, sanitization, and enhancement
   * @param {string} rawResponse - Raw AI response
   * @param {Object} options - Formatting options
   * @returns {Object} - Formatted response with text, html, and metadata
   */
  format(rawResponse, options = {}) {
    const {
      enableMarkdown = false,
      enableSanitization = true,
      enhanceBold = true,
      highlightEntities = true,
      addLineBreaks = false,
      makeLinksClickable = true
    } = options;

    let formatted = rawResponse;

    // Step 1: Auto-enhance bold formatting
    if (enhanceBold) {
      formatted = this.enhanceBoldFormatting(formatted);
    }

    if (highlightEntities) {
      formatted = this.highlightDOrSUEntities(formatted);
    }

    // Step 1.5: Convert URLs to clickable links
    if (makeLinksClickable) {
      formatted = this.makeLinksClickable(formatted);
    }

    // Step 2: Convert markdown to HTML (if enabled)
    let html = formatted;
    if (enableMarkdown) {
      html = marked.parse(formatted);
    }

    // Step 3: Sanitize HTML (security)
    if (enableSanitization) {
      html = this.sanitize(html);
    }

    // Step 4: Add line breaks for better readability
    if (addLineBreaks && !enableMarkdown) {
      formatted = this.addLineBreaks(formatted);
    }

    return {
      text: formatted,
      html: html,
      metadata: {
        enhanced: enhanceBold,
        highlighted: highlightEntities,
        sanitized: enableSanitization,
        markdown: enableMarkdown,
        linksClickable: makeLinksClickable
      }
    };
  }

  /**
   * Convert URLs in text to clickable markdown links
   * ⚠️ WARNING: This function should NOT be used for AI responses!
   * It's kept for backward compatibility but disabled by default in server.js
   */
  makeLinksClickable(text) {
    // SAFETY CHECK: Never process if text contains HTML attributes
    if (text.includes('class=') || text.includes('target=') || text.includes('rel=')) {
      // Return text as-is to avoid double-processing
      return text;
    }
    
    // Skip if text already contains markdown links or HTML
    if (text.includes('](http') || text.includes('<a href')) {
      return text;
    }
    
    // ⚠️ DISABLED FOR AI RESPONSES - Return plain text
    // The frontend will handle link conversion to avoid HTML generation
    return text;
    
    /* ORIGINAL CODE - DISABLED
    // Regex to detect URLs (http, https) - more precise
    const urlRegex = /(?<!["\[\(])(https?:\/\/[^\s<>"{}|\\^`\[\])\n]+)(?!["\]\)])/gi;
    
    return text.replace(urlRegex, (url) => {
      // Clean up URL - remove trailing punctuation
      let cleanUrl = url.replace(/[.,;:!?]+$/, '');
      
      // Return ONLY the clean URL - no markdown, no HTML
      return cleanUrl;
    });
    */
  }

  /**
   * Enhance bold formatting for important terms
   */
  enhanceBoldFormatting(text) {
    let enhanced = text;

    // DOrSU-specific entities to bold (comprehensive list)
    const entities = {
      // Leadership and key people
      names: [
        'Dr. Roy G. Ponce', 'Roy G. Ponce',
        'Dr. Roy M. Padilla', 'Roy M. Padilla',
        'Dr. Danilo O. Jacobe', 'Danilo O. Jacobe',
        'Dr. Jocelyn C. Arles', 'Jocelyn C. Arles',
        'Dr. Trishea Marie P. Jacobe', 'Trishea Marie P. Jacobe',
        'Dr. Armando V. Cano Jr.', 'Armando V. Cano Jr.',
        'Dr. Gloria P. Gempes', 'Gloria P. Gempes'
      ],
      
      // Faculties
      faculties: [
        'FACET', 'Faculty of Arts, Culture, Education, and Technology',
        'FTED', 'Faculty of Teacher Education',
        'FALS', 'Faculty of Arts, Languages, and Sciences',
        'FBM', 'Faculty of Business and Management',
        'FCJE', 'Faculty of Criminal Justice Education',
        'FNAHS', 'Faculty of Nursing and Allied Health Sciences',
        'FHUSOCOM', 'Faculty of Humanities, Social Sciences, and Communication'
      ],
      
      // Campuses
      campuses: [
        'Main Campus', 'Mati Main Campus',
        'Baganga Campus', 'Banaybanay Campus',
        'Cateel Campus', 'San Isidro Campus',
        'Tarragona Campus'
      ],
      
      // Locations
      locations: ['Mati City', 'Davao Oriental', 'Philippines'],
      
      // Laws and official documents
      laws: ['Republic Act No. 11033', 'RA 11033', 'RA 6807'],
      
      // Positions/titles
      titles: ['President', 'Vice President', 'Dean', 'Director', 'Department Head']
    };

    // Auto-bold important entities (avoid double-bolding)
    Object.values(entities).flat().forEach(entity => {
      const escapedEntity = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Only bold if not already surrounded by ** and matches word boundaries
      const regex = new RegExp(`(?<!\\*\\*)\\b${escapedEntity}\\b(?!\\*\\*)`, 'gi');
      enhanced = enhanced.replace(regex, (match) => `**${match}**`);
    });

    return enhanced;
  }

  /**
   * Highlight DOrSU-specific entities
   */
  highlightDOrSUEntities(text) {
    let highlighted = text;
    
    // Highlight important numbers and dates
    const patterns = {
      // Years and dates
      years: /\b(19\d{2}|20\d{2})\b/g,
      
      // Important numbers (enrollment, statistics)
      statistics: /\b(\d+(?:,\d{3})*)\s+(students?|faculty|programs?|campuses?)\b/gi
    };
    
    // Bold years if not already bolded
    highlighted = highlighted.replace(patterns.years, (match) => {
      if (highlighted.includes(`**${match}**`)) return match;
      return `**${match}**`;
    });
    
    return highlighted;
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   */
  sanitize(html) {
    return sanitizeHtml(html, {
      allowedTags: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'table', 'thead', 'tbody',
        'tr', 'th', 'td'
      ],
      allowedAttributes: {
        'a': ['href', 'title', 'target'],
        'code': ['class']
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        'a': (tagName, attribs) => {
          return {
            tagName: 'a',
            attribs: {
              ...attribs,
              target: '_blank',
              rel: 'noopener noreferrer'
            }
          };
        }
      }
    });
  }

  /**
   * Add line breaks for better readability
   */
  addLineBreaks(text) {
    let enhanced = text;
    
    // Add extra line break after sentences ending with period
    enhanced = enhanced.replace(/\.\s+/g, '.\n\n');
    
    // Ensure proper spacing after list items (numbered or bulleted)
    // Add double line break after lines ending with Link: URL
    enhanced = enhanced.replace(/(Link:\s*https?:\/\/[^\s\n]+)(\n(?!\n))/gi, '$1\n\n');
    
    // Add double line break after Date: lines that are followed by Link:
    enhanced = enhanced.replace(/(Date:[^\n]+)(\n)(?=\s*Link:)/gi, '$1\n');
    
    // Ensure numbered list items have spacing
    enhanced = enhanced.replace(/(\d+\.\s+\*\*[^*]+\*\*[^\n]*(?:\n\s+[^\n]+)*)/g, '$1\n\n');
    
    return enhanced;
  }

  /**
   * Format a list (bullet or numbered)
   */
  formatList(items, options = {}) {
    const {
      type = 'bullet',
      boldItems = false,
      title = null,
      spacing = 'normal' // 'compact', 'normal', or 'spacious'
    } = options;

    let result = '';
    
    if (title) {
      result += `**${title}**\n\n`;
    }

    const spacingMap = {
      compact: '\n',
      normal: '\n\n',
      spacious: '\n\n\n'
    };
    
    const itemSpacing = spacingMap[spacing] || spacingMap.normal;

    items.forEach((item, index) => {
      const prefix = type === 'numbered' ? `${index + 1}.` : '•';
      const formattedItem = boldItems ? `**${item}**` : item;
      result += `${prefix} ${formattedItem}${itemSpacing}`;
    });

    // Remove trailing spacing
    result = result.trimEnd();

    return {
      text: result,
      html: this.sanitize(marked.parse(result))
    };
  }

  /**
   * Format a table
   */
  formatTable(headers, rows) {
    let markdown = '| ' + headers.join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    rows.forEach(row => {
      markdown += '| ' + row.join(' | ') + ' |\n';
    });

    return {
      text: markdown,
      html: this.sanitize(marked.parse(markdown))
    };
  }

  /**
   * Render a Handlebars template
   */
  renderTemplate(templateName, data) {
    const templates = {
      facultyList: `**DOrSU Faculties**

{{#each faculties}}
{{@index}}. **{{code}}** - {{name}}
   Dean: **{{dean}}**
{{/each}}`,

      presidentInfo: `**{{name}}**
President of Davao Oriental State University

**Education:**
{{#each education}}
• **{{degree}}** - {{institution}}{{#if honor}} ({{honor}}){{/if}}
{{/each}}

**Key Achievements:**
{{#each achievements}}
• {{this}}
{{/each}}`,

      coreValues: `**DOrSU Core Values:**
{{#list values type="numbered"}}{{/list}}`,

      missions: `**DOrSU Mission:**
{{#each missions}}
**Mission {{@index}}:** {{this}}
{{/each}}`
    };

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    const compiledTemplate = Handlebars.compile(template);
    const text = compiledTemplate(data);

    return {
      text: text,
      html: this.sanitize(marked.parse(text))
    };
  }

  /**
   * Log formatted text to console with colors (for debugging)
   */
  logFormatted(text, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      highlight: chalk.cyan.bold
    };

    const colorFunc = colors[type] || chalk.white;
    console.log(colorFunc(text));
  }
}

// Export singleton instance
const responseFormatter = new ResponseFormatter();
export default responseFormatter;
