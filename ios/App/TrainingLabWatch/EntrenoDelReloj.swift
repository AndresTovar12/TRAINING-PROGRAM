import Foundation

/* EL ENTRENO EN EL RELOJ, sin pantalla (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3.3). Toda la lógica del entreno corre en el reloj: series,
   descansos, saltar, deshacer y pausa. Son las MISMAS reglas que `src/lib/entreno.js` en el iPhone:
     · el paso que toca no se guarda: es el PRIMER paso sin marca;
     · «Listo» da por hecho lo planeado; solo viaja lo que la persona cambió (reps, kilos);
     · un descanso empieza cuando se marcó el paso anterior y lo que queda se calcula con la hora (no es un contador): aguanta que la pantalla se apague;
     · «Deshacer» le quita la marca al último paso hecho y a los descansos que le siguieron (`vuelveAtras`).
   Se guarda en disco ENTERO cada vez que cambia algo (cada serie al marcarla, con sus reps, sus kilos y la hora): si el reloj se apaga a mitad del entreno, no se
   pierde nada de lo ya marcado. */

/// El entreno que corre en el reloj, tal como se guarda en disco (`entreno.json`).
struct EntrenoGuardado: Codable {
    /// Un id propio (el resultado usa el UUID del `HKWorkout` si Salud lo guardó).
    var id: String
    /// «sesion» (una sesión del plan) o «libre».
    var modo: String
    var usuario: String?
    /// Cuándo empezó (milisegundos).
    var inicio: Double
    var enLibras: Bool
    /// La sesión con sus pasos, como estaba al empezar (parte 3.6: si el plan cambia, este entreno termina con esta versión).
    var sesion: SesionDelReloj?
    var otraVez: Bool
    var actividad: ActividadDelReloj?
    var deporte: String
    var hechos: [String: MarcaDelReloj] = [:]
    var saltados: [String: MarcaDelReloj] = [:]
    var extra: [String: Int] = [:]
    /// La pausa del entreno entero (Pausa en los controles): desde cuándo, y cuánto lleva en pausa en total (ms).
    var pausadoEn: Double?
    var pausas: Double = 0
    /// Los metros que llevaba el GPS cuando empezó el paso actual (un paso por distancia mide lo suyo desde ahí).
    var metrosAlEmpezarPaso: Double?
    var clavePasoConMetros: String?
    /// El pulso cada pocos segundos (`[segundo, latidos]`, desde `inicio`) y la ruta (`[segundo, lat, lon, alt, precisión]`).
    var pulso: [[Double]] = []
    var ruta: [[Double]] = []
    /// Los metros sumados con la ruta del GPS (solo con mapa): para las actividades a las que Salud no les mide distancia (patines, surf, kayak).
    var metrosDeLaRuta: Double = 0
    /// «gps» (actividad con mapa), «silencio» (sin mapa: solo la línea del sticker) o «no».
    var ubicacion: String
    var bateriaInicio: Double?
    /// Dónde está nadando (opcional: un `entreno.json` de antes se sigue leyendo).
    var natacion: NadoDelReloj?
    /// Cuándo empezó a contar cada paso con tiempo (regla 19: al tocar «Empezar», o solo tras un descanso con tiempo), en milisegundos DE ENTRENO
    /// (`transcurrido`): la pausa del entreno también lo detiene. Opcional: un `entreno.json` de antes se sigue leyendo.
    var empezados: [String: Double]?
    /// El resultado de cada Set con reloj, por su `claveFormato` (lo que el iPhone guarda en `formatos`).
    var formatos: [String: ResultadoDeSet]?

    // MARK: Los pasos

    var pasos: [PasoDelReloj] { sesion?.pasos ?? [] }
    var conPasos: Bool { modo == "sesion" && !pasos.isEmpty }

    private func nombreCorto(_ p: PasoDelReloj) -> String { String(p.n.prefix(40)) }

