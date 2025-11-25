/**
 * Vector Search Service
 * Handles ALL retrieval/search logic for RAG system
 * Clean separation: This file handles retrieval, rag.js handles response generation
 */

import { Logger } from '../utils/logger.js';
import { TypoCorrector } from '../utils/query-analyzer.js';
import { getEmbeddingService } from './embedding.js';
import { getMongoDBService } from './mongodb.js';

const DEFAULT_TIMEZONE = process.env.CALENDAR_TIMEZONE || 'Asia/Manila';

function formatDateInTimezone(date, options = {}) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  }).format(date);
}

/**
 * VectorSearchService - Handles all data retrieval/search operations
 */
export class VectorSearchService {
  constructor(mongoService = null, faissOptimizedData = null, faissIndex = null, textChunks = [], embeddingModel = null, modelLoaded = false) {
    this.mongoService = mongoService;
    this.faissOptimizedData = faissOptimizedData;
    this.faissIndex = faissIndex;
    this.textChunks = textChunks;
    this.embeddingModel = embeddingModel;
    this.modelLoaded = modelLoaded;
    this.embeddingDimension = 384;
  }

  /**
   * Main entry point: Get relevant chunks for a query
   * Routes to appropriate search method based on query type
   */
  async search(query, options = {}) {
    const {
      maxResults = 10,
      maxSections = 10,
      queryType = null // Can be: 'history', 'leadership', 'office', 'comprehensive', 'general'
    } = options;

    // Detect query type if not provided
    const detectedType = queryType || this._detectQueryType(query);
    
    Logger.debug(`🔍 VectorSearch: Query type="${detectedType}", query="${query.substring(0, 50)}..."`);
    
    // Always log that search is being called (for debugging)
    console.log(`\x1b[35m🔍 [VECTOR SEARCH CALLED] Query: "${query.substring(0, 50)}..." | Type: ${detectedType}\x1b[0m`);
    
    // Log search query with metadata
    Logger.logSearchQuery(query, detectedType, {
      searchMethod: 'VectorSearchService.search',
      maxResults,
      maxSections
    });

    // Route to specialized search methods
    let searchResults = [];
    const startTime = Date.now();
    
    switch (detectedType) {
      case 'history':
        searchResults = await this.searchHistory(query, { maxResults, maxSections });
        break;
      
      case 'leadership':
        searchResults = await this.searchLeadership(query, { maxResults, maxSections });
        break;
      
      case 'office':
        searchResults = await this.searchOffice(query, { maxResults, maxSections });
        break;
      
      case 'admission_requirements':
        searchResults = await this.searchAdmissionRequirements(query, { maxResults, maxSections });
        break;
      
      case 'student_org':
        searchResults = await this.searchStudentOrg(query, { maxResults, maxSections });
        break;
      
      case 'programs':
        searchResults = await this.searchPrograms(query, { maxResults, maxSections });
        break;
      
      case 'faculties':
        searchResults = await this.searchFaculties(query, { maxResults, maxSections });
        break;
      
      case 'deans':
        searchResults = await this.searchDeans(query, { maxResults, maxSections });
        break;
      
      case 'hymn':
        searchResults = await this.searchHymn(query, { maxResults, maxSections });
        break;
      
      case 'vision_mission':
        searchResults = await this.searchVisionMission(query, { maxResults, maxSections });
        break;
      
      case 'values':
        searchResults = await this.searchValues(query, { maxResults, maxSections });
        break;
      
      case 'schedule':
        searchResults = await this.searchSchedule(query, { maxResults, maxSections });
        break;
      
      case 'scholarship':
        searchResults = await this.searchScholarship(query, { maxResults, maxSections });
        break;
      
      case 'comprehensive':
        searchResults = await this.searchComprehensive(query, { maxResults, maxSections });
        break;
      
      default:
        searchResults = await this.searchGeneral(query, { maxResults, maxSections });
    }
    
    const executionTime = Date.now() - startTime;
    
    // Log retrieved chunks
    Logger.logRetrievedChunks(query, searchResults, {
      source: `${detectedType || 'general'}_search`,
      maxChunks: 15,
      showFullContent: false
    });
    
    // Log search results summary
    Logger.logSearchResults(query, {
      totalChunks: searchResults.length,
      returnedChunks: searchResults.slice(0, maxSections).length,
      searchType: detectedType || 'general',
      sources: [...new Set(searchResults.map(r => r.source).filter(Boolean))],
      executionTime
    });
    
    return searchResults;
  }

  /**
   * Search for history-related queries
   */
  async searchHistory(query, options = {}) {
    const { maxResults = 60, maxSections = 60 } = options;
    
    Logger.debug(`📚 History search: "${query.substring(0, 40)}..."`);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for history
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const pipeline = [
          {
            $match: {
              $or: [
                { section: { $regex: /^history$/i } },
                { type: { $regex: /timeline|history|narrative|heritage|conversion/i } },
                { category: { $regex: /timeline|history|historical|1972|1989|1991|1997|1999|2015|2018|2021/i } },
                { content: { $regex: /history|founded|established|timeline|narrative|heritage|conversion|dorsu|doscst|mcc/i } },
                { text: { $regex: /history|founded|established|timeline|narrative|heritage|conversion|dorsu|doscst|mcc/i } },
                { keywords: { $in: ['history', 'timeline', 'founded', 'established', 'narrative', 'heritage', 'conversion', 'dorsu', 'doscst', 'mcc'] } }
              ]
            }
          },
          {
            $addFields: {
              relevanceScore: {
                $add: [
                  { $cond: [{ $eq: [{ $toLower: '$section' }, 'history'] }, 200, 0] },
                  { $cond: [{ $regexMatch: { input: '$type', regex: /timeline_event|history_narrative/i } }, 150, 0] },
                  { $cond: [{ $regexMatch: { input: '$type', regex: /history|timeline/i } }, 100, 0] },
                  { $cond: [{ $regexMatch: { input: '$content', regex: /2018.*may|may.*28|may 28|converted.*university|dorsu.*university/i } }, 80, 0] },
                  { $cond: [{ $in: ['history', '$keywords'] }, 60, 0] },
                  { $cond: [{ $gt: ['$metadata.updated_at', null] }, 10, 0] }
                ]
              }
            }
          },
          {
            $match: {
              $and: [
                { type: { $not: { $regex: /conversion_process|heritage_info|current_mission/i } } },
                { section: { $not: { $regex: /conversionprocess|heritage|currentmission/i } } },
                { category: { $not: { $regex: /conversionprocess|heritage|currentmission/i } } }
              ]
            }
          },
          { $sort: { relevanceScore: -1, 'metadata.updated_at': -1 } },
          { $limit: maxResults }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          results = this._convertMongoChunksToRAG(mongoResults, 100, 'mongodb_history_aggregation');
          Logger.debug(`✅ History aggregation: Found ${results.length} chunks`);
        }
      } catch (error) {
        Logger.debug(`History aggregation failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Vector search
    if (results.length < maxSections && this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxSections);
        
        // Filter to history-related chunks
        const historyVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const text = (chunk.text || chunk.content || '').toLowerCase();
            return section === 'history' || 
                   type.includes('timeline') || 
                   type.includes('history') ||
                   text.includes('founded') || 
                   text.includes('established') ||
                   text.includes('dorsu') ||
                   text.includes('doscst');
          })
          .filter(chunk => {
            // Exclude conversion process, heritage, current mission
            const type = (chunk.type || '').toLowerCase();
            return !type.includes('conversion_process') && 
                   !type.includes('heritage_info') && 
                   !type.includes('current_mission');
          });
        
        // Merge with aggregation results
        historyVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search'
            });
          }
        });
      } catch (error) {
        Logger.debug(`History vector search failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Keyword search
    if (results.length < maxSections) {
      const keywordResults = await this.searchKeyword(query, maxSections);
      keywordResults.forEach(chunk => {
        if (!results.find(r => r.id === chunk.id)) {
          results.push(chunk);
        }
      });
    }
    
    // Filter out forbidden chunks
    const filtered = results.filter(chunk => {
      const type = (chunk.type || '').toLowerCase();
      const section = (chunk.section || '').toLowerCase();
      const category = (chunk.category || '').toLowerCase();
      const text = (chunk.text || chunk.content || '').toLowerCase();
      
      // Exclude conversion process, heritage sites, current mission
      if (type === 'conversion_process' || 
          (section.includes('conversionprocess') && !type.includes('timeline')) ||
          (category === 'conversionprocess' && type !== 'timeline_event') ||
          (text.includes('conversion process') && text.includes('stakeholders') && !text.includes('timeline'))) {
        return false;
      }
      
      if (type === 'heritage_info' || 
          (section.includes('heritage') && type !== 'timeline_event') ||
          (category === 'heritage' && type !== 'timeline_event') ||
          ((text.includes('heritage site') || (text.includes('unesco') && text.includes('hamiguitan'))) && type !== 'timeline_event' && !text.includes('timeline'))) {
        return false;
      }
      
      if (type === 'current_mission' || 
          (section.includes('currentmission') && type !== 'timeline_event') ||
          (category === 'currentmission') ||
          (text.includes('current mission') && type !== 'timeline_event' && !text.includes('timeline'))) {
        return false;
      }
      
      return true;
    });
    
    return this._sortByScore(filtered).slice(0, maxSections);
  }

  /**
   * Search for leadership-related queries (president, VP, deans, directors)
   */
  async searchLeadership(query, options = {}) {
    const { maxResults = 50, maxSections = 50 } = options;
    
    Logger.debug(`👔 Leadership search: "${query.substring(0, 40)}..."`);
    
    const isPresidentQuery = /\b(president|roy.*ponce|dr\.?\s*roy)\b/i.test(query);
    const isVPQuery = /\b(vice president|vice presidents|vp|vps)\b/i.test(query);
    
    let results = [];
    
    // PRIMARY: MongoDB vector search for leadership
    if (this.mongoService && isPresidentQuery) {
      try {
        const embeddingService = getEmbeddingService();
        const enhancedQuery = `Dr. Roy G. Ponce President of DOrSU education degrees expertise achievements University of Melbourne UNESCO museum biodiversity conservation research`;
        const queryEmbedding = await embeddingService.embedText(enhancedQuery);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxSections * 4);
        
        // Filter to president-related chunks
        const presidentChunks = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const text = (chunk.text || chunk.content || '').toLowerCase();
            
            // Exclude office structure chunks
            if (section.includes('additionalofficesandcenters') || 
                section.includes('offices') ||
                section.includes('detailedofficeservices') ||
                (text.includes('office of the president') && !text.includes('dr. roy') && !text.includes('roy ponce'))) {
              return false;
            }
            
            // Include if leadership section, president type, or has president details
            return section === 'leadership' || 
                   section.includes('organizationalstructure') ||
                   type === 'president' ||
                   (text.includes('roy') && text.includes('ponce')) ||
                   text.includes('dr. roy') ||
                   text.includes('education') ||
                   text.includes('expertise') ||
                   text.includes('achievement');
          })
          .map(chunk => {
            const text = (chunk.text || chunk.content || '').toLowerCase();
            let score = chunk.score || 0;
            
            if (chunk.section === 'leadership' && chunk.type === 'president') score += 50;
            if (text.includes('roy g. ponce') || text.includes('dr. roy g. ponce')) score += 40;
            if (text.includes('education') || text.includes('expertise') || text.includes('achievement')) score += 30;
            if (text.includes('university of melbourne') || text.includes('unesco') || text.includes('museum')) score += 20;
            
            return {
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: score,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_president'
            };
          })
          .sort((a, b) => (b.score || 0) - (a.score || 0));
        
        results = presidentChunks;
        Logger.debug(`✅ President vector search: Found ${results.length} chunks`);
      } catch (error) {
        Logger.debug(`President vector search failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Aggregation pipeline (always runs for president/VP)
    if (this.mongoService && (isPresidentQuery || isVPQuery)) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        
        if (isPresidentQuery) {
          const pipeline = [
            {
              $match: {
                $and: [
                  {
                    $or: [
                      { section: { $regex: /^leadership$/i } },
                      { section: { $regex: /^organizationalStructure\/DOrSUOfficials2025$/i } },
                      { type: { $regex: /^president$/i } },
                      { category: { $regex: /^president$/i } },
                      { content: { $regex: /roy.*g\.?\s*ponce|dr\.?\s*roy.*g\.?\s*ponce|roy.*ponce/i } },
                      { text: { $regex: /roy.*g\.?\s*ponce|dr\.?\s*roy.*g\.?\s*ponce|roy.*ponce/i } },
                      { keywords: { $in: ['president', 'roy ponce', 'dr. roy', 'roy g. ponce', 'leadership'] } },
                      { 'metadata.name': { $regex: /roy.*ponce/i } }
                    ]
                  },
                  {
                    $nor: [
                      { section: { $regex: /additionalofficesandcenters|detailedofficeservices|offices$/i } },
                      { 
                        $and: [
                          { content: { $regex: /office of the president/i } },
                          { content: { $not: { $regex: /roy.*ponce|dr\.?\s*roy/i } } }
                        ]
                      }
                    ]
                  }
                ]
              }
            },
            {
              $addFields: {
                relevanceScore: {
                  $add: [
                    { $cond: [{ $and: [{ $eq: [{ $toLower: '$section' }, 'leadership'] }, { $eq: [{ $toLower: '$type' }, 'president'] }] }, 300, 0] },
                    { $cond: [{ $regexMatch: { input: '$content', regex: 'roy.*g\\.?\\s*ponce|dr\\.?\\s*roy.*g\\.?\\s*ponce', options: 'i' } }, 250, 0] },
                    { $cond: [{ $eq: [{ $toLower: '$section' }, 'leadership'] }, 200, 0] },
                    { $cond: [{ $eq: [{ $toLower: '$type' }, 'president'] }, 150, 0] },
                    { $cond: [{ $in: ['president', '$keywords'] }, 100, 0] },
                    { $cond: [{ $regexMatch: { input: '$content', regex: 'education|expertise|achievement|degree|university.*melbourne|unesco|museum', options: 'i' } }, 80, 0] }
                  ]
                }
              }
            },
            { $sort: { relevanceScore: -1, 'metadata.updated_at': -1 } },
            { $limit: 50 }
          ];
          
          const aggregationResults = await collection.aggregate(pipeline).toArray();
          if (aggregationResults && aggregationResults.length > 0) {
            const aggregationChunks = this._convertMongoChunksToRAG(aggregationResults, 0, 'mongodb_president_aggregation');
            aggregationChunks.forEach(chunk => {
              if (!results.find(r => r.id === chunk.id)) {
                results.push(chunk);
              }
            });
            Logger.debug(`✅ President aggregation: Added ${aggregationChunks.length} chunks`);
          }
        } else if (isVPQuery) {
          // VP-specific aggregation pipeline
          const pipeline = [
            {
              $match: {
                $and: [
                  {
                    $or: [
                      { section: { $regex: /organizationalStructure.*DOrSUOfficials2025/i } },
                      { section: { $eq: 'organizationalStructure/DOrSUOfficials2025' } },
                      { section: { $regex: /^leadership$/i } },
                      { type: { $regex: /vice_president|vicePresidents|vice president/i } },
                      { category: { $regex: /vice_president|vice president/i } },
                      { content: { $regex: /VP for|vice president for|administration and finance|research.*innovation.*extension|academic affairs|planning.*quality assurance/i } },
                      { text: { $regex: /VP for|vice president for|administration and finance|research.*innovation.*extension|academic affairs|planning.*quality assurance/i } }
                    ]
                  },
                  {
                    $nor: [
                      { section: { $regex: /studentOrganizations|usc|ang.*sidlakan|catalyst/i } },
                      { content: { $regex: /university student council|usc.*vice president|student.*vice president/i } },
                      { text: { $regex: /university student council|usc.*vice president|student.*vice president/i } }
                    ]
                  }
                ]
              }
            },
            {
              $addFields: {
                relevanceScore: {
                  $add: [
                    { $cond: [{ $regexMatch: { input: '$section', regex: 'organizationalStructure.*DOrSUOfficials2025', options: 'i' } }, 300, 0] },
                    { $cond: [{ $regexMatch: { input: '$content', regex: 'VP for|vice president for', options: 'i' } }, 250, 0] },
                    { $cond: [{ $regexMatch: { input: '$content', regex: 'vice president|vice presidents', options: 'i' } }, 200, 0] },
                    { $cond: [{ $eq: [{ $toLower: '$section' }, 'leadership'] }, 150, 0] }
                  ]
                }
              }
            },
            { $sort: { relevanceScore: -1, 'metadata.updated_at': -1 } },
            { $limit: 50 }
          ];
          
          const aggregationResults = await collection.aggregate(pipeline).toArray();
          if (aggregationResults && aggregationResults.length > 0) {
            results = this._convertMongoChunksToRAG(aggregationResults, 100, 'mongodb_vp_aggregation');
            Logger.debug(`✅ VP aggregation: Found ${results.length} chunks`);
          }
        }
      } catch (error) {
        Logger.debug(`Leadership aggregation failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Keyword search
    if (results.length < maxSections) {
      const keywordResults = await this.searchKeyword(query, maxSections);
      keywordResults.forEach(chunk => {
        if (!results.find(r => r.id === chunk.id)) {
          results.push(chunk);
        }
      });
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Search for office head queries
   */
  async searchOffice(query, options = {}) {
    const { maxResults = 15, maxSections = 15 } = options;
    
    Logger.debug(`🏢 Office search: "${query.substring(0, 40)}..."`);
    
    const officeAcronymMatch = query.match(/\b(OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC)\b/i);
    const officeAcronym = officeAcronymMatch ? officeAcronymMatch[0] : null;
    
    let results = [];
    
    // PRIMARY: MongoDB vector search
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxSections * 3);
        
        // Filter to office-related chunks
        const officeChunks = vectorResults.filter(chunk => {
          const section = (chunk.section || '').toLowerCase();
          const type = (chunk.type || '').toLowerCase();
          const text = (chunk.text || chunk.content || '').toLowerCase();
          const category = (chunk.category || '').toLowerCase();
          
          const isOfficeSection = section.includes('office') || section.includes('unit');
          const isOfficeType = type.includes('office') || type.includes('unit');
          const hasOfficeText = text.includes('office') || text.includes('head') || text.includes('director');
          
          if (officeAcronym) {
            const acronymLower = officeAcronym.toLowerCase();
            const hasAcronym = text.includes(acronymLower) || 
                             category === acronymLower || 
                             (chunk.metadata?.acronym || '').toLowerCase() === acronymLower;
            return hasAcronym && (isOfficeSection || isOfficeType || hasOfficeText);
          }
          
          return isOfficeSection || isOfficeType || hasOfficeText;
        });
        
        results = officeChunks.map(chunk => ({
          id: chunk.id,
          section: chunk.section,
          type: chunk.type,
          text: chunk.text || chunk.content || '',
          score: chunk.score || 0,
          metadata: chunk.metadata || {},
          keywords: chunk.keywords || [],
          category: chunk.category,
          source: 'mongodb_vector_search_office'
        }));
      } catch (error) {
        Logger.debug(`Office vector search failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Field-specific MongoDB search
    if (officeAcronym && this.mongoService && results.length < 5) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const directMatches = await collection.find({
          $and: [
            {
              $or: [
                { 'metadata.acronym': { $regex: new RegExp(`^${officeAcronym}$`, 'i') } },
                { 'category': { $regex: new RegExp(`^${officeAcronym}$`, 'i') } },
                { 'content': { $regex: new RegExp(`\\b${officeAcronym}\\b`, 'i') } },
                { 'text': { $regex: new RegExp(`\\b${officeAcronym}\\b`, 'i') } },
                { 'keywords': { $in: [officeAcronym.toLowerCase(), officeAcronym] } }
              ]
            },
            {
              $or: [
                { section: { $in: ['offices', 'unitsAndOfficesHeads', 'detailedOfficeServices', 'additionalOfficesAndCenters'] } },
                { type: { $regex: /office/i } },
                { 'metadata.acronym': { $exists: true } }
              ]
            }
          ]
        })
        .sort({ 'metadata.acronym': officeAcronym ? 1 : -1, 'metadata.updated_at': -1 })
        .limit(15)
        .toArray();
        
        if (directMatches && directMatches.length > 0) {
          const fieldChunks = this._convertMongoChunksToRAG(directMatches, 100, 'mongodb_field_search');
          fieldChunks.forEach(chunk => {
            if (!results.find(r => r.id === chunk.id)) {
              results.push(chunk);
            }
          });
        }
      } catch (error) {
        Logger.debug(`Office field search failed: ${error.message}`);
      }
    }
    
    // Filter by exact acronym if specified
    if (officeAcronym) {
      const acronymLower = officeAcronym.toLowerCase();
      const acronymRegex = new RegExp(`\\b${acronymLower.replace('-', '\\-')}\\b`, 'i');
      results = results.filter(chunk => {
        const chunkText = chunk.text || chunk.content || '';
        const textLower = chunkText.toLowerCase();
        const categoryLower = (chunk.category || '').toLowerCase();
        const metadataAcronym = chunk.metadata?.acronym?.toLowerCase();
        const keywords = chunk.keywords || [];
        
        return acronymRegex.test(textLower) || 
               (categoryLower && acronymRegex.test(categoryLower)) ||
               metadataAcronym === acronymLower ||
               keywords.includes(acronymLower);
      });
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Search for admission requirements queries
   */
  async searchAdmissionRequirements(query, options = {}) {
    const { maxResults = 15, maxSections = 15 } = options;
    
    Logger.debug(`📋 Admission Requirements search: "${query.substring(0, 40)}..."`);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for admission requirements
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const pipeline = [
          {
            $match: {
              $or: [
                { type: { $regex: /admission_requirements/i } },
                { category: { $regex: /returningStudents|continuingStudents|transferringStudents|secondDegreeStudents|incomingFirstYearStudents|admission_requirements/i } },
                { content: { $regex: /admission.*requirements?|requirements?.*admission|returning.*students?|continuing.*students?|transferring.*students?|second.*degree.*students?|incoming.*first.*year.*students?|SUAST.*Examination|Form 138|Student's Profile Form|Good Moral Character|PSA.*Birth.*Certificate|Drug.*Test|Medical.*certificate/i } },
                { text: { $regex: /admission.*requirements?|requirements?.*admission|returning.*students?|continuing.*students?|transferring.*students?|second.*degree.*students?|incoming.*first.*year.*students?|SUAST.*Examination|Form 138|Student's Profile Form|Good Moral Character|PSA.*Birth.*Certificate|Drug.*Test|Medical.*certificate/i } },
                { keywords: { $in: ['admission', 'requirements', 'returning', 'continuing', 'transferring', 'incoming', 'students', 'suast', 'form 138'] } },
                { 'metadata.field': { $regex: /admissionEnrollmentRequirements2025.*requirements/i } }
              ]
            }
          },
          {
            $addFields: {
              relevanceScore: {
                $add: [
                  { $cond: [{ $eq: [{ $toLower: '$type' }, 'admission_requirements'] }, 300, 0] },
                  { $cond: [{ $regexMatch: { input: '$category', regex: /returningStudents|continuingStudents|transferringStudents|secondDegreeStudents|incomingFirstYearStudents/i } }, 250, 0] },
                  { $cond: [{ $regexMatch: { input: '$content', regex: /SUAST.*Examination|Form 138|Student's Profile Form|Good Moral Character|PSA.*Birth|Drug.*Test|Medical.*certificate/i } }, 200, 0] },
                  { $cond: [{ $regexMatch: { input: '$text', regex: /requirements?.*:\s*\d+\.|Requirements?:/i } }, 150, 0] },
                  { $cond: [{ $regexMatch: { input: '$metadata.field', regex: /admissionEnrollmentRequirements2025/i } }, 100, 0] },
                  { $cond: [{ $in: ['requirements', '$keywords'] }, 80, 0] },
                  { $cond: [{ $in: ['admission', '$keywords'] }, 60, 0] },
                  { $cond: [{ $gt: ['$metadata.updated_at', null] }, 10, 0] }
                ]
              }
            }
          },
          { $sort: { relevanceScore: -1, 'metadata.updated_at': -1 } },
          { $limit: maxResults }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          results = this._convertMongoChunksToRAG(mongoResults, 100, 'mongodb_admission_requirements_aggregation');
          Logger.debug(`✅ Admission requirements aggregation: Found ${results.length} chunks`);
        }
      } catch (error) {
        Logger.debug(`Admission requirements aggregation failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Vector search to get all requirements chunks
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to admission requirements chunks and prioritize them
        const requirementsVectorResults = vectorResults
          .filter(chunk => {
            const type = (chunk.type || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const text = (chunk.text || chunk.content || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            return type === 'admission_requirements' ||
                   type.includes('admission') ||
                   category.includes('returningstudents') ||
                   category.includes('continuingstudents') ||
                   category.includes('transferringstudents') ||
                   category.includes('seconddegreestudents') ||
                   category.includes('incomingfirstyearstudents') ||
                   category.includes('admission_requirements') ||
                   text.includes('admission requirements') ||
                   text.includes('returning students') ||
                   text.includes('continuing students') ||
                   text.includes('transferring students') ||
                   text.includes('second-degree students') ||
                   text.includes('incoming first year students') ||
                   text.includes('suast examination') ||
                   text.includes('form 138') ||
                   text.includes("student's profile form") ||
                   metadataField.includes('admissionenrollmentrequirements2025');
          })
          .map(chunk => {
            // Boost score for chunks that match requirements pattern
            let score = chunk.score || 50;
            const type = (chunk.type || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const text = (chunk.text || chunk.content || '').toLowerCase();
            
            if (type === 'admission_requirements') score += 100;
            if (category.includes('returningstudents') || category.includes('continuingstudents') || 
                category.includes('transferringstudents') || category.includes('seconddegreestudents') || 
                category.includes('incomingfirstyearstudents')) score += 80;
            if (text.includes('requirements:') || text.includes('requirements ')) score += 50;
            if (text.includes('suast') || text.includes('form 138')) score += 30;
            
            return {
              ...chunk,
              score: score
            };
          });
        
        // Merge with aggregation results, prioritizing aggregation results
        requirementsVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_admission_requirements'
            });
          }
        });
      } catch (error) {
        Logger.debug(`Admission requirements vector search failed: ${error.message}`);
      }
    }
    
