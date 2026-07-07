import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { recipientService } from '@/services/RecipientService';

interface Recipient {
  id: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
  selected: boolean;
}

interface RealTimeRecipientManagerProps {
  documentId?: string;
  initialRecipients?: string[];
  initialRecipientIds?: string[];
  onRecipientsChange?: (recipients: string[], recipientIds: string[]) => void;
  mode?: 'create' | 'edit';
}

export const RealTimeRecipientManager: React.FC<RealTimeRecipientManagerProps> = ({
  documentId,
  initialRecipients = [],
  initialRecipientIds = [],
  onRecipientsChange,
  mode = 'create'
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Update recipients directly via Supabase
  const updateRecipients = async (docId: string, recipients: string[], recipientIds: string[]) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ recipients: recipientIds })
        .eq('id', docId);
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const [availableRecipients, setAvailableRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Load available recipients from Supabase role_recipients table
  useEffect(() => {
    let mounted = true;

    const loadRecipients = async () => {
      try {
        const dbRecipients = await recipientService.fetchRecipients();
        if (!mounted) return;

        const mappedRecipients: Recipient[] = dbRecipients.map(r => ({
          id: r.id,           // role_recipients.id UUID
          name: r.name,
          role: r.role.toLowerCase(),
          department: r.department ?? '',
          email: r.email,
          selected: initialRecipientIds.includes(r.id) || initialRecipients.includes(r.name)
        }));

        setAvailableRecipients(mappedRecipients);
        setSelectedRecipients(mappedRecipients.filter(r => r.selected));
      } catch (error) {
        console.error('[RealTimeRecipientManager] Failed to load recipients:', error);
      }
    };

    loadRecipients();
    return () => { mounted = false; };
  }, [initialRecipients, initialRecipientIds]);

  const filteredRecipients = availableRecipients.filter(recipient => {
    const matchesSearch = recipient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipient.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipient.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || recipient.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const handleRecipientToggle = (recipient: Recipient) => {
    const updatedRecipients = availableRecipients.map(r => 
      r.id === recipient.id ? { ...r, selected: !r.selected } : r
    );
    
    setAvailableRecipients(updatedRecipients);
    
    const newSelectedRecipients = updatedRecipients.filter(r => r.selected);
    setSelectedRecipients(newSelectedRecipients);
    
    if (onRecipientsChange) {
      const recipients = newSelectedRecipients.map(r => r.name);
      const recipientIds = newSelectedRecipients.map(r => r.id);
      onRecipientsChange(recipients, recipientIds);
    }
  };

  const handleUpdateRecipients = async () => {
    if (!documentId) return;
    
    try {
      const recipients = selectedRecipients.map(r => r.name);
      const recipientIds = selectedRecipients.map(r => r.id);
      
      await updateRecipients(documentId, recipients, recipientIds);
      
      // Show success notification
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Recipients Updated',
          description: 'Document recipients have been updated in real-time',
          type: 'success'
        }
      }));
      
    } catch (error) {
      console.error('Failed to update recipients:', error);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          title: 'Update Failed',
          description: 'Failed to update recipients. Please try again.',
          type: 'error'
        }
      }));
    }
  };

  const uniqueRoles = [...new Set(availableRecipients.map(r => r.role))];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Real-Time Recipient Management
          {selectedRecipients.length > 0 && (
            <Badge variant="secondary">{selectedRecipients.length} selected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search Recipients</Label>
            <Input
              id="search"
              placeholder="Search by name, role, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Label htmlFor="role-filter">Filter by Role</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedRecipients.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Recipients ({selectedRecipients.length})</Label>
            <div className="flex flex-wrap gap-2">
              {selectedRecipients.map(recipient => (
                <Badge key={recipient.id} variant="default" className="flex items-center gap-1">
                  {recipient.name}
                  <button
                    onClick={() => handleRecipientToggle(recipient)}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Available Recipients</Label>
          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
            {filteredRecipients.map(recipient => (
              <div
                key={recipient.id}
                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => handleRecipientToggle(recipient)}
              >
                <Checkbox
                  checked={recipient.selected}
                  onChange={() => handleRecipientToggle(recipient)}
                />
                <div className="flex-1">
                  <div className="font-medium">{recipient.name}</div>
                  <div className="text-sm text-gray-500">
                    {recipient.role} • {recipient.department}
                  </div>
                </div>
                <Badge variant="outline">{recipient.role}</Badge>
              </div>
            ))}
            
            {filteredRecipients.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No recipients found matching your criteria
              </div>
            )}
          </div>
        </div>

        {mode === 'edit' && documentId && (
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleUpdateRecipients}
              disabled={loading || selectedRecipients.length === 0}
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Update Recipients
            </Button>
          </div>
        )}

        <div className="text-xs text-gray-500 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Real-time updates enabled
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeRecipientManager;