import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  PenTool,
  RotateCcw,
  Save,
  Download,
  Camera,
  Upload,
  Palette,
  Settings,
  CheckCircle
} from 'lucide-react';

interface TouchSignaturePadProps {
  onSignatureCapture?: (signature: string) => void;
  className?: string;
}

interface SignatureSettings {
  strokeWidth: number;
  strokeColor: string;
  backgroundColor: string;
  smoothing: number;
}

export const TouchSignaturePad: React.FC<TouchSignaturePadProps> = ({
  onSignatureCapture,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [settings, setSettings] = useState<SignatureSettings>({
    strokeWidth: 3,
    strokeColor: '#000000',
    backgroundColor: '#ffffff',
    smoothing: 0.5
  });
  
  const { isMobile, windowSize } = useResponsive();
  const { toast } = useToast();
  
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const points = useRef<Array<{ x: number; y: number; pressure?: number }>>([]);

  // Dynamic canvas sizing based on device
  const getCanvasSize = () => {
    if (isMobile) {
      return {
        width: Math.min(windowSize.width - 32, 400),
        height: 200
      };
    }
    return { width: 500, height: 250 };
  };

  const canvasSize = getCanvasSize();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Configure context for smooth drawing
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = settings.strokeColor;
    ctx.lineWidth = settings.strokeWidth;
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Enable better line quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }, [canvasSize, settings]);

  const getEventPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
        pressure: (touch as any).force || 0.5
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: 0.5
      };
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getEventPosition(e);
    if (!pos) return;

    setIsDrawing(true);
    lastPoint.current = pos;
    points.current = [pos];

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getEventPosition]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getEventPosition(e);
    if (!pos || !lastPoint.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // Smooth line drawing with pressure sensitivity
    const distance = Math.sqrt(
      Math.pow(pos.x - lastPoint.current.x, 2) + 
      Math.pow(pos.y - lastPoint.current.y, 2)
    );

    if (distance > 1) {
      // Adjust stroke width based on pressure (for supported devices)
      const pressureWidth = settings.strokeWidth * (0.5 + pos.pressure * 0.5);
      ctx.lineWidth = pressureWidth;

      // Smooth curve drawing
      const midX = (lastPoint.current.x + pos.x) / 2;
      const midY = (lastPoint.current.y + pos.y) / 2;

      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
      ctx.stroke();

      lastPoint.current = pos;
      points.current.push(pos);
    }
  }, [isDrawing, getEventPosition, settings.strokeWidth]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPoint.current = null;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    points.current = [];
  }, [settings.backgroundColor]);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.current.length === 0) {
      toast({
        title: "No Signature",
        description: "Please draw a signature before saving",
        variant: "destructive"
      });
      return;
    }

    if (!signatureName.trim()) {
      toast({
        title: "Missing Name",
        description: "Please provide a name for your signature",
        variant: "destructive"
      });
      return;
    }

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    
    // Save to localStorage
    const savedSignatures = JSON.parse(localStorage.getItem('touch-signatures') || '[]');
    const newSignature = {
      id: Date.now().toString(),
      name: signatureName,
      dataUrl,
      createdAt: new Date().toISOString(),
      settings: { ...settings },
      pointCount: points.current.length
    };
    
    savedSignatures.push(newSignature);
    localStorage.setItem('touch-signatures', JSON.stringify(savedSignatures));

    if (onSignatureCapture) {
      onSignatureCapture(dataUrl);
    }

    toast({
      title: "Signature Saved",
      description: `Signature "${signatureName}" saved successfully`,
    });

    setSignatureName('');
    clearCanvas();
  }, [signatureName, settings, onSignatureCapture, toast, clearCanvas]);

  const downloadSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.current.length === 0) {
      toast({
        title: "No Signature",
        description: "Please draw a signature before downloading",
        variant: "destructive"
      });
      return;
    }

    const link = document.createElement('a');
    link.download = `signature-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();

    toast({
      title: "Signature Downloaded",
      description: "Signature saved to your device",
    });
  }, [toast]);

  return (
    <Card className={cn("shadow-elegant", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="w-5 h-5 text-primary" />
          Touch Signature Pad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 pb-8">
        {/* Settings */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="text-base font-medium">Stroke Width</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 6].map(width => (
                <Button
                  key={width}
                  variant={settings.strokeWidth === width ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSettings(prev => ({ ...prev, strokeWidth: width }))}
                  className={cn(isMobile && "h-12 w-12 p-0 min-w-[48px] min-h-[48px]")}
                >
                  {width}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Color</Label>
            <div className="flex gap-2">
              {['#000000', '#0066cc', '#cc0000', '#00cc00'].map(color => (
                <button
                  key={color}
                  className={cn(
                    "rounded border-2 transition-all touch-manipulation",
                    settings.strokeColor === color ? "border-primary scale-110" : "border-border",
                    isMobile ? "w-12 h-12 min-w-[48px] min-h-[48px]" : "w-8 h-8"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSettings(prev => ({ ...prev, strokeColor: color }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Background</Label>
            <div className="flex gap-2">
              {['#ffffff', '#f8f9fa', '#fff3cd', '#d1ecf1'].map(color => (
                <button
                  key={color}
                  className={cn(
                    "rounded border-2 transition-all touch-manipulation",
                    settings.backgroundColor === color ? "border-primary scale-110" : "border-border",
                    isMobile ? "w-12 h-12 min-w-[48px] min-h-[48px]" : "w-8 h-8"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSettings(prev => ({ ...prev, backgroundColor: color }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Actions</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              className={cn("w-full", isMobile && "h-12 min-h-[48px] touch-manipulation")}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex justify-center my-8">
          <div className="relative border-2 border-dashed border-border rounded-lg p-4">
            <canvas
              ref={canvasRef}
              className={cn(
                "border border-border rounded bg-white cursor-crosshair touch-none",
                "shadow-sm"
              )}
              style={{
                width: canvasSize.width,
                height: canvasSize.height
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            
            {/* Canvas overlay for better touch feedback */}
            {isMobile && (
              <div className="absolute inset-4 pointer-events-none">
                <div className="w-full h-full border border-primary/20 rounded" />
              </div>
            )}
          </div>
        </div>

        {/* Signature Info */}
        <div className="bg-muted/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Points captured:</span>
            <Badge variant="outline">{points.current.length}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Canvas size:</span>
            <Badge variant="outline">{canvasSize.width} × {canvasSize.height}</Badge>
          </div>
          {isMobile && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              💡 Use your finger or stylus to draw. Pressure sensitivity supported on compatible devices.
            </p>
          )}
        </div>

        {/* Save Controls */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="signature-name">Signature Name</Label>
            <Input
              id="signature-name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="e.g., Primary Signature"
              className={cn(isMobile && "h-16 text-lg min-h-[64px]")}
            />
          </div>

          <div className={cn(
            "flex gap-2",
            isMobile ? "flex-col gap-4" : "flex-row"
          )}>
            <Button
              onClick={saveSignature}
              variant="default"
              className={cn("flex-1", isMobile && "h-16 text-lg min-h-[64px] touch-manipulation")}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Signature
            </Button>
            
            <Button
              onClick={downloadSignature}
              variant="outline"
              className={cn("flex-1", isMobile && "h-16 text-lg min-h-[64px] touch-manipulation")}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        {/* Mobile-specific features */}
        {isMobile && (
          <div className="space-y-6 pt-6 border-t">
            <h4 className="font-medium text-lg">Mobile Features</h4>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-16 text-base min-h-[64px] touch-manipulation">
                <Camera className="w-4 h-4 mr-2" />
                Camera Capture
              </Button>
              <Button variant="outline" className="h-16 text-base min-h-[64px] touch-manipulation">
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};