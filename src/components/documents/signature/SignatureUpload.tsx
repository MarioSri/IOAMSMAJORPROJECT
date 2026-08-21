/**
 * SignatureUpload
 * Handles image file uploads and runs the Adobe ink extraction pipeline.
 * Replaces the raw file-input block in the monolith.
 */
import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { extractInk } from '../rendering/AdobeRenderEngine';
import { useToast } from '@/hooks/use-toast';

interface SignatureUploadProps {
  onCapture: (dataUrl: string) => void;
  inkColor?: string;
}

const ACCEPTED = '.png,.jpg,.jpeg,.gif,.bmp,.webp,.svg';
const MAX_SIGNATURE_BYTES = 12 * 1024 * 1024;

export const SignatureUpload: React.FC<SignatureUploadProps> = ({
  onCapture,
  inkColor = '#000000',
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/') && file.name !== undefined) {
        toast({ title: 'Unsupported signature file', description: 'Please upload a PNG, JPG, WebP, GIF, BMP, or SVG image.', variant: 'destructive' });
        return;
      }
      if (file.size > MAX_SIGNATURE_BYTES) {
        toast({ title: 'Signature image is too large', description: 'Please upload an image smaller than 12 MB.', variant: 'destructive' });
        return;
      }
      setIsProcessing(true);
      setPreview(null);
      try {
        const reader = new FileReader();
        const raw = await new Promise<string>((res, rej) => {
          reader.onload = (e) => res(e.target!.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        // Run Adobe ink extraction in "upload" mode:
        // skip color replacement — only remove white background to preserve original image
        const processed = await extractInk(raw, inkColor, 0.95, true);
        setPreview(processed);
        onCapture(processed);
      } catch (error) {
        toast({ title: 'Signature processing failed', description: error instanceof Error ? error.message : 'Please try a clearer signature image.', variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
    },
    [inkColor, onCapture, toast],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    processFile(files[0]);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        className={`flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/30'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-medium">Extracting ink…</span>
          </div>
        ) : preview ? (
          <img
            src={preview}
            alt="Uploaded signature"
            className="max-w-full max-h-[140px] object-contain"
            draggable={false}
          />
        ) : (
          <div className="text-center text-gray-400 p-4 space-y-2">
            <Upload className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-sm font-medium">Drop signature image here</p>
            <p className="text-xs">or click to browse — {ACCEPTED}</p>
          </div>
        )}
      </label>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}
          disabled={!preview}
        >
          Clear
        </Button>
        <Button
          size="sm"
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
        >
          {preview ? 'Replace Image' : 'Browse'}
        </Button>
      </div>
    </div>
  );
};

export default SignatureUpload;
