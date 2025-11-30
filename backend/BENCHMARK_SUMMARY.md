# Benchmark Testing Summary

This document provides an overview of all available benchmark tests for the DOrSU AI system.

## Available Benchmarks

### 1. Basic Accuracy Benchmark (`npm run benchmark`)

**Purpose**: Tests overall AI accuracy using keyword matching.

**Metrics**:
- Keyword accuracy
- Pass/fail rate
- Category performance
- Difficulty performance

**Output**: `benchmark-YYYY-MM-DDTHH-MM-SS.json`

**Use when**: You want a quick check of overall accuracy.

---

### 2. RAG Pipeline Benchmark (`npm run benchmark:rag`)

**Purpose**: Deep dive into RAG pipeline performance.

**Metrics**:
- **Retrieval Relevance** (0-100%): How well relevant chunks are retrieved
- **Context Accuracy** (0-100%): Accuracy of retrieved context, detects contradictions
- **Hallucinations** (0-100%): Detects made-up information
- **Answer Correctness** (0-100%): Overall answer quality

**Output**: `rag-pipeline-benchmark-YYYY-MM-DDTHH-MM-SS.json`

**Use when**: You need to diagnose RAG pipeline issues or optimize retrieval.

---

## Quick Start

### Run Basic Accuracy Test
```bash
cd backend
npm run benchmark
```

### Run RAG Pipeline Test
```bash
cd backend
npm run benchmark:rag
```

### Run Both Tests
```bash
cd backend
npm run benchmark && npm run benchmark:rag
```

## Interpreting Results

### Basic Accuracy Benchmark

**Good Performance**:
- Pass rate: 85%+
- Average accuracy: 85%+
- All categories: 80%+

**Needs Improvement**:
- Pass rate: <70%
- Average accuracy: <70%
- Any category: <60%

### RAG Pipeline Benchmark

**Good Performance**:
- Retrieval Relevance: 85%+
- Context Accuracy: 90%+
- Hallucination Score: 85%+ (few hallucinations)
- Answer Correctness: 85%+

**Needs Improvement**:
- Retrieval Relevance: <70% → Improve chunking/retrieval
- Context Accuracy: <80% → Fix data inconsistencies
- Hallucination Score: <70% → Fix guardrails/RAG issues
- Answer Correctness: <75% → Improve overall pipeline

## Optimization Workflow

1. **Run both benchmarks** to get baseline metrics
2. **Identify weakest metric** from RAG pipeline benchmark
3. **Review failed queries** in both reports
4. **Apply fixes** from `AI_OPTIMIZATION_GUIDE.md`
5. **Re-run benchmarks** to measure improvement
6. **Iterate** until all metrics reach 91%+

## Target Goals

For production-ready AI system:

- ✅ **91%+ pass rate** on basic accuracy test
- ✅ **91%+ retrieval relevance**
- ✅ **95%+ context accuracy**
- ✅ **90%+ hallucination score** (minimal hallucinations)
- ✅ **91%+ answer correctness**

## Files Reference

- `scripts/benchmark-ai-accuracy.js` - Basic accuracy benchmark
- `scripts/benchmark-rag-pipeline.js` - RAG pipeline benchmark
- `BENCHMARK_GUIDE.md` - Basic benchmark guide
- `RAG_PIPELINE_BENCHMARK_GUIDE.md` - RAG pipeline guide
- `AI_OPTIMIZATION_GUIDE.md` - Optimization recommendations
- `benchmark-results/` - All benchmark reports saved here

