# RAG Pipeline Benchmark Guide

This guide explains how to test the RAG pipeline using comprehensive metrics: **Retrieval Relevance**, **Context Accuracy**, **Hallucinations**, and **Answer Correctness**.

## Overview

The RAG pipeline benchmark tests four critical aspects of your retrieval-augmented generation system:

1. **Retrieval Relevance** - How well does the system retrieve relevant chunks?
2. **Context Accuracy** - Is the retrieved context accurate and free of contradictions?
3. **Hallucinations** - Does the model make up information not in the knowledge base?
4. **Answer Correctness** - Is the final answer correct and complete?

## Running the Benchmark

### Basic Usage

```bash
cd backend
npm run benchmark:rag
```

### With Custom API URL

```bash
API_BASE_URL=http://localhost:3000 npm run benchmark:rag
```

## Metrics Explained

### 1. Retrieval Relevance (0-100%)

**What it measures**: How well the RAG system retrieves relevant information from the knowledge base.

**How it works**:
- Extracts ground truth facts from `dorsu_data.json`
- Checks if the AI response contains these facts
- Calculates percentage of facts found

**Good score**: 80%+
**Target**: 91%+

**Example**:
- Query: "Where is DOrSU located?"
- Ground truth facts: ["Mati", "Davao Oriental", "Guang-guang", "Dahican"]
- If response contains 3/4 facts → 75% relevance

### 2. Context Accuracy (0-100%)

**What it measures**: Whether the context used to generate the answer is accurate and free of contradictions.

**How it works**:
- Checks for contradictions (e.g., wrong numbers, wrong years)
- Validates that stated facts match ground truth
- Detects when model uses incorrect context

**Good score**: 90%+
**Target**: 95%+

**Example**:
- Query: "How many students enrolled in 2025?"
- Ground truth: 17251
- If response says 4447 → Contradiction detected
- If response says 17251 → Accurate

### 3. Hallucinations (0-100%, higher is better)

**What it measures**: Whether the model makes up information not in the knowledge base.

**How it works**:
- Detects false negations ("I don't have that information" when data exists)
- Identifies unsourced claims
- Flags vague responses when specific data exists
- Checks for incorrect facts

**Good score**: 80%+ (few hallucinations)
**Target**: 90%+ (minimal hallucinations)

**Example**:
- Query: "What are extension campuses?"
- If response: "The knowledge base does not specify..." → Hallucination (false negation)
- If response lists campuses correctly → No hallucination

### 4. Answer Correctness (0-100%)

**What it measures**: Overall correctness of the final answer.

**How it works**:
- Checks expected keywords are present
- Validates ground truth facts are included
- Combines keyword accuracy (50%) + fact accuracy (50%)

**Good score**: 85%+
**Target**: 91%+

**Example**:
- Query: "What programs in FACET?"
- Expected keywords: ["BSIT", "BSCE", "BSMath", "BITM"]
- If 3/4 keywords found → 75% keyword accuracy
- If ground truth facts found → Additional fact accuracy
- Combined score determines correctness

## Understanding Results

### Report Structure

Results are saved as JSON files:
- `rag-pipeline-benchmark-YYYY-MM-DDTHH-MM-SS.json`

Each report includes:

```json
{
  "timestamp": "2025-11-29T14:00:00.000Z",
  "summary": {
    "totalQueries": 10,
    "averageRetrievalRelevance": 75.5,
    "averageContextAccuracy": 82.3,
    "averageHallucinationScore": 70.0,
    "averageAnswerCorrectness": 68.2,
    "overallScore": 74.0
  },
  "categoryStats": [...],
  "results": [
    {
      "question": "...",
      "retrievalRelevance": {
        "score": 80.0,
        "foundFacts": [...],
        "missingFacts": [...]
      },
      "contextAccuracy": {
        "score": 90.0,
        "contradictions": [],
        "hasContradictions": false
      },
      "hallucinations": {
        "hasHallucinations": false,
        "count": 0,
        "score": 100
      },
      "answerCorrectness": {
        "score": 85.0,
        "passed": false
      }
    }
  ]
}
```

