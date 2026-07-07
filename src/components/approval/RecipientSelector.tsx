import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";
import { recipientService } from '@/services/RecipientService';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  UserCheck,
  Building,
  Crown,
  X,
  Check,
  Minus,
  ArrowRight,
  Plus,
  Shuffle
} from "lucide-react";

interface Recipient {
  id: string;
  name: string;
  role: string;
  department?: string;
  branch?: string;
  year?: string;
  email: string;
}

interface RecipientGroup {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  recipients: Recipient[];
  expanded?: boolean;
}

interface RecipientSelectorProps {
  userRole: 'Principal' | 'Registrar' | 'HOD' | 'Program Head' | 'Employee' | string;
  selectedRecipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  maxSelections?: number;
  isEmergency?: boolean;
  isBypass?: boolean;
}

const HIERARCHY_ORDER = {
  'Faculty': 1,
  'Employee': 2,
  'CDC Head': 3,
  'CDC Coordinator': 3,
  'CDC Executive': 3,
  'Program Department Head': 4,
  'Program Head': 4,
  'HOD': 5,
  'Registrar': 6,
  'Principal': 7,
  'Controller of Examinations': 5,
  'Asst. Dean IIIC': 5,
  'Head Operations': 5,
  'Librarian': 5,
  'SSG': 5,
  'Dean': 6,
  'Chairman': 7,
  'Director (For Information)': 7,
  'Leadership': 7
};

const sortRecipientsByHierarchy = (recipientIds: string[], allRecipients: Recipient[]): string[] => {
  const recipientsData = recipientIds.map(id => allRecipients.find(r => r.id === id)).filter(Boolean) as Recipient[];

  return recipientsData
    .sort((a, b) => {
      const orderA = HIERARCHY_ORDER[a.role as keyof typeof HIERARCHY_ORDER] || 999;
      const orderB = HIERARCHY_ORDER[b.role as keyof typeof HIERARCHY_ORDER] || 999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.name.localeCompare(b.name);
    })
    .map(r => r.id);
};

