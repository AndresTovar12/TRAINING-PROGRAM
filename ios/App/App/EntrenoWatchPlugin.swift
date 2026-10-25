import Foundation
import Capacitor
import WatchConnectivity
import HealthKit

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

    private let almacen = HKHealthStore()
    private var relojAbierto = false

    /// Pide al reloj que abra su app y empiece a medir (así el pulso fluye sin tener que abrirla a mano). Solo una vez por entreno.
    private func abreElReloj(deporte: String?) {
        guard !relojAbierto, WCSession.isSupported(), WCSession.default.isWatchAppInstalled, HKHealthStore.isHealthDataAvailable() else { return }
        relojAbierto = true
        let config = HKWorkoutConfiguration()
        switch deporte {
        case "correr": config.activityType = .running; config.locationType = .outdoor
        case "caminar": config.activityType = .walking; config.locationType = .outdoor
        case "bici": config.activityType = .cycling; config.locationType = .outdoor
        case "natacion": config.activityType = .swimming; config.locationType = .indoor
        case "remo": config.activityType = .rowing; config.locationType = .indoor
        case "fuerza": config.activityType = .traditionalStrengthTraining; config.locationType = .indoor
        case "hiit": config.activityType = .highIntensityIntervalTraining; config.locationType = .indoor
        case "yoga": config.activityType = .yoga; config.locationType = .indoor
        case "funcional": config.activityType = .functionalStrengthTraining; config.locationType = .indoor
        default: config.activityType = .other; config.locationType = .indoor
        }
        // Antes del iPhone con iOS 17 esta llamada no existe: ahí el reloj se abre a mano (el pulso fluye cuando abres la app del reloj).
        if #available(iOS 17.0, *) {
            almacen.startWatchApp(with: config) { _, _ in }
        }
    }

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
        abreElReloj(deporte: datos["deporte"] as? String)
        call.resolve()
    }

    @objc func termina(_ call: CAPPluginCall) {
        relojAbierto = false
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
