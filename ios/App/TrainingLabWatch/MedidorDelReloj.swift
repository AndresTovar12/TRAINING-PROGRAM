import Foundation
import HealthKit
import CoreLocation
import WatchKit

/* LO QUE MIDE EL RELOJ (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3.3): el entreno en Apple Salud (`HKWorkoutSession` y `HKLiveWorkoutBuilder`,
   los mismos de antes), el pulso en vivo, las calorías, la distancia y la ubicación. Lo usan los dos modos del reloj: cuando el iPhone guía (el reloj acompaña) y
   cuando el reloj entrena solo.

   LA UBICACIÓN, de dos maneras:
     · «gps»: una actividad con mapa (correr, caminar, bici, senderismo). GPS del reloj en precisión alta; la ruta se guarda en Salud con `HKWorkoutRouteBuilder`.
     · «silencio»: sin mapa (pádel, gimnasio, una sesión de fuerza). La de `docs/stickers.md`, sección 8b: precisión BAJA (unos 100 m) hasta que hay movimiento de
       verdad (se alejó más de 80 m del primer punto, o va a más de 1.2 m/s); entonces alta; tras 3 min quieto, baja otra vez. Solo sirve para la línea del sticker:
       nunca se vuelve distancia ni ritmo, y NO se guarda en Salud. Solo si la persona dijo que sí a «¿Guardamos tu recorrido?» en su iPhone, y nunca con la
       batería baja (menos de 30 %) ni en modo de bajo consumo: ahí no se guarda y no hay línea. */

enum ModoDeUbicacion: String {
    case gps, silencio, no
}

final class MedidorDelReloj: NSObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate, CLLocationManagerDelegate {
    let almacen = HKHealthStore()
    private(set) var sesion: HKWorkoutSession?
    private(set) var constructor: HKLiveWorkoutBuilder?
    private var rutaEnSalud: HKWorkoutRouteBuilder?
    private var ubicacion: CLLocationManager?
    private(set) var modoDeUbicacion: ModoDeUbicacion = .no
    private var alTerminar: ((Date) -> Void)?

    // Lo que va llegando (siempre en el hilo principal).
    var alPulso: ((Int, Date) -> Void)?
    var alPunto: ((CLLocation) -> Void)?

    var midiendo: Bool { sesion != nil }
    var inicio: Date? { constructor?.startDate }

    // MARK: El permiso

