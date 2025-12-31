import { ParsedDocument, ParsedResume } from '@/types';

// IMPORTANT: Get a new Gemini API key from https://makersuite.google.com/app/apikey
// The previous key was leaked and has been revoked
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
  promptFeedback?: {
    blockReason?: string;
  };
}

// Helper function to preprocess text for better extraction
function preprocessText(text: string): string {
  return text
    // Normalize line breaks and spacing
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Normalize common section headers
    .replace(/\b(skills|experience|education|qualifications|contact|information|profile|summary)\s*:/gi, 
             (match) => '\n' + match.charAt(0).toUpperCase() + match.slice(1).toLowerCase())
    // Normalize bullet points
    .replace(/[•\-\*]\s+/g, '• ')
    .trim();
}

// Helper function to create a structured response from unstructured text
function createStructuredResponse(text: string, documentType: 'resume' | 'job_description', fileName: string): ParsedDocument | ParsedResume {
  // Preprocess the text for better extraction
  const processedText = preprocessText(text);
  
  // Extract basic information using regex patterns
  if (documentType === 'resume') {
    // Extract name - try multiple patterns
    const namePatterns = [
      /name[:\s]+(.*?)(?:\n|$)/i,
      /^([A-Z][a-z]+(\s[A-Z][a-z]+)+)(?:\n|$)/m,
      /curriculum\s+vitae\s*(?:\n|\r\n|\r)\s*([A-Z][a-z]+(\s[A-Z][a-z]+)+)/i,
      /resume\s*(?:\n|\r\n|\r)\s*([A-Z][a-z]+(\s[A-Z][a-z]+)+)/i,
      /([A-Z][a-z]+(\s[A-Z][a-z]+){1,3})\s*(?:\n|\r\n|\r)(?:.*?@|.*?\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4})/
    ];
    
    let nameMatch = null;
    for (const pattern of namePatterns) {
      nameMatch = processedText.match(pattern);
      if (nameMatch) break;
    }
    
    // Extract email - try multiple patterns
    const emailPatterns = [
      /email[:\s]+(.*?)(?:\n|$)/i,
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i,
      /contact(?:\s|:)+(?:[^@\n]*?)([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i
    ];
    
    let emailMatch = null;
    for (const pattern of emailPatterns) {
      emailMatch = processedText.match(pattern);
      if (emailMatch) break;
    }
    
    // Extract phone - try multiple patterns
    const phonePatterns = [
      /phone[:\s]+(.*?)(?:\n|$)/i,
      /(?:phone|mobile|cell|tel|telephone)(?:\s|:)+([+\d\s\(\)\-\.]{10,20})/i,
      /(\+?\d{1,3}[-\.\s]?\(?\d{3}\)?[-\.\s]?\d{3}[-\.\s]?\d{4})/i,
      /(?:^|\s)(\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4})(?:$|\s)/m
    ];
    
    let phoneMatch = null;
    for (const pattern of phonePatterns) {
      phoneMatch = processedText.match(pattern);
      if (phoneMatch) break;
    }
    
    // Extract skills - look for skills section or keywords
    const skillsPatterns = [
      /skills[:\s]+(.*?)(?:\n\n|$)/is,
      /technical\s+skills[:\s]+(.*?)(?:\n\n|$)/is,
      /core\s+competencies[:\s]+(.*?)(?:\n\n|$)/is,
      /competencies[:\s]+(.*?)(?:\n\n|$)/is,
      /expertise[:\s]+(.*?)(?:\n\n|$)/is
    ];
    
    let skillsText = null;
    for (const pattern of skillsPatterns) {
      skillsText = processedText.match(pattern);
      if (skillsText) break;
    }
    
    // If no skills section found, try to extract common technical skills
    const skills = skillsText ? 
      skillsText[1].split(/[,;\n•]/).map(s => s.trim()).filter(Boolean) : 
      extractCommonSkills(processedText);
    
    // Extract experience - look for years mentioned
    const expPatterns = [
      /(?:experience|work)[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /(\d+)\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|work)/i,
      /(?:experience|work)[:\s]+(\d+)\s*(?:years?|yrs?)/i,
      /total\s+experience[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /overall\s+experience[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /(\d+)\s*(?:years?|yrs?)\s+total\s+experience/i,
      /(\d+)\s*(?:years?|yrs?)\s+overall\s+experience/i
    ];
    
    let expMatch = null;
    for (const pattern of expPatterns) {
      expMatch = processedText.match(pattern);
      if (expMatch) break;
    }
    
    // If no explicit experience found, try to calculate from work history
    const calculatedExperience = expMatch ? expMatch[1] : extractExperienceYears(processedText);
    
    // Extract education - look for education section
    const eduPatterns = [
      /education[:\s]+(.*?)(?:\n\n|$)/is,
      /academic\s+background[:\s]+(.*?)(?:\n\n|$)/is,
      /qualification[s]?[:\s]+(.*?)(?:\n\n|$)/is,
      /degree[s]?[:\s]+(.*?)(?:\n\n|$)/is
    ];
    
    let eduMatch = null;
    for (const pattern of eduPatterns) {
      eduMatch = processedText.match(pattern);
      if (eduMatch) break;
    }
    
    // If education wasn't found but there are mentions of degrees, extract those
    if (!eduMatch) {
      const degreeMatch = processedText.match(/(?:Bachelor|Master|PhD|B\.?(?:A|S|E|Tech)|M\.?(?:A|S|E|Tech)|Diploma)[^\n]+/i);
      if (degreeMatch) {
        eduMatch = [null, degreeMatch[0]];
      }
    }
    
    // Clean up the extracted values
    const name = nameMatch ? nameMatch[1].trim() : extractNameFromFilename(fileName);
    const email = emailMatch ? emailMatch[1].trim() : '';
    const phone = phoneMatch ? phoneMatch[1].trim().replace(/\s+/g, ' ') : '';
    const experience = expMatch ? expMatch[1] : extractExperienceYears(processedText);
    const education = eduMatch ? eduMatch[1].trim() : '';
    
    return {
      name: name,
      email: email,
      phone: phone,
      skills: skills,
      experience: experience,
      education: education
    } as ParsedResume;
  } else {
    // Job description parsing
    
    // Extract job title - try multiple patterns
    const titlePatterns = [
      /job\s+title[:\s]+(.*?)(?:\n|$)/i,
      /position[:\s]+(.*?)(?:\n|$)/i,
      /title[:\s]+(.*?)(?:\n|$)/i,
      /^\s*([A-Z][a-zA-Z\s]+(?:Developer|Engineer|Designer|Manager|Analyst|Specialist|Consultant|Architect|Lead|Director|Officer|Administrator|Coordinator|Supervisor|Head))\s*$/im,
      /([A-Z][a-zA-Z\s]+(?:Developer|Engineer|Designer|Manager|Analyst|Specialist|Consultant|Architect|Lead|Director|Officer|Administrator|Coordinator|Supervisor|Head))\s*(?:\n|$)/i
    ];
    
    let titleMatch = null;
    for (const pattern of titlePatterns) {
      titleMatch = processedText.match(pattern);
      if (titleMatch) break;
    }
    
    // If still no title, try to extract from filename
    if (!titleMatch) {
      const fileNameTitle = extractTitleFromFilename(fileName);
      if (fileNameTitle) {
        titleMatch = [null, fileNameTitle];
      }
    }
    
    // Extract skills - try multiple patterns
    const skillsPatterns = [
      /(?:required|preferred)\s+skills[:\s]+(.*?)(?:\n\n|$)/is,
      /skills[:\s]+(.*?)(?:\n\n|$)/is,
      /requirements[:\s]+(.*?)(?:\n\n|$)/is,
      /qualifications[:\s]+(.*?)(?:\n\n|$)/is,
      /technical\s+(?:skills|requirements)[:\s]+(.*?)(?:\n\n|$)/is
    ];
    
    let skillsText = null;
    for (const pattern of skillsPatterns) {
      skillsText = processedText.match(pattern);
      if (skillsText) break;
    }
    
    // If no skills section found, try to extract common technical skills
    const skills = skillsText ? 
      skillsText[1].split(/[,;\n•]/).map(s => s.trim()).filter(Boolean) : 
      extractCommonSkills(processedText);
    
    // Extract experience requirement - try multiple patterns
    const expPatterns = [
      /(?:required|minimum)\s+(?:experience|work)[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /(\d+)\s*(?:\+)?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|work)/i,
      /experience[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /total\s+experience[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /overall\s+experience[:\s]+(?:[^\n]*?)(\d+)\s*(?:years?|yrs?)/i,
      /(\d+)\s*(?:\+)?\s*(?:years?|yrs?)\s+total\s+experience/i,
      /(\d+)\s*(?:\+)?\s*(?:years?|yrs?)\s+overall\s+experience/i
    ];
    
    let expMatch = null;
    for (const pattern of expPatterns) {
      expMatch = processedText.match(pattern);
      if (expMatch) break;
    }
    
    // If no explicit experience found, try to calculate from work history
    const calculatedExperience = expMatch ? expMatch[1] : extractExperienceYears(processedText);
    
    // Extract responsibilities - try multiple patterns
    const respPatterns = [
      /responsibilities[:\s]+(.*?)(?:\n\n|$)/is,
      /duties[:\s]+(.*?)(?:\n\n|$)/is,
      /job\s+description[:\s]+(.*?)(?:\n\n|$)/is,
      /what\s+you[\s']*ll\s+do[:\s]+(.*?)(?:\n\n|$)/is
    ];
    
    let respText = null;
    for (const pattern of respPatterns) {
      respText = processedText.match(pattern);
      if (respText) break;
    }
    
    // Process responsibilities into an array
    const responsibilities = respText ? 
      respText[1].split(/[\n•]/).map(s => s.trim()).filter(Boolean) : 
      [];
    
    return {
      title: titleMatch ? titleMatch[1].trim() : fileName,
      skills: skills,
      experience: calculatedExperience,
      responsibilities: responsibilities
    } as ParsedDocument;
  }
}

// Helper function to extract common skills from text
function extractCommonSkills(text: string): string[] {
  const commonSkills = [
    'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Next.js', 'HTML', 'CSS',
    'Python', 'Django', 'Flask', 'Java', 'Spring', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby', 'Rails',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Oracle', 'NoSQL', 'Firebase', 'Supabase',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'GitLab',
    'REST', 'GraphQL', 'API', 'Microservices', 'Serverless', 'Redux', 'MobX', 'RxJS',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch', 'NLP',
    'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence', 'Project Management',
    'UI/UX', 'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator',
    'Testing', 'Jest', 'Mocha', 'Cypress', 'Selenium', 'TDD', 'BDD',
    'DevOps', 'SRE', 'Linux', 'Unix', 'Bash', 'Shell', 'PowerShell',
    'Blockchain', 'Smart Contracts', 'Solidity', 'Web3',
    'Mobile', 'iOS', 'Android', 'React Native', 'Flutter', 'Swift', 'Kotlin',
    'Big Data', 'Hadoop', 'Spark', 'Kafka', 'Elasticsearch', 'Kibana',
    'Security', 'Authentication', 'Authorization', 'OAuth', 'JWT',
    'Performance', 'Optimization', 'Caching', 'CDN', 'SEO',
    'Sass', 'Less', 'Tailwind CSS', 'Bootstrap', 'Material UI', 'Chakra UI',
    'WebSockets', 'Socket.io', 'Real-time', 'Streaming',
    'Webpack', 'Babel', 'ESLint', 'Prettier', 'Rollup', 'Vite',
    'Analytics', 'Monitoring', 'Logging', 'Grafana', 'Prometheus'
  ];
  
  const foundSkills: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const skill of commonSkills) {
    const lowerSkill = skill.toLowerCase();
    if (lowerText.includes(lowerSkill)) {
      foundSkills.push(skill);
    }
  }
  
  return foundSkills;
}

// Helper function to extract a name from filename
function extractNameFromFilename(fileName: string): string {
  // Remove file extension
  let name = fileName.replace(/\.[^/.]+$/, '');
  
  // Replace underscores, hyphens with spaces
  name = name.replace(/[_-]/g, ' ');
  
  // Remove common prefixes like "CV_" or "Resume_"
  name = name.replace(/^(?:cv|resume|cv_|resume_)\s*/i, '');
  
  // Capitalize words
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  
  return name;
}

// Helper function to extract a title from filename
function extractTitleFromFilename(fileName: string): string {
  // Remove file extension
  let title = fileName.replace(/\.[^/.]+$/, '');
  
  // Replace underscores, hyphens with spaces
  title = title.replace(/[_-]/g, ' ');
  
  // Remove common prefixes like "JD_" or "Job_"
  title = title.replace(/^(?:jd|job|job_description|jd_)\s*/i, '');
  
  // Capitalize words
  title = title.replace(/\b\w/g, c => c.toUpperCase());
  
  return title;
}

// Helper function to extract experience years when no explicit mention is found
function extractExperienceYears(text: string): string {
  // Look for patterns like "2018-2023" or "2018 - Present" to calculate years
  const yearRangeMatch = text.match(/\b(20\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)\b/i);
  if (yearRangeMatch) {
    const startYear = parseInt(yearRangeMatch[1]);
    const endYear = yearRangeMatch[2].toLowerCase().match(/present|current|now/) ? 
      new Date().getFullYear() : parseInt(yearRangeMatch[2]);
    return String(endYear - startYear);
  }
  
  // If no single range found, try to calculate from multiple work periods
  return calculateExperienceFromWorkHistory(text);
}

// Helper function to calculate experience from work history dates
function calculateExperienceFromWorkHistory(text: string): string {
  // Look for date patterns in work experience
  const datePatterns = [
    // Format: MM/YYYY - MM/YYYY or MM/YYYY - Present
    /(\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{4}|present|current|now)/gi,
    // Format: YYYY - YYYY or YYYY - Present
    /(\d{4})\s*[-–—]\s*(\d{4}|present|current|now)/gi,
    // Format: Month YYYY - Month YYYY or Month YYYY - Present
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*[-–—]\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}|present|current|now/gi,
    // Format: Mon YYYY - Mon YYYY or Mon YYYY - Present
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}|present|current|now/gi
  ];
  
  const workPeriods: { start: Date; end: Date }[] = [];
  
  for (const pattern of datePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      try {
        const startStr = match[1].trim();
        const endStr = match[2].trim().toLowerCase();
        
        let startDate: Date;
        let endDate: Date;
        
        // Parse start date
        if (startStr.includes('/')) {
          const [month, year] = startStr.split('/');
          startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        } else if (/^\d{4}$/.test(startStr)) {
          startDate = new Date(parseInt(startStr), 0, 1);
        } else {
          startDate = new Date(startStr);
        }
        
        // Parse end date
        if (endStr === 'present' || endStr === 'current' || endStr === 'now') {
          endDate = new Date();
        } else if (endStr.includes('/')) {
          const [month, year] = endStr.split('/');
          endDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        } else if (/^\d{4}$/.test(endStr)) {
          endDate = new Date(parseInt(endStr), 11, 31);
        } else {
          endDate = new Date(endStr);
        }
        
        // Validate dates
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
          workPeriods.push({ start: startDate, end: endDate });
        }
      } catch (error) {
        // Skip invalid date formats
        continue;
      }
    }
  }
  
  if (workPeriods.length === 0) {
    return '';
  }
  
  // Calculate total experience by merging overlapping periods
  workPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  const mergedPeriods: { start: Date; end: Date }[] = [];
  let currentPeriod = workPeriods[0];
  
  for (let i = 1; i < workPeriods.length; i++) {
    const nextPeriod = workPeriods[i];
    
    // If periods overlap or are adjacent (within 1 month), merge them
    const timeDiff = nextPeriod.start.getTime() - currentPeriod.end.getTime();
    const oneMonth = 30 * 24 * 60 * 60 * 1000; // Approximate month in milliseconds
    
    if (timeDiff <= oneMonth) {
      currentPeriod.end = new Date(Math.max(currentPeriod.end.getTime(), nextPeriod.end.getTime()));
    } else {
      mergedPeriods.push(currentPeriod);
      currentPeriod = nextPeriod;
    }
  }
  mergedPeriods.push(currentPeriod);
  
  // Calculate total years
  let totalMonths = 0;
  for (const period of mergedPeriods) {
    const months = (period.end.getFullYear() - period.start.getFullYear()) * 12 + 
                   (period.end.getMonth() - period.start.getMonth()) + 1;
    totalMonths += months;
  }
  
  const totalYears = Math.round(totalMonths / 12);
  return totalYears > 0 ? totalYears.toString() : '';
}