    /// La marca de un paso, o `nil` si no tiene (una marca de otro ejercicio en ese lugar no cuenta: el nombre no coincide).
    func marca(de p: PasoDelReloj) -> MarcaDelReloj? {
        let m = hechos[p.c] ?? saltados[p.c]
        guard let marca = m else { return nil }
        if !p.esDescanso, let n = marca.n, n != nombreCorto(p) { return nil }
        return marca
    }
    func hecho(_ p: PasoDelReloj) -> Bool { hechos[p.c] != nil && marca(de: p) != nil }

    /// El lugar del paso que toca (el primero sin marca), o `nil` si ya no queda ninguno.
    var indiceActual: Int? { pasos.firstIndex { marca(de: $0) == nil } }
    var actual: PasoDelReloj? { indiceActual.map { pasos[$0] } }
    /// El siguiente que no es descanso (para «Sigue: …»).
    var siguiente: PasoDelReloj? {
        guard let i = indiceActual else { return nil }
        return pasos[(i + 1)...].first { !$0.esDescanso }
    }

    /// Las series que hay que hacer (sin descansos ni lo opcional) y cuántas van hechas: el «Hiciste N de M series».
    var total: Int { pasos.filter { !$0.esDescanso && !$0.opcional }.count }
    var hechas: Int { pasos.filter { !$0.esDescanso && !$0.opcional && hecho($0) }.count }
    var algoMarcado: Bool { !hechos.filter { !$0.key.hasPrefix("d.") }.isEmpty }
    var completo: Bool { conPasos && indiceActual == nil }

    /// Los ejercicios distintos de la sesión y en cuál va: el «2/3» de arriba.
    var ejercicioActual: (numero: Int, de: Int)? {
        let idxs = pasos.filter { $0.t != "d" }.compactMap { $0.i }
        var vistos: [Int] = []
        for i in idxs where !vistos.contains(i) { vistos.append(i) }
        guard let a = actual ?? siguiente, let i = a.i, let lugar = vistos.firstIndex(of: i) else { return nil }
        return (lugar + 1, vistos.count)
    }

    /// Cuándo se marcó el paso anterior al actual (ahí empieza un descanso, o el tiempo de un paso), o el inicio.
    var desdeDelActual: Double {
        guard let i = indiceActual else { return inicio }
        var k = i - 1
        while k >= 0 {
            if let m = marca(de: pasos[k]) { return m.t }
            k -= 1
        }
        return inicio
    }

    // MARK: El descanso

    /// Lo que se sabe del descanso que toca: cuándo empezó, sus segundos (con lo que se le sumó) y cuándo acaba. `nil` si el paso actual no es un descanso.
    func descanso(ahora: Double) -> (paso: PasoDelReloj, desde: Double, seg: Int?, fin: Double?, restan: Int?)? {
        guard let p = actual, p.esDescanso else { return nil }
        let desde = desdeDelActual
        guard let base = p.seg else { return (p, desde, nil, nil, nil) }
        let seg = base + (extra[p.c] ?? 0)
        let fin = desde + Double(seg) * 1000
        let corte = pausadoEn ?? ahora
        let restan = Int(((fin - corte) / 1000).rounded(.up))
        return (p, desde, seg, pausadoEn == nil ? fin : nil, restan)
    }

    // MARK: Lo que se toca

    /// «Listo» en el paso que toca. `reps` y `kg` solo si la persona los cambió (`kg` en kilos). `seg`: lo que tardó (un paso por distancia).
    mutating func listo(reps: String? = nil, kg: String? = nil, seg: Int? = nil, en ahora: Double) {
        guard let i = indiceActual else { return }
        let p = pasos[i]
        if p.esDescanso {
            hechos[p.c] = MarcaDelReloj(t: ahora, n: nil, reps: nil, kg: nil, seg: nil, p: p.seg)
        } else {
            hechos[p.c] = MarcaDelReloj(t: ahora, n: nombreCorto(p), reps: reps, kg: kg, seg: seg, p: nil)
            saltados[p.c] = nil
        }
        metrosAlEmpezarPaso = nil
        clavePasoConMetros = nil
    }

