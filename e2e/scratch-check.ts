import { supabaseAdmin } from "./config/supabaseAdmin";
const x = supabaseAdmin.auth.admin;
console.log(Object.keys(x));
