import Foundation
import Capacitor
import WatchConnectivity

/// El puente entre la web (JavaScript) y el Apple Watch: manda al reloj lo que toca y avisa a la web lo que el reloj mide o lo que se toca en su pantalla.
/// En la web: `lib/relojApple.js`. La app del reloj: `TrainingLabWatch`.
@objc(EntrenoWatchPlugin)
public class EntrenoWatchPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "EntrenoWatchPlugin"
    public let jsName = "EntrenoWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "envia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "termina", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    @objc func estado(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(["emparejado": false, "instalada": false, "alcanzable": false]); return }
        let s = WCSession.default
        call.resolve(["emparejado": s.isPaired, "instalada": s.isWatchAppInstalled, "alcanzable": s.isReachable])
    }

    private func manda(_ datos: [String: Any]) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isWatchAppInstalled else { return }
        // El contexto queda guardado (llega aunque el reloj esté dormido); el mensaje llega al instante si el reloj está despierto.
        try? WCSession.default.updateApplicationContext(datos)
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(datos, replyHandler: nil, errorHandler: nil)
        }
    }

    @objc func envia(_ call: CAPPluginCall) {
        var datos: [String: Any] = ["orden": "estado"]
        for clave in ["titulo", "detalle", "tipo", "deporte"] {
            if let v = call.getString(clave) { datos[clave] = v }
        }
        for clave in ["finMs", "inicioMs"] {
            if let v = call.getDouble(clave) { datos[clave] = v }
        }
        manda(datos)
        call.resolve()
    }

    @objc func termina(_ call: CAPPluginCall) {
        manda(["orden": "fin"])
        call.resolve()
    }

    // MARK: WCSessionDelegate

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let accion = message["accion"] as? String { notifyListeners("accion", data: ["accion": accion]) }
        if let bpm = message["pulso"] as? Int { notifyListeners("pulso", data: ["bpm": bpm]) }
    }
}
