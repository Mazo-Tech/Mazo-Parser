// Enhanced and robust contact information extractor

// Comprehensive email validation
function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 100) return false;
  
  // Must have exactly one @
  if ((email.match(/@/g) || []).length !== 1) return false;
  
  const [localPart, domain] = email.split('@');
  
  // Local part validation
  if (!localPart || localPart.length === 0 || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..')) return false;
  if (!/^[A-Za-z0-9._%-]+$/.test(localPart)) return false;
  
  // Domain validation
  if (!domain || domain.length === 0 || domain.length > 255) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.includes('..')) return false;
  if (!domain.includes('.')) return false;
  
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  if (domainParts[domainParts.length - 1].length < 2) return false;
  
  // Check for spaces
  if (/\s/.test(email)) return false;
  if (email.includes('@.') || email.includes('.@')) return false;
  
  // Filter out placeholder emails
  const invalidDomains = [
    'example.com',
    'test.com',
    'email.com',
    'domain.com',
    'company.com',
    'yourcompany.com',
    'youremail.com',
    'sample.com'
  ];
  
  for (const invalidDomain of invalidDomains) {
    if (email.endsWith(invalidDomain) && localPart.length < 3) return false;
  }
  
  return true;
}

// Extract emails using multiple strategies
function extractEmailsFromText(text: string): string[] {
  const emails = new Set<string>();
  const cleanedText = text.replace(/\s+/g, ' ');
  
  // Strategy 1: Standard email regex
  const emailRegex1 = /\b[A-Za-z0-9][A-Za-z0-9._%-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Z|a-z]{2,}\b/g;
  
  // Strategy 2: Email with common prefixes
  const emailRegex2 = /(?:email|e-mail|mail|contact|id|e\.?mail)[\s:]*([A-Za-z0-9][A-Za-z0-9._%-]+@[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;
  
  // Strategy 3: Email in brackets/parentheses
  const emailRegex3 = /[\[\(]([A-Za-z0-9][A-Za-z0-9._%-]+@[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,})[\]\)]/g;
  
  // Strategy 4: Email with possible spaces (OCR errors)
  const emailRegex4 = /([A-Za-z0-9._%-]+)\s*@\s*([A-Za-z0-9.-]+)\s*\.\s*([A-Za-z]{2,})/g;
  
  // Apply regex patterns
  const patterns = [emailRegex1, emailRegex2, emailRegex3];
  
  for (const pattern of patterns) {
    const matches = cleanedText.matchAll(pattern);
    for (const match of matches) {
      const email = (match[1] || match[0]).toLowerCase().trim();
      if (isValidEmail(email)) {
        emails.add(email);
      }
    }
  }
  
  // Handle spaced emails
  const spacedMatches = cleanedText.matchAll(emailRegex4);
  for (const match of spacedMatches) {
    const email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase().trim();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }
  
  // Strategy 5: Search near email-related keywords
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (/\b(?:email|e-mail|mail|contact|reach|write)/i.test(line)) {
      // Check current line and next 2 lines
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const lineMatches = lines[j].matchAll(emailRegex1);
        for (const match of lineMatches) {
          const email = match[0].toLowerCase().trim();
          if (isValidEmail(email)) {
            emails.add(email);
          }
        }
      }
    }
  }
  
  // Strategy 6: Look in first 30 lines (header area)
  const headerLines = lines.slice(0, 30).join('\n');
  const headerMatches = headerLines.matchAll(emailRegex1);
  for (const match of headerMatches) {
    const email = match[0].toLowerCase().trim();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }
  
  return Array.from(emails);
}

// Validate phone number
function isValidPhone(phone: string, digits: string): boolean {
  // Must start with + or digit
  if (!/^[+\d]/.test(phone)) return false;
  
  // Can't have multiple + signs
  if ((phone.match(/\+/g) || []).length > 1) return false;
  
  // Can't be all same digit
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Can't be obviously fake sequences
  const fakeSequences = ['1234567890', '0123456789', '9876543210', '1111111111', '0000000000'];
  if (fakeSequences.includes(digits)) return false;
  
  // For 12-digit numbers starting with 91 (Indian with country code)
  if (digits.startsWith('91') && digits.length === 12) {
    const mainNumber = digits.substring(2);
    if (!/^[6-9]/.test(mainNumber)) return false;
  }
  
  // For 10-digit numbers (Indian mobile)
  if (digits.length === 10) {
    if (!/^[6-9]/.test(digits)) return false;
  }
  
  // For 11-digit numbers starting with 1 (US/Canada)
  if (digits.length === 11) {
    if (!digits.startsWith('1')) return false;
  }
  
  return true;
}

