import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DecentralizedChatService } from '@/services/DecentralizedChatService';
import { ChatPoll, PollOption, PollVote } from '@/types/chat';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  ChartBar,
  Plus,
  Vote,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Eye,
  Download
} from 'lucide-react';

interface PollManagerProps {
  chatService: DecentralizedChatService;
  channelId: string;
  userId: string;
  className?: string;
}

export const PollManager: React.FC<PollManagerProps> = ({ 
  chatService, 
  channelId, 
  userId, 
  className 
}) => {
  const { toast } = useToast();
  const [polls, setPolls] = useState<ChatPoll[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollDescription, setNewPollDescription] = useState('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['', '']);
  const [pollType, setPollType] = useState<'single-choice' | 'multiple-choice' | 'yes-no' | 'likert-scale'>('single-choice');
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [deadline, setDeadline] = useState<string>('');

  useEffect(() => {
    loadPolls();
  }, [channelId]);

  const loadPolls = async () => {
    // Polls will be loaded from Supabase
    setPolls([]);
  };

  const handleCreatePoll = async () => {
    if (!newPollTitle.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Poll title is required',
        variant: 'destructive'
      });
      return;
    }

    const validOptions = newPollOptions.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'At least 2 options are required',
        variant: 'destructive'
      });
      return;
    }

    const poll: Partial<ChatPoll> = {
      channelId,
      createdBy: userId,
      title: newPollTitle,
      description: newPollDescription,
      type: pollType,
      options: validOptions.map((option, index) => ({
        id: `option-${index}`,
        text: option,
        votes: []
      })),
      allowAnonymous,
      deadline: deadline ? new Date(deadline) : undefined,
      status: 'active'
    };

    try {
      const createdPoll = await chatService.createPoll(poll);
      setPolls(prev => [createdPoll, ...prev]);
      
      // Reset form
      setNewPollTitle('');
      setNewPollDescription('');
      setNewPollOptions(['', '']);
      setDeadline('');
      setIsCreating(false);
      
      toast({
        title: 'Poll Created',
        description: 'Your poll has been created successfully',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create poll',
        variant: 'destructive'
      });
    }
  };

  const handleVote = async (pollId: string, optionIds: string[]) => {
    try {
      await chatService.votePoll(pollId, optionIds, userId);
      
      // Update local state
      setPolls(prev => prev.map(poll => {
        if (poll.id === pollId) {
          const updatedOptions = poll.options.map(option => {
            if (optionIds.includes(option.id)) {
              return {
                ...option,
                votes: [...option.votes, {
                  userId,
                  optionId: option.id,
                  timestamp: new Date()
                }]
              };
            }
            return option;
          });
          
          return {
            ...poll,
            options: updatedOptions,
            results: {
              ...poll.results,
              totalVotes: poll.results.totalVotes + 1
            }
          };
        }
        return poll;
      }));
      
      toast({
        title: 'Vote Recorded',
        description: 'Your vote has been recorded',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to record vote',
        variant: 'destructive'
      });
    }
  };

  const addOption = () => {
    setNewPollOptions(prev => [...prev, '']);
  };

  const updateOption = (index: number, value: string) => {
    setNewPollOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  };

  const removeOption = (index: number) => {
    if (newPollOptions.length > 2) {
      setNewPollOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const hasUserVoted = (poll: ChatPoll): boolean => {
    return poll.options.some(option => 
      option.votes.some(vote => vote.userId === userId)
    );
  };

  const getUserVoteOptions = (poll: ChatPoll): string[] => {
    return poll.options
      .filter(option => option.votes.some(vote => vote.userId === userId))
      .map(option => option.id);
  };

  const calculatePercentage = (votes: number, total: number): number => {
    return total === 0 ? 0 : Math.round((votes / total) * 100);
  };

  const PollCard: React.FC<{ poll: ChatPoll }> = ({ poll }) => {
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const userHasVoted = hasUserVoted(poll);
    const userVotes = getUserVoteOptions(poll);
    const isExpired = poll.deadline && new Date() > poll.deadline;
    const isClosed = poll.status === 'closed' || isExpired;

    useEffect(() => {
      if (userHasVoted) {
        setSelectedOptions(userVotes);
      }
    }, [poll]);

    const handleOptionToggle = (optionId: string) => {
      if (userHasVoted || isClosed) return;

      if (poll.type === 'single-choice' || poll.type === 'yes-no') {
        setSelectedOptions([optionId]);
      } else {
        setSelectedOptions(prev => 
          prev.includes(optionId)
            ? prev.filter(id => id !== optionId)
            : [...prev, optionId]
        );
      }
    };

    const submitVote = () => {
      if (selectedOptions.length > 0) {
        handleVote(poll.id, selectedOptions);
      }
    };

    return (
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{poll.title}</CardTitle>
              {poll.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {poll.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isClosed ? 'secondary' : 'default'}>
                {isClosed ? 'Closed' : 'Active'}
              </Badge>
              <Badge variant="outline">
                {poll.type.replace('-', ' ')}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {poll.results.totalVotes} votes
            </div>
            {poll.deadline && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isExpired ? 'Expired' : `Ends ${poll.deadline.toLocaleDateString()}`}
              </div>
            )}
            {userHasVoted && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                You voted
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {poll.options.map(option => {
              const voteCount = option.votes.length;
              const percentage = calculatePercentage(voteCount, poll.results.totalVotes);
              const isSelected = selectedOptions.includes(option.id);
              const userVotedThis = userVotes.includes(option.id);

              return (
                <div
                  key={option.id}
                  className={cn(
                    "relative p-3 border rounded-lg cursor-pointer transition-colors",
                    isSelected && "border-primary bg-primary/5",
                    userVotedThis && "border-green-500 bg-green-50 dark:bg-green-900/20",
                    (userHasVoted || isClosed) && "cursor-default"
                  )}
                  onClick={() => handleOptionToggle(option.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{option.text}</span>
                    <span className="text-sm text-muted-foreground">
                      {voteCount} ({percentage}%)
                    </span>
                  </div>
                  
                  {(userHasVoted || isClosed) && (
                    <Progress value={percentage} className="h-2" />
                  )}
                  
                  {userVotedThis && (
                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-green-600" />
                  )}
                </div>
              );
            })}
          </div>
          
          {!userHasVoted && !isClosed && selectedOptions.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button onClick={submitVote}>
                <Vote className="w-4 h-4 mr-2" />
                Submit Vote
              </Button>
            </div>
          )}
          
          {(userHasVoted || isClosed) && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Total votes: {poll.results.totalVotes}</span>
                {poll.allowAnonymous && (
                  <Badge variant="outline">Anonymous voting</Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  View Results
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Polls & Voting</h3>
        <Button onClick={() => setIsCreating(true)}>
          <ChartBar className="w-4 h-4 mr-2" />
          Create Poll
        </Button>
      </div>

      {/* Create Poll Dialog */}
      <AlertDialog open={isCreating} onOpenChange={setIsCreating}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Poll</AlertDialogTitle>
            <AlertDialogDescription>
              Create a poll to gather opinions and make decisions collaboratively.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Poll Title</label>
              <Input
                value={newPollTitle}
                onChange={(e) => setNewPollTitle(e.target.value)}
                placeholder="What would you like to ask?"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                value={newPollDescription}
                onChange={(e) => setNewPollDescription(e.target.value)}
                placeholder="Provide additional context..."
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Poll Type</label>
              <select
                value={pollType}
                onChange={(e) => setPollType(e.target.value as any)}
                className="mt-1 w-full p-2 border rounded-md"
                aria-label="Poll type selection"
              >
                <option value="single-choice">Single Choice</option>
                <option value="multiple-choice">Multiple Choice</option>
                <option value="yes-no">Yes/No</option>
                <option value="likert-scale">Likert Scale</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Options</label>
              <div className="mt-1 space-y-2">
                {newPollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    {newPollOptions.length > 2 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeOption(index)}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addOption}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Deadline (Optional)</label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={allowAnonymous}
                  onChange={(e) => setAllowAnonymous(e.target.checked)}
                />
                <label htmlFor="anonymous" className="text-sm font-medium">
                  Allow anonymous voting
                </label>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreatePoll}>
              Create Poll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ChartBar className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Polls Yet</h3>
              <p className="text-muted-foreground text-center">
                Create the first poll to start gathering opinions and making decisions together.
              </p>
            </CardContent>
          </Card>
        ) : (
          polls.map(poll => (
            <PollCard key={poll.id} poll={poll} />
          ))
        )}
      </div>
    </div>
  );
};
