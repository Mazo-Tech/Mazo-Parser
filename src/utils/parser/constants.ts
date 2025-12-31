export const NAME_PATTERNS = [
  // Full name pattern with all possible characters
  /^[\s\n]*([A-Z][A-Za-z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9\s.'_-]+)*)[\s\n]*/,
  
  // Name with dots and special characters
  /^[\s\n]*([A-Z][A-Za-z0-9.'_-]+(?:\s+[A-Z][A-Za-z0-9.'_-]+)*)[\s\n]*/,
  
  // Name after resume/cv keyword
  /(?:resume|cv|curriculum\s+vitae)\s*(?:of|for)?[\s:\n]+([A-Z][A-Za-z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9\s.'_-]+)*)[\s\n]*/i,
  
  // Name with common resume headers
  /(?:^|\n)(?:name|full name|candidate name|applicant)[\s:\n]+([A-Z][A-Za-z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9\s.'_-]+)*)[\s\n]*/i,
  
  // Name in all caps
  /^[\s\n]*([A-Z][A-Z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9]+)*)[\s\n]*/,
  
  // Name with professional title pattern
  /([A-Z][A-Za-z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9\s.'_-]+)*)\s*(?:[-–|]\s*)?(?:Software Engineer|Developer|Engineer|Manager|Consultant|Analyst|Designer)/i,
  
  // Name with common LinkedIn URL pattern
  /([A-Z][A-Za-z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9\s.'_-]+)*)\s*(?:[-–|•]\s*)?(?:linkedin\.com\/in\/|github\.com\/)/i,
  
  // Name with credentials
  /([A-Z][A-Za-z0-9\s.'_-]+(?:\s+[A-Z][A-Za-z0-9\s.'_-]+)*),?\s*(?:PhD|MBA|MSc|BSc|BE|MS|ME|BTech|MTech)/i
];

export const EMAIL_PATTERNS = [
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\.[A-Za-z]{2,}/g,
  /(?:Email|E-mail|E):?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i
];

export const PHONE_PATTERNS = [
  /(?:\+\d{1,3}[-.\s]?)?\d{10}/g,
  /\+\d{1,3}\s*\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
  /[6789]\d{9}/g,
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
];

export const BATCH_SIZE = 10;
