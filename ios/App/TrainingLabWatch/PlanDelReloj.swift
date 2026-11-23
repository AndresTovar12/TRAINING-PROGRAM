import Foundation
import SwiftUI

/* EL PLAN EN EL RELOJ Y LO QUE EL RELOJ DEVUELVE (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3).

   El iPhone arma el plan (`src/lib/relojSinTelefono.js` → `planParaElReloj`) y lo manda por el contexto de WatchConnectivity (`updateApplicationContext`), que
   llega aunque el reloj esté dormido. El reloj lo guarda en disco: como trae hoy y los dos días siguientes, si el iPhone no se abrió esta mañana, el plan de
   hoy ya llegó ayer. Las llaves son cortas a propósito (todo viaja en ese contexto) y son las mismas del archivo de JavaScript.

   Lo que el reloj devuelve al terminar (`ResultadoDelReloj`) va con `transferUserInfo` y el iPhone lo lee con `leeResultado`. Las marcas tienen la MISMA forma
   que el avance del iPhone (`sesión.entreno` de `src/lib/entreno.js`): horas en milisegundos, `n` el nombre, `reps`/`kg` solo si se cambió (`kg` siempre en
   kilos) y un descanso con `p` (lo que se planeó). Así lo hecho en el reloj se junta con lo del iPhone sin traducir nada. */

/// Lo que manda el iPhone.
struct PlanDelReloj: Codable {
    var v: Int
    var usuario: String?
    var enviadoEn: Double?
    var unidad: String?
    var sinPlan: Bool?
    var recorrido: Bool?
    var dias: [DiaDelReloj]?
    var actividades: [ActividadDelReloj]?
    var catalogo: [GrupoDelReloj]?
    /// Los pulsos que separan las zonas (`[z1→z2, z2→z3, z3→z4, z4→z5]`, `limitesDeZonas` del iPhone), si se sabe su pulso máximo.
    var zonas: [Int]?

    var enLibras: Bool { unidad == "lb" }

    /// Los pulsos de una zona o de un rango de zonas («Zona 2», «Zona 2-3»): `lo` y `hi` (la zona 1 no tiene piso; la 5, techo). `nil` sin las zonas.
    func rangoDeZona(_ zn: [Int]?) -> (lo: Int?, hi: Int?)? {
        guard let l = zonas, l.count == 4, let z = zn, let a = z.first, a >= 1, a <= 5 else { return nil }
        let b = min(5, max(a, z.count > 1 ? z[1] : a))
        let lo: Int? = a <= 1 ? nil : l[a - 2]
        let hi: Int? = b >= 5 ? nil : l[b - 1]
        return (lo: lo, hi: hi)
    }
    func dia(_ fecha: String) -> DiaDelReloj? { (dias ?? []).first { $0.fecha == fecha } }
}

struct DiaDelReloj: Codable {
    var fecha: String
    var sesiones: [SesionDelReloj]
}

/// Una sesión del día: de quién es, su color, sus minutos y sus pasos (los de `pasosDeLaSesion` del iPhone).
struct SesionDelReloj: Codable, Identifiable, Hashable {
    var id: String
    var almacen: String
    var llave: String
    var nombre: String
    var de: String?
    var rol: String?
    var color: String?
    var min: Int?
    var deporte: String?
    var hecha: Bool
    var ejercicios: Int?
    var pasos: [PasoDelReloj]

    /// «de Carlos», «de Laura, fisio».
    var deQuien: String? {
        guard let de = de, !de.isEmpty else { return rol == "fisio" ? "de tu fisio" : nil }
        return rol == "fisio" ? "de \(de), fisio" : "de \(de)"
    }
    /// Quien lo ve: «Carlos», o «tu coach» si no se sabe su nombre.
    var quien: String {
        if let de = de, !de.isEmpty { return de }
        return rol == "fisio" ? "tu fisio" : "tu coach"
    }
}

/// Cómo termina un paso (lo que el iPhone necesita para anotar lo hecho como siempre).
struct TerminaDelReloj: Codable, Hashable {
    var por: String?
    var cantidad: String?
    var unidad: String?
    var valor: Double?
    var min: Double?
}

/// En qué vas, lo mismo que el teléfono (`cuentaDelPaso`): «Serie 1 de 3», «Sprint 2 de 4», «Tramo 3 de 8». `x`: lo de al lado («serie 1 de 3»).
struct EnQueVaDelReloj: Codable, Hashable {
    var r: String
    var n: Int
    var de: Int
    var x: String?

    var texto: String { "\(r) \(n) de \(de)" }
}

/// Un paso del reloj de un Set: sus segundos (`nil`: hasta «Terminé»), trabajo («t») o descanso («d») y su nombre si el coach le puso uno.
struct PasoDelFormato: Codable, Hashable {
    var s: Int?
    var k: String
    var e: String?
}

