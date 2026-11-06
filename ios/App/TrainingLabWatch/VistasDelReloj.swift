import SwiftUI
import WatchKit

/* LAS PANTALLAS DEL RELOJ SIN EL IPHONE (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3.2). Las de la maqueta aprobada
   (https://claude.ai/artifact/WRoxF49VXm14MC7i8HgC86): el inicio con las sesiones de hoy y «Entreno libre», el detalle de una sesión, la serie (con los controles
   a la derecha, como la app Entreno de Apple), cambiar lo que hiciste, el descanso, terminar antes, el resumen, el entreno libre y sus actividades.
   Ninguna avanza por tiempo salvo lo que ES tiempo (el reloj del entreno y la cuenta del descanso): cada marca cambia cuando la persona la toca. */

// MARK: - Piezas

/// «5:12», «1:02:09».
func relojDe(_ segundos: Double) -> String {
    let s = max(0, Int(segundos))
    let h = s / 3600
    let m = (s % 3600) / 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s % 60) : String(format: "%d:%02d", m, s % 60)
}

/// El símbolo del reloj para un ícono de la app (`lib/iconosDeTipo.datos.js`).
func simboloDe(_ icono: String?) -> String {
    switch icono ?? "" {
    case "correr": return "figure.run"
    case "caminar": return "figure.walk"
    case "senderismo", "montana": return "figure.hiking"
    case "bici": return "figure.outdoor.cycle"
    case "velocimetro": return "figure.indoor.cycle"
    case "patines": return "figure.skating"
    case "nadar": return "figure.pool.swim"
    case "olas": return "figure.surfing"
    case "kayak", "barco": return "figure.rower"
    case "pesa": return "dumbbell.fill"
    case "pesa-rusa": return "figure.strengthtraining.functional"
    case "llama": return "flame.fill"
    case "rayo": return "bolt.heart.fill"
    case "caminadora": return "figure.elliptical"
    case "tenis": return "figure.tennis"
    case "pingpong": return "figure.table.tennis"
    case "futbol": return "figure.soccer"
    case "basquet": return "figure.basketball"
    case "voleibol": return "figure.volleyball"
    case "yoga": return "figure.yoga"
    case "estirar": return "figure.pilates"
    case "estirar-2": return "figure.flexibility"
    case "boxeo": return "figure.boxing"
    case "karate": return "figure.martial.arts"
    default: return "figure.mixed.cardio"
    }
}

/// Un botón ancho y redondo (los de la maqueta).
struct BotonAncho: View {
    let texto: String
    var simbolo: String?
    var fondo: Color = ColorDelReloj.azul
    var letra: Color = .white
    var alto: CGFloat = 32
    let accion: () -> Void

