import Foundation
import SwiftUI
import WatchConnectivity
import HealthKit
import WatchKit

/// Lo que sabe el reloj del entreno: lo que le manda el iPhone (qué toca, cuánto falta) y el pulso que mide él mismo.
final class ModeloDelEntreno: NSObject, ObservableObject, WCSessionDelegate, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    // Lo que se ve
    @Published var activo = false
    @Published var titulo = "Training Lab"
    @Published var detalle = "Abre un entreno en tu iPhone"
    @Published var tipo = "trabajo"
    @Published var finMs: Double?
    @Published var inicioMs: Double?
    @Published var pulso = 0

    // HealthKit
    private let almacen = HKHealthStore()
    private var sesion: HKWorkoutSession?
    private var constructor: HKLiveWorkoutBuilder?
    private var hapticoDe: Double?
    private var reloj: Timer?

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        reloj = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.cadaSegundo() }
    }

    // MARK: Lo que manda el iPhone

    private func recibe(_ datos: [String: Any]) {
        DispatchQueue.main.async {
            let orden = datos["orden"] as? String ?? "estado"
            if orden == "fin" { self.terminaTodo(); return }
            self.titulo = datos["titulo"] as? String ?? self.titulo
            self.detalle = datos["detalle"] as? String ?? ""
            self.tipo = datos["tipo"] as? String ?? "trabajo"
            self.finMs = datos["finMs"] as? Double
            self.inicioMs = datos["inicioMs"] as? Double
            if !self.activo {
                self.activo = true
                self.empiezaEntreno(deporte: datos["deporte"] as? String ?? "otro")
            }
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { recibe(message) }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { recibe(applicationContext) }

    /// Le avisa al iPhone qué se tocó en el reloj («listo», «siguiente», «atras»).
    func enviaAccion(_ accion: String) {
        guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["accion": accion], replyHandler: nil, errorHandler: nil)
    }

    /// Una vibración en la muñeca cuando se acaba el descanso o el tiempo del paso.
    private func cadaSegundo() {
        guard let fin = finMs else { hapticoDe = nil; return }
        if Date().timeIntervalSince1970 * 1000 >= fin, hapticoDe != fin {
            hapticoDe = fin
            WKInterfaceDevice.current().play(.notification)
        }
    }

    // MARK: El entreno en Apple Salud (da el pulso en vivo)

    private func tipoDeApple(_ deporte: String) -> HKWorkoutActivityType {
        switch deporte {
        case "correr": return .running
        case "caminar": return .walking
        case "bici": return .cycling
        case "natacion": return .swimming
        case "remo": return .rowing
        case "fuerza": return .traditionalStrengthTraining
        case "hiit": return .highIntensityIntervalTraining
        case "yoga": return .yoga
        case "funcional": return .functionalStrengthTraining
        default: return .other
        }
    }

    private func empiezaEntreno(deporte: String) {
        let lee: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned)]
        let escribe: Set<HKSampleType> = [HKObjectType.workoutType()]
        almacen.requestAuthorization(toShare: escribe, read: lee) { ok, _ in
            guard ok else { return }
            DispatchQueue.main.async { self.arranca(deporte: deporte) }
        }
    }

    private func arranca(deporte: String) {
        let config = HKWorkoutConfiguration()
        config.activityType = tipoDeApple(deporte)
        config.locationType = (deporte == "correr" || deporte == "caminar" || deporte == "bici") ? .outdoor : .indoor
        do {
            let s = try HKWorkoutSession(healthStore: almacen, configuration: config)
            let c = s.associatedWorkoutBuilder()
            c.dataSource = HKLiveWorkoutDataSource(healthStore: almacen, workoutConfiguration: config)
            s.delegate = self
            c.delegate = self
            sesion = s
            constructor = c
            let inicio = Date()
            s.startActivity(with: inicio)
            c.beginCollection(withStart: inicio) { _, _ in }
        } catch {
            sesion = nil
            constructor = nil
        }
    }

    private func terminaTodo() {
        activo = false
        pulso = 0
        finMs = nil
        inicioMs = nil
        titulo = "Training Lab"
        detalle = "Abre un entreno en tu iPhone"
        sesion?.end()
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        if toState == .ended {
            constructor?.endCollection(withEnd: date) { _, _ in
                self.constructor?.finishWorkout { _, _ in
                    self.sesion = nil
                    self.constructor = nil
                }
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let tipoPulso = HKQuantityType(.heartRate)
        guard collectedTypes.contains(tipoPulso),
              let ultimo = workoutBuilder.statistics(for: tipoPulso)?.mostRecentQuantity() else { return }
        let bpm = Int(ultimo.doubleValue(for: HKUnit.count().unitDivided(by: HKUnit.minute())).rounded())
        DispatchQueue.main.async {
            self.pulso = bpm
            if WCSession.default.activationState == .activated, WCSession.default.isReachable {
                WCSession.default.sendMessage(["pulso": bpm], replyHandler: nil, errorHandler: nil)
            }
        }
    }
}