    /// El descanso que llegó a cero: termina a su hora (no a la hora en que se vio), con lo que se planeó.
    mutating func terminaDescanso(en hora: Double) {
        guard let p = actual, p.esDescanso else { return }
        hechos[p.c] = MarcaDelReloj(t: hora, n: nil, reps: nil, kg: nil, seg: nil, p: p.seg)
        arrancaElQueSigue(en: hora)
    }

    // MARK: Lo que cuenta un tiempo (regla 19)

    /// Los milisegundos que lleva contando un paso (negativos durante el 3, 2, 1), o `nil` si todavía no empieza.
    func corrido(de p: PasoDelReloj, ahora: Double) -> Double? {
        guard let desde = empezados?[p.c] else { return nil }
        return transcurrido(ahora: ahora) - desde
    }

    /// «Empezar»: cuenta desde ya; con 3, 2, 1, tres segundos después (lo que va por marca arranca al instante).
    mutating func empieza(en ahora: Double) {
        guard let p = actual, p.conCuenta, empezados?[p.c] == nil else { return }
        var e = empezados ?? [:]
        e[p.c] = transcurrido(ahora: ahora) + (p.sinTresDosUno ? 0 : 3000)
        empezados = e
    }

    /// Regla 19: lo que cuenta un tiempo arranca SOLO cuando lo de antes acabó por tiempo (un descanso con cuenta, o un tramo que pasó solo). Sin 3, 2, 1.
    mutating func arrancaElQueSigue(en hora: Double) {
        guard let p = actual, p.conCuenta, empezados?[p.c] == nil else { return }
        var e = empezados ?? [:]
        e[p.c] = transcurrido(ahora: hora)
        empezados = e
    }

    /// Un paso por tiempo que llegó a su final: se marca a su hora (no a la hora en que se vio) y lo que sigue, si también cuenta, arranca solo.
    mutating func terminaPorTiempo(en hora: Double) {
        guard let p = actual, p.porTiempo else { return }
        listo(en: hora)
        arrancaElQueSigue(en: hora)
    }

    /// Guarda el resultado de un Set con reloj y lo marca hecho. `clave`: el Set del que es (si ya no es el que toca, no se guarda). `porTiempo`: acabó
    /// solo (regla 19: lo que sigue, si cuenta un tiempo, arranca solo).
    mutating func guardaSet(_ r: ResultadoDeSet?, clave: String, en hora: Double, porTiempo: Bool) {
        guard let p = actual, p.conRelojDeSet, p.c == clave else { return }
        if let r = r, r.anota != "nada" {
            var f = formatos ?? [:]
            f[p.claveFormato] = r
            formatos = f
        }
        listo(en: hora)
        if porTiempo { arrancaElQueSigue(en: hora) }
    }

    /// «+15 s» en el descanso que toca.
    mutating func masTiempo(_ seg: Int) {
        guard let p = actual, p.esDescanso, p.seg != nil else { return }
        extra[p.c] = (extra[p.c] ?? 0) + seg
    }

