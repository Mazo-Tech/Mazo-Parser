import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '@/components/FileUpload';
import CandidateTable from '@/components/CandidateTable';
import ParsingHistory from '@/components/ParsingHistory';
import UserManagement from '@/components/UserManagement';
import JobDescription from '@/components/JobDescription';
import { parseDocument, processBatch } from '@/components/DocumentParser';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PositionMatch, ParsedDocument, ParsedResume, Candidate } from '@/types';
import { Button } from '@/components/ui/button';
import { LogOut, Play, Loader } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getSkillColor, getSkillResult, type SkillResult } from '@/utils/colorCoding';

const MAX_JD_COUNT = 10;
const MAX_RESUME_COUNT = 25;
const MAX_BATCH_SIZE = 100;

const Index = () => {
  const [jobDescriptions, setJobDescriptions] = useState<ParsedDocument[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [debugCounts, setDebugCounts] = useState({
    jdCount: 0,
    resumeCount: 0,
    shouldShowButton: false
  });

  useEffect(() => {
    setDebugCounts({
      jdCount: jobDescriptions.length,
      resumeCount: candidates.length,
      shouldShowButton: jobDescriptions.length > 0 && candidates.length > 0
    });
    
    console.log("Current state:", {
      jobDescriptions: jobDescriptions.length,
      candidates: candidates.length,
      shouldShowButton: jobDescriptions.length > 0 && candidates.length > 0
    });
  }, [jobDescriptions, candidates]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleJDUpload = async (files: File[]) => {
    if (files.length > MAX_BATCH_SIZE) {
      toast({
        title: "Warning",
        description: `Maximum ${MAX_BATCH_SIZE} files can be processed at once. Please upload fewer files.`,
        variant: "destructive",
      });
      return;
    }

    if (jobDescriptions.length + files.length > MAX_JD_COUNT) {
      toast({
        title: "Warning",
        description: `You can only upload a maximum of ${MAX_JD_COUNT} job descriptions. You currently have ${jobDescriptions.length} and are trying to add ${files.length} more.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const parsedJDs = await processBatch(files, 'jd', (progress) => {
        // Progress handling if needed
      });

      setJobDescriptions(prev => [...prev, ...parsedJDs]);
      
      const validCount = parsedJDs.filter(jd => jd.skills.length > 0).length;
      
      // Recalculate skills matching for existing candidates with new job descriptions
      if (candidates.length > 0) {
        try {
          console.log('Recalculating skills matching for existing candidates...');
          // Simple recalculation using existing calculateMatchPercentage function
          const updatedCandidates = candidates.map(candidate => {
            const positionMatches = jobDescriptions.map(jd => {
              const matchPercentage = calculateMatchPercentage(candidate.skills, jd.skills || []);
              return {
                title: jd.title,
                matchPercentage,
                experience: jd.experience || '',
                skills: jd.skills || []
              };
            });

            const bestMatch = positionMatches.length > 0 
              ? positionMatches.reduce(
                  (best, current) => 
                    current.matchPercentage > best.matchPercentage ? current : best,
                  positionMatches[0] || { title: '', matchPercentage: 0, experience: '', skills: [] }
                )
              : { title: '', matchPercentage: 0, experience: '', skills: [] };

            return {
              ...candidate,
              matchPercentage: bestMatch.matchPercentage,
              positionMatches: positionMatches,
              bestMatchingPosition: bestMatch.title
            };
          });

          setCandidates(updatedCandidates);
          console.log('Skills matching recalculation completed');
        } catch (error) {
          console.error('Error recalculating skills matching:', error);
        }
      }
      
      toast({
        title: "Success",
        description: `${parsedJDs.length} job description(s) uploaded successfully${
          validCount !== files.length ? `. ${files.length - validCount} files may have incomplete data.` : ''
        }`,
      });
    } catch (error) {
      console.error('JD Upload Error:', error);
      toast({
        title: "Error",
        description: "Failed to parse job descriptions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResumeUpload = async (files: File[]) => {
    if (files.length > MAX_BATCH_SIZE) {
      toast({
        title: "Warning",
        description: `Maximum ${MAX_BATCH_SIZE} files can be processed at once. Please upload fewer files.`,
        variant: "destructive",
      });
      return;
    }

    if (candidates.length + files.length > MAX_RESUME_COUNT) {
      toast({
        title: "Warning",
        description: `You can only upload a maximum of ${MAX_RESUME_COUNT} resumes. You currently have ${candidates.length} and are trying to add ${files.length} more.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const parsedResumes = await processBatch(files, 'resume', (progress) => {
        // Progress handling if needed
      });

      const newCandidates = parsedResumes
        .map((parsed, index) => {
          if (!isParseResume(parsed)) return null;
          
          try {
            // Debug logging for skills
            console.log(`Candidate ${index} (${files[index].name}):`, {
              name: parsed.name,
              skills: parsed.skills,
              skillsLength: parsed.skills?.length || 0,
              skillsType: typeof parsed.skills,
              skillsArray: Array.isArray(parsed.skills)
            });

            const positionMatches = jobDescriptions.map(jd => {
              console.log(`Job Description: ${jd.title}`, {
                skills: jd.skills,
                skillsLength: jd.skills?.length || 0,
                skillsType: typeof jd.skills,
                skillsArray: Array.isArray(jd.skills)
              });
              
              const matchPercentage = calculateMatchPercentage(parsed.skills || [], jd.skills || []);
              return {
                title: jd.title,
                matchPercentage,
                experience: jd.experience || '',
                skills: jd.skills || []
              };
            });

            const bestMatch = positionMatches.length > 0 
              ? positionMatches.reduce(
                  (best, current) => 
                    current.matchPercentage > best.matchPercentage ? current : best,
                  positionMatches[0] || { title: '', matchPercentage: 0, experience: '', skills: [] }
                )
              : { title: '', matchPercentage: 0, experience: '', skills: [] };
            
            return {
              name: parsed.name || files[index].name.replace(/\.[^/.]+$/, ""),
              email: parsed.email || '',
              phone: parsed.phone || '',
              skills: parsed.skills || [],
              experience: parsed.experience || '',
              education: parsed.education || '',
              matchPercentage: bestMatch.matchPercentage,
              fileName: files[index].name,
              positionMatches: positionMatches.length > 0 ? positionMatches : [],
              bestMatchingPosition: bestMatch.title || ''
            } as Candidate;
          } catch (error) {
            console.error('Error processing resume:', error);
            return {
              name: parsed.name || files[index].name.replace(/\.[^/.]+$/, ""),
              email: parsed.email || '',
              phone: parsed.phone || '',
              skills: parsed.skills || [],
              experience: parsed.experience || '',
              education: parsed.education || '',
              matchPercentage: 0,
              fileName: files[index].name,
              positionMatches: [],
              bestMatchingPosition: ''
            } as Candidate;
          }
        })
        .filter((candidate): candidate is Candidate => candidate !== null);

      setCandidates(prev => [...prev, ...newCandidates]);
      
      toast({
        title: "Success",
        description: `${newCandidates.length} resume(s) uploaded successfully${
          newCandidates.length !== files.length ? `. ${files.length - newCandidates.length} files may have incomplete data.` : ''
        }`,
      });
    } catch (error) {
      console.error('Resume Upload Error:', error);
      toast({
        title: "Error",
        description: "Failed to process resumes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateMatchPercentage = (candidateSkills: string[], requiredSkills: string[]) => {
    console.log('=== SKILLS MATCHING DEBUG ===');
    console.log('Candidate Skills:', candidateSkills);
    console.log('Required Skills:', requiredSkills);
    console.log('Candidate Skills Type:', typeof candidateSkills, 'Array:', Array.isArray(candidateSkills));
    console.log('Required Skills Type:', typeof requiredSkills, 'Array:', Array.isArray(requiredSkills));
    
    if (!requiredSkills.length) {
      console.log('No required skills - returning 0');
      return 0;
    }
    if (!candidateSkills.length) {
      console.log('No candidate skills - returning 0');
      return 0;
    }
    
    const normalizedRequiredSkills = requiredSkills
      .filter(skill => typeof skill === 'string')
      .map(skill => skill.toLowerCase().trim());
    
    const normalizedCandidateSkills = candidateSkills
      .filter(skill => typeof skill === 'string')
      .map(skill => skill.toLowerCase().trim());
    
    console.log('Normalized Required Skills:', normalizedRequiredSkills);
    console.log('Normalized Candidate Skills:', normalizedCandidateSkills);
    
    if (!normalizedRequiredSkills.length) {
      console.log('No normalized required skills - returning 0');
      return 0;
    }
    
    const matchedSkills = new Map<string, boolean>();
    let matchCount = 0;
    
    // Exact matches
    for (const requiredSkill of normalizedRequiredSkills) {
      if (normalizedCandidateSkills.includes(requiredSkill)) {
        matchCount++;
        matchedSkills.set(requiredSkill, true);
        console.log(`Exact match found: ${requiredSkill}`);
        continue;
      }
    }
    
    // Partial matches
    for (const requiredSkill of normalizedRequiredSkills) {
      if (matchedSkills.has(requiredSkill)) continue;
      
      if (requiredSkill.includes(' ')) {
        const parts = requiredSkill.split(' ');
        if (normalizedCandidateSkills.some(candidateSkill => {
          return parts.every(part => candidateSkill.includes(part));
        })) {
          matchCount++;
          matchedSkills.set(requiredSkill, true);
          console.log(`Partial match found: ${requiredSkill}`);
          continue;
        }
      }
      
      for (const candidateSkill of normalizedCandidateSkills) {
        if (!matchedSkills.has(requiredSkill)) {
          const isSubstantialMatch = 
            (candidateSkill.includes(` ${requiredSkill} `) || 
             candidateSkill.startsWith(`${requiredSkill} `) || 
             candidateSkill.endsWith(` ${requiredSkill}`) || 
             candidateSkill === requiredSkill) ||
            (requiredSkill.includes(` ${candidateSkill} `) || 
             requiredSkill.startsWith(`${candidateSkill} `) || 
             requiredSkill.endsWith(` ${candidateSkill}`) || 
             requiredSkill === candidateSkill);
            
          if (isSubstantialMatch) {
            matchCount++;
            matchedSkills.set(requiredSkill, true);
            console.log(`Substantial match found: ${requiredSkill} <-> ${candidateSkill}`);
            break;
          }
        }
      }
    }
    
    // Technology equivalents
    const technologyEquivalents = [
      ['sql', 'mysql', 'postgresql', 'ms sql', 'sql server'],
      ['aws', 'amazon web services'],
      ['gcp', 'google cloud platform', 'google cloud'],
      ['azure', 'microsoft azure'],
      ['react', 'react.js'],
      ['vue', 'vue.js'],
      ['angular', 'angular.js'],
      ['node', 'node.js'],
      ['ml', 'machine learning'],
      ['ai', 'artificial intelligence'],
      ['ci/cd', 'continuous integration', 'continuous deployment'],
      ['k8s', 'kubernetes'],
    ];
    
    for (const requiredSkill of normalizedRequiredSkills) {
      if (matchedSkills.has(requiredSkill)) continue;
      
      for (const equivalentGroup of technologyEquivalents) {
        if (equivalentGroup.includes(requiredSkill)) {
          const hasEquivalent = normalizedCandidateSkills.some(candidateSkill => 
            equivalentGroup.some(equivalent => 
              candidateSkill === equivalent || 
              candidateSkill.startsWith(`${equivalent} `) || 
              candidateSkill.endsWith(` ${equivalent}`) ||
              candidateSkill.includes(` ${equivalent} `)
            )
          );
          
          if (hasEquivalent) {
            matchCount++;
            matchedSkills.set(requiredSkill, true);
            console.log(`Equivalent match found: ${requiredSkill}`);
            break;
          }
        }
      }
    }
    
    const percentage = Math.round((matchCount / normalizedRequiredSkills.length) * 100);
    console.log(`Final match count: ${matchCount}/${normalizedRequiredSkills.length} = ${percentage}%`);
    console.log('=== END SKILLS MATCHING DEBUG ===');
    
    return percentage;
  };

  const isParseResume = (doc: ParsedDocument | ParsedResume): doc is ParsedResume => {
    return 'name' in doc && 'email' in doc && 'phone' in doc;
  };

  const handleParse = async () => {
    if (jobDescriptions.length === 0 || candidates.length === 0) {
      toast({
        title: "Error",
        description: "Please upload both job descriptions and resumes before parsing.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Save parsing history - wrapped in try-catch to not fail the entire operation
      try {
        const { error: insertError } = await supabase.from('parsing_history').insert({
          document_type: 'resume',
          parsed_content: {
            jobDescriptions: jobDescriptions.map(jd => ({
              title: jd.title,
              skills: jd.skills,
              experience: jd.experience || '',
              responsibilities: jd.responsibilities || []
            })),
            candidates: candidates.map(candidate => ({
              name: candidate.name,
              email: candidate.email,
              phone: candidate.phone,
              skills: candidate.skills,
              experience: candidate.experience,
              education: candidate.education,
              matchPercentage: candidate.matchPercentage,
              fileName: candidate.fileName,
              bestMatchingPosition: candidate.bestMatchingPosition,
              positionMatches: candidate.positionMatches.map(match => ({
                title: match.title,
                matchPercentage: match.matchPercentage,
                experience: match.experience || '',
                skills: match.skills || []
              }))
            }))
          },
          user_id: user.id
        });
        
        if (insertError) {
          console.error('Error saving parsing history:', insertError);
        } else {
          console.log('Parsing history saved successfully');
          // Invalidate the history cache to trigger a refresh
          queryClient.invalidateQueries({ queryKey: ['parsing-history'] });
        }
      } catch (historyError) {
        // Silently fail - history is not critical for report generation
        console.error('Failed to save history:', historyError);
      }

      const reportData = jobDescriptions.flatMap((jd, jdIndex) => 
        candidates.map((candidate, candidateIndex) => {
          const matchForThisJD = candidate.positionMatches.find(
            match => match.title === jd.title
          ) || {
            title: jd.title,
            matchPercentage: 0,
            skills: jd.skills,
            experience: jd.experience
          };

          const candidateExp = parseInt(candidate.experience || '0');
          const jdExp = parseInt(jd.experience || '0');
          const experienceResult = candidateExp >= jdExp ? 'Qualified' : 'Not Qualified';

          return {
            'Sl No': jdIndex * candidates.length + candidateIndex + 1,
            'JD Name': jd.title,
            'Resume Name': candidate.fileName,
            'Candidate Name': candidate.name,
            'Email': candidate.email,
            'Phone Number': candidate.phone,
            'Candidate Experience': candidate.experience,
            'JD Experience': jd.experience || 'Not specified',
            'Candidate Skills': candidate.skills.join(', '),
            'JD Skills': jd.skills.join(', '),
            'Skills Match %': `${matchForThisJD.matchPercentage}%`,
            'Result Based on Skill': getSkillResult(matchForThisJD.matchPercentage),
            'Result Based on Experience': experienceResult
          };
        })
      );

      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 35 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 50 },
        { wch: 50 },
        { wch: 15 },
        { wch: 20 },
        { wch: 25 },
      ];

      XLSX.writeFile(workbook, `parsed_report_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);

      setJobDescriptions([]);
      setCandidates([]);

      toast({
        title: "Success",
        description: "Report generated successfully.",
      });

    } catch (error) {
      console.error('Parsing Error:', error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const { data: userRole } = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role || null;
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mazo Beam Parser</h1>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Job Descriptions</h2>
          <p className="text-sm text-gray-500 mb-2">
            Maximum {MAX_JD_COUNT} job descriptions allowed. Currently uploaded: {jobDescriptions.length}
          </p>
          <FileUpload
            onFileUpload={handleJDUpload}
            accept={{
              'application/pdf': ['.pdf'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'application/msword': ['.doc'],
            }}
            title="Upload JDs"
            maxFiles={MAX_JD_COUNT - jobDescriptions.length}
            currentCount={jobDescriptions.length}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Resumes</h2>
          <p className="text-sm text-gray-500 mb-2">
            Maximum {MAX_RESUME_COUNT} resumes allowed. Currently uploaded: {candidates.length}
          </p>
          <FileUpload
            onFileUpload={handleResumeUpload}
            accept={{
              'application/pdf': ['.pdf'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'application/msword': ['.doc'],
            }}
            title="Upload Resumes"
            maxFiles={MAX_RESUME_COUNT - candidates.length}
            currentCount={candidates.length}
          />
        </div>
      </div>

      {jobDescriptions.length > 0 && candidates.length > 0 && (
        <div className="flex justify-center mt-8">
          <Button 
            onClick={handleParse} 
            className="px-8 py-4 text-lg"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <><Loader className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
            ) : (
              <><Play className="w-5 h-5 mr-2" /> Generate Report</>
            )}
          </Button>
        </div>
      )}

      <ParsingHistory />

      {userRole === 'admin' && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <UserManagement />
        </div>
      )}
    </div>
  );
};

export default Index;
