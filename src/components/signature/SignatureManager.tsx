import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DecentralizedChatService } from '@/services/DecentralizedChatService';
import { SignatureRequest, DigitalSignature } from '@/types/chat';
import { cn } from '@/lib/utils';
import {
  PenTool,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  FileText,
  CalendarDays,
  MapPin,
  Shield
} from 'lucide-react';

interface SignatureManagerProps {
  chatService: DecentralizedChatService;
  channelId: string;
  userId: string;
  className?: string;
}

export const SignatureManager: React.FC<SignatureManagerProps> = ({
  chatService,
  channelId,
  userId,
  className
}) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [documentId, setDocumentId] = useState('');

  useEffect(() => {
    loadSignatureRequests();
  }, [channelId]);

  const loadSignatureRequests = async () => {
    // In a real implementation, this would load from the chat service
    setSignatureRequests([]);
  };

  const handleCreateSignatureRequest = async () => {
    if (!title.trim() || !description.trim() || targetUsers.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const request: Partial<SignatureRequest> = {
      documentId: documentId || `doc-${Date.now()}`,
      requestedBy: userId,
      targetUsers,
      title,
      description,
      deadline: deadline ? new Date(deadline) : undefined
    };

    try {
      const createdRequest = await chatService.createSignatureRequest(request);
      setSignatureRequests(prev => [createdRequest, ...prev]);
      
      // Reset form
      setTitle('');
      setDescription('');
      setTargetUsers([]);
      setDeadline('');
      setDocumentId('');
      setIsCreating(false);
      
      toast({
        title: 'Signature Request Created',
        description: 'Your signature request has been sent to the recipients',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create signature request',
        variant: 'destructive'
      });
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const handleSign = async (requestId: string) => {
    if (!signatureData) {
      toast({
        title: 'No Signature',
        description: 'Please draw your signature first',
        variant: 'destructive'
      });
      return;
    }

    const signature: DigitalSignature = {
      id: `sig-${Date.now()}`,
      userId,
      signatureData,
      signedAt: new Date(),
      ipAddress: '127.0.0.1', // In real app, get actual IP
      verified: true
    };

    try {
      // Update signature request
      setSignatureRequests(prev => prev.map(req => {
        if (req.id === requestId) {
          return {
            ...req,
            signatures: [...req.signatures, signature],
            status: req.signatures.length + 1 >= req.targetUsers.length ? 'completed' : 'pending'
          };
        }
        return req;
      }));

      setIsSigning(false);
      setSelectedRequest(null);
      clearSignature();
      
      toast({
        title: 'Document Signed',
        description: 'Your signature has been recorded',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to record signature',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'expired': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-gray-500" />;
      default: return <Clock className="w-5 h-5 text-orange-500" />;
    }
  };

  const getTimeRemaining = (deadline?: Date) => {
    if (!deadline) return null;
    
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const hasUserSigned = (request: SignatureRequest): boolean => {
    return request.signatures.some(sig => sig.userId === userId);
  };

  const isExpired = (request: SignatureRequest): boolean => {
    return request.deadline ? new Date() > request.deadline : false;
  };

  const SignatureRequestCard: React.FC<{ request: SignatureRequest }> = ({ request }) => {
    const userSigned = hasUserSigned(request);
    const expired = isExpired(request);
    const canSign = request.targetUsers.includes(userId) && !userSigned && !expired;
    const completionRate = (request.signatures.length / request.targetUsers.length) * 100;

    return (
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon(request.status)}
                {request.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {request.description}
              </p>
            </div>
            <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
              {request.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {request.signatures.length}/{request.targetUsers.length} signed
            </div>
            {request.deadline && (
              <div className="flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {getTimeRemaining(request.deadline)}
              </div>
            )}
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Doc: {request.documentId}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion Progress</span>
                <span>{Math.round(completionRate)}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

            {/* Signature Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Signature Status</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {request.targetUsers.map(targetUserId => {
                  const signature = request.signatures.find(sig => sig.userId === targetUserId);
                  return (
                    <div
                      key={targetUserId}
                      className={cn(
                        "flex items-center justify-between p-2 rounded border",
                        signature ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <span className="text-sm">User {targetUserId}</span>
                      <div className="flex items-center gap-1">
                        {signature ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-600">
                              {signature.signedAt.toLocaleDateString()}
                            </span>
                          </>
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                {userSigned && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    You signed this
                  </Badge>
                )}
                {expired && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Expired
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  View Document
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {canSign && (
                  <Button 
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsSigning(true);
                    }}
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    Sign Now
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Digital Signatures</h3>
        <Button onClick={() => setIsCreating(true)}>
          <PenTool className="w-4 h-4 mr-2" />
          Request Signatures
        </Button>
      </div>

      {/* Create Signature Request Dialog */}
      <AlertDialog open={isCreating} onOpenChange={setIsCreating}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Create Signature Request</AlertDialogTitle>
            <AlertDialogDescription>
              Request digital signatures from team members for important documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Budget Approval Document"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about what needs to be signed..."
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Document ID</label>
              <Input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Enter document reference ID"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Target Users (comma-separated IDs)</label>
              <Textarea
                value={targetUsers.join(', ')}
                onChange={(e) => setTargetUsers(e.target.value.split(',').map(id => id.trim()).filter(Boolean))}
                placeholder="user1, user2, user3..."
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Deadline (Optional)</label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateSignatureRequest}>
              Send Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signature Dialog */}
      <AlertDialog open={isSigning} onOpenChange={setIsSigning}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Digital Signature Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRequest?.title} - {selectedRequest?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Signature Canvas</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Draw your signature in the box below using your mouse or touch screen.
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full border rounded cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              
              <div className="flex justify-between mt-3">
                <Button size="sm" variant="outline" onClick={clearSignature}>
                  Clear Signature
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  Location & timestamp will be recorded
                </div>
              </div>
            </div>
            
            {signatureData && (
              <div className="space-y-2">
                <h4 className="font-medium">Signature Preview</h4>
                <img src={signatureData} alt="Signature preview" className="border rounded p-2 bg-white" />
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedRequest && handleSign(selectedRequest.id)}
              disabled={!signatureData}
            >
              <PenTool className="w-4 h-4 mr-2" />
              Sign Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signature Requests List */}
      <div className="space-y-4">
        {signatureRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <PenTool className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Signature Requests</h3>
              <p className="text-muted-foreground text-center">
                Create signature requests to collect digital signatures on important documents.
              </p>
            </CardContent>
          </Card>
        ) : (
          signatureRequests.map(request => (
            <SignatureRequestCard key={request.id} request={request} />
          ))
        )}
      </div>
    </div>
  );
};