    /// «Saltar ejercicio»: lo que falta de este ejercicio queda saltado y se pasa al siguiente. Los descansos que venían justo después de una serie saltada
    /// se dan por hechos sin `p` (no se tomaron). En una bi-serie solo se salta ese ejercicio: el otro sigue con sus descansos.
    mutating func saltaEjercicio(en ahora: Double) {
        guard let i = indiceActual else { return }
        var k = i
        while k < pasos.count && pasos[k].esDescanso { k += 1 }
        guard k < pasos.count else { return }
        // Un paso sin ejercicio del plan (Deporte, la lista, un Set con reloj): se salta solo ese paso y el descanso que le sigue.
        guard pasos[k].t == "e", let idx = pasos[k].i else {
            saltados[pasos[k].c] = MarcaDelReloj(t: ahora, n: nombreCorto(pasos[k]), reps: nil, kg: nil, seg: nil, p: nil)
            var j = k + 1
            while j < pasos.count && pasos[j].esDescanso && marca(de: pasos[j]) == nil {
                hechos[pasos[j].c] = MarcaDelReloj(t: ahora, n: nil, reps: nil, kg: nil, seg: nil, p: nil)
                j += 1
            }
            for j in i..<k where marca(de: pasos[j]) == nil { hechos[pasos[j].c] = MarcaDelReloj(t: ahora, n: nil, reps: nil, kg: nil, seg: nil, p: nil) }
            metrosAlEmpezarPaso = nil
            clavePasoConMetros = nil
            return
        }
        for j in k..<pasos.count where !pasos[j].esDescanso && pasos[j].i == idx && marca(de: pasos[j]) == nil {
            saltados[pasos[j].c] = MarcaDelReloj(t: ahora, n: nombreCorto(pasos[j]), reps: nil, kg: nil, seg: nil, p: nil)
        }
        for j in i..<pasos.count where pasos[j].esDescanso && marca(de: pasos[j]) == nil {
            var antes = j - 1
            while antes >= 0 && pasos[antes].esDescanso { antes -= 1 }
            if antes >= 0, pasos[antes].i == idx, saltados[pasos[antes].c] != nil {
                hechos[pasos[j].c] = MarcaDelReloj(t: ahora, n: nil, reps: nil, kg: nil, seg: nil, p: nil)
            }
        }
        metrosAlEmpezarPaso = nil
        clavePasoConMetros = nil
    }

    /// «Deshacer el último Listo»: el último paso hecho (y los descansos que le siguieron) vuelve a estar pendiente, con lo que tuviera a medias.
    mutating func deshaz() {
        let tope = indiceActual ?? pasos.count
        var j = tope - 1
        while j >= 0 && pasos[j].esDescanso { j -= 1 }
        guard j >= 0 else { return }
        var k = j
        while k <= tope && k < pasos.count {
            let c = pasos[k].c
            hechos[c] = nil
            saltados[c] = nil
            extra[c] = nil
            empezados?[c] = nil
            if pasos[k].conRelojDeSet { formatos?[pasos[k].claveFormato] = nil }
            k += 1
        }
        metrosAlEmpezarPaso = nil
        clavePasoConMetros = nil
    }

    // MARK: El tiempo

    /// Milisegundos de entreno sin contar las pausas.
    func transcurrido(ahora: Double) -> Double {
        let hasta = pausadoEn ?? ahora
        return max(0, hasta - inicio - pausas)
    }

    mutating func pausa(en ahora: Double) {
        guard pausadoEn == nil else { return }
        pausadoEn = ahora
    }

    /// Reanudar: si se pausó en un descanso, el descanso se alarga lo que duró la pausa (igual que `pausaDescanso` del iPhone).
    mutating func reanuda(en ahora: Double) {
        guard let desde = pausadoEn else { return }
        let duro = max(0, ahora - desde)
        pausas += duro
        if let p = actual, p.esDescanso, p.seg != nil {
            extra[p.c] = (extra[p.c] ?? 0) + Int((duro / 1000).rounded())
        }
        pausadoEn = nil
    }

    // MARK: Lo que se guarda

    mutating func agregaPulso(_ bpm: Int, en fecha: Date) {
        let t = (fecha.timeIntervalSince1970 * 1000 - inicio) / 1000
        guard t >= 0, bpm > 30, bpm < 240 else { return }
        if let ultimo = pulso.last, t - ultimo[0] < 4 { return }
        pulso.append([t.rounded(), Double(bpm)])
        if pulso.count > 3000 { pulso = stride(from: 0, to: pulso.count, by: 2).map { pulso[$0] } }
    }