    // Ensure we have chunks for all student categories
    const studentCategories = ['returningStudents', 'continuingStudents', 'transferringStudents', 'secondDegreeStudents', 'incomingFirstYearStudents'];
    const foundCategories = new Set();
    
    results.forEach(chunk => {
      const category = (chunk.category || '').toLowerCase();
      const text = (chunk.text || '').toLowerCase();
      
      studentCategories.forEach(cat => {
        if (category.includes(cat.toLowerCase()) || text.includes(cat.replace(/([A-Z])/g, ' $1').toLowerCase())) {
          foundCategories.add(cat);
        }
      });
    });
    
    // If we're missing categories, try keyword search
    if (foundCategories.size < studentCategories.length && this.mongoService) {
      try {
        const keywordResults = await this.searchKeyword(query, maxResults);
        keywordResults.forEach(chunk => {
          const type = (chunk.type || '').toLowerCase();
          const category = (chunk.category || '').toLowerCase();
          const text = (chunk.text || '').toLowerCase();
          
          const isRequirementsChunk = type === 'admission_requirements' ||
                                      category.includes('returningstudents') ||
                                      category.includes('continuingstudents') ||
                                      category.includes('transferringstudents') ||
                                      category.includes('seconddegreestudents') ||
                                      category.includes('incomingfirstyearstudents') ||
                                      text.includes('admission requirements') ||
                                      text.includes('returning students') ||
                                      text.includes('continuing students') ||
                                      text.includes('transferring students') ||
                                      text.includes('second-degree students') ||
                                      text.includes('incoming first year students');
          
          if (isRequirementsChunk && !results.find(r => r.id === chunk.id)) {
            results.push({
              ...chunk,
              score: (chunk.score || 50) + 70 // Boost keyword search results slightly lower than vector
            });
          }
        });
      } catch (error) {
        Logger.debug(`Admission requirements keyword search failed: ${error.message}`);
      }
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Search for student organization queries (USC, Ang Sidlakan, Catalyst, etc.)
   */
  async searchStudentOrg(query, options = {}) {
    const { maxResults = 15, maxSections = 15 } = options;
    
    Logger.debug(`🎓 Student Organization search: "${query.substring(0, 40)}..."`);
    
    // Detect which organization is being asked about
    const isUSCQuery = /\b(usc|university\s+student\s+council|student\s+council)\b/i.test(query);
    const isOfficersQuery = /\b(officers?|executives?|leaders?|members?|president|vice\s+president|secretary|treasurer|auditor|pio|business\s+manager)\b/i.test(query);
    const isAngSidlakanQuery = /\b(ang\s+sidlakan|ang.*sidlakan|student\s+publication)\b/i.test(query);
    const isCatalystQuery = /\b(catalyst|yearbook)\b/i.test(query);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for student organizations
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const pipeline = [
          {
            $match: {
              $or: [
                // Section-based matching
                { section: { $regex: /^studentOrganizations$/i } },
                // Content-based matching
                { content: { $regex: /university\s+student\s+council|usc|ang\s+sidlakan|catalyst|student\s+organization/i } },
                { text: { $regex: /university\s+student\s+council|usc|ang\s+sidlakan|catalyst|student\s+organization/i } },
                // Metadata-based matching
                { 'metadata.field': { $regex: /studentOrganizations\.(usc|angSidlakan|catalyst)/i } },
                // Type/category matching
                { category: { $regex: /president|vice\s+president|secretary|treasurer|auditor|pio|business\s+manager/i } },
                { keywords: { $in: ['usc', 'student', 'council', 'organization', 'ang', 'sidlakan', 'catalyst'] } }
              ]
            }
          },
          { $limit: maxResults * 2 } // Get more to sort after computing relevance
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores based on query intent (outside MongoDB)
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            // Prioritize USC content if query mentions USC
            if (/usc|university\s+student\s+council/i.test(content)) {
              relevanceScore += isUSCQuery ? 300 : 100;
            }
            
            // Prioritize officers/executives if query asks about officers
            if (/president|vice\s+president|secretary|treasurer|auditor|pio|business\s+manager/i.test(category)) {
              relevanceScore += isOfficersQuery ? 280 : 150;
            }
            
            // Prioritize executives2025 field
            if (/executives2025/i.test(metadataField)) {
              relevanceScore += 250;
            }
            
            // Section match
            if ((chunk.section || '').toLowerCase() === 'studentorganizations') {
              relevanceScore += 200;
            }
            
            // Officer names/positions in content
            if (/naxes\s+cablinda|john\s+carlo\s+balante|diether\s+manguiob|jay\s+ponce|lemwiel\s+hitutua|ian\s+carlo\s+calub|tyrone\s+kyle\s+dapitanon/i.test(content)) {
              relevanceScore += 180;
            }
            
            // Ang Sidlakan specific
            if (/ang\s+sidlakan/i.test(content)) {
              relevanceScore += isAngSidlakanQuery ? 120 : 60;
            }
            
            // Catalyst specific
            if (/catalyst/i.test(content)) {
              relevanceScore += isCatalystQuery ? 120 : 60;
            }
            
            // Keywords match
            if (chunk.keywords && chunk.keywords.includes('usc')) {
              relevanceScore += 80;
            }
            if (chunk.keywords && chunk.keywords.includes('student')) {
              relevanceScore += 60;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by relevance score and take top results
          scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_student_org_aggregation');
          Logger.debug(`✅ Student org aggregation: Found ${results.length} chunks`);
        }
      } catch (error) {
        Logger.debug(`Student org aggregation failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Vector search to get all relevant chunks
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to student organization chunks
        const orgVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            return section === 'studentorganizations' ||
                   section.includes('studentorganizations') ||
                   content.includes('university student council') ||
                   content.includes('usc') ||
                   content.includes('ang sidlakan') ||
                   content.includes('catalyst') ||
                   category.includes('president') ||
                   category.includes('vice president') ||
                   category.includes('secretary') ||
                   category.includes('treasurer') ||
                   category.includes('auditor') ||
                   category.includes('pio') ||
                   category.includes('business manager') ||
                   metadataField.includes('studentorganizations') ||
                   metadataField.includes('executives2025');
          })
          .map(chunk => {
            // Boost score for chunks that match query intent
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            if (isUSCQuery && (content.includes('usc') || content.includes('university student council'))) score += 100;
            if (isOfficersQuery && (category.includes('president') || category.includes('vice president') || 
                category.includes('secretary') || category.includes('treasurer') || 
                category.includes('auditor') || category.includes('pio') || 
                category.includes('business manager'))) score += 90;
            if (metadataField.includes('executives2025')) score += 80;
            if (category.includes('president') || category.includes('vice president')) score += 70;
            if (content.includes('naxes cablinda') || content.includes('john carlo balante')) score += 60;
            
            return {
              ...chunk,
              score: score
            };
          });
        
        // Merge with aggregation results
        orgVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_student_org'
            });
          }
        });
      } catch (error) {
        Logger.debug(`Student org vector search failed: ${error.message}`);
      }
    }
    
    // If query asks about officers and we don't have enough, ensure we get all executive chunks
    if (isOfficersQuery && results.length < 7 && this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const officerChunks = await collection.find({
          section: 'studentOrganizations',
          'metadata.field': { $regex: /executives2025/i }
        }).toArray();
        
        officerChunks.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.content || chunk.text || '',
              score: 200, // High score to ensure they're included
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_direct_officers_search'
            });
          }
        });
        Logger.debug(`✅ Direct officers search: Added ${officerChunks.length} officer chunks`);
      } catch (error) {
        Logger.debug(`Direct officers search failed: ${error.message}`);
      }
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Search for comprehensive/listing queries
   */
  async searchComprehensive(query, options = {}) {
    const { maxResults = 30, maxSections = 30 } = options;
    
    Logger.debug(`📋 Comprehensive search: "${query.substring(0, 40)}..."`);
    
    let results = [];
    
    // PRIMARY: MongoDB vector search
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxSections);
        
        results = vectorResults.map(chunk => ({
          id: chunk.id,
          section: chunk.section,
          type: chunk.type,
          text: chunk.text || chunk.content || '',
          score: chunk.score || 0,
          metadata: chunk.metadata || {},
          keywords: chunk.keywords || [],
          category: chunk.category,
          source: 'mongodb_vector_search_comprehensive'
        }));
      } catch (error) {
        Logger.debug(`Comprehensive vector search failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Keyword search
    if (results.length < maxSections) {
      const keywordResults = await this.searchKeyword(query, maxSections);
      keywordResults.forEach(chunk => {
        if (!results.find(r => r.id === chunk.id)) {
          results.push(chunk);
        }
      });
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * General search (default)
   */
  async searchGeneral(query, options = {}) {
    const { maxResults = 10, maxSections = 10 } = options;
    
    Logger.debug(`🔍 General search: "${query.substring(0, 40)}..."`);
    
    let results = [];
    
    // PRIMARY: MongoDB vector search
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxSections * 2);
        
        results = vectorResults.map(chunk => ({
          id: chunk.id,
          section: chunk.section,
          type: chunk.type,
          text: chunk.text || chunk.content || '',
          score: chunk.score || 0,
          metadata: chunk.metadata || {},
          keywords: chunk.keywords || [],
          category: chunk.category,
          source: 'mongodb_vector_search_general'
        }));
        
        Logger.debug(`✅ General vector search: Found ${results.length} chunks`);
      } catch (error) {
        Logger.debug(`General vector search failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Keyword search if needed
    if (results.length < maxSections) {
      const keywordResults = await this.searchKeyword(query, maxSections);
      keywordResults.forEach(chunk => {
        if (!results.find(r => r.id === chunk.id)) {
          results.push(chunk);
        }
      });
    }
    
    // FALLBACK: FAISS if available
    if (results.length === 0 && this.faissIndex && this.textChunks.length > 0) {
      try {
        const faissResults = await this.searchFAISS(query, maxSections);
        results = faissResults;
      } catch (error) {
        Logger.debug(`FAISS search failed: ${error.message}`);
      }
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Keyword-based search (fallback/supplement)
   */
  async searchKeyword(query, maxResults = 10) {
    // If faissOptimizedData is empty, use MongoDB search
    if ((!this.faissOptimizedData || !this.faissOptimizedData.chunks || this.faissOptimizedData.chunks.length === 0) && this.mongoService) {
      return await this.searchMongoDB(query, maxResults);
    }
    
    if (!this.faissOptimizedData || !this.faissOptimizedData.chunks) {
      return [];
    }
    
    // Correct typos
    let correctedQuery = query;
    try {
      const typoCorrection = TypoCorrector.correctTypos(query, {
        maxDistance: 2,
        minSimilarity: 0.6,
        correctPhrases: true
      });
      if (typoCorrection.hasCorrections) {
        correctedQuery = typoCorrection.corrected;
      }
    } catch (error) {
      Logger.debug(`Typo correction failed: ${error.message}`);
    }
    
    const queryLower = correctedQuery.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const results = [];
    
    // Score each chunk
    this.faissOptimizedData.chunks.forEach(chunk => {
      let score = 0;
      const chunkText = (chunk.text || chunk.content || '').toLowerCase();
      const categoryLower = (chunk.category || '').toLowerCase();
      const sectionLower = (chunk.section || '').toLowerCase();
      
      // Exact phrase match
      if (chunkText.includes(queryLower)) {
        score += 50;
      }
      
      // Word matches
      queryWords.forEach(word => {
        const occurrences = (chunkText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
        if (occurrences > 0) {
          score += occurrences * 2;
        }
      });
      
      // Keyword matches
      if (chunk.keywords) {
        chunk.keywords.forEach(keyword => {
          const keywordLower = keyword.toLowerCase();
          if (queryWords.some(qw => keywordLower.includes(qw) || qw.includes(keywordLower))) {
            score += 5;
          }
        });
      }
      
      if (score > 0) {
        results.push({
          id: chunk.id,
          section: chunk.section,
          type: chunk.type,
          text: chunk.text || chunk.content || '',
          score: score,
          metadata: chunk.entities || chunk.metadata || {},
          keywords: chunk.keywords || [],
          category: chunk.category,
          source: 'keyword_search'
        });
      }
    });
    
    return this._sortByScore(results).slice(0, maxResults);
  }

  /**
   * MongoDB native search
   */
  async searchMongoDB(query, maxResults = 10) {
    if (!this.mongoService) {
      return [];
    }
    
    try {
      const collection = this.mongoService.getCollection('knowledge_chunks');
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      
      const mongoQuery = {
        $or: [
          { keywords: { $in: queryWords } },
          { category: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { section: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { type: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { content: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { text: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        ]
      };
      
      const results = await collection.find(mongoQuery)
        .sort({ 'metadata.updated_at': -1 })
        .limit(maxResults * 2)
        .toArray();
      
      return this._convertMongoChunksToRAG(results, 100, 'mongodb_native_search').slice(0, maxResults);
    } catch (error) {
      Logger.error('MongoDB native search failed:', error);
      return [];
    }
  }

  /**
   * FAISS vector search (fallback)
   */
  async searchFAISS(query, maxResults = 10) {
    if (!this.faissIndex || this.textChunks.length === 0) {
      return [];
    }
    
    try {
      const embeddingService = getEmbeddingService();
      const queryEmbedding = await embeddingService.embedText(query);
      
      const actualMaxResults = Math.min(maxResults, this.textChunks.length);
      const searchResult = this.faissIndex.search(queryEmbedding, actualMaxResults * 2);
      
      const results = [];
      const labels = searchResult.labels || [];
      const distances = searchResult.distances || [];
      
      for (let i = 0; i < labels.length; i++) {
        const index = labels[i];
        const distance = distances[i];
        const chunk = this.textChunks[index];
        
        if (chunk) {
          const similarity = 1 / (1 + distance);
          results.push({
            id: chunk.id,
            section: chunk.section,
            type: chunk.type,
            text: chunk.text,
            score: similarity * 100,
            metadata: chunk.metadata,
            keywords: chunk.keywords,
            source: 'faiss_search'
          });
        }
      }
      
      return this._sortByScore(results).slice(0, actualMaxResults);
    } catch (error) {
      Logger.error('FAISS search failed', error);
      return [];
    }
  }

  /**
   * Search for programs/courses queries
   */
  async searchPrograms(query, options = {}) {
    const { maxResults = 30, maxSections = 30 } = options;
    
    Logger.debug(`📚 Programs/Courses search: "${query.substring(0, 40)}..."`);
    
    // Detect specific program code or name
    const programCodeMatch = query.match(/\b(BSAM|BSA|BSBio|BSES|BSDevCom|AB\s+PolSci|BS\s+Psych|BSBA|BSHM|BSC|BITM|BSCE|BSIT|BSMath|BSMRS|BSN|BEED|BSED|BSHM|BSPH|BSTM|BSE|BSEd|BSN|BSBA|BSC|BITM|BSCE|BSIT|BSMath|BSMRS|BSES|BSBio|BSA|BSAM|BSDevCom|BS\s+Psych|AB\s+PolSci)\b/i);
    const programCode = programCodeMatch ? programCodeMatch[0] : null;
    
    // Detect faculty mention
    const facultyCodeMatch = query.match(/\b(FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM)\b/i);
    const facultyCode = facultyCodeMatch ? facultyCodeMatch[0] : null;
    
    const isListingQuery = /\b(list|all|every|show\s+all|what\s+are\s+the|enumerate|programs?|courses?)\b/i.test(query);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for programs
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const matchConditions = {
          $or: [
            // Section-based matching
            { section: { $regex: /^programs$/i } },
            { section: { $regex: /allProgramsOffered/i } },
            // Content-based matching
            { content: { $regex: /bachelor|BS|BA|MA|MS|PhD|EdD|program|course|degree|academic\s+program/i } },
            { text: { $regex: /bachelor|BS|BA|MA|MS|PhD|EdD|program|course|degree|academic\s+program/i } },
            // Metadata-based matching - prioritize programs organized by faculty
            { 'metadata.field': { $regex: /programs\.(FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM)|programs\..*\.programs|allProgramsOffered/i } },
            { type: { $regex: /academic_program|program/i } },
            // Keywords matching
            { keywords: { $in: ['program', 'programs', 'course', 'courses', 'degree', 'degrees', 'bachelor', 'academic'] } }
          ]
        };
        
        // Add specific program code filter if found
        if (programCode) {
          matchConditions.$or.push(
            { content: { $regex: new RegExp(programCode.replace(/\s+/g, '\\s+'), 'i') } },
            { text: { $regex: new RegExp(programCode.replace(/\s+/g, '\\s+'), 'i') } },
            { 'metadata.programCode': { $regex: new RegExp(programCode, 'i') } }
          );
        }
        
        // Add faculty filter if found
        if (facultyCode) {
          matchConditions.$or.push(
            { content: { $regex: new RegExp(`faculty:.*${facultyCode}|${facultyCode}`, 'i') } },
            { text: { $regex: new RegExp(`faculty:.*${facultyCode}|${facultyCode}`, 'i') } },
            { 'metadata.facultyCode': { $regex: new RegExp(facultyCode, 'i') } },
            { category: { $regex: new RegExp(facultyCode.toLowerCase(), 'i') } }
          );
        }
        
        const pipeline = [
          { $match: matchConditions },
          { $limit: maxResults * 2 }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores based on query intent
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const programCodeMeta = (chunk.metadata?.programCode || '').toLowerCase();
            const facultyCodeMeta = (chunk.metadata?.facultyCode || '').toLowerCase();
            
            // Prioritize exact program code match
            if (programCode && (content.includes(programCode.toLowerCase()) || programCodeMeta === programCode.toLowerCase())) {
              relevanceScore += 300;
            }
            
            // Prioritize faculty match
            if (facultyCode && (content.includes(facultyCode.toLowerCase()) || facultyCodeMeta === facultyCode.toLowerCase() || category.includes(facultyCode.toLowerCase()))) {
              relevanceScore += 250;
            }
            
            // Prioritize programs organized by faculty (programs.FACET, programs.FALS, etc.)
            if (/programs\.(facet|fals|fted|fbm|fcje|fnahs|fhusocom)/i.test(metadataField)) {
              relevanceScore += 280; // Higher than flat list - faculty-organized is better
            }
            
            // Prioritize programs section
            if ((chunk.section || '').toLowerCase() === 'programs' || metadataField.includes('programs')) {
              relevanceScore += 200;
            }
            
            // Prioritize allProgramsOffered section
            if (metadataField.includes('allprogramsoffered')) {
              relevanceScore += 180;
            }
            
            // Boost for chunks that include faculty information in content
            if (/faculty:\s*(faculty\s+of|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM)/i.test(content)) {
              relevanceScore += 170; // High score for faculty categorization
            }
            
            // Prioritize academic_program type
            if ((chunk.type || '').toLowerCase() === 'academic_program') {
              relevanceScore += 150;
            }
            
            // Faculty code in metadata
            if (facultyCodeMeta && facultyCodeMeta.length > 0) {
              relevanceScore += 140;
            }
            
            // Program codes in content
            if (/BSAM|BSA|BSBio|BSES|BSDevCom|BS\s+Psych|BSBA|BSHM|BSC|BITM|BSCE|BSIT|BSMath|BSMRS|BSN|BEED|BSED/i.test(content)) {
              relevanceScore += 120;
            }
            
            // Keywords match
            if (chunk.keywords && (chunk.keywords.includes('program') || chunk.keywords.includes('course') || chunk.keywords.includes('degree'))) {
              relevanceScore += 80;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by relevance score and take top results
          scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_programs_aggregation');
          Logger.debug(`✅ Programs aggregation: Found ${results.length} chunks`);
        }
      } catch (error) {
        Logger.debug(`Programs aggregation failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Vector search to get all program chunks
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to program chunks
        const programVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            return section === 'programs' ||
                   section.includes('programs') ||
                   metadataField.includes('programs.') ||
                   metadataField.includes('programs.facet') ||
                   metadataField.includes('programs.fals') ||
                   metadataField.includes('programs.fted') ||
                   metadataField.includes('programs.fbm') ||
                   metadataField.includes('programs.fcje') ||
                   metadataField.includes('programs.fnahs') ||
                   metadataField.includes('programs.fhusocom') ||
                   metadataField.includes('allprogramsoffered') ||
                   type === 'academic_program' ||
                   (content.includes('bachelor of science') && content.includes('faculty:')) ||
                   (content.includes('bachelor of arts') && content.includes('faculty:')) ||
                   (content.includes('bachelor in') && content.includes('faculty:')) ||
                   /BS|BA|MA|MS|PhD|EdD|bachelor|master|doctorate/i.test(content);
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            
            // Boost for programs organized by faculty
            if (/programs\.(facet|fals|fted|fbm|fcje|fnahs|fhusocom)/i.test(metadataField)) {
              score += 120; // Higher boost for faculty-organized programs
            }
            if (section === 'programs' || type === 'academic_program') score += 100;
            // Boost if content includes faculty information
            if (/faculty:\s*(faculty\s+of|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM)/i.test(content)) {
              score += 90; // Programs with faculty categorization
            }
            if (programCode && content.includes(programCode.toLowerCase())) score += 80;
            if (facultyCode && content.includes(facultyCode.toLowerCase())) score += 70;
            if (/BS|BA|MA|MS|PhD|EdD/i.test(content)) score += 50;
            
            return { ...chunk, score };
          });
        
        // Merge with aggregation results
        programVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_programs'
            });
          }
        });
      } catch (error) {
        Logger.debug(`Programs vector search failed: ${error.message}`);
      }
    }
    
    // Ensure we get programs from all faculties - check if we have programs from all 7 faculties
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        
        // Get programs from each faculty (programs.FACET, programs.FALS, etc.)
        const facultyCodes = ['FACET', 'FALS', 'FTED', 'FBM', 'FCJE', 'FNAHS', 'FHUSOCOM'];
        const foundFaculties = new Set();
        
        results.forEach(chunk => {
          const metadataField = (chunk.metadata?.field || '').toLowerCase();
          facultyCodes.forEach(code => {
            if (metadataField.includes(`programs.${code.toLowerCase()}`)) {
              foundFaculties.add(code);
            }
          });
        });
        
        // If missing any faculty's programs, fetch them directly
        const missingFaculties = facultyCodes.filter(code => !foundFaculties.has(code));
        if (missingFaculties.length > 0) {
          for (const facultyCode of missingFaculties) {
            const facultyPrograms = await collection.find({
              section: 'programs',
              'metadata.field': { $regex: new RegExp(`programs\\.${facultyCode}`, 'i') }
            }).limit(20).toArray(); // Increased limit to ensure all programs are retrieved
            
            facultyPrograms.forEach(chunk => {
              if (!results.find(r => r.id === chunk.id)) {
                results.push({
                  id: chunk.id,
                  section: chunk.section,
                  type: chunk.type,
                  text: chunk.content || chunk.text || '',
                  score: 250, // High score to ensure inclusion
                  metadata: chunk.metadata || {},
                  keywords: chunk.keywords || [],
                  category: chunk.category,
                  source: 'mongodb_direct_faculty_programs_search'
                });
              }
            });
          }
          Logger.debug(`✅ Direct faculty programs search: Added programs from ${missingFaculties.length} faculties`);
        }
      } catch (error) {
        Logger.debug(`Direct faculty programs search failed: ${error.message}`);
      }
    }
    
    // Sort results before returning
    const sortedResults = this._sortByScore(results);
    
    // For listing queries, ensure we don't cut off before checking all faculties
    if (isListingQuery) {
      // Return more results for listing queries to ensure all faculties are represented
      return sortedResults.slice(0, maxSections * 2); // Increase limit for listing queries
    }
    
    return sortedResults.slice(0, maxSections);
  }

  /**
   * Search for faculties queries
   */
  async searchFaculties(query, options = {}) {
    const { maxResults = 15, maxSections = 15 } = options;
    
    Logger.debug(`🏛️ Faculties search: "${query.substring(0, 40)}..."`);
    
    // Detect specific faculty code
    const facultyCodeMatch = query.match(/\b(FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM)\b/i);
    const facultyCode = facultyCodeMatch ? facultyCodeMatch[0] : null;
    
    const isListingQuery = /\b(list|all|every|show\s+all|what\s+are\s+the|enumerate|faculties?)\b/i.test(query);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for faculties
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const matchConditions = {
          $or: [
            // Section-based matching
            { section: { $regex: /^faculties$/i } },
            // Content-based matching
            { content: { $regex: /faculty|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|faculty of/i } },
            { text: { $regex: /faculty|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|faculty of/i } },
            // Metadata-based matching
            { 'metadata.field': { $regex: /^faculties$/i } },
            { type: { $regex: /faculty/i } },
            { category: { $regex: /facet|fals|fted|fbm|fcje|fnahs|fhusocom/i } },
            // Keywords matching
            { keywords: { $in: ['faculty', 'faculties', 'facet', 'fals', 'fted', 'fbm', 'fcje', 'fnahs', 'fhusocom'] } }
          ]
        };
        
        // Add specific faculty code filter if found
        if (facultyCode) {
          matchConditions.$or.push(
            { content: { $regex: new RegExp(facultyCode, 'i') } },
            { text: { $regex: new RegExp(facultyCode, 'i') } },
            { 'metadata.facultyCode': { $regex: new RegExp(facultyCode, 'i') } },
            { category: { $regex: new RegExp(facultyCode.toLowerCase(), 'i') } }
          );
        }
        
        const pipeline = [
          { $match: matchConditions },
          { $limit: maxResults * 2 }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const facultyCodeMeta = (chunk.metadata?.facultyCode || '').toLowerCase();
            
            // Prioritize exact faculty code match
            if (facultyCode && (content.includes(facultyCode.toLowerCase()) || 
                facultyCodeMeta === facultyCode.toLowerCase() || 
                category === facultyCode.toLowerCase())) {
              relevanceScore += 300;
            }
            
            // Prioritize faculties section
            if ((chunk.section || '').toLowerCase() === 'faculties' || metadataField.includes('faculties')) {
              relevanceScore += 200;
            }
            
            // Prioritize faculty type
            if ((chunk.type || '').toLowerCase() === 'faculty') {
              relevanceScore += 180;
            }
            
            // Faculty codes in content
            if (/facet|fals|fted|fbm|fcje|fnahs|fhusocom/i.test(content)) {
              relevanceScore += 150;
            }
            
            // Faculty names
            if (/faculty of/i.test(content)) {
              relevanceScore += 120;
            }
            
            // Keywords match
            if (chunk.keywords && (chunk.keywords.includes('faculty') || chunk.keywords.includes('faculties'))) {
              relevanceScore += 80;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by relevance score
          scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_faculties_aggregation');
          Logger.debug(`✅ Faculties aggregation: Found ${results.length} chunks`);
        }
      } catch (error) {
        Logger.debug(`Faculties aggregation failed: ${error.message}`);
      }
    }
    
    // SUPPLEMENT: Vector search
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to faculty chunks
        const facultyVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            
            return section === 'faculties' ||
                   type === 'faculty' ||
                   /faculty\s+of|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM/i.test(content) ||
                   /facet|fals|fted|fbm|fcje|fnahs|fhusocom/i.test(category);
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            
            if (section === 'faculties') score += 100;
            if (facultyCode && content.includes(facultyCode.toLowerCase())) score += 80;
            if (/faculty\s+of/i.test(content)) score += 70;
            if (/FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM/i.test(content)) score += 50;
            
            return { ...chunk, score };
          });
        
        // Merge with aggregation results
        facultyVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_faculties'
            });
          }
        });
      } catch (error) {
        Logger.debug(`Faculties vector search failed: ${error.message}`);
      }
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Search for deans queries
   */
  async searchDeans(query, options = {}) {
    const { maxResults = 10, maxSections = 10 } = options;
    
    Logger.debug(`🎓 Deans search: "${query.substring(0, 40)}..."`);
    
    // Log data fetch operation
    Logger.logDataFetch('searchDeans', query, {
      method: 'searchDeans',
      maxResults,
      maxSections
    });
    
    // Faculty code to name mapping
    const facultyCodeToName = {
      'FACET': ['Faculty of Computing, Engineering, and Technology', 'Faculty of Computing, Engineering and Technology', 'Computing, Engineering, and Technology', 'Computing, Engineering and Technology'],
      'FALS': ['Faculty of Agriculture and Life Sciences', 'Agriculture and Life Sciences'],
      'FTED': ['Faculty of Teacher Education', 'Teacher Education'],
      'FBM': ['Faculty of Business Management', 'Faculty of Business and Management', 'Business Management', 'Business and Management'],
      'FCJE': ['Faculty of Criminal Justice Education', 'Criminal Justice Education'],
      'FNAHS': ['Faculty of Nursing and Allied Health Sciences', 'Faculty of Nursing and Allied Health Services', 'Nursing and Allied Health Sciences', 'Nursing and Allied Health Services'],
      'FHUSOCOM': ['Faculty of Humanities, Social Sciences, and Communications', 'Faculty of Humanities, Social Sciences and Communication', 'Humanities, Social Sciences, and Communications', 'Humanities, Social Sciences and Communication']
    };
    
    // Detect specific faculty for dean
    const facultyCodeMatch = query.match(/\b(FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM)\b/i);
    const facultyCode = facultyCodeMatch ? facultyCodeMatch[0].toUpperCase() : null;
    const facultyNames = facultyCode ? facultyCodeToName[facultyCode] || [] : [];
    
    // Detect faculty name mentions
    const facultyNamePattern = /\b(faculty\s+of\s+(agriculture|life\s+sciences|computing|engineering|technology|business|management|criminal\s+justice|nursing|allied\s+health|teacher\s+education|humanities|social\s+sciences|communication))\b/i;
    const facultyNameMatch = query.match(facultyNamePattern);
    
    const isListingQuery = /\b(list|all|every|show\s+all|what\s+are\s+the|enumerate|deans?)\b/i.test(query);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for deans
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const matchConditions = {
          $and: [
            {
              $or: [
                // Section-based matching - check both leadership and organizationalStructure sections
                { section: { $regex: /^leadership$/i } },
                { section: { $regex: /organizationalStructure/i } },
                // Content-based matching - dean names (ALL dean names from data)
                { content: { $regex: /dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn).*\s+(valdez|vilela|maypa|jacobe|aparicio|llanita|tabotabo|arles)/i } },
                { text: { $regex: /dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn).*\s+(valdez|vilela|maypa|jacobe|aparicio|llanita|tabotabo|arles)/i } },
                // Faculty names in dean context
                { content: { $regex: /faculty.*dean|dean.*faculty|faculty\s+of\s+(agriculture|life\s+sciences|computing|engineering|technology|business|management|criminal\s+justice|nursing|allied\s+health|teacher\s+education|humanities|social\s+sciences|communication)/i } },
                { text: { $regex: /faculty.*dean|dean.*faculty|faculty\s+of\s+(agriculture|life\s+sciences|computing|engineering|technology|business|management|criminal\s+justice|nursing|allied\s+health|teacher\s+education|humanities|social\s+sciences|communication)/i } },
                // Metadata-based matching - check for deans field (both leadership.deans and organizationalStructure/DOrSUOfficials2025.deans)
                { 'metadata.field': { $regex: /leadership\.deans|organizationalStructure\/DOrSUOfficials2025\.deans|\.deans/i } },
                { 'metadata.faculty': { $regex: /faculty\s+of/i } },
                { 'metadata.name': { $regex: /dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn)/i } },
                { type: { $regex: /dean/i } },
                { category: { $regex: /dean/i } },
                // Keywords matching
                { keywords: { $in: ['dean', 'deans', 'faculty'] } }
              ]
            },
            {
              // Exclude non-dean leadership
              $nor: [
                { content: { $regex: /president|vice\s+president|chancellor|director/i } },
                { type: { $regex: /president|vice_president|director/i } }
              ]
            }
          ]
        };
        
        // Add specific faculty filter if found (both code and name variations)
        if (facultyCode) {
          // Log faculty code detection and mapping
          Logger.logDataFetch('searchDeans', query, {
            method: 'mongodb_aggregation',
            filters: {
              facultyCode,
              facultyNames,
              isListingQuery
            }
          });
          
          // Add faculty code match
          matchConditions.$and[0].$or.push(
            { content: { $regex: new RegExp(facultyCode, 'i') } },
            { text: { $regex: new RegExp(facultyCode, 'i') } }
          );
          
          // Add faculty name matches (map code to actual faculty names in database)
          facultyNames.forEach(facultyName => {
            // Escape special regex characters
            const escapedName = facultyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            matchConditions.$and[0].$or.push(
              { content: { $regex: new RegExp(escapedName, 'i') } },
              { text: { $regex: new RegExp(escapedName, 'i') } },
              { 'metadata.faculty': { $regex: new RegExp(escapedName, 'i') } }
            );
          });
        }
        
        if (facultyNameMatch) {
          const facultyName = facultyNameMatch[0].toLowerCase();
          // Escape special regex characters
          const escapedName = facultyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          matchConditions.$and[0].$or.push(
            { content: { $regex: new RegExp(escapedName, 'i') } },
            { text: { $regex: new RegExp(escapedName, 'i') } },
            { 'metadata.faculty': { $regex: new RegExp(escapedName, 'i') } }
          );
        }
        
        const pipeline = [
          { $match: matchConditions },
          { $limit: maxResults * 2 }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
          const metadataField = (chunk.metadata?.field || '').toLowerCase();
          const metadataFaculty = (chunk.metadata?.faculty || '').toLowerCase();
          const section = (chunk.section || '').toLowerCase();
            
            // Prioritize deans field (leadership.deans or organizationalStructure/DOrSUOfficials2025.deans)
            if (metadataField.includes('leadership.deans') || metadataField.includes('organizationalstructure/dorsuofficials2025.deans') || (metadataField.includes('deans') && section.includes('organizationalstructure'))) {
              relevanceScore += 300;
            }
            
            // Prioritize dean type
            if ((chunk.type || '').toLowerCase().includes('dean')) {
              relevanceScore += 280;
            }
            
            // Prioritize leadership section or organizationalStructure section with deans
            if (section === 'leadership' || (section.includes('organizationalstructure') && metadataField.includes('deans'))) {
              relevanceScore += 250;
            }
            
            // Faculty match (check both code and name variations)
            if (facultyCode && content.includes(facultyCode.toLowerCase())) {
              relevanceScore += 200;
            }
            // Check if content contains any of the faculty names for this code
            if (facultyCode && facultyNames.length > 0) {
              const contentLower = content.toLowerCase();
              const facultyNameMatched = facultyNames.some(name => contentLower.includes(name.toLowerCase()));
              if (facultyNameMatched) {
                relevanceScore += 200;
              }
            }
            if (facultyNameMatch && content.includes(facultyNameMatch[0].toLowerCase())) {
              relevanceScore += 200;
            }
            // Check metadata.faculty against faculty names
            if (metadataFaculty && facultyCode && facultyNames.length > 0) {
              const metadataFacultyLower = metadataFaculty.toLowerCase();
              const facultyNameMatched = facultyNames.some(name => metadataFacultyLower.includes(name.toLowerCase()));
              if (facultyNameMatched) {
                relevanceScore += 180;
              }
            }
            if (metadataFaculty && facultyCode && metadataFaculty.includes(facultyCode.toLowerCase())) {
              relevanceScore += 180;
            }
            
            // Dean names
            if (/dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn)/i.test(content)) {
              relevanceScore += 150;
            }
            
            // Faculty + Dean combination
            if (/faculty.*dean|dean.*faculty/i.test(content)) {
              relevanceScore += 120;
            }
            
            // Keywords match
            if (chunk.keywords && chunk.keywords.includes('dean')) {
              relevanceScore += 80;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by relevance score
          scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_deans_aggregation');
          Logger.debug(`✅ Deans aggregation: Found ${results.length} chunks`);
          
          // Log retrieved chunks from aggregation
          Logger.logRetrievedChunks(query, results, {
            source: 'mongodb_deans_aggregation',
            maxChunks: 10,
            showFullContent: true
          });
        }
      } catch (error) {
        Logger.debug(`Deans aggregation failed: ${error.message}`);
        Logger.error(`Deans aggregation error:`, error);
      }
    }
    
    // SUPPLEMENT: Vector search
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to dean chunks
        const deanVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const metadataFaculty = (chunk.metadata?.faculty || '').toLowerCase();
            
            return (section === 'leadership' && (content.includes('dean') || type.includes('dean'))) ||
                   (section.includes('organizationalstructure') && (metadataField.includes('deans') || (metadataFaculty.includes('faculty') && /dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn)/i.test(content)))) ||
                   metadataField.includes('deans') ||
                   /dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn).*\s+(valdez|vilela|maypa|jacobe|aparicio|llanita|tabotabo|arles)/i.test(content) ||
                   (/faculty/i.test(content) && /dean/i.test(content));
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            
            if (section === 'leadership' && (type.includes('dean') || content.includes('dean'))) score += 100;
            if (section.includes('organizationalstructure') && type === 'dean') score += 100;
            // Check faculty code
            if (facultyCode && content.includes(facultyCode.toLowerCase())) score += 80;
            // Check faculty names
            if (facultyCode && facultyNames.length > 0) {
              const contentLower = content.toLowerCase();
              const facultyNameMatched = facultyNames.some(name => contentLower.includes(name.toLowerCase()));
              if (facultyNameMatched) score += 80;
            }
            if (/dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn)/i.test(content)) score += 70;
            if (/faculty.*dean|dean.*faculty/i.test(content)) score += 50;
            
            return { ...chunk, score };
          });
        
        // Merge with aggregation results
        deanVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_deans'
            });
          }
        });
      } catch (error) {
        Logger.debug(`Deans vector search failed: ${error.message}`);
      }
    }
    
    // Ensure we have all deans if listing query
    if (isListingQuery && results.length < 8 && this.mongoService) {
      try {
        Logger.logDataFetch('searchDeans_fallback', query, {
          method: 'mongodb_direct_search',
          filters: {
            isListingQuery: true,
            currentResults: results.length,
            targetCount: 8
          }
        });
        
        const collection = this.mongoService.getCollection('knowledge_chunks');
        // Search in both leadership section and organizationalStructure section
        const allDeanChunks = await collection.find({
          $or: [
            { section: 'leadership', 'metadata.field': { $regex: /leadership\.deans|\.deans/i } },
            { section: { $regex: /organizationalStructure/i }, 'metadata.field': { $regex: /organizationalStructure\/DOrSUOfficials2025\.deans|\.deans/i } },
            { section: { $regex: /organizationalStructure/i }, type: 'dean' },
            { section: { $regex: /organizationalStructure/i }, 'metadata.faculty': { $regex: /faculty\s+of/i }, 'metadata.name': { $regex: /dr\.\s*(gemma|eleanor|rizaldy|danilo|rex|goriel|michelle|jocelyn)/i } }
          ]
        }).toArray();
        
        Logger.logRetrievedChunks(query, allDeanChunks, {
          source: 'mongodb_direct_deans_search',
          maxChunks: 10,
          showFullContent: true
        });
        
        allDeanChunks.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.content || chunk.text || '',
              score: 200, // High score to ensure inclusion
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_direct_deans_search'
            });
          }
        });
        Logger.debug(`✅ Direct deans search: Added ${allDeanChunks.length} dean chunks`);
      } catch (error) {
        Logger.debug(`Direct deans search failed: ${error.message}`);
        Logger.error(`Direct deans search error:`, error);
      }
    }
    
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Search for hymn/anthem queries
   */
  async searchHymn(query, options = {}) {
    const { maxResults = 30, maxSections = 30 } = options;
    
    Logger.debug(`🎵 Hymn search: "${query.substring(0, 40)}..."`);
    
    // Log data fetch operation
    Logger.logDataFetch('searchHymn', query, {
      method: 'searchHymn',
      maxResults,
      maxSections
    });
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for hymn chunks
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const matchConditions = {
          $and: [
            {
              $or: [
                // Match hymn-related metadata fields
                { 'metadata.field': { $regex: /identity\.hymn/i } },
                { section: { $regex: /visionMission/i }, 'metadata.field': { $regex: /hymn/i } },
                // Match hymn-related content
                { content: { $regex: /(hymn|anthem|alma\s+matter|davao\s+oriental\s+state\s+university|harold\s+chang|jillian\s+sitchon)/i } },
                { text: { $regex: /(hymn|anthem|alma\s+matter|davao\s+oriental\s+state\s+university|harold\s+chang|jillian\s+sitchon)/i } },
                // Match keywords
                { keywords: { $in: ['hymn', 'anthem', 'lyrics', 'song'] } }
              ]
            }
          ]
        };
        
        const pipeline = [
          { $match: matchConditions },
          { $limit: maxResults * 2 }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            
            // Prioritize hymn-specific fields
            if (metadataField.includes('identity.hymn.lyrics')) {
              relevanceScore += 300;
              // Prioritize different sections of lyrics
              if (metadataField.includes('verse1')) relevanceScore += 50;
              if (metadataField.includes('verse2')) relevanceScore += 50;
              if (metadataField.includes('chorus')) relevanceScore += 50;
              if (metadataField.includes('finalchorus')) relevanceScore += 50;
            }
            
            if (metadataField.includes('identity.hymn.title')) relevanceScore += 280;
            if (metadataField.includes('identity.hymn.composers')) relevanceScore += 250;
            if (metadataField.includes('identity.hymn')) relevanceScore += 200;
            
            // Section-based scoring
            if (section === 'visionmission') relevanceScore += 100;
            
            // Content-based scoring
            if (/hymn|anthem/i.test(content)) relevanceScore += 150;
            if (/lyrics|verse|chorus/i.test(content)) relevanceScore += 120;
            if (/alma\s+matter/i.test(content)) relevanceScore += 100;
            if (/harold\s+chang|jillian\s+sitchon/i.test(content)) relevanceScore += 80;
            
            // Keywords match
            if (chunk.keywords && (chunk.keywords.includes('hymn') || chunk.keywords.includes('anthem'))) {
              relevanceScore += 100;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by verse order first, then by index within each verse, then by relevance score
          const verseOrder = { 'verse1': 1, 'chorus': 2, 'verse2': 3, 'finalchorus': 4 };
          scoredResults.sort((a, b) => {
            const aField = (a.metadata?.field || '').toLowerCase();
            const bField = (b.metadata?.field || '').toLowerCase();
            
            // Extract verse type
            let aVerse = 'other';
            let bVerse = 'other';
            if (aField.includes('verse1')) aVerse = 'verse1';
            else if (aField.includes('verse2')) aVerse = 'verse2';
            else if (aField.includes('finalchorus')) aVerse = 'finalchorus';
            else if (aField.includes('chorus')) aVerse = 'chorus';
            
            if (bField.includes('verse1')) bVerse = 'verse1';
            else if (bField.includes('verse2')) bVerse = 'verse2';
            else if (bField.includes('finalchorus')) bVerse = 'finalchorus';
            else if (bField.includes('chorus')) bVerse = 'chorus';
            
            // First sort by verse order
            const aOrder = verseOrder[aVerse] || 99;
            const bOrder = verseOrder[bVerse] || 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            
            // Then sort by index within each verse
            const aIndex = a.metadata?.index ?? 999;
            const bIndex = b.metadata?.index ?? 999;
            if (aIndex !== bIndex) return aIndex - bIndex;
            
            // Finally by relevance score
            return (b.relevanceScore || 0) - (a.relevanceScore || 0);
          });
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_hymn_aggregation');
          Logger.debug(`✅ Hymn aggregation: Found ${results.length} chunks`);
          
          // Log retrieved chunks from aggregation
          Logger.logRetrievedChunks(query, results, {
            source: 'mongodb_hymn_aggregation',
            maxChunks: 30,
            showFullContent: true
          });
        }
      } catch (error) {
        Logger.debug(`Hymn aggregation failed: ${error.message}`);
        Logger.error(`Hymn aggregation error:`, error);
      }
    }
    
    // SUPPLEMENT: Vector search
    if (this.mongoService && results.length < maxSections) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to hymn chunks
        const hymnVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            return metadataField.includes('identity.hymn') ||
                   metadataField.includes('hymn') ||
                   (section === 'visionmission' && /hymn|anthem|lyrics/i.test(content)) ||
                   /alma\s+matter|harold\s+chang|jillian\s+sitchon/i.test(content);
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            if (metadataField.includes('identity.hymn.lyrics')) score += 100;
            if (metadataField.includes('identity.hymn')) score += 80;
            if (/hymn|anthem/i.test(content)) score += 60;
            if (/lyrics|verse|chorus/i.test(content)) score += 50;
            
            return { ...chunk, score };
          });
        
        // Merge with existing results
        hymnVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              ...chunk,
              source: 'mongodb_vector_search_hymn'
            });
          }
        });
        
        Logger.debug(`✅ Hymn vector search: Added ${hymnVectorResults.length} chunks`);
      } catch (error) {
        Logger.debug(`Hymn vector search failed: ${error.message}`);
      }
    }
    
    // Ensure we have all hymn chunks - always fetch if we don't have enough
    if (results.length < 25 && this.mongoService) {
      try {
        Logger.logDataFetch('searchHymn_fallback', query, {
          method: 'mongodb_direct_search',
          filters: {
            currentResults: results.length,
            targetCount: 25
          }
        });
        
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const allHymnChunks = await collection.find({
          'metadata.field': { $regex: /identity\.hymn/i }
        }).toArray();
        
        // Sort by verse order and index
        const verseOrder = { 'verse1': 1, 'chorus': 2, 'verse2': 3, 'finalchorus': 4 };
        allHymnChunks.sort((a, b) => {
          const aField = (a.metadata?.field || '').toLowerCase();
          const bField = (b.metadata?.field || '').toLowerCase();
          
          let aVerse = 'other';
          let bVerse = 'other';
          if (aField.includes('verse1')) aVerse = 'verse1';
          else if (aField.includes('verse2')) aVerse = 'verse2';
          else if (aField.includes('finalchorus')) aVerse = 'finalchorus';
          else if (aField.includes('chorus')) aVerse = 'chorus';
          
          if (bField.includes('verse1')) bVerse = 'verse1';
          else if (bField.includes('verse2')) bVerse = 'verse2';
          else if (bField.includes('finalchorus')) bVerse = 'finalchorus';
          else if (bField.includes('chorus')) bVerse = 'chorus';
          
          const aOrder = verseOrder[aVerse] || 99;
          const bOrder = verseOrder[bVerse] || 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          
          const aIndex = a.metadata?.index ?? 999;
          const bIndex = b.metadata?.index ?? 999;
          return aIndex - bIndex;
        });
        
        Logger.logRetrievedChunks(query, allHymnChunks, {
          source: 'mongodb_direct_hymn_search',
          maxChunks: 30,
          showFullContent: true
        });
        
        allHymnChunks.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.content || chunk.text || '',
              score: 300, // High score to ensure inclusion
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_direct_hymn_search'
            });
          }
        });
        Logger.debug(`✅ Direct hymn search: Added ${allHymnChunks.length} hymn chunks`);
      } catch (error) {
        Logger.debug(`Direct hymn search failed: ${error.message}`);
        Logger.error(`Direct hymn search error:`, error);
      }
    }
    
    // Final sort to ensure proper order (verse1, chorus, verse2, finalChorus)
    const verseOrder = { 'verse1': 1, 'chorus': 2, 'verse2': 3, 'finalchorus': 4 };
    results.sort((a, b) => {
      const aField = (a.metadata?.field || '').toLowerCase();
      const bField = (b.metadata?.field || '').toLowerCase();
      
      let aVerse = 'other';
      let bVerse = 'other';
      if (aField.includes('verse1')) aVerse = 'verse1';
      else if (aField.includes('verse2')) aVerse = 'verse2';
      else if (aField.includes('finalchorus')) aVerse = 'finalchorus';
      else if (aField.includes('chorus')) aVerse = 'chorus';
      
      if (bField.includes('verse1')) bVerse = 'verse1';
      else if (bField.includes('verse2')) bVerse = 'verse2';
      else if (bField.includes('finalchorus')) bVerse = 'finalchorus';
      else if (bField.includes('chorus')) bVerse = 'chorus';
      
      const aOrder = verseOrder[aVerse] || 99;
      const bOrder = verseOrder[bVerse] || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      const aIndex = a.metadata?.index ?? 999;
      const bIndex = b.metadata?.index ?? 999;
      return aIndex - bIndex;
    });
    
    return results.slice(0, maxSections);
  }

  /**
   * Search for vision/mission queries
   */
  async searchVisionMission(query, options = {}) {
    const { maxResults = 15, maxSections = 15 } = options;
    
    Logger.debug(`🎯 Vision/Mission search: "${query.substring(0, 40)}..."`);
    
    // Log data fetch operation
    Logger.logDataFetch('searchVisionMission', query, {
      method: 'searchVisionMission',
      maxResults,
      maxSections
    });
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for vision/mission chunks
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const matchConditions = {
          $and: [
            {
              $or: [
                // Match vision/mission-specific metadata fields
                { 'metadata.field': { $regex: /visionMission\.(vision|mission)/i } },
                { section: { $regex: /visionMission/i }, 'metadata.field': { $regex: /vision|mission/i } },
                // Match vision/mission content (but exclude hymn chunks)
                { 
                  content: { 
                    $regex: /(university\s+of\s+excellence|innovation\s+and\s+inclusion|elevate\s+knowledge|promote\s+inclusive\s+sustainable|produce\s+holistic)/i 
                  },
                  'metadata.field': { $not: { $regex: /identity\.hymn/i } }
                },
                { 
                  text: { 
                    $regex: /(university\s+of\s+excellence|innovation\s+and\s+inclusion|elevate\s+knowledge|promote\s+inclusive\s+sustainable|produce\s+holistic)/i 
                  },
                  'metadata.field': { $not: { $regex: /identity\.hymn/i } }
                },
                // Match keywords (but exclude hymn-related)
                { 
                  keywords: { $in: ['vision', 'mission'] },
                  'metadata.field': { $not: { $regex: /identity\.hymn/i } }
                }
              ]
            },
            {
              // Exclude hymn chunks that just contain university name
              'metadata.field': { $not: { $regex: /identity\.hymn/i } }
            }
          ]
        };
        
        const pipeline = [
          { $match: matchConditions },
          { $limit: maxResults * 2 }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            
            // Prioritize vision/mission-specific fields
            if (metadataField.includes('visionMission.vision')) {
              relevanceScore += 400; // Highest priority for vision
            }
            if (metadataField.includes('visionMission.mission')) {
              relevanceScore += 350; // High priority for mission
            }
            if (metadataField.includes('visionMission')) {
              relevanceScore += 200;
            }
            
            // Section-based scoring
            if (section === 'visionmission') {
              relevanceScore += 150;
            }
            
            // Content-based scoring
            if (/university\s+of\s+excellence.*innovation.*inclusion/i.test(content)) {
              relevanceScore += 200; // Exact vision match
            }
            if (/elevate\s+knowledge|promote\s+inclusive|produce\s+holistic/i.test(content)) {
              relevanceScore += 180; // Mission statements
            }
            if (/vision|mission/i.test(content)) {
              relevanceScore += 120;
            }
            
            // Penalize chunks that are just organization.name or about
            if (metadataField.includes('organization.name') || metadataField === 'organization.about') {
              relevanceScore -= 50; // Lower priority for general org info
            }
            
            // Keywords match
            if (chunk.keywords && (chunk.keywords.includes('vision') || chunk.keywords.includes('mission'))) {
              relevanceScore += 100;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by relevance score (highest first)
          scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_vision_mission_aggregation');
          Logger.debug(`✅ Vision/Mission aggregation: Found ${results.length} chunks`);
          
          // Log retrieved chunks from aggregation
          Logger.logRetrievedChunks(query, results, {
            source: 'mongodb_vision_mission_aggregation',
            maxChunks: 15,
            showFullContent: true
          });
        }
      } catch (error) {
        Logger.debug(`Vision/Mission aggregation failed: ${error.message}`);
        Logger.error(`Vision/Mission aggregation error:`, error);
      }
    }
    
    // SUPPLEMENT: Vector search (filtered to exclude hymn chunks)
    if (this.mongoService && results.length < maxSections) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to vision/mission chunks (exclude hymn chunks)
        const visionMissionVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            // Exclude hymn chunks
            if (metadataField.includes('identity.hymn')) return false;
            
            return metadataField.includes('visionmission.vision') ||
                   metadataField.includes('visionmission.mission') ||
                   metadataField.includes('visionmission') ||
                   (section === 'visionmission' && /vision|mission|excellence.*innovation.*inclusion|elevate.*knowledge|promote.*inclusive|produce.*holistic/i.test(content));
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            if (metadataField.includes('visionMission.vision')) score += 150;
            if (metadataField.includes('visionMission.mission')) score += 130;
            if (metadataField.includes('visionMission')) score += 80;
            if (/excellence.*innovation.*inclusion/i.test(content)) score += 100;
            if (/elevate.*knowledge|promote.*inclusive|produce.*holistic/i.test(content)) score += 90;
            
            return { ...chunk, score };
          });
        
        // Merge with existing results
        visionMissionVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              ...chunk,
              source: 'mongodb_vector_search_vision_mission'
            });
          }
        });
        
        Logger.debug(`✅ Vision/Mission vector search: Added ${visionMissionVectorResults.length} chunks`);
      } catch (error) {
        Logger.debug(`Vision/Mission vector search failed: ${error.message}`);
      }
    }
    
    // Ensure we have vision and mission chunks
    if (results.length < 4 && this.mongoService) {
      try {
        Logger.logDataFetch('searchVisionMission_fallback', query, {
          method: 'mongodb_direct_search',
          filters: {
            currentResults: results.length,
            targetCount: 4
          }
        });
        
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const allVisionMissionChunks = await collection.find({
          'metadata.field': { $regex: /visionMission\.(vision|mission)/i }
        })
        .sort({ 'metadata.field': 1, 'metadata.index': 1 }) // Sort by field (vision first, then mission) and index
        .toArray();
        
        Logger.logRetrievedChunks(query, allVisionMissionChunks, {
          source: 'mongodb_direct_vision_mission_search',
          maxChunks: 10,
          showFullContent: true
        });
        
        allVisionMissionChunks.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.content || chunk.text || '',
              score: 400, // High score to ensure inclusion
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_direct_vision_mission_search'
            });
          }
        });
        Logger.debug(`✅ Direct vision/mission search: Added ${allVisionMissionChunks.length} chunks`);
      } catch (error) {
        Logger.debug(`Direct vision/mission search failed: ${error.message}`);
        Logger.error(`Direct vision/mission search error:`, error);
      }
    }
    
    // Sort by: vision first, then mission, then by index within each
    results.sort((a, b) => {
      const aField = (a.metadata?.field || '').toLowerCase();
      const bField = (b.metadata?.field || '').toLowerCase();
      
      const aIsVision = aField.includes('visionMission.vision');
      const bIsVision = bField.includes('visionMission.vision');
      const aIsMission = aField.includes('visionMission.mission');
      const bIsMission = bField.includes('visionMission.mission');
      
      // Vision comes before mission
      if (aIsVision && !bIsVision) return -1;
      if (!aIsVision && bIsVision) return 1;
      if (aIsMission && !bIsMission) return -1;
      if (!aIsMission && bIsMission) return 1;
      
      // Within same type, sort by index
      const aIndex = a.metadata?.index ?? 999;
      const bIndex = b.metadata?.index ?? 999;
      if (aIndex !== bIndex) return aIndex - bIndex;
      
      // Finally by score
      return (b.score || 0) - (a.score || 0);
    });
    
    return results.slice(0, maxSections);
  }

  /**
   * Search for core values and graduate outcomes queries
   */
  async searchValues(query, options = {}) {
    const { maxResults = 15, maxSections = 15 } = options;
    
    Logger.debug(`💎 Values/Outcomes search: "${query.substring(0, 40)}..."`);
    
    // Log data fetch operation
    Logger.logDataFetch('searchValues', query, {
      method: 'searchValues',
      maxResults,
      maxSections
    });
    
    const isCoreValuesQuery = /\b(core\s+values?|values?)\b/i.test(query) && !/\bmandate|quality\s+policy|charter\b/i.test(query);
    const isOutcomesQuery = /\b(graduate\s+outcomes?|outcomes?)\b/i.test(query);
    const isMandateQuery = /\b(mandate|charter)\b/i.test(query);
    const isQualityPolicyQuery = /\bquality\s+policy\b/i.test(query);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for values/outcomes/mandate chunks
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        const matchConditions = {
          $and: [
            {
              $or: [
                // Match values/outcomes-specific metadata fields
                { 'metadata.field': { $regex: /valuesAndOutcomes\.(coreValues|graduateOutcomes)/i } },
                { section: { $regex: /visionMission/i }, 'metadata.field': { $regex: /valuesAndOutcomes/i } },
                // Match mandate-specific metadata fields
                { 'metadata.field': { $regex: /mandate\.(statement|objectives)/i } },
                { section: { $regex: /mandate/i } },
                // Match quality policy
                { 'metadata.field': { $regex: /qualityPolicy/i } },
                { section: { $regex: /qualityPolicy/i } },
                // Match values/outcomes/mandate content
                { 
                  content: { 
                    $regex: /(god-centeredness|humaneness|critical\s+thinking|creativity|discipline|competence|commitment|collaboration|resilience|sustainability|research-oriented|innovative|professionalism|ict-enabled|effective\s+communicator|gratitude|compassion|quality\s+policy|quality\s+management|mandated|mandate|charter)/i 
                  }
                },
                { 
                  text: { 
                    $regex: /(god-centeredness|humaneness|critical\s+thinking|creativity|discipline|competence|commitment|collaboration|resilience|sustainability|research-oriented|innovative|professionalism|ict-enabled|effective\s+communicator|gratitude|compassion|quality\s+policy|quality\s+management|mandated|mandate|charter)/i 
                  }
                },
                // Match keywords
                { keywords: { $in: ['values', 'outcomes', 'core', 'graduate', 'mandate', 'quality', 'policy'] } }
              ]
            }
          ]
        };
        
        // Add specific filter for core values, outcomes, or mandate if detected
        if (isCoreValuesQuery && !isOutcomesQuery && !isMandateQuery && !isQualityPolicyQuery) {
          matchConditions.$and.push({
            'metadata.field': { $regex: /valuesAndOutcomes\.coreValues/i }
          });
        } else if (isOutcomesQuery && !isCoreValuesQuery && !isMandateQuery && !isQualityPolicyQuery) {
          matchConditions.$and.push({
            'metadata.field': { $regex: /valuesAndOutcomes\.graduateOutcomes/i }
          });
        } else if (isMandateQuery && !isCoreValuesQuery && !isOutcomesQuery) {
          matchConditions.$and.push({
            $or: [
              { 'metadata.field': { $regex: /mandate\.(statement|objectives)/i } },
              { section: { $regex: /mandate/i } }
            ]
          });
        } else if (isQualityPolicyQuery && !isCoreValuesQuery && !isOutcomesQuery && !isMandateQuery) {
          matchConditions.$and.push({
            $or: [
              { 'metadata.field': { $regex: /qualityPolicy/i } },
              { section: { $regex: /qualityPolicy/i } }
            ]
          });
        }
        
        const pipeline = [
          { $match: matchConditions },
          { $limit: maxResults * 2 }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          // Compute relevance scores
          const scoredResults = mongoResults.map(chunk => {
            let relevanceScore = 0;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            
            // Prioritize values/outcomes/mandate-specific fields
            if (metadataField.includes('valuesAndOutcomes.coreValues')) {
              relevanceScore += 400; // Highest priority for core values
              // Boost if query specifically asks for core values
              if (isCoreValuesQuery) relevanceScore += 100;
            }
            if (metadataField.includes('valuesAndOutcomes.graduateOutcomes')) {
              relevanceScore += 350; // High priority for graduate outcomes
              // Boost if query specifically asks for outcomes
              if (isOutcomesQuery) relevanceScore += 100;
            }
            if (metadataField.includes('mandate.statement') || metadataField.includes('mandate.objectives')) {
              relevanceScore += 400; // Highest priority for mandate
              // Boost if query specifically asks for mandate
              if (isMandateQuery) relevanceScore += 100;
            }
            if (metadataField.includes('qualityPolicy')) {
              relevanceScore += 400; // Highest priority for quality policy
              // Boost if query specifically asks for quality policy
              if (isQualityPolicyQuery) relevanceScore += 100;
            }
            if (metadataField.includes('valuesAndOutcomes')) {
              relevanceScore += 200;
            }
            if (section === 'mandate') {
              relevanceScore += 200;
            }
            
            // Section-based scoring
            if (section === 'visionmission') {
              relevanceScore += 150;
            }
            if (section === 'qualitypolicy') {
              relevanceScore += 150;
            }
            
            // Content-based scoring
            if (/god-centeredness|humaneness|critical\s+thinking|creativity|discipline|competence|commitment|collaboration|resilience|sustainability/i.test(content)) {
              relevanceScore += 180; // Core values keywords
            }
            if (/research-oriented|innovative|professionalism|ict-enabled|effective\s+communicator|gratitude|compassion/i.test(content)) {
              relevanceScore += 180; // Graduate outcomes keywords
            }
            if (/mandated|mandate|provide academic programs|national.*regional.*local development/i.test(content)) {
              relevanceScore += 180; // Mandate keywords
            }
            if (/quality\s+policy|quality\s+management|quality\s+education/i.test(content)) {
              relevanceScore += 180; // Quality policy keywords
            }
            if (/values?|outcomes?/i.test(content)) {
              relevanceScore += 120;
            }
            
            // Keywords match
            if (chunk.keywords && (chunk.keywords.includes('values') || chunk.keywords.includes('outcomes'))) {
              relevanceScore += 100;
            }
            
            if (chunk.metadata?.updated_at) {
              relevanceScore += 10;
            }
            
            return { ...chunk, relevanceScore };
          });
          
          // Sort by relevance score (highest first)
          scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          const topResults = scoredResults.slice(0, maxResults);
          
          results = this._convertMongoChunksToRAG(topResults, 100, 'mongodb_values_aggregation');
          Logger.debug(`✅ Values/Outcomes aggregation: Found ${results.length} chunks`);
          
          // Log retrieved chunks from aggregation
          Logger.logRetrievedChunks(query, results, {
            source: 'mongodb_values_aggregation',
            maxChunks: 15,
            showFullContent: true
          });
        }
      } catch (error) {
        Logger.debug(`Values/Outcomes aggregation failed: ${error.message}`);
        Logger.error(`Values/Outcomes aggregation error:`, error);
      }
    }
    
    // SUPPLEMENT: Vector search (filtered to values/outcomes chunks)
    if (this.mongoService && results.length < maxSections) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to values/outcomes/mandate chunks
        const valuesVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            return metadataField.includes('valuesAndOutcomes.coreValues') ||
                   metadataField.includes('valuesAndOutcomes.graduateOutcomes') ||
                   metadataField.includes('valuesAndOutcomes') ||
                   metadataField.includes('mandate.statement') ||
                   metadataField.includes('mandate.objectives') ||
                   metadataField.includes('qualityPolicy') ||
                   section === 'mandate' ||
                   section === 'qualitypolicy' ||
                   (section === 'visionmission' && /god-centeredness|humaneness|critical\s+thinking|creativity|discipline|competence|commitment|collaboration|resilience|sustainability|research-oriented|innovative|professionalism|ict-enabled|effective\s+communicator|gratitude|compassion|mandated|mandate|quality\s+policy/i.test(content));
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            
            if (metadataField.includes('valuesAndOutcomes.coreValues')) score += 150;
            if (metadataField.includes('valuesAndOutcomes.graduateOutcomes')) score += 130;
            if (metadataField.includes('mandate.statement') || metadataField.includes('mandate.objectives')) score += 150;
            if (metadataField.includes('qualityPolicy')) score += 150;
            if (metadataField.includes('valuesAndOutcomes')) score += 80;
            if (/god-centeredness|humaneness|critical\s+thinking|creativity|discipline|competence|commitment|collaboration|resilience|sustainability/i.test(content)) score += 100;
            if (/research-oriented|innovative|professionalism|ict-enabled|effective\s+communicator|gratitude|compassion/i.test(content)) score += 100;
            if (/mandated|mandate|provide academic programs|national.*regional.*local development/i.test(content)) score += 100;
            if (/quality\s+policy|quality\s+management|quality\s+education/i.test(content)) score += 100;
            
            return { ...chunk, score };
          });
        
        // Merge with existing results
        valuesVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              ...chunk,
              source: 'mongodb_vector_search_values'
            });
          }
        });
        
        Logger.debug(`✅ Values/Outcomes vector search: Added ${valuesVectorResults.length} chunks`);
      } catch (error) {
        Logger.debug(`Values/Outcomes vector search failed: ${error.message}`);
      }
    }
    
    // Ensure we have all values/outcomes/mandate chunks
    if (results.length < 10 && this.mongoService) {
      try {
        Logger.logDataFetch('searchValues_fallback', query, {
          method: 'mongodb_direct_search',
          filters: {
            currentResults: results.length,
            targetCount: 10,
            isCoreValuesQuery,
            isOutcomesQuery,
            isMandateQuery,
            isQualityPolicyQuery
          }
        });
        
        const collection = this.mongoService.getCollection('knowledge_chunks');
        let allValuesChunks = [];
        
        if (isCoreValuesQuery && !isOutcomesQuery && !isMandateQuery && !isQualityPolicyQuery) {
          // Only fetch core values
          allValuesChunks = await collection.find({
            'metadata.field': { $regex: /valuesAndOutcomes\.coreValues/i }
          })
          .sort({ 'metadata.index': 1 })
          .toArray();
        } else if (isOutcomesQuery && !isCoreValuesQuery && !isMandateQuery && !isQualityPolicyQuery) {
          // Only fetch graduate outcomes
          allValuesChunks = await collection.find({
            'metadata.field': { $regex: /valuesAndOutcomes\.graduateOutcomes/i }
          })
          .sort({ 'metadata.index': 1 })
          .toArray();
        } else if (isMandateQuery && !isCoreValuesQuery && !isOutcomesQuery && !isQualityPolicyQuery) {
          // Only fetch mandate
          allValuesChunks = await collection.find({
            $or: [
              { 'metadata.field': { $regex: /mandate\.(statement|objectives)/i } },
              { section: { $regex: /mandate/i } }
            ]
          })
          .sort({ 'metadata.field': 1, 'metadata.index': 1 }) // Sort by field (statement first) and index
          .toArray();
        } else if (isQualityPolicyQuery && !isCoreValuesQuery && !isOutcomesQuery && !isMandateQuery) {
          // Only fetch quality policy
          allValuesChunks = await collection.find({
            $or: [
              { 'metadata.field': { $regex: /qualityPolicy/i } },
              { section: { $regex: /qualityPolicy/i } }
            ]
          })
          .sort({ 'metadata.index': 1 })
          .toArray();
        } else {
          // Fetch all (values, outcomes, mandate, quality policy)
          allValuesChunks = await collection.find({
            $or: [
              { 'metadata.field': { $regex: /valuesAndOutcomes\.(coreValues|graduateOutcomes)/i } },
              { 'metadata.field': { $regex: /mandate\.(statement|objectives)/i } },
              { section: { $regex: /mandate/i } },
              { 'metadata.field': { $regex: /qualityPolicy/i } },
              { section: { $regex: /qualityPolicy/i } }
            ]
          })
          .sort({ 'metadata.field': 1, 'metadata.index': 1 }) // Sort by field and index
          .toArray();
        }
        
        Logger.logRetrievedChunks(query, allValuesChunks, {
          source: 'mongodb_direct_values_search',
          maxChunks: 15,
          showFullContent: true
        });
        
        allValuesChunks.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.content || chunk.text || '',
              score: 400, // High score to ensure inclusion
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_direct_values_search'
            });
          }
        });
        Logger.debug(`✅ Direct values/outcomes search: Added ${allValuesChunks.length} chunks`);
      } catch (error) {
        Logger.debug(`Direct values/outcomes search failed: ${error.message}`);
        Logger.error(`Direct values/outcomes search error:`, error);
      }
    }
    
    // Sort by: mandate first, then core values, then graduate outcomes, then quality policy, then by index within each
    results.sort((a, b) => {
      const aField = (a.metadata?.field || '').toLowerCase();
      const bField = (b.metadata?.field || '').toLowerCase();
      
      const aIsMandate = aField.includes('mandate.statement') || aField.includes('mandate.objectives');
      const bIsMandate = bField.includes('mandate.statement') || bField.includes('mandate.objectives');
      const aIsCoreValues = aField.includes('valuesAndOutcomes.coreValues');
      const bIsCoreValues = bField.includes('valuesAndOutcomes.coreValues');
      const aIsOutcomes = aField.includes('valuesAndOutcomes.graduateOutcomes');
      const bIsOutcomes = bField.includes('valuesAndOutcomes.graduateOutcomes');
      const aIsQualityPolicy = aField.includes('qualityPolicy');
      const bIsQualityPolicy = bField.includes('qualityPolicy');
      
      // Mandate comes first
      if (aIsMandate && !bIsMandate) return -1;
      if (!aIsMandate && bIsMandate) return 1;
      // Then core values
      if (aIsCoreValues && !bIsCoreValues) return -1;
      if (!aIsCoreValues && bIsCoreValues) return 1;
      // Then graduate outcomes
      if (aIsOutcomes && !bIsOutcomes) return -1;
      if (!aIsOutcomes && bIsOutcomes) return 1;
      // Then quality policy
      if (aIsQualityPolicy && !bIsQualityPolicy) return -1;
      if (!aIsQualityPolicy && bIsQualityPolicy) return 1;
      
      // Within same type, sort by index (statement before objectives for mandate)
      if (aIsMandate && bIsMandate) {
        const aIsStatement = aField.includes('mandate.statement');
        const bIsStatement = bField.includes('mandate.statement');
        if (aIsStatement && !bIsStatement) return -1;
        if (!aIsStatement && bIsStatement) return 1;
      }
      
      const aIndex = a.metadata?.index ?? 999;
      const bIndex = b.metadata?.index ?? 999;
      if (aIndex !== bIndex) return aIndex - bIndex;
      
      // Finally by score
      return (b.score || 0) - (a.score || 0);
    });
    
    return results.slice(0, maxSections);
  }

  /**
   * Search for scholarship queries (scholarship recipients, statistics, counts by year)
   */
  async searchScholarship(query, options = {}) {
    const { maxResults = 30, maxSections = 30 } = options;
    
    Logger.debug(`🎓 Scholarship search: "${query.substring(0, 40)}..."`);
    
    // Log data fetch operation
    Logger.logDataFetch('searchScholarship', query, {
      method: 'searchScholarship',
      maxResults,
      maxSections
    });
    
    // Detect year from query (2024, 2025, or both)
    const queryLower = query.toLowerCase();
    const has2024 = /\b(2024|year\s+2024)\b/i.test(query);
    const has2025 = /\b(2025|year\s+2025)\b/i.test(query);
    const requestedYears = [];
    if (has2024) requestedYears.push(2024);
    if (has2025) requestedYears.push(2025);
    // If no specific year mentioned, include both 2024 and 2025
    if (requestedYears.length === 0) {
      requestedYears.push(2024, 2025);
    }
    
    // Detect if query asks for total/count/number
    const isCountQuery = /\b(total|count|number|how\s+many|statistics?|sum|aggregate)\b/i.test(query);
    
    Logger.debug(`🎓 Scholarship query detection: years=${requestedYears.join(',')}, isCountQuery=${isCountQuery}`);
    
    let results = [];
    
    // PRIMARY: MongoDB aggregation pipeline for scholarship data
    if (this.mongoService) {
      try {
        const collection = this.mongoService.getCollection('knowledge_chunks');
        
        // Build match conditions for scholarship-related chunks
        const matchConditions = {
          $or: [
            // Section-based matching
            { section: { $regex: /scholarship|students/i } },
            // Content-based matching
            { content: { $regex: /scholarship|scholar|recipients?|beneficiaries?|students?\s+with\s+scholarship|total\s+(number|count).*students?.*scholarship/i } },
            { text: { $regex: /scholarship|scholar|recipients?|beneficiaries?|students?\s+with\s+scholarship|total\s+(number|count).*students?.*scholarship/i } },
            // Metadata-based matching
            { 'metadata.field': { $regex: /scholarship|students.*scholarship/i } },
            { 'metadata.category': { $regex: /scholarship|financial\s+aid/i } },
            { type: { $regex: /scholarship|financial_aid/i } },
            { category: { $regex: /scholarship|financial\s+aid/i } },
            // Keywords matching
            { keywords: { $in: ['scholarship', 'scholarships', 'scholar', 'recipients', 'financial aid', 'beneficiaries', 'students'] } }
          ]
        };
        
        // Add year filter if specific years are requested
        if (requestedYears.length > 0) {
          const yearRegex = requestedYears.map(year => `\\b${year}\\b`).join('|');
          matchConditions.$or.push(
            { content: { $regex: new RegExp(yearRegex, 'i') } },
            { text: { $regex: new RegExp(yearRegex, 'i') } },
            { 'metadata.year': { $in: requestedYears } },
            { 'metadata.academicYear': { $regex: new RegExp(yearRegex, 'i') } }
          );
        }
        
        // Build year match conditions for relevance scoring
        const yearMatchConditions = requestedYears.map(year => ({
          $regexMatch: {
            input: { $toString: { $ifNull: ['$content', ''] } },
            regex: `\\b${year}\\b`,
            options: 'i'
          }
        }));
        
        const yearMetadataConditions = [
          { $in: [{ $ifNull: ['$metadata.year', null] }, requestedYears] }
        ];
        
        // Add academicYear regex matches for each requested year
        requestedYears.forEach(year => {
          yearMetadataConditions.push({
            $regexMatch: {
              input: { $toString: { $ifNull: ['$metadata.academicYear', ''] } },
              regex: `\\b${year}\\b`,
              options: 'i'
            }
          });
        });
        
        const pipeline = [
          { $match: matchConditions },
          {
            $addFields: {
              relevanceScore: {
                $add: [
                  // High priority for chunks with year match in content
                  {
                    $cond: [
                      { $or: yearMatchConditions },
                      300,
                      0
                    ]
                  },
                  // High priority for scholarship section
                  { $cond: [{ $eq: [{ $toLower: { $ifNull: ['$section', ''] } }, 'scholarship'] }, 250, 0] },
                  // High priority for total/count queries
                  { $cond: [{ $regexMatch: { input: { $toString: { $ifNull: ['$content', ''] } }, regex: 'total\\s+(number|count).*students?.*scholarship|students?\\s+with\\s+scholarship.*\\d+', options: 'i' } }, 200, 0] },
                  // Year in metadata
                  {
                    $cond: [
                      { $or: yearMetadataConditions },
                      180,
                      0
                    ]
                  },
                  // Scholarship type
                  { $cond: [{ $regexMatch: { input: { $toString: { $ifNull: ['$type', ''] } }, regex: 'scholarship|financial_aid', options: 'i' } }, 150, 0] },
                  // Scholarship keywords
                  { $cond: [{ $in: ['scholarship', { $ifNull: ['$keywords', []] }] }, 120, 0] },
                  // Students keyword
                  { $cond: [{ $in: ['students', { $ifNull: ['$keywords', []] }] }, 100, 0] },
                  // Updated timestamp
                  { $cond: [{ $gt: ['$metadata.updated_at', null] }, 10, 0] }
                ]
              }
            }
          },
          { $sort: { relevanceScore: -1, 'metadata.year': -1, 'metadata.updated_at': -1 } },
          { $limit: maxResults }
        ];
        
        const mongoResults = await collection.aggregate(pipeline).toArray();
        if (mongoResults && mongoResults.length > 0) {
          results = this._convertMongoChunksToRAG(mongoResults, 100, 'mongodb_scholarship_aggregation');
          Logger.debug(`✅ Scholarship aggregation: Found ${results.length} chunks`);
          
          // Log retrieved chunks from aggregation
          Logger.logRetrievedChunks(query, results, {
            source: 'mongodb_scholarship_aggregation',
            maxChunks: 30,
            showFullContent: true
          });
        }
      } catch (error) {
        Logger.debug(`Scholarship aggregation failed: ${error.message}`);
        Logger.error(`Scholarship aggregation error:`, error);
      }
    }
    
    // SUPPLEMENT: Vector search to get all scholarship-related chunks
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        // Enhance query for better vector search results
        const enhancedQuery = `${query} scholarship recipients students total number count statistics ${requestedYears.join(' ')}`;
        const queryEmbedding = await embeddingService.embedText(enhancedQuery);
        const vectorResults = await this.mongoService.vectorSearch(queryEmbedding, maxResults * 2);
        
        // Filter to scholarship chunks with year matching
        const scholarshipVectorResults = vectorResults
          .filter(chunk => {
            const section = (chunk.section || '').toLowerCase();
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const category = (chunk.category || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const metadataYear = chunk.metadata?.year;
            const metadataAcademicYear = (chunk.metadata?.academicYear || '').toLowerCase();
            
            // Check if chunk is scholarship-related
            const isScholarshipChunk = section.includes('scholarship') ||
                                     type.includes('scholarship') ||
                                     type.includes('financial_aid') ||
                                     category.includes('scholarship') ||
                                     category.includes('financial aid') ||
                                     content.includes('scholarship') ||
                                     content.includes('recipient') ||
                                     content.includes('beneficiaries') ||
                                     metadataField.includes('scholarship');
            
            if (!isScholarshipChunk) return false;
            
            // Check year match if specific years are requested
            if (requestedYears.length > 0 && requestedYears.length < 2) {
              const hasYear = requestedYears.some(year => {
                const yearStr = year.toString();
                return content.includes(yearStr) ||
                       metadataYear === year ||
                       metadataAcademicYear.includes(yearStr);
              });
              if (!hasYear) return false;
            }
            
            return true;
          })
          .map(chunk => {
            let score = chunk.score || 50;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const section = (chunk.section || '').toLowerCase();
            const type = (chunk.type || '').toLowerCase();
            const metadataField = (chunk.metadata?.field || '').toLowerCase();
            const metadataYear = chunk.metadata?.year;
            
            // Boost scores for better matches
            if (section.includes('scholarship')) score += 100;
            if (type.includes('scholarship')) score += 80;
            if (isCountQuery && (content.includes('total') || content.includes('count') || content.includes('number'))) score += 70;
            if (requestedYears.includes(metadataYear)) score += 90;
            if (requestedYears.some(year => content.includes(year.toString()))) score += 80;
            if (content.includes('students') && content.includes('scholarship')) score += 60;
            if (metadataField.includes('scholarship')) score += 50;
            
            return {
              ...chunk,
              score: score
            };
          });
        
        // Merge with aggregation results
        scholarshipVectorResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.text || chunk.content || '',
              score: chunk.score || 0,
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_vector_search_scholarship'
            });
          }
        });
        
        Logger.debug(`✅ Scholarship vector search: Added ${scholarshipVectorResults.length} chunks`);
      } catch (error) {
        Logger.debug(`Scholarship vector search failed: ${error.message}`);
        Logger.error(`Scholarship vector search error:`, error);
      }
    }
    
    // Ensure we have scholarship data for requested years
    if (this.mongoService && results.length < 10) {
      try {
        Logger.logDataFetch('searchScholarship_fallback', query, {
          method: 'mongodb_direct_search',
          filters: {
            currentResults: results.length,
            targetCount: 10,
            requestedYears
          }
        });
        
        const collection = this.mongoService.getCollection('knowledge_chunks');
        
        // Direct search for scholarship chunks with year filter
        const directQuery = {
          $and: [
            {
              $or: [
                { section: { $regex: /scholarship/i } },
                { type: { $regex: /scholarship|financial_aid/i } },
                { category: { $regex: /scholarship|financial\s+aid/i } },
                { content: { $regex: /scholarship/i } },
                { text: { $regex: /scholarship/i } },
                { keywords: { $in: ['scholarship', 'scholarships', 'recipients', 'financial aid'] } }
              ]
            },
            {
              $or: [
                ...requestedYears.map(year => ({
                  content: { $regex: new RegExp(`\\b${year}\\b`, 'i') }
                })),
                ...requestedYears.map(year => ({
                  text: { $regex: new RegExp(`\\b${year}\\b`, 'i') }
                })),
                ...(requestedYears.length === 2 ? [] : [
                  { 'metadata.year': { $in: requestedYears } },
                  { 'metadata.academicYear': { $regex: new RegExp(requestedYears.map(y => `\\b${y}\\b`).join('|'), 'i') } }
                ])
              ]
            }
          ]
        };
        
        const directResults = await collection.find(directQuery)
          .sort({ 'metadata.year': -1, 'metadata.updated_at': -1 })
          .limit(maxSections)
          .toArray();
        
        Logger.logRetrievedChunks(query, directResults, {
          source: 'mongodb_direct_scholarship_search',
          maxChunks: 30,
          showFullContent: true
        });
        
        directResults.forEach(chunk => {
          if (!results.find(r => r.id === chunk.id)) {
            // Check if chunk contains year information
            const chunkYear = chunk.metadata?.year;
            const content = (chunk.content || chunk.text || '').toLowerCase();
            const hasYear = requestedYears.some(year => 
              content.includes(year.toString()) || chunkYear === year
            );
            
            results.push({
              id: chunk.id,
              section: chunk.section,
              type: chunk.type,
              text: chunk.content || chunk.text || '',
              score: hasYear ? 250 : 200, // Higher score if year matches
              metadata: chunk.metadata || {},
              keywords: chunk.keywords || [],
              category: chunk.category,
              source: 'mongodb_direct_scholarship_search'
            });
          }
        });
        
        Logger.debug(`✅ Direct scholarship search: Added ${directResults.length} chunks`);
      } catch (error) {
        Logger.debug(`Direct scholarship search failed: ${error.message}`);
        Logger.error(`Direct scholarship search error:`, error);
      }
    }
    
    // Sort by year (descending, so 2025 first, then 2024), then by score
    results.sort((a, b) => {
      const aYear = a.metadata?.year || 0;
      const bYear = b.metadata?.year || 0;
      if (bYear !== aYear) return bYear - aYear; // Descending year order
      
      // Then by score
      return (b.score || 0) - (a.score || 0);
    });
    
    return results.slice(0, maxSections);
  }

  /**
   * Search for schedule/calendar queries (events, announcements, dates)
   */
  async searchSchedule(query, options = {}) {
    const { maxResults = 30, maxSections = 30 } = options;
    
    Logger.debug(`📅 Schedule/Calendar search: "${query.substring(0, 40)}..."`);
    
    // Log data fetch operation
    Logger.logDataFetch('searchSchedule', query, {
      method: 'searchSchedule',
      maxResults,
      maxSections
    });
    
    let results = [];
    
    // Detect exam type from query for better filtering/prioritization
    // Support multiple exam types (e.g., "final and prelim")
    const queryLower = query.toLowerCase();
    const hasPrelim = /\b(prelim|preliminary|prelims?)\b/i.test(query);
    const hasMidterm = /\b(midterm|mid-term|mid\s+term)\b/i.test(query);
    const hasFinal = /\b(final|finals?)\b/i.test(query);
    const hasExam = /\b(exam|examination|exams?)\b/i.test(query);
    const hasSchedule = /\b(schedule|schedules?|date|dates?|when)\b/i.test(query);
    
    // Count how many exam types are mentioned
    const examTypesCount = [hasPrelim, hasMidterm, hasFinal].filter(Boolean).length;
    const isMultipleExamQuery = examTypesCount > 1;
    
    // If query mentions exam/schedule keywords OR mentions multiple exam types, treat as exam query
    // This handles cases like "final and prelim" even without "exam" keyword
    const hasExamContext = hasExam || hasSchedule || isMultipleExamQuery;
    
    // For prelim: must have "prelim/preliminary" AND exam context
    const isPrelimQuery = hasPrelim && hasExamContext;
    // For midterm: must have "midterm" AND exam context
    const isMidtermQuery = hasMidterm && hasExamContext;
    // For final: must have "final" AND exam context
    const isFinalQuery = hasFinal && hasExamContext;
    const isExamQuery = hasExam;
    
    Logger.debug(`📅 Exam query detection: hasPrelim=${hasPrelim}, hasMidterm=${hasMidterm}, hasFinal=${hasFinal}, hasExam=${hasExam}, hasSchedule=${hasSchedule}`);
    Logger.debug(`📅 Exam query detection: examTypesCount=${examTypesCount}, isMultipleExamQuery=${isMultipleExamQuery}, hasExamContext=${hasExamContext}`);
    Logger.debug(`📅 Exam query detection: prelim=${isPrelimQuery}, midterm=${isMidtermQuery}, final=${isFinalQuery}, exam=${isExamQuery}`);
    
    // PRIMARY: Vector search on schedule collection
    if (this.mongoService) {
      try {
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embedText(query);
        const vectorResults = await this.mongoService.vectorSearchSchedule(queryEmbedding, maxSections * 2);
        
        // Convert schedule events to RAG format with score boosting for exam type matches
        results = vectorResults.map(event => {
          // Format event text similar to how rag.js formats schedule events
          const eventDate = event.isoDate || event.date;
          const dateStr = eventDate ? formatDateInTimezone(
            new Date(eventDate),
            { year: 'numeric', month: 'long', day: 'numeric' }
          ) || 'Date TBD' : 'Date TBD';
          
          let eventText = `${event.title || 'Untitled Event'}. `;
          if (event.description) eventText += `${event.description}. `;
          eventText += `Date: ${dateStr}. `;
          if (event.time && event.time !== 'All Day') eventText += `Time: ${event.time}. `;
          if (event.category) eventText += `Category: ${event.category}. `;
          
          // Include semester information
          if (event.semester) {
            const semesterText = event.semester === 1 ? '1st Semester' : 
                               event.semester === 2 ? '2nd Semester' : 
                               event.semester === 'Off' ? 'Off Semester' : 
                               `Semester ${event.semester}`;
            eventText += `Semester: ${semesterText}. `;
          }
          
          // Include date range if applicable
          if (event.dateType === 'date_range' && event.startDate && event.endDate) {
            const start = formatDateInTimezone(new Date(event.startDate), { year: 'numeric', month: 'long', day: 'numeric' });
            const end = formatDateInTimezone(new Date(event.endDate), { year: 'numeric', month: 'long', day: 'numeric' });
            if (start && end) {
              eventText += `Date Range: ${start} to ${end}. `;
            }
          }
          
          // Boost score for exam type matches - support multiple exam types with OR logic
          let boostedScore = event.score || 0;
          const titleLower = (event.title || '').toLowerCase();
          
          // Use OR logic: boost if event matches ANY of the requested exam types
          if (isPrelimQuery && (titleLower.includes('prelim') || titleLower.includes('preliminary'))) {
            boostedScore += 100; // Strong boost for exact prelim match
          }
          if (isMidtermQuery && titleLower.includes('midterm')) {
            boostedScore += 100; // Strong boost for exact midterm match
          }
          if (isFinalQuery && titleLower.includes('final')) {
            boostedScore += 100; // Strong boost for exact final match
          }
          if (isExamQuery && (titleLower.includes('exam') || titleLower.includes('examination'))) {
            boostedScore += 50; // Moderate boost for any exam-related event
          }
          
          // Boost if it's an exam event but user asked for exam schedule
          if (isExamQuery && !isPrelimQuery && !isMidtermQuery && !isFinalQuery) {
            if (titleLower.includes('prelim') || titleLower.includes('midterm') || titleLower.includes('final')) {
              boostedScore += 30; // Small boost for any exam type when user asks generically
            }
          }
          
          return {
            id: `schedule-${event._id || event.id || Date.now()}`,
            section: 'schedule_events',
            type: event.type || (event.category === 'Event' ? 'event' : 'announcement'),
            text: eventText.trim(),
            score: boostedScore,
            similarity: event.similarity || 0,
            metadata: {
              title: event.title,
              date: eventDate,
              category: event.category,
              semester: event.semester,
              dateType: event.dateType,
              startDate: event.startDate,
              endDate: event.endDate,
              time: event.time,
              source: event.source
            },
            keywords: [
              ...(event.title ? event.title.toLowerCase().split(/\s+/).filter(w => w.length > 3) : []),
              ...(event.category ? [event.category.toLowerCase()] : []),
              ...(event.semester ? (event.semester === 1 ? ['1st', 'first', 'semester'] : 
                                   event.semester === 2 ? ['2nd', 'second', 'semester'] : 
                                   ['off', 'semester']) : [])
            ],
            category: event.category || 'General',
            source: 'mongodb_vector_search_schedule'
          };
        });
        
        Logger.debug(`✅ Schedule vector search: Found ${results.length} events`);
        
        // Log retrieved chunks with detailed event information
        Logger.logRetrievedChunks(query, results, {
          source: 'mongodb_vector_search_schedule',
          maxChunks: 30,
          showFullContent: false
        });
        
        // Log data fetch summary
        Logger.logDataFetch('vectorSearchSchedule', query, {
          method: 'vector_search',
          chunksFound: results.length,
          filters: {
            maxSections: maxSections * 2,
            collection: 'schedule'
          }
        });
      } catch (error) {
        Logger.debug(`Schedule vector search failed: ${error.message}`);
        Logger.error(`Schedule vector search error:`, error);
      }
    }
    
    // SUPPLEMENT: Fallback to direct MongoDB query if vector search returns few results
    // OR if this is an exam-specific query (to ensure we find the right exam type)
    // This ensures we still get relevant events even if embeddings aren't perfect
    if ((results.length < 5 || isPrelimQuery || isMidtermQuery || isFinalQuery) && this.mongoService) {
      try {
        Logger.logDataFetch('searchSchedule_fallback', query, {
          method: 'mongodb_direct_search',
          filters: {
            currentResults: results.length,
            targetCount: 10
          }
        });
        
        const collection = this.mongoService.getCollection('schedule');
        
        // Extract date/month/year/semester from query for filtering
        const queryLower = query.toLowerCase();
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december'];
        const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        let requestedMonth = null;
        let requestedYear = null;
        let requestedSemester = null;
        
        // Extract year (4 digits)
        const yearMatch = queryLower.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          requestedYear = parseInt(yearMatch[1], 10);
        }
        
        // Extract month
        monthNames.forEach((month, index) => {
          if (queryLower.includes(month)) {
            requestedMonth = index;
          }
        });
        if (requestedMonth === null) {
          monthAbbr.forEach((month, index) => {
            if (queryLower.includes(month)) {
              requestedMonth = index;
            }
          });
        }
        
        // Extract semester
        const semesterPatterns = [
          { pattern: /\b(1st|first)\s+semester\b/i, value: 1 },
          { pattern: /\b(2nd|second)\s+semester\b/i, value: 2 },
          { pattern: /\boff\s+semester\b/i, value: 'Off' },
          { pattern: /\bsemester\s+1\b|\bsemester\s+one\b/i, value: 1 },
          { pattern: /\bsemester\s+2\b|\bsemester\s+two\b/i, value: 2 }
        ];
        
        for (const { pattern, value } of semesterPatterns) {
          if (pattern.test(queryLower)) {
            requestedSemester = value;
            break;
          }
        }
        
        // Build date range query
        const now = new Date();
        let startDate = new Date(now);
        let endDate = new Date(now);
        
        if (requestedMonth !== null && requestedYear) {
          startDate = new Date(requestedYear, requestedMonth, 1);
          endDate = new Date(requestedYear, requestedMonth + 1, 0, 23, 59, 59);
        } else if (requestedYear) {
          startDate = new Date(requestedYear, 0, 1);
          endDate = new Date(requestedYear, 11, 31, 23, 59, 59);
        } else {
          // Default: Past 30 days to future 365 days
          startDate.setDate(startDate.getDate() - 30);
          endDate.setDate(endDate.getDate() + 365);
        }
        
        // Build MongoDB query - use $and to ensure date range AND exam type filters are both applied
        // This matches the logic in schedule.js for consistent filtering
        const mongoQuery = {
          $and: [
            // Date range filter
            {
              $or: [
                { isoDate: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
                { 
                  dateType: 'date_range',
                  startDate: { $lte: endDate.toISOString() },
                  endDate: { $gte: startDate.toISOString() }
                }
              ]
            },
            // Category filter: Include Institutional/Academic (same as schedule.js)
            {
              $or: [
                { category: { $in: ['Institutional', 'Academic', 'institutional', 'academic'] } },
                { type: 'calendar_event' },
                { category: { $exists: false } }
              ]
            },
            {
              $or: [
                { category: { $nin: ['Announcement', 'News', 'Event', 'announcement', 'news', 'event'] } },
                { category: { $exists: false } }
              ]
            }
          ]
        };
        
        // Filter by semester if provided (same as schedule.js)
        if (requestedSemester !== null) {
          const semesterValue = (requestedSemester === 1 || requestedSemester === '1' || requestedSemester === 'first' || requestedSemester === '1st') ? 1 :
                               (requestedSemester === 2 || requestedSemester === '2' || requestedSemester === 'second' || requestedSemester === '2nd') ? 2 :
                               (requestedSemester === 'Off' || requestedSemester === 'off' || requestedSemester === 'off semester') ? 'Off' :
                               requestedSemester;
          mongoQuery.$and.push({ semester: semesterValue });
        }
        
        // Filter by exam type if provided (same as schedule.js) - this MUST be in title
        // This ensures we only get exam events, not registration events
        // Support multiple exam types with OR logic in regex
        if (isPrelimQuery || isMidtermQuery || isFinalQuery) {
          const examPatterns = [];
          if (isPrelimQuery) examPatterns.push('(prelim|preliminary)');
          if (isMidtermQuery) examPatterns.push('midterm');
          if (isFinalQuery) examPatterns.push('final');
          
          // Build regex that matches ANY of the requested exam types
          const examTitleRegex = examPatterns.length > 0 ? 
            `\\b(${examPatterns.join('|')})\\b` : null;
          
          if (examTitleRegex) {
            const requestedTypes = [];
            if (isPrelimQuery) requestedTypes.push('prelim');
            if (isMidtermQuery) requestedTypes.push('midterm');
            if (isFinalQuery) requestedTypes.push('final');
            const examTypesStr = requestedTypes.join(' + ');
            
            mongoQuery.$and.push({
              title: { 
                $regex: examTitleRegex,
                $options: 'i'
              }
            });
            Logger.debug(`📅 MongoDB query: Added exam title filter for ${examTypesStr}: ${examTitleRegex}`);
          }
        } else if (isExamQuery) {
          // For generic exam queries, still filter for exam in title
          mongoQuery.$and.push({
            title: {
              $regex: '\\b(prelim|preliminary|midterm|final|exam|examination)\\b',
              $options: 'i'
            }
          });
          Logger.debug(`📅 MongoDB query: Added generic exam title filter`);
        }
        
        // Also search by other keywords in title/description (but exam filter takes priority)
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3 && !['prelim', 'preliminary', 'midterm', 'final', 'exam', 'examination'].includes(w));
        if (queryWords.length > 0 && !isPrelimQuery && !isMidtermQuery && !isFinalQuery) {
          // Only add keyword search if not an exam query (exam queries should only match exam events)
          mongoQuery.$and.push({
            $or: [
              { title: { $regex: new RegExp(queryWords.join('|'), 'i') } },
              { description: { $regex: new RegExp(queryWords.join('|'), 'i') } }
            ]
          });
        }
        
        const directResults = await collection.find(mongoQuery)
          .sort({ isoDate: 1 })
          .limit(maxSections)
          .toArray();
        
        // Convert to RAG format and merge with vector search results
        directResults.forEach(event => {
          // Check if already in results
          const eventId = `schedule-${event._id}`;
          if (!results.find(r => r.id === eventId)) {
            const eventDate = event.isoDate || event.date;
            const dateStr = eventDate ? formatDateInTimezone(
              new Date(eventDate),
              { year: 'numeric', month: 'long', day: 'numeric' }
            ) || 'Date TBD' : 'Date TBD';
            
            let eventText = `${event.title || 'Untitled Event'}. `;
            if (event.description) eventText += `${event.description}. `;
            eventText += `Date: ${dateStr}. `;
            if (event.time && event.time !== 'All Day') eventText += `Time: ${event.time}. `;
            if (event.category) eventText += `Category: ${event.category}. `;
            
            if (event.semester) {
              const semesterText = event.semester === 1 ? '1st Semester' : 
                                 event.semester === 2 ? '2nd Semester' : 
                                 event.semester === 'Off' ? 'Off Semester' : 
                                 `Semester ${event.semester}`;
              eventText += `Semester: ${semesterText}. `;
            }
            
            // Boost score for exam type matches in direct search too - support multiple exam types with OR logic
            let directScore = 50;
            const eventTitleLower = (event.title || '').toLowerCase();
            
            // Use OR logic: boost if event matches ANY of the requested exam types
            let matchesAnyRequestedExam = false;
            if (isPrelimQuery && (eventTitleLower.includes('prelim') || eventTitleLower.includes('preliminary'))) {
              directScore = 150; // High score for exact prelim match
              matchesAnyRequestedExam = true;
            }
            if (isMidtermQuery && eventTitleLower.includes('midterm')) {
              directScore = 150; // High score for exact midterm match
              matchesAnyRequestedExam = true;
            }
            if (isFinalQuery && eventTitleLower.includes('final')) {
              directScore = 150; // High score for exact final match
              matchesAnyRequestedExam = true;
            }
            // Only apply generic exam boost if no specific exam type matched
            if (!matchesAnyRequestedExam && isExamQuery && (eventTitleLower.includes('exam') || eventTitleLower.includes('examination'))) {
              directScore = 80; // Moderate score for any exam-related event
            }
            
            results.push({
              id: eventId,
              section: 'schedule_events',
              type: event.type || (event.category === 'Event' ? 'event' : 'announcement'),
              text: eventText.trim(),
              score: directScore,
              similarity: 0.5,
              metadata: {
                title: event.title,
                date: eventDate,
                category: event.category,
                semester: event.semester,
                dateType: event.dateType,
                startDate: event.startDate,
                endDate: event.endDate,
                time: event.time,
                source: event.source
              },
              keywords: [
                ...(event.title ? event.title.toLowerCase().split(/\s+/).filter(w => w.length > 3) : []),
                ...(event.category ? [event.category.toLowerCase()] : [])
              ],
              category: event.category || 'General',
              source: 'mongodb_direct_schedule_search'
            });
          }
        });
        
        Logger.debug(`✅ Direct schedule search: Added ${directResults.length} events`);
      } catch (error) {
        Logger.debug(`Direct schedule search failed: ${error.message}`);
        Logger.error(`Direct schedule search error:`, error);
      }
    }
    
    // Filter and prioritize exam-specific results when exam type is detected
    // Support multiple exam types with OR logic
    if (isPrelimQuery || isMidtermQuery || isFinalQuery) {
      const requestedTypes = [];
      if (isPrelimQuery) requestedTypes.push('prelim');
      if (isMidtermQuery) requestedTypes.push('midterm');
      if (isFinalQuery) requestedTypes.push('final');
      const examTypesStr = requestedTypes.join(' + ');
      
      Logger.debug(`📅 Filtering for ${examTypesStr} examination events`);
      
      // Separate exam-matching events from others - use OR logic to match ANY requested type
      const examMatches = results.filter(event => {
        const titleLower = (event.metadata?.title || event.text || '').toLowerCase();
        // Use OR logic: match ANY of the requested exam types
        let matches = false;
        if (isPrelimQuery) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
        if (isMidtermQuery) matches = matches || titleLower.includes('midterm');
        if (isFinalQuery) matches = matches || titleLower.includes('final');
        return matches;
      });
      
      const otherEvents = results.filter(event => {
        const titleLower = (event.metadata?.title || event.text || '').toLowerCase();
        // Use OR logic: exclude if it matches ANY of the requested exam types
        let matches = false;
        if (isPrelimQuery) matches = matches || titleLower.includes('prelim') || titleLower.includes('preliminary');
        if (isMidtermQuery) matches = matches || titleLower.includes('midterm');
        if (isFinalQuery) matches = matches || titleLower.includes('final');
        return !matches; // Return events that DON'T match any requested exam type
      });
      
      // Prioritize exam matches, then other events
      results = [...examMatches, ...otherEvents];
      Logger.debug(`📅 Exam filtering: Found ${examMatches.length} ${examTypesStr} matches, ${otherEvents.length} other events`);
    }
    
    // Sort by score (vector search results first, then direct search)
    return this._sortByScore(results).slice(0, maxSections);
  }

  /**
   * Detect query type
   */
  _detectQueryType(query) {
    const queryLower = query.toLowerCase();
    
    if (/\b(history|historical|founded|established|background|evolution|development|kasaysayan|itinatag|pinagmulan|gitukod|timeline|narrative|heritage|conversion|doscst|mcc|mati community college)\b/i.test(query)) {
      return 'history';
    }
    
    // CRITICAL: Deans queries MUST be checked BEFORE leadership to avoid misrouting
    // "dean" is included in the leadership pattern, so this must come first
    if (/\b(dean|deans|who\s+(is|are)\s+the\s+dean|dean\s+of)\b/i.test(query)) {
      return 'deans';
    }
    
    if (/\b(president|vice president|vice presidents|chancellor|director|directors|leadership|board|governance|administration|executive|executives|board of regents|roy.*ponce|dr\.?\s*roy)\b/i.test(query)) {
      return 'leadership';
    }
    
    if (/\b(who\s+(is|are)\s+(the\s+)?(head|director|chief|manager|officer)\s+(of|in)?|head\s+of|director\s+of|chief\s+of|manager\s+of|OSPAT|OSA|OSCD|FASG|PESO|IRO|HSU|CGAD|IP-TBM|GCTC)\b/i.test(query)) {
      return 'office';
    }
    
    // CRITICAL: Values/Outcomes queries MUST be checked BEFORE programs - "graduate" matches programs pattern
    // Values/Outcomes queries (must be checked before comprehensive - "values" is in comprehensive pattern)
    if (/\b(core\s+values?|values?\s+of|graduate\s+outcomes?|outcomes?|quality\s+policy|mandate|charter)\b/i.test(query)) {
      return 'values';
    }
    
    // Programs/Courses queries (must be checked before comprehensive)
    // Exclude "graduate outcomes" specifically to avoid matching values queries
    if (/\b(program|programs|programme|course|courses|degree|degrees|bachelor|BS|BA|MA|MS|PhD|EdD|undergraduate|graduate\s+(program|programs|degree|degrees)|masters|doctorate|what\s+programs?\s+are|what\s+courses?\s+are)\b/i.test(query) && 
        !/\bgraduate\s+outcomes?\b/i.test(query)) {
      return 'programs';
    }
    
    // Faculties queries (must be checked before comprehensive and programs)
    if (/\b(faculty|faculties|FACET|FALS|FTED|FBM|FCJE|FNAHS|FHUSOCOM|college|colleges|what\s+faculties?\s+are|list\s+faculties?)\b/i.test(query)) {
      return 'faculties';
    }
    
    // Student organization queries (must be checked before leadership to avoid confusion)
    if (/\b(usc|university\s+student\s+council|student\s+council|ang.*sidlakan|catalyst|student\s+organization|student\s+organizations|student\s+publication)\b/i.test(query)) {
      return 'student_org';
    }
    
    // Admission requirements queries (must be checked before comprehensive/general)
    if (/\b(admission\s+requirements?|requirements?\s+for\s+admission|admission\s+req|what\s+(are|do|does)\s+.*\s+(need|required|requirement))\b/i.test(query) ||
        (/\b(admission|admissions)\b/i.test(query) && /\b(requirements?|required|need|needed)\b/i.test(query))) {
      return 'admission_requirements';
    }
    
    // Hymn/Anthem queries (must be checked before comprehensive/general)
    if (/\b(hymn|anthem|university\s+hymn|university\s+anthem|dorsu\s+hymn|dorsu\s+anthem|lyrics|song|composer)\b/i.test(query)) {
      return 'hymn';
    }
    
    // Vision/Mission queries (must be checked before comprehensive/general)
    if (/\b(vision|mission|what\s+is\s+.*\s+(vision|mission)|dorsu.*\s+(vision|mission)|university.*\s+(vision|mission))\b/i.test(query)) {
      return 'vision_mission';
    }
    
    // Schedule/Calendar queries (must be checked before comprehensive/general)
    // Detects queries about events, announcements, dates, schedules, deadlines, etc.
    if (/\b(date|dates|event|events|announcement|announcements|schedule|schedules|calendar|when|upcoming|coming|next|this\s+(week|month|year)|deadline|deadlines|holiday|holidays|academic\s+calendar|semester|enrollment\s+period|registration|exam\s+schedule|class\s+schedule|timeline|time\s+table|graduation|seminar|workshop|conference|meeting|activity|activities)\b/i.test(query) ||
        /\b(when\s+(is|are|will|does)|what\s+(date|dates|time|schedule)|tell\s+me\s+(about\s+)?(the\s+)?(schedule|dates?|events?))\b/i.test(query)) {
      return 'schedule';
    }
    
    // Scholarship queries (must be checked before comprehensive/general)
    // Detects queries about scholarships, scholarship recipients, scholarship statistics, etc.
    if (/\b(scholarship|scholarships|scholar|scholars|recipients?|beneficiaries?|total\s+(number|count|students?|recipients?)|how\s+many\s+students?\s+.*scholarship|students?\s+with\s+scholarship|scholarship\s+(statistics?|data|information|numbers?|counts?))\b/i.test(query)) {
      return 'scholarship';
    }
    
    if (/\b(list|all|every|show\s+all|what\s+are\s+the|enumerate|faculties|programs|campuses|missions|objectives)\b/i.test(query)) {
      return 'comprehensive';
    }
    
    return 'general';
  }

  /**
   * Convert MongoDB chunks to RAG format
   */
  _convertMongoChunksToRAG(chunks, baseScore = 100, source = 'mongodb_search') {
    return chunks.map(chunk => ({
      id: chunk.id,
      section: chunk.section,
      type: chunk.type,
      text: chunk.content || chunk.text,
      score: baseScore + (chunk.relevanceScore || 0),
      metadata: chunk.metadata || {},
      keywords: chunk.keywords || [],
      category: chunk.category,
      source
    }));
  }

  /**
   * Sort results by score
   */
  _sortByScore(results) {
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}

/**
 * Simple search function (backward compatibility)
 */
export async function searchSimilar(queryText, limit = 5, numCandidates = 200) {
  try {
    const mongoService = getMongoDBService();
    if (!mongoService) {
      Logger.error('MongoDB service not available for vector search');
      return [];
    }

    const embeddingService = getEmbeddingService();
    if (!embeddingService) {
      Logger.error('Embedding service not available');
      return [];
    }

    Logger.debug(`🔍 Generating embedding for query: "${queryText.substring(0, 50)}..."`);
    const queryEmbedding = await embeddingService.embedText(queryText);
    const results = await mongoService.vectorSearch(queryEmbedding, limit);
    Logger.debug(`✅ Vector search found ${results.length} similar documents`);
    return results;
  } catch (error) {
    Logger.error('Vector search failed:', error);
    return [];
  }
}
