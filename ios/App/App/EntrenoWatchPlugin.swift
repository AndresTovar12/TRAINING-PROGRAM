import Foundation
import Capacitor
import WatchConnectivity
import HealthKit

/* EL APPLE WATCH, DEL LADO DEL IPHONE (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3).

   `ReceptorDelReloj` es el único que habla con WatchConnectivity. Se activa al abrir la app (`AppDelegate`), ANTES que la web: así lo que el reloj manda con
   `transferUserInfo` (un entreno terminado sin el iPhone) se guarda en disco al recibirlo, aunque la web todavía no corra. Al abrir la app, la web lo pide
   (`pendientes`), lo pasa a la cola del teléfono (parte 2) y solo entonces dice que ya se puede borrar (`confirma`). Lo que ya se confirmó no se vuelve a
   entregar aunque el reloj lo mande otra vez.

   El contexto del iPhone (lo último que sabe el reloj, llegue cuando llegue) lleva DOS cosas: el plan (`mandaPlan`, parte 3.1) y lo que toca en el entreno que
   guía el iPhone (`envia`). Se juntan aquí: mandar una no borra la otra.

   El reloj publica en su contexto si tiene un entreno suyo en curso: se guarda y se le avisa a la web («Entreno en curso en tu reloj», parte 3.6). */
final class ReceptorDelReloj: NSObject, WCSessionDelegate {
    static let compartido = ReceptorDelReloj()
    weak var plugin: EntrenoWatchPlugin?

    private let llaveConfirmados = "tl.reloj.confirmados"
    private let llaveEstado = "tl.reloj.estado"
    private let llavePlan = "tl.reloj.plan"
    private let disco = DispatchQueue(label: "tl.reloj.disco")
    private var contexto: [String: Any] = [:]
    private var arrancado = false

    func arranca() {
        guard WCSession.isSupported(), !arrancado else { return }
        arrancado = true
        if let plan = UserDefaults.standard.string(forKey: llavePlan) { contexto["plan"] = plan }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: El disco

    private var carpeta: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? FileManager.default.temporaryDirectory
        let url = base.appendingPathComponent("TrainingLab/del-reloj", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    private func archivo(_ id: String) -> URL {
        let limpio = id.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        return carpeta.appendingPathComponent("\(limpio).json")
    }
    private var confirmados: [String] { UserDefaults.standard.stringArray(forKey: llaveConfirmados) ?? [] }

    /// Guarda lo que llegó. `false` si ya se había confirmado antes (no se vuelve a entregar).
    private func guarda(id: String, resultado: String) -> Bool {
        disco.sync {
            if confirmados.contains(id) { return false }
            try? Data(resultado.utf8).write(to: archivo(id), options: .atomic)
            return true
        }
    }

    /// Lo que el reloj mandó y la web todavía no pasa a su cola.
    func pendientes() -> [[String: String]] {
        disco.sync {
            let archivos = (try? FileManager.default.contentsOfDirectory(at: carpeta, includingPropertiesForKeys: [.creationDateKey])) ?? []
            return archivos
                .filter { $0.pathExtension == "json" }
                .sorted { (a, b) in
                    let fa = (try? a.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
                    let fb = (try? b.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
                    return fa < fb
                }
                .compactMap { url in
                    guard let datos = try? Data(contentsOf: url), let texto = String(data: datos, encoding: .utf8) else { return nil }
                    return ["id": url.deletingPathExtension().lastPathComponent, "resultado": texto]
                }
        }
    }

    /// Ya quedó en la cola del teléfono: se borra del disco y se anota (si el reloj lo manda otra vez, ya no se entrega).
    func confirma(_ id: String) {
        disco.sync {
            try? FileManager.default.removeItem(at: archivo(id))
            var lista = confirmados.filter { $0 != id }
            lista.append(id)
            UserDefaults.standard.set(Array(lista.suffix(300)), forKey: llaveConfirmados)
        }
    }

    /// Lo último que publicó el reloj sobre su entreno en curso (el texto tal cual), o `nil`.
    var estadoDelReloj: String? { UserDefaults.standard.string(forKey: llaveEstado) }

    // MARK: Al reloj

    private func mandaContexto() -> Bool {
        guard WCSession.isSupported() else { return false }
        let s = WCSession.default
        guard s.activationState == .activated, s.isPaired, s.isWatchAppInstalled else { return false }
        do {
            try s.updateApplicationContext(contexto)
            return true
        } catch {
            print("Reloj: no se pudo mandar el contexto: \(error.localizedDescription)")
            return false
        }
    }

    /// El plan del reloj (lo de `planParaElReloj`, como texto). Se guarda para que, si la app se cierra, el siguiente contexto lo siga llevando.
    func mandaPlan(_ texto: String) -> Bool {
        contexto["plan"] = texto
        UserDefaults.standard.set(texto, forKey: llavePlan)
        return mandaContexto()
    }

    /// Lo que toca en el entreno que guía el iPhone: en el contexto (llega aunque el reloj esté dormido) y como mensaje (al instante si está despierto).
    func mandaGuiado(_ datos: [String: Any]) {
        var guiado = datos
        guiado["en"] = Date().timeIntervalSince1970 * 1000
        contexto["guiado"] = guiado
        _ = mandaContexto()
        if WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isReachable {
            WCSession.default.sendMessage(datos, replyHandler: nil, errorHandler: nil)
        }
    }

    /// «Ya subió»: si el reloj está cerca, su pantalla final pasa a «{quien} ya lo ve».
    func avisaSubido(_ id: String) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["subido": id], replyHandler: nil, errorHandler: nil)
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        // Lo que el reloj publicó mientras la app estaba cerrada.
        recibeEstado(session.receivedApplicationContext)
        if contexto["plan"] == nil, let plan = session.applicationContext["plan"] { contexto["plan"] = plan }
    }
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let accion = message["accion"] as? String { plugin?.avisa("accion", ["accion": accion]) }
        if let bpm = message["pulso"] as? Int { plugin?.avisa("pulso", ["bpm": bpm]) }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        guard let id = userInfo["id"] as? String, let resultado = userInfo["resultado"] as? String else { return }
        if guarda(id: id, resultado: resultado) { plugin?.avisa("resultado", ["id": id]) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        recibeEstado(applicationContext)
    }

    private func recibeEstado(_ contextoDelReloj: [String: Any]) {
        guard let estado = contextoDelReloj["estado"] as? String else { return }
        UserDefaults.standard.set(estado, forKey: llaveEstado)
        plugin?.avisa("enCurso", ["enCurso": estado])
    }
}

/// El puente entre la web (JavaScript) y el Apple Watch: manda al reloj lo que toca y su plan, y avisa a la web lo que el reloj mide, lo que se toca en su
/// pantalla y lo que terminó sin el iPhone. En la web: `lib/relojApple.js`. La app del reloj: `TrainingLabWatch`.
@objc(EntrenoWatchPlugin)
public class EntrenoWatchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EntrenoWatchPlugin"
    public let jsName = "EntrenoWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "envia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "termina", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mandaPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendientes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirma", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "avisaSubido", returnType: CAPPluginReturnPromise)
    ]

