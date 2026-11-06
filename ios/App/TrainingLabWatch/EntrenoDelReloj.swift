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
        guard k < pasos.count, let idx = pasos[k].i else { return }
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
