
import { supabase } from './src/lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching chat_messages:', error);
  } else {
    console.log('Successfully fetched 1 message:', data);
    console.log('Columns:', Object.keys(data[0] || {}));
  }
}

checkSchema();
