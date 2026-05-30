import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';

describe('Supabase Connection Test', () => {
  it('should successfully read data from the supabase database client', async () => {
    console.log('Testing connection to Supabase...');
    
    // We try to query the "items" table (limit 1) to check if we can read the database.
    const { data, error } = await supabase.from('items').select('*').limit(1);
    
    if (error) {
      console.error('Supabase Error:', error);
    } else {
      console.log('Successfully connected! Data sample:', data);
    }
    
    expect(error).toBeNull();
  });
});
