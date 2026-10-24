import Foundation
import ActivityKit

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
        /// Cardio: «5.32 km» y «5:41 /km», pulso en latidos por minuto.
        public var distancia: String?
        public var ritmo: String?
        public var pulso: Int?

        public init(titulo: String, detalle: String, tipo: String, finMs: Double? = nil, inicioMs: Double? = nil, distancia: String? = nil, ritmo: String? = nil, pulso: Int? = nil) {
            self.titulo = titulo
            self.detalle = detalle
            self.tipo = tipo
            self.finMs = finMs
            self.inicioMs = inicioMs
            self.distancia = distancia
            self.ritmo = ritmo
            self.pulso = pulso
        }
    }

    /// El nombre del entreno: «Fuerza · tren inferior».
    public var nombre: String

    public init(nombre: String) {
        self.nombre = nombre
    }
}
