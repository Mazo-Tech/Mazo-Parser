import { supabase } from "@/integrations/supabase/client";
import type { ParsedDocument, ParsedResume } from '@/types';
import { BATCH_SIZE } from '@/utils/parser/constants';
import { extractContactInfo } from '@/utils/parser/contactExtractor';
import { extractName } from '@/utils/parser/nameExtractor';
import { getTextFromFile } from '@/utils/parser/documentTextExtractor';
import { parseWithGemini } from '@/utils/geminiParser';

// Enhanced email extraction with multiple patterns
function extractEmails(text: string): string[] {
  const emails = new Set<string>();
  
  // Pattern 1: Standard email format
  const emailPattern1 = /\b[A-Za-z0-9][A-Za-z0-9._%-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Z|a-z]{2,}\b/g;
  
  // Pattern 2: Email with label
  const emailPattern2 = /(?:email|e-mail|mail|contact|id)[\s:]*([A-Za-z0-9][A-Za-z0-9._%-]+@[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;
  
  // Pattern 3: Email in brackets or parentheses
  const emailPattern3 = /[\[\(]([A-Za-z0-9][A-Za-z0-9._%-]+@[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,})[\]\)]/g;
  
  // Pattern 4: Email with spaces (sometimes OCR creates spaces)
  const emailPattern4 = /([A-Za-z0-9._%-]+)\s*@\s*([A-Za-z0-9.-]+)\s*\.\s*([A-Za-z]{2,})/g;
  
  const patterns = [emailPattern1, emailPattern2, emailPattern3];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const email = (match[1] || match[0]).toLowerCase().trim();
      if (isValidEmail(email)) {
        emails.add(email);
      }
    }
  }
  
  // Handle spaced emails
  const spacedMatches = text.matchAll(emailPattern4);
  for (const match of spacedMatches) {
    const email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase().trim();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }
  
  // Try to find email near common keywords
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (/email|e-mail|mail|contact|reach/i.test(line)) {
      // Check current line and next 2 lines
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const matches = lines[j].matchAll(emailPattern1);
        for (const match of matches) {
          const email = match[0].toLowerCase().trim();
          if (isValidEmail(email)) {
            emails.add(email);
          }
        }
      }
    }
  }
  
  return Array.from(emails);
}

// Robust email validation
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
  if (!domain.includes('.')) return false; // Must have at least one dot in domain
  
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  if (domainParts[domainParts.length - 1].length < 2) return false; // TLD must be at least 2 chars
  
  // Check for common invalid patterns
  if (/\s/.test(email)) return false;
  if (email.includes('@.') || email.includes('.@')) return false;
  
  // Ensure it's not a common false positive
  const invalidPatterns = [
    'example.com',
    'test.com',
    'email.com',
    'domain.com',
    'company.com',
    'yourcompany.com',
    'youremail.com'
  ];
  
  for (const pattern of invalidPatterns) {
    if (email.endsWith(pattern) && localPart.length < 3) return false;
  }
  
  return true;
}

// Enhanced phone extraction with multiple patterns and validation
function extractPhones(text: string): string[] {
  const phones = new Set<string>();
  
  // Clean text for better matching
  const cleanedText = text.replace(/\s+/g, ' ');
  
  // Multiple phone patterns for different formats
  const phonePatterns = [
    // International format with country code
    /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
    
    // Format: +91 9876543210 or +91-9876543210
    /\+91[\s.-]?[6-9]\d{9}/g,
    
    // Format: 9876543210 (10 digits starting with 6-9)
    /(?:^|[\s,;(])[6-9]\d{9}(?:[\s,;)]|$)/g,
    
    // Format: (123) 456-7890
    /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g,
    
    // Format: 123-456-7890 or 123.456.7890
    /\d{3}[\s.-]\d{3}[\s.-]\d{4}/g,
    
    // Phone with label
    /(?:phone|mobile|cell|tel|telephone|contact|ph|mob)[\s:]*([+\d\s().-]{10,20})/gi,
    
    // Format with country code and spaces: +91 98765 43210
    /\+\d{1,3}[\s]?\d{5}[\s]?\d{5}/g,
    
    // Format: +1 (123) 456-7890
    /\+\d{1,3}[\s]?\(\d{3}\)[\s]?\d{3}[\s.-]?\d{4}/g,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = cleanedText.matchAll(pattern);
    for (const match of matches) {
      let phone = (match[1] || match[0]).trim();
      
      // Clean and validate
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
    if (/phone|mobile|cell|tel|contact|number/i.test(line)) {
      // Extract any digit sequences from current and next 2 lines
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        const digitSequence = lines[j].match(/[+\d\s().-]+/g);
        if (digitSequence) {
          for (const seq of digitSequence) {
            const cleaned = cleanPhone(seq);
            if (cleaned) {
              phones.add(cleaned);
            }
          }
        }
      }
    }
  }
  
  return Array.from(phones);
}

