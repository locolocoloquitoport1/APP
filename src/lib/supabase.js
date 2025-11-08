import { createClient } from "@supabase/supabase-js";

/**
 * Plantilla de inicialización supabase.
 * Crea un archivo .env.local en la raíz con:
 * REACT_APP_SUPABASE_URL=your_url
 * REACT_APP_SUPABASE_ANON_KEY=your_anon_key
 *
 * Nota: por seguridad no subas keys en repos público.
 */

const url = process.env.REACT_APP_SUPABASE_URL || "";
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const supabase = (url && key) ? createClient(url, key) : null;

export default supabase;
