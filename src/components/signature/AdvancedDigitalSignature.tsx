import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Camera, 
  Save, 
  Trash2, 
  Download, 
  Upload, 
  CheckCircle, 
  Settings,
  Scan,
  RotateCcw,
  Crop,
  Palette,
  Layers,
  XCircle
} from "lucide-react";
import { AdvancedSignatureIcon } from "@/components/ui/signature-icon";
import { useToast } from "@/hooks/use-toast";

interface AdvancedDigitalSignatureProps {
  userRole: string;
}

interface SignatureData {
  id: string;
  name: string;
  dataUrl: string;
  type: 'drawn' | 'scanned' | 'uploaded';
  quality: number;
  createdAt: Date;
  metadata: {
    width: number;
    height: number;
    signer: string;
    role: string;
  };
}

// Helper function to safely format dates
const formatDate = (date: Date | string): string => {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString();
  } catch (error) {
    return 'Invalid Date';
  }
};

export const AdvancedDigitalSignature: React.FC<AdvancedDigitalSignatureProps> = ({ userRole }) => {
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<SignatureData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 200 });
  const [brushSize, setBrushSize] = useState(2);
  const [brushColor, setBrushColor] = useState('#000000');
  const [cameraActive, setCameraActive] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(70);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSignatures = localStorage.getItem('advancedSignatures');
      if (savedSignatures) {
        const parsed = JSON.parse(savedSignatures);
        // Convert createdAt strings back to Date objects
        const signatures = parsed.map((sig: any) => ({
          ...sig,
          createdAt: new Date(sig.createdAt)
        }));
        setSignatures(signatures);
      }
    } catch (error) {
      console.error('Error loading signatures from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem('advancedSignatures');
    }
  }, []);

  const saveSignatures = (newSignatures: SignatureData[]) => {
    setSignatures(newSignatures);
    localStorage.setItem('advancedSignatures', JSON.stringify(newSignatures));
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x, y;
    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const calculateSignatureQuality = (canvas: HTMLCanvasElement): number => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let nonWhitePixels = 0;
    const totalPixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      if (r < 250 || g < 250 || b < 250) {
        nonWhitePixels++;
      }
    }
    
    const coverage = (nonWhitePixels / totalPixels) * 100;
    return Math.min(coverage * 10, 100); // Scale to 0-100
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !signatureName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a signature name and draw a signature",
        variant: "destructive"
      });
      return;
    }

    const quality = calculateSignatureQuality(canvas);
    
    if (quality < qualityThreshold) {
      toast({
        title: "Low Quality Signature",
        description: `Signature quality is ${quality.toFixed(1)}%. Please redraw for better quality.`,
        variant: "destructive"
      });
      return;
    }

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    
    const newSignature: SignatureData = {
      id: Date.now().toString(),
      name: signatureName,
      dataUrl,
      type: 'drawn',
      quality,
      createdAt: new Date(),
      metadata: {
        width: canvasSize.width,
        height: canvasSize.height,
        signer: userRole,
        role: userRole
      }
    };

    const updatedSignatures = [...signatures, newSignature];
    saveSignatures(updatedSignatures);
    setSignatureName('');
    clearCanvas();
    
    toast({
      title: "Signature Saved",
      description: `Signature saved with ${quality.toFixed(1)}% quality`,
    });
  };

  const startCamera = async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Camera Not Supported",
          description: "Your browser doesn't support camera access",
          variant: "destructive"
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        
        toast({
          title: "Camera Started",
          description: "Camera is ready for signature capture",
          variant: "default"
        });
      }
    } catch (error: any) {
      let errorMessage = "Unable to access camera";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera access denied. Please allow camera permissions and try again.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found on this device";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is already in use by another application";
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const captureFromCamera = () => {
    if (!cameraActive) {
      toast({
        title: "Camera Not Active",
        description: "Please start the camera first before capturing",
        variant: "destructive"
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      toast({
        title: "Capture Error",
        description: "Camera or canvas not ready",
        variant: "destructive"
      });
      return;
    }

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      toast({
        title: "Camera Not Ready",
        description: "Please wait for camera to load completely",
        variant: "destructive"
      });
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas and draw video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Auto-stop camera after capture
    stopCamera();
    
    toast({
      title: "Signature Captured",
      description: "Signature captured from camera successfully. You can now save it or make adjustments.",
      variant: "default"
    });
  };

  const stopCamera = () => {
    if (!cameraActive) {
      toast({
        title: "Camera Not Active",
        description: "Camera is already stopped",
        variant: "default"
      });
      return;
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track:`, track.label);
      });
      
      // Clear the video source
      videoRef.current.srcObject = null;
      setCameraActive(false);
      
      toast({
        title: "Camera Stopped",
        description: "Camera has been turned off",
        variant: "default"
      });
    }
  };

  const uploadSignature = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scale image to fit canvas
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        toast({
          title: "Image Uploaded",
          description: "Signature image loaded successfully",
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const deleteSignature = (id: string) => {
    const updatedSignatures = signatures.filter(sig => sig.id !== id);
    saveSignatures(updatedSignatures);
    
    toast({
      title: "Signature Deleted",
      description: "Signature removed from library",
    });
  };

  const loadSignature = (signature: SignatureData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = signature.dataUrl;
    
    setSelectedSignature(signature);
    
    toast({
      title: "Signature Loaded",
      description: "Signature loaded to canvas",
    });
  };

  const exportSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `signature-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    toast({
      title: "Signature Exported",
      description: "Signature downloaded as PNG",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AdvancedSignatureIcon className="w-5 h-5 text-primary" />
            Advanced Digital Signature System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="draw" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="draw">Draw</TabsTrigger>
              <TabsTrigger value="camera">Camera</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="space-y-4">
              {/* Drawing Controls */}
              <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Label>Size:</Label>
                  <div className="flex gap-1">
                    {[1, 2, 4, 6].map(size => (
                      <Button
                        key={size}
                        variant={brushSize === size ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBrushSize(size)}
                      >
                        {size}px
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label>Color:</Label>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-8 h-8 rounded border"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Label>Canvas:</Label>
                  <select
                    value={`${canvasSize.width}x${canvasSize.height}`}
                    onChange={(e) => {
                      const [width, height] = e.target.value.split('x').map(Number);
                      setCanvasSize({ width, height });
                    }}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="300x150">Small (300×150)</option>
                    <option value="400x200">Medium (400×200)</option>
                    <option value="500x250">Large (500×250)</option>
                    <option value="600x300">Extra Large (600×300)</option>
                  </select>
                </div>
                
                <Button onClick={clearCanvas} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>

              {/* Drawing Canvas */}
              <div className="flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className="border-2 border-dashed border-border rounded-lg bg-white cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              {/* Save Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <Input
                  placeholder="Signature name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Quality threshold:</Label>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={qualityThreshold}
                    onChange={(e) => setQualityThreshold(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm">{qualityThreshold}%</span>
                </div>
                <Button onClick={saveSignature} variant="default">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              <div className="space-y-4">
                {/* Camera Status Alert */}
                {cameraActive && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-green-800">Camera Active</span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">Position your signature in view and click "Capture Signature" when ready.</p>
                  </div>
                )}
                
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={startCamera} 
                    disabled={cameraActive}
                    variant={cameraActive ? "secondary" : "default"}
                    className={cameraActive ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {cameraActive ? "Camera Active" : "Start Camera"}
                  </Button>
                  <Button 
                    onClick={captureFromCamera} 
                    variant="outline"
                    className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Capture Signature
                  </Button>
                  <Button 
                    onClick={stopCamera} 
                    variant="outline"
                    className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700 hover:text-red-800"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Stop Camera
                  </Button>
                </div>
                
                {cameraActive && (
                  <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      playsInline
                      className="max-w-full h-64 border-2 border-dashed border-gray-300 rounded-lg shadow-sm"
                    />
                  </div>
                )}
                
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <p><strong>Tips for camera capture:</strong></p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Place signature on white paper</li>
                    <li>Ensure good lighting</li>
                    <li>Hold camera steady</li>
                    <li>Fill the frame with the signature</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">Upload Signature Image</p>
                  <p className="text-sm text-muted-foreground">
                    Click to browse or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports: PNG, JPG, JPEG, GIF
                  </p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={uploadSignature}
                  className="hidden"
                />
                
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <p><strong>Best practices for uploaded signatures:</strong></p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Use high-resolution images (300 DPI or higher)</li>
                    <li>Ensure signature is on white background</li>
                    <li>Crop closely around the signature</li>
                    <li>Use PNG format for transparency</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="library" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {signatures.map((signature) => (
                  <Card key={signature.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{signature.name}</h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSignature(signature.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        
                        <div className="aspect-[2/1] border rounded bg-white flex items-center justify-center overflow-hidden">
                          <img 
                            src={signature.dataUrl} 
                            alt={signature.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Quality:</span>
                            <Badge 
                              variant={signature.quality >= 80 ? "default" : signature.quality >= 60 ? "secondary" : "destructive"}
                              className="text-xs"
                            >
                              {signature.quality.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="capitalize">{signature.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Created:</span>
                            <span>{formatDate(signature.createdAt)}</span>
                          </div>
                        </div>
                        
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => loadSignature(signature)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Use Signature
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {signatures.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <AdvancedSignatureIcon className="w-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No signatures saved yet</p>
                    <p className="text-sm">Create your first signature using the tools above</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Export Controls */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={exportSignature} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export PNG
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};