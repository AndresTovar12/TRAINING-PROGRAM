import SwiftUI
import HealthKit
import WatchKit

/// El iPhone puede abrir esta app en el reloj para empezar a medir el pulso sin que tengas que tocarla (`HKHealthStore.startWatchApp`): llega aquí.
/// Y si el reloj se apagó o la app se cerró a mitad de un entreno, watchOS la vuelve a abrir para retomarlo (`handleActiveWorkoutRecovery`).
final class DelegadoDelReloj: NSObject, WKApplicationDelegate {
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        ModeloDelEntreno.compartido.arrancaDesdeElTelefono(workoutConfiguration)
    }

    func handleActiveWorkoutRecovery() {
        ModeloDelEntreno.compartido.recuperaEntreno()
    }
}

/// La app del Apple Watch de Training Lab: entrena con el iPhone (lo acompaña: pulso en vivo y «Listo» en la muñeca) o sin él (el plan de hoy y el entreno
/// libre, guardados en el reloj; todo llega al iPhone después). Ver `ModeloDelEntreno.swift`.
@main
struct TrainingLabWatchApp: App {
    @WKApplicationDelegateAdaptor(DelegadoDelReloj.self) private var delegado
    @StateObject private var modelo = ModeloDelEntreno.compartido

    var body: some Scene {
        WindowGroup {
            RaizDelReloj()
                .environmentObject(modelo)
        }
    }
}

/// Qué se ve: un entreno del reloj en curso manda (volver al entreno: al subir la muñeca o abrir la app, cae en su entreno, no en el inicio); luego el resumen
/// del que acaba de terminar; luego el entreno que guía el iPhone; si no, el inicio.
struct RaizDelReloj: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        Group {
            if let e = modelo.entreno {
                if e.conPasos { PantallaDeLaSesion() } else { PantallaDelLibre() }
            } else if modelo.fin != nil {
                PantallaDelFin()
            } else if modelo.activo {
                VistaDelEntreno()
            } else {
                switch modelo.pantalla {
                case .inicio: InicioDelReloj()
                case .sesiones: TodasLasSesiones()
                case .detalle(let id): DetalleDeSesion(id: id)
                case .libres: EntrenoLibreDelReloj()
                case .catalogo: CatalogoDelReloj()
                case .nadar: DondeNadas()
                }
            }
        }
    }
}
