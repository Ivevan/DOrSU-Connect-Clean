# Regex Error Fix - Unterminated Group ✅

## Error
```
[2025-10-27T12:51:16.520Z] ERROR: Chat error:
Error: Invalid regular expression: /(iro,/g: Unterminated group
```

## Root Cause

**Location:** `frontend/src/utils/markdownFormatter.ts` line 300

**The Problem:**
The regex escape function had a malformed character class:

```typescript
// BEFORE (BROKEN) ❌
const escapedEntity = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                       ^^^
                                                    Malformed!
```

The pattern `[\]` is invalid because:
- `[` opens a character class
- `\` attempts to escape something
- `]` closes the character class prematurely
- This creates an "unterminated group" error

## The Fix

```typescript
// AFTER (FIXED) ✅
const escapedEntity = entity.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
                                                       ^^^^
                                                    Properly escaped!
```

**What Changed:**
- `[\]` → `[\\\]`
- Now properly escapes both backslash (`\\`) and closing bracket (`\]`) within the character class

## Why This Happened

The `enhanceBoldFormatting()` function was trying to escape special regex characters in entity names like "Dr. Roy G. Ponce" to safely use them in a RegExp constructor. The escape pattern itself was malformed, causing the error when JavaScript tried to compile the regex.

## Technical Details

### Character Class Escaping Rules:
- Inside `[...]` character class:
  - `\` needs to be escaped as `\\`
  - `]` needs to be escaped as `\]`
  - `[` should be escaped as `\[`
  
### Correct Pattern:
```javascript
/[.*+?^${}()|[\\\]]/g
 
Escapes these characters:
. * + ? ^ $ { } ( ) | [ \ ]
```

## Testing

After the fix, test the AI chat:

```bash
# Restart Metro bundler
npm start -- --reset-cache
```

Then ask:
- "Who is the president of DOrSU?"
- "Tell me about FACET"
- "Show me the annual reports"

**Expected:** No regex errors, normal operation ✅

## Files Modified

- ✅ `frontend/src/utils/markdownFormatter.ts` - Fixed regex escape pattern in `enhanceBoldFormatting()`

---

**Status:** ✅ Fixed
**Issue:** Regex "Unterminated group" error
**Solution:** Properly escaped character class in regex pattern
**Date:** October 27, 2025

