/**
 * RAG Pipeline Benchmark Script
 * Tests the RAG pipeline on:
 * - Retrieval relevance
 * - Context accuracy
 * - Hallucinations
 * - Answer correctness
 */

import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const BENCHMARK_OUTPUT_DIR = path.resolve(__dirname, '../benchmark-results');

// Load dorsu_data.json for ground truth
const dataPath = path.resolve(__dirname, '../src/data/dorsu_data.json');
const dorsuData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Load schedule_data.json for ground truth
const scheduleDataPath = path.resolve(__dirname, '../src/data/schedule_data.json');
const scheduleData = JSON.parse(fs.readFileSync(scheduleDataPath, 'utf-8'));

/**
 * Generate test queries with ground truth data
 * 20 token-efficient questions: 10 from dorsu_data.json and 10 from schedule_data.json
 * Includes enrollment query variations for robustness testing
 */
function generateTestQueries() {
  const queries = [];

  // ========== DORSU DATA QUESTIONS (10 questions) ==========
  
  // 1. Programs - FALS (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "What programs are in FALS?",
    expectedKeywords: ["BSAM", "BSA", "BSBio", "BSES"],
    groundTruth: dorsuData.programs?.FALS?.programs,
    category: "programs",
    difficulty: "medium",
    dataSource: "dorsu_data"
  });

  // 2. Enrollment - Main Campus (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Main Campus enrollment 2024-2025?",
    expectedKeywords: ["12009", "12,009"],
    groundTruth: dorsuData['studentPopulation (as of 2024-2025)']?.campusPopulation?.find(c => c.campus === 'Main Campus'),
    category: "enrollment",
    difficulty: "medium",
    dataSource: "dorsu_data"
  });

  // 3. Programs - FBM (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "What programs are in FBM?",
    expectedKeywords: ["BSBA", "BSHM"],
    groundTruth: dorsuData.programs?.FBM?.programs,
    category: "programs",
    difficulty: "medium",
    dataSource: "dorsu_data"
  });

  // 4. History - San Isidro (TOKEN-EFFICIENT: Short, specific)
  // Note: Only checking date since question asks "when", not "who"
  queries.push({
    question: "When was San Isidro Campus established?",
    expectedKeywords: ["1997", "November"],
    groundTruth: dorsuData.history?.timeline?.find(t => t.date === "1997-11"),
    category: "history",
    difficulty: "hard",
    dataSource: "dorsu_data"
  });

  // 5. Leadership - VPs (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Who are the VPs of DOrSU?",
    expectedKeywords: ["VP for Administration and Finance", "VP for Research, Innovation, and Extension", "VP for Academic Affairs", "VP for Planning and Quality Assurance"],
    groundTruth: dorsuData['organizationalStructure/DOrSUOfficials2025']?.vicePresidents || [],
    category: "leadership",
    difficulty: "hard",
    dataSource: "dorsu_data"
  });

  // 6. Programs - FACET (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "What programs are in FACET?",
    expectedKeywords: ["BSIT", "BSCE", "BSMath", "BITM"],
    groundTruth: dorsuData.programs?.FACET?.programs,
    category: "programs",
    difficulty: "medium",
    dataSource: "dorsu_data"
  });

  // 7. Admission Requirements (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Admission requirements for transferring students?",
    expectedKeywords: ["SUAST Examination Result", "Transcript of Record", "Certificate of Transfer Credential", "Good Moral Character", "PSA Birth Certificate"],
    groundTruth: dorsuData['admissionEnrollmentRequirements2025']?.transferringStudents?.requirements || [],
    category: "admission",
    difficulty: "medium",
    dataSource: "dorsu_data"
  });

  // 8. Leadership - President (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Who is the president of DOrSU?",
    expectedKeywords: ["Dr. Roy G. Ponce", "Roy G. Ponce"],
    groundTruth: dorsuData.leadership?.president,
    category: "leadership",
    difficulty: "easy",
    dataSource: "dorsu_data"
  });

  // 9. Office Head - OSPAT (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Who is the head of OSPAT?",
    expectedKeywords: ["Ms. Trishea Amor C. Jacobe", "Trishea Amor C. Jacobe", "OSPAT"],
    groundTruth: dorsuData.offices?.studentServices?.find(o => o.acronym === 'OSPAT'),
    category: "offices",
    difficulty: "hard",
    dataSource: "dorsu_data"
  });

  // 10. Enrollment 2025-2026 (TOKEN-EFFICIENT: Short, specific)
  const grandTotalEnrollment = dorsuData['enrollment2025-2026']?.semester1?.find(e => e.program === 'GRAND TOTAL');
  queries.push({
    question: "Grand Total enrollment 2025-2026 semester 1?",
    expectedKeywords: ["17629", "17,629"],
    groundTruth: grandTotalEnrollment ? {
      total: grandTotalEnrollment.total,
      program: grandTotalEnrollment.program,
      semester: grandTotalEnrollment.semester,
      school_year: grandTotalEnrollment.school_year
    } : null,
    category: "enrollment",
    difficulty: "medium",
    dataSource: "dorsu_data"
  });

  // ========== SCHEDULE DATA QUESTIONS (10 questions) ==========

  // 11. Start of Classes - Semester 2, 2025
  const startClassesUndergrad = scheduleData.find(e => 
    e.Event === "Start of Classes for Undergraduate Program" && 
    e.Semester === "2" && 
    e.Year === "2025"
  );
  queries.push({
    question: "When does semester 2 start for undergraduate program in 2025?",
    expectedKeywords: ["1/15/2025", "January 15", "2025"],
    groundTruth: startClassesUndergrad,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  // 12. Final Examination - Semester 1, 2025
  const finalExamUndergrad = scheduleData.find(e => 
    e.Event === "Final Examination for Undergraduate Program" && 
    e.Semester === "1" && 
    e.Year === "2025" &&
    e.DateType === "date_range"
  );
  queries.push({
    question: "When is the final examination for undergraduate program semester 1, 2025?",
    expectedKeywords: ["12/15/2025", "12/18/2025", "December"],
    groundTruth: finalExamUndergrad,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  // 13. Registration Period - Semester 1, 2025
  const registrationUndergrad = scheduleData.find(e => 
    e.Event === "Regular Registration Period for Undergraduate Program" && 
    e.Semester === "1" && 
    e.Year === "2025"
  );
  queries.push({
    question: "Regular registration period for undergraduate program semester 1, 2025?",
    expectedKeywords: ["8/4/2025", "8/8/2025", "August"],
    groundTruth: registrationUndergrad,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  // 14. Siglakas Event
  const siglakas = scheduleData.find(e => 
    e.Event === "Siglakas" && 
    e.Year === "2025"
  );
  queries.push({
    question: "When is Siglakas in 2025?",
    expectedKeywords: ["4/23/2025", "4/26/2025", "April"],
    groundTruth: siglakas,
    category: "schedule",
    difficulty: "easy",
    dataSource: "schedule_data"
  });

  // 15. Preliminary Examination - Semester 2, 2025
  const prelimExamUndergrad = scheduleData.find(e => 
    e.Event === "Preliminary Examination for Undergraduate Program" && 
    e.Semester === "2" && 
    e.Year === "2025"
  );
  queries.push({
    question: "Preliminary examination dates for undergraduate program semester 2, 2025?",
    expectedKeywords: ["2/25/2025", "2/26/2025", "February"],
    groundTruth: prelimExamUndergrad,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  // 16. Commencement Exercises
  const commencement = scheduleData.find(e => 
    e.Event === "Commencement Exercises for AY 2024-2025" && 
    e.Year === "2025"
  );
  queries.push({
    question: "When is the commencement exercises for AY 2024-2025?",
    expectedKeywords: ["6/23/2025", "6/27/2025", "June"],
    groundTruth: commencement,
    category: "schedule",
    difficulty: "easy",
    dataSource: "schedule_data"
  });

  // 17. Midterm Examination - Semester 1, 2025
  const midtermExamUndergrad = scheduleData.find(e => 
    e.Event === "Midterm Examination for Undergraduate Program" && 
    e.Semester === "1" && 
    e.Year === "2025"
  );
  queries.push({
    question: "Midterm examination dates for undergraduate program semester 1, 2025?",
    expectedKeywords: ["11/4/2025", "11/5/2025", "November"],
    groundTruth: midtermExamUndergrad,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  // 18. Deadline for Application for Graduation
  const graduationDeadline = scheduleData.find(e => 
    e.Event === "Deadline in Filing of Application for Graduation" && 
    e.Semester === "2" && 
    e.Year === "2025"
  );
  queries.push({
    question: "Deadline for filing application for graduation semester 2, 2025?",
    expectedKeywords: ["2/12/2025", "February 12"],
    groundTruth: graduationDeadline,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  // 19. Foundation Day
  const foundationDay = scheduleData.find(e => 
    e.Event === "DOrSU Founding Anniversary" && 
    e.Year === "2025"
  );
  queries.push({
    question: "When is DOrSU Founding Anniversary in 2025?",
    expectedKeywords: ["5/20/2025", "May 20"],
    groundTruth: foundationDay,
    category: "schedule",
    difficulty: "easy",
    dataSource: "schedule_data"
  });

  // 20. Off-Semester Registration
  const offSemRegistration = scheduleData.find(e => 
    e.Event === "Regular Registration Period for Undergraduate Program" && 
    e.Semester === "Off" && 
    e.Year === "2025"
  );
  queries.push({
    question: "Regular registration period for undergraduate program off-semester 2025?",
    expectedKeywords: ["6/5/2025", "6/6/2025", "June"],
    groundTruth: offSemRegistration,
    category: "schedule",
    difficulty: "medium",
    dataSource: "schedule_data"
  });

  return queries;
}

/**
 * Make API request to chat endpoint
 */
function makeChatRequest(question) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      prompt: question,
      userType: null
    });

    const url = new URL(API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Extract ground truth facts from data structure
 * Smart extraction based on question type
 */
function extractGroundTruthFacts(groundTruth, question) {
  const facts = [];
  
  if (!groundTruth) return facts;

  const questionLower = question.toLowerCase();
  const isWhenQuery = questionLower.includes('when') || questionLower.includes('date');
  const isWhoQuery = questionLower.includes('who') || questionLower.includes('person');
  const isWhatQuery = questionLower.includes('what') || questionLower.includes('which');

  // Handle different data structures
  if (typeof groundTruth === 'string') {
    facts.push(groundTruth);
  } else if (typeof groundTruth === 'number') {
    facts.push(String(groundTruth));
    facts.push(groundTruth.toLocaleString()); // With commas
  } else if (Array.isArray(groundTruth)) {
    groundTruth.forEach(item => {
      if (typeof item === 'string') {
        facts.push(item);
      } else if (typeof item === 'object') {
        // Extract relevant fields based on question type
        Object.entries(item).forEach(([key, val]) => {
          if (typeof val === 'string' && val.length > 0) {
            // For "when" queries, prioritize date fields
            if (isWhenQuery && (key.includes('date') || key.includes('year') || /^\d{4}/.test(val))) {
              facts.push(val);
            } else if (isWhoQuery && (key.includes('person') || key.includes('name') || key.includes('key'))) {
              facts.push(val);
            } else if (!isWhenQuery && !isWhoQuery) {
              facts.push(val);
            }
          }
        });
      }
    });
  } else if (typeof groundTruth === 'object') {
    // Check if this is schedule data (has StartDate, EndDate, Event fields)
    if (groundTruth.StartDate || groundTruth.Event) {
      // Schedule data format
      if (isWhenQuery) {
        // Extract dates for "when" queries
        if (groundTruth.StartDate) {
          const startDate = groundTruth.StartDate;
          facts.push(startDate);
          // Extract date components
          if (startDate.includes('/')) {
            const [month, day, year] = startDate.split('/');
            facts.push(year);
            // Add month name
            const monthNames = {
              '1': 'january', '01': 'january',
              '2': 'february', '02': 'february',
              '3': 'march', '03': 'march',
              '4': 'april', '04': 'april',
              '5': 'may', '05': 'may',
              '6': 'june', '06': 'june',
              '7': 'july', '07': 'july',
              '8': 'august', '08': 'august',
              '9': 'september', '09': 'september',
              '10': 'october',
              '11': 'november',
              '12': 'december'
            };
            const monthName = monthNames[month];
            if (monthName) facts.push(monthName);
            // Add formatted date like "January 15"
            if (monthName && day) {
              facts.push(`${monthName} ${day}`);
            }
          }
        }
        if (groundTruth.EndDate && groundTruth.EndDate !== groundTruth.StartDate) {
          facts.push(groundTruth.EndDate);
        }
        if (groundTruth.Year) facts.push(groundTruth.Year);
        if (groundTruth.Month) {
          const monthNames = {
            '1': 'january', '2': 'february', '3': 'march', '4': 'april',
            '5': 'may', '6': 'june', '7': 'july', '8': 'august',
            '9': 'september', '10': 'october', '11': 'november', '12': 'december'
          };
          const monthName = monthNames[groundTruth.Month];
          if (monthName) facts.push(monthName);
        }
      } else {
        // For non-"when" queries, include event name and dates
        if (groundTruth.Event) facts.push(groundTruth.Event);
        if (groundTruth.StartDate) facts.push(groundTruth.StartDate);
        if (groundTruth.EndDate) facts.push(groundTruth.EndDate);
        if (groundTruth.Year) facts.push(groundTruth.Year);
      }
    }
    // For timeline objects (history queries)
    else if (groundTruth.date) {
      const dateStr = groundTruth.date;
      // Extract date in multiple formats
      if (dateStr.includes('-')) {
        // ISO format like "1997-11" -> extract year and month
        const [year, month] = dateStr.split('-');
        facts.push(year);
        facts.push(dateStr); // Keep original format
        // Add month name if numeric
        if (month === '11') facts.push('november');
        if (month === '12') facts.push('december');
        if (month === '05' || month === '5') facts.push('may');
        if (month === '06' || month === '6') facts.push('june');
      } else {
        facts.push(dateStr);
      }
    }
    
    // For "when" queries, only extract date-related fields
    if (isWhenQuery && !groundTruth.StartDate) {
      if (groundTruth.date) {
        const dateStr = groundTruth.date;
        if (dateStr.includes('-')) {
          const [year] = dateStr.split('-');
          facts.push(year);
          if (dateStr.includes('11')) facts.push('november');
          if (dateStr.includes('12')) facts.push('december');
        }
      }
      // Skip event, details, keyPerson for "when" queries
    } else if (isWhoQuery) {
      // For "who" queries, extract person-related fields
      if (groundTruth.keyPerson) facts.push(groundTruth.keyPerson);
      if (groundTruth.donor) facts.push(groundTruth.donor);
      if (groundTruth.foundingDean) facts.push(groundTruth.foundingDean);
    } else if (!groundTruth.StartDate && !groundTruth.date) {
      // For other queries, extract all relevant fields (but not schedule data)
      Object.values(groundTruth).forEach(val => {
        if (typeof val === 'string' && val.length > 0) {
          facts.push(val);
        } else if (typeof val === 'number') {
          facts.push(String(val));
        } else if (Array.isArray(val)) {
          val.forEach(item => {
            if (typeof item === 'string') facts.push(item);
            if (typeof item === 'object' && item.name) facts.push(item.name);
            if (typeof item === 'object' && item.code) facts.push(item.code);
          });
        }
      });
    }
  }

  return facts.map(f => f.toLowerCase().trim()).filter(f => f.length > 0);
}

/**
 * Test Retrieval Relevance
 * Checks if retrieved chunks contain relevant information
 */
function testRetrievalRelevance(response, query, groundTruth) {
  // Since we don't have direct access to retrieved chunks from API,
  // we infer relevance from the response quality and usedKnowledgeBase flag
  const responseText = (response.reply || '').toLowerCase();
  const groundTruthFacts = extractGroundTruthFacts(groundTruth, query.question);
  
  let relevantFactsFound = 0;
  const foundFacts = [];
  const missingFacts = [];

  // Use same flexible matching as context accuracy
  groundTruthFacts.forEach(fact => {
    const factLower = fact.toLowerCase();
    let found = false;
    
    // Direct match
    if (responseText.includes(factLower)) {
      found = true;
    }
    // Flexible date matching: "1997-11" should match "november 1997" or "1997 november"
    else if (/^\d{4}-\d{1,2}$/.test(fact)) {
      const [year, month] = fact.split('-');
      const monthNames = {
        '11': 'november', '12': 'december', '05': 'may', '5': 'may',
        '06': 'june', '6': 'june', '01': 'january', '1': 'january'
      };
      const monthName = monthNames[month];
      if (responseText.includes(year) && (monthName ? responseText.includes(monthName) : true)) {
        found = true;
      }
    }
    // Flexible date matching for M/D/YYYY format: "1/15/2025" should match "January 15, 2025" or "1/15/2025"
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fact)) {
      const [month, day, year] = fact.split('/');
      const monthNames = {
        '1': 'january', '01': 'january', '2': 'february', '02': 'february',
        '3': 'march', '03': 'march', '4': 'april', '04': 'april',
        '5': 'may', '05': 'may', '6': 'june', '06': 'june',
        '7': 'july', '07': 'july', '8': 'august', '08': 'august',
        '9': 'september', '09': 'september', '10': 'october',
        '11': 'november', '12': 'december'
      };
      const monthName = monthNames[month];
      // Check if year matches and (month name matches OR month number matches OR day matches)
      if (responseText.includes(year)) {
        if (monthName && responseText.includes(monthName)) {
          found = true;
        } else if (responseText.includes(month) && responseText.includes(day)) {
          found = true;
        } else if (responseText.includes(fact)) {
          found = true;
        }
      }
    }
    // Flexible number matching: "12009" should match "12,009" and vice versa
    else if (/^\d+$/.test(fact) || /^\d{1,3}(,\d{3})+$/.test(fact)) {
      const numberOnly = fact.replace(/,/g, '');
      const numberWithCommas = parseInt(numberOnly).toLocaleString();
      if (responseText.includes(numberOnly) || responseText.includes(numberWithCommas)) {
        found = true;
      }
    }
    // Partial match for compound facts
    else if (fact.includes(' ') && fact.split(' ').length > 2) {
      const words = fact.split(' ').filter(w => w.length > 2);
      const matchedWords = words.filter(word => responseText.includes(word.toLowerCase()));
      // If at least 60% of significant words match, consider it found
      if (matchedWords.length >= Math.ceil(words.length * 0.6)) {
        found = true;
      }
    }
    
    if (found) {
      relevantFactsFound++;
      foundFacts.push(fact);
    } else {
      missingFacts.push(fact);
    }
  });

  const relevanceScore = groundTruthFacts.length > 0 
    ? (relevantFactsFound / groundTruthFacts.length) * 100 
    : 0;

  return {
    score: relevanceScore,
    foundFacts: foundFacts.slice(0, 10), // Limit to first 10
    missingFacts: missingFacts.slice(0, 10),
    totalFacts: groundTruthFacts.length,
    usedKnowledgeBase: response.usedKnowledgeBase || false
  };
}

/**
 * Test Context Accuracy
 * Checks if the RAG/vector search properly fetched accurate chunks
 * This infers context accuracy from response quality and knowledge base usage
 */
function testContextAccuracy(response, query, groundTruth) {
  const responseText = (response.reply || '').toLowerCase();
  const groundTruthFacts = extractGroundTruthFacts(groundTruth, query.question);
  
  // Check if knowledge base was used (indicates chunks were retrieved)
  const usedKnowledgeBase = response.usedKnowledgeBase || false;
  
  // Check for contradictions (facts that contradict ground truth)
  // Contradictions indicate wrong chunks were retrieved or chunks are inaccurate
  const contradictions = [];
  
  // Check for specific known contradictions
  if (query.question.includes('enrollment') && query.question.includes('2025')) {
    // Should be 17251, not 4447
    if (responseText.includes('4447') && !responseText.includes('17251') && !responseText.includes('17,251')) {
      contradictions.push('Incorrect enrollment number: stated 4447 instead of 17251');
    }
  }

  if (query.question.includes('enrollment schedule') && query.question.includes('2025')) {
    // Should mention 2025 dates, not 2026
    if (responseText.includes('2026') && !responseText.includes('2025')) {
      contradictions.push('Incorrect year: mentioned 2026 instead of 2025');
    }
  }

  // Check if response contains accurate facts from ground truth
  // This indicates that correct chunks were retrieved
  // Use flexible matching for dates and numbers
  let accurateFacts = 0;
  const foundFacts = [];
  const missingFacts = [];
  
  groundTruthFacts.forEach(fact => {
    const factLower = fact.toLowerCase();
    let found = false;
    
    // Direct match
    if (responseText.includes(factLower)) {
      found = true;
    }
    // Flexible date matching: "1997-11" should match "november 1997" or "1997 november"
    else if (/^\d{4}-\d{1,2}$/.test(fact)) {
      const [year, month] = fact.split('-');
      const monthNames = {
        '11': 'november', '12': 'december', '05': 'may', '5': 'may',
        '06': 'june', '6': 'june', '01': 'january', '1': 'january'
      };
      const monthName = monthNames[month];
      if (responseText.includes(year) && (monthName ? responseText.includes(monthName) : true)) {
        found = true;
      }
    }
    // Flexible date matching for M/D/YYYY format: "1/15/2025" should match "January 15, 2025" or "1/15/2025"
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fact)) {
      const [month, day, year] = fact.split('/');
      const monthNames = {
        '1': 'january', '01': 'january', '2': 'february', '02': 'february',
        '3': 'march', '03': 'march', '4': 'april', '04': 'april',
        '5': 'may', '05': 'may', '6': 'june', '06': 'june',
        '7': 'july', '07': 'july', '8': 'august', '08': 'august',
        '9': 'september', '09': 'september', '10': 'october',
        '11': 'november', '12': 'december'
      };
      const monthName = monthNames[month];
      // Check if year matches and (month name matches OR month number matches OR day matches)
      if (responseText.includes(year)) {
        if (monthName && responseText.includes(monthName)) {
          found = true;
        } else if (responseText.includes(month) && responseText.includes(day)) {
          found = true;
        } else if (responseText.includes(fact)) {
          found = true;
        }
      }
    }
    // Flexible number matching: "12009" should match "12,009" and vice versa
    else if (/^\d+$/.test(fact) || /^\d{1,3}(,\d{3})+$/.test(fact)) {
      const numberOnly = fact.replace(/,/g, '');
      const numberWithCommas = parseInt(numberOnly).toLocaleString();
      if (responseText.includes(numberOnly) || responseText.includes(numberWithCommas)) {
        found = true;
      }
    }
    // Partial match for compound facts (e.g., "san isidro campus established" should match if response has "san isidro" and "established")
    else if (fact.includes(' ') && fact.split(' ').length > 2) {
      const words = fact.split(' ').filter(w => w.length > 2);
      const matchedWords = words.filter(word => responseText.includes(word.toLowerCase()));
      // If at least 60% of significant words match, consider it found
      if (matchedWords.length >= Math.ceil(words.length * 0.6)) {
        found = true;
      }
    }
    
    if (found) {
      accurateFacts++;
      foundFacts.push(fact);
    } else {
      missingFacts.push(fact);
    }
  });

  // Calculate context accuracy score
  // Factors:
  // 1. How many ground truth facts are in the response (indicates good chunks retrieved)
  // 2. Whether knowledge base was used (indicates chunks were retrieved)
  // 3. Whether there are contradictions (penalty for wrong chunks)
  
  const factAccuracy = groundTruthFacts.length > 0
    ? (accurateFacts / groundTruthFacts.length) * 100
    : 0;
  
  // Base score from fact accuracy
  let accuracyScore = factAccuracy;
  
  // Penalty for contradictions (indicates wrong chunks)
  if (contradictions.length > 0) {
    accuracyScore = Math.max(0, accuracyScore - (contradictions.length * 20));
  }
  
  // Bonus if knowledge base was used (indicates chunks were retrieved)
  if (usedKnowledgeBase && factAccuracy > 0) {
    accuracyScore = Math.min(100, accuracyScore + 10);
  }
  
  // Penalty if knowledge base wasn't used but ground truth exists (chunks not retrieved)
  if (!usedKnowledgeBase && groundTruthFacts.length > 0) {
    accuracyScore = Math.max(0, accuracyScore - 30);
  }
  
  // Penalty if response is vague when specific data exists (chunks not retrieved or incomplete)
  // BUT: Don't penalize if response is concise but accurate (e.g., "November 1997" is correct even if short)
  const isConciseButAccurate = responseText.length < 100 && 
                                (responseText.match(/\d{4}/) || responseText.match(/november|december|may|june|january/i)) &&
                                accurateFacts > 0;
  if (groundTruthFacts.length > 0 && responseText.length < 100 && !responseText.includes('dorsu') && !isConciseButAccurate) {
    accuracyScore = Math.max(0, accuracyScore - 20);
  }

  return {
    score: Math.min(100, Math.max(0, accuracyScore)),
    contradictions,
    hasContradictions: contradictions.length > 0,
    accurateFacts,
    totalChecked: groundTruthFacts.length,
    foundFacts: foundFacts.slice(0, 10),
    missingFacts: missingFacts.slice(0, 10),
    usedKnowledgeBase,
    factAccuracy
  };
}

/**
 * Test for Hallucinations
 * Checks if the response contains information not in the knowledge base
 */
function testHallucinations(response, query, groundTruth) {
  const responseText = (response.reply || '').toLowerCase();
  const hallucinations = [];
  
  // Extract ground truth facts for checking
  const groundTruthFacts = extractGroundTruthFacts(groundTruth, query.question);
  
  // Known patterns that indicate hallucinations
  const hallucinationPatterns = [
    {
      pattern: /i (don't|do not) (have|know|see|find)/i,
      description: 'Model claims lack of information when data exists'
    },
    {
      pattern: /the knowledge base does not (specify|mention|include|contain)/i,
      description: 'Model incorrectly states data is missing'
    },
    {
      pattern: /(unfortunately|sorry),? (i|we) (cannot|cannot|don't|do not) (find|locate|retrieve)/i,
      description: 'Model incorrectly claims inability to find data'
    }
  ];

  // Check for specific false statements
  if (query.question.includes('enrollment') && query.question.includes('2025')) {
    // If response says 4447 but ground truth is 17251, that's a hallucination
    if (responseText.includes('4447') && groundTruth === 17251) {
      hallucinations.push({
        type: 'incorrect_fact',
        description: 'Stated enrollment as 4447 when correct value is 17251',
        severity: 'high'
      });
    }
  }

  // Check for made-up information patterns
  if (responseText.includes('according to') && !response.usedKnowledgeBase) {
    hallucinations.push({
      type: 'unsourced_claim',
      description: 'Makes claims without using knowledge base',
      severity: 'medium'
    });
  }

  // Check hallucination patterns
  hallucinationPatterns.forEach(({ pattern, description }) => {
    if (pattern.test(responseText) && groundTruth) {
      hallucinations.push({
        type: 'false_negation',
        description,
        severity: 'high'
      });
    }
  });

  // Check for vague responses when specific data exists
  // BUT: Don't flag concise but accurate responses (e.g., "November 1997" is correct even if short)
  const isConciseButAccurate = responseText.length < 100 && 
                                (responseText.match(/\d{4}/) || responseText.match(/november|december|may|june|january/i)) &&
                                groundTruthFacts.some(fact => {
                                  const factLower = fact.toLowerCase();
                                  if (responseText.includes(factLower)) return true;
                                  // Check date formats: "1997-11" should match "november 1997"
                                  if (/^\d{4}-\d{1,2}$/.test(fact)) {
                                    const [year] = fact.split('-');
                                    return responseText.includes(year);
                                  }
                                  return false;
                                });
  if (groundTruth && responseText.length < 100 && !responseText.includes('dorsu') && !isConciseButAccurate) {
    hallucinations.push({
      type: 'vague_response',
      description: 'Response too vague given available data',
      severity: 'medium'
    });
  }

  return {
    hasHallucinations: hallucinations.length > 0,
    count: hallucinations.length,
    hallucinations: hallucinations.slice(0, 5), // Limit to first 5
    score: hallucinations.length === 0 ? 100 : Math.max(0, 100 - (hallucinations.length * 20))
  };
}

/**
 * Test Answer Correctness
 * Uses the same flexible matching as benchmark-ai-accuracy.js for consistency
 */
function testAnswerCorrectness(response, query, groundTruth) {
  const responseText = (response.reply || '').toLowerCase();
  const expectedKeywords = query.expectedKeywords;
  const foundKeywords = [];
  const missingKeywords = [];
  
  // Use the same flexible matching logic as benchmark-ai-accuracy.js
  expectedKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // Direct match
    if (responseText.includes(keywordLower)) {
      foundKeywords.push(keyword);
      return;
    }
    
    // Flexible matching for VP titles and similar phrases
    if (keyword.includes('VP for')) {
      const parts = keywordLower
        .replace(/vp for /i, '')
        .split(/[,\s]+and\s+|,\s*|\s+/)
        .filter(part => part.length > 2 && !['for', 'the', 'and', 'or'].includes(part));
      
      const minParts = Math.max(1, Math.ceil(parts.length * 0.6)); // At least 60% of parts
      const foundParts = parts.filter(part => responseText.includes(part));
      
      if (foundParts.length >= minParts) {
        foundKeywords.push(keyword);
        return;
      }
    }
    
    // Flexible matching for names with titles
    if (/^(hon\.|dr\.|mr\.|ms\.|mrs\.|prof\.)\s+/i.test(keyword)) {
      const nameWithoutTitle = keyword.replace(/^(hon\.|dr\.|mr\.|ms\.|mrs\.|prof\.)\s+/i, '').toLowerCase();
      const nameParts = nameWithoutTitle.split(/\s+/).filter(part => part.length > 1);
      if (nameParts.length > 0 && responseText.includes(nameParts[nameParts.length - 1])) {
        foundKeywords.push(keyword);
        return;
      }
    }
    
    // Flexible matching for numbers with/without commas
    if (/^\d+$/.test(keyword) || /^\d{1,3}(,\d{3})+$/.test(keyword)) {
      const numberOnly = keyword.replace(/,/g, '');
      const numberWithCommas = parseInt(numberOnly).toLocaleString();
      if (responseText.includes(numberOnly) || responseText.includes(numberWithCommas)) {
        foundKeywords.push(keyword);
        return;
      }
    }
    
    // If no flexible match found, mark as missing
    missingKeywords.push(keyword);
  });
  
  // Calculate accuracy (same as benchmark-ai-accuracy.js)
  const accuracy = expectedKeywords.length > 0
    ? (foundKeywords.length / expectedKeywords.length) * 100
    : 0;
  
  // Also check ground truth facts for additional context (but don't use in score calculation)
  const groundTruthFacts = extractGroundTruthFacts(groundTruth, query.question);
  const foundFacts = groundTruthFacts.filter(fact => responseText.includes(fact.toLowerCase()));

  return {
    score: accuracy, // Use same accuracy calculation as AI accuracy benchmark
    keywordAccuracy: accuracy, // Same as score
    factAccuracy: groundTruthFacts.length > 0
      ? (foundFacts.length / groundTruthFacts.length) * 100
      : 0,
    foundKeywords,
    missingKeywords,
    foundFacts: foundFacts.slice(0, 10),
    passed: accuracy >= 70 // Same 70% threshold as benchmark-ai-accuracy.js
  };
}

/**
 * Run comprehensive RAG pipeline benchmark
 */
async function runRAGBenchmark() {
  console.log('🚀 Starting RAG Pipeline Benchmark Tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const queries = generateTestQueries();
  const results = [];
  
  let totalRetrievalRelevance = 0;
  let totalContextAccuracy = 0;
  let totalHallucinationScore = 0;
  let totalAnswerCorrectness = 0;

  console.log(`Testing ${queries.length} queries with RAG pipeline metrics...\n`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] Testing: ${query.question}`);
    console.log(`   Category: ${query.category} | Difficulty: ${query.difficulty}`);

    try {
      const startTime = Date.now();
      const response = await makeChatRequest(query.question);
      const responseTime = Date.now() - startTime;

      // Test all metrics
      const retrievalRelevance = testRetrievalRelevance(response, query, query.groundTruth);
      const contextAccuracy = testContextAccuracy(response, query, query.groundTruth);
      const hallucinations = testHallucinations(response, query, query.groundTruth);
      const answerCorrectness = testAnswerCorrectness(response, query, query.groundTruth);

      // Accumulate scores
      totalRetrievalRelevance += retrievalRelevance.score;
      totalContextAccuracy += contextAccuracy.score;
      totalHallucinationScore += hallucinations.score;
      totalAnswerCorrectness += answerCorrectness.score;

      const result = {
        question: query.question,
        category: query.category,
        difficulty: query.difficulty,
        dataSource: query.dataSource || 'unknown',
        response: response.reply,
        responseTime,
        model: response.model || 'unknown',
        usedKnowledgeBase: response.usedKnowledgeBase || false,
        
        // RAG Pipeline Metrics
        retrievalRelevance: {
          score: retrievalRelevance.score,
          foundFacts: retrievalRelevance.foundFacts,
          missingFacts: retrievalRelevance.missingFacts,
          totalFacts: retrievalRelevance.totalFacts,
          usedKnowledgeBase: retrievalRelevance.usedKnowledgeBase
        },
        
        contextAccuracy: {
          score: contextAccuracy.score,
          contradictions: contextAccuracy.contradictions,
          hasContradictions: contextAccuracy.hasContradictions,
          accurateFacts: contextAccuracy.accurateFacts,
          totalChecked: contextAccuracy.totalChecked,
          foundFacts: contextAccuracy.foundFacts || [],
          missingFacts: contextAccuracy.missingFacts || [],
          usedKnowledgeBase: contextAccuracy.usedKnowledgeBase,
          factAccuracy: contextAccuracy.factAccuracy || 0
        },
        
        hallucinations: {
          hasHallucinations: hallucinations.hasHallucinations,
          count: hallucinations.count,
          hallucinations: hallucinations.hallucinations,
          score: hallucinations.score
        },
        
        answerCorrectness: {
          score: answerCorrectness.score,
          keywordAccuracy: answerCorrectness.keywordAccuracy,
          factAccuracy: answerCorrectness.factAccuracy,
          foundKeywords: answerCorrectness.foundKeywords,
          missingKeywords: answerCorrectness.missingKeywords,
          foundFacts: answerCorrectness.foundFacts,
          passed: answerCorrectness.passed
        }
      };

      results.push(result);

      // Display AI response in console
      console.log(`   💬 AI Response:`);
      console.log(`   ${response.reply.split('\n').map(line => `   ${line}`).join('\n')}`);
      console.log('');

      // Print summary
      console.log(`   📊 Retrieval Relevance: ${retrievalRelevance.score.toFixed(1)}%`);
      console.log(`   ✅ Context Accuracy: ${contextAccuracy.score.toFixed(1)}% (${contextAccuracy.usedKnowledgeBase ? 'KB used' : 'KB not used'}, ${contextAccuracy.accurateFacts}/${contextAccuracy.totalChecked} facts)`);
      if (contextAccuracy.hasContradictions) {
        console.log(`   ⚠️  Contradictions: ${contextAccuracy.contradictions.length}`);
      }
      console.log(`   🎭 Hallucinations: ${hallucinations.hasHallucinations ? 'YES' : 'NO'} (Score: ${hallucinations.score.toFixed(1)}%)`);
      console.log(`   ✓ Answer Correctness: ${answerCorrectness.score.toFixed(1)}% ${answerCorrectness.passed ? '✅' : '❌'}`);
      console.log(`   ⏱️  Response time: ${responseTime}ms\n`);

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
      results.push({
        question: query.question,
        category: query.category,
        difficulty: query.difficulty,
        dataSource: query.dataSource || 'unknown',
        error: error.message
      });
    }
  }

  // Calculate statistics
  const avgRetrievalRelevance = totalRetrievalRelevance / queries.length;
  const avgContextAccuracy = totalContextAccuracy / queries.length;
  const avgHallucinationScore = totalHallucinationScore / queries.length;
  const avgAnswerCorrectness = totalAnswerCorrectness / queries.length;

  // Group by category
  const categoryStats = {};
  results.forEach(result => {
    if (!result.error) {
      if (!categoryStats[result.category]) {
        categoryStats[result.category] = {
          retrievalRelevance: 0,
          contextAccuracy: 0,
          hallucinationScore: 0,
          answerCorrectness: 0,
          count: 0
        };
      }
      categoryStats[result.category].retrievalRelevance += result.retrievalRelevance.score;
      categoryStats[result.category].contextAccuracy += result.contextAccuracy.score;
      categoryStats[result.category].hallucinationScore += result.hallucinations.score;
      categoryStats[result.category].answerCorrectness += result.answerCorrectness.score;
      categoryStats[result.category].count++;
    }
  });

  // Group by data source
  const dataSourceStats = {};
  results.forEach(result => {
    if (!result.error) {
      const dataSource = result.dataSource || 'unknown';
      if (!dataSourceStats[dataSource]) {
        dataSourceStats[dataSource] = {
          retrievalRelevance: 0,
          contextAccuracy: 0,
          hallucinationScore: 0,
          answerCorrectness: 0,
          count: 0
        };
      }
      dataSourceStats[dataSource].retrievalRelevance += result.retrievalRelevance.score;
      dataSourceStats[dataSource].contextAccuracy += result.contextAccuracy.score;
      dataSourceStats[dataSource].hallucinationScore += result.hallucinations.score;
      dataSourceStats[dataSource].answerCorrectness += result.answerCorrectness.score;
      dataSourceStats[dataSource].count++;
    }
  });

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalQueries: queries.length,
      averageRetrievalRelevance: avgRetrievalRelevance,
      averageContextAccuracy: avgContextAccuracy,
      averageHallucinationScore: avgHallucinationScore,
      averageAnswerCorrectness: avgAnswerCorrectness,
      overallScore: (avgRetrievalRelevance + avgContextAccuracy + avgHallucinationScore + avgAnswerCorrectness) / 4
    },
    categoryStats: Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      count: stats.count,
      avgRetrievalRelevance: stats.retrievalRelevance / stats.count,
      avgContextAccuracy: stats.contextAccuracy / stats.count,
      avgHallucinationScore: stats.hallucinationScore / stats.count,
      avgAnswerCorrectness: stats.answerCorrectness / stats.count
    })),
    dataSourceStats: Object.entries(dataSourceStats).map(([dataSource, stats]) => ({
      dataSource,
      count: stats.count,
      avgRetrievalRelevance: stats.retrievalRelevance / stats.count,
      avgContextAccuracy: stats.contextAccuracy / stats.count,
      avgHallucinationScore: stats.hallucinationScore / stats.count,
      avgAnswerCorrectness: stats.answerCorrectness / stats.count
    })),
    results
  };

  // Save report as Markdown
  if (!fs.existsSync(BENCHMARK_OUTPUT_DIR)) {
    fs.mkdirSync(BENCHMARK_OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(BENCHMARK_OUTPUT_DIR, `rag-pipeline-benchmark-${timestamp}.md`);
  
  // Generate Markdown report
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(reportPath, markdownReport);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 RAG PIPELINE BENCHMARK SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Queries: ${queries.length}`);
  console.log(`\n📈 Average Scores:`);
  console.log(`   Retrieval Relevance: ${avgRetrievalRelevance.toFixed(1)}%`);
  console.log(`   Context Accuracy: ${avgContextAccuracy.toFixed(1)}%`);
  console.log(`   Hallucination Score: ${avgHallucinationScore.toFixed(1)}% (higher is better)`);
  console.log(`   Answer Correctness: ${avgAnswerCorrectness.toFixed(1)}%`);
  console.log(`   Overall Score: ${report.summary.overallScore.toFixed(1)}%`);
  
  console.log(`\n📁 Category Performance:`);
  report.categoryStats.forEach(stat => {
    console.log(`   ${stat.category}:`);
    console.log(`      Retrieval: ${stat.avgRetrievalRelevance.toFixed(1)}% | Accuracy: ${stat.avgContextAccuracy.toFixed(1)}% | Hallucinations: ${stat.avgHallucinationScore.toFixed(1)}% | Correctness: ${stat.avgAnswerCorrectness.toFixed(1)}%`);
  });
  
  console.log(`\n📊 Data Source Performance:`);
  report.dataSourceStats.forEach(stat => {
    console.log(`   ${stat.dataSource}:`);
    console.log(`      Retrieval: ${stat.avgRetrievalRelevance.toFixed(1)}% | Accuracy: ${stat.avgContextAccuracy.toFixed(1)}% | Hallucinations: ${stat.avgHallucinationScore.toFixed(1)}% | Correctness: ${stat.avgAnswerCorrectness.toFixed(1)}%`);
  });
  
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log('='.repeat(70));

  return report;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report) {
  const timestamp = new Date(report.timestamp).toLocaleString();
  
  let markdown = `# RAG Pipeline Benchmark Report\n\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  markdown += `---\n\n`;
  
  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Total Queries:** ${report.summary.totalQueries}\n`;
  markdown += `- **Average Retrieval Relevance:** ${report.summary.averageRetrievalRelevance.toFixed(1)}%\n`;
  markdown += `- **Average Context Accuracy:** ${report.summary.averageContextAccuracy.toFixed(1)}%\n`;
  markdown += `- **Average Hallucination Score:** ${report.summary.averageHallucinationScore.toFixed(1)}% (higher is better)\n`;
  markdown += `- **Average Answer Correctness:** ${report.summary.averageAnswerCorrectness.toFixed(1)}%\n`;
  markdown += `- **Overall Score:** ${report.summary.overallScore.toFixed(1)}%\n\n`;
  
  // Category Performance
  if (report.categoryStats && report.categoryStats.length > 0) {
    markdown += `## Category Performance\n\n`;
    markdown += `| Category | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |\n`;
    markdown += `|----------|-------|---------------------|-----------------|-------------------|-------------------|\n`;
    report.categoryStats.forEach(stat => {
      markdown += `| ${stat.category} | ${stat.count} | ${stat.avgRetrievalRelevance.toFixed(1)}% | ${stat.avgContextAccuracy.toFixed(1)}% | ${stat.avgHallucinationScore.toFixed(1)}% | ${stat.avgAnswerCorrectness.toFixed(1)}% |\n`;
    });
    markdown += `\n`;
  }
  
  // Data Source Performance
  if (report.dataSourceStats && report.dataSourceStats.length > 0) {
    markdown += `## Data Source Performance\n\n`;
    markdown += `| Data Source | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |\n`;
    markdown += `|-------------|-------|---------------------|-----------------|-------------------|-------------------|\n`;
    report.dataSourceStats.forEach(stat => {
      markdown += `| ${stat.dataSource} | ${stat.count} | ${stat.avgRetrievalRelevance.toFixed(1)}% | ${stat.avgContextAccuracy.toFixed(1)}% | ${stat.avgHallucinationScore.toFixed(1)}% | ${stat.avgAnswerCorrectness.toFixed(1)}% |\n`;
    });
    markdown += `\n`;
  }
  
  // Detailed Results
  markdown += `## Detailed Results\n\n`;
  report.results.forEach((result, index) => {
    if (result.error) {
      markdown += `### ${index + 1}. ${result.question}\n\n`;
      markdown += `**Category:** ${result.category} | **Difficulty:** ${result.difficulty} | **Data Source:** ${result.dataSource || 'unknown'}\n\n`;
      markdown += `**Error:** ${result.error}\n\n`;
      markdown += `---\n\n`;
      return;
    }
    
    markdown += `### ${index + 1}. ${result.question}\n\n`;
    markdown += `**Category:** ${result.category} | **Difficulty:** ${result.difficulty} | **Data Source:** ${result.dataSource || 'unknown'}\n\n`;
    
    // Metrics
    markdown += `#### Metrics\n\n`;
    markdown += `- **Retrieval Relevance:** ${result.retrievalRelevance.score.toFixed(1)}% (${result.retrievalRelevance.foundFacts.length}/${result.retrievalRelevance.totalFacts} facts found)\n`;
    markdown += `- **Context Accuracy:** ${result.contextAccuracy.score.toFixed(1)}% (${result.contextAccuracy.accurateFacts}/${result.contextAccuracy.totalChecked} facts, KB used: ${result.contextAccuracy.usedKnowledgeBase ? 'Yes' : 'No'})\n`;
    markdown += `- **Hallucination Score:** ${result.hallucinations.score.toFixed(1)}% (${result.hallucinations.hasHallucinations ? 'Has hallucinations' : 'No hallucinations'})\n`;
    markdown += `- **Answer Correctness:** ${result.answerCorrectness.score.toFixed(1)}% ${result.answerCorrectness.passed ? '✅' : '❌'}\n\n`;
    
    // AI Response
    if (result.response) {
      markdown += `#### AI Response\n\n`;
      markdown += `\`\`\`\n${result.response}\n\`\`\`\n\n`;
    }
    
    // Retrieval Relevance Details
    if (result.retrievalRelevance.foundFacts && result.retrievalRelevance.foundFacts.length > 0) {
      markdown += `#### Found Facts (${result.retrievalRelevance.foundFacts.length})\n\n`;
      markdown += `${result.retrievalRelevance.foundFacts.slice(0, 10).join(', ')}\n\n`;
    }
    
    if (result.retrievalRelevance.missingFacts && result.retrievalRelevance.missingFacts.length > 0) {
      markdown += `#### Missing Facts (${result.retrievalRelevance.missingFacts.length})\n\n`;
      markdown += `${result.retrievalRelevance.missingFacts.slice(0, 10).join(', ')}\n\n`;
    }
    
    // Context Accuracy Details
    if (result.contextAccuracy.foundFacts && result.contextAccuracy.foundFacts.length > 0) {
      markdown += `#### Context Facts Found (${result.contextAccuracy.foundFacts.length})\n\n`;
      markdown += `${result.contextAccuracy.foundFacts.slice(0, 10).join(', ')}\n\n`;
    }
    
    if (result.contextAccuracy.missingFacts && result.contextAccuracy.missingFacts.length > 0) {
      markdown += `#### Context Facts Missing (${result.contextAccuracy.missingFacts.length})\n\n`;
      markdown += `${result.contextAccuracy.missingFacts.slice(0, 10).join(', ')}\n\n`;
    }
    
    if (result.contextAccuracy.hasContradictions) {
      markdown += `#### ⚠️ Contradictions\n\n`;
      result.contextAccuracy.contradictions.forEach(contradiction => {
        markdown += `- ${contradiction}\n`;
      });
      markdown += `\n`;
    }
    
    // Hallucinations
    if (result.hallucinations.hasHallucinations) {
      markdown += `#### 🎭 Hallucinations Detected\n\n`;
      result.hallucinations.hallucinations.forEach(hallucination => {
        markdown += `- **${hallucination.type}** (${hallucination.severity}): ${hallucination.description}\n`;
      });
      markdown += `\n`;
    }
    
    // Answer Correctness Details
    if (result.answerCorrectness.foundKeywords && result.answerCorrectness.foundKeywords.length > 0) {
      markdown += `#### Found Keywords (${result.answerCorrectness.foundKeywords.length})\n\n`;
      markdown += `${result.answerCorrectness.foundKeywords.join(', ')}\n\n`;
    }
    
    if (result.answerCorrectness.missingKeywords && result.answerCorrectness.missingKeywords.length > 0) {
      markdown += `#### Missing Keywords (${result.answerCorrectness.missingKeywords.length})\n\n`;
      markdown += `${result.answerCorrectness.missingKeywords.join(', ')}\n\n`;
    }
    
    // Metadata
    markdown += `#### Metadata\n\n`;
    markdown += `- **Response Time:** ${result.responseTime}ms\n`;
    markdown += `- **Model:** ${result.model || 'unknown'}\n`;
    markdown += `- **Used Knowledge Base:** ${result.usedKnowledgeBase ? 'Yes' : 'No'}\n\n`;
    
    markdown += `---\n\n`;
  });
  
  return markdown;
}

// Run benchmark
runRAGBenchmark()
  .then(() => {
    console.log('\n✅ RAG Pipeline benchmark completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ RAG Pipeline benchmark failed:', error);
    process.exit(1);
  });