    var body: some View {
        Button(action: accion) {
            HStack(spacing: 4) {
                if let s = simbolo { Image(systemName: s).font(.system(size: 12, weight: .bold)) }
                Text(texto).font(.system(size: 14, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: alto)
            .foregroundStyle(letra)
            .background(Capsule().fill(fondo))
        }
        .buttonStyle(.plain)
    }
}

/// La flecha «‹» para regresar, con el título de la pantalla.
struct Encabezado: View {
    let titulo: String
    let atras: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Button(action: atras) {
                Image(systemName: "chevron.left").font(.system(size: 15, weight: .bold)).foregroundStyle(ColorDelReloj.azul)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Atrás")
            Text(titulo).font(.system(size: 13, weight: .bold)).lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}

/// El cuadrito de color con el ícono de una actividad.
struct IconoDeActividad: View {
    let actividad: ActividadDelReloj
    var lado: CGFloat = 24

    var body: some View {
        Image(systemName: simboloDe(actividad.icono))
            .font(.system(size: lado * 0.55, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: lado, height: lado)
            .background(RoundedRectangle(cornerRadius: lado * 0.33).fill(Color(hex: actividad.color)))
    }
}

/// El pulso en rojo («♥ 128»), o nada si todavía no hay.
struct PulsoChico: View {
    let bpm: Int
    var tamano: CGFloat = 13

    var body: some View {
        if bpm > 0 {
            Label("\(bpm)", systemImage: "heart.fill")
                .font(.system(size: tamano, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(ColorDelReloj.rojo)
        }
    }
}

/// La rayita de avance: una por serie que hay que hacer (con muchas, una barra corrida).
struct BarraDeSeries: View {
    let hechas: Int
    let total: Int

    var body: some View {
        if total > 0 && total <= 30 {
            HStack(spacing: 2) {
                ForEach(0..<total, id: \.self) { i in
                    Capsule().fill(i < hechas ? ColorDelReloj.azul : ColorDelReloj.gris).frame(height: 3)
                }
            }
        } else if total > 30 {
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(ColorDelReloj.gris)
                    Capsule().fill(ColorDelReloj.azul).frame(width: g.size.width * CGFloat(hechas) / CGFloat(total))
                }
            }
            .frame(height: 3)
        }
    }
}

// MARK: - El inicio

struct InicioDelReloj: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        let sesiones = modelo.sesionesDeHoy
        let conPlan = !modelo.sinPlan && sesiones != nil && !(sesiones ?? []).isEmpty
        ScrollView {
            VStack(alignment: .leading, spacing: 5) {
                if modelo.sinPlan {
                    Text("Training Lab").font(.system(size: 15, weight: .bold)).foregroundStyle(ColorDelReloj.azul)
                } else if let sesiones = sesiones {
                    if sesiones.isEmpty {
                        TarjetaEnCalma(etiqueta: "Hoy es descanso", titulo: "Nada en tu plan", texto: "Si quieres moverte, elige abajo.", color: ColorDelReloj.verde)
                    } else if sesiones.count == 1, let s = sesiones.first {
                        TarjetaDeUnaSesion(sesion: s)
                    } else {
                        let hechas = sesiones.filter { $0.hecha }.count
                        Text(hechas > 0 && hechas < sesiones.count ? "Hoy te toca · faltan \(sesiones.count - hechas)" : "Hoy te toca")
                            .font(.system(size: 11, weight: .bold)).foregroundStyle(ColorDelReloj.azul)
                        ForEach(Array(sesiones.prefix(sesiones.count >= 4 ? 3 : sesiones.count))) { s in FilaDeSesion(sesion: s) }
                        if sesiones.count >= 4 {
                            Button { modelo.pantalla = .sesiones } label: {
                                Text("Ver todas (\(sesiones.count))").font(.system(size: 12, weight: .bold)).foregroundStyle(ColorDelReloj.azul)
                                    .frame(maxWidth: .infinity, minHeight: 24)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } else {
                    // El plan de hoy no llegó al reloj (el iPhone no se ha abierto en 3 días, o nunca): se dice qué hacer y el entreno libre sigue ahí.
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 11)).foregroundStyle(ColorDelReloj.ambar)
                        Text("Tu plan de hoy no está en el reloj. Ábrelo en tu iPhone y vuelve aquí.")
                            .font(.system(size: 11.5)).foregroundStyle(Color(red: 0.96, green: 0.84, blue: 0.54))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(red: 0.16, green: 0.14, blue: 0.06)))
                }
                // «Entreno libre»: abajo; sin plan o en día de descanso, en azul y es lo principal.
                BotonAncho(texto: "Entreno libre", simbolo: "figure.run", fondo: conPlan ? ColorDelReloj.tarjeta : ColorDelReloj.azul, alto: conPlan ? 30 : 42) {
                    modelo.pantalla = .libres
                }
                .padding(.top, 3)
            }
        }
    }
}

struct TarjetaEnCalma: View {
    let etiqueta: String
    let titulo: String
    let texto: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(etiqueta).font(.system(size: 10, weight: .bold)).foregroundStyle(color)
            Text(titulo).font(.system(size: 13, weight: .bold))
            Text(texto).font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 14).fill(ColorDelReloj.tarjeta))
    }
}

/// Una sesión de hoy en la lista: su rayita de color, de quién es y sus minutos. Hecha: apagada, con ✓.
struct FilaDeSesion: View {
    @EnvironmentObject var modelo: ModeloDelEntreno
    let sesion: SesionDelReloj

    var body: some View {
        Button { modelo.pantalla = .detalle(sesion.id) } label: {
            HStack(spacing: 7) {
                Capsule().fill(Color(hex: sesion.color)).frame(width: 4, height: 22)
                VStack(alignment: .leading, spacing: 0) {
                    Text(sesion.nombre).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    if let de = sesion.deQuien { Text(de).font(.system(size: 9.5)).foregroundStyle(ColorDelReloj.tenue).lineLimit(1) }
                }
                Spacer(minLength: 2)
                if sesion.hecha {
                    Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(ColorDelReloj.verde)
                } else if let min = sesion.min {
                    Text("\(min)′").font(.system(size: 10, weight: .bold)).foregroundStyle(Color(white: 0.79))
                }
            }
            .padding(.vertical, 3)
            .padding(.horizontal, 7)
            .frame(maxWidth: .infinity, minHeight: 30)
            .background(RoundedRectangle(cornerRadius: 10).fill(ColorDelReloj.tarjeta))
            .opacity(sesion.hecha ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(sesion.nombre), \(sesion.deQuien ?? "")\(sesion.hecha ? ", hecha" : "")")
    }
}

/// Una sola sesión hoy: la tarjeta con «Empezar».
struct TarjetaDeUnaSesion: View {
    @EnvironmentObject var modelo: ModeloDelEntreno
    let sesion: SesionDelReloj

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Button { modelo.pantalla = .detalle(sesion.id) } label: {
                VStack(alignment: .leading, spacing: 1) {
                    Text(sesion.hecha ? "Hecha hoy" : "Hoy te toca").font(.system(size: 10, weight: .bold)).foregroundStyle(sesion.hecha ? ColorDelReloj.verde : ColorDelReloj.azul)
                    Text(sesion.nombre).font(.system(size: 13, weight: .bold)).lineLimit(2)
                    Text(lineaDe(sesion)).font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            BotonAncho(texto: sesion.hecha ? "Otra vez" : "Empezar", fondo: sesion.hecha ? ColorDelReloj.gris : ColorDelReloj.azul, alto: 28) {
                modelo.empiezaSesion(sesion, otraVez: sesion.hecha)
            }
            .padding(.top, 3)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 14).fill(ColorDelReloj.tarjeta))
    }
}

/// «4 ejercicios · 50 min» (sin minutos escritos no se inventan).
func lineaDe(_ s: SesionDelReloj) -> String {
    var partes: [String] = []
    if let n = s.ejercicios, n > 0 { partes.append(n == 1 ? "1 ejercicio" : "\(n) ejercicios") }
    if let m = s.min { partes.append("\(m) min") }
    if partes.isEmpty, let de = s.deQuien { partes.append(de) }
    return partes.joined(separator: " · ")
}

/// Con 4 sesiones o más: todas.
struct TodasLasSesiones: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Encabezado(titulo: "Hoy") { modelo.pantalla = .inicio }
                ForEach(modelo.sesionesDeHoy ?? []) { s in FilaDeSesion(sesion: s) }
            }
        }
    }
}