// Robust phone cleaning and validation
function cleanPhone(phone: string): string {
  // Remove common labels
  const labels = ['phone', 'mobile', 'cell', 'tel', 'telephone', 'contact', 'ph', 'mob', 'number'];
  let cleaned = phone.toLowerCase();
  
  for (const label of labels) {
    cleaned = cleaned.replace(new RegExp(label, 'gi'), '');
  }
  
  // Remove all non-digit characters except + and ()
  cleaned = cleaned.replace(/[^\d+()]/g, '');
  
  // Remove parentheses but keep their content
  cleaned = cleaned.replace(/[()]/g, '');
  
  // Replace leading 00 with +
  cleaned = cleaned.replace(/^00/, '+');
  
  // Count digits only
  const digits = cleaned.replace(/\D/g, '');
  const digitCount = digits.length;
  
  // Phone must have 10-15 digits
  if (digitCount < 10 || digitCount > 15) {
    return '';
  }
  
  // Additional validation
  if (!isValidPhone(cleaned, digits)) {
    return '';
  }
  
  // Format the phone number
  return formatPhone(cleaned, digits);
}

// Validate phone number
function isValidPhone(phone: string, digits: string): boolean {
  // Must start with + or digit
  if (!/^[+\d]/.test(phone)) return false;
  
  // Can't have multiple + signs
  if ((phone.match(/\+/g) || []).length > 1) return false;
  
  // Can't be all same digit (e.g., 1111111111)
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Can't be sequential (e.g., 1234567890)
  if (/^(?:0123456789|1234567890|9876543210)$/.test(digits)) return false;
  
  // For Indian numbers starting with 91
  if (digits.startsWith('91') && digits.length === 12) {
    const mainNumber = digits.substring(2);
    // Indian mobile numbers start with 6, 7, 8, or 9
    if (!/^[6-9]/.test(mainNumber)) return false;
  }
  
  // For 10-digit numbers (Indian mobile)
  if (digits.length === 10) {
    // Must start with 6, 7, 8, or 9
    if (!/^[6-9]/.test(digits)) return false;
  }
  
  return true;
}

