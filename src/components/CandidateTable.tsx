import { useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getSkillColor, getSkillResult } from '@/utils/colorCoding';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Candidate, ParsedDocument } from '@/types';

interface CandidateTableProps {
  candidates: Candidate[];
  jobDescriptions: ParsedDocument[];
}

const CandidateTable = ({ candidates, jobDescriptions }: CandidateTableProps) => {
  console.log('Rendering CandidateTable with:', { 
    candidatesCount: candidates.length, 
    jobDescriptionsCount: jobDescriptions.length 
  });

  // Enhanced skills matching algorithm with exact matching for composite skills
  const calculateMatchPercentage = (candidateSkills: string[], requiredSkills: string[]) => {
    if (!requiredSkills.length) return 0;
    if (!candidateSkills.length) return 0;
    
    // Filter out non-string values and normalize to lowercase for comparison
    const normalizedRequiredSkills = requiredSkills
      .filter(skill => typeof skill === 'string')
      .map(skill => skill.toLowerCase().trim());
    
    const normalizedCandidateSkills = candidateSkills
      .filter(skill => typeof skill === 'string')
      .map(skill => skill.toLowerCase().trim());
    
    if (!normalizedRequiredSkills.length) return 0;
    
    // Create a mapping of matched skills for tracking
    const matchedSkills = new Map<string, boolean>();
    let matchCount = 0;
    
    // First, handle exact matches with priority
    for (const requiredSkill of normalizedRequiredSkills) {
      // Check for exact matches first (case insensitive)
      if (normalizedCandidateSkills.includes(requiredSkill)) {
        matchCount++;
        matchedSkills.set(requiredSkill, true);
        continue;
      }
    }
    
    // Handle composite skills and specific technology matches
    for (const requiredSkill of normalizedRequiredSkills) {
      // Skip if already matched
      if (matchedSkills.has(requiredSkill)) continue;
      
      // Check for composite skills (e.g., "aws glue", "power bi")
      // by looking for both words in the skill list
      if (requiredSkill.includes(' ')) {
        const parts = requiredSkill.split(' ');
        // Check if all parts of the composite skill exist in any candidate skill
        const hasAllParts = normalizedCandidateSkills.some(candidateSkill => {
          return parts.every(part => candidateSkill.includes(part));
        });
        
        if (hasAllParts) {
          matchCount++;
          matchedSkills.set(requiredSkill, true);
          continue;
        }
      }
      
      // Check for skills that are substrings of each other only if they're substantial matches
      // (e.g., "javascript" and "typescript" should not match)
      for (const candidateSkill of normalizedCandidateSkills) {
        // Only consider this match if neither skill is already matched
        if (!matchedSkills.has(requiredSkill)) {
          // Only match if the core part of the skill is the same
          // For example, "aws lambda" should match with "lambda"
          // But "java" should not match with "javascript"
          const isSubstantialMatch = 
            // The candidate skill fully contains the required skill as a distinct word
            (candidateSkill.includes(` ${requiredSkill} `) || 
             candidateSkill.startsWith(`${requiredSkill} `) || 
             candidateSkill.endsWith(` ${requiredSkill}`) || 
             candidateSkill === requiredSkill) ||
            // Or the required skill fully contains the candidate skill as a distinct word
            (requiredSkill.includes(` ${candidateSkill} `) || 
             requiredSkill.startsWith(`${candidateSkill} `) || 
             requiredSkill.endsWith(` ${candidateSkill}`) || 
             requiredSkill === candidateSkill);
            
          if (isSubstantialMatch) {
            matchCount++;
            matchedSkills.set(requiredSkill, true);
            break;
          }
        }
      }
    }
    
    // Handle specific technology equivalence for skills not already matched
    const technologyEquivalents = [
      // Database technologies
      ['sql', 'mysql', 'postgresql', 'ms sql', 'sql server'],
      // Cloud platforms
      ['aws', 'amazon web services'],
      ['gcp', 'google cloud platform', 'google cloud'],
      ['azure', 'microsoft azure'],
      // JavaScript frameworks
      ['react', 'react.js'],
      ['vue', 'vue.js'],
      ['angular', 'angular.js'],
      ['node', 'node.js'],
      // Data science & ML
      ['ml', 'machine learning'],
      ['ai', 'artificial intelligence'],
      // DevOps
      ['ci/cd', 'continuous integration', 'continuous deployment'],
      ['k8s', 'kubernetes'],
    ];
    
    for (const requiredSkill of normalizedRequiredSkills) {
      // Skip if already matched
      if (matchedSkills.has(requiredSkill)) continue;
      
      // Check technology equivalents
      for (const equivalentGroup of technologyEquivalents) {
        if (equivalentGroup.includes(requiredSkill)) {
          // Check if candidate has any equivalent skill
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
            break;
          }
        }
      }
    }
    
    // Calculate percentage as (matched skills / required skills) * 100
    return Math.round((matchCount / normalizedRequiredSkills.length) * 100);
  };

  // Updated experience result logic - Qualified if candidate experience is same or higher than JD experience
  const getExperienceResult = (candidateExp: string, jdExp: string) => {
    const candidateYears = parseInt(candidateExp) || 0;
    const jdYears = parseInt(jdExp) || 0;
    
    // If candidate experience is equal to or greater than JD requirement, they're qualified
    if (candidateYears >= jdYears) {
      return "Qualified";
    }
    return "Not Qualified";
  };

  const downloadExcel = () => {
    const reportData: any[] = [];
    let slNo = 1;

    // Add header row
    reportData.push({
      'Sl No': 'Sl No',
      'JD Name': 'JD Name',
      'Resume Name': 'Resume Name',
      'Candidate Name': 'Candidate Name',
      'Email': 'Email',
      'Phone Number': 'Phone Number',
      'Candidate Experience': 'Candidate Experience',
      'JD Experience': 'JD Experience',
      'Candidate Skills': 'Candidate Skills',
      'JD Skills': 'JD Skills',
      'Skills Match %': 'Skills Match %',
      'Result Based on Skill': 'Result Based on Skill',
      'Result Based on Experience': 'Result Based on Experience'
    });

    // Create all possible combinations with recalculated match percentages
    jobDescriptions.forEach(jd => {
      candidates.forEach(candidate => {
        // Recalculate match percentage with fixed algorithm
        const candidateSkillsArray = Array.isArray(candidate.skills) ? candidate.skills : [];
        const jdSkillsArray = Array.isArray(jd.skills) ? jd.skills : [];
        
        const matchPercentage = calculateMatchPercentage(
          candidateSkillsArray.filter(skill => typeof skill === 'string'),
          jdSkillsArray.filter(skill => typeof skill === 'string')
        );

        // Filter out non-string skills
        const filteredCandidateSkills = candidateSkillsArray.filter(skill => typeof skill === 'string');
        const filteredJdSkills = jdSkillsArray.filter(skill => typeof skill === 'string');
        
        // Get actual JD name without file extension
        const jdName = jd.title ? jd.title : '';

        reportData.push({
          'Sl No': slNo++,
          'JD Name': jdName,
          'Resume Name': candidate.fileName || '',
          'Candidate Name': candidate.name || '',
          'Email': candidate.email || '',
          'Phone Number': candidate.phone || '',
          'Candidate Experience': candidate.experience || '',
          'JD Experience': jd.experience || 'Not specified',
          'Candidate Skills': filteredCandidateSkills.join(', '),
          'JD Skills': filteredJdSkills.join(', '),
          'Skills Match %': `${matchPercentage}%`,
          'Result Based on Skill': getSkillResult(matchPercentage),
          'Result Based on Experience': getExperienceResult(
            candidate.experience || '0',
            jd.experience || '0'
          )
        });
      });
    });

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    // Set column widths
    const columnWidths = [
      { wch: 5 },   // Sl No
      { wch: 30 },  // JD Name
      { wch: 30 },  // Resume Name
      { wch: 30 },  // Candidate Name
      { wch: 35 },  // Email
      { wch: 15 },  // Phone Number
      { wch: 20 },  // Candidate Experience
      { wch: 15 },  // JD Experience
      { wch: 50 },  // Candidate Skills
      { wch: 50 },  // JD Skills
      { wch: 15 },  // Skills Match %
      { wch: 20 },  // Result Based on Skill
      { wch: 25 },  // Result Based on Experience
    ];
    worksheet['!cols'] = columnWidths;

    // Add color to Result Based on Skill column
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 11 }); // Column L
      const cell = worksheet[cellAddress];
      if (cell) {
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
        const color = getSkillColor(cell.v as any).hex;
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          fill: { fgColor: { rgb: color } }
        };
      }
    }

    // Download the file
    XLSX.writeFile(workbook, `parsed_report_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
  };

  // Create all possible combinations of JDs and candidates with recalculated match percentages
  const allRows = jobDescriptions.flatMap(jd => 
    candidates.map(candidate => {
      // Recalculate match percentage with enhanced algorithm
      const candidateSkillsArray = Array.isArray(candidate.skills) ? candidate.skills : [];
      const jdSkillsArray = Array.isArray(jd.skills) ? jd.skills : [];
      
      const matchPercentage = calculateMatchPercentage(
        candidateSkillsArray.filter(skill => typeof skill === 'string'),
        jdSkillsArray.filter(skill => typeof skill === 'string')
      );

      return {
        jd,
        candidate,
        matchPercentage
      };
    })
  );

  // Ensure we have arrays for skills in each row
  const safeRows = allRows.map(row => ({
    ...row,
    candidate: {
      ...row.candidate,
      skills: Array.isArray(row.candidate.skills) ? row.candidate.skills : []
    },
    jd: {
      ...row.jd,
      skills: Array.isArray(row.jd.skills) ? row.jd.skills : []
    }
  }));

  console.log('Generated rows:', allRows.length);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={downloadExcel} className="mb-4">
          <Download className="w-4 h-4 mr-2" /> Download Excel
        </Button>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sl No</TableHead>
              <TableHead>JD Name</TableHead>
              <TableHead>Resume Name</TableHead>
              <TableHead>Candidate Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Candidate Experience</TableHead>
              <TableHead>JD Experience</TableHead>
              <TableHead>Candidate Skills</TableHead>
              <TableHead>JD Skills</TableHead>
              <TableHead>Skills Match %</TableHead>
              <TableHead>Result Based on Skill</TableHead>
              <TableHead>Result Based on Experience</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeRows.map((row, index) => {
              const skillResult = getSkillResult(row.matchPercentage);
              const skillColor = getSkillColor(skillResult);
              
              // Filter out non-string skills
              const candidateSkills = row.candidate.skills.filter(skill => typeof skill === 'string');
              const jdSkills = row.jd.skills.filter(skill => typeof skill === 'string');

              // Get actual JD name
              const jdName = row.jd.title ? row.jd.title : '';

              return (
                <TableRow key={`${row.jd.title}-${row.candidate.fileName}-${index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{jdName}</TableCell>
                  <TableCell>{row.candidate.fileName || ''}</TableCell>
                  <TableCell>{row.candidate.name || ''}</TableCell>
                  <TableCell>{row.candidate.email || ''}</TableCell>
                  <TableCell>{row.candidate.phone || ''}</TableCell>
                  <TableCell>{row.candidate.experience || ''}</TableCell>
                  <TableCell>{row.jd.experience || 'Not specified'}</TableCell>
                  <TableCell>{candidateSkills.join(', ')}</TableCell>
                  <TableCell>{jdSkills.join(', ')}</TableCell>
                  <TableCell>
                    <span className={`font-medium ${skillColor.tailwind}`}>
                      {row.matchPercentage}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${skillColor.tailwind}`}>
                      {skillResult}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getExperienceResult(
                      row.candidate.experience || '0',
                      row.jd.experience || '0'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CandidateTable;
