import React from 'react';
import { CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { ChatPoll, MessageStatus } from '@/types/chat';

/**
 * Returns the appropriate Lucide icon component according to message status.
 * @param status Delivery or read status of message.
 */
export const getMessageStatusIcon = (status: MessageStatus) => {
  switch (status) {
    case 'delivered':
      return <CheckCircle2 className="w-3 h-3 text-blue-500" />;
    case 'read':
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case 'failed':
      return <AlertTriangle className="w-3 h-3 text-red-500" />;
    default:
      return <Lock className="w-3 h-3 text-gray-400" />;
  }
};

/**
 * Common formatter for timestamps like "10:30 AM" or "Feb 23".
 */
export const formatTimestamp = (timestamp: Date | string | number) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

/**
 * Processes poll options into results including unique vote counts and percentages.
 */
export const getPollResults = (poll: ChatPoll | undefined) => {
  if (!poll) return { totalVotes: 0, options: [] as any[], uniqueVotersCount: 0 };

  // Unique voters count
  const uniqueVoters = new Set<string>();
  poll.options.forEach(opt => opt.votes.forEach(v => uniqueVoters.add(v.userId)));
  const totalVotes = uniqueVoters.size;

  // We use the sum of votes for percentage breakdown if it's multiple choice, 
  // or total unique voters for single choice. WhatsApp uses unique users for the denominator.
  const totalRawVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0);

  const optionsWithPercentage = poll.options.map(option => ({
    ...option,
    percentage: totalRawVotes > 0 ? Math.round((option.votes.length / totalRawVotes) * 100) : 0
  }));

  return { totalVotes, options: optionsWithPercentage, uniqueVotersCount: totalVotes };
};
