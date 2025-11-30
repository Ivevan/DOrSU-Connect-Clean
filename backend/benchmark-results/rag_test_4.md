# RAG Pipeline Benchmark Report

**Generated:** 11/30/2025, 10:48:58 PM

---

## Summary

- **Total Queries:** 20
- **Average Retrieval Relevance:** 82.1%
- **Average Context Accuracy:** 84.6%
- **Average Hallucination Score:** 100.0% (higher is better)
- **Average Answer Correctness:** 96.7%
- **Overall Score:** 90.9%
- **Query Routing Accuracy:** 50.0% (1/2 tests passed)

## Category Performance

| Category | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |
|----------|-------|---------------------|-----------------|-------------------|-------------------|
| schedule | 10 | 94.3% | 96.3% | 100.0% | 93.3% |
| history | 1 | 100.0% | 100.0% | 100.0% | 100.0% |
| programs | 3 | 66.7% | 76.7% | 100.0% | 100.0% |
| enrollment | 2 | 100.0% | 100.0% | 100.0% | 100.0% |
| leadership | 2 | 50.0% | 50.0% | 100.0% | 100.0% |
| admission | 1 | 100.0% | 100.0% | 100.0% | 100.0% |
| offices | 1 | 0.0% | 0.0% | 100.0% | 100.0% |

## Data Source Performance

| Data Source | Count | Retrieval Relevance | Context Accuracy | Hallucination Score | Answer Correctness |
|-------------|-------|---------------------|-----------------|-------------------|-------------------|
| schedule_data | 10 | 94.3% | 96.3% | 100.0% | 93.3% |
| dorsu_data | 10 | 70.0% | 73.0% | 100.0% | 100.0% |

## Detailed Results

### 1. Start of classes for undergraduate program in January 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the schedule events, the Start of Classes for Undergraduate Program is on January 15, 2025.
```

#### Found Facts (4)

start of classes for undergraduate program, 1/15/2025, 1/15/2025, 2025

#### Context Facts Found (4)

start of classes for undergraduate program, 1/15/2025, 1/15/2025, 2025

#### Found Keywords (3)

1/15/2025, January 15, 2025

#### 🎯 Query Routing Accuracy

**Status:** ✅ Correct Routing

- **Expected Collection:** schedule
- **Detected Collection:** schedule

#### Metadata

- **Response Time:** 2144ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 2. When is the final examination schedule for dec 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 85.7% (6/7 facts found)
- **Context Accuracy:** 95.7% (6/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the schedule events, the final examination schedule for December 2025 is as follows:

- **Final Examination for Undergraduate Program**
 📅 Dates: Dec 12, 2025, Dec 15, 2025 - Dec 18, 2026
 ⏰ Time: All Day
 🏷️ Category: Academic

- **Final Examination for Graduate Program**
 📅 Date: Dec 20, 2025
 ⏰ Time: All Day
 🏷️ Category: Academic
```

#### Found Facts (6)

12/15/2025, 2025, december, 12/18/2025, 2025, december

#### Missing Facts (1)

december 15

#### Context Facts Found (6)

12/15/2025, 2025, december, 12/18/2025, 2025, december

#### Context Facts Missing (1)

december 15

#### Found Keywords (3)

12/15/2025, 12/18/2025, December

#### Metadata

- **Response Time:** 7722ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 3. Regular registration period for undergraduate program in August 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
According to the schedule events, the Regular Registration Period for Undergraduate Program is from Aug 4, 2025 - Aug 8, 2025.
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

- **Response Time:** 2731ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 4. When is the schedule of Siglakas in April 2025?