    private var tiposDeEscribir: Set<HKSampleType> {
        [HKObjectType.workoutType(), HKSeriesType.workoutRoute(), HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned),
         HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling), HKQuantityType(.distanceSwimming)]
    }
    // Para la ruta, Apple pide leer y escribir los entrenos y sus rutas («Creating a workout route»).
    private var tiposDeLeer: Set<HKObjectType> {
        [HKObjectType.workoutType(), HKSeriesType.workoutRoute(), HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned),
         HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling), HKQuantityType(.distanceSwimming)]
    }

    // MARK: Empezar, pausar, terminar

    /// Empieza a medir con esta configuración. `listo(true)` cuando ya corre; `false` si no se pudo (sin permiso de Salud o con otro entreno midiéndose).
    func empieza(_ config: HKWorkoutConfiguration, ubicacion modo: ModoDeUbicacion, listo: @escaping (Bool) -> Void) {
        guard sesion == nil else { listo(false); return }
        almacen.requestAuthorization(toShare: tiposDeEscribir, read: tiposDeLeer) { _, _ in
            DispatchQueue.main.async {
                guard self.sesion == nil else { listo(false); return }
                do {
                    let s = try HKWorkoutSession(healthStore: self.almacen, configuration: config)
                    let c = s.associatedWorkoutBuilder()
                    c.dataSource = HKLiveWorkoutDataSource(healthStore: self.almacen, workoutConfiguration: config)
                    s.delegate = self
                    c.delegate = self
                    self.sesion = s
                    self.constructor = c
                    let ahora = Date()
                    s.startActivity(with: ahora)
                    c.beginCollection(withStart: ahora) { _, _ in }
                    self.arrancaUbicacion(modo)
                    // Nadar: el reloj bloquea la pantalla contra el agua solo, como la app Entreno de Apple.
                    if config.activityType == .swimming { WKInterfaceDevice.current().enableWaterLock() }
                    listo(true)
                } catch {
                    print("Reloj: no se pudo empezar el entreno: \(error.localizedDescription)")
                    self.sesion = nil
                    self.constructor = nil
                    listo(false)
                }
            }
        }
    }

    /// Después de que el reloj se apagó o la app se cerró a mitad del entreno: se vuelve a enganchar al entreno que Salud sigue midiendo.
    func recupera(listo: @escaping (Bool) -> Void) {
        almacen.recoverActiveWorkoutSession { s, _ in
            DispatchQueue.main.async {
                guard let s = s, self.sesion == nil else { listo(self.sesion != nil); return }
                let c = s.associatedWorkoutBuilder()
                c.dataSource = HKLiveWorkoutDataSource(healthStore: self.almacen, workoutConfiguration: s.workoutConfiguration)
                s.delegate = self
                c.delegate = self
                self.sesion = s
                self.constructor = c
                listo(true)
            }
        }
    }

    /// Vuelve a seguir la ubicación después de recuperar el entreno (la ruta en Salud empieza de nuevo: los puntos de antes ya están en el disco del reloj).
    func sigueUbicacion(_ modo: ModoDeUbicacion) {
        guard sesion != nil, ubicacion == nil else { return }
        arrancaUbicacion(modo)
    }

    func pausa() { sesion?.pause() }
    func reanuda() { sesion?.resume() }

    /// Termina de medir. `guardar`: se guarda en Salud con estos metadatos (la marca de Training Lab); si no, se descarta. `listo(entreno)` con lo que quedó en
    /// Salud (`nil` si no se guardó).
    func termina(guardar: Bool, metadatos: [String: Any], listo: @escaping (HKWorkout?) -> Void) {
        paraUbicacion()
        guard let s = sesion, let c = constructor else { limpia(); listo(nil); return }
        let ruta = rutaEnSalud
        alTerminar = { [weak self] fecha in
            c.endCollection(withEnd: fecha) { _, _ in
                guard guardar else {
                    c.discardWorkout()
                    DispatchQueue.main.async { self?.limpia(); listo(nil) }
                    return
                }
                c.addMetadata(metadatos) { _, _ in
                    c.finishWorkout { entreno, error in
                        if let error = error { print("Reloj: no se pudo guardar el entreno: \(error.localizedDescription)") }
                        if let entreno = entreno, let ruta = ruta {
                            ruta.finishRoute(with: entreno, metadata: nil) { _, _ in }
                        }
                        DispatchQueue.main.async { self?.limpia(); listo(entreno) }
                    }
                }
            }
        }
        if s.state == .notStarted || s.state == .ended {
            let fin = alTerminar
            alTerminar = nil
            fin?(Date())
        } else {
            s.end()
        }
    }

    private func limpia() {
        sesion = nil
        constructor = nil
        rutaEnSalud = nil
        alTerminar = nil
    }

    // MARK: Lo que se sabe ahora

    /// Segundos de entreno sin las pausas, como los cuenta Salud (se pone al día cada vez que llega algo; lo que se ve en pantalla se cuenta con la hora).
    var segundos: TimeInterval { constructor?.elapsedTime ?? 0 }

    private let lpm = HKUnit.count().unitDivided(by: HKUnit.minute())

    func pulsoMedio() -> Int? {
        guard let q = constructor?.statistics(for: HKQuantityType(.heartRate))?.averageQuantity() else { return nil }
        return Int(q.doubleValue(for: lpm).rounded())
    }
    func pulsoMaximo() -> Int? {
        guard let q = constructor?.statistics(for: HKQuantityType(.heartRate))?.maximumQuantity() else { return nil }
        return Int(q.doubleValue(for: lpm).rounded())
    }
    func calorias() -> Double? {
        constructor?.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
    }
    /// Los metros que lleva (a pie, en bici o nadando), o `nil` si no mide distancia.
    func metros() -> Double? {
        guard let c = constructor else { return nil }
        for id in [HKQuantityTypeIdentifier.distanceWalkingRunning, .distanceCycling, .distanceSwimming] {
            if let q = c.statistics(for: HKQuantityType(id))?.sumQuantity() {
                let m = q.doubleValue(for: .meter())
                if m > 0 { return m }
            }
        }
        return nil
    }

    // MARK: La ubicación

    private struct Silencio {
        var alta = false
        var ancla: CLLocation?
        var movidoEn: Date?
    }
    private var silencio = Silencio()

    private func arrancaUbicacion(_ modo: ModoDeUbicacion) {
        modoDeUbicacion = modo
        guard modo != .no else { return }
        let m = CLLocationManager()
        m.delegate = self
        m.activityType = .fitness
        m.distanceFilter = kCLDistanceFilterNone
        m.desiredAccuracy = modo == .gps ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
        // Sin `allowsBackgroundLocationUpdates`: con un entreno de Salud en curso la app sigue corriendo con la muñeca abajo y la ubicación sigue llegando. Ponerlo
        // en `true` sin el modo «location» en el Info.plist cierra la app (es un error fatal de CoreLocation).
        ubicacion = m
        silencio = Silencio()
        if modo == .gps { rutaEnSalud = HKWorkoutRouteBuilder(healthStore: almacen, device: nil) }
        if m.authorizationStatus == .notDetermined { m.requestWhenInUseAuthorization() }
        m.startUpdatingLocation()
    }

    private func paraUbicacion() {
        ubicacion?.stopUpdatingLocation()
        ubicacion?.delegate = nil
        ubicacion = nil
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let buenos = locations.filter { $0.horizontalAccuracy >= 0 }
        guard !buenos.isEmpty else { return }
        if modoDeUbicacion == .gps {
            // A la ruta de Salud y a la del sticker, solo los puntos que no dibujan picos.
            let precisos = buenos.filter { $0.horizontalAccuracy <= 50 }
            if !precisos.isEmpty { rutaEnSalud?.insertRouteData(precisos) { _, _ in } }
            DispatchQueue.main.async { precisos.forEach { self.alPunto?($0) } }
            return
        }
        // En silencio: se decide la precisión con cada punto (`decidePrecision` de `src/lib/rutaSilenciosa.js`) y solo los precisos (≤ 30 m) entran a la línea.
        for p in buenos {
            decidePrecision(con: p, manager: manager)
            if p.horizontalAccuracy <= 30 { DispatchQueue.main.async { self.alPunto?(p) } }
        }
    }

    private func decidePrecision(con p: CLLocation, manager: CLLocationManager) {
        let vel = p.speed >= 0 ? p.speed : nil
        if !silencio.alta {
            guard let ancla = silencio.ancla else { silencio.ancla = p; return }
            let lejos = p.distance(from: ancla) > max(80, p.horizontalAccuracy * 1.5)
            if lejos || (vel ?? 0) >= 1.2 {
                silencio = Silencio(alta: true, ancla: p, movidoEn: p.timestamp)
                manager.desiredAccuracy = kCLLocationAccuracyBest
            }
            return
        }
        let sigue = (vel ?? 0) >= 1.2 || (silencio.ancla.map { p.distance(from: $0) > 20 } ?? false)
        if sigue {
            silencio.ancla = p
            silencio.movidoEn = p.timestamp
        } else if let movido = silencio.movidoEn, p.timestamp.timeIntervalSince(movido) >= 180 {
            silencio = Silencio(alta: false, ancla: p, movidoEn: nil)
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Reloj: la ubicación falló: \(error.localizedDescription)")
    }

    // MARK: HKWorkoutSessionDelegate

    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        guard toState == .ended else { return }
        let fin = alTerminar
        alTerminar = nil
        if let fin = fin {
            fin(date)
        } else {
            // Terminó sin que nadie lo pidiera (el sistema): se guarda igual, para no perder el pulso.
            constructor?.endCollection(withEnd: date) { _, _ in
                self.constructor?.finishWorkout { _, _ in DispatchQueue.main.async { self.limpia() } }
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("Reloj: falló el entreno: \(error.localizedDescription)")
    }

    // MARK: HKLiveWorkoutBuilderDelegate

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let tipoPulso = HKQuantityType(.heartRate)
        guard collectedTypes.contains(tipoPulso), let s = workoutBuilder.statistics(for: tipoPulso), let ultimo = s.mostRecentQuantity() else { return }
        let bpm = Int(ultimo.doubleValue(for: lpm).rounded())
        let cuando = s.mostRecentQuantityDateInterval()?.start ?? Date()
        DispatchQueue.main.async { self.alPulso?(bpm, cuando) }
    }
}