// Format phone number consistently
function formatPhone(phone: string, digits: string): string {
  // If already has country code
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // For 10-digit numbers (Indian), add +91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  
  // For 11-digit numbers starting with 91
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

export const parseDocument = async (file: File, type: 'resume' | 'jd'): Promise<ParsedDocument | ParsedResume> => {
  try {
    console.log('Starting to parse document:', file.name, 'type:', file.type);
    const text = await getTextFromFile(file);
    console.log('Successfully extracted text from file:', file.name, 'Text length:', text.length);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content could be extracted from the file');
    }
    
    // Extract basic information locally first with enhanced extraction
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    
    // Use enhanced extraction functions
    const localEmails = type === 'resume' ? extractEmails(text) : [];
    const localPhones = type === 'resume' ? extractPhones(text) : [];
    const name = type === 'resume' ? extractName(text) || fileName : '';
    
    console.log('Local extraction results:', {
      emails: localEmails,
      phones: localPhones,
      name
    });
    
    // Also use the existing contact extractor as backup
    const contactInfo = type === 'resume' ? extractContactInfo(text) : { email: '', phone: '' };
    
    // Merge results - prefer enhanced extraction
    const bestEmail = localEmails[0] || contactInfo.email || '';
    const bestPhone = localPhones[0] || contactInfo.phone || '';
    
    console.log('Best contact info:', { email: bestEmail, phone: bestPhone });
    
    // Extract experience pattern from text
    const experiencePattern = extractExperienceFromText(text);
    
    // Always extract skills locally as a reliable fallback
    const localSkills = extractSkillsFromText(text, type === 'jd');
    console.log('Local skills extraction found:', localSkills.length, 'skills:', localSkills);
    
    let parsedData = null;
    
    // Try to parse with Gemini API first (Edge Function has config issues)
    try {
      console.log('Parsing with Gemini API for:', file.name);
      const geminiResult = await parseWithGemini(text, type === 'jd' ? 'job_description' : 'resume', fileName);
      
      if (geminiResult) {
        console.log('Successfully parsed document with Gemini API:', geminiResult);
        parsedData = geminiResult;
      }
    } catch (error) {
      console.error('Gemini API parsing error:', error);
      // Fall back to basic extraction if Gemini fails
      console.log('Falling back to basic extraction');
    }
    
    // Normalize skills to always be a proper array
    const normalizeSkills = (skills: any): string[] => {
      if (!skills) return [];
      
      // If it's already an array
      if (Array.isArray(skills)) {
        // Flatten any nested arrays
        const flattened = skills.flat(Infinity);
        // Filter and clean
        return flattened
          .filter(skill => skill && typeof skill === 'string' && skill.trim())
          .map(skill => skill.trim());
      }
      
      // If it's a string, try to parse it
      if (typeof skills === 'string') {
        if (skills.trim()) {
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(skills);
            if (Array.isArray(parsed)) {
              return normalizeSkills(parsed);
            }
          } catch (e) {
            // Not JSON, treat as comma or newline separated
            return skills
              .split(/[,\n;|]/)
              .map(s => s.trim())
              .filter(Boolean);
          }
        }
        return [];
      }
      
      return [];
    };
    
    // Build the final result
    if (type === 'resume') {
      // Determine the best skills to use
      let finalSkills = localSkills; // Default to local extraction
      
      if (parsedData?.skills) {
        const normalizedParsedSkills = normalizeSkills(parsedData.skills);
        if (normalizedParsedSkills.length > 0) {
          // Merge and deduplicate: prefer parsed skills but include local ones too
          finalSkills = [...new Set([...normalizedParsedSkills, ...localSkills])];
          console.log('Using merged skills (parsed + local):', finalSkills.length, 'skills');
        }
      }
      
      // If we still have no skills, use local extraction aggressively
      if (finalSkills.length === 0) {
        console.warn('No skills found from parsing, using aggressive local extraction');
        finalSkills = extractSkillsFromText(text, false, true); // aggressive mode
      }
      
      // For email and phone, prefer local extraction, then parsed data
      const finalEmail = bestEmail || parsedData?.email || '';
      const finalPhone = bestPhone || parsedData?.phone || '';
      
      // If still no email, try one more aggressive search
      if (!finalEmail) {
        console.log('No email found, trying aggressive extraction');
        const aggressiveEmails = extractEmails(text.replace(/\s+/g, ' '));
        if (aggressiveEmails.length > 0) {
          console.log('Found email through aggressive extraction:', aggressiveEmails[0]);
        }
      }
      
      const result: ParsedResume = {
        title: parsedData?.title || fileName,
        name: parsedData?.name || name || fileName,
        email: finalEmail,
        phone: finalPhone,
        skills: finalSkills,
        experience: parsedData?.experience?.toString() || experiencePattern || '',
        education: parsedData?.education || extractEducationFromText(text),
        responsibilities: normalizeSkills(parsedData?.responsibilities)
      };
      
      console.log('Final resume result:', {
        ...result,
        skillsCount: result.skills.length,
        hasEmail: !!result.email,
        hasPhone: !!result.phone
      });
      
      return result;
    } else {
      // Job Description
      let cleanTitle = parsedData?.title || fileName;
      cleanTitle = cleanTitle.replace(/^JD\s*-\s*/i, '');
      
      // Determine the best skills to use
      let finalSkills = localSkills; // Default to local extraction
      
      if (parsedData?.skills) {
        const normalizedParsedSkills = normalizeSkills(parsedData.skills);
        if (normalizedParsedSkills.length > 0) {
          finalSkills = [...new Set([...normalizedParsedSkills, ...localSkills])];
          console.log('Using merged skills (parsed + local):', finalSkills.length, 'skills');
        }
      }
      
      // If we still have no skills, use aggressive local extraction
      if (finalSkills.length === 0) {
        console.warn('No skills found from parsing, using aggressive local extraction');
        finalSkills = extractSkillsFromText(text, true, true); // aggressive mode for JD
      }
      
      const result: ParsedDocument = {
        title: cleanTitle,
        skills: finalSkills,
        experience: parsedData?.experience?.toString() || experiencePattern || '',
        responsibilities: normalizeSkills(parsedData?.responsibilities)
      };
      
      console.log('Final JD result:', {
        ...result,
        skillsCount: result.skills.length,
        skills: result.skills
      });
      
      return result;
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    
    // Even in error case, try to extract something useful
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    let text = '';
    
    try {
      text = await getTextFromFile(file);
    } catch (e) {
      console.error('Could not extract text even for fallback:', e);
    }
    
    const localSkills = text ? extractSkillsFromText(text, type === 'jd', true) : [];
    const localEmails = text && type === 'resume' ? extractEmails(text) : [];
    const localPhones = text && type === 'resume' ? extractPhones(text) : [];
    
    if (type === 'resume') {
      return {
        title: fileName,
        name: fileName,
        email: localEmails[0] || '',
        phone: localPhones[0] || '',
        skills: localSkills,
        experience: '',
        education: '',
        responsibilities: []
      } as ParsedResume;
    } else {
      return {
        title: fileName,
        skills: localSkills,
        experience: '',
        responsibilities: []
      };
    }
  }
};

