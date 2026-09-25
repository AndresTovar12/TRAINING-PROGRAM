import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { manejar } from './servidor.ts'

// Todo vive en servidor.ts, para poder probarlo llamándolo directo, sin
// levantar un servidor. Aquí solo se conecta a la red.
Deno.serve(manejar)
