import { registerPlugin } from '@capacitor/core';

/* El puente a StoreKit (`ios/App/App/CompraApplePlugin.swift`). Solo existe en el iPhone; en la web no se compra con Apple. Se exporta DENTRO de un objeto:
   un plugin de Capacitor que viaja suelto en una promesa la cuelga (ver la memoria «Plugin de Capacitor en una promesa = cuelgue»). */
export const CompraApple = registerPlugin('CompraApple');
