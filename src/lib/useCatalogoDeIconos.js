import { useSyncExternalStore } from 'react';
import { catalogoCargado, suscribeCatalogo } from '@/lib/iconosDeTipo';

/** El catálogo de íconos de los tipos de sesión, o `null` mientras baja (la primera pantalla que lo pide es la que lo hace bajar). */
export const useCatalogoDeIconos = () => useSyncExternalStore(suscribeCatalogo, catalogoCargado, catalogoCargado);
