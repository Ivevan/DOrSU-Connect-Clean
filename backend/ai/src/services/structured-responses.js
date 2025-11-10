/**
 * Structured Responses Service
 * Provides pre-formatted, hardcoded responses for common "list all" queries
 * to prevent AI hallucinations and save tokens
 */

/**
 * Generate structured program list response (no AI needed)
 */
export function generateProgramListResponse(groupByFaculty) {
  if (groupByFaculty) {
    return `Here are all **38 programs** offered by DOrSU (as of 2025), organized by faculty:

## 📚 UNDERGRADUATE PROGRAMS (29)

### FACET (Faculty of Computing, Engineering, and Technology)
• **BSIT** - Bachelor of Science in Information Technology
• **BSMath** - Bachelor of Science in Mathematics
• **BSMRS** - Bachelor of Science in Mathematics with Research Statistics
• **BSCE** - Bachelor of Science in Civil Engineering
• **BITM** - Bachelor in Industrial Technology Management

### FALS (Faculty of Agriculture and Life Sciences)
• **BSAM** - Bachelor of Science in Agribusiness Management
• **BSA** - Bachelor of Science in Agriculture major in Animal Science
• **BSA** - Bachelor of Science in Agriculture major in Crop Science
• **BSBio** - Bachelor of Science in Biology
• **BSBio** - Bachelor of Science in Biology major in Animal Biology
• **BSBio** - Bachelor of Science in Biology major in Ecology
• **BSES** - Bachelor of Science in Environmental Science

### FTED (Faculty of Teacher Education)
• **BEED** - Bachelor of Elementary Education
• **BCED** - Bachelor of Early Childhood Education
• **BSNED** - Bachelor of Special Needs Education
• **BPED** - Bachelor Physical Education
• **BTLED** - Bachelor of Technology and Livelihood Education major in Home Economics
• **BTLED** - Bachelor of Technology and Livelihood Education major in Industrial Arts
• **BSED** - Bachelor of Secondary Education major in English
• **BSED** - Bachelor of Secondary Education major in Filipino
• **BSED** - Bachelor of Secondary Education major in Mathematics
• **BSED** - Bachelor of Secondary Education major in Science

### FBM (Faculty of Business and Management)
• **BSBA** - Bachelor of Science in Business Administration
• **BSHM** - Bachelor of Science in Hospitality Management

### FCJE (Faculty of Criminal Justice Education)
• **BSC** - Bachelor of Science in Criminology

### FNAHS (Faculty of Nursing and Allied Health Sciences)
• **BSN** - Bachelor of Science in Nursing

### FHUSOCOM (Faculty of Humanities, Social Sciences, and Communication)
• **BSDevCom** - Bachelor of Science in Development Communication
• **AB PolSci** - Bachelor of Arts in Political Science
• **BS Psych** - Bachelor of Science in Psychology

---

## 🎓 GRADUATE PROGRAMS (9)

### Master's Programs (6)
• **MBA** - Master in Business Administration
• **MAED** - Master of Arts in Education major in Educational Management
• **MAED** - Master of Arts in Education major in Teaching English
• **MST** - Master of Science Teaching – Mathematics
• **MST** - Master of Science Teaching – General Science
• **MSES** - Master of Science in Environmental Science

### Doctoral Programs (3)
• **PhD Bio** - Doctor of Philosophy in Biology – Biodiversity
• **EdD** - Doctor of Education – Educational Leadership & Management
• **PhD ES** - Doctor of Philosophy in Environmental Science – Resource Management

**Total: 29 Undergraduate + 9 Graduate = 38 Programs**`;
  } else {
    return `DOrSU offers **38 programs** in total (as of 2025):

## 📚 UNDERGRADUATE PROGRAMS (29)
1. BSIT - Information Technology (FACET)
2. BSMath - Mathematics (FACET)
3. BSMRS - Mathematics with Research Statistics (FACET)
4. BSCE - Civil Engineering (FACET)
5. BITM - Industrial Technology Management major in Automotive (FACET)
6. BSAM - Agribusiness Management (FALS)
7. BSA - Agriculture major in Animal Science (FALS)
8. BSA - Agriculture major in Crop Science (FALS)
9. BSBio - Biology (FALS)
10. BSBio - Biology major in Animal Biology (FALS)
11. BSBio - Biology major in Ecology (FALS)
12. BSES - Environmental Science (FALS)
13. BEED - Elementary Education (FTED)
14. BCED - Early Childhood Education (FTED)
15. BSNED - Special Needs Education (FTED)
16. BPED - Physical Education (FTED)
17. BTLED - Technology & Livelihood Education major in Home Economics (FTED)
18. BTLED - Technology & Livelihood Education major in Industrial Arts (FTED)
19. BSED - Secondary Education major in English (FTED)
20. BSED - Secondary Education major in Filipino (FTED)
21. BSED - Secondary Education major in Mathematics (FTED)
22. BSED - Secondary Education major in Science (FTED)
23. BSBA - Business Administration (FBM)
24. BSHM - Hospitality Management (FBM)
25. BSC - Criminology (FCJE)
26. BSN - Nursing (FNAHS)
27. BSDevCom - Development Communication (FHUSOCOM)
28. AB PolSci - Political Science (FHUSOCOM)
29. BS Psych - Psychology (FHUSOCOM)

## 🎓 GRADUATE PROGRAMS (9)

**Master's Programs:**
1. MBA - Master in Business Administration
2. MAED - Master of Arts in Education major in Educational Management
3. MAED - Master of Arts in Education major in Teaching English
4. MST - Master of Science Teaching – Mathematics
5. MST - Master of Science Teaching – General Science
6. MSES - Master of Science in Environmental Science

**Doctoral Programs:**
7. PhD Bio - Doctor of Philosophy in Biology – Biodiversity
8. EdD - Doctor of Education – Educational Leadership & Management
9. PhD ES - Doctor of Philosophy in Environmental Science – Resource Management

**Want details about a specific program? Just ask!**`;
  }
}