// Format phone number consistently
function formatPhone(phone: string, digits: string): string {
  // If already has country code
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // For 10-digit Indian numbers
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  
  // For 12-digit numbers starting with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  
  // For 11-digit numbers starting with 1 (US/Canada)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // For other international numbers
  if (digits.length > 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  
  return '';
}

// Clean and validate phone number
function cleanPhone(phone: string): string {
  // Remove common labels
  const labels = [
    'phone', 'mobile', 'cell', 'tel', 'telephone', 'contact', 
    'ph', 'mob', 'number', 'call', 'reach'
  ];
  
  let cleaned = phone.toLowerCase();
  
  for (const label of labels) {
    cleaned = cleaned.replace(new RegExp(`\\b${label}\\b`, 'gi'), '');
  }
  
  // Remove all non-digit characters except +
  cleaned = cleaned.replace(/[^\d+]/g, '');
  
  // Replace leading 00 with +
  cleaned = cleaned.replace(/^00/, '+');
  
  // Count digits
  const digits = cleaned.replace(/\D/g, '');
  const digitCount = digits.length;
  
  // Phone must have 10-15 digits
  if (digitCount < 10 || digitCount > 15) {
    return '';
  }
  
  // Validate
  if (!isValidPhone(cleaned, digits)) {
    return '';
  }
  
  // Format
  return formatPhone(cleaned, digits);
}

// Extract phones using multiple strategies
function extractPhonesFromText(text: string): string[] {
  const phones = new Set<string>();
  const cleanedText = text.replace(/\s+/g, ' ');
  
  // Multiple phone patterns
  const phonePatterns = [
    // International with country code
    /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
    
    // Indian format: +91 9876543210
    /\+91[\s.-]?[6-9]\d{9}/g,
    
    // Indian format: 9876543210
    /(?:^|[\s,;(])[6-9]\d{9}(?:[\s,;)]|$)/g,
    
    // US format: (123) 456-7890
    /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g,
    
    // Standard: 123-456-7890
    /\d{3}[\s.-]\d{3}[\s.-]\d{4}/g,
    
    // With label
    /(?:phone|mobile|cell|tel|telephone|contact|ph|mob)[\s:]*([+\d\s().-]{10,20})/gi,
    
    // With spaces: +91 98765 43210
    /\+\d{1,3}[\s]?\d{5}[\s]?\d{5}/g,
    
    // Full format: +1 (123) 456-7890
    /\+\d{1,3}[\s]?\(\d{3}\)[\s]?\d{3}[\s.-]?\d{4}/g,
    
    // Compact 10-digit
    /\b\d{10}\b/g,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = cleanedText.matchAll(pattern);
    for (const match of matches) {
      let phone = (match[1] || match[0]).trim();
      const cleaned = cleanPhone(phone);
      if (cleaned) {
        phones.add(cleaned);
      }
    }
  }
  
  // Look for phones near keywords
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (/\b(?:phone|mobile|cell|tel|contact|number|call|reach)\b/i.test(line)) {
      // Check current and next 2 lines
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        // Extract any digit sequences
        const digitMatches = lines[j].match(/[+\d\s().-]{10,20}/g);
        if (digitMatches) {
          for (const seq of digitMatches) {
            const cleaned = cleanPhone(seq);
            if (cleaned) {
              phones.add(cleaned);
            }
          }
        }
      }
    }
  }
  
  // Look in header (first 30 lines)
  const headerLines = lines.slice(0, 30);
  for (const line of headerLines) {
    // Try to find 10-digit sequences that could be phone numbers
    const potentialPhones = line.match(/\b\d{10}\b/g);
    if (potentialPhones) {
      for (const phone of potentialPhones) {
        const cleaned = cleanPhone(phone);
        if (cleaned) {
          phones.add(cleaned);
        }
      }
    }
  }
  
  return Array.from(phones);
}

// Main export function
export const extractContactInfo = (text: string) => {
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();

  // Extract emails
  const emails = extractEmailsFromText(cleanText);
  
  // Extract phones
  const phones = extractPhonesFromText(cleanText);
  
  console.log('Enhanced contact extraction results:', {
    emailsFound: emails.length,
    phonesFound: phones.length,
    emails: emails,
    phones: phones
  });

  return {
    email: emails[0] || '',
    phone: phones[0] || ''
  };
};

// Also export individual functions for use in DocumentParser
export { extractEmailsFromText as extractEmails, extractPhonesFromText as extractPhones };
