import Foundation
import SwiftUI
import WatchConnectivity
import HealthKit
import WatchKit
import CoreLocation

/* EL RELOJ (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3). Dos maneras de entrenar:

   1. EL IPHONE GUÍA Y EL RELOJ ACOMPAÑA (como antes): el iPhone manda lo que toca (`envia` del plugin), el reloj mide el pulso, lo devuelve en vivo y deja tocar
      «Listo» en la muñeca. Al terminar, el reloj manda su pulso con `transferUserInfo` (modo «acompana»): le llega al entreno del iPhone.

   2. EL RELOJ SOLO (el iPhone en el carro): con el plan que le llegó (`PlanDelReloj`, por el contexto de WatchConnectivity, guardado en disco) entrena una sesión
      del plan o un entreno libre. Toda la lógica corre aquí (`EntrenoDelReloj.swift`) y se guarda en disco con cada serie. Al terminar se guarda en Salud con la
      marca de Training Lab y se manda al iPhone con `transferUserInfo`: Apple lo guarda y lo entrega aunque el iPhone esté lejos, apagado o con la app cerrada.
      Mientras tanto el reloj publica «tengo un entreno en curso» (su contexto): el iPhone lo dice y no deja empezar otro.

   El resultado se guarda en disco ANTES de mandarlo y se borra cuando WatchConnectivity dice que llegó: si la app se cierra en medio, se manda otra vez al
   abrirla (el iPhone no lo duplica: lo reconoce por su id). */

enum PantallaDelReloj: Equatable {
    case inicio
    case sesiones
    case detalle(String)
    case libres
    case catalogo
    case nadar
}

/// Lo que va a empezar en cuanto diga dónde nada: una actividad libre o una sesión del plan.
enum NadoPorEmpezar: Equatable {
    case libre(ActividadDelReloj)
    case sesion(SesionDelReloj, otraVez: Bool)
}

/// Lo que se cambió de la serie que toca antes de darle «Listo» (con + y −, o con la corona).
struct AjusteDelPaso: Equatable {
    var clave: String
    var reps: Double?
    var peso: Double?
}

/// La pantalla del final: el resumen y si ya llegó al iPhone.
struct FinDelReloj: Equatable {
    var id: String
    var modo: String
    var titulo: String
    var nombre: String?
    var segundos: Double
    var hechas: Int?
    var deSeries: Int?
    var metros: Double?
    var pulsoMedio: Int?
    var quien: String
    var conMapa: Bool
    /// Nadar en alberca: los largos y de cuánto es cada uno.
    var largos: Int?
    var largo: Double?
}

final class ModeloDelEntreno: NSObject, ObservableObject, WCSessionDelegate {
    /// Una sola instancia para toda la app: la usan las pantallas y el delegado que recibe el arranque desde el iPhone.
    static let compartido = ModeloDelEntreno()

    /// La marca que lleva cada entreno que este reloj guarda en Salud (ver `MARCA_DEL_RELOJ` en `relojSinTelefono.js`): así el iPhone no lo vuelve a traer de Salud.
    static let marcaDeSalud = "TrainingLab"
    /// Si el iPhone deja de avisar tanto tiempo mientras guía (se cerró la app, se apagó), el reloj cierra solo ese entreno para no gastar batería midiendo para nadie.
    private static let sinNoticiasMax: TimeInterval = 45 * 60
    /// El último largo de alberca que se eligió.
    private static let llaveDelLargo = "nadar.largo"

    // MARK: El plan

    @Published private(set) var plan: PlanDelReloj?
    @Published private(set) var planLlegoEn: Date?
    @Published var pantalla: PantallaDelReloj = .inicio
    /// Las sesiones que se terminaron en este reloj (id → día): salen con ✓ aunque el iPhone todavía no lo sepa.
    @Published private(set) var hechasAqui: [String: String] = [:]

    // MARK: El entreno del reloj (sin el iPhone)

    @Published private(set) var entreno: EntrenoGuardado?
    /// 0 = los controles (se llega deslizando a la derecha desde la serie, como la app Entreno de Apple), 1 = la serie.
    @Published var pagina = 1
    @Published var ajuste: AjusteDelPaso?
    @Published var ajustando = false
    @Published var confirmando = false
    @Published var fin: FinDelReloj?
    @Published private(set) var entregados: Set<String> = []
    @Published private(set) var subidos: Set<String> = []
    @Published private(set) var telefonoCerca = false
    @Published private(set) var metros: Double?
    private var vibroLaMeta: String?
    private var porNadar: NadoPorEmpezar?
    private var antesDeNadar: PantallaDelReloj = .inicio