// MARK: - El detalle de una sesión

/// Un ejercicio en el detalle de la sesión.
struct EjercicioDelDetalle: Identifiable {
    let id: String
    let nombre: String
    let texto: String
}

struct DetalleDeSesion: View {
    @EnvironmentObject var modelo: ModeloDelEntreno
    let id: String

    /// Cada ejercicio una vez, en orden: «Sentadilla · 4×8», «Zancada búlgara · 3×8 por lado».
    private func ejercicios(_ s: SesionDelReloj) -> [EjercicioDelDetalle] {
        var vistos: Set<String> = []
        var salida: [EjercicioDelDetalle] = []
        for p in s.pasos where !p.esDescanso {
            let clave = p.i.map { "\(p.t)\($0)" } ?? p.c
            if vistos.contains(clave) { continue }
            vistos.insert(clave)
            var texto = ""
            if p.t == "e" {
                let vueltas = p.vs ?? 1
                let unidad = (p.u == nil || p.u == "reps") ? "" : " \(p.u ?? "")"
                let cantidad = p.reps.map { $0 + unidad }
                texto = [vueltas > 1 ? "\(vueltas)×" : nil, cantidad].compactMap { $0 }.joined()
                if p.lado == true { texto += " por lado" }
            } else if p.t == "r" {
                texto = p.texto ?? ""
            }
            salida.append(EjercicioDelDetalle(id: clave, nombre: p.n, texto: texto))
        }
        return salida
    }

    var body: some View {
        if let s = modelo.sesion(id) {
            ScrollView {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Hoy").font(.system(size: 11, weight: .bold)).foregroundStyle(ColorDelReloj.azul)
                    Text(s.nombre).font(.system(size: 15, weight: .bold)).lineLimit(3)
                    HStack(spacing: 4) {
                        Circle().fill(Color(hex: s.color)).frame(width: 7, height: 7)
                        Text([s.deQuien, s.min.map { "\($0) min" }].compactMap { $0 }.joined(separator: " · "))
                            .font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue).lineLimit(1)
                    }
                    if s.pasos.isEmpty {
                        Text("Se mide con el tiempo y tu pulso.").font(.system(size: 10.5)).foregroundStyle(Color(white: 0.79))
                    } else {
                        ForEach(ejercicios(s)) { e in
                            VStack(alignment: .leading, spacing: 0) {
                                Text(e.nombre).font(.system(size: 11)).foregroundStyle(Color(white: 0.85)).lineLimit(1)
                                if !e.texto.isEmpty { Text(e.texto).font(.system(size: 10)).foregroundStyle(ColorDelReloj.tenue).lineLimit(1) }
                            }
                        }
                    }
                    if let llego = modelo.planLlegoEn {
                        Text("Llegó a las \(llego.formatted(date: .omitted, time: .shortened))").font(.system(size: 9.5)).foregroundStyle(Color(white: 0.48)).padding(.top, 2)
                    }
                    HStack(spacing: 5) {
                        BotonAncho(texto: "Atrás", fondo: ColorDelReloj.gris, alto: 30) { modelo.pantalla = .inicio }
                        BotonAncho(texto: s.hecha ? "Otra vez" : "Empezar", fondo: s.hecha ? ColorDelReloj.gris : ColorDelReloj.azul, alto: 30) {
                            modelo.empiezaSesion(s, otraVez: s.hecha)
                        }
                    }
                    .padding(.top, 4)
                }
            }
        } else {
            // La sesión ya no está (llegó un plan nuevo mientras se miraba).
            VStack(spacing: 6) {
                Text("Esta sesión ya no está en tu plan de hoy.").font(.system(size: 12)).multilineTextAlignment(.center)
                BotonAncho(texto: "Atrás", fondo: ColorDelReloj.gris) { modelo.pantalla = .inicio }
            }
        }
    }
}

// MARK: - La sesión en curso

struct PantallaDeLaSesion: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        if modelo.confirmando {
            ConfirmaTerminar()
        } else if modelo.ajustando {
            AjustaLaSerie()
        } else if let e = modelo.entreno, let p = e.actual, p.esDescanso {
            PantallaDeDescanso()
        } else {
            TabView(selection: $modelo.pagina) {
                ControlesDeLaSesion().tag(0)
                PasoDeLaSesion().tag(1)
            }
            .tabViewStyle(.page)
        }
    }
}

