const Tesseract = require('tesseract.js');
const UploadedFile = require('../models/UploadedFile');

/**
 * OCR Service
 * Processes uploaded files with Tesseract.js
 * Updates file record with OCR results
 * Fails gracefully - file stays saved even if OCR fails
 */

// ── Process a single file ──────────────────────────────────────────────────────
const processFile = async (fileId, filePath, mimeType) => {
  // Update status to processing
  await UploadedFile.findByIdAndUpdate(fileId, {
    $set: { ocrStatus: 'processing' },
  });

  try {
    // PDFs need special handling - Tesseract works best on images
    // For PDFs we do best-effort OCR on first page
    let ocrText = '';

    if (mimeType === 'application/pdf') {
      // Tesseract can attempt PDF but results may vary
      // Best effort - admin can enter data manually if OCR fails
      try {
        const result = await Tesseract.recognize(filePath, 'eng', {
          logger: () => {}, // Suppress verbose logging
        });
        ocrText = result.data.text;
      } catch {
        ocrText = '';
      }
    } else {
      // Image files (PNG, JPG)
      const result = await Tesseract.recognize(filePath, 'eng', {
        logger: () => {},
      });
      ocrText = result.data.text;
    }

    // Parse grid structure from OCR text (best-effort)
    const parsedGrid = parseGridFromText(ocrText);

    await UploadedFile.findByIdAndUpdate(fileId, {
      $set: {
        ocrStatus: 'completed',
        ocrResult: {
          rawText: ocrText,
          parsedGrid,
          processedAt: new Date(),
        },
      },
    });

    return { success: true, parsedGrid };
  } catch (error) {
    await UploadedFile.findByIdAndUpdate(fileId, {
      $set: {
        ocrStatus: 'failed',
        ocrError: error.message,
      },
    });

    return { success: false, error: error.message };
  }
};

// ── Parse grid structure from raw OCR text ─────────────────────────────────────
// Best-effort extraction - returns structured data if patterns found
const parseGridFromText = (text) => {
  if (!text || !text.trim()) return null;

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const result = {
    detectedDays: [],
    detectedPeriods: [],
    cells: [],
    rawLines: lines.slice(0, 50), // First 50 lines for preview
  };

  // Detect days mentioned in text
  for (const day of days) {
    if (text.toLowerCase().includes(day.toLowerCase())) {
      result.detectedDays.push(day);
    }
  }

  // Detect period patterns (Period 1, P1, 1st period etc.)
  const periodPatterns = [
    /period\s*(\d+)/gi,
    /p(\d+)\b/gi,
    /(\d+)(st|nd|rd|th)\s*period/gi,
  ];

  const foundPeriods = new Set();
  for (const pattern of periodPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1]);
      if (num >= 1 && num <= 12) foundPeriods.add(num);
    }
  }
  result.detectedPeriods = [...foundPeriods].sort((a, b) => a - b);

  // Try to extract table cells
  // Look for lines that might be table rows (contain | or tab separators)
  for (const line of lines) {
    if (line.includes('|') || line.includes('\t')) {
      const cells = line
        .split(/[|\t]/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length >= 2) {
        result.cells.push(cells);
      }
    }
  }

  return result;
};

module.exports = { processFile, parseGridFromText };