// Enhanced skill extraction with aggressive mode
function extractSkillsFromText(text: string, isJobDescription = false, aggressive = false): string[] {
  const lowerText = text.toLowerCase();
  
  // Extended comprehensive skills list
  const skillKeywords = [
    // Programming Languages
    'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
    'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Objective-C', 'Dart', 'Elixir',
    
    // Frontend
    'React', 'Angular', 'Vue', 'Vue.js', 'Svelte', 'Next.js', 'Nuxt.js', 'Gatsby',
    'HTML', 'HTML5', 'CSS', 'CSS3', 'SASS', 'SCSS', 'LESS', 'Tailwind CSS', 'Bootstrap',
    'Material UI', 'Chakra UI', 'Ant Design', 'jQuery', 'Webpack', 'Vite', 'Babel',
    'Redux', 'MobX', 'Zustand', 'Recoil', 'Context API',
    
    // Backend
    'Node.js', 'Express', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot',
    '.NET', '.NET Core', 'ASP.NET', 'Laravel', 'Symfony', 'Ruby on Rails', 'Sinatra',
    'NestJS', 'Koa', 'Hapi', 'Fastify',
    
    // Databases
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Cassandra', 'Oracle', 'SQL Server',
    'MariaDB', 'SQLite', 'DynamoDB', 'Elasticsearch', 'Neo4j', 'CouchDB', 'Firebase',
    'Supabase', 'PlanetScale', 'Fauna', 'NoSQL',
    
    // Cloud & DevOps
    'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab CI',
    'GitHub Actions', 'CircleCI', 'Travis CI', 'Terraform', 'Ansible', 'Chef', 'Puppet',
    'CloudFormation', 'CI/CD', 'DevOps', 'Linux', 'Unix', 'Bash',
    
    // AWS Services
    'Lambda', 'S3', 'EC2', 'ECS', 'EKS', 'RDS', 'DynamoDB', 'CloudFront', 'Route 53',
    'API Gateway', 'SQS', 'SNS', 'CloudWatch', 'IAM', 'VPC', 'Elastic Beanstalk',
    
    // Data Science & ML
    'Machine Learning', 'Deep Learning', 'AI', 'Artificial Intelligence', 'Data Science',
    'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy', 'SciPy',
    'Matplotlib', 'Seaborn', 'NLP', 'Computer Vision', 'OpenCV', 'NLTK', 'spaCy',
    
    // Testing
    'Jest', 'Mocha', 'Chai', 'Jasmine', 'Cypress', 'Selenium', 'Playwright', 'Puppeteer',
    'JUnit', 'pytest', 'unittest', 'TestNG', 'Karma', 'Enzyme',
    
    // Mobile
    'React Native', 'Flutter', 'iOS', 'Android', 'Swift', 'Kotlin', 'Xamarin', 'Ionic',
    
    // Version Control & Collaboration
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN', 'Mercurial', 'Jira', 'Confluence',
    'Trello', 'Asana', 'Slack',
    
    // APIs & Protocols
    'REST', 'REST API', 'RESTful', 'GraphQL', 'gRPC', 'SOAP', 'WebSocket', 'Socket.io',
    'JSON', 'XML', 'Microservices', 'API Design',
    
    // Design & UI/UX
    'UI/UX', 'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'InVision',
    'Zeplin', 'Responsive Design', 'Web Design',
    
    // Methodologies
    'Agile', 'Scrum', 'Kanban', 'Waterfall', 'TDD', 'BDD', 'DDD', 'SOLID',
    
    // Other
    'Blockchain', 'Web3', 'Solidity', 'Smart Contracts', 'Ethereum', 'Big Data',
    'Hadoop', 'Spark', 'Kafka', 'RabbitMQ', 'Nginx', 'Apache', 'OAuth', 'JWT',
    'GDPR', 'Security', 'Penetration Testing', 'Cryptography'
  ];
  
  const foundSkills = new Set<string>();
  
  // Method 1: Direct keyword matching
  for (const skill of skillKeywords) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      foundSkills.add(skill);
    }
  }
  
  if (aggressive) {
    // Method 2: Pattern-based extraction for experience/knowledge statements
    const experiencePatterns = [
      /experience\s+(?:in|with)\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to|in\s+order))/gi,
      /knowledge\s+of\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
      /proficient\s+(?:in|with)\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
      /skilled\s+(?:in|with)\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
      /expertise\s+(?:in|with)\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
      /familiar\s+(?:with|in)\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
      /understanding\s+of\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
      /using\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to|in))/gi,
      /worked\s+with\s+([A-Za-z0-9\.\+\/#\s-]+?)(?:\s+(?:and|,|\.|;|for|to))/gi,
    ];
    
    for (const pattern of experiencePatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const potentialSkills = match[1]
            .split(/\s+(?:and|or)\s+|,\s*/)
            .map(s => s.trim())
            .filter(s => s.length > 2 && s.length < 30);
          
          for (const skill of potentialSkills) {
            // Check if this matches any known skill
            for (const knownSkill of skillKeywords) {
              if (skill.toLowerCase().includes(knownSkill.toLowerCase()) ||
                  knownSkill.toLowerCase().includes(skill.toLowerCase())) {
                foundSkills.add(knownSkill);
              }
            }
          }
        }
      }
    }
    
    // Method 3: Extract from bullet points
    const bulletRegex = /[•\-\*]\s*([^\n•\-\*]+)/g;
    const bullets = [...text.matchAll(bulletRegex)];
    
    for (const bullet of bullets) {
      const bulletText = bullet[1].toLowerCase();
      for (const skill of skillKeywords) {
        if (bulletText.includes(skill.toLowerCase())) {
          foundSkills.add(skill);
        }
      }
    }
  }
  
  const result = Array.from(foundSkills);
  console.log(`Skill extraction (aggressive=${aggressive}): found ${result.length} skills`);
  return result;
}

