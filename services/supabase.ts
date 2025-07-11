import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL: string = "https://wlgxcmxlfvlkjrloxitw.supabase.co";
const SUPABASE_ANON_KEY: string =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZ3hjbXhsZnZsa2pybG94aXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwODAwMzksImV4cCI6MjA2NzY1NjAzOX0.uwNwWEDCpAu0bgv8J-2DPIUlAAGvGT8X5OC2YhWWDVc";

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
