
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

// Set worker source to use the bundled worker that matches our API version
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// Define helper type interfaces for better type safety
interface TextItem {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  dir?: string;
  fontName?: string;
  x?: number;
  y?: number;
}

interface TextMarkedContent {
  type: string;
  items: Array<TextItem | TextMarkedContent>;
}

type TextContent = {
  items: Array<TextItem | TextMarkedContent>;
  styles?: Record<string, any>;
};

// Helper function to check if PDF might contain image-based content
async function isPDFScanned(pdf: any): Promise<boolean> {
  try {
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent() as TextContent;
    
    // If there's very little text on the first page, it might be scanned
    if (!textContent.items || textContent.items.length < 5) {
      // Get operatorList to check for image operations
      const opList = await page.getOperatorList();
      
      // Check if page has image operations but few text items
      const hasImages = opList.fnArray.some(op => op === 82); // 82 = OPS.paintImageXObject
      return hasImages;
    }
    return false;
  } catch (error) {
    console.error('Error checking if PDF is scanned:', error);
    return false;
  }
}

// OCR function to extract text from images
async function extractTextFromImage(imageData: ArrayBuffer | Blob): Promise<string> {
  try {
    console.log('Running OCR on image data...');
    const worker = await Tesseract.createWorker('eng');
    
    // Create a Blob from the image data if it's an ArrayBuffer
    const blob = imageData instanceof Blob ? imageData : new Blob([imageData], { type: 'image/png' });
    
    // Recognize text
    const { data } = await worker.recognize(blob);
    await worker.terminate();
    
    console.log('OCR completed successfully');
    return data.text;
  } catch (error) {
    console.error('OCR error:', error);
    return '';
  }
}

// Main function to extract text from PDFs
async function extractTextFromPDF(file: ArrayBuffer): Promise<string> {
  try {
    const pdf = await getDocument({ data: file }).promise;
    console.log(`PDF has ${pdf.numPages} pages`);
    
    // Skip OCR for now as it's not reliable in browser environment
    // Instead, use a more robust text extraction approach
    let fullText = '';
    let textByPage: string[] = [];
    
    // First pass: extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        console.log(`Processing PDF page ${i}/${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        if (!content || !content.items || content.items.length === 0) {
          console.warn(`No text content extracted from page ${i}`);
          textByPage.push('');
          continue;
        }
        
        // First, extract all text items with their positions
        const textItems = content.items
          .filter(item => 'str' in item && item.str.trim())
          .map(item => {
            const textItem = item as any;
            return {
              text: textItem.str,
              x: textItem.transform ? textItem.transform[4] : (textItem.x || 0),
              y: textItem.transform ? textItem.transform[5] : (textItem.y || 0),
              fontSize: textItem.height || 10
            };
          });
        
        // Sort items by position (top to bottom, left to right)
        textItems.sort((a, b) => {
          // Group items into lines based on y-position
          const lineHeight = Math.max(a.fontSize, b.fontSize) * 1.2;
          if (Math.abs(a.y - b.y) < lineHeight) {
            return a.x - b.x; // Same line, sort left to right
          }
          return b.y - a.y; // Different lines, sort top to bottom
        });
        
        // Process items into lines and paragraphs
        let currentY = null;
        let currentLine = '';
        let pageText = '';
        
        for (let j = 0; j < textItems.length; j++) {
          const item = textItems[j];
          const nextItem = j < textItems.length - 1 ? textItems[j + 1] : null;
          
          // Detect if we're on a new line
          if (currentY === null) {
            currentY = item.y;
          } else if (nextItem && Math.abs(item.y - nextItem.y) > item.fontSize) {
            // End of line detected
            currentLine += item.text;
            pageText += currentLine.trim() + '\n';
            currentLine = '';
            currentY = nextItem ? nextItem.y : null;
            continue;
          }
          
          // Add space between words if needed
          if (currentLine && !currentLine.endsWith(' ') && !item.text.startsWith(' ')) {
            // Check if words should be connected or separated
            if (nextItem && (nextItem.x - (item.x + item.text.length * (item.fontSize * 0.6))) > item.fontSize * 0.3) {
              currentLine += ' ';
            }
          }
          
          currentLine += item.text;
        }
        
        // Add the last line if any
        if (currentLine.trim()) {
          pageText += currentLine.trim() + '\n';
        }
        
        textByPage.push(pageText);
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
        textByPage.push('');
      }
    }
    
    // Second pass: enhance the extracted text
    for (let i = 0; i < textByPage.length; i++) {
      let pageText = textByPage[i];
      
      // Improve section detection
      pageText = pageText.replace(/([A-Z][A-Za-z\s]{2,}):?\s*\n/g, '\n$1:\n');
      
      // Improve list item formatting
      pageText = pageText.replace(/^[•\-\*]\s*(.*)/gm, '• $1');
      pageText = pageText.replace(/^(\d+\.?)\s*(.*)/gm, '$1 $2');
      
      // Clean up excessive whitespace
      pageText = pageText.replace(/\n{3,}/g, '\n\n');
      
      fullText += pageText + '\n\n';
    }
  
    // Clean up the text
    fullText = fullText
      .replace(/[\r\n]{3,}/g, '\n\n') // Normalize multiple line breaks
      .replace(/[^\S\r\n]+/g, ' ') // Normalize spaces
      .replace(/[-‐‑‒–—―]+/g, '-') // Normalize hyphens
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .trim();
    
    // Enhance sections related to skills, experience, etc.
    const keywordRegex = /\b(skills|experience|education|qualifications|requirements|responsibilities)\b/gi;
    let enhancedText = fullText;
    
    // Find and enhance sections
    let match;
    while ((match = keywordRegex.exec(fullText)) !== null) {
      const keyword = match[0];
      const index = match.index;
      
      // Make sure the keyword is at the beginning of a line or paragraph
      if (index === 0 || fullText[index-1] === '\n') {
        // Add proper formatting
        enhancedText = enhancedText.replace(
          new RegExp(`\\b${keyword}\\b\\s*:?`, 'i'),
          `\n${keyword.charAt(0).toUpperCase() + keyword.slice(1)}:`
        );
      }
    }
    
    // Final cleanup
    enhancedText = enhancedText
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    console.log('PDF parsing complete, extracted text length:', enhancedText.length);
    return enhancedText;
  } catch (error) {
    console.error('Error in PDF extraction:', error);
    throw error;
  }
}

