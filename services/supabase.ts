
import { createClient } from '@supabase/supabase-js';
import { AppState } from '../types';

// TODO: Replace with your Supabase project URL and Anon Key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dueshnugbathiacrkujg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZXNobnVnYmF0aGlhY3JrdWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MTA2NzcsImV4cCI6MjA4MDQ4NjY3N30.moN506i-rhfLY2801b-IKLdAZBZdefye5QAo6LqclUI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const saveStateToCloud = async (userId: string, state: AppState) => {
    const { error } = await supabase
        .from('user_data')
        .upsert({
            user_id: userId,
            data: state,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error saving state to cloud:', error);
        throw error;
    }
};

export const loadStateFromCloud = async (userId: string): Promise<AppState | null> => {
    const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // No rows found
            return null;
        }
        console.error('Error loading state from cloud:', error);
        throw error;
    }

    return data?.data as AppState;
};
