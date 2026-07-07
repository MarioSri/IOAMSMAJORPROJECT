import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabaseStorageService } from '@/services/SupabaseStorageService';
import { Badge } from '@/components/ui/badge';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import isJpg from 'is-jpg';
import { sanitizeForDisplay } from '@/utils/sanitize';

// Lazy load heavy libraries only when needed
let pdfjsLib: any = null;
let mammoth: any = null;
let XLSX: any = null;

const loadPdfJs = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    // Set up PDF.js worker
    if (typeof window !== 'undefined') {
      const pdfjsVersion = pdfjsLib.version || '5.4.296';
      const workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
      console.log('PDF.js version:', pdfjsVersion);
      console.log('Setting worker source to:', workerSrc);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
  }
  return pdfjsLib;
};

const loadMammoth = async () => {
  if (!mammoth) {
    mammoth = await import('mammoth');
  }
  return mammoth;
};

const loadXLSX = async () => {
  if (!XLSX) {
    XLSX = await import('xlsx');
  }
  return XLSX;
};

interface FileViewerProps {
  file?: File | null;
  files?: File[]; // Support for multiple files
  /** Remote Supabase Storage URL for a single file (alternative to `file` prop) */
  fileUrl?: string;
  /** Remote Supabase Storage URLs for multiple files (alternative to `files` prop) */
  fileUrls?: string[];
  /** File names corresponding to fileUrls, used as fallback to infer MIME type */
  fileNames?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FileType = 'pdf' | 'word' | 'excel' | 'image' | 'unsupported';

export const FileViewer: React.FC<FileViewerProps> = ({ file, files, fileUrl, fileUrls, fileNames, open, onOpenChange }) => {
  // Remote URL loading state — resolved into File objects before rendering
  const [resolvedFiles, setResolvedFiles] = React.useState<File[]>([]);
  const [urlLoading, setUrlLoading] = React.useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fileType, setFileType] = useState<FileType>('unsupported');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  // ── Resolve remote URLs to File objects when fileUrl / fileUrls are provided ──
  useEffect(() => {
    if (!open) return;

    const hasRemoteUrls = (fileUrls && fileUrls.length > 0) || !!fileUrl;
    if (!hasRemoteUrls) {
      setResolvedFiles([]);
      return;
    }

    const urls = fileUrls && fileUrls.length > 0 ? fileUrls : fileUrl ? [fileUrl] : [];
    if (urls.length === 0) return;

    setUrlLoading(true);
    setResolvedFiles([]);

    Promise.all(
      urls.map((url, idx) => {
        const name = fileNames?.[idx] || url.split('/').pop()?.split('?')[0] || `file-${idx + 1}`;
        return supabaseStorageService.fetchFileFromUrl(url, name);
      })
    )
      .then((fetched) => {
        setResolvedFiles(fetched);
      })
      .catch((err) => {
        console.error('[FileViewer] Failed to fetch remote file(s):', err);
      })
      .finally(() => {
        setUrlLoading(false);
      });
  }, [open, fileUrl, fileUrls, fileNames]);

  // Determine effective file list:
  // Priority: resolvedFiles (from remote URLs) > files prop > file prop
  const effectiveFiles: File[] =
    resolvedFiles.length > 0
      ? resolvedFiles
      : files && files.length > 0
        ? files
        : file
          ? [file]
          : [];

  // Determine if we're in multi-file mode
  const isMultiFile = effectiveFiles.length > 1;
  const currentFile = effectiveFiles[currentIndex] ?? null;

