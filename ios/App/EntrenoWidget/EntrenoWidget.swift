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
    case "cardio": return Color(red: 1.00, green: 77 / 255, blue: 106 / 255) // el acento de la carrera (#FF4D6A)
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
        } else if let s = estado.transcurridoS {
            Text(relojFijo(s)).monospacedDigit() // en pausa: lo que lleva, quieto
        } else {
            Text("")
        }
    }
}

/// Los colores de la pantalla de carrera (2 nov 2026): la tarjeta negra, el gris de las etiquetas, el rojo del tiempo y el círculo del botón.
private let negroDeTarjeta = Color(red: 11 / 255, green: 12 / 255, blue: 16 / 255)
private let grisDeEtiqueta = Color(red: 138 / 255, green: 143 / 255, blue: 156 / 255)
private let acento = Color(red: 1, green: 77 / 255, blue: 106 / 255)
private let fondoDelBoton = Color(red: 42 / 255, green: 43 / 255, blue: 49 / 255)

/// «12:05» o «1:02:33»: el tiempo fijo de la pausa (en pausa el cronómetro no corre).
private func relojFijo(_ segundos: Double) -> String {
    let s = max(0, Int(segundos))
    let h = s / 3600, m = (s % 3600) / 60, r = s % 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, r) : String(format: "%02d:%02d", m, r)
}

/// El botón redondo de la tarjeta: pausa (corriendo) o seguir (en pausa). Desde iOS 17 hace lo mismo que en la app; antes solo se ve (tocar la tarjeta abre la app).
private struct BotonDeLaTarjeta: View {
    let enPausa: Bool
    var body: some View {
        let dibujo = Image(systemName: enPausa ? "play.fill" : "pause.fill")
            .font(.system(size: 13, weight: .heavy))
            .foregroundStyle(.white)
            .frame(width: 34, height: 34)
            .background(Circle().fill(fondoDelBoton))
        if #available(iOS 17.0, *) {
            Button(intent: AccionDeLaTarjeta(accion: enPausa ? "reanuda" : "pausa")) { dibujo }
                .buttonStyle(.plain)
        } else {
            dibujo
        }
    }
}

/// La tarjeta de la carrera (como la vista de mapa de la app): arriba el ícono, el tiempo en rojo y el botón; abajo el ritmo y la distancia, grandes.
/// En pausa el tiempo va en gris (fijo) y el ritmo es el promedio.
private struct TarjetaDeCarrera: View {
    let estado: EntrenoAtributos.ContentState
    var body: some View {
        let enPausa = estado.tipo == "pausa"
        VStack(spacing: 8) {
            HStack {
                Image(systemName: estado.simbolo ?? "figure.run").font(.system(size: 19, weight: .semibold)).foregroundStyle(grisDeEtiqueta).frame(width: 34, alignment: .leading)
                Spacer()
                Tiempo(estado: estado).font(.system(size: 22, weight: .heavy)).foregroundStyle(enPausa ? grisDeEtiqueta : acento)
                Spacer()
                BotonDeLaTarjeta(enPausa: enPausa)
            }
            HStack(spacing: 0) {
                Columna(valor: estado.ritmo ?? "–:––", etiqueta: estado.etiquetaRitmo ?? "Ritmo (/km)", apagado: enPausa)
                Columna(valor: estado.distancia ?? "0.00", etiqueta: "Distancia (km)", apagado: enPausa)
            }
            if let p = estado.pulso, !enPausa {
                Label("\(p) lpm", systemImage: "heart.fill").font(.system(size: 15, weight: .heavy)).foregroundStyle(acento)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(negroDeTarjeta)
    }

    private struct Columna: View {
        let valor: String
        let etiqueta: String
        let apagado: Bool
        var body: some View {
            VStack(spacing: 2) {
                Text(valor).font(.system(size: 30, weight: .heavy)).monospacedDigit().foregroundStyle(apagado ? Color(white: 0.62) : .white).lineLimit(1).minimumScaleFactor(0.6)
                Text(etiqueta).font(.system(size: 11, weight: .semibold)).foregroundStyle(grisDeEtiqueta).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

private struct VistaBloqueada: View {
    let estado: EntrenoAtributos.ContentState
    let nombre: String
    var body: some View {
        // La carrera con GPS trae distancia: su propia tarjeta. Los workouts del plan, la de siempre.
        if estado.distancia != nil {
            TarjetaDeCarrera(estado: estado)
        } else {
            VistaDeSiempre(estado: estado, nombre: nombre)
        }
    }
}

private struct VistaDeSiempre: View {
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
                .activityBackgroundTint(contexto.state.distancia != nil ? negroDeTarjeta : Color(red: 0.07, green: 0.08, blue: 0.11))
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
