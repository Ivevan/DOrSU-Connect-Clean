/**
 * AI Accuracy Benchmarking Script
 * Tests the DOrSU AI service accuracy using questions based on dorsu_data.json
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

/**
 * Generate test queries with ground truth data
 * 10 token-efficient questions covering key categories (same as benchmark-rag-pipeline.js)
 */
function generateTestQueries() {
  const queries = [];

  // 1. Programs - FALS (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "What programs are in FALS?",
    expectedKeywords: ["BSAM", "BSA", "BSBio", "BSES"],
    category: "programs",
    difficulty: "medium"
  });

  // 2. Enrollment - Main Campus (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Whatr are the total population of students in the main campus?",
    expectedKeywords: ["12009", "12,009"],
    category: "enrollment",
    difficulty: "medium"
  });

  // 3. Programs - FBM (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "What programs are in FBM?",
    expectedKeywords: ["BSBA", "BSHM"],
    category: "programs",
    difficulty: "medium"
  });

  // 4. History - San Isidro (TOKEN-EFFICIENT: Short, specific)
  // Note: Only checking date since question asks "when", not "who"
  queries.push({
    question: "When was San Isidro Campus established?",
    expectedKeywords: ["1997", "November"],
    category: "history",
    difficulty: "hard"
  });

  // 5. Leadership - VPs (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Who are the VPs of DOrSU?",
    expectedKeywords: ["VP for Administration and Finance", "VP for Research, Innovation, and Extension", "VP for Academic Affairs", "VP for Planning and Quality Assurance"],
    category: "leadership",
    difficulty: "hard"
  });

  // 6. Programs - FACET (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "What programs are in FACET?",
    expectedKeywords: ["BSIT", "BSCE", "BSMath", "BITM"],
    category: "programs",
    difficulty: "medium"
  });

  // 7. Admission Requirements (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Admission requirements for transferring students?",
    expectedKeywords: ["SUAST Examination Result", "Transcript of Record", "Certificate of Transfer Credential", "Good Moral Character", "PSA Birth Certificate"],
    category: "admission",
    difficulty: "medium"
  });

  // 8. Leadership - President (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Who is the president of DOrSU?",
    expectedKeywords: ["Dr. Roy G. Ponce", "Roy G. Ponce"],
    category: "leadership",
    difficulty: "easy"
  });

  // 9. Office Head - OSPAT (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Who is the head of OSPAT?",
    expectedKeywords: ["Ms. Trishea Amor C. Jacobe", "Trishea Amor C. Jacobe", "OSPAT"],
    category: "offices",
    difficulty: "hard"
  });

  // 10. Enrollment 2025-2026 (TOKEN-EFFICIENT: Short, specific)
  queries.push({
    question: "Grand Total enrollment for the academic year 2025-2026",
    expectedKeywords: ["17629", "17,629"],
    category: "enrollment",
    difficulty: "medium"
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
 * Check if response contains expected keywords
 * Uses flexible matching to handle variations in phrasing
 */
function checkAccuracy(response, expectedKeywords) {
  const responseText = (response.reply || '').toLowerCase();
  const foundKeywords = [];
  const missingKeywords = [];
  
  expectedKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // Direct match
    if (responseText.includes(keywordLower)) {
      foundKeywords.push(keyword);
      return;
    }
    
    // Flexible matching for VP titles and similar phrases
    // Check if response contains key parts of the keyword
    if (keyword.includes('VP for')) {
      // Extract key parts: "VP for Planning and Quality Assurance" -> ["planning", "quality", "assurance"]
      const parts = keywordLower
        .replace(/vp for /i, '')
        .split(/[,\s]+and\s+|,\s*|\s+/)
        .filter(part => part.length > 2 && !['for', 'the', 'and', 'or'].includes(part));
      
      // Check if response contains most key parts (at least 2/3 or all if less than 3)
      const minParts = Math.max(1, Math.ceil(parts.length * 0.6)); // At least 60% of parts
      const foundParts = parts.filter(part => responseText.includes(part));
      
      if (foundParts.length >= minParts) {
        foundKeywords.push(keyword);
        return;
      }
    }
    
    // Flexible matching for names with titles (e.g., "Hon. Justina MB Yu")
    // Check if response contains the name without the title
    if (/^(hon\.|dr\.|mr\.|ms\.|mrs\.|prof\.)\s+/i.test(keyword)) {
      const nameWithoutTitle = keyword.replace(/^(hon\.|dr\.|mr\.|ms\.|mrs\.|prof\.)\s+/i, '').toLowerCase();
      // Extract first and last name parts
      const nameParts = nameWithoutTitle.split(/\s+/).filter(part => part.length > 1);
      // Check if response contains at least the last name
      if (nameParts.length > 0 && responseText.includes(nameParts[nameParts.length - 1])) {
        foundKeywords.push(keyword);
        return;
      }
    }
    
    // Flexible matching for numbers with/without commas (e.g., "12009" vs "12,009")
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
  
  const accuracy = expectedKeywords.length > 0
    ? (foundKeywords.length / expectedKeywords.length) * 100
    : 0;
  
  return {
    accuracy,
    foundKeywords,
    missingKeywords,
    passed: accuracy >= 70 // 70% keyword match threshold
  };
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report) {
  const timestamp = new Date(report.timestamp).toLocaleString();
  
  let markdown = `# AI Accuracy Benchmark Report\n\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  markdown += `---\n\n`;
  
  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Total Queries:** ${report.summary.totalQueries}\n`;
  markdown += `- **Passed Tests:** ${report.summary.passedTests} (${report.summary.passRate.toFixed(1)}%)\n`;
  markdown += `- **Failed Tests:** ${report.summary.failedTests}\n`;
  markdown += `- **Average Accuracy:** ${report.summary.averageAccuracy.toFixed(1)}%\n\n`;
  
  // Category Performance
  if (report.categoryStats && report.categoryStats.length > 0) {
    markdown += `## Category Performance\n\n`;
    markdown += `| Category | Total | Passed | Pass Rate | Avg Accuracy |\n`;
    markdown += `|----------|-------|--------|-----------|--------------|\n`;
    report.categoryStats.forEach(stat => {
      markdown += `| ${stat.category} | ${stat.total} | ${stat.passed} | ${stat.passRate.toFixed(1)}% | ${stat.averageAccuracy.toFixed(1)}% |\n`;
    });
    markdown += `\n`;
  }
  
  // Difficulty Performance
  if (report.difficultyStats && report.difficultyStats.length > 0) {
    markdown += `## Difficulty Performance\n\n`;
    markdown += `| Difficulty | Total | Passed | Pass Rate | Avg Accuracy |\n`;
    markdown += `|------------|-------|--------|-----------|--------------|\n`;
    report.difficultyStats.forEach(stat => {
      markdown += `| ${stat.difficulty} | ${stat.total} | ${stat.passed} | ${stat.passRate.toFixed(1)}% | ${stat.averageAccuracy.toFixed(1)}% |\n`;
    });
    markdown += `\n`;
  }
  
  // Detailed Results
  markdown += `## Detailed Results\n\n`;
  report.results.forEach((result, index) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    markdown += `### ${index + 1}. ${result.question}\n\n`;
    markdown += `**Category:** ${result.category} | **Difficulty:** ${result.difficulty} | **Status:** ${status}\n\n`;
    markdown += `**Accuracy:** ${result.accuracy?.toFixed(1) || 0}%\n\n`;
    
    if (result.response) {
      markdown += `**AI Response:**\n\n`;
      markdown += `\`\`\`\n${result.response}\n\`\`\`\n\n`;
    }
    
    if (result.expectedKeywords && result.expectedKeywords.length > 0) {
      markdown += `**Expected Keywords:** ${result.expectedKeywords.join(', ')}\n\n`;
    }
    
    if (result.foundKeywords && result.foundKeywords.length > 0) {
      markdown += `**Found Keywords:** ${result.foundKeywords.join(', ')}\n\n`;
    }
    
    if (result.missingKeywords && result.missingKeywords.length > 0) {
      markdown += `**Missing Keywords:** ${result.missingKeywords.join(', ')}\n\n`;
    }
    
    if (result.error) {
      markdown += `**Error:** ${result.error}\n\n`;
    }
    
    markdown += `**Response Time:** ${result.responseTime}ms | **Model:** ${result.model || 'unknown'} | **Used Knowledge Base:** ${result.usedKnowledgeBase ? 'Yes' : 'No'}\n\n`;
    markdown += `---\n\n`;
  });
  
  return markdown;
}

/**
 * Run benchmark tests
 */
async function runBenchmark() {
  console.log('🚀 Starting AI Accuracy Benchmark Tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const queries = generateTestQueries();
  const results = [];
  let totalAccuracy = 0;
  let passedTests = 0;
  let failedTests = 0;

  console.log(`Testing ${queries.length} queries...\n`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] Testing: ${query.question}`);
    console.log(`   Category: ${query.category} | Difficulty: ${query.difficulty}`);

    try {
      const startTime = Date.now();
      const response = await makeChatRequest(query.question);
      const responseTime = Date.now() - startTime;

      const accuracyCheck = checkAccuracy(response, query.expectedKeywords);

      const result = {
        question: query.question,
        category: query.category,
        difficulty: query.difficulty,
        response: response.reply,
        expectedKeywords: query.expectedKeywords,
        foundKeywords: accuracyCheck.foundKeywords,
        missingKeywords: accuracyCheck.missingKeywords,
        accuracy: accuracyCheck.accuracy,
        passed: accuracyCheck.passed,
        responseTime,
        model: response.model || 'unknown',
        usedKnowledgeBase: response.usedKnowledgeBase || false
      };

      results.push(result);
      totalAccuracy += accuracyCheck.accuracy;

      // Display AI response in console
      console.log(`   💬 AI Response:`);
      console.log(`   ${response.reply.split('\n').map(line => `   ${line}`).join('\n')}`);
      console.log('');

      if (accuracyCheck.passed) {
        passedTests++;
        console.log(`   ✅ PASSED (${accuracyCheck.accuracy.toFixed(1)}% accuracy)`);
      } else {
        failedTests++;
        console.log(`   ❌ FAILED (${accuracyCheck.accuracy.toFixed(1)}% accuracy)`);
        console.log(`   Missing keywords: ${accuracyCheck.missingKeywords.join(', ')}`);
      }

      console.log(`   ⏱️  Response time: ${responseTime}ms\n`);

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
      results.push({
        question: query.question,
        category: query.category,
        difficulty: query.difficulty,
        error: error.message,
        passed: false
      });
      failedTests++;
    }
  }

  // Calculate statistics
  const averageAccuracy = totalAccuracy / queries.length;
  const passRate = (passedTests / queries.length) * 100;

  // Group by category
  const categoryStats = {};
  results.forEach(result => {
    if (!result.error) {
      if (!categoryStats[result.category]) {
        categoryStats[result.category] = { total: 0, passed: 0, accuracy: 0 };
      }
      categoryStats[result.category].total++;
      if (result.passed) categoryStats[result.category].passed++;
      categoryStats[result.category].accuracy += result.accuracy;
    }
  });

  // Group by difficulty
  const difficultyStats = {};
  results.forEach(result => {
    if (!result.error) {
      if (!difficultyStats[result.difficulty]) {
        difficultyStats[result.difficulty] = { total: 0, passed: 0, accuracy: 0 };
      }
      difficultyStats[result.difficulty].total++;
      if (result.passed) difficultyStats[result.difficulty].passed++;
      difficultyStats[result.difficulty].accuracy += result.accuracy;
    }
  });

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalQueries: queries.length,
      passedTests,
      failedTests,
      passRate,
      averageAccuracy
    },
    categoryStats: Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      total: stats.total,
      passed: stats.passed,
      passRate: (stats.passed / stats.total) * 100,
      averageAccuracy: stats.accuracy / stats.total
    })),
    difficultyStats: Object.entries(difficultyStats).map(([difficulty, stats]) => ({
      difficulty,
      total: stats.total,
      passed: stats.passed,
      passRate: (stats.passed / stats.total) * 100,
      averageAccuracy: stats.accuracy / stats.total
    })),
    results
  };

  // Save report as Markdown
  if (!fs.existsSync(BENCHMARK_OUTPUT_DIR)) {
    fs.mkdirSync(BENCHMARK_OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(BENCHMARK_OUTPUT_DIR, `benchmark-ai-accuracy-${timestamp}.md`);
  
  // Generate Markdown report
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(reportPath, markdownReport);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BENCHMARK SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Queries: ${queries.length}`);
  console.log(`Passed: ${passedTests} (${passRate.toFixed(1)}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Average Accuracy: ${averageAccuracy.toFixed(1)}%`);
  console.log('\n📁 Category Performance:');
  report.categoryStats.forEach(stat => {
    console.log(`   ${stat.category}: ${stat.passed}/${stat.total} (${stat.passRate.toFixed(1)}%) - Avg Accuracy: ${stat.averageAccuracy.toFixed(1)}%`);
  });
  console.log('\n📊 Difficulty Performance:');
  report.difficultyStats.forEach(stat => {
    console.log(`   ${stat.difficulty}: ${stat.passed}/${stat.total} (${stat.passRate.toFixed(1)}%) - Avg Accuracy: ${stat.averageAccuracy.toFixed(1)}%`);
  });
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log('='.repeat(60));

  return report;
}

// Run benchmark
runBenchmark()
  .then(() => {
    console.log('\n✅ Benchmark completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  });