  // Reset current index when modal opens or files change
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open, files, fileUrls, fileUrl]);

  useEffect(() => {
    // Wait for URL resolution to complete before trying to load
    if (urlLoading) return;

    if (currentFile && open) {
      // Add a small delay to ensure modal and canvas are fully mounted
      const timer = setTimeout(() => {
        loadFile(currentFile);
      }, 100); // 100ms delay for DOM to be ready

      return () => clearTimeout(timer);
    }
    return () => {
      // Cleanup
      setContent(null);
      setError(null);
      setZoom(100);
      setRotation(0);
    };
  }, [currentFile, open, urlLoading]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !isMultiFile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isMultiFile, currentIndex]);

  const getFileType = (file: File): FileType => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type.toLowerCase();

    console.log('🔍 FileViewer - Detecting file type:', {
      name: file.name,
      extension: extension,
      mimeType: mimeType,
      size: file.size
    });

    if (extension === 'pdf' || mimeType === 'application/pdf') return 'pdf';
    if (['doc', 'docx'].includes(extension || '') || mimeType.includes('word')) return 'word';
    if (['xls', 'xlsx'].includes(extension || '') || mimeType.includes('sheet')) return 'excel';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(extension || '') || mimeType.startsWith('image/')) {
      console.log('✅ Image file detected:', extension || mimeType);
      return 'image';
    }

    console.warn('⚠️ Unsupported file type:', extension, mimeType);
    return 'unsupported';
  };

  const loadFile = async (file: File) => {
    setLoading(true);
    setError(null);
    const type = getFileType(file);
    setFileType(type);

    try {
      switch (type) {
        case 'pdf':
          await loadPDF(file);
          break;
        case 'word':
          await loadWord(file);
          break;
        case 'excel':
          await loadExcel(file);
          break;
        case 'image':
          await loadImage(file);
          break;
        default:
          setError('Unsupported file type');
      }
    } catch (err) {
      console.error('Error loading file:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Full error details:', {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        fileType: type,
        fileName: file.name
      });

      setError(`Failed to load file: ${errorMessage}`);
      toast({
        title: "Error Loading File",
        description: `${errorMessage}. Check browser console for details.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPDF = async (file: File) => {
    try {
      console.log('Starting PDF load for file:', file.name, 'Size:', file.size);

      // Lazy load pdfjs-dist library
      const pdfjs = await loadPdfJs();

      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);

      // Load PDF document
      console.log('Creating PDF loading task...');
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });

      console.log('Waiting for PDF to load...');
      const pdf = await loadingTask.promise;
      console.log('PDF loaded successfully! Pages:', pdf.numPages);

      // Render ALL pages
      const pageCanvases: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`Rendering page ${pageNum} of ${pdf.numPages}...`);

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create a temporary canvas for this page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error(`Could not get canvas context for page ${pageNum}`);
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render the page
        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;

        // Convert canvas to data URL and store
        pageCanvases.push(canvas.toDataURL());
        console.log(`Page ${pageNum} rendered successfully`);
      }

      setContent({
        type: 'pdf',
        totalPages: pdf.numPages,
        currentPage: 1,
        pdf: pdf,
        pageCanvases: pageCanvases
      });

      console.log('All PDF pages rendered and content state updated');
    } catch (error) {
      console.error('PDF loading error:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadWord = async (file: File) => {
    // Lazy load mammoth library
    const mammothLib = await loadMammoth();
    
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammothLib.default.convertToHtml({ arrayBuffer });

    if (result.messages.length > 0) {
      console.warn('Mammoth conversion warnings:', result.messages);
    }

    setContent({ type: 'word', html: result.value });
  };

  const loadExcel = async (file: File) => {
    // Lazy load xlsx library
    const xlsxLib = await loadXLSX();
    
    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsxLib.read(arrayBuffer, { type: 'array' });

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to HTML
    const html = xlsxLib.utils.sheet_to_html(worksheet);

    setContent({
      type: 'excel',
      html,
      sheetNames: workbook.SheetNames,
      workbook
    });
  };

  const loadImage = async (file: File) => {
    console.log('🖼️ Loading image file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file
    if (!file || file.size === 0) {
      console.error('❌ Invalid file: empty or null');
      throw new Error('Invalid image file: file is empty');
    }

    if (!file.type.startsWith('image/')) {
      console.warn('⚠️ File MIME type not recognized as image:', file.type);
    }

    return new Promise<void>((resolve, reject) => {
      // Try to read the file as text first to check if it's already a data URL
      const textReader = new FileReader();

      textReader.onload = (e) => {
        const text = e.target?.result as string;

        // Check if the file content is already a data URL (happens when File is created from base64)
        if (text && text.startsWith('data:image/')) {
          console.log('✅ File is already a data URL, using directly');

          // Verify the image can be loaded
          const img = new Image();

          img.onload = () => {
            console.log('✅ Image loaded successfully from existing data URL:', {
              width: img.naturalWidth,
              height: img.naturalHeight,
              type: file.type
            });
            setContent({ type: 'image', url: text });
            resolve();
          };

          img.onerror = (err) => {
            console.error('❌ Failed to load image from existing data URL:', err);
            // Try the normal FileReader approach as fallback
            loadImageWithFileReader(file, resolve, reject);
          };

          img.src = text;
        } else {
          // File is binary data, use FileReader to convert to data URL
          loadImageWithFileReader(file, resolve, reject);
        }
      };

      textReader.onerror = () => {
        // If text reading fails, try the normal FileReader approach
        console.log('⚠️ Could not read as text, trying binary read');
        loadImageWithFileReader(file, resolve, reject);
      };

      try {
        // Try to read a small portion as text to check format
        textReader.readAsText(file.slice(0, 100));
      } catch (error) {
        // If slicing fails, use normal approach
        loadImageWithFileReader(file, resolve, reject);
      }
    });
  };

  const loadImageWithFileReader = async (file: File, resolve: () => void, reject: (error: Error) => void) => {
    // First, validate JPG/JPEG files using is-jpg
    if (file.type === 'image/jpeg' || file.type === 'image/jpg' ||
      file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {

      console.log('🔍 Validating JPEG file with is-jpg...');

      try {
        // Read file as ArrayBuffer for validation
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        console.log('📊 JPEG validation data:', {
          fileName: file.name,
          fileSize: file.size,
          arrayBufferSize: arrayBuffer.byteLength,
          firstBytes: Array.from(uint8Array.slice(0, 10)),
          lastBytes: Array.from(uint8Array.slice(-10))
        });

        // Validate JPEG signature
        const isValidJpg = isJpg(uint8Array);

        if (!isValidJpg) {
          console.error('❌ Invalid JPEG file detected by is-jpg');
          reject(new Error('Invalid JPEG file: File signature does not match JPEG format. The file may be corrupted.'));
          return;
        }

        console.log('✅ JPEG validation passed!');
      } catch (validationError) {
        console.error('❌ JPEG validation failed:', validationError);
        reject(new Error(`JPEG validation failed: ${validationError}`));
        return;
      }
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        console.error('❌ Failed to read image data');
        reject(new Error('Failed to read image data'));
        return;
      }

      console.log('✅ Image data URL created via FileReader:', {
        length: dataUrl.length,
        preview: dataUrl.substring(0, 50) + '...'
      });

      // Verify the image can be loaded
      const img = new Image();

      img.onload = () => {
        console.log('✅ Image loaded successfully:', {
          width: img.naturalWidth,
          height: img.naturalHeight,
          type: file.type
        });
        setContent({ type: 'image', url: dataUrl });
        resolve();
      };

      img.onerror = (err) => {
        console.error('❌ Failed to load image from data URL:', {
          error: err,
          fileType: file.type,
          fileName: file.name,
          dataUrlPreview: dataUrl.substring(0, 100),
          fileSize: file.size
        });
        reject(new Error(`Failed to load image. File type: ${file.type}. Size: ${file.size} bytes. The file may be corrupted or in an unsupported format.`));
      };

      img.src = dataUrl;
    };

    reader.onerror = (err) => {
      console.error('❌ FileReader error:', err);
      reject(new Error('Failed to read image file'));
    };

    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('❌ Error reading file:', error);
      reject(error);
    }
  };



  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Multi-file navigation handlers
  const handlePrevious = () => {
    if (isMultiFile && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setZoom(100);
      setRotation(0);
    }
  };

  const handleNext = () => {
    if (isMultiFile && files && currentIndex < files.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setZoom(100);
      setRotation(0);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading file...</p>
            {fileType === 'pdf' && (
              <p className="text-xs text-muted-foreground mt-2">
                Rendering all pages...
              </p>
            )}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive font-medium mb-2">Error Loading File</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      );
    }

    if (!content) {
      return null;
    }

    // Check if file has signature metadata attached
    const signatureMetadata = currentFile
      ? (currentFile as any).signatureMetadata ?? (currentFile as any).signature_metadata
      : null;

    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex flex-col items-center space-y-4 py-4">
            {content?.pageCanvases && content.pageCanvases.map((pageDataUrl, index) => (
              <div key={index} className="relative">
                <img
                  src={pageDataUrl}
                  alt={`Page ${index + 1}`}
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                    transition: 'transform 0.3s ease',
                    maxWidth: '100%',
                    height: 'auto',
                  }}
                  className="border shadow-lg rounded"
                />
                <Badge variant="secondary" className="absolute top-2 right-2 bg-background/95 backdrop-blur">
                  Page {index + 1}
                </Badge>

                {/* Render signatures if metadata exists */}
                {signatureMetadata && signatureMetadata.length > 0 && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      transformOrigin: 'center',
                    }}
                  >
                    {signatureMetadata
                      .filter((sig: any) => !sig.pageNumber || sig.pageNumber === index + 1)
                      .map((signature: any) => (
                        <div
                          key={signature.id}
                          className="absolute"
                          style={{
                            left: `${(signature.xPercent ?? 0) * 100}%`,
                            top: `${(signature.yPercent ?? 0) * 100}%`,
                            width: `${(signature.widthPercent ?? 0.15) * 100}%`,
                            height: `${(signature.heightPercent ?? 0.05) * 100}%`,
                            transform: `rotate(${signature.rotation ?? 0}deg)`,
                            transformOrigin: 'center',
                          }}
                        >
                          <img
                            src={signature.data}
                            alt="Signature"
                            className="w-full h-full object-contain"
                            style={{
                              background: 'transparent',
                              mixBlendMode: 'multiply',
                              opacity: 1
                            }}
                            draggable={false}
                          />
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ))}
            {content && content.totalPages > 1 && (
              <Badge variant="secondary" className="sticky bottom-4 bg-background/95 backdrop-blur">
                Total: {content.totalPages} pages
              </Badge>
            )}
          </div>
        );

      case 'word':
        return (
          <div className="w-full max-w-4xl mx-auto px-4">
            <div className="relative">
              <div
                className="prose prose-sm max-w-none p-6 bg-white rounded shadow-sm text-sm"
                style={{
                  zoom: `${zoom}%`,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeForDisplay(content.html) }}
              />

              {/* Render signatures if metadata exists */}
              {signatureMetadata && signatureMetadata.length > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    zoom: `${zoom}%`,
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                  }}
                >
                  {signatureMetadata.map((signature: any) => (
                    <div
                      key={signature.id}
                      className="absolute"
                      style={{
                        left: `${(signature.xPercent ?? 0) * 100}%`,
                        top: `${(signature.yPercent ?? 0) * 100}%`,
                        width: `${(signature.widthPercent ?? 0.15) * 100}%`,
                        height: `${(signature.heightPercent ?? 0.05) * 100}%`,
                        transform: `rotate(${signature.rotation ?? 0}deg)`,
                        transformOrigin: 'center',
                      }}
                    >
                      <img
                        src={signature.data}
                        alt="Signature"
                        className="w-full h-full object-contain"
                        style={{
                          background: 'transparent',
                          mixBlendMode: 'multiply',
                          opacity: 1
                        }}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'excel':
        return (
          <div className="w-full space-y-4 px-2">
            {content.sheetNames.length > 1 && (
              <div className="flex gap-2 flex-wrap sticky top-0 bg-background/95 backdrop-blur p-2 rounded-lg border z-10">
                {content.sheetNames.map((name: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-[10px] sm:text-xs">
                    <FileSpreadsheet className="h-3 w-3 mr-1" />
                    {name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border shadow-sm">
              <div
                className="bg-white p-2 sm:p-4 inline-block min-w-full text-[10px] sm:text-sm"
                style={{
                  zoom: `${zoom}%`,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'top left',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeForDisplay(content.html) }}
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="flex justify-center items-center py-4 min-h-[400px]">
            <div className="relative inline-block">
              <img
                src={content.url}
                alt={currentFile?.name || 'Image'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  height: 'auto',
                  width: 'auto',
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease',
                  transformOrigin: 'center',
                }}
                className="rounded shadow-lg"
                onLoad={() => console.log('✅ Image rendered in viewer successfully')}
                onError={(e) => {
                  console.error('❌ Image rendering in viewer failed:', e);
                }}
              />

              {/* Render signatures if metadata exists */}
              {signatureMetadata && signatureMetadata.length > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                  }}
                >
                  {signatureMetadata.map((signature: any) => (
                    <div
                      key={signature.id}
                      className="absolute"
                      style={{
                        left: `${(signature.xPercent ?? 0) * 100}%`,
                        top: `${(signature.yPercent ?? 0) * 100}%`,
                        width: `${(signature.widthPercent ?? 0.15) * 100}%`,
                        height: `${(signature.heightPercent ?? 0.05) * 100}%`,
                        transform: `rotate(${signature.rotation ?? 0}deg)`,
                        transformOrigin: 'center',
                      }}
                    >
                      <img
                        src={signature.data}
                        alt="Signature"
                        className="w-full h-full object-contain"
                        style={{
                          background: 'transparent',
                          mixBlendMode: 'multiply',
                          opacity: 1
                        }}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Unsupported file type</p>
            </div>
          </div>
        );
    }
  };

  const getFileIcon = () => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'word':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'excel':
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
      case 'image':
        return <ImageIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:w-[98vw] sm:max-w-6xl h-full sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-3 sm:p-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pr-10 sm:pr-12 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {getFileIcon()}
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm sm:text-base md:text-lg truncate font-semibold">
                  {currentFile?.name || 'File Viewer'}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  {isMultiFile && (
                    <Badge variant="secondary" className="text-[10px] shrink-0 h-4 px-1.5">
                      {currentIndex + 1} / {files?.length}
                    </Badge>
                  )}
                  {currentFile && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {(currentFile.size / 1024 / 1024).toFixed(2)} MB • {fileType.toUpperCase()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-start xs:self-auto overflow-x-auto pb-1 xs:pb-0 no-scrollbar">
              {/* Multi-file Navigation */}
              {isMultiFile && (
                <div className="flex items-center gap-1 mr-1 border-r pr-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    title="Previous file (←)"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                    onClick={handleNext}
                    disabled={!files || currentIndex === files.length - 1}
                    title="Next file (→)"
                  >
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              )}

              {/* Zoom Controls */}
              {['pdf', 'word', 'excel', 'image'].includes(fileType) && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                  >
                    <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <div className="bg-secondary text-[10px] sm:text-xs h-7 sm:h-8 px-2 flex items-center rounded-md font-medium min-w-[40px] justify-center">
                    {zoom}%
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                  >
                    <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 ml-1"
                    onClick={handleRotate}
                    title="Rotate"
                  >
                    <RotateCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30">
          <div className="min-h-full w-full flex flex-col items-center p-2 sm:p-4 md:p-8">
            <div className="w-full max-w-full overflow-visible flex flex-col items-center">
              {renderContent()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