export const getTextFromFile = async (file: File): Promise<string> => {
  try {
    console.log('Processing file:', file.name, 'type:', file.type);
    
    // Handle PDF files (check both MIME type and extension)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log('Processing PDF file:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        console.log('Starting PDF parsing with pdf.js');
        return await extractTextFromPDF(arrayBuffer);
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        // Try a simpler approach as fallback
        try {
          const pdf = await getDocument({ data: arrayBuffer }).promise;
          let text = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            for (const item of content.items) {
              if ('str' in item) {
                text += item.str + ' ';
              }
            }
            text += '\n\n';
          }
          
          return text;
        } catch (fallbackError) {
          console.error('Fallback PDF parsing also failed:', fallbackError);
          throw new Error(`Failed to parse PDF: ${pdfError.message}`);
        }
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Processing DOCX file:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      console.log('DOCX parsing complete, extracted text length:', result.value.length);
      return result.value;
    } else if (file.type === 'application/msword') {
      throw new Error('DOC format is not supported, please convert to DOCX or PDF');
    } else if (file.type === 'text/plain') {
      // Handle text files
      console.log('Processing plain text file:', file.name);
      const text = await file.text();
      return text;
    } else if (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/tiff') {
      // Handle image files with OCR
      console.log('Processing image file with OCR:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      return await extractTextFromImage(arrayBuffer);
    } else if (file.type === '') {
      // Some PDFs might have empty MIME type
      if (file.name.toLowerCase().endsWith('.pdf')) {
        console.log('Processing file with empty MIME type as PDF:', file.name);
        return getTextFromFile(new File([file], file.name, { type: 'application/pdf' }));
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        console.log('Processing file with empty MIME type as DOCX:', file.name);
        return getTextFromFile(new File([file], file.name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        console.log('Processing file with empty MIME type as text:', file.name);
        return getTextFromFile(new File([file], file.name, { type: 'text/plain' }));
      } else if (file.name.toLowerCase().match(/\.(jpg|jpeg|png|tiff|tif)$/)) {
        console.log('Processing file with empty MIME type as image:', file.name);
        const imageType = file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        return getTextFromFile(new File([file], file.name, { type: imageType }));
      }
    }
    
    throw new Error(`Unsupported file type: ${file.type}`);
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from ${file.name}: ${error.message}`);
  }
};
