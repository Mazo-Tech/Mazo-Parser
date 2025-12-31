
export const extractName = (text: string): string => {
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .trim();

  // Get first few lines where name usually appears
  const headerLines = cleanText.split('\n').slice(0, 20);
  
  // Clean and format name helper
  const cleanName = (name: string): string => {
    return name
      .replace(/resume|cv|curriculum\s+vitae|profile|updated|latest/gi, '')
      .replace(/^\s*[-–—•|]\s*/, '')
      .replace(/\s*[-–—•|]\s*$/, '')
      .replace(/[^\w\s.']/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*,.*$/, '')
      .trim()
      .split(' ')
      .filter(part => 
        part && 
        part.length > 1 &&
        !/^(?:Mr|Mrs|Ms|Miss|Dr|Er|Sr|Prof|Eng)\.?$/i.test(part) &&
        !/^(?:resume|cv|profile)$/i.test(part)
      )
      .join(' ');
  };

  // Try each pattern for name matching
  const namePatterns = [
    // Name with metadata (most reliable)
    /(?:Name|Full Name|Candidate Name|Applicant)\s*[:|\n]\s*([A-Z][A-Za-z.\s]{2,40})/i,
    
    // South Indian name with dots and initials
    /^(?:[A-Z]\.)+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/,
    
    // Name with dot (e.g., "P.Gopi Krishnan", "Perumal.K")
    /^([A-Z]\.?[A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*(?:\.[A-Z])?)/,
    
    // Name with space-separated initial at start (e.g., "P Gopi Krishnan")
    /^([A-Z]\s+[A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/,
    
    // Name with initial at end (e.g., "Gopi Krishnan P")
    /^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+[A-Z]\.?)/,
    
    // All caps name (e.g., "MURUGAN P", "YOGALAKSHMI S")
    /^([A-Z][A-Z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][A-Z]+)*)/,
    
    // Standard name format with optional initial
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z]\.?)?)/,
    
    // Name near contact info
    /([A-Z][A-Za-z.\s]{2,40}?)[\s\n]+(?:Mobile|Phone|Email|Contact|Tel)[:]/i
  ];

  // Process each line
  for (const line of headerLines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines or lines with typical header words
    if (!trimmedLine || /(?:resume|cv|profile|contact|address|phone|email|summary|objective)/i.test(trimmedLine)) {
      continue;
    }

    // Try each pattern
    for (const pattern of namePatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        let cleaned = cleanName(match[1]);
        
        // Validate the cleaned name
        if (cleaned && 
            cleaned.length >= 3 && 
            /^[A-Z]/.test(cleaned) && // Must start with capital letter
            !/^\d/.test(cleaned) && // Must not start with number
            cleaned.split(' ').length >= 1 && // Must have at least one part
            cleaned.split(' ').every(part => part.length >= 1) // Each part must be non-empty
        ) {
          // Format all-caps names properly
          if (cleaned === cleaned.toUpperCase()) {
            cleaned = cleaned
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
          
          // Handle double spaces and normalize dots
          cleaned = cleaned
            .replace(/\s+/g, ' ')
            .replace(/\.+/g, '.')
            .trim();
          
          return cleaned;
        }
      }
    }
  }

  return '';
};