/// Una serie: ejercicio, número de serie, reps y kilos (se tocan para cambiarlos), el pulso y «Listo».
struct PasoDeLaSesion: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        if let e = modelo.entreno, let p = e.actual {
            let ajuste = modelo.ajuste?.clave == p.c ? modelo.ajuste : nil
            let unidadPeso = e.enLibras ? "lb" : "kg"
            ZStack {
                VStack(alignment: .leading, spacing: 2) {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack {
                            if let x = e.ejercicioActual { Text("\(x.numero)/\(x.de)").font(.system(size: 10.5, weight: .bold)).foregroundStyle(ColorDelReloj.azul) }
                            Text(relojDe(e.transcurrido(ahora: ahoraMs()) / 1000)).font(.system(size: 10.5, weight: .semibold)).monospacedDigit().foregroundStyle(ColorDelReloj.tenue)
                            Spacer(minLength: 0)
                            Image(systemName: modelo.telefonoCerca ? "iphone" : "iphone.slash").font(.system(size: 9)).foregroundStyle(ColorDelReloj.tenue)
                        }
                    }
                    BarraDeSeries(hechas: e.hechas, total: e.total)
                    Text(p.n + (p.lado == true ? " · por lado" : "")).font(.system(size: 14, weight: .bold)).lineLimit(2).minimumScaleFactor(0.85)
                    if p.t == "e" {
                        if let vs = p.vs, vs > 1 { Text("Serie \(p.v ?? 1) de \(vs)").font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue) }
                        if p.porDistancia, let meta = p.m {
                            Text("\(Int(modelo.metrosDelPaso ?? 0)) de \(Int(meta)) m").font(.system(size: 20, weight: .bold)).monospacedDigit()
                        } else if p.reps != nil || p.peso == true {
                            Button { modelo.ajustando = true } label: {
                                HStack(alignment: .firstTextBaseline, spacing: 4) {
                                    if p.reps != nil {
                                        Text(textoDeNumero(ajuste?.reps ?? p.rv ?? 0)).font(.system(size: 21, weight: .bold)).monospacedDigit()
                                        Text(p.u == nil || p.u == "reps" ? "reps" : p.u!).font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue)
                                    }
                                    if p.peso == true {
                                        Text(ajuste?.peso.map { textoDeNumero($0) } ?? p.pv.map { textoDeNumero($0) } ?? "—").font(.system(size: 21, weight: .bold)).monospacedDigit()
                                        Text(unidadPeso).font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue)
                                    }
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(RoundedRectangle(cornerRadius: 12).fill(ColorDelReloj.tarjeta))
                            }
                            .buttonStyle(.plain)
                        }
                    } else if let texto = p.texto, !texto.isEmpty {
                        Text(texto).font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue).lineLimit(2)
                    }
                    HStack {
                        Text(p.t == "e" && !p.porDistancia ? "Toca para cambiar" : "").font(.system(size: 9.5)).foregroundStyle(Color(white: 0.48))
                        Spacer(minLength: 0)
                        PulsoChico(bpm: modelo.pulso)
                    }
                    Spacer(minLength: 0)
                    BotonAncho(texto: "Listo", simbolo: "checkmark", fondo: ColorDelReloj.verde, letra: Color(red: 0, green: 0.08, blue: 0.05), alto: 32) { modelo.listo() }
                }
                if e.pausadoEn != nil { CapaDePausa() }
            }
        }
    }
}

/// «En pausa»: el tiempo está detenido.
struct CapaDePausa: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        ZStack {
            Color.black.opacity(0.85)
            VStack(spacing: 4) {
                Text("En pausa").font(.system(size: 20, weight: .bold)).foregroundStyle(ColorDelReloj.ambar)
                Text("El tiempo está detenido.").font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue)
                BotonAncho(texto: "Seguir", alto: 30) { modelo.pausaOSigue() }.padding(.horizontal, 16).padding(.top, 4)
            }
        }
    }
}

/// Cambia lo que hiciste: con + y −, o con la corona. Se guarda con «Hecho».
struct AjustaLaSerie: View {
    @EnvironmentObject var modelo: ModeloDelEntreno
    @State private var enPeso = false
    @State private var valor: Double = 0

    private var paso: PasoDelReloj? { modelo.entreno?.actual }
    private var enLibras: Bool { modelo.entreno?.enLibras ?? false }
    /// Cuánto sube cada toque: los kilos de 2.5 en 2.5 (las libras de 5 en 5); las reps de una en una; segundos de 5 en 5; metros de 10 en 10.
    private var salto: Double {
        if enPeso { return enLibras ? 5 : 2.5 }
        switch paso?.u ?? "reps" {
        case "seg": return 5
        case "m": return 10
        case "km": return 0.5
        case "yd": return 5
        default: return 1
        }
    }

    private func carga() {
        guard let p = paso else { return }
        let a = modelo.ajuste?.clave == p.c ? modelo.ajuste : nil
        enPeso = p.reps == nil && p.peso == true
        valor = enPeso ? (a?.peso ?? p.pv ?? 0) : (a?.reps ?? p.rv ?? 0)
    }

    private func pon(_ v: Double) {
        guard let p = paso else { return }
        var a = modelo.ajuste?.clave == p.c ? modelo.ajuste! : AjusteDelPaso(clave: p.c, reps: p.rv, peso: p.pv)
        if enPeso { a.peso = max(0, v) } else { a.reps = max(0, v) }
        modelo.ajuste = a
    }