**Category:** schedule | **Difficulty:** easy | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (7/7 facts found)
- **Context Accuracy:** 100.0% (7/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
According to the schedule events, Siglakas is scheduled from April 23, 2025 to April 26, 2025.
```

#### Found Facts (7)

4/23/2025, 2025, april, april 23, 4/26/2025, 2025, april

#### Context Facts Found (7)

4/23/2025, 2025, april, april 23, 4/26/2025, 2025, april

#### Found Keywords (3)

4/23/2025, 4/26/2025, April

#### Metadata

- **Response Time:** 19006ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 5. Preliminary examination dates for undergraduate program for February 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 57.1% (4/7 facts found)
- **Context Accuracy:** 67.1% (4/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 66.7% ❌

#### AI Response

```
According to the schedule events, the Preliminary Examination for Undergraduate Program is on:

- Feb 25, 2025 - Feb 26, 2025
All Day.
```

#### Found Facts (4)

2/25/2025, 2025, 2/26/2025, 2025

#### Missing Facts (3)

february, february 25, february

#### Context Facts Found (4)

2/25/2025, 2025, 2/26/2025, 2025

#### Context Facts Missing (3)

february, february 25, february

#### Found Keywords (2)

2/25/2025, 2/26/2025

#### Missing Keywords (1)

February

#### Metadata

- **Response Time:** 23514ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 6. When is the commencement exercises for AY 2024-2025?

**Category:** schedule | **Difficulty:** easy | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (7/7 facts found)
- **Context Accuracy:** 100.0% (7/7 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
The Commencement Exercises for AY 2024-2025 is scheduled on June 23, 2025 - June 27, 2025.
```

#### Found Facts (7)

6/23/2025, 2025, june, june 23, 6/27/2025, 2025, june

#### Context Facts Found (7)

6/23/2025, 2025, june, june 23, 6/27/2025, 2025, june

#### Found Keywords (3)

6/23/2025, 6/27/2025, June

#### Metadata

- **Response Time:** 46999ms
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
According to the schedule events, the Midterm Examination for Undergraduate Program is on:

- Nov 4, 2025 - Nov 5, 2025
 Category: Academic
```

#### Found Facts (4)

midterm examination for undergraduate program, 11/4/2025, 11/5/2025, 2025

#### Context Facts Found (4)

midterm examination for undergraduate program, 11/4/2025, 11/5/2025, 2025

#### Found Keywords (3)

11/4/2025, 11/5/2025, November

#### Metadata

- **Response Time:** 24600ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 8. Deadline for submission of grades in December 2025?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (4/4 facts found)
- **Context Accuracy:** 100.0% (4/4 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
Deadline for submission of the Report of Grades is December 31, 2025.
```

#### Found Facts (4)

deadline in submission of the report of grades, 12/31/2025, 12/31/2025, 2025

#### Context Facts Found (4)

deadline in submission of the report of grades, 12/31/2025, 12/31/2025, 2025

#### Found Keywords (2)

12/31/2025, December 31

#### Metadata

- **Response Time:** 27949ms
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

- **Response Time:** 47401ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

### 10. When is GAD summit?

**Category:** schedule | **Difficulty:** medium | **Data Source:** schedule_data

#### Metrics

- **Retrieval Relevance:** 100.0% (2/2 facts found)
- **Context Accuracy:** 100.0% (2/2 facts, KB used: Yes)
- **Hallucination Score:** 100.0% (No hallucinations)
- **Answer Correctness:** 100.0% ✅

#### AI Response

```
The GAD Summit is scheduled on November 2025 (month-only event, no specific date).
```

#### Found Facts (2)

2025, november

#### Context Facts Found (2)

2025, november

#### Found Keywords (3)

November, November 2025, 2025

#### Metadata

- **Response Time:** 34944ms
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
November 1997.
```

#### Found Facts (5)

1997, 1997-11, november, 1997, november

#### Context Facts Found (5)

1997, 1997-11, november, 1997, november

#### Found Keywords (2)

1997, November

#### 🎯 Query Routing Accuracy

**Status:** ❌ Routing Issue Detected

- **Expected Collection:** knowledge_chunks
- **Detected Collection:** unknown
- **Issue:** Response lacks knowledge base content (may not have routed to knowledge_chunks)

#### Metadata

- **Response Time:** 43952ms
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

- **Response Time:** 29390ms
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

- **Response Time:** 967ms
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

- **Response Time:** 27674ms
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

- **Response Time:** 25019ms
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

- **Response Time:** 29192ms
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

- **Response Time:** 29460ms
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

* Master of Assessment and Evaluation (First-Class Honor), The University of Melbourne, Australia (AusAID scholarship)
* Doctor of Education in Evaluation Capacity Building, The University of Melbourne, Australia (Australia Awards scholarship)

**Expertise Areas:**

* Biodiversity conservation
* Education
* Evaluation capacity building
* Research
* Technical consultation
* Museum curation

**Major Achievements:**

* Instrumental in the successful inscription of Mt. Hamiguitan as a UNESCO World Heritage Site
* Established the Subangan Museum and Mt. Hamiguitan Museum in Davao Oriental
* Honored by the discovery of weevil species Metapocyrtus poncei named after him
* Co-founded Happy Fish Kids (HFK) afterschool care project
* Recipient of prestigious Australian Alumni Excellence Awards in 2017
* Institutionalized Happy Forest Kids and Happy Farm Kids programs as offshoots of HFK
* Brainchild and thought-leader in positioning DOrSU as a regenerative futures university

**Current Role:** President of Davao Oriental State University (DOrSU), the only public university in the Province of Davao Oriental.
```

#### Found Keywords (2)

Dr. Roy G. Ponce, Roy G. Ponce

#### Metadata

- **Response Time:** 37273ms
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

- **Response Time:** 22430ms
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
According to the "enrollment2025-2026" chunk, the Grand Total enrollment for DOrSU in academic year 2025-2026, 1st semester is 17,629 students (7780 male, 8849 female).
```

#### Found Facts (4)

17629, grand total, 1st, 2025-2026

#### Context Facts Found (4)

17629, grand total, 1st, 2025-2026

#### Found Keywords (2)

17629, 17,629

#### Metadata

- **Response Time:** 22360ms
- **Model:** llama-3.1-8b-instant
- **Used Knowledge Base:** Yes

---