    private let almacen = HKHealthStore()
    private var relojAbierto = false
    private let receptor = ReceptorDelReloj.compartido

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
        receptor.plugin = self
        receptor.arranca()
    }

    /// Lo que el receptor quiere decirle a la web.
    func avisa(_ evento: String, _ datos: [String: Any]) {
        notifyListeners(evento, data: datos)
    }

    @objc func estado(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(["emparejado": false, "instalada": false, "alcanzable": false]); return }
        let s = WCSession.default
        var r: [String: Any] = ["emparejado": s.isPaired, "instalada": s.isWatchAppInstalled, "alcanzable": s.isReachable]
        if let enCurso = receptor.estadoDelReloj { r["enCurso"] = enCurso }
        call.resolve(r)
    }

    @objc func envia(_ call: CAPPluginCall) {
        var datos: [String: Any] = ["orden": "estado"]
        for clave in ["titulo", "detalle", "tipo", "deporte"] {
            if let v = call.getString(clave) { datos[clave] = v }
        }
        for clave in ["finMs", "inicioMs"] {
            if let v = call.getDouble(clave) { datos[clave] = v }
        }
        receptor.mandaGuiado(datos)
        abreElReloj(deporte: datos["deporte"] as? String)
        call.resolve()
    }

    @objc func termina(_ call: CAPPluginCall) {
        relojAbierto = false
        receptor.mandaGuiado(["orden": "fin"])
        call.resolve()
    }

    @objc func mandaPlan(_ call: CAPPluginCall) {
        guard let plan = call.getString("plan") else { call.reject("Falta el plan"); return }
        call.resolve(["enviado": receptor.mandaPlan(plan)])
    }

    @objc func pendientes(_ call: CAPPluginCall) {
        call.resolve(["resultados": receptor.pendientes()])
    }

    @objc func confirma(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("Falta el id"); return }
        receptor.confirma(id)
        call.resolve()
    }

    @objc func avisaSubido(_ call: CAPPluginCall) {
        if let id = call.getString("id") { receptor.avisaSubido(id) }
        call.resolve()
    }
}
