# Registrar: la lista sobre el mapa recibe el dedo (el mapa ya no se mueve en su lugar)

**Modelo:** Opus 5.5, esfuerzo alto. Un commit sobre main. Spec de Andrés (6 nov 2026).

El error (Andrés, build 95): con «¿Qué vas a hacer?» abierta encima del mapa de Apple, al deslizar la lista no se mueve la lista: se mueve el mapa de atrás. La cabecera, la X y jalar desde la asita sí funcionan.

La causa, en el lado nativo del plugin del mapa: `patches/@capgo+capacitor-native-map+8.1.2.patch`, archivo `ios/Sources/NativeMapPlugin/ViewHelpers.swift`, función `shouldPassTouchThroughToMap`. En el iPhone, cada elemento con `overflow: auto` es una vista nativa `WKChildScrollView`. La función tiene esta regla ANTES de consultar los rectángulos que publica la página:

```swift
if let childScrollClass = NSClassFromString("WKChildScrollView"),
   hitView.isKind(of: childScrollClass) {
    return true
}
```

Es decir: si el dedo cae en una lista con scroll, el toque va al mapa sin preguntar. Viene del plugin original (un mapa metido dentro de una página que se desplaza). El parche de Training Lab ya cambió la regla de WKContentView para que decidan los rectángulos de la página («cualquier vista DENTRO del WebView…»), pero esta se quedó. La lista de la hoja es lo primero con scroll que la app pone encima de un mapa `toBack`.

## Qué hacer

1. En el parche, quita ese `if` de `shouldPassTouchThroughToMap` (solo ese; el `WKChildScrollView` que hay más arriba en `hitTest`, el que recorre `subviews.reversed()`, no se toca). Así una lista dentro del WebView cae en la regla de abajo, `hitView.isDescendant(of: webView)`, y decide `plugin.shouldRouteTouchToMap` con los rectángulos de la página: con la hoja abierta, el velo (fondo al 32 %, toda la pantalla) se queda con el dedo; sin hoja, una zona transparente sigue yendo al mapa como hoy. Deja un comentario «Training Lab (parche)» explicando por qué.
2. Regenera el parche con la herramienta, no a mano: edita `node_modules/@capgo/capacitor-native-map/ios/Sources/NativeMapPlugin/ViewHelpers.swift` y corre `npx patch-package @capgo/capacitor-native-map`. Comprueba que `npm ci` (que corre `patch-package` en postinstall) aplica el parche sin avisos.
3. El commit «Registrar: la lista sobre el mapa ya no se traba al hacer scroll» (la pausa del barrido) se queda: sigue haciendo falta para que el scroll sea fluido, y además garantiza que el rectángulo del velo esté publicado cuando se abre la hoja.
4. No toques nada más del plugin ni de la hoja.

## Pruebas

- Swift no se compila en tu máquina: confirma que el parche aplica limpio y deja que el build de TestFlight (Mac de GitHub) compile. Si falla, dime el error completo.
- En el iPhone (lo prueba Andrés en el build): con la hoja abierta sobre el mapa, la lista se desplaza y el mapa no se mueve; cerrar la hoja y el mapa vuelve a moverse con el dedo; los botones redondos del mapa y el menú «Tipo de mapa» siguen respondiendo; «INICIAR» sigue funcionando.
- `npm run check` en verde.

Commit: «Registrar: la lista sobre el mapa recibe el dedo, el mapa ya no se mueve en su lugar».
Dime el hash y el número de build de TestFlight.
