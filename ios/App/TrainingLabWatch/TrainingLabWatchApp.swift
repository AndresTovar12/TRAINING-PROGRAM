import SwiftUI
import HealthKit
import WatchKit

/// El iPhone puede abrir esta app en el reloj para empezar a medir el pulso sin que tengas que tocarla (`HKHealthStore.startWatchApp`): llega aquí.
final class DelegadoDelReloj: NSObject, WKApplicationDelegate {
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        ModeloDelEntreno.compartido.arrancaDesdeElTelefono(workoutConfiguration)
    }
}

/// La app del Apple Watch de Training Lab: muestra lo que toca en el entreno (lo manda el iPhone), mide el pulso en vivo y deja marcar «Listo» desde la muñeca.
@main
struct TrainingLabWatchApp: App {
    @WKApplicationDelegateAdaptor(DelegadoDelReloj.self) private var delegado
    @StateObject private var modelo = ModeloDelEntreno.compartido

    var body: some Scene {
        WindowGroup {
            VistaDelEntreno()
                .environmentObject(modelo)
        }
    }
}
