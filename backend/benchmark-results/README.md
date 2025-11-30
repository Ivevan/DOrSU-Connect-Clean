# AI Accuracy Benchmark Results

This directory contains the results of AI accuracy benchmark tests.

## Running Benchmarks

To run the benchmark tests:

```bash
npm run benchmark
```

Or directly:

```bash
node scripts/benchmark-ai-accuracy.js
```

## Configuration

Set the API base URL using environment variable:

```bash
API_BASE_URL=http://localhost:3000 npm run benchmark
```

Or modify the `API_BASE_URL` in `scripts/benchmark-ai-accuracy.js`.

## Test Coverage

The benchmark tests cover:

- **Organization**: Basic information about DOrSU
- **Vision & Mission**: University vision and mission statements
- **Leadership**: President and key officials
- **Programs**: Academic programs and accreditations
- **Admission**: Enrollment requirements and schedules
- **History**: University history and milestones
- **Student Organizations**: USC, Ang Sidlakan, etc.
- **Offices**: Library, health services, etc.
- **Partnerships**: International partnerships

## Metrics

Each test measures:

- **Accuracy**: Percentage of expected keywords found in response
- **Response Time**: Time taken to get AI response
- **Pass/Fail**: Based on 70% keyword match threshold
- **Knowledge Base Usage**: Whether RAG was used

## Results Format

Results are saved as JSON files with timestamp:
- `benchmark-YYYY-MM-DDTHH-MM-SS.json`

Each report includes:
- Summary statistics
- Category-wise performance
- Difficulty-wise performance
- Detailed results for each query

