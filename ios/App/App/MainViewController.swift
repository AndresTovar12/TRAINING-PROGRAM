import UIKit
import Capacitor

/// La pantalla principal de la app: igual que la de Capacitor, pero registra los puentes propios: la pantalla bloqueada (`EntrenoLivePlugin`), el reloj (`EntrenoWatchPlugin`) y el sensor de movimiento (`MovimientoPlugin`).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EntrenoLivePlugin())
        bridge?.registerPluginInstance(EntrenoWatchPlugin())
        bridge?.registerPluginInstance(MovimientoPlugin())
    }
}
