// ════════════════════════════════════════════════════════════════════════════════════════
// NATIONAL LIVE SYNC - COMPLETE FIX WITH 4-DIGIT YEAR DISPLAY
// ════════════════════════════════════════════════════════════════════════════════════════
//
// FIXES:
// 1. cleanDate() now handles 2-digit year input (6/1/26 → parses as 2026)
// 2. All date OUTPUT uses full 4-digit years (6/1/2026)
//
// ════════════════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════════════
// FIX #1: REPLACE YOUR cleanDate() FUNCTION WITH THIS
// ═══════════════════════════════════════════════════════════════════════════════════════

function cleanDate(val) {
  if (!val) return null;
  
  // If already a valid Date object, return it
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  const str = String(val).trim();
  
  // Skip placeholder values
  if (str.toLowerCase().includes("pending") || str.toLowerCase().includes("tbd")) {
    return null;
  }
  
  // Parse date parts manually to handle 2-digit years
  const cleanedString = str.split(' ')[0];  // Remove any time component
  const parts = cleanedString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  
  if (parts) {
    let year = parseInt(parts[3], 10);
    if (year < 100) year += 2000;  // "26" → 2026, "25" → 2025
    
    const month = parseInt(parts[1], 10) - 1;  // JS months are 0-indexed
    const day = parseInt(parts[2], 10);
    
    const dt = new Date(year, month, day);
    
    // Validate the date was constructed correctly
    if (dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === day) {
      return dt;
    }
  }
  
  // Fallback to standard parsing (for full 4-digit year formats)
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  
  // Sanity check year
  if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return null;
  
  return d;
}


// ═══════════════════════════════════════════════════════════════════════════════════════
// FIX #2: HELPER FUNCTION TO FORMAT DATES WITH FULL 4-DIGIT YEAR
// Add this new function to your script
// ═══════════════════════════════════════════════════════════════════════════════════════

function formatDateFull(dateVal) {
  if (!dateVal) return "";
  
  // If it's a string, parse it first
  if (typeof dateVal === 'string') {
    dateVal = cleanDate(dateVal);
  }
  
  if (!dateVal || !(dateVal instanceof Date) || isNaN(dateVal.getTime())) {
    return "";
  }
  
  // Format with full 4-digit year: M/d/yyyy
  return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "M/d/yyyy");
}


// ═══════════════════════════════════════════════════════════════════════════════════════
// FIX #3: UPDATE THE updateMasterTracking() FUNCTION
// Find the section where uniqueItems is populated and update the date formatting
// ═══════════════════════════════════════════════════════════════════════════════════════

/*
FIND THIS CODE (around line 180-190):

      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, {
          id: id,
          rawDate: Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "M/d/yyyy"),
          endDate: endDate ? Utilities.formatDate(endDate, Session.getScriptTimeZone(), "M/d/yyyy") : "",
          progEndDate: progEndDate ? Utilities.formatDate(progEndDate, Session.getScriptTimeZone(), "M/d/yyyy") : "",
          ...

IT SHOULD ALREADY USE "M/d/yyyy" which gives 4-digit years. But to be safe, you can 
use the new formatDateFull() helper:

          rawDate: formatDateFull(rawDate),
          endDate: formatDateFull(endDate),
          progEndDate: formatDateFull(progEndDate),
*/


// ═══════════════════════════════════════════════════════════════════════════════════════
// FIX #4: ENSURE SHEET NUMBER FORMAT USES 4-DIGIT YEAR
// Find the formatting section at the end of updateMasterTracking() and update it
// ═══════════════════════════════════════════════════════════════════════════════════════

/*
FIND THIS CODE (around line 250):

      // --- FORCE COLUMN FORMATTING ---
      // Col 1, 2, 3 (Start Date, End Date, Prog End): Date
      masterSheet.getRange(2, 1, finalOutput.length - 1, 3).setNumberFormat("M/d/yyyy");
      
      // Numbers and Final Dates
      masterSheet.getRange(2, 12, finalOutput.length - 1, 3).setNumberFormat("0");
      // First Install/Completion are the last 2 columns (15, 16)
      masterSheet.getRange(2, 15, finalOutput.length - 1, 2).setNumberFormat("M/d/yyyy");

THIS IS CORRECT - "M/d/yyyy" displays as 6/1/2026

If your sheet is still showing 2-digit years, Google Sheets might be auto-formatting.
To force it, you can use this more explicit format:

      masterSheet.getRange(2, 1, finalOutput.length - 1, 3).setNumberFormat("m/d/yyyy");
      masterSheet.getRange(2, 15, finalOutput.length - 1, 2).setNumberFormat("m/d/yyyy");

Or even more explicit:
      masterSheet.getRange(2, 1, finalOutput.length - 1, 3).setNumberFormat("mm/dd/yyyy");
*/


// ═══════════════════════════════════════════════════════════════════════════════════════
// TEST FUNCTION - Run this to verify everything works
// ═══════════════════════════════════════════════════════════════════════════════════════

function testDateDisplayFix() {
  const testCases = [
    "6/1/26",      
    "1/5/26",      
    "7/28/25",     
    "9/1/25",      
    "6/28/26",     
    "6/1/2026",    
  ];
  
  console.log("Testing date parsing and display:\n");
  console.log("INPUT          → PARSED DATE OBJECT → FORMATTED OUTPUT");
  console.log("─".repeat(60));
  
  testCases.forEach(testVal => {
    const parsed = cleanDate(testVal);
    if (parsed) {
      const formatted = formatDateFull(parsed);
      console.log(`"${testVal}"`.padEnd(15) + ` → ${parsed.toDateString().padEnd(20)} → ${formatted}`);
    } else {
      console.log(`"${testVal}"`.padEnd(15) + ` → NULL`);
    }
  });
  
  console.log("\n" + "─".repeat(60));
  console.log("✅ All dates should show 4-digit years in the OUTPUT column");
  
  SpreadsheetApp.getActiveSpreadsheet().toast("Test complete - check View → Execution log", "Done", 5);
}


// ═══════════════════════════════════════════════════════════════════════════════════════
// EXPECTED TEST OUTPUT:
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// INPUT          → PARSED DATE OBJECT → FORMATTED OUTPUT
// ────────────────────────────────────────────────────────────
// "6/1/26"       → Mon Jun 01 2026     → 6/1/2026
// "1/5/26"       → Mon Jan 05 2026     → 1/5/2026
// "7/28/25"      → Mon Jul 28 2025     → 7/28/2025
// "9/1/25"       → Mon Sep 01 2025     → 9/1/2025
// "6/28/26"      → Sun Jun 28 2026     → 6/28/2026
// "6/1/2026"     → Mon Jun 01 2026     → 6/1/2026
// ────────────────────────────────────────────────────────────
// ✅ All dates should show 4-digit years in the OUTPUT column
//
// ═══════════════════════════════════════════════════════════════════════════════════════
