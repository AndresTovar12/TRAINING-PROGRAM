import Foundation
import Capacitor
import ActivityKit

/// El puente entre la web (JavaScript) y la pantalla bloqueada: empezar, actualizar y terminar la Live Activity del entreno.
/// En la web: `lib/pantallaBloqueada.js`. Sin iOS 16.2 o con las actividades apagadas en Ajustes, no hace nada y avisa `disponible: false`.
@objc(EntrenoLivePlugin)
public class EntrenoLivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EntrenoLivePlugin"
    public let jsName = "EntrenoLive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "empieza", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "actualiza", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "termina", returnType: CAPPluginReturnPromise)
    ]

    private var actual: Any?

    /// Al abrir la app no puede haber un entreno en marcha: si quedó una tarjeta de antes (la app se cerró a la fuerza), se quita para que no se quede «entrenando» horas.
    override public func load() {
        guard #available(iOS 16.2, *) else { return }
        Task { for vieja in Activity<EntrenoAtributos>.activities { await vieja.end(nil, dismissalPolicy: .immediate) } }
    }

    @available(iOS 16.2, *)
    private func estado(_ call: CAPPluginCall) -> EntrenoAtributos.ContentState {
        EntrenoAtributos.ContentState(
            titulo: call.getString("titulo") ?? "Entrenando",
            detalle: call.getString("detalle") ?? "",
            tipo: call.getString("tipo") ?? "trabajo",
            finMs: call.getDouble("finMs"),
            inicioMs: call.getDouble("inicioMs"),
            distancia: call.getString("distancia"),
            ritmo: call.getString("ritmo"),
            pulso: call.getInt("pulso")
        )
    }

    @objc func empieza(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["disponible": false]); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["disponible": false]); return }
        let contenido = ActivityContent(state: estado(call), staleDate: nil)
        Task {
            // Una sola a la vez: si quedó una de antes, se cierra.
            for vieja in Activity<EntrenoAtributos>.activities { await vieja.end(nil, dismissalPolicy: .immediate) }
            do {
                let nueva = try Activity<EntrenoAtributos>.request(attributes: EntrenoAtributos(nombre: call.getString("nombre") ?? "Entreno"), content: contenido, pushType: nil)
                self.actual = nueva
                call.resolve(["disponible": true, "id": nueva.id])
            } catch {
                call.resolve(["disponible": false, "error": error.localizedDescription])
            }
        }
    }

    @objc func actualiza(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["disponible": false]); return }
        let contenido = ActivityContent(state: estado(call), staleDate: nil)
        Task {
            let vivas = Activity<EntrenoAtributos>.activities
            for a in vivas { await a.update(contenido) }
            call.resolve(["disponible": !vivas.isEmpty])
        }
    }

    @objc func termina(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for a in Activity<EntrenoAtributos>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            self.actual = nil
            call.resolve()
        }
    }
}
