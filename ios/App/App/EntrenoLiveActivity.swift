import Foundation
import ActivityKit
import AppIntents

/// Lo que se ve en la pantalla bloqueada y en la isla dinámica mientras se entrena (Live Activity).
/// Este archivo lo comparten la app y la extensión de pantalla bloqueada (`EntrenoWidget`): si cambia, cambia para las dos.
@available(iOS 16.2, *)
public struct EntrenoAtributos: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Qué se está haciendo: «Sentadilla», «Descanso», «Correr».
        public var titulo: String
        /// La línea de abajo: «Serie 2 de 4 · 80 kg», «Sigue: Peso muerto».
        public var detalle: String
        /// "trabajo" | "descanso" | "cardio" | "pausa": define el color y el ícono.
        public var tipo: String
        /// Cuenta regresiva: la hora (milisegundos desde 1970) en que termina el descanso o el tiempo del paso. Nil si no hay.
        public var finMs: Double?
        /// Cronómetro que sube: la hora en que empezó (se pone el reloj corriendo). Nil si no hay.
        public var inicioMs: Double?
        /// Cardio (la tarjeta de la carrera): «5.32» y «5:41», con sus etiquetas aparte; pulso en latidos por minuto.
        public var distancia: String?
        public var ritmo: String?
        public var pulso: Int?
        /// La carrera (pantalla de carrera, 2 nov 2026): el ícono de la actividad (un símbolo de SF Symbols, «figure.run»), la etiqueta del ritmo
        /// («Ritmo (/km)», en pausa «Ritmo promedio (/km)») y, en pausa, el tiempo que lleva (fijo: el reloj no corre).
        public var simbolo: String?
        public var etiquetaRitmo: String?
        public var transcurridoS: Double?

        public init(titulo: String, detalle: String, tipo: String, finMs: Double? = nil, inicioMs: Double? = nil, distancia: String? = nil, ritmo: String? = nil, pulso: Int? = nil,
                    simbolo: String? = nil, etiquetaRitmo: String? = nil, transcurridoS: Double? = nil) {
            self.titulo = titulo
            self.detalle = detalle
            self.tipo = tipo
            self.finMs = finMs
            self.inicioMs = inicioMs
            self.distancia = distancia
            self.ritmo = ritmo
            self.pulso = pulso
            self.simbolo = simbolo
            self.etiquetaRitmo = etiquetaRitmo
            self.transcurridoS = transcurridoS
        }
    }

    /// El nombre del entreno: «Fuerza · tren inferior».
    public var nombre: String

    public init(nombre: String) {
        self.nombre = nombre
    }
}

/// El aviso que manda el botón redondo de la tarjeta de la carrera a la app (`EntrenoLivePlugin` lo pasa a la página como «accion»).
public let avisoDeLaTarjeta = Notification.Name("tl.entreno.tarjeta")

/// El botón redondo de pausa (o de seguir) de la tarjeta de la carrera en la pantalla bloqueada. iOS corre esta acción dentro de la app (no en la extensión),
/// así que solo avisa; la página pausa o reanuda y la tarjeta se actualiza sola con lo nuevo.
@available(iOS 17.0, *)
public struct AccionDeLaTarjeta: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Pausar o seguir"
    public static var isDiscoverable: Bool = false

    /// "pausa" | "reanuda"
    @Parameter(title: "Acción")
    public var accion: String

    public init() { accion = "pausa" }
    public init(accion: String) { self.accion = accion }

    public func perform() async throws -> some IntentResult {
        let que = accion
        await MainActor.run { NotificationCenter.default.post(name: avisoDeLaTarjeta, object: nil, userInfo: ["accion": que]) }
        return .result()
    }
}
