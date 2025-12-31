import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Implement exponential backoff retry logic
async function retryWithExponentialBackoff(
  operation: () => Promise<any>,
  maxRetries = 5, // Increased max retries
  baseDelay = 1000
): Promise<any> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentText, documentType } = await req.json();
    console.log(`Processing ${documentType} document. Text length: ${documentText?.length || 0}`);
    
    // Debug text sample
    if (documentText && typeof documentText === 'string') {
      console.log('Text sample:', documentText.substring(0, 300) + '...');
    } else {
      console.log('Invalid document text received:', documentText);
    }
    
    // Check for empty or invalid document text
    if (!documentText || typeof documentText !== 'string' || documentText.trim().length < 50) {
      console.error('Invalid or too short document text:', documentText ? documentText.substring(0, 50) + '...' : 'empty');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or too short document text',
          documentTextSample: documentText ? documentText.substring(0, 50) + '...' : 'empty'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use the OpenAI API with error handling
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not set in environment variables" }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update prompt to emphasize extracting accurate experience years
    const prompt = documentType === 'resume' ? 
      `You are an expert resume parser with perfect accuracy. Parse this resume with absolute precision.
      
      Extract information from this resume and return it in JSON format. Focus on finding:
      - Full name (usually at the top)
      - Email address (look for @ symbol)
      - Phone number (any standard format with numbers)
      - List of technical skills (especially programming languages, frameworks, tools)
        * Be EXTREMELY precise with skill names like "AWS Lambda", "Google Cloud Platform", "Microsoft Azure"
        * Preserve exact technology names like "AWS Glue", "MySQL", "PostgreSQL", "React Native", etc.
        * Extract ALL technical skills including programming languages, databases, cloud services, etc.
        * Never miss ANY skill mentioned anywhere in the document
      - Years of experience (IMPORTANT: look for total years of work experience mentioned explicitly or calculate from work history)
        * ALWAYS return a NUMBER for years of experience (e.g. "5" not "5 years")
        * If no specific number is mentioned, estimate from the work history dates
        * Always return at least "0" for experience, never leave it empty
      - Education details (highest degree and institution)

      *** EXTREMELY IMPORTANT ***
      1. NEVER miss ANY technical skill mentioned in the document
      2. Parse the ENTIRE document thoroughly - do not stop early
      3. Extract skills mentioned in ANY section of the resume
      4. Be precise with composite skill names (e.g., "AWS Lambda" not just "AWS")
      5. Include ALL technologies, programming languages, frameworks, libraries, tools, etc.
      6. Look for skills hidden within job descriptions and project details
      7. If you're not sure if something is a skill, include it anyway
      8. MAKE SURE to extract the total years of experience as a NUMBER

      Return ONLY a valid JSON object like this example, no other text:
      {
        "name": "John Smith",
        "email": "john@example.com",
        "phone": "+1-234-567-8900",
        "skills": ["AWS Lambda", "AWS Glue", "Python", "Java", "MySQL"],
        "experience": "5",
        "education": "BS Computer Science, XYZ University"
      }

      Parse this resume text with absolute precision:
      ${documentText}`
      :
      `You are an EXPERT TECHNICAL SKILL EXTRACTOR with PERFECT ACCURACY. Your ONLY job is to identify EVERY SINGLE technical skill and technology mentioned in job descriptions with 100% precision. THIS IS CRITICALLY IMPORTANT.

      Scan every word of this job description and extract ALL mentioned technical skills and technologies - missing even one skill is a CRITICAL FAILURE. Be extremely thorough and precise.

      Extract information from this job description and return it in JSON format with these fields:
      - "title": The job position name
      - "skills": An array containing EVERY technical skill, technology, tool, language, framework, platform mentioned ANYWHERE in the document
      - "experience": Required years of experience (IMPORTANT: look for a NUMBER of years required and return ONLY the number)
        * ALWAYS return a NUMBER for experience (e.g. "5" not "5 years")
        * If no specific number is mentioned, estimate from the seniority level of the position (junior=1-2, mid=3-5, senior=6+)
        * Always return at least "0" for experience, never leave it empty
      - "responsibilities": Key job duties (3-5 main responsibilities)

      *** SKILL EXTRACTION REQUIREMENTS - READ THESE CAREFULLY ***
      1. You MUST extract EVERY SINGLE technical skill mentioned anywhere in the text
      2. Extract EXACT skill names as written (e.g., "AWS Lambda" not just "AWS")
      3. Include ALL of these types of skills:
         - ALL programming languages (Python, Java, JavaScript, TypeScript, C#, C++, Ruby, Go, etc.)
         - ALL frameworks & libraries (React, Angular, Vue, Node.js, Express, Django, Spring, etc.)
         - ALL cloud platforms with specific services (AWS Lambda, AWS Glue, Azure Functions, GCP BigQuery)
         - ALL databases and data stores (MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch, DynamoDB)
         - ALL DevOps tools (Docker, Kubernetes, Terraform, Jenkins, CircleCI, Git, GitHub Actions)
         - ALL data science & AI tools (TensorFlow, PyTorch, Scikit-learn, Pandas, NLTK, Hugging Face)
         - ALL big data technologies (Hadoop, Spark, Kafka, Airflow, Databricks)
         - ALL project methodologies (Agile, Scrum, Kanban, SAFe, Waterfall)
         - ALL visualization tools (PowerBI, Tableau, Looker, Grafana, Kibana)
         - ALL AI/ML platforms (OpenAI, ChatGPT, DALL-E, MidJourney, Anthropic Claude)
      4. Scan the ENTIRE document, including ALL sections - skills can appear anywhere
      5. Look for skills hidden in sentences describing responsibilities
      6. If you're not 100% sure if something is a technical skill, INCLUDE IT ANYWAY
      7. NEVER omit any skill - thoroughness is your PRIMARY OBJECTIVE
      8. Parse skills from requirements, qualifications, responsibilities, and ANY other section
      9. MAKE SURE to extract the required years of experience as a NUMBER

      Return ONLY a valid JSON object with this structure, no other text:
      {
        "title": "Senior Software Engineer",
        "skills": ["AWS Lambda", "AWS Glue", "Python", "Django", "PostgreSQL", "Docker", "Kubernetes", "Git", "CI/CD", "Agile", "Scrum", "PowerBI"],
        "experience": "5",
        "responsibilities": ["Lead development team", "Design system architecture", "Implement CI/CD pipelines"]
      }

      Parse this job description with PERFECT accuracy and EXTREME thoroughness:
      ${documentText}`;

    // Use OpenAI API for parsing with improved model selection
    const result = await retryWithExponentialBackoff(async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using a more capable model
          messages: [
            { role: 'system', content: 'You are a document parsing assistant with exceptionally high accuracy. Always return valid JSON without any markdown formatting.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1, // Lower temperature for more deterministic outputs
          max_tokens: 2048, // Increased token limit for longer documents
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }
      
      return await response.json();
    });

    if (!result || !result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Failed to generate content after multiple attempts');
    }

    const text = result.choices[0].message.content;
    console.log('Raw AI response:', text);

    try {
      // Extract JSON from the response with improved handling
      const jsonStr = text.trim()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      const parsedData = JSON.parse(jsonStr);
      
      if (documentType === 'resume') {
        if (!parsedData.name) {
          throw new Error('Invalid resume data structure: missing name');
        }
        
        // Handle skills array with improved validation
        if (!parsedData.skills) {
          parsedData.skills = [];
        } else if (!Array.isArray(parsedData.skills)) {
          // If skills is not an array, try to convert it
          if (typeof parsedData.skills === 'string') {
            parsedData.skills = [parsedData.skills];
          } else {
            parsedData.skills = [];
          }
        } else if (parsedData.skills.length === 1 && Array.isArray(parsedData.skills[0])) {
          // Fix for nested array issue: [[]] -> []
          if (parsedData.skills[0].length === 0) {
            parsedData.skills = [];
          } else {
            // Handle case where skills is a nested array with values
            parsedData.skills = parsedData.skills[0];
          }
        }
        
        // Ensure skills are unique and properly formatted
        parsedData.skills = [...new Set(parsedData.skills
          .filter((skill: any) => typeof skill === 'string' && skill.trim())
          .map((skill: string) => skill.trim())
        )];
        
        console.log('Processed resume skills:', parsedData.skills);
      } else {
        if (!parsedData.title) {
          throw new Error('Invalid job description data structure: missing title');
        }
        
        // Handle skills array with improved validation
        if (!parsedData.skills) {
          parsedData.skills = [];
        } else if (!Array.isArray(parsedData.skills)) {
          // If skills is not an array, try to convert it
          if (typeof parsedData.skills === 'string') {
            parsedData.skills = [parsedData.skills];
          } else {
            parsedData.skills = [];
          }
        } else if (parsedData.skills.length === 1 && Array.isArray(parsedData.skills[0])) {
          // Fix for nested array issue: [[]] -> []
          if (parsedData.skills[0].length === 0) {
            parsedData.skills = [];
          } else {
            // Handle case where skills is a nested array with values
            parsedData.skills = parsedData.skills[0];
          }
        }
        
        // Add more detailed debugging for job descriptions
        console.log('Extracted skills count:', parsedData.skills.length);
        console.log('Extracted skills sample:', parsedData.skills.slice(0, 10));
      }

      console.log('Successfully parsed document:', parsedData);
      return new Response(
        JSON.stringify(parsedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }
  } catch (error) {
    console.error('Error in parse-document function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
