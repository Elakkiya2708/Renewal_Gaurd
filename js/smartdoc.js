/* ==========================================================================
   js/smartdoc.js — AI SmartDoc Document & Certificate Intelligence Engine
   Automatically extracts renewal dates, issuing authorities, document titles,
   reference numbers, and costs from uploaded certificates, contracts & licenses.
   ========================================================================== */

(function (global) {
  "use strict";

  const MONTHS = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function cleanText(t) {
    return (t || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
  }

  // Parse any textual or numeric date into standard ISO YYYY-MM-DD
  function parseDateToISO(str) {
    if (!str) return null;
    const s = String(str).trim().replace(/^[^\w\d]+|[^\w\d]+$/g, "");

    // 1. ISO: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${pad(m)}-${pad(d)}`;
      }
    }

    // 2. Named month: "October 15, 2027", "15 Oct 2027", "15th October 2027", "Oct 15, 2027"
    const monthNameMatch = s.match(/\b(?:(\d{1,2})(?:st|nd|rd|th)?[\s,-]+)?([a-z]{3,9})[\s,-]+(?:(\d{1,2})(?:st|nd|rd|th)?[\s,-]+)?(20\d{2})\b/i);
    if (monthNameMatch) {
      const mStr = monthNameMatch[2].toLowerCase();
      if (MONTHS[mStr]) {
        const m = MONTHS[mStr];
        const d = parseInt(monthNameMatch[1] || monthNameMatch[3] || "1", 10);
        const y = parseInt(monthNameMatch[4], 10);
        if (d >= 1 && d <= 31) {
          return `${y}-${pad(m)}-${pad(d)}`;
        }
      }
    }

    // 3. DD/MM/YYYY or MM/DD/YYYY
    const slashMatch = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (slashMatch) {
      const part1 = parseInt(slashMatch[1], 10);
      const part2 = parseInt(slashMatch[2], 10);
      const y = parseInt(slashMatch[3], 10);
      let d = part1;
      let m = part2;
      if (part1 > 12 && part2 <= 12) {
        d = part1;
        m = part2;
      } else if (part2 > 12 && part1 <= 12) {
        m = part1;
        d = part2;
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${pad(m)}-${pad(d)}`;
      }
    }

    return null;
  }

  // Fallback scanner: extracts ASCII text chunks directly from PDF binary buffers
  function extractRawTextFromBinary(buffer) {
    try {
      const bytes = new Uint8Array(buffer);
      let str = "";
      const len = Math.min(bytes.length, 500000);
      for (let i = 0; i < len; i++) {
        const c = bytes[i];
        if (c === 10 || c === 13 || (c >= 32 && c <= 126)) {
          str += String.fromCharCode(c);
        } else if (str.length > 0 && str[str.length - 1] !== " ") {
          str += " ";
        }
      }

      // Extract parentheses strings commonly used by PDF text instructions: (Hello World) Tj
      const chunks = [];
      const regex = /\(([^\r\n()]{3,120})\)\s*T[jd]/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        chunks.push(match[1]);
      }
      if (chunks.length > 3) {
        return chunks.join(" ");
      }
      return str;
    } catch (_) {
      return "";
    }
  }

  // Extract text from PDF files using pdfjsLib or binary stream scanner
  async function extractTextFromPDF(file, onProgress) {
    if (onProgress) onProgress(20, "Reading PDF document structure...");
    const arrayBuffer = await file.arrayBuffer();

    // 1. Try PDF.js if loaded
    if (global.pdfjsLib) {
      try {
        if (onProgress) onProgress(40, "Parsing PDF pages & text layer...");
        const typedArray = new Uint8Array(arrayBuffer);
        const loadingTask = global.pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;
        let fullText = "";
        const maxPages = Math.min(pdf.numPages, 5);

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          fullText += pageText + "\n";
        }

        if (fullText.trim().length > 20) {
          if (onProgress) onProgress(90, "Text extracted successfully.");
          return fullText;
        }
      } catch (err) {
        console.warn("[SmartDoc] PDF.js parsing warning:", err);
      }
    }

    // 2. Binary stream scanner fallback
    if (onProgress) onProgress(60, "Scanning PDF streams for text & dates...");
    const rawText = extractRawTextFromBinary(arrayBuffer);
    if (rawText.trim().length > 30) {
      return rawText;
    }

    return file.name;
  }

  // Extract text from Image scans (PNG, JPG, WEBP) using Tesseract.js OCR
  async function extractTextFromImage(file, onProgress) {
    if (onProgress) onProgress(20, "Initializing OCR scanner...");

    // 1. Check if Tesseract.js is available
    if (global.Tesseract && typeof global.Tesseract.recognize === "function") {
      try {
        if (onProgress) onProgress(35, "Recognizing certificate text with OCR...");
        const ret = await global.Tesseract.recognize(file, "eng", {
          logger: (m) => {
            if (m && m.status === "recognizing text" && onProgress) {
              const p = Math.round(35 + (m.progress || 0) * 55);
              onProgress(Math.min(p, 92), `Recognizing text (${Math.round((m.progress || 0) * 100)}%)...`);
            }
          },
        });
        if (ret && ret.data && ret.data.text && ret.data.text.trim().length > 10) {
          if (onProgress) onProgress(95, "OCR scan completed!");
          return ret.data.text;
        }
      } catch (err) {
        console.warn("[SmartDoc] Tesseract OCR error:", err);
      }
    }

    // 2. Fallback if Tesseract not yet ready
    if (onProgress) onProgress(75, "Analyzing image metadata & file hints...");
    await new Promise((r) => setTimeout(r, 400));
    return file.name;
  }

  // Master file reader
  async function extractTextFromFile(file, onProgress) {
    if (!file) return "";
    const name = (file.name || "").toLowerCase();

    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      return extractTextFromPDF(file, onProgress);
    } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(name)) {
      return extractTextFromImage(file, onProgress);
    } else {
      // Text file
      if (onProgress) onProgress(50, "Reading document contents...");
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result || "");
        reader.onerror = () => resolve(file.name);
        reader.readAsText(file);
      });
    }
  }

  // Core Certificate Intelligence NLP & Pattern Extraction
  function parseCertificateData(rawText, fileName = "") {
    const text = cleanText(rawText);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    let expiryDate = null;
    let issueDate = null;
    let title = "";
    let organization = "";
    let referenceNumber = "";
    let cost = 0;
    let category = "Certification";
    let confidence = 86;

    // 1. Extract Expiry / Renewal Date (The primary requirement!)
    const expiryPatterns = [
      /(?:valid\s*(?:until|through|thru|to|upto|up\s*to)|expires?(?:\s*on|\s*at)?|expiry\s*date|expiration\s*date|renewal\s*date|renew\s*before|period\s*(?:to|upto)|validity\s*to|not\s*after)[:\s]+([^\n\r,;]{4,35})/i,
      /(?:from|effective)[\s\S]*?(?:to|until|through)\s+([^\n\r,;]{4,35})/i,
      /(?:period\s*of\s*insurance)[:\s]*[^\n\r]*?\bto\s+([^\n\r,;]{4,35})/i,
      /(?:expires|expiry|validity|renew)[:\s]*([0-9a-z\s,.-]{6,30})/i,
    ];

    for (const pat of expiryPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const parsed = parseDateToISO(match[1]);
        if (parsed) {
          expiryDate = parsed;
          confidence += 8;
          break;
        }
      }
    }

    // 2. Extract Issue Date
    const issuePatterns = [
      /(?:issue\s*date|issued\s*on|date\s*of\s*issue|effective\s*date|start\s*date|not\s*before|certified\s*on)[:\s]+([^\n\r,;]{4,35})/i,
      /(?:period\s*of\s*insurance)[:\s]*[^\n\r]*?\bfrom\s+([^\n\r,;]{4,35})/i,
    ];
    for (const pat of issuePatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const parsed = parseDateToISO(match[1]);
        if (parsed) {
          issueDate = parsed;
          break;
        }
      }
    }

    // 3. Fallback date scan: look for all dates mentioned in the text
    const allDates = [];
    const dateRegex = /\b(?:(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})|(?:\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})|(?:[a-z]{3,9}\s+\d{1,2},?\s+20\d{2})|(?:\d{1,2}\s+[a-z]{3,9},?\s+20\d{2}))\b/gi;
    let m;
    while ((m = dateRegex.exec(text)) !== null) {
      const d = parseDateToISO(m[0]);
      if (d && !allDates.includes(d)) allDates.push(d);
    }

    if (!expiryDate && allDates.length > 0) {
      allDates.sort();
      // Latest date in a certificate is typically the renewal/expiration date
      expiryDate = allDates[allDates.length - 1];
      if (allDates.length > 1 && !issueDate) {
        issueDate = allDates[0];
      }
    }

    // Filename date hint if document didn't have one
    if (!expiryDate && fileName) {
      const fnDate = parseDateToISO(fileName);
      if (fnDate) expiryDate = fnDate;
    }

    // If only issue date is known, check "Valid for X Years" or default 1-3 years
    if (issueDate && !expiryDate) {
      const periodMatch = text.match(/valid\s*(?:for)?\s*(\d+)\s*years?/i);
      const years = periodMatch ? parseInt(periodMatch[1], 10) : 1;
      const [iy, im, id] = issueDate.split("-").map(Number);
      expiryDate = `${iy + years}-${pad(im)}-${pad(id)}`;
    }

    // Default sensible fallback: 1 year from now if no date found
    if (!expiryDate) {
      const now = new Date();
      expiryDate = `${now.getFullYear() + 1}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    // 4. Extract Organization / Provider / Authority
    const orgPatterns = [
      /(?:issued\s*by|issuing\s*authority|organization|provider|vendor|company|insurer|certifying\s*body)[:\s]+([^\n\r,;]{3,60})/i,
      /(?:c=us,\s*o=)([^,\n]+)/i,
    ];
    for (const pat of orgPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        organization = match[1].trim();
        break;
      }
    }

    const knownOrgs = [
      { name: "Amazon Web Services", match: /amazon\s*web\s*services|aws/i },
      { name: "Google Cloud", match: /google\s*cloud|gcp/i },
      { name: "Microsoft Corporation", match: /microsoft|azure/i },
      { name: "Cisco Systems", match: /cisco/i },
      { name: "Let's Encrypt", match: /let's\s*encrypt/i },
      { name: "DigiCert", match: /digicert/i },
      { name: "Cloudflare, Inc.", match: /cloudflare/i },
      { name: "HDFC ERGO General Insurance", match: /hdfc\s*ergo/i },
      { name: "ICICI Lombard", match: /icici\s*lombard/i },
      { name: "Dell Technologies", match: /dell(?:\s*technologies)?/i },
      { name: "Coursera", match: /coursera/i },
      { name: "CompTIA", match: /comptia/i },
      { name: "Project Management Institute (PMI)", match: /project\s*management\s*institute|pmi\b/i },
    ];

    if (!organization) {
      for (const ko of knownOrgs) {
        if (ko.match.test(text) || ko.match.test(fileName)) {
          organization = ko.name;
          confidence += 4;
          break;
        }
      }
    }

    // 5. Extract Title / Certificate Name
    const certTitlePatterns = [
      /(?:certificate\s+of\s+[a-z0-9 &,-]+)/i,
      /(?:(?:aws|google\s*cloud|azure|cisco|comptia|red\s*hat|oracle)\s+certified\s+[a-z0-9 &,-]+)/i,
      /([a-z0-9 &,-]+\s+certificate)/i,
      /([a-z0-9 &,-]+\s+licen[sc]e)/i,
      /([a-z0-9 &,-]+\s+insurance\s+policy)/i,
      /([a-z0-9 &,-]+\s+warranty)/i,
    ];

    for (const pat of certTitlePatterns) {
      const match = text.match(pat);
      if (match && match[0]) {
        const candidate = match[0].trim().replace(/\s{2,}/g, " ");
        if (candidate.length > 5 && candidate.length < 80) {
          title = candidate;
          confidence += 4;
          break;
        }
      }
    }

    if (!title) {
      if (fileName) {
        title = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
        title = title.replace(/\b\w/g, (c) => c.toUpperCase());
      } else if (lines.length > 0) {
        title = lines[0].slice(0, 80);
      }
    }

    // 6. Extract Certificate / Policy / Reference Number
    const refPatterns = [
      /(?:certificate\s*(?:no|num|number|id)|cert\s*id|policy\s*(?:no|num|number|id)|license\s*(?:no|num|number|id)|credential\s*id|validation\s*(?:number|id)|serial\s*(?:number|no))[:\s#]+([a-z0-9-_/]+)/i,
      /(?:service\s*tag)[:\s#]+([a-z0-9]+)/i,
    ];
    for (const pat of refPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        referenceNumber = match[1].trim();
        confidence += 3;
        break;
      }
    }

    // 7. Extract Cost / Fee (if mentioned)
    const costMatch =
      text.match(/(?:[$€£₹]|(?:rs\.?)|(?:usd))\s*([\d,]+(?:\.\d{2})?)/i) ||
      text.match(/([\d,]+(?:\.\d{2})?)\s*(?:usd|eur|gbp|inr)/i);
    if (costMatch && costMatch[1]) {
      const parsedCost = parseFloat(costMatch[1].replace(/,/g, ""));
      if (!isNaN(parsedCost) && parsedCost > 0) {
        cost = parsedCost;
      }
    }

    // 8. Classify Category
    const lower = (text + " " + fileName).toLowerCase();
    if (lower.includes("insurance") || lower.includes("policy") || lower.includes("premium") || lower.includes("coverage")) {
      category = "Insurance";
    } else if (lower.includes("ssl") || lower.includes("tls") || lower.includes("domain") || lower.includes("security")) {
      category = "Security";
    } else if (lower.includes("license") || lower.includes("licence") || lower.includes("permit")) {
      category = "License";
    } else if (lower.includes("warranty") || lower.includes("guarantee")) {
      category = "Warranty";
    } else if (lower.includes("vehicle") || lower.includes("car") || lower.includes("pollution") || lower.includes("fitness")) {
      category = "Vehicle";
    } else if (lower.includes("contract") || lower.includes("agreement") || lower.includes("sla") || lower.includes("lease")) {
      category = "Contract";
    } else if (lower.includes("subscription") || lower.includes("membership") || lower.includes("saas")) {
      category = "Subscription";
    } else {
      category = "Certification";
    }

    return {
      title: title || "Certificate Document",
      expiryDate: expiryDate,
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      organization: organization || "Certifying Authority",
      referenceNumber: referenceNumber || "",
      cost: cost || 0,
      category,
      confidence: Math.min(99.4, confidence),
      rawSnippet: text.slice(0, 450),
    };
  }

  // Pre-configured original sample certificates for instant testing
  const SAMPLES = {
    aws: {
      fileName: "AWS_Certified_Solutions_Architect_Certificate.pdf",
      text: `AWS Certified Solutions Architect - Associate
This is to certify that Elakkiya K has successfully completed the certification requirements.
Validation Number: AWS0392817492
Issue Date: October 15, 2024
Expiration Date: October 15, 2027
Amazon Web Services Training and Certification
Verification URL: https://aws.amazon.com/verification`,
    },
    insurance: {
      fileName: "HDFC_ERGO_Vehicle_Comprehensive_Policy.pdf",
      text: `Certificate of Insurance & Policy Schedule
Insurer: HDFC ERGO General Insurance Company Ltd.
Policy Number: 2311-5092-8819-00-000
Insured Name: Elakkiya
Vehicle Registration: TN-09-CB-1234
Period of Insurance: From 12:00 hrs on 20/06/2024 to Midnight of 19/06/2027
Next Renewal Due: 19/06/2027
Total Premium Paid: Rs. 14,850.00`,
    },
    license: {
      fileName: "Commercial_Trade_License_Certificate.pdf",
      text: `GOVERNMENT OF TAMIL NADU
COMMERCIAL TAXES AND LICENSING DEPARTMENT
TRADE LICENSE CERTIFICATE
License No: TL/2024/88491
Grantee: RenewGaurd Technologies
Effective Date: 01/04/2024
Valid Until: 31/03/2029
Statutory Annual Renewal Fee: $1,200.00
This license is valid subject to statutory provisions and annual renewal filing.`,
    },
  };

  global.SmartDoc = {
    extractTextFromFile,
    parseCertificateData,
    parseDateToISO,
    SAMPLES,
  };
})(typeof window !== "undefined" ? window : this);
