/**
 * Data Refresh Service
 * Handles automatic refresh of knowledge base when new data is added
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '../utils/logger.js';
import { getEmbeddingService } from './embedding.js';
import { getMongoDBService } from './mongodb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataRefreshService {
  constructor() {
    this.isRefreshing = false;
    this.lastRefresh = null;
    this.dataFilePath = path.resolve(__dirname, '../data/dorsu_data.json');
    this.lastModified = null;
  }

  /**
   * Parse JSON data into searchable chunks
   */
  parseDataIntoChunks(data, parentKey = '', section = 'general') {
    const chunks = [];
    // CRITICAL FIX: Use a unique counter that increments for EVERY chunk to prevent ID collisions
    let uniqueCounter = 0;
    
    const extractKeywords = (text, metadata = {}) => {
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been'
      ]);
      
      const keywords = [];
      
      // 1. PRESERVE ACRONYMS EXPLICITLY (2-5 uppercase letters, possibly with hyphens)
      const acronyms = text.match(/\b[A-Z]{2,5}\b/g) || [];
      const acronymsWithHyphen = text.match(/\b[A-Z]+-[A-Z]+\b/g) || []; // For IP-TBM, etc.
      keywords.push(...acronyms.map(a => a.toLowerCase()));
      keywords.push(...acronymsWithHyphen.map(a => a.toLowerCase()));
      
      // 2. EXTRACT IMPORTANT FIELD VALUES FROM METADATA
      if (metadata.acronym) {
        keywords.push(metadata.acronym.toLowerCase());
      }
      if (metadata.fullName) {
        // Extract important words from full name (3+ chars)
        const nameWords = metadata.fullName.match(/\b[A-Za-z]{3,}\b/g) || [];
        keywords.push(...nameWords.map(w => w.toLowerCase()));
      }
      if (metadata.head) {
        // Extract name parts (proper nouns)
        const nameParts = metadata.head.match(/\b[A-Z][a-z]+\b/g) || [];
        keywords.push(...nameParts.map(n => n.toLowerCase()));
      }
      if (metadata.title) {
        const titleWords = metadata.title.match(/\b[A-Za-z]{3,}\b/g) || [];
        keywords.push(...titleWords.map(w => w.toLowerCase()));
      }
      
      // 3. EXTRACT NUMBERS (for statistics queries like "2024", "17251")
      const numbers = text.match(/\b\d+\b/g) || [];
      keywords.push(...numbers);
      
      // 3a. EXTRACT AND NORMALIZE DATES (for history queries - convert ISO dates to natural language)
      // Extract ISO dates (YYYY-MM-DD) and add both ISO and natural language versions
      const isoDatePattern = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
      let dateMatch;
      while ((dateMatch = isoDatePattern.exec(text)) !== null) {
        const year = dateMatch[1];
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthName = monthNames[month - 1];
        // Add both ISO format and natural language format as keywords
        keywords.push(`${year}-${dateMatch[2]}-${dateMatch[3]}`); // ISO format
        keywords.push(`${monthName} ${day}, ${year}`); // Natural language format
        keywords.push(`${monthName} ${day}`); // Month and day
        keywords.push(year); // Year only
      }
      
      // Extract dates from metadata if present
      if (metadata.date) {
        const dateStr = String(metadata.date);
        // If it's an ISO date, add natural language version
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          const year = isoMatch[1];
          const month = parseInt(isoMatch[2], 10);
          const day = parseInt(isoMatch[3], 10);
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                            'july', 'august', 'september', 'october', 'november', 'december'];
          const monthName = monthNames[month - 1];
          keywords.push(`${monthName} ${day}, ${year}`);
          keywords.push(`${monthName} ${day}`);
          keywords.push(year);
        }
        keywords.push(dateStr); // Also add original date format
      }
      
      // 4. EXTRACT KEY STATISTIC TERMS
      if (metadata.year) keywords.push(String(metadata.year), 'year');
      if (metadata.numberOfApplicants) keywords.push(String(metadata.numberOfApplicants), 'applicants');
      if (metadata.numberOfPassers) keywords.push(String(metadata.numberOfPassers), 'passers');
      if (metadata.students) keywords.push(String(metadata.students), 'students', 'enrollment');
      if (metadata.campus) keywords.push(metadata.campus.toLowerCase());
      
      // 5. STANDARD KEYWORD EXTRACTION (allow 2+ char words for acronyms)
      const words = text.toLowerCase()
        .replace(/[^\w\s-]/g, ' ')  // Preserve hyphens
        .split(/\s+/)
        .filter(word => word.length >= 2 && !stopWords.has(word)); // Changed from > 3 to >= 2
      
      const freq = {};
      words.forEach(word => {
        freq[word] = (freq[word] || 0) + 1;
      });
      
      // 6. INCREASE KEYWORD LIMIT for structured data
      const maxKeywords = metadata.acronym || metadata.year ? 25 : 15; // More for offices/stats
      
      // Sort by frequency and take top keywords
      const topWords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);
      
      keywords.push(...topWords);
      
      // 5. REMOVE DUPLICATES and return
      return [...new Set(keywords)];
    };
    
    // Convert object/array to readable text format (IMPROVED: Natural language format)
    const objectToText = (obj, prefix = '', returnMetadata = false) => {
      // SPECIAL HANDLING FOR OFFICE OBJECTS - Create natural language format
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        // Detect office/organizational structure
        if (obj.acronym && obj.fullName) {
          let naturalText = `${obj.acronym} (${obj.fullName}).`;
          
          // Add head information if present
          if (obj.head) {
            naturalText += ` Head: ${obj.head}.`;
          }
          
          // Add contact information if present
          if (obj.email) {
            naturalText += ` Email: ${obj.email}.`;
          }
          if (obj.phone) {
            naturalText += ` Phone: ${obj.phone}.`;
          }
          
          // Add location if present
          if (obj.location) {
            naturalText += ` Location: ${obj.location}.`;
          }
          
          // Add website/social media links if present
          if (obj.website) {
            naturalText += ` Website: ${obj.website}.`;
          }
          if (obj.link) {
            naturalText += ` Link: ${obj.link}.`;
          }
          if (obj.facebook || obj.socialMedia?.facebook) {
            const fbLink = obj.facebook || obj.socialMedia.facebook;
            naturalText += ` Facebook: ${fbLink}.`;
          }
          
          // Add description/services if present
          if (obj.description) {
            naturalText += ` ${obj.description}`;
          }
          if (obj.services) {
            naturalText += ` Services: ${Array.isArray(obj.services) ? obj.services.join(', ') : obj.services}.`;
          }
          
          // Return both text and metadata for better chunk creation
          if (returnMetadata) {
            return {
              text: naturalText,
              metadata: {
                acronym: obj.acronym,
                fullName: obj.fullName,
                head: obj.head,
                email: obj.email,
                phone: obj.phone,
                location: obj.location,
                website: obj.website || obj.link,
                facebook: obj.facebook || obj.socialMedia?.facebook
              }
            };
          }
          
          return naturalText;
        }
        
        // CRITICAL FIX: Detect person/leadership objects with comprehensive information
        if ((obj.name || obj.fullName) && (obj.position || obj.title || obj.role)) {
          const name = obj.name || obj.fullName;
          const position = obj.position || obj.title || obj.role;
          let naturalText = `${name}, ${position}.`;
          
          // Add additional details
          if (obj.department) {
            naturalText += ` Department: ${obj.department}.`;
          }
          if (obj.faculty) {
            naturalText += ` Faculty: ${obj.faculty}.`;
          }
          if (obj.campus) {
            naturalText += ` Campus: ${obj.campus}.`;
          }
          if (obj.email) {
            naturalText += ` Email: ${obj.email}.`;
          }
          
          // CRITICAL: Add education information (for president and other leaders)
          if (obj.education) {
            if (obj.education.institution) {
              naturalText += ` Education: ${obj.education.institution}.`;
            }
            if (obj.education.degrees && Array.isArray(obj.education.degrees)) {
              const degreesText = obj.education.degrees.map(deg => {
                let degText = deg.degree || '';
                if (deg.honor) degText += ` (${deg.honor})`;
                if (deg.scholarship) degText += `, ${deg.scholarship}`;
                return degText;
              }).join('; ');
              if (degreesText) {
                naturalText += ` Degrees: ${degreesText}.`;
              }
            }
          }
          
          // CRITICAL: Add expertise areas
          if (obj.expertise && Array.isArray(obj.expertise) && obj.expertise.length > 0) {
            naturalText += ` Expertise: ${obj.expertise.join(', ')}.`;
          }
          
          // CRITICAL: Add achievements
          if (obj.achievements && Array.isArray(obj.achievements) && obj.achievements.length > 0) {
            naturalText += ` Achievements: ${obj.achievements.join('. ')}.`;
          }
          
          // CRITICAL: Add current role
          if (obj.currentRole) {
            naturalText += ` Current Role: ${obj.currentRole}.`;
          }
          
          if (returnMetadata) {
            return {
              text: naturalText,
              metadata: {
                name: name,
                position: position,
                department: obj.department,
                faculty: obj.faculty,
                email: obj.email,
                education: obj.education,
                expertise: obj.expertise,
                achievements: obj.achievements,
                currentRole: obj.currentRole
              }
            };
          }
          
          return naturalText;
        }
        
        // Detect statistics objects (year-based, campus-based, etc.)
        if (obj.year || obj.numberOfApplicants || obj.numberOfPassers || obj.passingRate || obj.students) {
          let naturalText = '';
          
          if (obj.year) {
            naturalText += `Year ${obj.year}: `;
          }
          if (obj.campus) {
            naturalText += `${obj.campus}: `;
          }
          
          // Add statistics in natural language
          const stats = [];
          if (obj.numberOfApplicants) stats.push(`${obj.numberOfApplicants} applicants`);
          if (obj.numberOfPassers) stats.push(`${obj.numberOfPassers} passers`);
          if (obj.passingRate) stats.push(`${obj.passingRate} passing rate`);
          if (obj.numberOfEnrolledApplicants) stats.push(`${obj.numberOfEnrolledApplicants} enrolled`);
          if (obj.students) stats.push(`${obj.students} students`);
          
          naturalText += stats.join(', ') + '.';
          
          if (returnMetadata) {
            return {
              text: naturalText,
              metadata: obj // Preserve all stats fields
            };
          }
          
          return naturalText;
        }
        
        // SPECIAL HANDLING FOR HISTORY-RELATED NESTED OBJECTS
        // Process conversionProcess, heritage, charterMandates, etc. comprehensively
        if (obj.description || obj.keyLeaders || obj.stakeholders || obj.complianceAreas || 
            obj.sites || obj.name || obj.designation || obj.significance) {
          let naturalText = '';
          
          // Handle conversionProcess structure
          if (obj.description) {
            naturalText += obj.description + '. ';
          }
          if (obj.keyLeaders && Array.isArray(obj.keyLeaders)) {
            naturalText += 'Key leaders: ' + obj.keyLeaders.map(leader => {
              if (typeof leader === 'object' && leader.name && leader.role) {
                return `${leader.name} (${leader.role})`;
              }
              return String(leader);
            }).join(', ') + '. ';
          }
          if (obj.stakeholders && Array.isArray(obj.stakeholders)) {
            naturalText += 'Stakeholders: ' + obj.stakeholders.join(', ') + '. ';
          }
          if (obj.complianceAreas && Array.isArray(obj.complianceAreas)) {
            naturalText += 'Compliance areas: ' + obj.complianceAreas.join(', ') + '. ';
          }
          
          // Handle heritage structure
          if (obj.sites && Array.isArray(obj.sites)) {
            obj.sites.forEach(site => {
              if (typeof site === 'object') {
                naturalText += `${site.name || 'Site'}`;
                if (site.designation) naturalText += ` (${site.designation})`;
                if (site.significance) naturalText += `: ${site.significance}`;
                naturalText += '. ';
              }
            });
          }
          if (obj.name && obj.designation && obj.significance) {
            naturalText += `${obj.name} (${obj.designation}): ${obj.significance}. `;
          }
          
          // Handle charterMandates array
          if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'string') {
            naturalText = 'Charter mandates: ' + obj.join(', ') + '. ';
          }
          
          if (naturalText.trim()) {
            if (returnMetadata) {
              return {
                text: naturalText.trim(),
                metadata: obj
              };
            }
            return naturalText.trim();
          }
        }
        
        // FALLBACK: Convert keys to natural language (with recursive handling for nested objects)
        const entries = Object.entries(obj)
          .map(([key, value]) => {
            // Handle nested objects/arrays recursively
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              const nestedText = objectToText(value, `${prefix}.${key}`, false);
              if (nestedText && nestedText !== String(value)) {
                const naturalKey = key
                  .replace(/([A-Z])/g, ' $1')
                  .trim()
                  .toLowerCase()
                  .replace(/_/g, ' ');
                return `${naturalKey}: ${nestedText}`;
              }
              return null;
            }
            
            if (Array.isArray(value) && value.length > 0) {
              const naturalKey = key
                .replace(/([A-Z])/g, ' $1')
                .trim()
                .toLowerCase()
                .replace(/_/g, ' ');
              const arrayText = value.map(item => {
                if (typeof item === 'object' && item !== null) {
                  return objectToText(item, '', false);
                }
                return String(item);
              }).join(', ');
              return `${naturalKey}: ${arrayText}`;
            }
            
            // Convert camelCase to natural language
            const naturalKey = key
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .toLowerCase()
              .replace(/_/g, ' ');
            
            return `${naturalKey}: ${String(value)}`;
          })
          .filter(entry => entry !== null)
          .join('. ');
        
        if (returnMetadata) {
          return {
            text: entries,
            metadata: obj
          };
        }
        
        return entries;
      }
      
      // HANDLE ARRAYS
      if (Array.isArray(obj)) {
        return obj.map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            return objectToText(item, `${prefix}[${index}]`, returnMetadata);
          }
          return String(item);
        }).join('\n');
      }
      
      // PRIMITIVE VALUES
      return String(obj);
    };
    
    const processValue = (value, key, currentSection) => {
      if (typeof value === 'string' && value.length > 20) {
        // FIX: Split VERY LONG texts (like history narrative) into smaller searchable chunks
        if (value.length > 1500) {
          // Split by sentences (periods followed by space and capital letter)
          const sentences = value.match(/[^.!?]+[.!?]+/g) || [value];
          const chunkSize = 3; // Group 3 sentences per chunk for context
          
          for (let i = 0; i < sentences.length; i += chunkSize) {
            const chunkText = sentences.slice(i, i + chunkSize).join(' ').trim();
              if (chunkText.length > 50) { // Only create chunk if meaningful
                chunks.push({
                  id: `${currentSection}_${key}_part${i}_${Date.now()}_${uniqueCounter++}`,
                content: chunkText,
                section: currentSection,
                type: 'text_chunk',
                category: currentSection,
                keywords: extractKeywords(chunkText),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  partNumber: Math.floor(i / chunkSize) + 1,
                  updated_at: new Date()
                }
              });
            }
          }
        } else {
            // Normal text processing
            chunks.push({
              id: `${currentSection}_${key}_${Date.now()}_${uniqueCounter++}`,
            content: value,
            section: currentSection,
            type: 'text',
            category: currentSection,
            keywords: extractKeywords(value),
            metadata: {
              source: 'dorsu_data.json',
              field: key,
              updated_at: new Date()
            }
          });
        }
      } else if (Array.isArray(value)) {
        // Special handling for structured arrays (like vicePresidents, deans, offices, etc.)
        // Group related items together to prevent fragmentation
        const isStructuredArray = value.length > 0 && 
          typeof value[0] === 'object' && 
          value[0] !== null &&
          (key.includes('vicePresidents') || key.includes('deans') || 
           key.includes('directors') || key.includes('chancellor') ||
           key.includes('executives') || key.includes('boardOfRegents'));
        
        // Special handling for offices arrays - process individually for better searchability
        const isOfficeArray = key.includes('offices') || key.includes('Office') || 
                              (value.length > 0 && value[0].acronym && value[0].fullName);
        
        // Special handling for leadership arrays - process individually for better searchability
        const isLeadershipArray = key.includes('vicePresidents') || key.includes('deans') || 
                                   key.includes('directors') || key.includes('chancellor') ||
                                   key.includes('boardOfRegents') || key.includes('executives') ||
                                   (value.length > 0 && value[0].position && value[0].name);
        
        // Special handling for statistics arrays - process individually by year/category
        const isStatisticsArray = key.includes('statistics') || key.includes('Statistics') ||
                                   key.includes('enrollment') || key.includes('Enrollment') ||
                                   (value.length > 0 && typeof value[0] === 'object' && 
                                    (value[0].year || value[0].campus || value[0].semester));
        
        // Special handling for timeline/history events - process individually by date/event
        const isTimelineArray = key.includes('timeline') || key.includes('Timeline') ||
                                 (value.length > 0 && typeof value[0] === 'object' && 
                                  (value[0].date || value[0].event));
        
        // Special handling for services arrays - process individually
        const isServicesArray = key.includes('servicesOffered') || key.includes('services') ||
                                 (value.length > 0 && typeof value[0] === 'object' && 
                                  (value[0].service || value[0].name) && value[0].description);
        
        // Special handling for faculties array - process individually
        const isFacultiesArray = key === 'faculties' ||
                                  (value.length > 0 && typeof value[0] === 'object' && 
                                   value[0].code && value[0].name && 
                                   (value[0].code.startsWith('F') || value[0].name.includes('Faculty')));
        
        if (isOfficeArray) {
          // Process each office individually with enhanced metadata
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              const result = objectToText(item, '', true);
              
              // Determine office type from key or section
              let officeType = 'office_info';
              if (key.includes('studentServices')) officeType = 'student_services_office';
              if (key.includes('administrative')) officeType = 'administrative_office';
              if (key.includes('academic')) officeType = 'academic_office';
              
              chunks.push({
                id: `${currentSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                content: result.text,
                text: result.text, // Duplicate for compatibility
                section: currentSection,
                type: officeType,
                category: item.acronym || currentSection, // Use acronym as category for better filtering
                keywords: extractKeywords(result.text, result.metadata),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  ...result.metadata, // Preserve structured metadata (acronym, head, etc.)
                  updated_at: new Date()
                }
              });
            }
          });
        } else if (isLeadershipArray) {
          // FIX: Process each leadership position individually for better searchability
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              const result = objectToText(item, '', true);
              
              // Determine leadership type from key
              let leadershipType = 'leadership_position';
              if (key.includes('vicePresident')) leadershipType = 'vice_president';
              if (key.includes('dean')) leadershipType = 'dean';
              if (key.includes('director')) leadershipType = 'director';
              if (key.includes('chancellor')) leadershipType = 'chancellor';
              
              chunks.push({
                id: `${currentSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                content: result.text,
                text: result.text,
                section: currentSection,
                type: leadershipType,
                category: item.position || currentSection, // Use position as category
                keywords: extractKeywords(result.text, result.metadata),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  ...result.metadata, // Preserve position, name, etc.
                  updated_at: new Date()
                }
              });
            }
          });
        } else if (isStatisticsArray) {
          // FIX: Process each statistics entry individually for year/campus-specific queries
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              const result = objectToText(item, '', true);
              
              // Determine statistics type and category
              let statsType = 'statistics';
              let category = currentSection;
              
              if (item.year) {
                statsType = 'yearly_statistics';
                category = `year_${item.year}`;
              } else if (item.campus) {
                statsType = 'campus_statistics';
                category = item.campus.toLowerCase().replace(/\s+/g, '_');
              } else if (item.semester) {
                statsType = 'semester_statistics';
                category = `semester_${item.semester}`;
              }
              
              chunks.push({
                id: `${currentSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                content: result.text,
                text: result.text,
                section: currentSection,
                type: statsType,
                category: category,
                keywords: extractKeywords(result.text, result.metadata),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  ...result.metadata, // Preserve year, numbers, etc.
                  updated_at: new Date()
                }
              });
            }
          });
        } else if (isTimelineArray) {
          // FIX: Process each timeline/history event individually for date-specific queries
          // CRITICAL FIX: Use 'history' section if key is 'timeline' (always part of history)
          const timelineSection = (key === 'timeline' || currentSection === 'history') ? 'history' : currentSection;
          
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              // Create natural language description with ALL available fields
              let naturalText = '';
              
              // CRITICAL: Convert ISO dates to natural language for better readability and AI recognition
              if (item.date) {
                const dateStr = String(item.date);
                // Check if it's an ISO date (YYYY-MM-DD or YYYY-MM)
                const isoMatch = dateStr.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
                if (isoMatch) {
                  const year = isoMatch[1];
                  const month = parseInt(isoMatch[2], 10);
                  const day = isoMatch[3] ? parseInt(isoMatch[3], 10) : null;
                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                    'July', 'August', 'September', 'October', 'November', 'December'];
                  const monthName = monthNames[month - 1];
                  // Include natural language date for better AI recognition
                  if (day) {
                    naturalText += `${monthName} ${day}, ${year} (${dateStr}): `;
                  } else {
                    naturalText += `${monthName} ${year} (${dateStr}): `;
                  }
                } else {
                  naturalText += `${item.date}: `;
                }
              }
              
              if (item.event) naturalText += `${item.event}. `;
              if (item.details) naturalText += `${item.details}. `;
              if (item.significance) naturalText += `${item.significance}. `;
              if (item.keyPerson) naturalText += `Key person: ${item.keyPerson}. `;
              if (item.legalBasis) naturalText += `Legal basis: ${item.legalBasis}. `;
              if (item.signedBy) naturalText += `Signed by: ${item.signedBy}. `;
              if (item.houseBill) naturalText += `House Bill: ${item.houseBill}. `;
              if (item.senateBill) naturalText += `Senate Bill: ${item.senateBill}. `;
              if (item.donor) naturalText += `Donor: ${item.donor}. `;
              
              chunks.push({
                id: `${timelineSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                content: naturalText.trim(),
                text: naturalText.trim(),
                section: timelineSection, // CRITICAL FIX: Use 'history' section for timeline events
                type: 'timeline_event',
                category: item.date || 'historical_event',
                keywords: extractKeywords(naturalText, { date: item.date, event: item.event }),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  section: timelineSection,
                  index: index,
                  date: item.date,
                  event: item.event,
                  keyPerson: item.keyPerson,
                  legalBasis: item.legalBasis,
                  signedBy: item.signedBy,
                  houseBill: item.houseBill,
                  senateBill: item.senateBill,
                  donor: item.donor,
                  updated_at: new Date()
                }
              });
            }
          });
        } else if (isServicesArray) {
          // FIX: Process each service individually for service-specific queries
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              const serviceName = item.service || item.name || 'Service';
              const description = item.description || '';
              const naturalText = `${serviceName}: ${description}`;
              
              chunks.push({
                id: `${currentSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                content: naturalText,
                text: naturalText,
                section: currentSection,
                type: 'service_offering',
                category: serviceName.toLowerCase().replace(/\s+/g, '_'),
                keywords: extractKeywords(naturalText, { service: serviceName }),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  serviceName: serviceName,
                  updated_at: new Date()
                }
              });
            }
          });
        } else if (isFacultiesArray) {
          // FIX: Process each faculty individually for faculty-specific queries
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              const facultyCode = item.code || '';
              const facultyName = item.name || 'Faculty';
              const naturalText = `${facultyCode} - ${facultyName}.`;
              
              chunks.push({
                id: `${currentSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                content: naturalText,
                text: naturalText,
                section: currentSection,
                type: 'faculty',
                category: facultyCode.toLowerCase(),
                keywords: extractKeywords(naturalText, { facultyCode: facultyCode, facultyName: facultyName }),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  facultyCode: facultyCode,
                  facultyName: facultyName,
                  updated_at: new Date()
                }
              });
            }
          });
        } else if (isStructuredArray) {
          // Create a single chunk for the entire array using natural language format
          const arrayText = value.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
              return objectToText(item);
            }
            return String(item);
          }).join(' ');
          
          chunks.push({
            id: `${currentSection}_${key}_${Date.now()}_${uniqueCounter++}`,
            content: arrayText,
            section: currentSection,
            type: 'structured_list',
            category: currentSection,
            keywords: extractKeywords(arrayText),
            metadata: {
              source: 'dorsu_data.json',
              field: key,
              itemCount: value.length,
              updated_at: new Date()
            }
          });
        } else {
          // For non-structured arrays, process items individually
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              processObject(item, `${key}[${index}]`, currentSection);
              } else if (typeof item === 'string' && item.length > 20) {
                chunks.push({
                  id: `${currentSection}_${key}_${index}_${Date.now()}_${uniqueCounter++}`,
                  content: item,
                  section: currentSection,
                  type: 'list_item',
                category: currentSection,
                keywords: extractKeywords(item),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  index: index,
                  updated_at: new Date()
                }
              });
            }
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        processObject(value, key, currentSection);
      }
    };
    
    const processObject = (obj, prefix, currentSection) => {
      // CRITICAL FIX: Determine section early if this is a top-level section key
      let effectiveSection = currentSection;
      if (prefix === '' || !prefix.includes('.')) {
        // Top-level key - check if it's a section key
        const topLevelKeys = Object.keys(obj);
        const sectionKey = topLevelKeys.find(k => 
          ['history', 'leadership', 'programs', 'faculties', 'enrollment', 
           'visionMission', 'mandate', 'qualityPolicy', 'studentOrganizations',
           'annualAccomplishmentReports', 'studentResources', 'offices',
           'detailedOfficeServices', 'additionalOfficesAndCenters',
           'organizationalStructure/DOrSUOfficials2025', 'importantLinks'].includes(k)
        );
        if (sectionKey) {
          effectiveSection = sectionKey;
        }
      }
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        let newSection = effectiveSection;
        if (['history', 'leadership', 'programs', 'faculties', 'enrollment', 
             'visionMission', 'mandate', 'qualityPolicy', 'studentOrganizations',
             'annualAccomplishmentReports', 'studentResources', 'offices',
             'detailedOfficeServices', 'additionalOfficesAndCenters',
             'organizationalStructure/DOrSUOfficials2025', 'importantLinks'].includes(key)) {
          newSection = key;
        }
        
        // CRITICAL FIX: For history object, use 'history' section for all nested items
        if (key === 'history' || prefix === 'history' || prefix.includes('history')) {
          newSection = 'history';
        }
        
        // CRITICAL FIX: Special handling for leadership.president object - must include ALL details
        if (newSection === 'leadership' && key === 'president' && typeof value === 'object' && value !== null) {
          // Process president object with comprehensive information
          const result = objectToText(value, '', true);
          const text = result.text || result;
          const metadata = result.metadata || {};
          
          if (text && text.length > 20) {
            chunks.push({
              id: `${newSection}_${key}_${Date.now()}_${uniqueCounter++}`,
              content: text,
              text: text,
              section: newSection,
              type: 'president',
              category: 'president',
              keywords: extractKeywords(text, metadata),
              metadata: {
                source: 'dorsu_data.json',
                field: key,
                section: newSection,
                name: value.name,
                title: value.title,
                ...metadata, // Include education, expertise, achievements, currentRole
                updated_at: new Date()
              }
            });
            continue; // Skip recursive processing - we've handled it comprehensively
          }
        }
        
        // SPECIAL HANDLING: History-related nested objects - create comprehensive chunks
        if (newSection === 'history' && typeof value === 'object' && value !== null) {
          // Handle conversionProcess, heritage, narrative, currentMission (objects)
          if (['conversionProcess', 'heritage', 'narrative', 'currentMission'].includes(key) && !Array.isArray(value)) {
            const result = objectToText(value, '', true);
            const text = result.text || result;
            const metadata = result.metadata || {};
            
            if (text && text.length > 20) {
              chunks.push({
                id: `${newSection}_${key}_${Date.now()}_${uniqueCounter++}`,
                content: text,
                text: text,
                section: newSection,
                type: key === 'narrative' ? 'history_narrative' : key === 'heritage' ? 'heritage_info' : key === 'conversionProcess' ? 'conversion_process' : 'current_mission',
                category: key,
                keywords: extractKeywords(text, metadata),
                metadata: {
                  source: 'dorsu_data.json',
                  field: key,
                  section: newSection,
                  ...metadata,
                  updated_at: new Date()
                }
              });
              continue; // Skip recursive processing
            }
          }
          
          // Handle charterMandates (array of strings)
          if (key === 'charterMandates' && Array.isArray(value) && value.length > 0) {
            const mandatesText = 'Charter Mandates: ' + value.join(', ') + '.';
            chunks.push({
              id: `${newSection}_${key}_${Date.now()}_${uniqueCounter++}`,
              content: mandatesText,
              text: mandatesText,
              section: newSection,
              type: 'charter_mandates',
              category: 'charterMandates',
              keywords: extractKeywords(mandatesText, { mandates: value }),
              metadata: {
                source: 'dorsu_data.json',
                field: key,
                section: newSection,
                mandateCount: value.length,
                updated_at: new Date()
              }
            });
            continue; // Skip recursive processing
          }
        }
        
        // SPECIAL HANDLING: Important Links section - create a comprehensive chunk with all links
        if (key === 'importantLinks' && typeof value === 'object' && value !== null) {
          let linksText = 'DOrSU Important Links and Resources. ';
          
          if (value.officialWebsite) {
            linksText += `Official Website: ${value.officialWebsite}. `;
          }
          if (value.locationMap) {
            linksText += `Location Map: ${value.locationMap}. `;
          }
          if (value.universitySeal) {
            linksText += `University Seal: ${value.universitySeal}. `;
          }
          if (value.universityHymn) {
            linksText += `University Hymn: ${value.universityHymn}. `;
          }
          
          // Add office-specific links
          if (value.offices && typeof value.offices === 'object') {
            for (const [officeAcronym, officeLink] of Object.entries(value.offices)) {
              if (typeof officeLink === 'string') {
                linksText += `${officeAcronym} Website: ${officeLink}. `;
              } else if (typeof officeLink === 'object') {
                if (officeLink.website) {
                  linksText += `${officeAcronym} Website: ${officeLink.website}. `;
                }
                if (officeLink.facebook) {
                  linksText += `${officeAcronym} Facebook: ${officeLink.facebook}. `;
                }
              }
            }
          }
          
          chunks.push({
            id: `important_links_${Date.now()}_${uniqueCounter++}`,
            content: linksText.trim(),
            text: linksText.trim(),
            section: 'importantLinks',
            type: 'important_links',
            category: 'website_resources',
            keywords: extractKeywords(linksText, { 
              officialWebsite: value.officialWebsite,
              type: 'links'
            }),
            metadata: {
              source: 'dorsu_data.json',
              field: 'importantLinks',
              officialWebsite: value.officialWebsite,
              ...value, // Preserve all link data
              updated_at: new Date()
            }
          });
          
          // Skip normal processing for this section since we handled it specially
          continue;
        }
        
        // SPECIAL HANDLING: Admission/Enrollment Requirements arrays
        // Handle requirements arrays in admissionEnrollmentRequirements2025 structure
        // E.g., admissionEnrollmentRequirements2025.returningStudents.requirements
        if (key === 'requirements' && Array.isArray(value) && value.length > 0) {
          // Check if we're in the admission requirements context
          const isAdmissionRequirements = prefix.includes('admissionEnrollmentRequirements2025') || 
                                          fullKey.includes('admissionEnrollmentRequirements2025') ||
                                          newSection === 'visionMission';
          
          if (isAdmissionRequirements) {
            // Extract student category from parent key (e.g., "returningStudents" from "admissionEnrollmentRequirements2025.returningStudents.requirements")
            const keyParts = fullKey.split('.');
            let studentCategory = '';
            let categoryName = '';
            
            // Find the student category in the key path
            for (let i = 0; i < keyParts.length; i++) {
              const part = keyParts[i];
              if (part === 'returningStudents' || part === 'continuingStudents' || 
                  part === 'transferringStudents' || part === 'secondDegreeStudents' || 
                  part === 'incomingFirstYearStudents') {
                studentCategory = part;
                break;
              }
            }
            
            // Get the category name from the parent object (obj is the parent object in the loop)
            if (typeof obj === 'object' && obj !== null) {
              // The parent object should have a category field if we're processing a student type object
              if (obj.category) {
                categoryName = obj.category;
              }
              
              // If we didn't find studentCategory from the key path, try to infer from prefix
              if (!studentCategory) {
                if (prefix.includes('returningStudents')) studentCategory = 'returningStudents';
                else if (prefix.includes('continuingStudents')) studentCategory = 'continuingStudents';
                else if (prefix.includes('transferringStudents')) studentCategory = 'transferringStudents';
                else if (prefix.includes('secondDegreeStudents')) studentCategory = 'secondDegreeStudents';
                else if (prefix.includes('incomingFirstYearStudents')) studentCategory = 'incomingFirstYearStudents';
              }
            }
            
            // Create a comprehensive chunk with category and all requirements
            const requirementsText = categoryName 
              ? `${categoryName}. Requirements: ${value.map((req, idx) => `${idx + 1}. ${req}`).join(' ')}`
              : `Admission Requirements: ${value.map((req, idx) => `${idx + 1}. ${req}`).join(' ')}`;
            
            chunks.push({
              id: `${newSection}_admissionRequirements_${studentCategory || 'general'}_${Date.now()}_${uniqueCounter++}`,
              content: requirementsText,
              text: requirementsText,
              section: newSection,
              type: 'admission_requirements',
              category: studentCategory || 'admission_requirements',
              keywords: extractKeywords(requirementsText, { 
                studentCategory: studentCategory,
                categoryName: categoryName,
                requirements: value
              }),
              metadata: {
                source: 'dorsu_data.json',
                field: fullKey,
                section: newSection,
                studentCategory: studentCategory,
                categoryName: categoryName,
                requirementCount: value.length,
                requirements: value,
                updated_at: new Date()
              }
            });
            
            // Skip processing the array normally - we've already handled it
            continue;
          }
        }
        
        // FIX: Special handling for nested programs under faculties
        // E.g., programs.FACET.programs[...] or programs.FALS.programs[...]
        if (currentSection === 'programs' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // This is a faculty object (e.g., FACET, FALS) containing a programs array
          if (value.programs && Array.isArray(value.programs)) {
            const facultyName = value.faculty || key;
            const facultyCode = key; // FACET, FALS, etc.
            
            // Process each program individually
            value.programs.forEach((program, index) => {
              if (typeof program === 'object' && program !== null) {
                const programName = program.name || 'Unnamed Program';
                const programCode = program.code || '';
                const accreditation = program.accreditation || 'N/A';
                
                const naturalText = `${programCode} - ${programName}. Faculty: ${facultyName}. Accreditation: ${accreditation}.`;
                
                  chunks.push({
                    id: `programs_${facultyCode}_${index}_${Date.now()}_${uniqueCounter++}`,
                    content: naturalText,
                    text: naturalText,
                    section: 'programs',
                    type: 'academic_program',
                  category: facultyCode.toLowerCase(),
                  keywords: extractKeywords(naturalText, { 
                    programCode: programCode, 
                    programName: programName,
                    facultyCode: facultyCode,
                    accreditation: accreditation
                  }),
                  metadata: {
                    source: 'dorsu_data.json',
                    field: `programs.${facultyCode}`,
                    index: index,
                    programCode: programCode,
                    programName: programName,
                    facultyName: facultyName,
                    facultyCode: facultyCode,
                    accreditation: accreditation,
                    updated_at: new Date()
                  }
                });
              }
            });
            
            // Skip normal processing for this faculty object since we handled programs
            continue;
          }
        }
        
        processValue(value, fullKey, newSection);
      }
    };
    
    if (typeof data === 'object' && data !== null) {
      processObject(data, parentKey, section);
    }
    
    return chunks;
  }

  /**
   * Check if data file has been modified
   */
  hasDataChanged() {
    try {
      const stats = fs.statSync(this.dataFilePath);
      const currentModified = stats.mtime.getTime();
      
      if (this.lastModified === null) {
        this.lastModified = currentModified;
        return false;
      }
      
      if (currentModified > this.lastModified) {
        this.lastModified = currentModified;
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('Error checking data file:', error);
      return false;
    }
  }

  /**
   * Refresh knowledge base from dorsu_data.json
   */
  async refreshFromDataFile() {
    if (this.isRefreshing) {
      Logger.warn('Refresh already in progress, skipping...');
      return { success: false, message: 'Refresh already in progress' };
    }

    try {
      this.isRefreshing = true;
      Logger.info('🔄 Starting knowledge base refresh...');

      const mongoService = getMongoDBService();
      const embeddingService = getEmbeddingService();

      // Ensure services are initialized
      if (!mongoService.isConnected) {
        await mongoService.connect();
      }
      if (!embeddingService.isLoaded) {
        await embeddingService.initialize();
      }

      // Load data file
      const rawData = fs.readFileSync(this.dataFilePath, 'utf8');
      const data = JSON.parse(rawData);
      Logger.info('📄 Loaded dorsu_data.json');

      // Parse into chunks
      const chunks = this.parseDataIntoChunks(data);
      Logger.info(`🔨 Generated ${chunks.length} chunks`);

      // Generate embeddings
      Logger.info('🤖 Generating embeddings...');
      const chunksWithEmbeddings = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const textToEmbed = `${chunk.content} ${chunk.keywords.join(' ')}`.trim();
        const embedding = await embeddingService.embedText(textToEmbed);
        
        chunksWithEmbeddings.push({
          ...chunk,
          embedding,
          text: chunk.content
        });

        if ((i + 1) % 50 === 0) {
          Logger.info(`   Progress: ${i + 1}/${chunks.length}`);
        }
      }
      
      Logger.success(`✅ Generated ${chunksWithEmbeddings.length} embeddings`);

      // CRITICAL FIX: Clear old chunks BEFORE generating new ones to ensure clean refresh
      const collection = mongoService.getCollection('knowledge_chunks');
      const deleteResult = await collection.deleteMany({ 
        'metadata.source': 'dorsu_data.json' 
      });
      Logger.info(`🗑️  Removed ${deleteResult.deletedCount} old chunks from dorsu_data.json`);

      // Insert new chunks (using upsert to handle any edge cases)
      const insertResult = await mongoService.insertChunks(chunksWithEmbeddings);
      const totalChunks = await collection.countDocuments();
      
      Logger.success(`✅ Refreshed knowledge base successfully!`);
      Logger.info(`   📊 Generated: ${chunks.length} chunks`);
      Logger.info(`   📥 Inserted: ${insertResult.upsertedCount} new chunks`);
      Logger.info(`   🔄 Updated: ${insertResult.modifiedCount} existing chunks`);
      Logger.info(`   📦 Total in database: ${totalChunks} chunks`);
      
      // Verify all chunks were processed
      if (insertResult.upsertedCount + insertResult.modifiedCount < chunks.length) {
        Logger.warn(`⚠️  Warning: Not all chunks were processed. Expected ${chunks.length}, got ${insertResult.upsertedCount + insertResult.modifiedCount}`);
      }

      this.lastRefresh = new Date();
      this.isRefreshing = false;
      
      // NOTE: RAG service will sync automatically via 30-second interval
      // For immediate sync, call ragService.forceSyncMongoDB() after refresh
      Logger.info('💡 RAG service will sync automatically within 30 seconds');
      Logger.info('   For immediate sync, use the /api/refresh-knowledge endpoint or call forceSyncMongoDB()');

      return {
        success: true,
        message: 'Knowledge base refreshed successfully',
        oldChunksRemoved: deleteResult.deletedCount,
        newChunksAdded: insertResult.upsertedCount,
        updatedChunks: insertResult.modifiedCount,
        totalChunksGenerated: chunks.length,
        totalChunks: totalChunks,
        timestamp: this.lastRefresh
      };

    } catch (error) {
      this.isRefreshing = false;
      Logger.error('❌ Knowledge base refresh failed:', error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  /**
   * Auto-watch for file changes and refresh
   */
  startAutoRefresh(intervalMs = 60000) {
    Logger.info(`👀 Watching for changes in dorsu_data.json (checking every ${intervalMs/1000}s)`);
    
    setInterval(async () => {
      if (this.hasDataChanged()) {
        Logger.info('📝 Data file changed, triggering refresh...');
        await this.refreshFromDataFile();
      }
    }, intervalMs);
  }

  /**
   * Get refresh status
   */
  getStatus() {
    return {
      isRefreshing: this.isRefreshing,
      lastRefresh: this.lastRefresh,
      lastModified: this.lastModified ? new Date(this.lastModified) : null
    };
  }
}

// Singleton instance
let dataRefreshServiceInstance = null;

export function getDataRefreshService() {
  if (!dataRefreshServiceInstance) {
    dataRefreshServiceInstance = new DataRefreshService();
  }
  return dataRefreshServiceInstance;
}

export { DataRefreshService };

