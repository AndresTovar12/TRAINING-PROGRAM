import UIKit
import Capacitor

/// La pantalla principal de la app: igual que la de Capacitor, pero registra el puente propio de la pantalla bloqueada (`EntrenoLivePlugin`).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EntrenoLivePlugin())
        bridge?.registerPluginInstance(EntrenoWatchPlugin())
    }
}
