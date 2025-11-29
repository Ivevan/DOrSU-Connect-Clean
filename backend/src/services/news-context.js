import { Logger } from '../utils/logger.js';

export async function buildNewsContext(shouldIncludeNews, isDateSpecific, newsService) {
  if (!shouldIncludeNews || !newsService) {
    return { newsContext: '', newsInstruction: '' };
  }
  
  try {
    const newsCount = isDateSpecific ? 10 : 3;
    const news = await newsService.getLatestNews(newsCount);
    
    if (!news || news.length === 0) {
      Logger.warn('📰 No news items found after scraping');
      return { 
        newsContext: '', 
        newsInstruction: '\n⚠️ Note: No recent news was found. Inform the user that no news items are available at this time.' 
      };
    }
    
    let newsContext = '\n\n=== LATEST DORSU NEWS & UPDATES (SCRAPED ON-DEMAND) ===\n';
    news.forEach((item, index) => {
      newsContext += `\n${index + 1}. **${item.title}**\n`;
      newsContext += `   📅 Date: ${item.date}\n`;
      if (item.excerpt && item.excerpt !== 'Click to read more') {
        newsContext += `   📄 ${item.excerpt}\n`;
      }
      newsContext += `   🔗 Link: ${item.link}\n`;
    });
    newsContext += '\n=== END OF NEWS ===\n';
    
    const newsInstruction = isDateSpecific ? 
      '\n\n📰 NEWS RESPONSE FORMATTING (MANDATORY):\n' +
      '• Format the news response as a numbered list (1, 2, 3, etc.)\n' +
      '• For each news item, include:\n' +
      '  - Bold title on the first line\n' +
      '  - Date on the second line with 📅 emoji\n' +
      '  - Excerpt/description if available (third line)\n' +
      '  - Clickable link with 🔗 emoji and the FULL URL\n' +
      '• Make links clickable using markdown format: [Link Text](URL)\n' +
      '• At the end, mention: "Would you like me to summarize any of these news items? Just say summarize news 1 or tell me about news 2!"\n' +
      '• Example format:\n' +
      '  1. **News Title**\n' +
      '     📅 Date: January 15, 2025\n' +
      '     This is the news excerpt or description.\n' +
      '     🔗 Link: [Read more](https://dorsu.edu.ph/news/article/)\n\n' :
      '\n\n📰 NEWS RESPONSE FORMATTING (MANDATORY):\n' +
      '• User asked for latest news - show exactly 3 latest posts based on date\n' +
      '• Format each news item as follows:\n' +
      '  1. **Bold Title** (first line)\n' +
      '     📅 Date: [Date] (second line)\n' +
      '     [Excerpt/description if available] (third line)\n' +
      '     🔗 Link: [Read full article](URL) (fourth line with clickable markdown link)\n' +
      '• Number the news items: 1, 2, 3\n' +
      '• Use proper spacing between items\n' +
      '• Make sure all links are clickable using markdown: [text](URL)\n' +
      '• Include the FULL URL from the knowledge base chunks\n' +
      '• Start your response with a friendly intro like: "Here are the 3 latest news from DOrSU:"\n' +
      '• After listing the news, add: "Would you like me to summarize any of these news items? Just say summarize news 1 or tell me about news 2!"\n' +
      '• Example:\n' +
      '  Here are the 3 latest news from DOrSU:\n\n' +
      '  1. **Annual Research Conference 2025**\n' +
      '     📅 Date: January 20, 2025\n' +
      '     DOrSU announces the annual research conference.\n' +
      '     🔗 Link: [Read full article](https://dorsu.edu.ph/news/annual-research-conference-2025/)\n\n' +
      '  2. **New Academic Programs Offered**\n' +
      '     📅 Date: January 15, 2025\n' +
      '     The university introduces new programs for 2025.\n' +
      '     🔗 Link: [Read full article](https://dorsu.edu.ph/news/new-academic-programs/)\n\n' +
      '  3. **Enrollment Schedule Released**\n' +
      '     📅 Date: January 10, 2025\n' +
      '     Enrollment dates and requirements are now available.\n' +
      '     🔗 Link: [Read full article](https://dorsu.edu.ph/news/enrollment-schedule-2025/)\n\n' +
      '  Would you like me to summarize any of these news items? Just say summarize news 1 or tell me about news 2!\n\n';
    
    Logger.info(`📰 Including ${news.length} latest news items in response (scraped on-demand, sorted by date)`);
    
    return { newsContext, newsInstruction };
  } catch (error) {
    Logger.error('Failed to scrape news on-demand:', error.message);
    return { 
      newsContext: '', 
      newsInstruction: '\n⚠️ Note: Unable to fetch news at this time. Inform the user that news scraping failed.' 
    };
  }
}

