# Lighthouse Timeout Fix - Mobile Score Showing 0

## Problem
Mobile scores were showing **0 (Poor)** in the Desktop vs Mobile comparison when Lighthouse analysis timed out after 45 seconds.

## Root Cause

1. **Lighthouse Timeouts**: The Lighthouse analyzer has a 45-second timeout when analyzing websites
2. **Slow Websites**: Sites like vail.com take longer than 45 seconds to fully load due to:
   - Heavy JavaScript execution
   - Large images and resources
   - Anti-bot protection
   - Server-side rendering delays
   
3. **Fallback Behavior**: When Lighthouse times out, the code returns:
   ```javascript
   {
     score: 0,  // Indicates failure
     performance: 0,
     accessibility: 0,
     failed: true,
     error: "Lighthouse analysis timed out after 45 seconds"
   }
   ```

4. **Misleading UI**: The UI was displaying `0` as an actual score instead of recognizing it as a failure state

## Solution

### 1. Detect Lighthouse Failures
Added logic to check if Lighthouse analysis failed:

```javascript
const lighthouseFailed = data?.lighthouse?.failed || 
                        (data?.lighthouse?.score === 0 && data?.lighthouse?.error);
```

### 2. Display "N/A" Instead of "0"
When Lighthouse fails, show:
- **"N/A"** in the score circle (instead of "0")
- **"Timeout"** label (instead of "/ 100")
- **"Analysis Failed"** grade (instead of "Poor")
- Gray colors (instead of red error colors)

### 3. Show Helpful Error Message
Display an informative message explaining why the analysis failed:

```
⏱️ Lighthouse analysis timed out after 45 seconds. 
This can happen with:
• Slow-loading websites
• Heavy JavaScript execution  
• Anti-bot protection
• Server-side rendering delays

Using alternative accessibility metrics from axe-core instead
```

### 4. Warning Banner
Added a warning banner at the top of the comparison section when any Lighthouse analysis fails:

```
⚠️ Partial Analysis
Mobile Lighthouse analysis timed out. Using alternative accessibility 
metrics from axe-core for affected platform(s).
```

### 5. Conditional Gap Analysis
Only show accessibility gap warnings when **both** desktop and mobile analyses succeeded. This prevents misleading comparisons between valid scores and timeout fallbacks.

## Visual Changes

### Before:
- Mobile: **0** (Poor) ❌ - Looks like the site scored zero
- Red error colors suggesting failure
- Misleading "gap" calculations with 0 vs actual desktop score

### After:
- Mobile: **N/A** (Analysis Failed) ⏱️ - Clear indication of timeout
- Gray neutral colors
- Helpful explanation of why analysis failed
- No misleading gap warnings

## Files Modified

- `src/public/accessibility-script.js`:
  - `createPlatformCard()` - Added failure detection and N/A display
  - `createDesktopMobileComparison()` - Added warning banner and conditional gap analysis

## Testing

To test the fix:
1. Analyze a slow-loading website (like vail.com)
2. Wait for Lighthouse to timeout after 45 seconds
3. Check the Desktop vs Mobile comparison section
4. Should see "N/A (Timeout)" instead of "0 (Poor)"
5. Should see helpful error explanation
6. Should see warning banner indicating partial analysis

## Future Improvements

Consider:
1. **Increase timeout** to 60-90 seconds for slower sites
2. **Retry logic** with exponential backoff
3. **Progressive loading** - show partial results as they come in
4. **Alternative metrics** - Use axe-core results as primary when Lighthouse fails
5. **User notification** - Alert users during scan that site is slow-loading

## Impact

This fix provides:
- ✅ **Better UX**: Users understand analysis limitations vs thinking site scored 0
- ✅ **Transparency**: Clear communication about what succeeded/failed
- ✅ **Fallback data**: Still shows axe-core accessibility metrics
- ✅ **No confusion**: Prevents misleading score comparisons with failed analyses