    var body: some View {
        VStack(spacing: 4) {
            Text("Cambia lo que hiciste").font(.system(size: 12, weight: .bold)).frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 4) {
                Button { valor = max(0, valor - salto) } label: {
                    Image(systemName: "minus").font(.system(size: 15, weight: .bold)).frame(width: 30, height: 30).background(Circle().fill(ColorDelReloj.gris))
                }
                .buttonStyle(.plain)
                VStack(spacing: 0) {
                    Text(textoDeNumero(valor)).font(.system(size: 30, weight: .bold)).monospacedDigit()
                    Text(enPeso ? (enLibras ? "lb" : "kg") : (paso?.u == nil || paso?.u == "reps" ? "reps" : paso!.u!)).font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue)
                }
                .frame(maxWidth: .infinity)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(ColorDelReloj.verde, lineWidth: 2))
                .focusable(true)
                .digitalCrownRotation($valor, from: 0, through: enPeso ? 500 : 999, by: salto, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
                Button { valor += salto } label: {
                    Image(systemName: "plus").font(.system(size: 15, weight: .bold)).frame(width: 30, height: 30).background(Circle().fill(ColorDelReloj.gris))
                }
                .buttonStyle(.plain)
            }
            if paso?.reps != nil && paso?.peso == true {
                HStack(spacing: 5) {
                    BotonAncho(texto: "Reps", fondo: enPeso ? ColorDelReloj.gris : ColorDelReloj.azul, alto: 26) { pon(valor); enPeso = false; valor = modelo.ajuste?.reps ?? paso?.rv ?? 0 }
                    BotonAncho(texto: enLibras ? "Lb" : "Kg", fondo: enPeso ? ColorDelReloj.azul : ColorDelReloj.gris, alto: 26) { pon(valor); enPeso = true; valor = modelo.ajuste?.peso ?? paso?.pv ?? 0 }
                }
            }
            Text("También con la corona").font(.system(size: 9.5)).foregroundStyle(Color(white: 0.48))
            BotonAncho(texto: "Hecho", fondo: ColorDelReloj.verde, letra: Color(red: 0, green: 0.08, blue: 0.05), alto: 28) {
                pon(valor)
                modelo.ajustando = false
            }
        }
        .onAppear { carga() }
        .onChange(of: valor) { _, nuevo in pon(nuevo) }
    }
}

/// Los controles: Pausa, Saltar ejercicio, Terminar y Volver.
struct ControlesDeLaSesion: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    private func control(_ texto: String, _ simbolo: String, _ color: Color, _ fondo: Color, _ accion: @escaping () -> Void) -> some View {
        Button(action: accion) {
            VStack(spacing: 3) {
                Image(systemName: simbolo).font(.system(size: 16, weight: .bold)).foregroundStyle(color)
                    .frame(width: 32, height: 32).background(Circle().fill(fondo))
                Text(texto).font(.system(size: 10.5, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(RoundedRectangle(cornerRadius: 16).fill(ColorDelReloj.tarjeta))
        }
        .buttonStyle(.plain)
    }

    var body: some View {
        let e = modelo.entreno
        let pausado = e?.pausadoEn != nil
        VStack(spacing: 5) {
            Text(e?.sesion?.nombre ?? "Entreno").font(.system(size: 12, weight: .bold)).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 5), GridItem(.flexible(), spacing: 5)], spacing: 5) {
                control(pausado ? "Seguir" : "Pausa", pausado ? "play.fill" : "pause.fill", ColorDelReloj.ambar, Color(red: 0.23, green: 0.18, blue: 0.06)) { modelo.pausaOSigue() }
                control("Saltar ejercicio", "forward.end.fill", ColorDelReloj.azul, Color(red: 0.12, green: 0.16, blue: 0.33)) { modelo.saltaEjercicio() }
                control("Terminar", "xmark", ColorDelReloj.rojo, Color(red: 0.23, green: 0.08, blue: 0.09)) { modelo.pideTerminar() }
                control("Volver", "chevron.left", ColorDelReloj.verde, Color(red: 0.09, green: 0.23, blue: 0.17)) { modelo.pagina = 1 }
            }
            if let e = e {
                Text("\(max(0, e.total - e.hechas)) series por hacer").font(.system(size: 9.5)).foregroundStyle(Color(white: 0.48))
            }
        }
    }
}

/// «¿Terminar ahora?»: dice lo que se guarda (o que no se guarda nada) y quién lo ve.
struct ConfirmaTerminar: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        let e = modelo.entreno
        let quien = e?.sesion?.quien ?? "tu coach"
        let texto = (e?.algoMarcado ?? false)
            ? "Hiciste \(e?.hechas ?? 0) de \(e?.total ?? 0) series. Se guarda lo que hiciste y \(quien) lo ve así."
            : "Aún no marcas ninguna serie, así que no se guarda nada."
        VStack(alignment: .leading, spacing: 5) {
            Text("¿Terminar ahora?").font(.system(size: 15, weight: .bold))
            Text(texto).font(.system(size: 11.5)).foregroundStyle(ColorDelReloj.tenue).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            HStack(spacing: 5) {
                BotonAncho(texto: "Seguir", fondo: ColorDelReloj.gris, alto: 30) { modelo.confirmando = false; modelo.pagina = 1 }
                BotonAncho(texto: "Terminar", fondo: Color(red: 0.23, green: 0.08, blue: 0.09), letra: ColorDelReloj.rojo, alto: 30) { modelo.termina() }
            }
        }
    }
}

