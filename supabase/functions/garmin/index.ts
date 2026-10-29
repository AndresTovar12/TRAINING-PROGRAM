import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { manejar } from './servidor.ts'

// Todo vive en servidor.ts (ver ahí). Se despliega sin verificar JWT: Garmin no manda uno; la función revisa la sesión ella misma.
Deno.serve(manejar)
