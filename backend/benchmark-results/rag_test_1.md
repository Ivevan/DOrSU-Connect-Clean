# RAG Pipeline Benchmark Report

**Generated:** 11/30/2025, 8:30:23 PM

---

## Summary

- **Total Queries:** 20
- **Average Retrieval Relevance:** 62.0%
- **Average Context Accuracy:** 66.0%
- **Average Hallucination Score:** 96.0% (higher is better)
- **Average Answer Correctness:** 68.2%
- **Overall Score:** 73.0%
- **Query Routing Accuracy:** 50.0% (1/2 tests passed)

## Category Performance

| Category | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |
|----------|-------|---------------------|-----------------|-------------------|-------------------|
| schedule | 10 | 53.9% | 58.9% | 92.0% | 36.3% |
| history | 1 | 100.0% | 100.0% | 100.0% | 100.0% |
| programs | 3 | 66.7% | 76.7% | 100.0% | 100.0% |
| enrollment | 2 | 100.0% | 100.0% | 100.0% | 100.0% |
| leadership | 2 | 50.0% | 50.0% | 100.0% | 100.0% |
| admission | 1 | 100.0% | 100.0% | 100.0% | 100.0% |
| offices | 1 | 0.0% | 0.0% | 100.0% | 100.0% |

## Data Source Performance

| Data Source | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |
|-------------|-------|---------------------|-----------------|-------------------|-------------------|
| schedule_data | 10 | 53.9% | 58.9% | 92.0% | 36.3% |
| dorsu_data | 10 | 70.0% | 73.0% | 100.0% | 100.0% |

## Detailed Results