/// El descanso: cuenta solo y vibra al acabar. «+15 s», «Saltar» y «Deshacer el último Listo».
struct PantallaDeDescanso: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        if let e = modelo.entreno, let p = e.actual {
            ZStack {
                VStack(spacing: 2) {
                    HStack {
                        Text("Descanso").font(.system(size: 11, weight: .bold)).foregroundStyle(ColorDelReloj.verde)
                        Spacer(minLength: 0)
                        PulsoChico(bpm: modelo.pulso, tamano: 12)
                    }
                    BarraDeSeries(hechas: e.hechas, total: e.total)
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        if let d = e.descanso(ahora: ahoraMs()), let restan = d.restan {
                            Text(relojDe(Double(max(0, restan)))).font(.system(size: 46, weight: .bold, design: .rounded)).monospacedDigit().foregroundStyle(ColorDelReloj.verde)
                        } else {
                            // Un descanso escrito con palabras («Recuperación total») no tiene cuenta: espera «Seguir».
                            Text(p.texto ?? "Descanso").font(.system(size: 14, weight: .semibold)).multilineTextAlignment(.center).lineLimit(3)
                        }
                    }
                    if let s = e.siguiente {
                        let serie = (s.vs ?? 1) > 1 ? ", serie \(s.v ?? 1)" : ""
                        Text("Sigue: \(s.n)\(serie)").font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue).lineLimit(1)
                    }
                    Button { modelo.deshaz() } label: {
                        Text("Deshacer el último «Listo»").font(.system(size: 10.5, weight: .bold)).underline().foregroundStyle(ColorDelReloj.tenue)
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                    HStack(spacing: 5) {
                        if p.seg != nil {
                            BotonAncho(texto: "+15 s", fondo: ColorDelReloj.gris, alto: 30) { modelo.masQuince() }
                            BotonAncho(texto: "Saltar", alto: 30) { modelo.saltaDescanso() }
                        } else {
                            BotonAncho(texto: "Seguir", alto: 30) { modelo.saltaDescanso() }
                        }
                    }
                }
                if e.pausadoEn != nil { CapaDePausa() }
            }
        }
    }
}

// MARK: - El entreno libre (y una sesión sin pasos)

/// Una actividad con mapa (distancia, tiempo, ritmo y pulso con el GPS del reloj) o sin mapa (tiempo y pulso). Pausa y Terminar.
struct PantallaDelLibre: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        if let e = modelo.entreno {
            let conMapa = e.ubicacion == ModoDeUbicacion.gps.rawValue
            let nombre = e.actividad?.nombre ?? e.sesion?.nombre ?? "Entreno"
            let largoDeAlberca = e.natacion?.esAlberca == true ? e.natacion?.largo : nil
            let titulo: String = largoDeAlberca.map { "\(nombre) · \(Int($0)) m" } ?? (conMapa ? "\(nombre) · GPS" : nombre)
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                let segundos = e.transcurrido(ahora: ahoraMs()) / 1000
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        if let a = e.actividad { IconoDeActividad(actividad: a, lado: 20) }
                        Text(titulo).font(.system(size: 12, weight: .bold)).foregroundStyle(ColorDelReloj.azul).lineLimit(1)
                        Spacer(minLength: 0)
                        Image(systemName: modelo.telefonoCerca ? "iphone" : "iphone.slash").font(.system(size: 9)).foregroundStyle(ColorDelReloj.tenue)
                    }
                    if let largo = largoDeAlberca {
                        // En alberca: los largos que cuenta el reloj, el tiempo y los metros. Sin GPS.
                        let metros = modelo.metros ?? 0
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text("\(Int((metros / largo).rounded()))").font(.system(size: 38, weight: .bold)).monospacedDigit()
                            Text("largos").font(.system(size: 14)).foregroundStyle(ColorDelReloj.tenue)
                        }
                        HStack {
                            Text(relojDe(segundos)).font(.system(size: 20, weight: .bold)).monospacedDigit().foregroundStyle(ColorDelReloj.ambar)
                            Spacer(minLength: 0)
                            Text("\(Int(metros)) m").font(.system(size: 14, weight: .bold)).monospacedDigit()
                        }
                    } else if conMapa {
                        let km = (modelo.metros ?? 0) / 1000
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text(String(format: "%.2f", km)).font(.system(size: 38, weight: .bold)).monospacedDigit()
                            Text("km").font(.system(size: 14)).foregroundStyle(ColorDelReloj.tenue)
                        }
                        HStack {
                            Text(relojDe(segundos)).font(.system(size: 20, weight: .bold)).monospacedDigit().foregroundStyle(ColorDelReloj.ambar)
                            Spacer(minLength: 0)
                            Text(km > 0.05 ? "\(relojDe(segundos / km)) /km" : "--:-- /km").font(.system(size: 14, weight: .bold)).monospacedDigit()
                        }
                    } else {
                        Text(relojDe(segundos)).font(.system(size: 40, weight: .bold)).monospacedDigit().foregroundStyle(ColorDelReloj.ambar).padding(.top, 6)
                    }
                    PulsoChico(bpm: modelo.pulso, tamano: 16)
                    Spacer(minLength: 0)
                    HStack(spacing: 5) {
                        BotonAncho(texto: e.pausadoEn != nil ? "Seguir" : "Pausa", fondo: ColorDelReloj.gris, alto: 30) { modelo.pausaOSigue() }
                        BotonAncho(texto: "Terminar", fondo: Color(red: 0.23, green: 0.08, blue: 0.09), letra: ColorDelReloj.rojo, alto: 30) { modelo.termina() }
                    }
                }
            }
        }
    }
}