### Console Output

```
[1/10] Testing: Where is DOrSU located?
   Category: organization | Difficulty: easy
   📊 Retrieval Relevance: 75.0%
   ✅ Context Accuracy: 100.0%
   🎭 Hallucinations: NO (Score: 100.0%)
   ✓ Answer Correctness: 87.5% ✅
   ⏱️  Response time: 1234ms

============================================================
📊 RAG PIPELINE BENCHMARK SUMMARY
============================================================
Total Queries: 10

📈 Average Scores:
   Retrieval Relevance: 75.5%
   Context Accuracy: 82.3%
   Hallucination Score: 70.0% (higher is better)
   Answer Correctness: 68.2%
   Overall Score: 74.0%
```

## Interpreting Scores

### Retrieval Relevance Issues

**Low scores (<70%)** indicate:
- Chunks not being retrieved properly
- Poor semantic matching
- Missing keywords in chunks
- Need to improve chunking strategy

**Solutions**:
- Review `AI_OPTIMIZATION_GUIDE.md` for chunking improvements
- Add more explicit chunks for critical data
- Enhance keyword extraction

### Context Accuracy Issues

**Low scores (<80%)** or **contradictions** indicate:
- Wrong data being retrieved
- Model using outdated information
- Context assembly issues

**Solutions**:
- Verify knowledge base is up to date
- Check for data inconsistencies
- Review context assembly logic

### Hallucination Issues

**High hallucination count** indicates:
- Model making up information
- False negations (claiming data doesn't exist)
- Guardrails blocking valid queries

**Solutions**:
- Fix guardrail logic (see `AI_OPTIMIZATION_GUIDE.md`)
- Ensure RAG is working properly
- Add fallback retrieval strategies

### Answer Correctness Issues

**Low scores (<85%)** indicate:
- Missing keywords in response
- Ground truth facts not included
- Incomplete answers

**Solutions**:
- Improve retrieval to get all relevant chunks
- Increase context window
- Enhance prompt engineering

## Optimization Workflow

1. **Run benchmark**: `npm run benchmark:rag`
2. **Identify weak areas**: Check which metric has lowest score
3. **Review failed queries**: Look at specific questions with low scores
4. **Apply fixes**: Use recommendations from `AI_OPTIMIZATION_GUIDE.md`
5. **Re-run benchmark**: Verify improvements
6. **Iterate**: Continue until all metrics reach 91%+

## Target Metrics

For **91%+ overall accuracy**, aim for:

- **Retrieval Relevance**: 91%+
- **Context Accuracy**: 95%+
- **Hallucination Score**: 90%+ (minimal hallucinations)
- **Answer Correctness**: 91%+

## Common Issues & Fixes

### Issue: Low Retrieval Relevance

**Symptoms**: Missing facts in responses
**Fix**: 
- Add explicit chunks for critical data
- Improve keyword extraction
- Enhance semantic search

### Issue: Context Contradictions

**Symptoms**: Wrong numbers, wrong years
**Fix**:
- Verify data in `dorsu_data.json` is correct
- Check for data version mismatches
- Ensure proper year tagging

### Issue: High Hallucinations

**Symptoms**: Model says "I don't know" when data exists
**Fix**:
- Fix guardrail blocking
- Ensure RAG is being used (`usedKnowledgeBase: true`)
- Add fallback retrieval

### Issue: Low Answer Correctness

**Symptoms**: Missing keywords, incomplete answers
**Fix**:
- Increase context window
- Improve retrieval strategy
- Enhance prompt to include all relevant info

## Next Steps

1. Run both benchmarks:
   - `npm run benchmark` - Basic accuracy test
   - `npm run benchmark:rag` - RAG pipeline deep dive

2. Compare results to identify patterns

3. Apply optimizations from `AI_OPTIMIZATION_GUIDE.md`

4. Re-run benchmarks to measure improvements

5. Track progress over time