const groupRecipients = (recipients: Recipient[]): RecipientGroup[] => {
  const groups: { [key: string]: { title: string; icon: any; recipients: Recipient[] } } = {};

  recipients.forEach(recipient => {
    const role = recipient.role;
    let groupKey = role.toLowerCase().replace(/\s+/g, '-');
    let groupTitle = role;
    let groupIcon = Users;

    if (role === 'Principal' || role === 'Registrar' || role === 'Dean' || role === 'Chairman') {
      groupKey = 'leadership';
      groupTitle = 'Leadership';
      groupIcon = Crown;
    } else if (role === 'HOD') {
      groupKey = 'hods';
      groupTitle = 'HODs';
      groupIcon = Building;
    } else if (role === 'Program Department Head') {
      groupKey = 'program-heads';
      groupTitle = 'Program Department Heads';
      groupIcon = UserCheck;
    } else if (role.includes('CDC')) {
      groupKey = 'cdc';
      groupTitle = 'CDC Department';
      groupIcon = Users;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = { title: groupTitle, icon: groupIcon, recipients: [] };
    }
    groups[groupKey].recipients.push(recipient);
  });

  return Object.entries(groups).map(([id, group]) => ({
    id,
    title: group.title,
    icon: group.icon,
    recipients: group.recipients
  }));
};

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({
  userRole,
  selectedRecipients,
  onRecipientsChange,
  maxSelections,
  isEmergency = false,
  isBypass = false
}) => {
  const { isMobile } = useResponsive();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'hods': false,
    'program-heads': false
  });
  const [useHierarchicalOrder, setUseHierarchicalOrder] = useState(true);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>(() => {
    try {
      const cached = localStorage.getItem('recipients-cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newSelection = [...selectedRecipients];
    const itemToMove = newSelection[draggedIndex];
    newSelection.splice(draggedIndex, 1);
    newSelection.splice(targetIndex, 0, itemToMove);

    onRecipientsChange(newSelection);
    setDraggedIndex(null);
  };


  useEffect(() => {
    const loadRecipients = async () => {
      // Only show loading if we have NO data yet (initial cold load)
      if (allRecipients.length === 0 && isInitialLoad.current) {
        setLoading(true);
      }
      isInitialLoad.current = false;
      setError(null);

      try {
        const realRecipients = await recipientService.fetchRecipients();

        if (realRecipients.length > 0) {
          const mapped = realRecipients.map(r => ({
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            department: r.department,
            branch: r.branch
          }));
          setAllRecipients(mapped);
          
          // Persist to cache
          localStorage.setItem('recipients-cache', JSON.stringify(mapped));
        } else {
          setAllRecipients([]);
        }
      } catch (error) {
        console.error('[RecipientSelector] Failed to fetch recipients:', error);
        setError('Failed to load recipients from database. Please check your connection.');
        
        // If fetch fails but we have cached data, we just keep the cached data
      }

      setLoading(false);
    };

    loadRecipients();
  }, [userRole]);

  const recipientGroups = useMemo(() => groupRecipients(allRecipients), [allRecipients]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return recipientGroups;

    return recipientGroups.map(group => ({
      ...group,
      recipients: group.recipients.filter(recipient =>
        recipient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipient.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipient.branch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipient.department?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(group => group.recipients.length > 0);
  }, [recipientGroups, searchTerm]);

  const selectedRecipientsData = useMemo(() => {
    const allRecipients = recipientGroups.flatMap(group => group.recipients);
    return selectedRecipients.map(id => allRecipients.find(r => r.id === id)).filter(Boolean) as Recipient[];
  }, [recipientGroups, selectedRecipients]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const toggleRecipient = (recipientId: string) => {
    const isSelected = selectedRecipients.includes(recipientId);
    const allRecipients = recipientGroups.flatMap(group => group.recipients);

    if (isSelected) {
      const newSelection = selectedRecipients.filter(id => id !== recipientId);
      const finalSelection = useHierarchicalOrder ? sortRecipientsByHierarchy(newSelection, allRecipients) : newSelection;
      onRecipientsChange(finalSelection);
    } else {
      if (maxSelections && selectedRecipients.length >= maxSelections) {
        return;
      }
      const newSelection = [...selectedRecipients, recipientId];
      // Automatically force hierarchical sort on addition
      if (!useHierarchicalOrder) {
        setUseHierarchicalOrder(true);
      }
      const finalSelection = sortRecipientsByHierarchy(newSelection, allRecipients);
      onRecipientsChange(finalSelection);
    }
  };

  const removeRecipient = (recipientId: string) => {
    const newSelection = selectedRecipients.filter(id => id !== recipientId);
    const allRecipients = recipientGroups.flatMap(group => group.recipients);
    const finalSelection = useHierarchicalOrder ? sortRecipientsByHierarchy(newSelection, allRecipients) : newSelection;
    onRecipientsChange(finalSelection);
  };

  const selectAllInGroup = (group: RecipientGroup) => {
    const groupRecipientIds = group.recipients.map(r => r.id);
    const newSelections = [...new Set([...selectedRecipients, ...groupRecipientIds])];
    const allRecipients = recipientGroups.flatMap(group => group.recipients);

    if (maxSelections && newSelections.length > maxSelections) {
      const remaining = maxSelections - selectedRecipients.length;
      const toAdd = groupRecipientIds.slice(0, remaining);
      const finalSelection = [...selectedRecipients, ...toAdd];
      const sortedSelection = sortRecipientsByHierarchy(finalSelection, allRecipients);
      setUseHierarchicalOrder(true);
      onRecipientsChange(sortedSelection);
    } else {
      const sortedSelection = sortRecipientsByHierarchy(newSelections, allRecipients);
      setUseHierarchicalOrder(true);
      onRecipientsChange(sortedSelection);
    }
  };

  const deselectAllInGroup = (group: RecipientGroup) => {
    const groupRecipientIds = group.recipients.map(r => r.id);
    const newSelection = selectedRecipients.filter(id => !groupRecipientIds.includes(id));
    const allRecipients = recipientGroups.flatMap(group => group.recipients);
    const finalSelection = useHierarchicalOrder ? sortRecipientsByHierarchy(newSelection, allRecipients) : newSelection;
    onRecipientsChange(finalSelection);
  };

  const getGroupSelectionState = (group: RecipientGroup) => {
    const groupRecipientIds = group.recipients.map(r => r.id);
    const selectedInGroup = groupRecipientIds.filter(id => selectedRecipients.includes(id));

    if (selectedInGroup.length === 0) return 'none';
    if (selectedInGroup.length === groupRecipientIds.length) return 'all';
    return 'partial';
  };

  const clearAllSelections = () => {
    onRecipientsChange([]);
  };

  const toggleOrderMode = () => {
    const allRecipients = recipientGroups.flatMap(group => group.recipients);
    if (!useHierarchicalOrder) {
      const sortedSelection = sortRecipientsByHierarchy(selectedRecipients, allRecipients);
      onRecipientsChange(sortedSelection);
    }
    setUseHierarchicalOrder(!useHierarchicalOrder);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Users className="h-5 w-5 shrink-0" />
          <span className="truncate">Select Recipients</span>
          {maxSelections && (
            <Badge variant="outline" className="shrink-0">
              {selectedRecipients.length}/{maxSelections}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipients by name, role, branch, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "pl-10 text-base sm:text-sm",
              isEmergency 
                ? "focus-visible:ring-red-500 focus:border-red-500" 
                : isBypass 
                  ? "focus-visible:ring-blue-600 focus:border-blue-600" 
                  : ""
            )}
          />
        </div>

        {selectedRecipients.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium leading-tight">
                Selected Recipients ({selectedRecipients.length}) - {useHierarchicalOrder ? 'Hierarchical' : 'Random'} Order
              </Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleOrderMode} className="flex-1 text-xs">
                  <Shuffle className="h-3.5 w-3.5 mr-1.5" />
                  {useHierarchicalOrder ? 'Random' : 'Hierarchical'}
                </Button>
                <Button variant="outline" size="sm" onClick={clearAllSelections} className="flex-1 text-xs">
                  <X className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                  Clear All
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-32">
              <div className="flex flex-wrap gap-2 p-1">
                {selectedRecipientsData.map((recipient, index) => {
                  const hierarchyLevel = HIERARCHY_ORDER[recipient.role as keyof typeof HIERARCHY_ORDER] || 999;
                  const levelColors = {
                    1: 'bg-purple-100 text-purple-800 border-purple-200',
                    2: 'bg-green-100 text-green-800 border-green-200',
                    3: 'bg-blue-100 text-blue-800 border-blue-200',
                    4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    5: 'bg-orange-100 text-orange-800 border-orange-200',
                    6: 'bg-red-100 text-red-800 border-red-200',
                    7: 'bg-gray-100 text-gray-800 border-gray-200'
                  };
                  const colorClass = levelColors[hierarchyLevel as keyof typeof levelColors] || 'bg-gray-100 text-gray-800 border-gray-200';

                  return (
                    <div 
                      key={recipient.id} 
                      className={cn(
                        "flex items-center gap-1 transition-all duration-200 rounded-lg",
                        draggedIndex === index ? "opacity-20 scale-95 cursor-grabbing" : "cursor-grab active:cursor-grabbing",
                        dragOverIndex === index && "bg-accent/50 ring-1 ring-muted-foreground/20 shadow-sm scale-105"
                      )}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                    >
                      <span className="text-[10px] text-muted-foreground font-mono">{index + 1}.</span>
                      <Badge variant="secondary" className={cn(
                        "flex items-center gap-1 pr-1 transition-all",
                        // Mobile: slightly taller fixed height, rounded corners, specific padding
                        "h-7 px-2 py-0 text-xs rounded-lg",
                        // Desktop: revert to original pill shape and sizing
                        "sm:h-auto sm:py-0.5 sm:px-2.5 sm:rounded-full",
                        // Width constraints
                        "max-w-[150px] xs:max-w-[200px] sm:max-w-xs",
                        colorClass
                      )}>
                        <span className="text-xs truncate">
                          {recipient.name}
                          {recipient.branch && ` (${recipient.branch})`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive/20 ml-1 shrink-0"
                          onClick={() => removeRecipient(recipient.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
              {useHierarchicalOrder
                ? 'Recipients are Automatically Arranged in Hierarchical Order'
                : 'Recipients are in Random Selection Order'}
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">Approval Flow Hierarchy</Label>
          <div className="flex flex-wrap items-center gap-2 text-xs xs:text-sm text-muted-foreground bg-muted/30 p-2 sm:p-3 rounded-lg underline-offset-4">
            <span className={cn("font-semibold", isEmergency ? "text-red-600 font-bold" : isBypass ? "text-blue-600 font-bold" : "text-primary/80")}>Employee</span>
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className={cn("font-semibold", isEmergency ? "text-red-600 font-bold" : isBypass ? "text-blue-600 font-bold" : "text-primary/80")}>Program Head</span>
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className={cn("font-semibold", isEmergency ? "text-red-600 font-bold" : isBypass ? "text-blue-600 font-bold" : "text-primary/80")}>HOD</span>
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className={cn("font-semibold", isEmergency ? "text-red-600 font-bold" : isBypass ? "text-blue-600 font-bold" : "text-primary/80")}>Registrar</span>
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className={cn("font-semibold", isEmergency ? "text-red-600 font-bold" : isBypass ? "text-blue-600 font-bold" : "text-primary/80")}>Principal</span>
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-96">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="font-medium">Loading recipients...</p>
              <p className="text-xs mt-1">Fetching data from database</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Failed to Load Recipients</p>
              <p className="text-sm mt-2">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : allRecipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-lg">No Recipients Available</p>
              <p className="text-sm mt-2 max-w-md mx-auto">
                No Users Have Been Configured In The System Yet.
              </p>
              <p className="text-sm mt-4 max-w-md mx-auto">
                Please Contact Your System Administrator To Add Users.
              </p>
            </div>
          ) : filteredGroups.length === 0 && !searchTerm ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No Recipients Available</p>
              <p className="text-sm mt-2">No recipients match the current criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const IconComponent = group.icon;
                const selectionState = getGroupSelectionState(group);

                return (
                  <div key={group.id} className="border rounded-lg">
                    <Collapsible
                      open={expandedGroups[group.id]}
                      onOpenChange={() => toggleGroup(group.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <IconComponent className="h-5 w-5" />
                            <div>
                              <h4 className="font-semibold">{group.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {group.recipients.length} recipient(s)
                                {selectionState !== 'none' && (
                                  <span className="ml-1 sm:ml-2 text-sm whitespace-nowrap">
                                    • {selectedRecipients.filter(id => group.recipients.some(r => r.id === id)).length} selected
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="flex gap-1 shrink-0">
                              {selectionState !== 'all' && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectAllInGroup(group);
                                  }}
                                  disabled={maxSelections && selectedRecipients.length >= maxSelections}
                                  title="Select all"
                                >
                                  <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              )}
                              {selectionState !== 'none' && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deselectAllInGroup(group);
                                  }}
                                  title="Deselect all"
                                >
                                  <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              )}
                            </div>
                            {expandedGroups[group.id] ? (
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-2">
                          {group.recipients.map((recipient) => (
                            <div
                              key={recipient.id}
                              className={cn(
                                "flex items-center space-x-3 p-2 hover:bg-muted/30 rounded transition-colors cursor-pointer",
                                isMobile && "p-4 space-x-4 min-h-[56px]"
                              )}
                              onClick={() => isMobile && toggleRecipient(recipient.id)}
                            >
                              {isMobile ? (
                                <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-primary shrink-0">
                                  {selectedRecipients.includes(recipient.id) && (
                                    <div className="w-3 h-3 rounded-full bg-primary" />
                                  )}
                                </div>
                              ) : (
                                <Checkbox
                                  id={recipient.id}
                                  checked={selectedRecipients.includes(recipient.id)}
                                  onCheckedChange={() => toggleRecipient(recipient.id)}
                                  disabled={
                                    maxSelections &&
                                    selectedRecipients.length >= maxSelections &&
                                    !selectedRecipients.includes(recipient.id)
                                  }
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <Label
                                  htmlFor={recipient.id}
                                  className="flex flex-col gap-1 cursor-pointer"
                                >
                                  <span className={cn(
                                    "font-medium",
                                    isMobile && "text-base"
                                  )}>{recipient.name}</span>
                                  <div className={cn(
                                    "flex items-center gap-2 text-xs text-muted-foreground flex-wrap",
                                    isMobile && "text-sm"
                                  )}>
                                    <span>{recipient.role}</span>
                                    {recipient.department && (
                                      <>
                                        <span>•</span>
                                        <span>{recipient.department}</span>
                                      </>
                                    )}
                                    {recipient.branch && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-xs px-1 py-0">
                                          {recipient.branch}
                                        </Badge>
                                      </>
                                    )}
                                    {recipient.year && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-xs px-1 py-0">
                                          {recipient.year}
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{recipient.email}</span>
                                </Label>
                              </div>
                            </div>
                          ))}

                          {group.recipients.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No recipients found matching your search.
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {maxSelections && selectedRecipients.length >= maxSelections && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              Maximum selection limit reached ({maxSelections} recipients).
            </p>
          </div>
        )}

        {filteredGroups.length === 0 && searchTerm && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recipients found matching "{searchTerm}"</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};