/// Entreno libre: «Tus actividades» (las mismas del iPhone, con su color; «tuya» las que creó, «mapa» las que llevan mapa) y «Ver todas».
struct EntrenoLibreDelReloj: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Encabezado(titulo: "Entreno libre") { modelo.pantalla = .inicio }
                Text("Tus actividades").font(.system(size: 11, weight: .bold)).foregroundStyle(ColorDelReloj.tenue)
                ForEach(Array(modelo.actividades.prefix(4))) { a in FilaDeActividad(actividad: a) }
                Button { modelo.pantalla = .catalogo } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "square.grid.2x2").font(.system(size: 12, weight: .bold)).frame(width: 24, height: 24)
                        Text("Ver todas").font(.system(size: 12.5, weight: .bold))
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(ColorDelReloj.azul)
                    .frame(minHeight: 30)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Una actividad: tocarla la empieza.
struct FilaDeActividad: View {
    @EnvironmentObject var modelo: ModeloDelEntreno
    let actividad: ActividadDelReloj

    var body: some View {
        Button { modelo.empiezaLibre(actividad) } label: {
            HStack(spacing: 7) {
                IconoDeActividad(actividad: actividad)
                Text(actividad.nombre).font(.system(size: 12.5, weight: .bold)).lineLimit(1)
                Spacer(minLength: 0)
                if actividad.gps && !actividad.preguntaDonde {
                    Text("mapa").font(.system(size: 9, weight: .bold)).foregroundStyle(ColorDelReloj.verde)
                } else if actividad.propia == true {
                    Text("tuya").font(.system(size: 9, weight: .bold)).foregroundStyle(ColorDelReloj.tenue)
                }
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity, minHeight: 33)
            .background(RoundedRectangle(cornerRadius: 12).fill(ColorDelReloj.tarjeta))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(actividad.nombre)\(actividad.gps && !actividad.preguntaDonde ? ", con mapa" : "")")
    }
}

/// NADAR: «¿Dónde nadas?». Alberca: «¿De qué largo?», 25 m, 50 m u «Otro» (con la corona, de 10 a 100 m), con el último que usó marcado; al elegirlo empieza. El reloj
/// cuenta los largos, sin GPS ni mapa. Aguas abiertas: empieza de una vez, con GPS y ruta. Las dos primeras pantallas se bajan si no caben; «Otro» cabe sin bajar (en
/// un reloj de 40 mm, unos 160 × 165 pt útiles, ocupa ~120 pt de alto), porque ahí la corona cambia el número.
struct DondeNadas: View {
    @EnvironmentObject var modelo: ModeloDelEntreno
    private enum Paso { case donde, largo, otro }
    @State private var paso: Paso = .donde
    @State private var otro: Double = 25
    @FocusState private var conLaCorona: Bool

    private func botonDeLargo(_ largo: Double, ultimo: Double) -> some View {
        BotonAncho(texto: "\(Int(largo)) m", fondo: ultimo == largo ? ColorDelReloj.azul : ColorDelReloj.gris, alto: 44) { modelo.nadaEnAlberca(largo: largo) }
    }

    private func cambia(_ cuanto: Double) {
        otro = min(NadoDelReloj.largoMaximo, max(NadoDelReloj.largoMinimo, otro + cuanto))
    }