    mutating func agregaPunto(lat: Double, lon: Double, alt: Double?, precision: Double, en fecha: Date) {
        let t = (fecha.timeIntervalSince1970 * 1000 - inicio) / 1000
        guard t >= 0 else { return }
        if let ultimo = ruta.last, t - ultimo[0] < 2 { return }
        // Con mapa, los metros: solo entre puntos precisos y si de verdad se movió (el temblor de alguien parado no suma), y nunca en pausa.
        if ubicacion == "gps", pausadoEn == nil, precision <= 20, let ultimo = ruta.last, ultimo[4] <= 20 {
            let d = metrosEntre(ultimo[1], ultimo[2], lat, lon)
            if d >= 3 && d / max(1, t - ultimo[0]) < 15 { metrosDeLaRuta += d }
        }
        ruta.append([t.rounded(), (lat * 1e6).rounded() / 1e6, (lon * 1e6).rounded() / 1e6, alt.map { ($0 * 10).rounded() / 10 } ?? -1000, precision.rounded()])
        if ruta.count > 3000 { ruta = stride(from: 0, to: ruta.count, by: 2).map { ruta[$0] } }
    }

    /// El avance para el iPhone (`sesión.entreno`).
    func avance(fin: Double) -> AvanceDelReloj {
        AvanceDelReloj(v: 1, nombre: sesion?.nombre, inicio: inicio, fin: fin, hechos: hechos, saltados: saltados, extra: extra)
    }
}

/// Los largos de una alberca: los que contó el reloj (`eventos`, sus eventos de vuelta). Si Salud no dio eventos pero sí metros (los mide con el largo que se le dijo),
/// los metros entre el largo.
func largosDeAlberca(eventos: Int, metros: Double?, largo: Double) -> Int {
    if eventos > 0 { return eventos }
    guard let m = metros, m > 0, largo > 0 else { return 0 }
    return Int((m / largo).rounded())
}

/// Metros entre dos puntos (haversine), como `metrosEntrePuntos` de `src/lib/ubicacion.js`.
func metrosEntre(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let r = 6_371_000.0
    let f1 = lat1 * .pi / 180
    let f2 = lat2 * .pi / 180
    let df = (lat2 - lat1) * .pi / 180
    let dl = (lon2 - lon1) * .pi / 180
    let a = sin(df / 2) * sin(df / 2) + cos(f1) * cos(f2) * sin(dl / 2) * sin(dl / 2)
    return 2 * r * atan2(sqrt(a), sqrt(1 - a))
}

/// Reduce una lista a `max` elementos (uno de cada N, y siempre el último): lo que viaja al iPhone pesa poco.
func adelgaza(_ lista: [[Double]], a max: Int) -> [[Double]] {
    guard lista.count > max, max > 1 else { return lista }
    let paso = Int((Double(lista.count) / Double(max)).rounded(.up))
    var salida = stride(from: 0, to: lista.count, by: paso).map { lista[$0] }
    if let ultimo = lista.last, salida.last != ultimo { salida.append(ultimo) }
    return salida
}

/// La ruta para el iPhone, adelgazada. La altitud que no se sabe va como -1000 (el iPhone la ignora: `muestrasDe` en `relojSinTelefono.js`).
func rutaParaMandar(_ ruta: [[Double]], max: Int = 500) -> [[Double]] {
    adelgaza(ruta, a: max)
}


// MARK: - El reloj de un Set (AMRAP, EMOM, Tabata, «Por tiempo»…)

/// Un tramo del reloj de un Set, ya armado: lo mismo que `expande` del iPhone (por cada vuelta, por cada turno, cada paso).
struct TramoDelSet: Equatable {
    var seg: Int?
    var descanso: Bool
    var etiqueta: String?
    var vuelta: Int
    var ejercicio: Int?
}

