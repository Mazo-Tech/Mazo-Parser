export interface PositionMatch {
  title: string;
  matchPercentage: number;
  experience?: string;
  skills: string[];
}

export interface ParsedDocument {
  title: string;
  skills: string[];
  experience?: string;
  responsibilities?: string[];
}

export interface ParsedResume extends ParsedDocument {
  name: string;
  email: string;
  phone: string;
  education: string;
}

export interface Candidate {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  education: string;
  matchPercentage: number;
  fileName: string;
  positionMatches: PositionMatch[];
  bestMatchingPosition: string;
}

export interface ReportEntry {
  slNo: number;
  jdName: string;
  resumeName: string;
  candidateName: string;
  email: string;
  phoneNumber: string;
  candidateExperience: string;
  jdExperience: string;
  candidateSkills: string[];
  jdSkills: string[];
  skillsMatchPercentage: number;
  skillsMatchResult: string;
  experienceMatchResult: string;
}

export interface ParsedHistoryEntry {
  id: string;
  created_at: string;
  document_type: 'resume' | 'job_description';
  parsed_content: any;
  report?: ReportEntry[];
}