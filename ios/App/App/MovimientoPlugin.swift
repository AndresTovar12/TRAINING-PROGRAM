import Foundation
import Capacitor
import CoreMotion

/* EL SENSOR DE MOVIMIENTO (2 nov 2026, bug «parado en la calle sumó 50 m en 87 s y la pausa automática nunca entró»).

   Entre edificios el GPS del iPhone daba ~0.9 m/s estando quieto. El sensor de movimiento no se deja engañar por eso: `CMMotionActivityManager` dice si estás
   quieto, caminando, corriendo o en bici, y `CMPedometer` cuenta los pasos. Este plugin solo los enciende y avisa lo que dicen; lo que se decide con eso vive en
   la página (`src/lib/sensorDeMovimiento.js`, puente `src/lib/movimientoNativo.js`).

   Métodos: `estado` (qué hay y si hay permiso), `inicia` (enciende; contesta de inmediato), `detiene`.
   Avisos: `movimiento` { estado: quieto|caminando|corriendo|bici|auto|desconocido, confianza: 0-2, en: ms desde cuándo }, `pasos` { pasos (desde que se
   encendió), en: ms }, `permiso` { permiso: si|negado|restringido|sin_preguntar } y `falla` { cual: pasos }.
   La primera vez, iOS pregunta el permiso con `NSMotionUsageDescription` del Info.plist («Para saber cuándo te detienes y no sumar metros de más»). */
@objc(MovimientoPlugin)
public class MovimientoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MovimientoPlugin"
    public let jsName = "Movimiento"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "inicia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "detiene", returnType: CAPPluginReturnPromise)
    ]

    private let actividad = CMMotionActivityManager()
    private let podometro = CMPedometer()
    private let cola: OperationQueue = {
        let q = OperationQueue()
        q.name = "tl.movimiento"
        q.maxConcurrentOperationCount = 1
        return q
    }()
    private var midiendo = false
    private var vuelta = 0

    private static func permiso() -> String {
        switch CMMotionActivityManager.authorizationStatus() {
        case .authorized: return "si"
        case .denied: return "negado"
        case .restricted: return "restringido"
        case .notDetermined: return "sin_preguntar"
        @unknown default: return "sin_preguntar"
        }
    }

    /// Moverse gana: el iPhone puede marcar «quieto» junto con «en auto» (parado en un semáforo) o en la transición.
    private static func nombre(_ a: CMMotionActivity) -> String {
        if a.cycling { return "bici" }
        if a.running { return "corriendo" }
        if a.walking { return "caminando" }
        if a.automotive { return "auto" }
        if a.stationary { return "quieto" }
        return "desconocido"
    }

    private func lo(_ hayActividad: Bool, _ hayPasos: Bool) -> [String: Any] {
        ["actividad": hayActividad, "pasos": hayPasos, "permiso": Self.permiso()]
    }

    @objc func estado(_ call: CAPPluginCall) {
        call.resolve(lo(CMMotionActivityManager.isActivityAvailable(), CMPedometer.isStepCountingAvailable()))
    }

    @objc func inicia(_ call: CAPPluginCall) {
        let hayActividad = CMMotionActivityManager.isActivityAvailable()
        let hayPasos = CMPedometer.isStepCountingAvailable()
        // Contesta en el acto: lo que diga el sensor llega después, por los avisos.
        call.resolve(lo(hayActividad, hayPasos))
        guard hayActividad || hayPasos else { return }
        // Encender y apagar van siempre por el hilo principal, en orden: un `detiene` que llega mientras iOS pregunta el permiso gana (`vuelta`).
        DispatchQueue.main.async {
            guard !self.midiendo else { return }
            switch CMMotionActivityManager.authorizationStatus() {
            case .denied, .restricted:
                return
            case .notDetermined:
                // La pregunta del permiso: la consulta la dispara y contesta cuando la persona decide. Solo entonces se enciende (o no).
                self.midiendo = true
                let esta = self.vuelta
                let ahora = Date()
                self.actividad.queryActivityStarting(from: ahora.addingTimeInterval(-60), to: ahora, to: self.cola) { [weak self] _, _ in
                    DispatchQueue.main.async {
                        guard let self = self, self.vuelta == esta else { return }
                        let p = Self.permiso()
                        self.notifyListeners("permiso", data: ["permiso": p])
                        if p == "si" { self.enciende(hayActividad: hayActividad, hayPasos: hayPasos) } else { self.midiendo = false }
                    }
                }
            default:
                self.midiendo = true
                self.enciende(hayActividad: hayActividad, hayPasos: hayPasos)
            }
        }
    }

    private func enciende(hayActividad: Bool, hayPasos: Bool) {
        if hayActividad {
            actividad.startActivityUpdates(to: cola) { [weak self] a in
                guard let self = self, let a = a else { return }
                self.notifyListeners("movimiento", data: [
                    "estado": Self.nombre(a),
                    "confianza": a.confidence.rawValue,
                    "en": a.startDate.timeIntervalSince1970 * 1000
                ])
            }
        }
        if hayPasos {
            podometro.startUpdates(from: Date()) { [weak self] datos, error in
                guard let self = self else { return }
                if error != nil { self.notifyListeners("falla", data: ["cual": "pasos"]); return }
                guard let datos = datos else { return }
                self.notifyListeners("pasos", data: ["pasos": datos.numberOfSteps.intValue, "en": datos.endDate.timeIntervalSince1970 * 1000])
            }
        }
    }

    @objc func detiene(_ call: CAPPluginCall) {
        call.resolve()
        DispatchQueue.main.async {
            self.vuelta += 1
            guard self.midiendo else { return }
            self.actividad.stopActivityUpdates()
            self.podometro.stopUpdates()
            self.midiendo = false
        }
    }
}
