import { useState, useEffect } from 'react';
import { recipientService } from '@/services/RecipientService';

/**
 * Custom hook to resolve an array of recipient IDs to their names.
 * Useful for UI components that handle selected recipient IDs.
 * 
 * @param recipientIds Array of recipient IDs (UUIDs or system slugs)
 * @returns A mapping of recipient IDs to their names (string -> string)
 */
export function useRecipientNames(recipientIds: string[]) {
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const fetchNames = async () => {
      if (!recipientIds || recipientIds.length === 0) {
        if (isMounted) setRecipientNames({});
        return;
      }

      try {
        // Fetch all recipients for efficiency and caching
        const recipients = await recipientService.fetchRecipients();
        
        if (isMounted) {
          const mapping: Record<string, string> = {};
          
          // Populate mapping from fetched recipients
          recipients.forEach(r => {
            mapping[r.id] = r.name;
          });

          // Also try to resolve IDs that might not be in the initial list 
          // (though fetchRecipients should return most)
          await Promise.all(
            recipientIds.map(async (id) => {
              if (!mapping[id]) {
                try {
                  const name = await recipientService.getRecipientName(id);
                  if (isMounted) mapping[id] = name;
                } catch (err) {
                  // Fallback to formatted ID already handled via || operator in UI
                }
              }
            })
          );

          if (isMounted) setRecipientNames({ ...mapping });
        }
      } catch (error) {
        console.warn('[useRecipientNames] Failed to fetch recipient names for mapping:', error);
      }
    };

    fetchNames();

    return () => {
      isMounted = false;
    };
  }, [recipientIds]);

  return recipientNames;
}