export async function parseWithGemini(text: string, documentType: 'resume' | 'job_description', fileName: string): Promise<ParsedDocument | ParsedResume> {
  try {
    let prompt = '';
    
    if (documentType === 'resume') {
      prompt = `
        Extract the following information from this resume:
        - Full name
        - Email address
        - Phone number
        - List of skills (as an array)
        - Years of experience (just the number)
        - Education details

        Format the response as a JSON object with these exact keys: name, email, phone, skills (array), experience (string), education (string).
        
        Resume content:
        ${text}
      `;
    } else if (documentType === 'job_description') {
      prompt = `
        Extract the following information from this job description:
        - Job title
        - Required skills (as an array)
        - Years of experience required (just the number)
        - Job responsibilities (as an array)

        Format the response as a JSON object with these exact keys: title, skills (array), experience (string), responsibilities (array).
        
        Job description content:
        ${text}
      `;
    }

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY environment variable.');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as GeminiResponse;
    
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini API blocked: ${data.promptFeedback.blockReason}`);
    }
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    console.log('Gemini API response:', responseText);
    
    // Extract JSON from the response text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try to create a structured response from the text if no JSON is found
      return createStructuredResponse(responseText, documentType, fileName);
    }
    
    try {
      const parsedJson = JSON.parse(jsonMatch[0]);
      
      if (documentType === 'resume') {
        // For resumes, ensure we have all required fields with fallbacks
        const result = {
          name: parsedJson.name || extractNameFromFilename(fileName),
          email: parsedJson.email || '',
          phone: parsedJson.phone || '',
          skills: Array.isArray(parsedJson.skills) ? parsedJson.skills : extractCommonSkills(text),
          experience: parsedJson.experience || extractExperienceYears(text),
          education: parsedJson.education || '',
        } as ParsedResume;
        
        // If we're missing critical information, try to extract it from the text
        if (!result.name || result.name === fileName) {
          const nameMatch = text.match(/([A-Z][a-z]+(\s[A-Z][a-z]+)+)/);
          if (nameMatch) result.name = nameMatch[1].trim();
        }
        
        if (!result.email) {
          const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
          if (emailMatch) result.email = emailMatch[1].trim();
        }
        
        return result;
      } else {
        // For job descriptions, ensure we have all required fields with fallbacks
        const result = {
          title: parsedJson.title || extractTitleFromFilename(fileName),
          skills: Array.isArray(parsedJson.skills) ? parsedJson.skills : extractCommonSkills(text),
          experience: parsedJson.experience || '',
          responsibilities: Array.isArray(parsedJson.responsibilities) ? parsedJson.responsibilities : [],
        } as ParsedDocument;
        
        // If we're missing critical information, try to extract it from the text
        if (!result.title || result.title === fileName) {
          const titleMatch = text.match(/([A-Z][a-zA-Z\s]+(?:Developer|Engineer|Designer|Manager|Analyst|Specialist|Consultant|Architect))/i);
          if (titleMatch) result.title = titleMatch[1].trim();
        }
        
        return result;
      }
    } catch (error) {
      console.error('Error parsing JSON from Gemini response:', error);
      return createStructuredResponse(responseText, documentType, fileName);
    }
  } catch (error) {
    console.error('Error parsing with Gemini:', error);
    
    // Return a basic parsed document with the filename if parsing fails
    if (documentType === 'resume') {
      return {
        name: fileName,
        email: '',
        phone: '',
        skills: [],
        experience: '',
        education: '',
      } as ParsedResume;
    } else {
      return {
        title: fileName,
        skills: [],
        experience: '',
        responsibilities: [],
      } as ParsedDocument;
    }
  }
}
