# AI Accuracy Benchmark Guide

This guide explains how to test the AI service accuracy using the custom benchmarking tool.

## Overview

The benchmark tool tests your AI service's accuracy by:
1. Generating test queries based on `dorsu_data.json`
2. Sending queries to your AI service endpoint
3. Checking if responses contain expected keywords
4. Generating detailed accuracy reports

## Prerequisites

1. **Backend server running**: Make sure your DOrSU AI backend is running
   ```bash
   cd backend
   npm start
   ```

2. **API endpoint accessible**: The benchmark will call `/api/chat` endpoint

## Running Benchmarks

### Basic Usage

```bash
cd backend
npm run benchmark
```

### With Custom API URL

If your backend is running on a different URL:

```bash
API_BASE_URL=http://localhost:3000 npm run benchmark
```

Or for production/testing:

```bash
API_BASE_URL=https://your-backend-url.com npm run benchmark
```

## Test Coverage

The benchmark includes **26 test queries** covering:

### Categories:
- **Organization** (5 queries): Basic DOrSU information
- **Vision & Mission** (1 query): University vision statement
- **Values & Outcomes** (2 queries): Core values and graduate outcomes
- **Leadership** (2 queries): President and officials
- **Enrollment** (1 query): Student enrollment statistics
- **Programs** (3 queries): Academic programs and accreditations
- **Admission** (3 queries): Requirements and schedules
- **History** (2 queries): University history and milestones
- **Student Organizations** (3 queries): USC, Ang Sidlakan, etc.
- **Offices** (2 queries): Library, health services
- **Partnerships** (1 query): International partnerships
- **Mandate** (1 query): University mandate

### Difficulty Levels:
- **Easy** (8 queries): Basic facts that should be easily retrievable
- **Medium** (10 queries): More specific information requiring context
- **Hard** (8 queries): Detailed information that tests RAG accuracy

## Understanding Results

### Accuracy Metrics

Each test checks if the AI response contains **expected keywords**:
- **70%+ keyword match** = ✅ PASSED
- **<70% keyword match** = ❌ FAILED

### Report Structure

Results are saved in `benchmark-results/benchmark-YYYY-MM-DDTHH-MM-SS.json`:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "summary": {
    "totalQueries": 26,
    "passedTests": 22,
    "failedTests": 4,
    "passRate": 84.6,
    "averageAccuracy": 85.3
  },
  "categoryStats": [...],
  "difficultyStats": [...],
  "results": [...]
}
```

### Console Output

The benchmark prints:
- ✅/❌ status for each query
- Accuracy percentage
- Missing keywords (for failed tests)
- Response time
- Summary statistics by category and difficulty

## Example Output

```
🚀 Starting AI Accuracy Benchmark Tests...

API Base URL: http://localhost:3000

Testing 26 queries...

[1/26] Testing: What is the full name of DOrSU?
   Category: organization | Difficulty: easy
   ✅ PASSED (100.0% accuracy)
   Response time: 1234ms

[2/26] Testing: When was DOrSU founded?
   Category: organization | Difficulty: easy
   ✅ PASSED (100.0% accuracy)
   Response time: 1156ms

...

============================================================
📊 BENCHMARK SUMMARY
============================================================
Total Queries: 26
Passed: 22 (84.6%)
Failed: 4
Average Accuracy: 85.3%

📁 Category Performance:
   organization: 5/5 (100.0%) - Avg Accuracy: 95.0%
   programs: 2/3 (66.7%) - Avg Accuracy: 75.0%
   ...

📊 Difficulty Performance:
   easy: 8/8 (100.0%) - Avg Accuracy: 95.0%
   medium: 8/10 (80.0%) - Avg Accuracy: 82.5%
   hard: 6/8 (75.0%) - Avg Accuracy: 78.0%

📄 Full report saved to: benchmark-results/benchmark-2025-01-15T10-30-00.json
============================================================
```

## Customizing Tests

To add or modify test queries, edit `backend/scripts/benchmark-ai-accuracy.js`:

```javascript
queries.push({
  question: "Your question here?",
  expectedKeywords: ["keyword1", "keyword2", "keyword3"],
  category: "yourCategory",
  difficulty: "easy" // or "medium" or "hard"
});
```

## Troubleshooting

### Connection Errors

If you see connection errors:
1. Verify the backend server is running
2. Check the `API_BASE_URL` is correct
3. Ensure the `/api/chat` endpoint is accessible

### Low Accuracy Scores

If accuracy is low:
1. Check if RAG service is working properly
2. Verify `dorsu_data.json` is loaded in the knowledge base
3. Check MongoDB connection and embeddings
4. Review failed queries to see what keywords are missing

### Rate Limiting

The benchmark includes a 1-second delay between queries. If you still hit rate limits:
- Increase the delay in the script (line ~280)
- Run tests in smaller batches

## Best Practices

1. **Run benchmarks regularly** to track AI accuracy over time
2. **Compare results** across different model versions
3. **Review failed tests** to identify knowledge gaps
4. **Update test queries** as new data is added to `dorsu_data.json`
5. **Track trends** by saving and comparing historical reports

## Next Steps

- Review the generated JSON report for detailed analysis
- Identify patterns in failed tests
- Update knowledge base or RAG configuration as needed
- Add more test queries for areas with low coverage

