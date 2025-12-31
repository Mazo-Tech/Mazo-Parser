
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';
import { ParsedHistoryEntry } from '@/types';
import { getSkillResult } from '@/utils/colorCoding';

// Helper function to properly process skills for export
const processSkillsForExport = (skills: any): string => {
  if (!skills) {
    return '';
  }
  
  if (typeof skills === 'string') {
    return skills;
  }
  
  if (Array.isArray(skills)) {
    // Handle nested array case: [[]] or [[skill1, skill2]]
    if (skills.length === 1 && Array.isArray(skills[0])) {
      return skills[0].length > 0 ? skills[0].join(', ') : '';
    }
    return skills.join(', ');
  }
  
  return '';
};

const ParsingHistory = () => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['parsing-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('parsing_history')
        .select('*')
        .eq('document_type', 'resume')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching history:', error);
        throw error;
      }

      return data as ParsedHistoryEntry[];
    },
    refetchInterval: 5000,
  });

  const downloadReport = (record: ParsedHistoryEntry) => {
    if (!record.parsed_content?.candidates || !record.parsed_content?.jobDescriptions) {
      toast({
        title: "Error",
        description: "No data available to download",
        variant: "destructive",
      });
      return;
    }

    const candidates = record.parsed_content.candidates;
    const jobDescriptions = record.parsed_content.jobDescriptions;
    const reportData: any[] = [];
    let slNo = 1;

    // Create all possible combinations of JDs and candidates
    jobDescriptions.forEach(jd => {
      candidates.forEach(candidate => {
        const matchForThisJD = candidate.positionMatches?.find(
          match => match.title === jd.title
        ) || {
          title: jd.title,
          matchPercentage: 0,
          experience: jd.experience || 'Not specified',
          skills: jd.skills || []
        };

        reportData.push({
          'Sl No': slNo++,
          'JD Name': jd.title,
          'Resume Name': candidate.fileName,
          'Candidate Name': candidate.name,
          'Email': candidate.email,
          'Phone Number': candidate.phone,
          'Candidate Experience': candidate.experience,
          'JD Experience': jd.experience || 'Not specified',
          'Candidate Skills': processSkillsForExport(candidate.skills),
          'JD Skills': processSkillsForExport(jd.skills),
          'Skills Match %': `${matchForThisJD.matchPercentage}%`,
          'Result Based on Skill': getSkillResult(matchForThisJD.matchPercentage),
          'Result Based on Experience': getExperienceResult(
            candidate.experience,
            jd.experience || '0'
          )
        });
      });
    });

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
        const color = {
          'Select': '00FF00',  // Green
          'Hold': 'FFFF00',    // Yellow
          'Reject': 'FF0000'   // Red
        }[cell.v] || '000000'; // Default black
        
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          fill: { fgColor: { rgb: color } }
        };
      }
    }

    // Download the file
    XLSX.writeFile(workbook, `parsed_report_${format(new Date(record.created_at), 'yyyy-MM-dd_HH-mm')}.xlsx`);
  };

  const getExperienceResult = (candidateExp: string, jdExp: string) => {
    const candidateYears = parseInt(candidateExp) || 0;
    const jdYears = parseInt(jdExp) || 0;
    
    if (Math.abs(candidateYears - jdYears) <= 1) {
      return "Qualified";
    }
    return "Not Qualified";
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from('parsing_history')
        .delete()
        .eq('id', id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['parsing-history'] });
      toast({
        title: "Success",
        description: "Record deleted successfully",
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div>Loading history...</div>;

  if (error) {
    console.error('History fetch error:', error);
    return <div>Error loading history. Please try again later.</div>;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Recent Reports ({history?.length || 0})</h2>
      {history?.length === 0 ? (
        <div className="text-center text-gray-500">No reports available</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history?.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
              <div className="text-primary-darker hover:text-primary hover:underline cursor-pointer" onClick={() => downloadReport(record)}>
                Report from {format(new Date(record.created_at), 'PPpp')}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelectedId(record.id);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete this report from your history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedId) {
                  deleteRecord(selectedId);
                }
                setDeleteConfirmOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ParsingHistory;