### 1. When does semester 2 start for undergraduate program in 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 0.0% (0/6 facts found)
- **Context Accuracy:** 0.0% (0/6 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 0.0% ❌

#### AI Response

```
Here are the programs offered by DOrSU, organized by faculty:

**Faculty of Agriculture and Life Sciences (FALS)**

1. BSAM - Bachelor of Science in Agribusiness Management
2. BSA - Bachelor of Science in Agriculture major in Animal Science
3. BSA - Bachelor of Science in Agriculture major in Crop Science
4. BSBio - Bachelor of Science in Biology
5. BSBio - Bachelor of Science in Biology major in Animal Biology
6. BSBio - Bachelor of Science in Biology major in Ecology
7. BSES - Bachelor of Science in Environmental Science

**Faculty of Humanities, Social Sciences, and Communications (FHUSOCOM)**

1. BSDevCom - Bachelor of Science in Development Communication
2. AB PolSci - Bachelor of Arts in Political Science
3. BS Psych - Bachelor of Science in Psychology

**Faculty of Business and Management (FBM)**

1. BSBA - Bachelor of Science in Business Administration
2. BSHM - Bachelor of Science in Hospitality Management

**Faculty of Criminal Justice Education (FCJE)**

1. BSC - Bachelor of Science in Criminology

**Faculty of Computing, Engineering, and Technology (FACET)**

1. BITM - Bachelor in Industrial Technology Management major in Automotive Technology
2. BSCE - Bachelor of Science in Civil Engineering
3. BSIT - Bachelor of Science in Information Technology
4. BSMath - Bachelor of Science in Mathematics
5. BSMRS - Bachelor of Science in Mathematics with Research Statistics

**Faculty of Nursing and Allied Health Sciences (FNAHS)**

1. BSN - Bachelor of Science in Nursing

**Faculty of Teacher Education (FTED)**

1. BEED - Bachelor of Elementary Education
2. BCED - Bachelor of Early Childhood Education
3. BSNED - Bachelor of Special Needs Education
4. BPED - Bachelor Physical Education
5. BTLED - Bachelor of Technology and Livelihood Education major in Home Economics
6. BTLED - Bachelor of Technology and Livelihood Education major in Industrial Arts
7. BSED – English - Bachelor of Secondary Education major in English
8. BSED – Filipino - Bachelor of Secondary Education major in Filipino
9. BSED – Mathematics - Bachelor of Secondary Education major in Mathematics
10. BSED – Science - Bachelor of Secondary Education major in Science

**Graduate Programs**

1. MBA - Master of Business Administration
2. MAED - Master of Arts in Education
3. MAED - Master of Arts in Education
4. MST - Master of Science in Technology
5. MST - Master of Science in Technology
6. MSES - Master of Science in Environmental Science
7. PhD Bio - Doctor of Philosophy in Biology
8. EdD - Doctor of Education
9. PhD ES - Doctor of Philosophy in Environmental Science

**Extension Campus Programs**

**Baganga Campus**

1. BSA - Bachelor of Science in Agriculture
2. BSAM - Bachelor of Science in Agribusiness Management
3. BSMath - Bachelor of Science in Mathematics
4. BSEnvi-Sci - Bachelor of Science in Environmental Science
5. BSIT - Bachelor of Science in Information Technology

**Banaybanay Campus**

1. BSA - Bachelor of Science in Agriculture
2. BSBA - Bachelor of Science in Business Administration
3. BSIT - Bachelor of Science in Information Technology
4. BTLED - Bachelor of Technology and Livelihood Education

**Cateel Campus**

1. BSA - Bachelor of Science in Agriculture
2. BSAM - Bachelor of Science in Agribusiness Management
3. BSBA - Bachelor of Science in Business Administration
4. BSC - Bachelor of Science in Criminology
5. BEED - Bachelor of Elementary Education

Would you like to know about programs from other faculties?
```

#### Missing Facts (6)

1/15/2025, 2025, january, january 15, 2025, january

#### Context Facts Missing (6)

1/15/2025, 2025, january, january 15, 2025, january

#### Missing Keywords (3)

1/15/2025, January 15, 2025

#### 🎯 Query Routing Accuracy

**Status:** ❌ Routing Issue Detected

- **Expected Collection:** schedule
- **Detected Collection:** unknown
- **Issue:** Response lacks schedule-specific content (may not have routed to schedule collection)

#### Metadata

- **Response Time:** 16630ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 2. When is the final examination for undergraduate program semester 1, 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 0.0% (0/7 facts found)
- **Context Accuracy:** 0.0% (0/7 facts, KB used: Yes)
- **Hallucination Score:** 60.0% (Has hallucinations)
- **Answer Correctness:** 0.0% ❌

#### AI Response

```
I don't have that specific information in the knowledge base yet.
```

#### Missing Facts (7)

12/15/2025, 2025, december, december 15, 12/18/2025, 2025, december

#### Context Facts Missing (7)

12/15/2025, 2025, december, december 15, 12/18/2025, 2025, december

#### 🎭 Hallucinations Detected

- **false_negation** (high): Model claims lack of information when data exists
- **vague_response** (medium): Response too vague given available data

#### Missing Keywords (3)

12/15/2025, 12/18/2025, December

#### ⚠️ False Negation Detected

**Issue:** The AI claimed it doesn't have information, but:
- Context Accuracy is 0.0% (chunks were retrieved correctly)
- Knowledge Base was used: Yes
- Ground truth facts exist: 7 facts

**Root Cause:** This indicates a **response generation failure** - the retrieval system found the correct information, but the AI model failed to use it in the response. This is different from retrieval failure.

#### Metadata

- **Response Time:** 3778ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 3. Regular registration period for undergraduate program semester 1, 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
📚 Semester: 1st Semester
📅 Date: Aug 5 - Aug 9, 2024 
⏰ Time: All Day
🏷️ Category: Institutional

However, I found another relevant event in the knowledge base:

- **Regular Registration Period for Undergraduate Program**
 📅 Dates: Jan 7 - Jan 13, 2026
 ⏰ Time: All Day
 🏷️ Category: Academic

Since the question is about Semester 1, 2025, I couldn't find any information in the knowledge base.
```

#### Found Facts (4)

regular registration period for undergraduate program, 8/4/2025, 8/8/2025, 2025

#### Context Facts Found (4)

regular registration period for undergraduate program, 8/4/2025, 8/8/2025, 2025

#### Found Keywords (2)

8/4/2025, 8/8/2025

#### Missing Keywords (1)

August

#### Metadata

- **Response Time:** 32063ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 4. When is Siglakas in 2025?

**Category:** schedule | **Difficulty:** easy | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 57.1% (4/7 facts found)
- **Context Accuracy:** 67.1% (4/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
Siglakas is scheduled to take place on the following dates in 2024:

1. Apr 24 - Apr 27
2. Apr 23 - Apr 26
3. Apr 21 - Apr 25

No dates are provided for 2025.
```

#### Found Facts (4)

4/23/2025, 2025, 4/26/2025, 2025

#### Missing Facts (3)

april, april 23, april

#### Context Facts Found (4)

4/23/2025, 2025, 4/26/2025, 2025

#### Context Facts Missing (3)

april, april 23, april

#### Found Keywords (2)

4/23/2025, 4/26/2025

#### Missing Keywords (1)

April

#### Metadata

- **Response Time:** 32882ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 5. Preliminary examination dates for undergraduate program semester 2, 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 42.9% (3/7 facts found)
- **Context Accuracy:** 52.9% (3/7 facts, KB used: Yes)
- **Hallucination Score:** 80.0% (Has hallucinations)
- **Answer Correctness:** 3.3% ❌

#### AI Response

```
Unfortunately, I don't have the information for 2025 in the knowledge base. However, I can provide you with the information for 2024, which is available:

**Preliminary Examination for Undergraduate Program**
📚 Semester: 2nd Semester
📅 Date: Mar 1, 2024
⏰ Time: All Day
🏷️ Category: Institutional

Please note that this information is for 2024 and may not be applicable for 2025. For the most current information, please check with the university directly.
```

#### Found Facts (3)

2/25/2025, 2025, 2025

#### Missing Facts (4)

february, february 25, 2/26/2025, february

#### Context Facts Found (3)

2/25/2025, 2025, 2025

#### Context Facts Missing (4)

february, february 25, 2/26/2025, february

#### 🎭 Hallucinations Detected

- **false_negation** (high): Model claims lack of information when data exists

#### Found Keywords (1)

2/25/2025

#### Missing Keywords (2)

2/26/2025, February

#### ⚠️ False Negation Detected

**Issue:** The AI claimed it doesn't have information, but:
- Context Accuracy is 52.9% (chunks were retrieved correctly)
- Knowledge Base was used: Yes
- Ground truth facts exist: 7 facts

**Root Cause:** This indicates a **response generation failure** - the retrieval system found the correct information, but the AI model failed to use it in the response. This is different from retrieval failure.

#### Metadata

- **Response Time:** 16190ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 6. When is the commencement exercises for AY 2024-2025?

**Category:** schedule | **Difficulty:** easy | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 57.1% (4/7 facts found)
- **Context Accuracy:** 67.1% (4/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
The Commencement Exercises for AY 2024-2025 are scheduled on:

- Jun 23 - Jun 27, 2025 (Institutional)
- Jun 23, Jun 26, Jun 29, 2026 (Academic)
```

#### Found Facts (4)

6/23/2025, 2025, 6/27/2025, 2025

#### Missing Facts (3)

june, june 23, june

#### Context Facts Found (4)

6/23/2025, 2025, 6/27/2025, 2025

#### Context Facts Missing (3)

june, june 23, june

#### Found Keywords (2)

6/23/2025, 6/27/2025

#### Missing Keywords (1)

June

#### Metadata

- **Response Time:** 34987ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 7. Midterm examination dates for undergraduate program semester 1, 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 57.1% (4/7 facts found)
- **Context Accuracy:** 67.1% (4/7 facts, KB used: Yes)
- **Hallucination Score:** 80.0% (Has hallucinations)
- **Answer Correctness:** 10.0% ❌

#### AI Response

```
Unfortunately, I don't have the information for 2025 in the knowledge base. However, I can provide the midterm examination dates for the undergraduate program in the knowledge base:

**Midterm Examination for Undergraduate Program**
📚 Semester: 1st Semester
📅 Date: Nov 4 - Nov 5, 2024
⏰ Time: All Day
🏷️ Category: Institutional

Please note that these dates are for 2024, not 2025.
```

#### Found Facts (4)

11/4/2025, 2025, 11/5/2025, 2025

#### Missing Facts (3)

november, november 4, november

#### Context Facts Found (4)

11/4/2025, 2025, 11/5/2025, 2025

#### Context Facts Missing (3)

november, november 4, november

#### 🎭 Hallucinations Detected

- **false_negation** (high): Model claims lack of information when data exists

#### Found Keywords (3)

11/4/2025, 11/5/2025, November

#### ⚠️ False Negation Detected

**Issue:** The AI claimed it doesn't have information, but:
- Context Accuracy is 67.1% (chunks were retrieved correctly)
- Knowledge Base was used: Yes
- Ground truth facts exist: 7 facts

**Root Cause:** This indicates a **response generation failure** - the retrieval system found the correct information, but the AI model failed to use it in the response. This is different from retrieval failure.

#### Metadata

- **Response Time:** 17181ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 8. Deadline for filing application for graduation semester 2, 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 50.0% ❌

#### AI Response

```
📚 Semester: 2nd Semester
📅 Date: Feb 9, 2024 (Note: This is for 2023-2024, not 2025. No information is available for 2025 in the provided knowledge base.)

However, I can suggest checking the schedule events for 2025 for the deadline for filing application for graduation.
```

#### Found Facts (4)

deadline in filing of application for graduation, 2/12/2025, 2/12/2025, 2025

#### Context Facts Found (4)

deadline in filing of application for graduation, 2/12/2025, 2/12/2025, 2025

#### Found Keywords (1)

2/12/2025

#### Missing Keywords (1)

February 12

#### Metadata

- **Response Time:** 33854ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 9. When is DOrSU Founding Anniversary in 2025?

**Category:** schedule | **Difficulty:** easy | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (6/6 facts found)
- **Context Accuracy:** 100.0% (6/6 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
DOrSU Founding Anniversary is on May 28, 2025.
```

#### Found Facts (6)

5/28/2025, 2025, may, may 28, 2025, may

#### Context Facts Found (6)

5/28/2025, 2025, may, may 28, 2025, may

#### Found Keywords (2)

5/28/2025, May 28

#### Metadata

- **Response Time:** 34383ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 10. Regular registration period for undergraduate program off-semester 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 25.0% (1/4 facts found)
- **Context Accuracy:** 35.0% (1/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 0.0% ❌

#### AI Response

```
According to the schedule events, the Regular Registration Period for Undergraduate Program is from:

Jan 7 - Jan 13, 2026
```

#### Found Facts (1)

regular registration period for undergraduate program

#### Missing Facts (3)

6/5/2025, 6/6/2025, 2025

#### Context Facts Found (1)

regular registration period for undergraduate program

#### Context Facts Missing (3)

6/5/2025, 6/6/2025, 2025

#### Missing Keywords (3)

6/5/2025, 6/6/2025, June

#### Metadata

- **Response Time:** 30878ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 11. When was San Isidro Campus established?

**Category:** history | **Difficulty:** hard | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 100.0% (5/5 facts found)
- **Context Accuracy:** 100.0% (5/5 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
San Isidro Campus was established in November 1997.
```

#### Found Facts (5)

1997, 1997-11, november, 1997, november

#### Context Facts Found (5)

1997, 1997-11, november, 1997, november

#### Found Keywords (2)

1997, November

#### 🎯 Query Routing Accuracy

**Status:** ✅ Correct Routing

- **Expected Collection:** knowledge_chunks
- **Detected Collection:** knowledge_chunks

#### Metadata

- **Response Time:** 41710ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 12. What programs are in FALS?

**Category:** programs | **Difficulty:** medium | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 66.7% (10/21 facts found)
- **Context Accuracy:** 76.7% (14/21 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Faculty of Agriculture and Life Sciences (FALS) offers the following programs:

1. Bachelor of Science in Agribusiness Management (BSAM)
2. Bachelor of Science in Agriculture major in Animal Science (BSA)
3. Bachelor of Science in Agriculture major in Crop Science (BSA)
4. Bachelor of Science in Biology (BSBio)
5. Bachelor of Science in Biology major in Animal Biology (BSBio)
6. Bachelor of Science in Biology major in Ecology (BSBio)
7. Bachelor of Science in Environmental Science (BSES)

(This information comes from the knowledge base provided.)
```

#### Found Facts (10)

bsam, bachelor of science in agribusiness management, bsa, bachelor of science in agriculture major in animal science, bsa, bachelor of science in agriculture major in crop science, bsbio, bachelor of science in biology, bsbio, bachelor of science in biology major in animal biology

#### Missing Facts (7)

level iii, level ii, level ii, level iv, level iv, level iv, level iii

#### Context Facts Found (10)

bsam, bachelor of science in agribusiness management, bsa, bachelor of science in agriculture major in animal science, bsa, bachelor of science in agriculture major in crop science, bsbio, bachelor of science in biology, bsbio, bachelor of science in biology major in animal biology

#### Context Facts Missing (7)

level iii, level ii, level ii, level iv, level iv, level iv, level iii

#### Found Keywords (4)

BSAM, BSA, BSBio, BSES

#### Metadata

- **Response Time:** 27356ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 13. Main Campus enrollment 2024-2025?

**Category:** enrollment | **Difficulty:** medium | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 100.0% (2/2 facts found)
- **Context Accuracy:** 100.0% (2/2 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the knowledge base, the Main Campus enrollment as of 2024-2025 is 12,009 students.
```

#### Found Facts (2)

main campus, 12009

#### Context Facts Found (2)

main campus, 12009

#### Found Keywords (2)

12009, 12,009

#### Metadata

- **Response Time:** 19123ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 14. What programs are in FBM?

**Category:** programs | **Difficulty:** medium | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 66.7% (4/6 facts found)
- **Context Accuracy:** 76.7% (4/6 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Faculty of Business and Management (FBM) offers the following programs: 

1. Bachelor of Science in Business Administration (BSBA)
2. Bachelor of Science in Hospitality Management (BSHM)
```

#### Found Facts (4)

bsba, bachelor of science in business administration, bshm, bachelor of science in hospitality management

#### Missing Facts (2)

level iii, level ii

#### Context Facts Found (4)

bsba, bachelor of science in business administration, bshm, bachelor of science in hospitality management

#### Context Facts Missing (2)

level iii, level ii

#### Found Keywords (2)

BSBA, BSHM

#### Metadata

- **Response Time:** 27605ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 15. Who are the VPs of DOrSU?

**Category:** leadership | **Difficulty:** hard | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Based on the knowledge base provided, the vice presidents of DOrSU as of 2025 are:

1. Dr. Lilibeth S. Galvez
 - Position: VP for Planning, Quality Assurance, Global Affairs and Resource Generation

2. Dr. Lea A. Jimenez
 - Position: VP for Research, Innovation, and Extension

3. Dr. Edito B. Sumile
 - Position: VP for Academic Affairs

4. Dr. Roy M. Padilla
 - Position: VP for Administration and Finance
```

#### Found Facts (4)

dr. roy m. padilla, dr. lea a. jimenez, dr. lilibeth s. galvez, dr. edito b. sumile

#### Context Facts Found (4)

dr. roy m. padilla, dr. lea a. jimenez, dr. lilibeth s. galvez, dr. edito b. sumile

#### Found Keywords (4)

VP for Administration and Finance, VP for Research, Innovation, and Extension, VP for Academic Affairs, VP for Planning and Quality Assurance

#### Metadata

- **Response Time:** 22869ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 16. What programs are in FACET?

**Category:** programs | **Difficulty:** medium | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 66.7% (10/15 facts found)
- **Context Accuracy:** 76.7% (10/15 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Faculty of Computing, Engineering, and Technology (FACET) offers the following programs:

1. Bachelor in Industrial Technology Management major in Automotive Technology (BITM)
2. Bachelor of Science in Civil Engineering (BSCE)
3. Bachelor of Science in Information Technology (BSIT)
4. Bachelor of Science in Mathematics (BSMath)
5. Bachelor of Science in Mathematics with Research Statistics (BSMRS)
```

#### Found Facts (10)

bitm, bachelor in industrial technology management major in automotive technology, bsce, bachelor of science in civil engineering, bsit, bachelor of science in information technology, bsmath, bachelor of science in mathematics, bsmrs, bachelor of science in mathematics with research statistics

#### Missing Facts (5)

level ii, level ii, level iii, level iii, level iii

#### Context Facts Found (10)

bitm, bachelor in industrial technology management major in automotive technology, bsce, bachelor of science in civil engineering, bsit, bachelor of science in information technology, bsmath, bachelor of science in mathematics, bsmrs, bachelor of science in mathematics with research statistics

#### Context Facts Missing (5)

level ii, level ii, level iii, level iii, level iii

#### Found Keywords (4)

BSIT, BSCE, BSMath, BITM

#### Metadata

- **Response Time:** 28320ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 17. Admission requirements for transferring students?

**Category:** admission | **Difficulty:** medium | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 100.0% (8/8 facts found)
- **Context Accuracy:** 100.0% (8/8 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Admission Requirements for Transferring Students:

1. SUAST Examination Result (Original copy)
2. Informative copy of Transcript of Record (TOR) (Original copy)
3. Certificate of Transfer Credential / Honorable Dismissal (Original copy)
4. Certificate of Good Moral Character (Original copy)
5. Photocopy of PSA Birth Certificate (Please bring the original copy upon submission)
6. Photocopy of PSA Marriage Contract for married female only (Please bring the original copy upon submission)
7. A Medical certificate issued by a licensed physician, with laboratory results including stool examination, urinalysis, and chest x-ray (Pregnant women are exempt from the chest X-ray requirement)
8. Drug Test Result
```

#### Found Facts (8)

suast examination result (original copy), informative copy of transcript of record (tor) (original copy), certificate of transfer credential / honorable dismissal (original copy), certificate of good moral character (original copy), photocopy of psa birth certificate (please bring the original copy upon submission), photocopy of psa marriage contract for married female only (please bring the original copy upon submission), a medical certificate issued by a licensed physician, with laboratory results including stool examination, urinalysis, and chest x-ray (pregnant women are exempt from the chest x-ray requirement), drug test result

#### Context Facts Found (8)

suast examination result (original copy), informative copy of transcript of record (tor) (original copy), certificate of transfer credential / honorable dismissal (original copy), certificate of good moral character (original copy), photocopy of psa birth certificate (please bring the original copy upon submission), photocopy of psa marriage contract for married female only (please bring the original copy upon submission), a medical certificate issued by a licensed physician, with laboratory results including stool examination, urinalysis, and chest x-ray (pregnant women are exempt from the chest x-ray requirement), drug test result

#### Found Keywords (5)

SUAST Examination Result, Transcript of Record, Certificate of Transfer Credential, Good Moral Character, PSA Birth Certificate

#### Metadata

- **Response Time:** 28386ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 18. Who is the president of DOrSU?

**Category:** leadership | **Difficulty:** easy | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 0.0% (0/0 facts found)
- **Context Accuracy:** 0.0% (0/0 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Dr. Roy G. Ponce is the President of Davao Oriental State University (DOrSU) as of 2025. Here is his comprehensive information:

**Full Name:** Dr. Roy G. Ponce

**Title:** President of Davao Oriental State University (DOrSU)

**Educational Background:**

- **Master of Assessment and Evaluation (First-Class Honor)**: The University of Melbourne, Australia (AusAID scholarship)
- **Doctor of Education in Evaluation Capacity Building**: The University of Melbourne, Australia (Australia Awards scholarship)

**Expertise Areas:**

- Biodiversity conservation
- Education
- Evaluation capacity building
- Research
- Technical consultation
- Museum curation

**Major Achievements:**

- **UNESCO Work:** Instrumental in the successful inscription of Mt. Hamiguitan as a UNESCO World Heritage Site.
- **Museums:** Established the Subangan Museum and Mt. Hamiguitan Museum in Davao Oriental.
- **Awards:** Recipient of the prestigious Australian Alumni Excellence Awards in 2017.
- **Happy Fish Kids (HFK) Project:** Co-founded the Happy Fish Kids (HFK) afterschool care project.
- **Happy Forest Kids and Happy Farm Kids Programs:** Institutionalized Happy Forest Kids and Happy Farm Kids programs as offshoots of HFK.
- **Regenerative Futures University:** Brainchild and thought-leader in positioning DOrSU as a regenerative futures university.

**Current Role:** President of Davao Oriental State University (DOrSU), the only public university in the Province of Davao Oriental.
```

#### Found Keywords (2)

Dr. Roy G. Ponce, Roy G. Ponce

#### Metadata

- **Response Time:** 36108ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 19. Who is the head of OSPAT?

**Category:** offices | **Difficulty:** hard | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 0.0% (0/0 facts found)
- **Context Accuracy:** 0.0% (0/0 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
The head of OSPAT (Office of Student Promotion, Admissions and Testing) at DOrSU as of 2025 is:

Ms. Trishea Amor C. Jacobe
Head, OSPAT
Facebook: https://www.facebook.com/dorsuadmissions
```

#### Found Keywords (3)

Ms. Trishea Amor C. Jacobe, Trishea Amor C. Jacobe, OSPAT

#### Metadata

- **Response Time:** 21311ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 20. Grand Total enrollment 2025-2026 semester 1?

**Category:** enrollment | **Difficulty:** medium | **Data Source:** dorsu_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the "enrollment2025-2026" entry, the Grand Total enrollment for DOrSU in academic year 2025-2026, 1st semester is 17,629 students (7780 male, 8849 female).
```

#### Found Facts (4)

17629, grand total, 1st, 2025-2026

#### Context Facts Found (4)

17629, grand total, 1st, 2025-2026

#### Found Keywords (2)

17629, 17,629

#### Metadata

- **Response Time:** 20349ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

