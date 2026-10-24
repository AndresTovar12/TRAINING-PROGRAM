import SwiftUI
import WidgetKit
import ActivityKit

/// La extensión de pantalla bloqueada: dibuja la Live Activity del entreno (tarjeta en la pantalla bloqueada y la isla dinámica).
/// Los datos llegan de la app (`EntrenoLivePlugin`); aquí solo se dibujan. Los tiempos usan el reloj del sistema (`Text(timerInterval:)`), así que
/// avanzan solos sin que la app esté despierta.

@main
struct EntrenoWidgetBundle: WidgetBundle {
    var body: some Widget {
        EntrenoLiveActivity()
    }
}

private func color(_ tipo: String) -> Color {
    switch tipo {
    case "descanso": return Color(red: 0.20, green: 0.78, blue: 0.55)
    case "cardio": return Color(red: 1.00, green: 0.35, blue: 0.37)
    case "pausa": return Color(red: 0.96, green: 0.65, blue: 0.14)
    default: return Color(red: 0.31, green: 0.45, blue: 1.00)
    }
}

private func icono(_ tipo: String) -> String {
    switch tipo {
    case "descanso": return "pause.circle.fill"
    case "cardio": return "figure.run"
    case "pausa": return "pause.fill"
    default: return "dumbbell.fill"
    }
}

/// El tiempo que se ve: cuenta regresiva si hay hora de fin, cronómetro si hay hora de inicio.
private struct Tiempo: View {
    let estado: EntrenoAtributos.ContentState
    var body: some View {
        if let fin = estado.finMs {
            let hasta = Date(timeIntervalSince1970: fin / 1000)
            Text(timerInterval: Date.now...max(hasta, Date.now.addingTimeInterval(1)), countsDown: true)
                .monospacedDigit()
        } else if let inicio = estado.inicioMs {
            Text(Date(timeIntervalSince1970: inicio / 1000), style: .timer)
                .monospacedDigit()
        } else {
            Text("")
        }
    }
}

private struct VistaBloqueada: View {
    let estado: EntrenoAtributos.ContentState
    let nombre: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icono(estado.tipo)).foregroundStyle(color(estado.tipo))
                Text(nombre).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                Spacer()
                if let p = estado.pulso {
                    Label("\(p)", systemImage: "heart.fill").font(.caption.weight(.bold)).foregroundStyle(Color(red: 1, green: 0.35, blue: 0.37))
                }
            }
            HStack(alignment: .firstTextBaseline) {
                Text(estado.titulo).font(.title3.weight(.heavy)).foregroundStyle(.white).lineLimit(1)
                Spacer()
                Tiempo(estado: estado).font(.system(size: 34, weight: .heavy, design: .rounded)).foregroundStyle(color(estado.tipo))
            }
            if estado.distancia != nil || estado.ritmo != nil {
                HStack(spacing: 14) {
                    if let d = estado.distancia { Text(d).font(.headline.weight(.bold)).foregroundStyle(.white) }
                    if let r = estado.ritmo { Text(r).font(.headline.weight(.semibold)).foregroundStyle(.white.opacity(0.8)) }
                }
            }
            if !estado.detalle.isEmpty {
                Text(estado.detalle).font(.subheadline).foregroundStyle(.white.opacity(0.75)).lineLimit(1)
            }
        }
        .padding(16)
        .background(Color(red: 0.07, green: 0.08, blue: 0.11))
    }
}

struct EntrenoLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EntrenoAtributos.self) { contexto in
            VistaBloqueada(estado: contexto.state, nombre: contexto.attributes.nombre)
                .activityBackgroundTint(Color(red: 0.07, green: 0.08, blue: 0.11))
        } dynamicIsland: { contexto in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: icono(contexto.state.tipo)).font(.title2).foregroundStyle(color(contexto.state.tipo))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Tiempo(estado: contexto.state).font(.system(size: 28, weight: .heavy, design: .rounded)).foregroundStyle(color(contexto.state.tipo))
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(contexto.state.titulo).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(contexto.state.detalle.isEmpty ? (contexto.state.distancia ?? "") : contexto.state.detalle).font(.subheadline).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: icono(contexto.state.tipo)).foregroundStyle(color(contexto.state.tipo))
            } compactTrailing: {
                Tiempo(estado: contexto.state).frame(maxWidth: 56).foregroundStyle(color(contexto.state.tipo))
            } minimal: {
                Image(systemName: icono(contexto.state.tipo)).foregroundStyle(color(contexto.state.tipo))
            }
        }
    }
}
