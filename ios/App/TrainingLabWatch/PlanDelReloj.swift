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

    var enLibras: Bool { unidad == "lb" }
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

    var esDescanso: Bool { t == "d" }
    var opcional: Bool { op == true }
    var porDistancia: Bool { tm?.por == "distancia" && (m ?? 0) > 0 }
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
