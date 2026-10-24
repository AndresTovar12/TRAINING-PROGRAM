import SwiftUI

/// La pantalla del reloj: lo que toca, el tiempo, el pulso y dos botones.
struct VistaDelEntreno: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    private var color: Color {
        switch modelo.tipo {
        case "descanso": return Color(red: 0.20, green: 0.78, blue: 0.55)
        case "cardio": return Color(red: 1.00, green: 0.35, blue: 0.37)
        case "pausa": return Color(red: 0.96, green: 0.65, blue: 0.14)
        default: return Color(red: 0.31, green: 0.45, blue: 1.00)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text(modelo.titulo)
                    .font(.headline)
                    .lineLimit(2)
                if let fin = modelo.finMs {
                    Text(timerInterval: Date.now...max(Date(timeIntervalSince1970: fin / 1000), Date.now.addingTimeInterval(1)), countsDown: true)
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(color)
                } else if let inicio = modelo.inicioMs {
                    Text(Date(timeIntervalSince1970: inicio / 1000), style: .timer)
                        .font(.system(size: 34, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(color)
                }
                if !modelo.detalle.isEmpty {
                    Text(modelo.detalle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                if modelo.pulso > 0 {
                    Label("\(modelo.pulso)", systemImage: "heart.fill")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Color(red: 1, green: 0.35, blue: 0.37))
                }
                if modelo.activo {
                    Button(action: { modelo.enviaAccion("listo") }) {
                        Text("Listo").frame(maxWidth: .infinity)
                    }
                    .tint(color)
                    Button(action: { modelo.enviaAccion("siguiente") }) {
                        Text("Siguiente").frame(maxWidth: .infinity)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 4)
    }
}
