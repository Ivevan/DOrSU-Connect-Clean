# URL Doubling Issue - Fixed ✅

## Problem
The AI was generating **doubled URLs** like this:
```
https://dorsu.edu.ph/wp-content/uploads/https:/dorsu.edu.ph/wp-content/uploads/2025/07/2021-Annual-Accomplishment-Report.pdf
```

Instead of the correct:
```
https://dorsu.edu.ph/wp-content/uploads/2025/07/2021-Annual-Accomplishment-Report.pdf
```

## Root Cause

The issue was in the **frontend** `markdownFormatter.ts`:

1. **Backend/AI outputs:** Complete URL `https://dorsu.edu.ph/wp-content/uploads/2025/07/2021-Annual-Accomplishment-Report.pdf`
2. **Frontend `completePartialURLs()` function sees:** Pattern `2025/07/...pdf` 
3. **Frontend incorrectly thinks:** "This is a partial URL, I need to complete it!"
4. **Frontend prepends:** `https://dorsu.edu.ph/wp-content/uploads/`
5. **Result:** Doubled URL ❌

## Solution

### Updated `completePartialURLs()` Function

**Before:**
```typescript
export function completePartialURLs(text: string): string {
  if (!text) return '';
  
  // Pattern: Complete partial URLs (2025/07/...)
  return text.replace(
    /(Link:\s*)?(\d{4}\/\d{2}\/[^\s"<>]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))/gi,
    (match, prefix, partialUrl) => {
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      return (prefix || '') + fullUrl;
    }
  );
}
```

**After (Fixed):**
```typescript
export function completePartialURLs(text: string): string {
  if (!text) return '';
  
  // Pattern: Complete partial URLs (2025/07/...) but ONLY if not already in a complete URL
  // Negative lookbehind (?<!...) ensures we don't match if already part of a full URL
  return text.replace(
    /(Link:\s*)?(?<!https?:\/\/[^\s]*\/wp-content\/uploads\/)(\d{4}\/\d{2}\/[^\s"<>]+\.(pdf|jpg|png|jpeg|doc|docx|xls|xlsx))/gi,
    (match, prefix, partialUrl, ext) => {
      // Double-check: if the match is already preceded by a URL, don't process it
      const precedingText = text.substring(Math.max(0, text.indexOf(match) - 100), text.indexOf(match));
      if (precedingText.includes('https://dorsu.edu.ph/wp-content/uploads/')) {
        // Already complete - return as is
        return match;
      }
      
      const fullUrl = `https://dorsu.edu.ph/wp-content/uploads/${partialUrl}`;
      return (prefix || '') + fullUrl;
    }
  );
}
```

### Key Changes:

1. **Negative lookbehind:** `(?<!https?:\/\/[^\s]*\/wp-content\/uploads\/)` prevents matching if the pattern is already part of a complete URL
2. **Double-check:** Inspects preceding text to ensure we're not processing an already-complete URL
3. **Return as-is:** If URL is already complete, don't modify it

## Testing

To test the fix:

1. **Restart Metro bundler:**
   ```bash
   # Stop current Metro (Ctrl+C)
   npm start -- --reset-cache
   ```

2. **Test queries:**
   - "What are the annual reports?"
   - "Show me the 2021 annual report"
   - "Give me links to all annual reports"

3. **Expected behavior:**
   - URLs should appear as single, complete links
   - No doubled `https://dorsu.edu.ph/wp-content/uploads/` prefixes
   - Links should be clickable and work correctly

## Files Modified

- ✅ `frontend/src/utils/markdownFormatter.ts` - Fixed `completePartialURLs()` function

## Related Files (No changes needed)

- ✅ `backend/ai/src/services/system.js` - Already instructs AI to use complete URLs (lines 147-150)
- ✅ `backend/ai/src/utils/response-cleaner.js` - Already handles partial URLs correctly
- ✅ `backend/ai/src/server.js` - Processing pipeline is correct

## Why This Happens

The frontend's `markdownFormatter.ts` is designed to be **defensive** - it tries to fix issues in case the AI outputs partial URLs. However, it was being *too* defensive and "fixing" URLs that were already correct!

The fix ensures we only complete **truly partial** URLs while leaving **already-complete** URLs untouched.

---

**Status:** ✅ Fixed
**Date:** October 27, 2025