/// El reloj de un Set (AMRAP, EMOM, Tabata, «Por tiempo»…), como lo manda el iPhone (`formatoParaElReloj`): el reloj lo arma igual que `expande`.
struct FormatoDelReloj: Codable, Hashable {
    var id: String
    /// Lo que se anota al acabar: «rondas», «tiempo», «reps», «km», «m», «cal», «cumplido» o «nada».
    var an: String
    var p: [PasoDelFormato]
    var vs: Int
    var tu: Int
    var tope: Int?
    /// Lo que se hace, un renglón por ejercicio («20 Wall balls»).
    var l: [String]
}

/// Lo que se anota de un Set con reloj: lo mismo que guarda el iPhone en `formatos` (`limpiaResultado`). `extra`: las reps sueltas de un AMRAP.
struct ResultadoDeSet: Codable, Hashable {
    var anota: String
    var valor: Double?
    var extra: Double?
    var seg: Int?
    /// De cuántos tramos de trabajo («tramos completados»: 6 de 8).
    var de: Int?
}

/// Un paso: `t` es «e» ejercicio, «d» descanso, «r» un Set con reloj (AMRAP, EMOM…) y «n» una nota. Ver `pasoParaElReloj` en JavaScript.
struct PasoDelReloj: Codable, Hashable {
    var c: String
    var t: String
    var n: String
    var i: Int?
    var v: Int?
    var vs: Int?
    var op: Bool?
    var lp: Int?
    var s: Int?
    var tm: TerminaDelReloj?
    var reps: String?
    var u: String?
    var rv: Double?
    var kg: String?
    var pv: Double?
    var aprox: Bool?
    var peso: Bool?
    var lado: Bool?
    var seg: Int?
    var texto: String?
    var m: Double?
    /// Los metros NO se miden con el GPS (un sprint corto, una máquina, la alberca): se enseñan y se toca «Listo».
    var sg: Bool?
    var en: EnQueVaDelReloj?
    /// La cantidad escrita (Deporte, la lista: «10 m») y lo que va con ella («en 4 seg»).
    var tx: String?
    var sub: String?
    /// El límite en segundos («20 reps en menos de 60 seg»).
    var lim: Int?
    /// El ritmo meta `[rápido, lento]` en segundos por km, y la zona del pulso `[de, a]` (1 a 5).
    var rit: [Double]?
    var zn: [Int]?
    /// La meta que el reloj no mide, en texto («Al máximo», «240–260 W»).
    var mt: String?
    /// Una clase: el video se queda en el iPhone; el reloj cuenta su tiempo.
    var cl: Bool?
    /// El reloj de un Set y su `claveFormato` (donde va su resultado).
    var f: FormatoDelReloj?
    var cf: String?

    var esDescanso: Bool { t == "d" }
    var opcional: Bool { op == true }
    var porDistancia: Bool { tm?.por == "distancia" && (m ?? 0) > 0 }
    /// Va por tiempo (una plancha, un tramo de bici, una clase): cuenta sola y pasa sola al acabar.
    var porTiempo: Bool { t == "e" && tm?.por == "tiempo" && (seg ?? 0) > 0 }
    var conLimite: Bool { t == "e" && (lim ?? 0) > 0 }
    var conRelojDeSet: Bool { t == "r" && f != nil }
    /// Lo que cuenta un tiempo: espera «Empezar» (o arranca solo tras un descanso con tiempo, regla 19).
    var conCuenta: Bool { porTiempo || conLimite || conRelojDeSet }
    /// Arranca al tocar, sin 3, 2, 1: lo que va por marca (un límite, un «Por tiempo»).
    var sinTresDosUno: Bool { conLimite || (conRelojDeSet && (f?.p.contains { $0.s == nil } ?? false)) }
    /// Dónde va su resultado (`formatos` del iPhone).
    var claveFormato: String { (cf?.isEmpty == false ? cf : nil) ?? String(i ?? 0) }
    /// «Serie 1 de 3», «Sprint 2 de 4»: lo mismo que el teléfono.
    var cuenta: String? {
        if let e = en { return e.texto }
        if let total = vs, total > 1 { return "Serie \(v ?? 1) de \(total)" }
        return nil
    }
    /// Una distancia que no se mide (se enseña tal cual, no se cambia).
    var distanciaFija: Bool { !porDistancia && ["m", "km", "yd", "mi"].contains(u ?? "") }
}

/// Una actividad del entreno libre (del catálogo o creada por la persona en el iPhone).
struct ActividadDelReloj: Codable, Hashable, Identifiable {
    var id: String
    var nombre: String
    var icono: String?
    var color: String?
    var gps: Bool
    var deporte: String
    var propia: Bool?