    // MARK: Cuando el iPhone guía (como antes)

    @Published var activo = false
    @Published var titulo = "Training Lab"
    @Published var detalle = ""
    @Published var tipo = "trabajo"
    @Published var finMs: Double?
    @Published var inicioMs: Double?
    @Published var pulso = 0
    private var ultimaNoticia = Date()
    private var hapticoDe: Double?
    private var deporteGuiado = "otro"
    private var pulsoGuiado: [[Double]] = []

    let medidor = MedidorDelReloj()
    private var reloj: Timer?

    override init() {
        super.init()
        plan = DiscoDelReloj.lee(PlanDelReloj.self, de: "plan.json")
        if let ms = DiscoDelReloj.lee(Double.self, de: "plan-llego.json") { planLlegoEn = Date(timeIntervalSince1970: ms / 1000) }
        hechasAqui = DiscoDelReloj.lee([String: String].self, de: "hechas.json") ?? [:]
        // Volver al entreno: si había uno en curso (el reloj se apagó o se cerró la app), se retoma donde iba, con todo lo ya marcado.
        entreno = DiscoDelReloj.lee(EntrenoGuardado.self, de: "entreno.json")
        WKInterfaceDevice.current().isBatteryMonitoringEnabled = true
        medidor.alPulso = { [weak self] bpm, cuando in self?.llegaPulso(bpm, cuando) }
        medidor.alPunto = { [weak self] p in self?.llegaPunto(p) }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        reloj = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.cadaSegundo() }
        if entreno != nil { recuperaEntreno() }
    }

    // MARK: Lo que se ve en el inicio

    /// Las sesiones de hoy (las del plan que llegó, con ✓ las que se hicieron aquí o en el iPhone). `nil` si el plan de hoy no está en el reloj.
    var sesionesDeHoy: [SesionDelReloj]? {
        guard let plan = plan, let dia = plan.dia(claveDeHoy()) else { return nil }
        let hoy = claveDeHoy()
        return dia.sesiones.map { s in
            var x = s
            if hechasAqui[s.id] == hoy { x.hecha = true }
            return x
        }
    }
    var sinPlan: Bool { plan?.sinPlan == true }
    /// «Tus actividades» (las del iPhone); sin plan todavía, las de siempre.
    var actividades: [ActividadDelReloj] {
        let a = plan?.actividades ?? []
        return a.isEmpty ? ActividadDelReloj.basicas : a
    }
    var catalogo: [GrupoDelReloj] {
        let g = plan?.catalogo ?? []
        return g.isEmpty ? [GrupoDelReloj(grupo: "Actividades", actividades: ActividadDelReloj.basicas)] : g
    }
    func sesion(_ id: String) -> SesionDelReloj? { sesionesDeHoy?.first { $0.id == id } }

    // MARK: Empezar en el reloj

    private func bateria() -> Double? {
        let b = WKInterfaceDevice.current().batteryLevel
        return b >= 0 ? (Double(b) * 100).rounded() / 100 : nil
    }

    /// La ubicación que lleva el entreno: el GPS si tiene mapa; si no, la ubicación en silencio (solo con permiso del recorrido y con batería), o nada.
    private func ubicacionPara(gps: Bool) -> ModoDeUbicacion {
        if gps { return .gps }
        guard plan?.recorrido == true else { return .no }
        if ProcessInfo.processInfo.isLowPowerModeEnabled { return .no }
        if let b = bateria(), b < 0.3 { return .no }
        return .silencio
    }

    func empiezaSesion(_ s: SesionDelReloj, otraVez: Bool) {
        guard entreno == nil, !activo else { return }
        if s.deporte == "natacion" { preguntaDondeNada(.sesion(s, otraVez: otraVez)); return }
        arrancaSesion(s, otraVez: otraVez, nado: nil)
    }

    func empiezaLibre(_ a: ActividadDelReloj) {
        guard entreno == nil, !activo else { return }
        if a.preguntaDonde { preguntaDondeNada(.libre(a)); return }
        arrancaLibre(a, nado: nil)
    }

    private func arrancaSesion(_ s: SesionDelReloj, otraVez: Bool, nado: NadoDelReloj?) {
        let deporte = s.deporte ?? "fuerza"
        let gps = nado.map { !$0.esAlberca } ?? (["correr", "caminar", "bici", "senderismo"].contains(deporte) || s.pasos.contains { ($0.m ?? 0) >= 200 })
        let modo: ModoDeUbicacion = nado?.esAlberca == true ? .no : ubicacionPara(gps: gps)
        let e = EntrenoGuardado(id: UUID().uuidString, modo: "sesion", usuario: plan?.usuario, inicio: ahoraMs(), enLibras: plan?.enLibras ?? false, sesion: s,
                                otraVez: otraVez, actividad: nil, deporte: deporte, ubicacion: modo.rawValue, bateriaInicio: bateria(), natacion: nado)
        arranca(e, configuracion: configuracionDeApple(deporte: deporte, gps: gps, largoDeAlberca: nado?.largo), ubicacion: modo)
    }

    private func arrancaLibre(_ a: ActividadDelReloj, nado: NadoDelReloj?) {
        var actividad = a
        if let nado = nado { actividad.gps = !nado.esAlberca }
        let modo: ModoDeUbicacion = nado?.esAlberca == true ? .no : ubicacionPara(gps: actividad.gps)
        let e = EntrenoGuardado(id: UUID().uuidString, modo: "libre", usuario: plan?.usuario, inicio: ahoraMs(), enLibras: plan?.enLibras ?? false, sesion: nil,
                                otraVez: false, actividad: actividad, deporte: a.deporte, ubicacion: modo.rawValue, bateriaInicio: bateria(), natacion: nado)
        arranca(e, configuracion: configuracionDeApple(deporte: a.deporte, actividad: a.id, gps: actividad.gps, largoDeAlberca: nado?.largo), ubicacion: modo)
    }

    // MARK: Nadar: dónde

    private func preguntaDondeNada(_ que: NadoPorEmpezar) {
        porNadar = que
        antesDeNadar = pantalla
        pantalla = .nadar
    }

    /// El largo que sale elegido: el último que se usó; la primera vez, 25 m.
    var ultimoLargo: Double {
        let l = UserDefaults.standard.double(forKey: Self.llaveDelLargo)
        return l >= NadoDelReloj.largoMinimo && l <= NadoDelReloj.largoMaximo ? l : 25
    }

    func nadaEnAlberca(largo: Double) {
        let medido = min(NadoDelReloj.largoMaximo, max(NadoDelReloj.largoMinimo, largo.rounded()))
        UserDefaults.standard.set(medido, forKey: Self.llaveDelLargo)
        empiezaNado(.alberca(largo: medido))
    }

    func nadaEnAguasAbiertas() { empiezaNado(.aguasAbiertas) }

    func noNada() {
        porNadar = nil
        pantalla = antesDeNadar
    }

    private func empiezaNado(_ nado: NadoDelReloj) {
        guard let que = porNadar, entreno == nil, !activo else { return }
        porNadar = nil
        pantalla = antesDeNadar
        switch que {
        case .libre(let a): arrancaLibre(a, nado: nado)
        case .sesion(let s, let otraVez): arrancaSesion(s, otraVez: otraVez, nado: nado)
        }
    }

    private func arranca(_ e: EntrenoGuardado, configuracion: HKWorkoutConfiguration, ubicacion: ModoDeUbicacion) {
        entreno = e
        fin = nil
        ajuste = nil
        ajustando = false
        confirmando = false
        pagina = 1
        metros = nil
        guardaEntreno()
        publicaEstado()
        WKInterfaceDevice.current().play(.start)
        // Sin permiso de Salud el entreno sigue igual (las series se marcan y llegan al iPhone); solo no hay pulso.
        medidor.empieza(configuracion, ubicacion: ubicacion) { ok in if !ok { print("Reloj: el entreno sigue sin medir el pulso") } }
    }

    /// Volver al entreno después de que el reloj se apagó o la app se cerró: se engancha al entreno que Salud sigue midiendo (si sigue) y se queda donde iba.
    func recuperaEntreno() {
        guard let e = entreno else { return }
        medidor.recupera { [weak self] ok in
            guard ok else { return }
            self?.medidor.sigueUbicacion(ModoDeUbicacion(rawValue: e.ubicacion) ?? .no)
        }
    }

    // MARK: Lo que se toca durante el entreno

    private func cambia(_ hacer: (inout EntrenoGuardado) -> Void) {
        guard var e = entreno else { return }
        hacer(&e)
        entreno = e
        guardaEntreno()
    }

    /// Los metros del entreno: los que mide Salud; si Salud no mide distancia para esa actividad (patines, surf, kayak) y lleva mapa, los de la ruta.
    /// En alberca, los largos × su largo.
    private func metrosDe(_ e: EntrenoGuardado) -> Double? {
        if let n = e.natacion, n.esAlberca, let largo = n.largo {
            let largos = largosDeAlberca(eventos: medidor.eventosDeVuelta(), metros: medidor.metros(), largo: largo)
            return largos > 0 ? Double(largos) * largo : nil
        }
        if let m = medidor.metros() { return m }
        return e.ubicacion == ModoDeUbicacion.gps.rawValue && e.metrosDeLaRuta > 0 ? e.metrosDeLaRuta : nil
    }

    /// Los metros que lleva el paso que toca (un paso por distancia del plan, con el GPS del reloj).
    var metrosDelPaso: Double? {
        guard let e = entreno, let p = e.actual, p.porDistancia, e.clavePasoConMetros == p.c, let total = metros else { return nil }
        return max(0, total - (e.metrosAlEmpezarPaso ?? 0))
    }

    /// «Listo»: marca la serie (o el descanso) con lo que se cambió, y si era la última, termina.
    func listo() {
        guard let e = entreno, let p = e.actual else { return }
        let ahora = ahoraMs()
        var reps: String?
        var kg: String?
        var seg: Int?
        if !p.esDescanso {
            if let a = ajuste, a.clave == p.c {
                if let r = a.reps, r != (p.rv ?? -1) { reps = textoDeNumero(r) }
                if let k = a.peso, k != (p.pv ?? -1) { kg = textoDeNumero(aKilos(k, enLibras: e.enLibras)) }
            }
            // Un paso por distancia: lo que midió el GPS y lo que tardó (como el paso con GPS del iPhone).
            if p.porDistancia, let medido = metrosDelPaso, medido >= 10 {
                reps = p.u == "km" ? textoDeNumero(medido / 1000) : p.u == "yd" ? textoDeNumero((medido / 0.9144).rounded()) : textoDeNumero(medido.rounded())
                seg = Int(((ahora - e.desdeDelActual) / 1000).rounded())
            }
        }
        ajuste = nil
        cambia { $0.listo(reps: reps, kg: kg, seg: seg, en: ahora) }
        WKInterfaceDevice.current().play(.click)
        if entreno?.completo == true { termina() }
    }

    func saltaDescanso() {
        cambia { $0.listo(en: ahoraMs()) }
        if entreno?.completo == true { termina() }
    }
    func masQuince() { cambia { $0.masTiempo(15) } }
    func deshaz() {
        ajuste = nil
        cambia { $0.deshaz() }
        pagina = 1
    }
    func saltaEjercicio() {
        ajuste = nil
        cambia { $0.saltaEjercicio(en: ahoraMs()) }
        pagina = 1
        if entreno?.completo == true { termina() }
    }
    func pausaOSigue() {
        guard let e = entreno else { return }
        let ahora = ahoraMs()
        if e.pausadoEn == nil {
            cambia { $0.pausa(en: ahora) }
            medidor.pausa()
        } else {
            cambia { $0.reanuda(en: ahora) }
            medidor.reanuda()
        }
        pagina = 1
    }

    /// «Terminar» de los controles: una sesión del plan pregunta antes; un entreno libre termina de una vez.
    func pideTerminar() {
        guard let e = entreno else { return }
        if e.conPasos { confirmando = true } else { termina() }
    }

    /// Termina el entreno del reloj: lo guarda en Salud (con la marca de Training Lab), arma el resultado y lo manda al iPhone. Sin nada que guardar (una sesión
    /// sin ninguna serie marcada, o un entreno libre de menos de 30 s), se descarta.
    func termina() {
        guard let e = entreno else { return }
        confirmando = false
        ajustando = false
        ajuste = nil
        let ahora = ahoraMs()
        let segundos = e.transcurrido(ahora: ahora) / 1000
        let guardar = e.conPasos ? e.algoMarcado : segundos >= 30
        // Lo que midió Salud, antes de cerrar la sesión.
        let fcMedia = medidor.pulsoMedio()
        let fcMax = medidor.pulsoMaximo()
        let kcal = medidor.calorias()
        let metrosTotales = metrosDe(e)
        entreno = nil
        DiscoDelReloj.borra("entreno.json")
        publicaEstado()
        pagina = 1
        guard guardar else {
            medidor.termina(guardar: false, metadatos: [:]) { _ in }
            pantalla = .inicio
            return
        }
        WKInterfaceDevice.current().play(.stop)
        if let s = e.sesion {
            // Solo cuenta lo de hoy (mañana manda el plan que llegue): lo de otros días se quita.
            let hoy = claveDeHoy()
            hechasAqui = hechasAqui.filter { $0.value == hoy }
            hechasAqui[s.id] = hoy
            DiscoDelReloj.guarda(hechasAqui, en: "hechas.json")
        }
        let conMapa = e.ubicacion == ModoDeUbicacion.gps.rawValue
        let todas = e.conPasos && e.hechas >= e.total
        let largoDeAlberca = e.natacion?.esAlberca == true ? e.natacion?.largo : nil
        fin = FinDelReloj(
            id: e.id, modo: e.modo,
            titulo: e.modo == "libre" ? "\(e.actividad?.nombre ?? "Entreno"): guardado" : (todas || !e.conPasos ? "¡Terminaste!" : "Guardado"),
            nombre: e.sesion?.nombre, segundos: segundos, hechas: e.conPasos ? e.hechas : nil, deSeries: e.conPasos ? e.total : nil,
            metros: conMapa ? metrosTotales : nil, pulsoMedio: fcMedia, quien: e.sesion?.quien ?? "tu coach", conMapa: conMapa,
            largos: largoDeAlberca.map { largosDeAlberca(eventos: 0, metros: metrosTotales, largo: $0) }, largo: largoDeAlberca
        )
        var metadatos: [String: Any] = [Self.marcaDeSalud: "reloj", "TrainingLabId": e.id]
        if let n = e.natacion {
            let lugar: HKWorkoutSwimmingLocationType = n.esAlberca ? .pool : .openWater
            metadatos[HKMetadataKeySwimmingLocationType] = lugar.rawValue
            if let largo = n.largo { metadatos[HKMetadataKeyLapLength] = HKQuantity(unit: .meter(), doubleValue: largo) }
        }
        medidor.termina(guardar: true, metadatos: metadatos) { [weak self] w in
            guard let self = self else { return }
            let hk = w?.uuid.uuidString
            let id = hk ?? e.id
            let finMs = w.map { $0.endDate.timeIntervalSince1970 * 1000 } ?? ahora
            let nado = self.nadoAlTerminar(e, w, metrosAntes: metrosTotales)
            let distancia = nado == nil ? (conMapa ? metrosTotales : nil) : nado?.metros
            let r = ResultadoDelReloj(
                id: id, hk: hk, usuario: e.usuario ?? self.plan?.usuario, modo: e.modo, deporte: e.deporte,
                inicio: w.map { $0.startDate.timeIntervalSince1970 * 1000 } ?? e.inicio, fin: finMs, duracion: w?.duration ?? segundos,
                kcal: kcal, fcMedia: fcMedia, fcMax: fcMax, distancia: distancia,
                pulso: adelgaza(e.pulso, a: 720), ruta: e.ruta.count >= 2 ? rutaParaMandar(e.ruta) : nil,
                rutaSilenciosa: e.ubicacion == ModoDeUbicacion.silencio.rawValue ? true : nil,
                bateria: BateriaDelReloj(inicio: e.bateriaInicio, fin: self.bateria(), ubicacion: e.ubicacion),
                // De los pasos, solo los ejercicios: es lo que el iPhone necesita para anotar lo hecho como siempre (`exDataTrasListo`).
                sesion: e.sesion.map { s in
                    SesionHecha(almacen: s.almacen, llave: s.llave, nombre: s.nombre, de: s.de, otraVez: e.otraVez, entreno: e.avance(fin: finMs), pasos: s.pasos.filter { $0.t == "e" })
                },
                actividad: e.actividad,
                natacion: nado?.lugar
            )
            if self.fin?.id == e.id {
                self.fin?.id = id
                if let nado = nado {
                    self.fin?.metros = conMapa ? nado.metros : nil
                    self.fin?.largos = nado.lugar.largos
                }
            }
            self.manda(r)
        }
    }

    /// Nadar, ya cerrado el entreno: dónde fue, con sus largos, y los metros. Salud procesa la natación por tandas: lo que quedó en el `HKWorkout` es lo más completo.
    /// En alberca, los metros son los largos × su largo. `nil` si no se estaba nadando con la pregunta (otro deporte, o un entreno de antes de actualizar).
    private func nadoAlTerminar(_ e: EntrenoGuardado, _ w: HKWorkout?, metrosAntes: Double?) -> (lugar: NadoDelReloj, metros: Double?)? {
        guard var n = e.natacion else { return nil }
        let deSalud = w?.statistics(for: HKQuantityType(.distanceSwimming))?.sumQuantity()?.doubleValue(for: .meter()) ?? 0
        let metros = deSalud > 0 ? deSalud : metrosAntes
        guard n.esAlberca, let largo = n.largo else { return (n, metros) }
        let eventos = w?.workoutEvents?.filter { $0.type == .lap }.count ?? 0
        let largos = largosDeAlberca(eventos: eventos, metros: metros, largo: largo)
        n.largos = largos
        return (n, largos > 0 ? Double(largos) * largo : nil)
    }

    /// «Listo» en la pantalla del final: de vuelta al inicio (la sesión ya sale con ✓).
    func cierraFin() {
        fin = nil
        pantalla = .inicio
    }

    // MARK: Lo que pasa cada segundo

    private func cadaSegundo() {
        // Cuando el iPhone guía: sin noticias tanto tiempo, se cierra; y una vibración cuando se acaba el descanso o el tiempo del paso.
        if activo, Date().timeIntervalSince(ultimaNoticia) > Self.sinNoticiasMax { terminaGuiado(); return }
        if activo, let fin = finMs, Date().timeIntervalSince1970 * 1000 >= fin, hapticoDe != fin {
            hapticoDe = fin
            WKInterfaceDevice.current().play(.notification)
        }
        guard let e = entreno else { return }
        let m = metrosDe(e)
        if m != metros { metros = m }
        let ahora = ahoraMs()
        // Un descanso que llega a cero termina solo, a su hora, y vibra.
        if e.pausadoEn == nil, let d = e.descanso(ahora: ahora), let fin = d.fin, ahora >= fin {
            cambia { $0.terminaDescanso(en: fin) }
            WKInterfaceDevice.current().play(.notification)
            if entreno?.completo == true { termina() }
            return
        }
        // Un paso por distancia mide desde que empezó; al llegar a la meta, vibra (el «Listo» lo da la persona).
        if let p = e.actual, p.porDistancia {
            if e.clavePasoConMetros != p.c {
                let ahoraMetros = metros ?? 0
                cambia { $0.clavePasoConMetros = p.c; $0.metrosAlEmpezarPaso = ahoraMetros }
            } else if let hechos = metrosDelPaso, let meta = p.m, hechos >= meta, vibroLaMeta != p.c {
                vibroLaMeta = p.c
                WKInterfaceDevice.current().play(.notification)
            }
        }
    }

    private func llegaPulso(_ bpm: Int, _ cuando: Date) {
        pulso = bpm
        if activo {
            if let ini = medidor.inicio {
                let t = cuando.timeIntervalSince(ini)
                if t >= 0, (pulsoGuiado.last.map { t - $0[0] >= 4 } ?? true) { pulsoGuiado.append([t.rounded(), Double(bpm)]) }
            }
            if WCSession.default.activationState == .activated, WCSession.default.isReachable {
                WCSession.default.sendMessage(["pulso": bpm], replyHandler: nil, errorHandler: nil)
            }
            return
        }
        guard entreno != nil else { return }
        // En memoria con cada latido; en disco con cada serie (y cada 12 latidos), para no escribir el disco cada 5 segundos.
        entreno?.agregaPulso(bpm, en: cuando)
        if (entreno?.pulso.count ?? 0) % 12 == 0 { guardaEntreno() }
    }

    private func llegaPunto(_ p: CLLocation) {
        guard entreno != nil else { return }
        entreno?.agregaPunto(lat: p.coordinate.latitude, lon: p.coordinate.longitude, alt: p.verticalAccuracy >= 0 ? p.altitude : nil, precision: p.horizontalAccuracy, en: p.timestamp)
        if (entreno?.ruta.count ?? 0) % 30 == 0 { guardaEntreno() }
    }

    private func guardaEntreno() {
        if let e = entreno { DiscoDelReloj.guarda(e, en: "entreno.json") }
    }

    // MARK: Lo que manda el iPhone

    private func llegaContexto(_ contexto: [String: Any]) {
        if let texto = contexto["plan"] as? String, let datos = texto.data(using: .utf8), let nuevo = try? JSONDecoder().decode(PlanDelReloj.self, from: datos) {
            DispatchQueue.main.async { self.ponPlan(nuevo) }
        }
        // Lo que toca en un entreno que guía el iPhone, si es de hace poco (un contexto viejo no vuelve a arrancar nada).
        if let guiado = contexto["guiado"] as? [String: Any], let en = guiado["en"] as? Double, ahoraMs() - en < 2 * 60 * 1000 {
            recibeGuiado(guiado)
        }
    }

    private func ponPlan(_ nuevo: PlanDelReloj) {
        if plan?.enviadoEn != nuevo.enviadoEn || planLlegoEn == nil {
            planLlegoEn = Date()
            DiscoDelReloj.guarda(ahoraMs(), en: "plan-llego.json")
        }
        plan = nuevo
        DiscoDelReloj.guarda(nuevo, en: "plan.json")
    }

    private func recibeGuiado(_ datos: [String: Any]) {
        DispatchQueue.main.async {
            // Hay un entreno del reloj en curso: el reloj sigue mandando (el iPhone ya lo sabe y no deja empezar otro).
            if self.entreno != nil { return }
            self.ultimaNoticia = Date()
            let orden = datos["orden"] as? String ?? "estado"
            if orden == "fin" { self.terminaGuiado(); return }
            self.titulo = datos["titulo"] as? String ?? self.titulo
            self.detalle = datos["detalle"] as? String ?? ""
            self.tipo = datos["tipo"] as? String ?? "trabajo"
            self.finMs = datos["finMs"] as? Double
            self.inicioMs = datos["inicioMs"] as? Double
            if !self.activo {
                self.empiezaGuiado(configuracionDeApple(deporte: datos["deporte"] as? String ?? "otro", gps: ["correr", "caminar", "bici"].contains(datos["deporte"] as? String ?? "")),
                                   deporte: datos["deporte"] as? String ?? "otro")
            }
        }
    }

    /// El iPhone abrió la app del reloj para empezar un entreno (`HKHealthStore.startWatchApp`): se arranca con la configuración que mandó.
    func arrancaDesdeElTelefono(_ config: HKWorkoutConfiguration) {
        DispatchQueue.main.async {
            guard self.entreno == nil else { return }
            self.ultimaNoticia = Date()
            self.empiezaGuiado(config, deporte: self.deporteDe(config.activityType))
        }
    }

    private func deporteDe(_ tipo: HKWorkoutActivityType) -> String {
        switch tipo {
        case .running: return "correr"
        case .walking: return "caminar"
        case .cycling: return "bici"
        case .swimming: return "natacion"
        case .rowing: return "remo"
        case .traditionalStrengthTraining: return "fuerza"
        case .highIntensityIntervalTraining: return "hiit"
        case .yoga: return "yoga"
        case .functionalStrengthTraining: return "funcional"
        default: return "otro"
        }
    }

    private func empiezaGuiado(_ config: HKWorkoutConfiguration, deporte: String) {
        activo = true
        deporteGuiado = deporte
        pulsoGuiado = []
        if !medidor.midiendo { medidor.empieza(config, ubicacion: .no) { _ in } }
    }

    /// El iPhone terminó (o dejó de avisar): el reloj deja de medir, guarda el entreno en Salud y le manda su pulso al iPhone (le llega a su entreno).
    private func terminaGuiado() {
        let fcMedia = medidor.pulsoMedio()
        let fcMax = medidor.pulsoMaximo()
        let kcal = medidor.calorias()
        let metrosTotales = medidor.metros()
        let pulsoDelEntreno = pulsoGuiado
        let deporte = deporteGuiado
        activo = false
        pulso = 0
        finMs = nil
        inicioMs = nil
        titulo = "Training Lab"
        detalle = ""
        pulsoGuiado = []
        guard medidor.midiendo else { return }
        medidor.termina(guardar: true, metadatos: [Self.marcaDeSalud: "acompana"]) { [weak self] w in
            guard let self = self, let w = w else { return }
            let r = ResultadoDelReloj(
                id: w.uuid.uuidString, hk: w.uuid.uuidString, usuario: self.plan?.usuario, modo: "acompana", deporte: deporte,
                inicio: w.startDate.timeIntervalSince1970 * 1000, fin: w.endDate.timeIntervalSince1970 * 1000, duracion: w.duration,
                kcal: kcal, fcMedia: fcMedia, fcMax: fcMax, distancia: metrosTotales, pulso: adelgaza(pulsoDelEntreno, a: 720), ruta: nil,
                rutaSilenciosa: nil, bateria: nil, sesion: nil, actividad: nil
            )
            self.manda(r)
        }
    }

    /// Le avisa al iPhone qué se tocó en el reloj («listo», «siguiente») cuando el iPhone guía.
    func enviaAccion(_ accion: String) {
        guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["accion": accion], replyHandler: nil, errorHandler: nil)
    }

    // MARK: Al iPhone

    /// Manda un entreno terminado. Primero al disco (si la app se cierra, se manda al abrirla); luego con `transferUserInfo`.
    private func manda(_ r: ResultadoDelReloj) {
        guard let datos = try? JSONEncoder().encode(r), let texto = String(data: datos, encoding: .utf8) else { return }
        DiscoDelReloj.guardaPorMandar(texto, id: r.id)
        transfiere(id: r.id, texto: texto)
    }

    private func transfiere(id: String, texto: String) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        WCSession.default.transferUserInfo(["id": id, "resultado": texto])
    }

    /// Lo que quedó en el disco sin llegar (la app se cerró, o falló): se manda otra vez, salvo lo que WatchConnectivity ya lleva en camino.
    private func reenviaLoPendiente() {
        let enCamino = Set(WCSession.default.outstandingUserInfoTransfers.compactMap { $0.userInfo["id"] as? String })
        for (id, texto) in DiscoDelReloj.todosPorMandar() where !enCamino.contains(id) {
            transfiere(id: id, texto: texto)
        }
    }

    /// «Tengo un entreno en curso» (o ya no): el iPhone lo dice y no deja empezar otro. Va en el contexto del reloj (lo último que se sabe).
    private func publicaEstado() {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        var estado: [String: Any] = ["en": ahoraMs()]
        if let e = entreno {
            estado["enCurso"] = ["id": e.id, "titulo": e.sesion?.nombre ?? e.actividad?.nombre ?? "Entreno", "modo": e.modo, "sesion": e.sesion?.id ?? "", "desde": e.inicio]
        }
        guard let datos = try? JSONSerialization.data(withJSONObject: estado), let texto = String(data: datos, encoding: .utf8) else { return }
        try? WCSession.default.updateApplicationContext(["estado": texto])
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        llegaContexto(session.receivedApplicationContext)
        DispatchQueue.main.async {
            self.telefonoCerca = session.isReachable
            self.reenviaLoPendiente()
            self.publicaEstado()
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.telefonoCerca = session.isReachable }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        llegaContexto(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let id = message["subido"] as? String {
            DispatchQueue.main.async { self.subidos.insert(id) }
            return
        }
        if message["orden"] != nil || message["titulo"] != nil { recibeGuiado(message) }
    }

    func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
        guard let id = userInfoTransfer.userInfo["id"] as? String else { return }
        if let error = error {
            print("Reloj: no llegó al iPhone (se intenta al volver a abrir): \(error.localizedDescription)")
            return
        }
        DiscoDelReloj.borraPorMandar(id)
        DispatchQueue.main.async { self.entregados.insert(id) }
    }
}
