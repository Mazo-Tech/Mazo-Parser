
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { toast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileUpload: (files: File[]) => Promise<void>;
  accept: Record<string, string[]>;
  title: string;
  maxFiles?: number;
  currentCount?: number;
}

const FileUpload = ({ onFileUpload, accept, title, maxFiles, currentCount = 0 }: FileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) {
      toast({
        title: "No files accepted",
        description: "Please upload PDF or DOCX files.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    setProgress(0);
    
    // Simulate progress for visual feedback
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      console.log(`Processing ${acceptedFiles.length} files:`, acceptedFiles.map(f => f.name));
      await onFileUpload(acceptedFiles);
      toast({
        title: "Upload complete",
        description: `${acceptedFiles.length} files processed`,
      });
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "There was a problem processing your files",
        variant: "destructive",
      });
    } finally {
      setProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
        clearInterval(interval);
      }, 500);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept,
    multiple: true,
    maxFiles: maxFiles,
    disabled: isUploading
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400" />
          )}
          <p className="text-lg font-medium">{title}</p>
          <p className="text-sm text-gray-500">
            {isUploading ? 'Processing files...' : 'Drag & drop files here, or click to select files'}
          </p>
          <p className="text-xs text-gray-400">
            Supports PDF, DOC, and DOCX formats
          </p>
          {maxFiles && (
            <p className="text-xs text-gray-500">
              {currentCount}/{maxFiles} files uploaded
            </p>
          )}
        </div>
      </div>
      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-center text-gray-500">{progress}% complete</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