    /// Nadar: el reloj pregunta dónde, y de eso depende si lleva mapa (`gps` queda como se eligió al empezar).
    var preguntaDonde: Bool { deporte == "natacion" }

    /// Las de siempre, para un reloj al que todavía no le llega nada del iPhone: el entreno libre funciona igual.
    static let basicas: [ActividadDelReloj] = [
        ActividadDelReloj(id: "correr", nombre: "Correr", icono: "correr", color: "#F2555A", gps: true, deporte: "correr", propia: nil),
        ActividadDelReloj(id: "caminar", nombre: "Caminar", icono: "caminar", color: "#F2555A", gps: true, deporte: "caminar", propia: nil),
        ActividadDelReloj(id: "bici", nombre: "Bici", icono: "bici", color: "#00B3C7", gps: true, deporte: "bici", propia: nil),
        ActividadDelReloj(id: "natacion", nombre: "Nadar", icono: "nadar", color: "#3AA0F5", gps: true, deporte: "natacion", propia: nil),
        ActividadDelReloj(id: "fuerza", nombre: "Gimnasio", icono: "pesa", color: "#A480FF", gps: false, deporte: "fuerza", propia: nil),
        ActividadDelReloj(id: "padel", nombre: "Pádel", icono: "tenis", color: "#F0A81F", gps: false, deporte: "raqueta", propia: nil),
        ActividadDelReloj(id: "yoga", nombre: "Yoga", icono: "yoga", color: "#C084FC", gps: false, deporte: "yoga", propia: nil),
    ]
}

struct GrupoDelReloj: Codable, Hashable {
    var grupo: String
    var actividades: [ActividadDelReloj]
}

/* ---- Lo que el reloj devuelve ---- */

/// Una marca del avance (la misma forma que en el iPhone).
struct MarcaDelReloj: Codable, Hashable {
    var t: Double
    var n: String?
    var reps: String?
    var kg: String?
    var seg: Int?
    var p: Int?
}

/// El avance de una sesión del plan, como `sesión.entreno` del iPhone.
struct AvanceDelReloj: Codable {
    var v: Int = 1
    var nombre: String?
    var inicio: Double
    var fin: Double?
    var hechos: [String: MarcaDelReloj]
    var saltados: [String: MarcaDelReloj]
    var extra: [String: Int]
}

/// Lo que se hizo de una sesión del plan, con sus pasos tal como los tenía el reloj (si el plan cambió mientras, este entreno termina con su versión).
struct SesionHecha: Codable {
    var almacen: String
    var llave: String
    var nombre: String
    var de: String?
    var otraVez: Bool
    var entreno: AvanceDelReloj
    var pasos: [PasoDelReloj]
    /// El resultado de cada Set con reloj, por su `claveFormato` (el iPhone lo pone en `formatos`, como si se hubiera anotado ahí).
    var formatos: [String: ResultadoDeSet]?
}

/// Cuánta batería tenía el reloj al empezar y al terminar (0 a 1), y con qué ubicación: para medir lo que gasta la ubicación en silencio.
struct BateriaDelReloj: Codable {
    var inicio: Double?
    var fin: Double?
    var ubicacion: String
}

/// Dónde se nadó (6 nov 2026, `docs/superpowers/specs/2026-11-06-nadar-en-el-reloj.md`). Viaja en `ResultadoDelReloj.natacion` y el iPhone lo lee con `natacionDe`:
/// `{ lugar: "alberca", largo, largos }` o `{ lugar: "aguas-abiertas" }`. Es opcional: lo de antes, sin esto, se sigue leyendo igual.
struct NadoDelReloj: Codable, Equatable {
    /// Lo que se puede elegir con la corona, en metros (`LARGO_MINIMO` y `LARGO_MAXIMO` en `relojSinTelefono.js`).
    static let largoMinimo = 10.0
    static let largoMaximo = 100.0

    var lugar: String
    var largo: Double?
    var largos: Int?

    static func alberca(largo: Double) -> NadoDelReloj { NadoDelReloj(lugar: "alberca", largo: largo) }
    static let aguasAbiertas = NadoDelReloj(lugar: "aguas-abiertas")

    var esAlberca: Bool { lugar == "alberca" }
}

/// Un entreno terminado en el reloj. `id`: el UUID del `HKWorkout` que se guardó en Salud (o uno propio si Salud no lo guardó).
struct ResultadoDelReloj: Codable {
    var v: Int = 1
    var id: String
    var hk: String?
    var usuario: String?
    var modo: String
    var deporte: String?
    var inicio: Double
    var fin: Double
    var duracion: Double
    var kcal: Double?
    var fcMedia: Int?
    var fcMax: Int?
    var distancia: Double?
    var pulso: [[Double]]
    var ruta: [[Double]]?
    var rutaSilenciosa: Bool?
    var bateria: BateriaDelReloj?
    var sesion: SesionHecha?
    var actividad: ActividadDelReloj?
    var natacion: NadoDelReloj?
}

