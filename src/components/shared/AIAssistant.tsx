import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  Sparkles,
  FileText,
  Users,
  Clock,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Lightbulb
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIAssistantProps {
  userRole: string;
}

interface AIInsight {
  id: string;
  type: "summary" | "suggestion" | "optimization" | "prediction";
  title: string;
  content: string;
  confidence: number;
  action?: string;
}

export function AIAssistant({ userRole }: AIAssistantProps) {
  const [documentText, setDocumentText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([
    {
      id: "1",
      type: "summary",
      title: "Document Summary",
      content: "This faculty recruitment authorization requests approval for hiring 3 new CSE faculty members to address growing student enrollment and curriculum expansion.",
      confidence: 95
    },
    {
      id: "2",
      type: "suggestion",
      title: "Recipient Recommendation",
      content: "Based on document type and content, suggest sending to: HOD-CSE, Registrar, and Principal for approval workflow.",
      confidence: 88
    },
    {
      id: "3",
      type: "optimization",
      title: "Process Improvement",
      content: "Similar requests typically take 3-5 days for approval. Consider creating a fast-track template for urgent recruitment needs.",
      confidence: 92
    }
  ]);

  const { toast } = useToast();

  const generateSummary = async () => {
    if (!documentText.trim()) {
      toast({
        title: "No Content",
        description: "Please enter document content to generate summary.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    // Simulate AI processing
    setTimeout(() => {
      const newInsight: AIInsight = {
        id: Date.now().toString(),
        type: "summary",
        title: "AI Generated Summary",
        content: `Key points identified: ${documentText.slice(0, 100)}...`,
        confidence: 87
      };

      setInsights(prev => [newInsight, ...prev]);
      setIsProcessing(false);

      toast({
        title: "Summary Generated",
        description: "AI has analyzed your document and generated insights.",
      });
    }, 2000);
  };

  const getRecipientSuggestions = () => {
    const suggestions = [];

    if (userRole === "employee") {
      suggestions.push("HOD of your department", "Registrar");
    } else if (userRole.includes("hod")) {
      suggestions.push("Registrar", "Principal");
    }

    return suggestions;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "summary": return <FileText className="w-4 h-4 text-primary" />;
      case "suggestion": return <Lightbulb className="w-4 h-4 text-warning" />;
      case "optimization": return <TrendingUp className="w-4 h-4 text-success" />;
      case "prediction": return <Clock className="w-4 h-4 text-info" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-success";
    if (confidence >= 70) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* AI Document Analyzer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Document Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Document Content</label>
            <Textarea
              placeholder="Paste your document content here for AI analysis..."
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generateSummary}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Summary
                </>
              )}
            </Button>

            <Button variant="outline">
              <Users className="w-4 h-4 mr-2" />
              Suggest Recipients
            </Button>

            <Button variant="outline">
              <MessageSquare className="w-4 h-4 mr-2" />
              Grammar Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={insight.id}>
                  <div className="flex items-start gap-3 p-4 rounded-lg border">
                    <div className="flex-shrink-0 mt-1">
                      {getInsightIcon(insight.type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{insight.title}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {insight.confidence}% confidence
                          </Badge>
                          <Badge
                            variant={
                              insight.type === "summary" ? "default" :
                                insight.type === "suggestion" ? "secondary" :
                                  insight.type === "optimization" ? "outline" : "default"
                            }
                            className="text-xs"
                          >
                            {insight.type}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {insight.content}
                      </p>

                      {insight.action && (
                        <Button variant="outline" size="sm">
                          {insight.action}
                        </Button>
                      )}
                    </div>
                  </div>
                  {index < insights.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Workflow Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium">Avg. Approval Time</span>
              </div>
              <p className="text-2xl font-bold">0 days</p>
              <p className="text-xs text-muted-foreground">Based on similar documents</p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">Success Rate</span>
              </div>
              <p className="text-2xl font-bold">0%</p>
              <p className="text-xs text-muted-foreground">First-time approvals</p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-info" />
                <span className="text-sm font-medium">Peak Hours</span>
              </div>
              <p className="text-2xl font-bold">N/A</p>
              <p className="text-xs text-muted-foreground">Best time to submit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Generate Template
            </Button>

            <Button variant="outline" className="justify-start">
              <Users className="w-4 h-4 mr-2" />
              Optimize Recipients
            </Button>

            <Button variant="outline" className="justify-start">
              <Clock className="w-4 h-4 mr-2" />
              Predict Timeline
            </Button>

            <Button variant="outline" className="justify-start">
              <TrendingUp className="w-4 h-4 mr-2" />
              Process Insights
            </Button>
          </div>
        </CardContent>
      </Card>
    </div >
  );
}