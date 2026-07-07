import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSupabaseUniversalSearch } from '@/hooks/useSupabaseUniversalSearch';
import {
  Search,
  FileText,
  Clock,
  Users,
  Calendar,
  CheckCircle,
  StickyNote,
  ArrowRight,
  History,
  X
} from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'approval' | 'meeting' | 'livemeet' | 'reminder' | 'note' | 'calendar';
  section: string;
  path: string;
  metadata?: any;
}

interface UniversalSearchDropdownProps {
  className?: string;
  placeholder?: string;
  onExpandChange?: (isExpanded: boolean) => void;
}

export const UniversalSearchDropdown: React.FC<UniversalSearchDropdownProps> = ({
  className,
  placeholder = "Search...",
  onExpandChange
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { search, isLoading } = useSupabaseUniversalSearch();

  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  // Perform search using Supabase
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const searchResults = await search(searchQuery);
    setResults(searchResults);
  };

  const getIconForType = (type: string) => {
    const icons = {
      document: FileText,
      approval: CheckCircle,
      meeting: Users,
      livemeet: Users,
      reminder: Clock,
      note: StickyNote,
      calendar: Calendar,
    };
    return icons[type as keyof typeof icons] || FileText;
  };

  // Load recent searches from cache
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent-searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load recent searches:', e);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (isExpanded && !query.trim()) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, query]);

  // Debounced search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setIsOpen(searchQuery.trim() !== '' || recentSearches.length > 0);
  };

  const handleResultClick = (result: SearchResult) => {
    // Save to recent searches (cache only)
    try {
      const newRecentSearches = [result.title, ...recentSearches.filter(s => s !== result.title)].slice(0, 5);
      setRecentSearches(newRecentSearches);
      localStorage.setItem('recent-searches', JSON.stringify(newRecentSearches));
    } catch (e) {
      console.warn('Failed to save recent search:', e);
    }

    // Navigate to the target path
    navigate(result.path);
    
    // Per USER REQUEST: Do NOT close the search bar automatically
    // setIsOpen(false); // REMOVED: Keep dropdown results open
    // setQuery('');     // REMOVED: Keep search query visible

    // Robust Scroll to Card with Retries
    if (result.path.includes('#')) {
      const cardId = result.path.split('#')[1];
      let attempts = 0;
      const findAndScroll = () => {
        const element = document.getElementById(cardId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50', 'transition-all', 'duration-500');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
          }, 4000);
          return true;
        }
        return false;
      };

      const scrollInterval = setInterval(() => {
        attempts++;
        if (findAndScroll() || attempts > 20) {
          clearInterval(scrollInterval);
        }
      }, 150);
    }
  };

  const handleRecentClick = (recent: string) => {
    setQuery(recent);
    setIsOpen(true);
  };

  const handleMoreResultsClick = (section: string) => {
    const sectionPaths = {
      'Track Documents': '/track-documents',
      'Pending Approvals': '/approvals',
      'Approval History': '/approvals',
      'LiveMeet+': '/messages?tab=livemeet',
      'Upcoming Reminders': '/messages?tab=notes',
      'Sticky Notes': '/messages?tab=notes',
      'Department Chat': '/messages?tab=chat',
      'Upcoming Meetings': '/calendar',
      'Calendar Events': '/calendar'
    };
    const path = sectionPaths[section as keyof typeof sectionPaths] || '/dashboard';
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  const removeRecentSearch = (searchToRemove: string) => {
    try {
      const newRecentSearches = recentSearches.filter(s => s !== searchToRemove);
      setRecentSearches(newRecentSearches);
      localStorage.setItem('recent-searches', JSON.stringify(newRecentSearches));
    } catch (e) {
      console.warn('Failed to remove recent search:', e);
    }
  };

  const clearSearch = () => {
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleResultClick(results[0]);
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      document: 'bg-blue-100 text-blue-800',
      approval: 'bg-green-100 text-green-800',
      meeting: 'bg-purple-100 text-purple-800',
      livemeet: 'bg-violet-100 text-violet-800',
      reminder: 'bg-orange-100 text-orange-800',
      note: 'bg-yellow-100 text-yellow-800',
      channel: 'bg-indigo-100 text-indigo-800',
      calendar: 'bg-red-100 text-red-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.section]) {
      acc[result.section] = [];
    }
    acc[result.section].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div ref={searchRef} className={cn("relative flex items-center justify-end", className)}>
      <div className={cn("transition-all duration-500 ease-in-out origin-right relative", isExpanded ? "w-[calc(100vw-150px)] sm:w-80 mr-0 sm:mr-2" : "w-0 overflow-hidden")}>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(query.trim() !== '' || recentSearches.length > 0)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!query.trim()) {
              setTimeout(() => setIsExpanded(false), 200);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 transition-all duration-500 ease-in-out h-8 sm:h-9 text-xs sm:text-sm"
          autoFocus={isExpanded}
        />
        <button
          onClick={query ? clearSearch : () => {
            setIsExpanded(false);
            setIsOpen(false);
            setQuery('');
          }}
          className="absolute right-0 sm:right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          title={query ? "Clear search" : "Close search"}
        >
          <X className={cn("transition-transform duration-200", query ? "w-4 h-4" : "w-5 h-5")} />
        </button>

        {isOpen && (query.trim() !== '' || recentSearches.length > 0) && (
          <Card className="absolute top-full left-0 w-full mt-2 bg-white shadow-xl border rounded-lg z-[60] max-h-[80vh] overflow-hidden">
            <ScrollArea className="max-h-96">
              <div className="p-4 max-h-96 overflow-y-auto">
                {query.trim() === '' && recentSearches.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Recent Searches</span>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((recent, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer group"
                        >
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm flex-1" onClick={() => handleRecentClick(recent)}>{recent}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(recent);
                            }}
                            className="w-4 h-4 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {query.trim() !== '' && isLoading && (
                  <div className="text-center py-4 text-muted-foreground">
                    <div className="w-6 h-6 mx-auto mb-2 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-sm">Searching...</p>
                  </div>
                )}

                {query.trim() !== '' && !isLoading && results.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No results found for "{query}"</p>
                  </div>
                )}

                {Object.entries(groupedResults).slice(0, 6).map(([section, sectionResults]) => (
                  <div key={section} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">{section}</span>
                      <Badge variant="outline" className="text-xs">
                        {sectionResults.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {sectionResults.slice(0, 3).map((result) => {
                        const IconComponent = getIconForType(result.type);
                        return (
                          <div
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="flex items-center gap-3 p-3 hover:bg-muted rounded-md cursor-pointer group transition-colors"
                          >
                            <div className="flex-shrink-0">
                              <IconComponent className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium truncate">{result.title}</span>
                                <Badge className={cn("text-xs", getTypeColor(result.type))}>
                                  {result.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        );
                      })}
                      {sectionResults.length > 3 && (
                        <div
                          onClick={() => handleMoreResultsClick(section)}
                          className="text-xs text-muted-foreground text-center py-2 cursor-pointer hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                          +{sectionResults.length - 3} More Results
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
      {!isExpanded && (
        <div
          className="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors text-black flex-shrink-0"
          onClick={() => setIsExpanded(true)}
        >
          <Search className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="text-sm hidden xs:inline">Search</span>
        </div>
      )}


    </div>
  );
};