/* ---- El disco del reloj ---- */

/// Los archivos del reloj, en «Application Support»: el plan, el entreno en curso y lo que falta mandar al iPhone. Cada archivo se escribe entero o no se escribe.
enum DiscoDelReloj {
    static var carpeta: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? FileManager.default.temporaryDirectory
        let url = base.appendingPathComponent("TrainingLab", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    static var porMandar: URL {
        let url = carpeta.appendingPathComponent("por-mandar", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func guarda<T: Encodable>(_ valor: T, en nombre: String) {
        guard let datos = try? JSONEncoder().encode(valor) else { return }
        try? datos.write(to: carpeta.appendingPathComponent(nombre), options: .atomic)
    }
    static func lee<T: Decodable>(_ tipo: T.Type, de nombre: String) -> T? {
        guard let datos = try? Data(contentsOf: carpeta.appendingPathComponent(nombre)) else { return nil }
        return try? JSONDecoder().decode(tipo, from: datos)
    }
    static func borra(_ nombre: String) {
        try? FileManager.default.removeItem(at: carpeta.appendingPathComponent(nombre))
    }

    /// Un resultado que todavía no confirma el iPhone: se guarda ANTES de mandarlo, y se borra cuando WatchConnectivity dice que llegó.
    static func guardaPorMandar(_ texto: String, id: String) {
        try? Data(texto.utf8).write(to: porMandar.appendingPathComponent("\(id).json"), options: .atomic)
    }
    static func borraPorMandar(_ id: String) {
        try? FileManager.default.removeItem(at: porMandar.appendingPathComponent("\(id).json"))
    }
    static func todosPorMandar() -> [(id: String, texto: String)] {
        let archivos = (try? FileManager.default.contentsOfDirectory(at: porMandar, includingPropertiesForKeys: nil)) ?? []
        return archivos.compactMap { url in
            guard url.pathExtension == "json", let datos = try? Data(contentsOf: url), let texto = String(data: datos, encoding: .utf8) else { return nil }
            return (id: url.deletingPathExtension().lastPathComponent, texto: texto)
        }
    }
}

/* ---- Pequeñeces ---- */

/// La hora de ahora en milisegundos de época (como `Date.now()` en el iPhone).
func ahoraMs() -> Double { Date().timeIntervalSince1970 * 1000 }

/// La fecha de hoy en el reloj, «AAAA-MM-DD» (la misma clave con la que el iPhone manda cada día).
func claveDeHoy(_ fecha: Date = Date()) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: fecha)
}

/// Un número como lo escribe JavaScript (`String(77.5)` = «77.5», `String(60)` = «60»), con dos decimales como mucho.
func textoDeNumero(_ x: Double) -> String {
    let r = (x * 100).rounded() / 100
    if r == r.rounded() { return String(Int(r)) }
    var s = String(format: "%.2f", r)
    while s.hasSuffix("0") { s.removeLast() }
    if s.hasSuffix(".") { s.removeLast() }
    return s
}

/// Los kilos de un peso escrito en la unidad del atleta (como `aKilos` del iPhone: dos decimales).
func aKilos(_ valor: Double, enLibras: Bool) -> Double {
    enLibras ? (valor / 2.2046226218 * 100).rounded() / 100 : (valor * 100).rounded() / 100
}

extension Color {
    /// «#1E40E0» → el color. Uno que no se entiende queda en el azul de la app.
    init(hex: String?) {
        var t = (hex ?? "").trimmingCharacters(in: .whitespaces)
        if t.hasPrefix("#") { t.removeFirst() }
        guard t.count == 6, let n = UInt32(t, radix: 16) else {
            self = Color(red: 0.24, green: 0.39, blue: 1.0)
            return
        }
        self = Color(red: Double((n >> 16) & 0xFF) / 255, green: Double((n >> 8) & 0xFF) / 255, blue: Double(n & 0xFF) / 255)
    }
}

/// Los colores del reloj (los de la maqueta): azul de la app, verde de «Listo», rojo del pulso y de «Terminar», ámbar del tiempo y de la pausa.
enum ColorDelReloj {
    static let azul = Color(red: 0.24, green: 0.39, blue: 1.0)
    static let verde = Color(red: 0.20, green: 0.78, blue: 0.55)
    static let rojo = Color(red: 1.0, green: 0.35, blue: 0.37)
    static let ambar = Color(red: 0.96, green: 0.65, blue: 0.14)
    static let tarjeta = Color(red: 0.11, green: 0.11, blue: 0.13)
    static let gris = Color(red: 0.16, green: 0.17, blue: 0.19)
    static let tenue = Color(red: 0.60, green: 0.60, blue: 0.64)
}
