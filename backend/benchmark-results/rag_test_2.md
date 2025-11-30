# RAG Pipeline Benchmark Report

**Generated:** 11/30/2025, 9:30:47 PM

---

## Summary

- **Total Queries:** 20
- **Average Retrieval Relevance:** 82.1%
- **Average Context Accuracy:** 84.6%
- **Average Hallucination Score:** 100.0% (higher is better)
- **Average Answer Correctness:** 92.5%
- **Overall Score:** 89.8%
- **Query Routing Accuracy:** 100.0% (2/2 tests passed)

## Category Performance

| Category | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |
|----------|-------|---------------------|-----------------|-------------------|-------------------|
| schedule | 10 | 94.3% | 96.3% | 100.0% | 85.0% |
| history | 1 | 100.0% | 100.0% | 100.0% | 100.0% |
| programs | 3 | 66.7% | 76.7% | 100.0% | 100.0% |
| enrollment | 2 | 100.0% | 100.0% | 100.0% | 100.0% |
| leadership | 2 | 50.0% | 50.0% | 100.0% | 100.0% |
| admission | 1 | 100.0% | 100.0% | 100.0% | 100.0% |
| offices | 1 | 0.0% | 0.0% | 100.0% | 100.0% |

## Data Source Performance

| Data Source | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |
|-------------|-------|---------------------|-----------------|-------------------|-------------------|
| schedule_data | 10 | 94.3% | 96.3% | 100.0% | 85.0% |
| dorsu_data | 10 | 70.0% | 73.0% | 100.0% | 100.0% |

## Detailed Results

### 1. Start of classes for undergraduate program in January 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
According to the knowledge base, the start of classes for the undergraduate program in January 2025 is:

- Jan 14, 2025
- Jan 17, 2025
```

#### Found Facts (4)

start of classes for undergraduate program, 1/15/2025, 1/15/2025, 2025

#### Context Facts Found (4)

start of classes for undergraduate program, 1/15/2025, 1/15/2025, 2025

#### Found Keywords (2)

1/15/2025, 2025

#### Missing Keywords (1)

January 15

#### 🎯 Query Routing Accuracy

**Status:** ✅ Correct Routing

- **Expected Collection:** schedule
- **Detected Collection:** schedule

#### Metadata

- **Response Time:** 6800ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 2. When is the final examination schedule for dec 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (7/7 facts found)
- **Context Accuracy:** 100.0% (7/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the knowledge base, the final examination schedule for the Undergraduate Program is:

- Dates: December 12, December 15 - December 18, 2025
- Time: All Day
- Category: Academic

The final examination schedule for the Graduate Program is:

- Date: December 20, 2025
- Time: All Day
- Category: Academic
```

#### Found Facts (7)

12/15/2025, 2025, december, december 15, 12/18/2025, 2025, december

#### Context Facts Found (7)

12/15/2025, 2025, december, december 15, 12/18/2025, 2025, december

#### Found Keywords (3)

12/15/2025, 12/18/2025, December

#### Metadata

- **Response Time:** 7455ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 3. Regular registration period for undergraduate program in August 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Based on the provided knowledge base, the regular registration period for the undergraduate program in August 2025 is:

• Aug 5 - Aug 9, 2025
• Aug 4 - Aug 8, 2025
```

#### Found Facts (4)

regular registration period for undergraduate program, 8/4/2025, 8/8/2025, 2025

#### Context Facts Found (4)

regular registration period for undergraduate program, 8/4/2025, 8/8/2025, 2025

#### Found Keywords (3)

8/4/2025, 8/8/2025, August

#### Metadata

- **Response Time:** 16874ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 4. When is the schedule of Siglakas in April 2025?

**Category:** schedule | **Difficulty:** easy | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 85.7% (6/7 facts found)
- **Context Accuracy:** 95.7% (6/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the provided knowledge base, Siglakas is scheduled on the following dates in 2024:

- Apr 24 - Apr 27
- Apr 23 - Apr 26
- Apr 21 - Apr 25

There is no information available for Siglakas in April 2025.
```

#### Found Facts (6)

4/23/2025, 2025, april, 4/26/2025, 2025, april

#### Missing Facts (1)

april 23

#### Context Facts Found (6)

4/23/2025, 2025, april, 4/26/2025, 2025, april

#### Context Facts Missing (1)

april 23

#### Found Keywords (3)

4/23/2025, 4/26/2025, April

#### Metadata

- **Response Time:** 32734ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 5. Preliminary examination dates for undergraduate program for February 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (7/7 facts found)
- **Context Accuracy:** 100.0% (7/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the knowledge base, the preliminary examination dates for the undergraduate program in February 2025 are:

1. February 23 - February 24, 2025
2. February 25 - February 26, 2025
```

#### Found Facts (7)

2/25/2025, 2025, february, february 25, 2/26/2025, 2025, february

#### Context Facts Found (7)

2/25/2025, 2025, february, february 25, 2/26/2025, 2025, february

#### Found Keywords (3)

2/25/2025, 2/26/2025, February

#### Metadata

- **Response Time:** 17176ms
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

- **Response Time:** 33731ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 7. Midterm examination schedule for undergraduate program in November 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the knowledge base, the midterm examination schedule for the undergraduate program in November 2025 is:

- November 4 - November 5, 2024 (Note: This is the only available date in the knowledge base for November, but it is actually for 2024. There is no information available for 2025.)

However, there is another date available for April 2024, which might not be relevant to your query.
```

#### Found Facts (4)

midterm examination for undergraduate program, 11/4/2025, 11/5/2025, 2025

#### Context Facts Found (4)

midterm examination for undergraduate program, 11/4/2025, 11/5/2025, 2025

#### Found Keywords (3)

11/4/2025, 11/5/2025, November

#### Metadata

- **Response Time:** 18441ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 8. Deadline for submission of grades in December 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 50.0% ❌

#### AI Response

```
According to the schedule events, the deadline for submission of grades in December 2025 is:

- **Deadline in Submission of the Report of Grades**
 📅 Date: Dec 31, 2025
 ⏰ Time: All Day
 🏷️ Category: Academic
```

#### Found Facts (4)

deadline in submission of the report of grades, 12/31/2025, 12/31/2025, 2025

#### Context Facts Found (4)

deadline in submission of the report of grades, 12/31/2025, 12/31/2025, 2025

#### Found Keywords (1)

12/31/2025

#### Missing Keywords (1)

December 31

#### Metadata

- **Response Time:** 38125ms
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

- **Response Time:** 34856ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 10. When is GAD summit?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (2/2 facts found)
- **Context Accuracy:** 100.0% (2/2 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
The GAD Summit is on November 1, 2025, all day.
```

#### Found Facts (2)

2025, november

#### Context Facts Found (2)

2025, november

#### Found Keywords (2)

November, 2025

#### Missing Keywords (1)

November 2025

#### Metadata

- **Response Time:** 35054ms
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

- **Response Time:** 41014ms
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

- **Response Time:** 28292ms
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

- **Response Time:** 18112ms
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

- **Response Time:** 28053ms
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
Here are the vice presidents of DOrSU as of 2025:

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

- **Response Time:** 23938ms
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

- **Response Time:** 28251ms
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

- **Response Time:** 27826ms
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

**Current Role:** President of Davao Oriental State University, the only public university in the Province of Davao Oriental.
```

#### Found Keywords (2)

Dr. Roy G. Ponce, Roy G. Ponce

#### Metadata

- **Response Time:** 36180ms
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

- **Response Time:** 21413ms
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

- **Response Time:** 20461ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

