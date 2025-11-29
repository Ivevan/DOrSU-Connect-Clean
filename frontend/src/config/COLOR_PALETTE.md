# DOrSU Connect Color Palette

## Overview

The DOrSU Connect application uses a carefully selected color palette that reflects the values and identity of the university. Each color has been chosen for its symbolic meaning and visual impact.

## Primary Colors

### Royal Blue
**Hex Code:** `#2563EB`  
**Symbolic Meaning:** Excellence, Spirituality, and Competence

**Usage:**
- Primary buttons and interactive elements
- Student-related indicators and badges
- Active states and selected items
- Navigation highlights
- Main UI elements that require emphasis

**Variants:**
- **University Blue** (`#1E3A8A`): Darker variant for hover states and emphasis
- **Light Blue** (`#3B82F6`): Lighter variant for hover states
- **Very Light Blue** (`#DBEAFE`): Background colors and subtle highlights

### Golden Yellow
**Hex Code:** `#FBBF24`  
**Symbolic Meaning:** Commitment and Integrity

**Usage:**
- Faculty-related indicators and badges
- Special highlights and important notices
- Secondary actions that need to stand out
- Important alerts and notifications

**Variants:**
- **Amber** (`#F59E0B`): Darker variant for hover states and warnings
- **Light Yellow** (`#FCD34D`): Lighter variant for hover states
- **Very Light Yellow** (`#FEF3C7`): Background colors and subtle highlights

## Background Gradients

### Light Mode
- **Primary:** `#FBF8F3` (Light beige)
- **Secondary:** `#F8F5F0` (Medium beige)
- **Tertiary:** `#F5F2ED` (Darker beige)

Creates a warm, welcoming atmosphere while maintaining excellent readability.

### Dark Mode
- **Primary:** `#0B1220` (Dark blue-black)
- **Secondary:** `#111827` (Dark gray-blue)
- **Tertiary:** `#1F2937` (Dark gray)

Provides depth and visual interest while reducing eye strain in low-light conditions.

## Semantic Color Mappings

### User Types
- **Student:** Royal Blue (`#2563EB`)
- **Faculty:** Golden Yellow (`#FBBF24`)

### Status Colors
- **Active:** Royal Blue (`#2563EB`)
- **Inactive:** Gray (`#9CA3AF`)

### Action Colors
- **Primary:** Royal Blue (`#2563EB`)
- **Secondary:** Golden Yellow (`#FBBF24`)

## Color Psychology

### Royal Blue
Royal Blue is associated with:
- **Excellence:** Represents high standards and quality
- **Spirituality:** Reflects wisdom and inner peace
- **Competence:** Conveys trustworthiness and professionalism

This color is ideal for representing students and primary actions, as it communicates reliability and academic excellence.

### Golden Yellow
Golden Yellow is associated with:
- **Commitment:** Shows dedication and perseverance
- **Integrity:** Represents honesty and moral principles

This color is perfect for faculty indicators, as it reflects the commitment and integrity of educators.

## Implementation

Import the color palette in your components:

```typescript
import { COLORS, colorPalette, semanticColors } from '../config/colorPalette';

// Use predefined constants
const primaryColor = COLORS.ROYAL_BLUE;
const facultyColor = COLORS.FACULTY;

// Use semantic mappings
const studentColor = semanticColors.student; // #2563EB
const facultyColor = semanticColors.faculty; // #FBBF24

// Use color variants
const hoverColor = colorPalette.royalBlue.light; // #3B82F6
const backgroundColor = colorPalette.royalBlue.veryLight; // #DBEAFE
```

## Best Practices

1. **Consistency:** Always use the predefined color constants rather than hardcoding hex values
2. **Contrast:** Ensure sufficient contrast ratios for accessibility (WCAG AA minimum)
3. **Semantic Usage:** Use colors according to their symbolic meanings
4. **Variants:** Use lighter/darker variants for hover states and visual hierarchy
5. **Dark Mode:** Always test colors in both light and dark modes

## Accessibility

All colors in this palette have been tested for:
- **WCAG AA compliance** for text contrast
- **Color blindness compatibility** (blue and yellow are distinguishable for most color vision deficiencies)
- **Readability** in both light and dark modes

## Color History

This palette was established to:
- Reflect the values of DOrSU (Excellence, Spirituality, Competence, Commitment, Integrity)
- Create a cohesive visual identity across the application
- Ensure accessibility and usability for all users
- Distinguish between student and faculty interfaces while maintaining brand consistency