/**
 * Generate officers/leadership response (no AI needed)
 */
export function generateOfficersResponse(isPresidentOnly) {
  if (isPresidentOnly) {
    return `## 👑 DORSU PRESIDENT

**Dr. Roy G. Ponce**
University President (2025)

**Education:**
• Doctorate - University of Melbourne, Australia
• Master's Degree - University of Melbourne, Australia

**Expertise:**
• Biodiversity Conservation
• Education & Research
• Sustainable Development

**Notable Achievements:**
• UNESCO work in conservation
• Museum development initiatives
• Awards in academic leadership

**Want to know about deans or other university officers?**`;
  } else {
    return `## 👥 DORSU LEADERSHIP (2025)

### 👑 UNIVERSITY PRESIDENT
**Dr. Roy G. Ponce**

### 🏛️ FACULTY DEANS

• **FACET** - Faculty of Computing, Engineering & Technology
• **FALS** - Faculty of Agriculture & Life Sciences  
• **FTED** - Faculty of Teacher Education
• **FBM** - Faculty of Business & Management
• **FCJE** - Faculty of Criminal Justice Education
• **FNAHS** - Faculty of Natural & Applied Health Sciences
• **FHUSOCOM** - Faculty of Humanities, Social Sciences & Communication

### 🏢 ADMINISTRATIVE OFFICES

• **IRO** - International Relations Office
• **IP-TBM** - Indigenous Peoples - Tribal & Business Management
• **HSU** - Health Services Unit
• **CGAD** - Center for Gender & Development

**Need specific dean names or contact info? Just ask!**`;
  }
}

/**
 * Generate faculties list response (no AI needed)
 */
export function generateFacultiesResponse() {
  return `## 🏛️ DORSU'S 7 FACULTIES

### 1️⃣ **FACET**
**Faculty of Computing, Engineering & Technology**
Programs: BSIT, BSMath, BSMRS, BSCE, BITM

### 2️⃣ **FALS**
**Faculty of Agriculture & Life Sciences**
Programs: BSAM, BSA (Animal Science, Crop Science), BSBio (Biology, Animal Biology, Ecology), BSES

### 3️⃣ **FTED**
**Faculty of Teacher Education**
Programs: BEED, BCED, BSNED, BPED, BTLED (Home Economics, Industrial Arts), BSED (English, Filipino, Mathematics, Science)

### 4️⃣ **FBM**
**Faculty of Business & Management**
Programs: BSBA, BSHM

### 5️⃣ **FCJE**
**Faculty of Criminal Justice Education**
Programs: BSC

### 6️⃣ **FNAHS**
**Faculty of Nursing & Allied Health Sciences**
Programs: BSN

### 7️⃣ **FHUSOCOM**
**Faculty of Humanities, Social Sciences & Communication**
Programs: BSDevCom, AB PolSci, BS Psych

**Want to know programs under a specific faculty? Just ask!**`;
}

/**
 * Generate campuses list response (no AI needed)
 */
export function generateCampusesResponse() {
  return `## 🏫 DORSU CAMPUSES

DOrSU has **1 Main Campus** and **5 Extension Campuses** across Davao Oriental:

### 🏢 **MAIN CAMPUS**
📍 **Mati City**, Davao Oriental
• University headquarters
• Offers all 7 faculties
• Complete undergraduate & graduate programs

---

### 🏛️ **EXTENSION CAMPUSES**

1️⃣ **Banaybanay Campus**
📍 Banaybanay, Davao Oriental

2️⃣ **Cateel Campus**
📍 Cateel, Davao Oriental

3️⃣ **Baganga Campus**
📍 Baganga, Davao Oriental

4️⃣ **Tarragona Campus**
📍 Tarragona, Davao Oriental

5️⃣ **San Isidro Campus**
📍 San Isidro, Davao Oriental

---

**Total Enrollment (2025):** 17,251 students across all campuses

**Want info about programs at a specific campus? Just ask!**`;
}