extension FormatoDelReloj {
    var tramos: [TramoDelSet] {
        var salida: [TramoDelSet] = []
        let turnos = max(1, tu)
        for v in 1...max(1, vs) {
            for e in 0..<turnos {
                for paso in p {
                    if salida.count >= 400 { return salida }
                    salida.append(TramoDelSet(seg: paso.s, descanso: paso.k == "d", etiqueta: paso.e, vuelta: v, ejercicio: turnos > 1 ? e : nil))
                }
            }
        }
        return salida
    }
    /// Los tramos de trabajo (los «tramos completados» de lo que se anota).
    var deTrabajo: Int { tramos.filter { !$0.descanso }.count }
}

/// Dónde va el reloj de un Set a los `seg` segundos de empezar: el tramo, lo que le queda (o `nil` si cuenta hacia arriba) y si ya acabó.
struct VistaDelSet: Equatable {
    var i: Int
    var tramo: TramoDelSet?
    var restan: Int?
    var total: Int
    var terminado: Bool
}

func vistaDelSet(_ f: FormatoDelReloj, _ tramos: [TramoDelSet], seg: Double) -> VistaDelSet {
    let total = max(0, seg)
    if let tope = f.tope, total >= Double(tope) { return VistaDelSet(i: tramos.count, tramo: nil, restan: nil, total: tope, terminado: true) }
    var antes = 0.0
    for (i, t) in tramos.enumerated() {
        guard let s = t.seg else { return VistaDelSet(i: i, tramo: t, restan: nil, total: Int(total), terminado: false) }
        if total < antes + Double(s) {
            return VistaDelSet(i: i, tramo: t, restan: Int((antes + Double(s) - total).rounded(.up)), total: Int(total), terminado: false)
        }
        antes += Double(s)
    }
    return VistaDelSet(i: tramos.count, tramo: nil, restan: nil, total: Int(antes), terminado: true)
}

/// Lo que dice debajo del nombre, según el formato: lo mismo que `textoDeAvance` del iPhone (`RelojDelBloque.jsx`).
func avanceDelSet(_ f: FormatoDelReloj, _ v: VistaDelSet, de n: Int) -> String {
    guard let t = v.tramo else { return "" }
    switch f.id {
    case "emom": return "Intervalo \(v.i + 1) de \(n)"
    case "tabata", "intervalos": return f.vs > 1 ? "Ronda \(t.vuelta) de \(f.vs)" : ""
    case "fartlek": return f.vs > 1 ? "Tramo \(t.vuelta) de \(f.vs)" : ""
    case "portiempo", "amrap": return ""
    default: return n > 1 ? "Tramo \(v.i + 1) de \(n)" : ""
    }
}

// MARK: - Ritmo y zona: «Más rápido», «Vas bien», «Más despacio»

/// Cómo va contra lo que pidió el coach: `subir` (más rápido, más intenso), `bien` o `bajar` (más despacio, más suave).
enum EstadoDeMeta: String {
    case subir, bien, bajar
}

/// El ritmo (segundos por km) contra la meta `[rápido, lento]`, con 3 seg/km de holgura para que no cambie a cada paso.
func estadoDelRitmo(_ ritmo: Double?, meta: [Double]?) -> EstadoDeMeta? {
    guard let r = ritmo, let m = meta, let rapido = m.first else { return nil }
    let lento = m.count > 1 ? m[1] : rapido
    if r > lento + 3 { return .subir }
    if r < rapido - 3 { return .bajar }
    return .bien
}

/// El pulso contra los pulsos de la zona.
func estadoDelPulso(_ bpm: Int, rango: (lo: Int?, hi: Int?)?) -> EstadoDeMeta? {
    guard bpm > 0, let r = rango else { return nil }
    if let lo = r.lo, bpm < lo { return .subir }
    if let hi = r.hi, bpm > hi { return .bajar }
    return .bien
}

/// «4:41» de 281 segundos por km.
func ritmoDe(_ segPorKm: Double) -> String {
    let s = Int(segPorKm.rounded())
    return String(format: "%d:%02d", s / 60, s % 60)
}
