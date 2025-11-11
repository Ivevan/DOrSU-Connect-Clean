import apiConfig from '../config/api.config';

/**
 * AI Service - Handles communication with DOrSU AI Backend
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  reply: string;
  source: 'ai-model' | 'cached';
  model: string;
  provider?: string;
  complexity?: string;
  responseTime: number;
  usedKnowledgeBase?: boolean;
  cached?: boolean;
  intent?: {
    conversational: string;
    confidence: number;
    dataSource: string;
    category: string;
  };
}

export interface ChatRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
}

class AIService {
  // Use configuration from api.config.ts
  private baseUrl: string = apiConfig.baseUrl;

  /**
   * Set the base URL for the AI backend
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Send a message to the AI and get a response
   */
  async sendMessage(prompt: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
        } as ChatRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      return data;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  /**
   * Save chat history to the backend
   */
  async saveChatHistory(sessionId: string, messages: Message[], token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          messages
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Failed to save chat history:', error);
      return false;
    }
  }

  /**
   * Get chat history list from the backend
   */
  async getChatHistory(token: string): Promise<ChatHistoryItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat-history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Convert timestamp strings back to Date objects
        return data.history.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get chat history:', error);
      return [];
    }
  }

  /**
   * Get a specific chat session from the backend
   */
  async getChatSession(sessionId: string, token: string): Promise<Message[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat-session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Convert timestamp strings back to Date objects
        return data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get chat session:', error);
      return [];
    }
  }

  /**
   * Delete a specific chat session
   */
  async deleteChatSession(sessionId: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat-session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return !!data.success;
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      return false;
    }
  }

  /**
   * Check if the AI backend is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get MongoDB status
   */
  async getMongoDBStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mongodb-status`);
      return await response.json();
    } catch (error) {
      console.error('MongoDB status check failed:', error);
      return { status: 'unavailable' };
    }
  }

  /**
   * Get news from DOrSU
   */
  async getNews(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/news`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get news:', error);
      return { success: false, news: [], count: 0 };
    }
  }
}

export default new AIService();