/// La configuración de Apple Salud para un entreno: qué deporte mide el reloj y si es al aire libre (con GPS). `actividad`: la del entreno libre, si es eso.
func configuracionDeApple(deporte: String, actividad: String? = nil, gps: Bool) -> HKWorkoutConfiguration {
    let c = HKWorkoutConfiguration()
    let porActividad: [String: HKWorkoutActivityType] = [
        "senderismo": .hiking, "trail": .running, "spinning": .cycling, "patines": .skatingSports, "surf": .surfingSports, "kayak": .paddleSports,
        "crossfit": .crossTraining, "hyrox": .crossTraining, "eliptica": .elliptical, "padel": .racquetball, "tenis": .tennis, "pickleball": .pickleball,
        "futbol": .soccer, "basquet": .basketball, "voleibol": .volleyball, "pilates": .pilates, "movilidad": .flexibility, "box": .boxing, "jiujitsu": .martialArts,
    ]
    let porDeporte: [String: HKWorkoutActivityType] = [
        "correr": .running, "velocidad": .running, "caminar": .walking, "senderismo": .hiking, "bici": .cycling, "natacion": .swimming, "remo": .rowing,
        "eliptica": .elliptical, "fuerza": .traditionalStrengthTraining, "hiit": .highIntensityIntervalTraining, "funcional": .functionalStrengthTraining,
        "yoga": .yoga, "movilidad": .flexibility, "recuperacion": .flexibility, "futbol": .soccer, "raqueta": .tennis,
    ]
    c.activityType = actividad.flatMap { porActividad[$0] } ?? porDeporte[deporte] ?? .other
    c.locationType = gps ? .outdoor : .indoor
    if c.activityType == .swimming {
        // Alberca de 25 m (la más común): así el reloj cuenta las vueltas. En mar abierto se elige otra actividad.
        c.swimmingLocationType = .pool
        c.lapLength = HKQuantity(unit: .meter(), doubleValue: 25)
    }
    return c
}