    private func botonDeOtro(_ simbolo: String, _ cuanto: Double, _ etiqueta: String) -> some View {
        Button { cambia(cuanto) } label: {
            Image(systemName: simbolo).font(.system(size: 15, weight: .bold)).frame(width: 30, height: 30).background(Circle().fill(ColorDelReloj.gris))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(etiqueta)
    }

    var body: some View {
        switch paso {
        case .donde:
            ScrollView {
                VStack(alignment: .leading, spacing: 5) {
                    Encabezado(titulo: "¿Dónde nadas?") { modelo.noNada() }
                    BotonAncho(texto: "Alberca", simbolo: "figure.pool.swim", alto: 46) { paso = .largo }
                    BotonAncho(texto: "Aguas abiertas", simbolo: "water.waves", fondo: ColorDelReloj.gris, alto: 46) { modelo.nadaEnAguasAbiertas() }
                }
            }
        case .largo:
            let ultimo = modelo.ultimoLargo
            let esOtro = ultimo != 25 && ultimo != 50
            ScrollView {
                VStack(alignment: .leading, spacing: 5) {
                    Encabezado(titulo: "¿De qué largo?") { paso = .donde }
                    HStack(spacing: 5) {
                        botonDeLargo(25, ultimo: ultimo)
                        botonDeLargo(50, ultimo: ultimo)
                    }
                    BotonAncho(texto: esOtro ? "Otro · \(Int(ultimo)) m" : "Otro", fondo: esOtro ? ColorDelReloj.azul : ColorDelReloj.gris, alto: 44) {
                        otro = ultimo
                        paso = .otro
                    }
                }
            }
        case .otro:
            VStack(spacing: 4) {
                Encabezado(titulo: "Otro largo") { paso = .largo }
                HStack(spacing: 4) {
                    botonDeOtro("minus", -1, "Menos")
                    VStack(spacing: 0) {
                        Text("\(Int(otro.rounded()))").font(.system(size: 30, weight: .bold)).monospacedDigit()
                        Text("metros").font(.system(size: 10.5)).foregroundStyle(ColorDelReloj.tenue)
                    }
                    .frame(maxWidth: .infinity)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(ColorDelReloj.verde, lineWidth: 2))
                    .focusable(true)
                    .focused($conLaCorona)
                    .digitalCrownRotation($otro, from: NadoDelReloj.largoMinimo, through: NadoDelReloj.largoMaximo, by: 1, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
                    botonDeOtro("plus", 1, "Más")
                }
                Text("También con la corona").font(.system(size: 9.5)).foregroundStyle(Color(white: 0.48))
                BotonAncho(texto: "Empezar", alto: 30) { modelo.nadaEnAlberca(largo: otro) }
            }
            .onAppear { conLaCorona = true }
        }
    }
}

/// «Ver todas»: el catálogo por grupos, que se baja con la corona. Las actividades se crean solo en el iPhone.
struct CatalogoDelReloj: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 3) {
                Encabezado(titulo: "Todas") { modelo.pantalla = .libres }
                ForEach(modelo.catalogo, id: \.grupo) { g in
                    Text(g.grupo).font(.system(size: 10, weight: .bold)).foregroundStyle(Color(white: 0.48)).padding(.top, 5)
                    ForEach(g.actividades) { a in FilaDeActividad(actividad: a) }
                }
                Text("Las que crees en el iPhone salen aquí también.").font(.system(size: 9.5)).foregroundStyle(Color(white: 0.48))
                    .frame(maxWidth: .infinity).multilineTextAlignment(.center).padding(.top, 8)
            }
        }
    }
}

// MARK: - Al terminar

/// El resumen: tiempo, series y pulso medio (o distancia, tiempo y pulso), y si ya está en el iPhone. «Ya está en tu iPhone» solo cuando WatchConnectivity dice
/// que llegó; «{quien} ya lo ve» solo cuando el iPhone avisa que ya subió.
struct PantallaDelFin: View {
    @EnvironmentObject var modelo: ModeloDelEntreno

    private func fila(_ etiqueta: String, _ valor: String, _ color: Color = .white) -> some View {
        HStack {
            Text(etiqueta).font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue)
            Spacer(minLength: 0)
            Text(valor).font(.system(size: 14, weight: .bold)).monospacedDigit().foregroundStyle(color)
        }
    }

    var body: some View {
        if let f = modelo.fin {
            let entregado = modelo.entregados.contains(f.id)
            let subido = modelo.subidos.contains(f.id)
            let mensaje: String = {
                if f.modo == "libre" {
                    return entregado ? "Ya está en tu iPhone, con tu sticker." : "Tu sticker te espera en tu iPhone cuando estén cerca."
                }
                if subido { return "Ya está en tu iPhone. \(f.quien.prefix(1).uppercased() + f.quien.dropFirst()) ya lo ve." }
                return entregado ? "Ya está en tu iPhone." : "Guardado en tu reloj. Pasa a tu iPhone y a \(f.quien) cuando estén cerca."
            }()
            ScrollView {
                VStack(alignment: .leading, spacing: 3) {
                    Text(f.titulo).font(.system(size: 15, weight: .bold)).lineLimit(2)
                    if let n = f.nombre { Text(n).font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue).lineLimit(1) }
                    VStack(spacing: 2) {
                        if let l = f.largos, let largo = f.largo {
                            fila("Largos", "\(l) de \(Int(largo)) m")
                            fila("Distancia", "\(Int(Double(l) * largo)) m")
                        } else if f.conMapa, let m = f.metros {
                            fila("Distancia", String(format: "%.2f km", m / 1000))
                        }
                        fila("Tiempo", relojDe(f.segundos))
                        if let h = f.hechas, let de = f.deSeries { fila("Series", "\(h) de \(de)") }
                        if let p = f.pulsoMedio { fila("Pulso medio", "\(p)", ColorDelReloj.rojo) }
                    }
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 14).fill(ColorDelReloj.tarjeta))
                    HStack(alignment: .top, spacing: 5) {
                        Image(systemName: entregado ? "checkmark.circle.fill" : "iphone.slash").font(.system(size: 11)).foregroundStyle(entregado ? ColorDelReloj.verde : ColorDelReloj.tenue)
                        Text(mensaje).font(.system(size: 11)).foregroundStyle(ColorDelReloj.tenue).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 2)
                    BotonAncho(texto: "Listo", alto: 30) { modelo.cierraFin() }.padding(.top, 4)
                }
            }
        }
    }
}
