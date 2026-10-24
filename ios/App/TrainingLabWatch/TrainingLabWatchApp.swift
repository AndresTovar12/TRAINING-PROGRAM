import SwiftUI

/// La app del Apple Watch de Training Lab: muestra lo que toca en el entreno (lo manda el iPhone), mide el pulso en vivo y deja marcar «Listo» desde la muñeca.
@main
struct TrainingLabWatchApp: App {
    @StateObject private var modelo = ModeloDelEntreno()

    var body: some Scene {
        WindowGroup {
            VistaDelEntreno()
                .environmentObject(modelo)
        }
    }
}
