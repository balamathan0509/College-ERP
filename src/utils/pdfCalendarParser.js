// src/utils/pdfCalendarParser.js
import * as pdfjsLib from 'pdfjs-dist';

// Set worker URL using cloudflare CDN matching pdfjsLib version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

/**
 * Helper to convert various date string formats to YYYY-MM-DD
 */
function parseDateToISO(dateStr, defaultYear = new Date().getFullYear()) {
  if (!dateStr) return null;
  const str = dateStr.trim().replace(/,/g, '');

  // 1. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    const formattedMonth = month < 10 ? `0${month}` : `${month}`;
    return `${year}-${formattedMonth}-${formattedDay}`;
  }

  // 3. Text Month Formats (e.g. "10 Oct 2026", "October 10 2026", "10 October")
  const monthsMap = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", september: "09", sept: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12"
  };

  const monthRegex = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;
  const mMatch = str.match(monthRegex);
  if (mMatch) {
    const monthKey = mMatch[1].toLowerCase();
    const monthNum = monthsMap[monthKey];
    const numMatches = str.match(/\b\d{1,4}\b/g) || [];
    let day = 1;
    let year = defaultYear;

    if (numMatches.length >= 1) {
      day = parseInt(numMatches[0], 10);
    }
    if (numMatches.length >= 2) {
      const candidateYear = parseInt(numMatches[1], 10);
      if (candidateYear > 1900) year = candidateYear;
    }

    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    return `${year}-${monthNum}-${formattedDay}`;
  }

  return null;
}

/**
 * Automatically read text from a PDF ArrayBuffer and parse out calendar events with dates
 */
export async function parsePdfToAcademicEvents(arrayBuffer) {
  const events = [];
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    let fullTextLines = [];

    // Extract text page by page
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group text items by roughly the same Y line position
      const lineMap = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineMap[y]) lineMap[y] = [];
        lineMap[y].push(item.str);
      });

      // Sort lines top to bottom
      const sortedY = Object.keys(lineMap).sort((a, b) => Number(b) - Number(a));
      sortedY.forEach(y => {
        const lineStr = lineMap[y].join(" ").trim();
        if (lineStr) fullTextLines.push(lineStr);
      });
    }

    const currentYear = new Date().getFullYear();

    // Regular expressions for dates and date ranges
    // Matches e.g. "10.10.2026 to 15.10.2026", "10/10/2026 - 15/10/2026", "10.10.2026", "10 Oct 2026"
    const datePattern = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,4})/gi;

    fullTextLines.forEach((line, index) => {
      const matches = [...line.matchAll(datePattern)].map(m => m[0]);
      if (matches.length === 0) return;

      // Determine Start Date & End Date
      let startDateStr = parseDateToISO(matches[0], currentYear);
      let endDateStr = matches.length >= 2 ? parseDateToISO(matches[1], currentYear) : startDateStr;

      if (!startDateStr) return;
      if (!endDateStr || endDateStr < startDateStr) endDateStr = startDateStr;

      // Remove the dates from the line text to get the event title
      let title = line.replace(datePattern, '').replace(/\b(?:to|-|until|thru)\b/gi, '').trim();
      title = title.replace(/^[:\-\s]+|[:\-\s]+$/g, '');

      // If title is too short or empty, check next line
      if (title.length < 3 && fullTextLines[index + 1]) {
        title = fullTextLines[index + 1].trim();
      }
      if (!title || title.length < 3) {
        title = "Academic Event";
      }

      // Determine Event Category & Class Suspension
      const lowerTitle = title.toLowerCase();
      let type = "event";
      let suspendClasses = true;

      if (/exam|cia|internal|test|assessment|mid-term|end sem/i.test(lowerTitle)) {
        type = "exam";
        suspendClasses = true;
      } else if (/holiday|vacation|jayanti|pongal|diwali|deepavali|leave|puja|gandhi|independence|republic/i.test(lowerTitle)) {
        type = "holiday";
        suspendClasses = true;
      } else if (/visit|iv|workshop|seminar|webinar/i.test(lowerTitle)) {
        type = "iv";
        suspendClasses = false;
      } else if (/review|submission|milestone|viva|project/i.test(lowerTitle)) {
        type = "milestone";
        suspendClasses = false;
      }

      events.push({
        id: "evt_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        title: title,
        type: type,
        startDate: startDateStr,
        endDate: endDateStr,
        targetYear: "All Years",
        suspendClasses: suspendClasses,
        autoExtracted: true
      });
    });

    // Remove duplicates by title + startDate
    const uniqueEvents = [];
    const seen = new Set();
    events.forEach(evt => {
      const key = `${evt.startDate}_${evt.endDate}_${evt.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvents.push(evt);
      }
    });

    uniqueEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return uniqueEvents;
  } catch (err) {
    console.error("PDF Parsing Exception:", err);
    return [];
  }
}