function extractExperienceFromText(text: string): string {
  const expPatterns = [
    /(\d+)(?:\+)?\s*(?:years?|yrs)(?:\s+of\s+experience)?/i,
    /experience\s*(?:of|:)?\s*(\d+)(?:\+)?\s*(?:years?|yrs)/i,
    /(\d+)(?:\+)?\s*(?:years?|yrs)(?:\s+in\s+industry)/i,
    /professional\s+experience\s*(?:of|:)?\s*(\d+)(?:\+)?\s*(?:years?|yrs)/i,
    /work(?:ing)?\s+experience\s*(?:of|:)?\s*(\d+)(?:\+)?\s*(?:years?|yrs)/i,
  ];
  
  for (const pattern of expPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return '';
}

function extractEducationFromText(text: string): string {
  const eduRegex = /(?:B\.?Tech|M\.?Tech|B\.?Sc|M\.?Sc|B\.?A|M\.?A|Ph\.?D|MBA|Bachelor|Master|Diploma)[^\n.]*(?:Engineering|Computer|Science|Information|Technology|Electronics|Electrical)[^\n.]*/i;
  const eduMatch = text.match(eduRegex);
  return eduMatch ? eduMatch[0].trim() : '';
}

export const processBatch = async <T extends File>(
  files: T[],
  type: 'resume' | 'jd',
  onProgress?: (progress: number) => void
): Promise<ParsedDocument[]> => {
  const results: ParsedDocument[] = [];
  const totalFiles = files.length;
  
  console.log(`Starting batch processing of ${files.length} files`);
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(file => parseDocument(file, type));
    
    try {
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(files.length/BATCH_SIZE)}...`);
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
          console.log(`Successfully processed ${batch[index].name}`);
        } else {
          console.error(`Failed to parse ${batch[index]?.name || 'file'}`);
        }
      });
      
      if (onProgress) {
        const progress = Math.min(((i + batch.length) / totalFiles) * 100, 100);
        onProgress(progress);
      }
      
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }
  
  console.log(`Batch processing complete. Processed ${results.length} out of ${files.length} files`);
  return results;
};

export default {
  parseDocument,
  processBatch,
};
