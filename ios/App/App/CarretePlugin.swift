import Foundation
import Capacitor
import Photos
import PhotosUI // `presentLimitedLibraryPicker` vive aquí, no en Photos
import UIKit
import AVFoundation
import CoreImage

/* EL CARRETE DENTRO DE LA HOJA DE COMPARTIR (24 nov 2026, Andrés: «lo primero que te aparece es como que todas tus fotos», como Aura).

   La web no puede ver el carrete: solo abrir el selector del iPhone. Este puente lee las fotos más recientes (con permiso de Fotos), da sus miniaturas para la
   rejilla de la hoja y, al tocar una, su original listo para el editor. También guarda la imagen terminada directo en Fotos.
   La página: `src/lib/carreteNativo.js`; la hoja: `src/features/stickers/HojaDeStickers.jsx`.

   Métodos:
   - `permiso` / `pide`: { permiso: si | limitado | negado | sin_preguntar }. `pide` muestra la pregunta de iOS (`NSPhotoLibraryUsageDescription`).
   - `recientes` { cuantos?: 1-300 (60), lado?: px de la miniatura (300), tipo?: 'video' (solo videos) }: { fotos: [{ id, tipo: foto | video, duracion: s, miniatura: file://… }] }, de la más
     nueva a la más vieja. Las miniaturas se escriben una vez en la carpeta temporal y se reusan.
   - `original` { id }: { ruta: file://…, tipo: foto }. La foto se redibuja ya derecha (orientación aplicada), en JPEG, a 4 MP como mucho (la HEIC también);
     si vive solo en iCloud, se baja. Los videos van por `video`.
   - `guarda` { datos: base64 de un PNG/JPEG }: la guarda en Fotos (permiso de solo agregar, `NSPhotoLibraryAddUsageDescription`).
   - `eligeMas`: con acceso limitado, el selector de iOS para sumar fotos. `ajustes`: abre los ajustes de la app (si el permiso está negado).
   - `historiaDeInstagram` { datos: base64 del PNG, appId }: «compartir a historias» de Instagram (24 nov 2026, Andrés: «me lleva a Instagram pero no me
     aparece la imagen»). La imagen va al portapapeles con la llave que lee Instagram (5 min) y se abre `instagram-stories://share` con el App ID de Meta
     (el de «Training Lab» en developers.facebook.com; sin él Instagram la rechaza). Sin Instagram instalado: rechaza con `sin_instagram`.
     `LSApplicationQueriesSchemes` (Info.plist) deja preguntar si está instalado. Con `video` (ruta de `armaVideo`) manda el video en vez de la imagen.
   - `video` { id } (27 nov 2026, parte 2b): copia el video tal cual (sin volver a codificarlo: el color no cambia) a la carpeta temporal y saca su primer cuadro.
     { ruta, poster, duracion, hdr }. Si vive solo en iCloud, se baja.
   - `armaVideo` { ruta, capa: base64 del PNG 1080 × 1920 con los stickers }: el video con la capa encima (`ComponeVideo.swift`). { ruta, hdr }.
   - `guardaVideo` { ruta }: lo guarda en Fotos. */
@objc(CarretePlugin)
public class CarretePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CarretePlugin"
    public let jsName = "Carrete"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "permiso", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recientes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "original", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "guarda", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "eligeMas", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ajustes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "historiaDeInstagram", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "video", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "armaVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "guardaVideo", returnType: CAPPluginReturnPromise)
    ]

    private let miniaturas = PHCachingImageManager()
    private let cola = DispatchQueue(label: "tl.carrete", qos: .userInitiated)
    private static let maxPixeles: CGFloat = 4_000_000

    private static func texto(_ s: PHAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "si"
        case .limited: return "limitado"
        case .denied, .restricted: return "negado"
        case .notDetermined: return "sin_preguntar"
        @unknown default: return "sin_preguntar"
        }
    }

    private func carpeta() throws -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("carrete", isDirectory: true)
        try FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private static func limpio(_ id: String) -> String {
        String(id.map { $0.isLetter || $0.isNumber ? $0 : "_" })
    }

    @objc func permiso(_ call: CAPPluginCall) {
        call.resolve(["permiso": Self.texto(PHPhotoLibrary.authorizationStatus(for: .readWrite))])
    }

    @objc func pide(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { s in
            call.resolve(["permiso": Self.texto(s)])
        }
    }

    @objc func recientes(_ call: CAPPluginCall) {
        let cuantos = max(1, min(300, call.getInt("cuantos") ?? 60))
        let lado = CGFloat(max(60, min(600, call.getInt("lado") ?? 300)))
        cola.async {
            let opciones = PHFetchOptions()
            opciones.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            opciones.predicate = call.getString("tipo") == "video"
                ? NSPredicate(format: "mediaType == %d", PHAssetMediaType.video.rawValue)
                : NSPredicate(format: "mediaType == %d || mediaType == %d", PHAssetMediaType.image.rawValue, PHAssetMediaType.video.rawValue)
            opciones.fetchLimit = cuantos
            let resultado = PHAsset.fetchAssets(with: opciones)
            guard let dir = try? self.carpeta() else {
                call.reject("No se pudo preparar la carpeta")
                return
            }
            let pide = PHImageRequestOptions()
            pide.isSynchronous = true
            pide.deliveryMode = .highQualityFormat
            pide.resizeMode = .fast
            pide.isNetworkAccessAllowed = true
            var fotos: [[String: Any]] = []
            resultado.enumerateObjects { activo, _, _ in
                let destino = dir.appendingPathComponent("m-\(Self.limpio(activo.localIdentifier))-\(Int(lado)).jpg")
                var lista = FileManager.default.fileExists(atPath: destino.path)
                if !lista {
                    self.miniaturas.requestImage(for: activo, targetSize: CGSize(width: lado, height: lado), contentMode: .aspectFill, options: pide) { imagen, _ in
                        if let datos = imagen?.jpegData(compressionQuality: 0.8) {
                            lista = (try? datos.write(to: destino)) != nil
                        }
                    }
                }
                guard lista else { return }
                fotos.append([
                    "id": activo.localIdentifier,
                    "tipo": activo.mediaType == .video ? "video" : "foto",
                    "duracion": activo.duration,
                    "miniatura": destino.absoluteString
                ])
            }
            call.resolve(["fotos": fotos])
        }
    }

    @objc func original(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let activo = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
            call.reject("No está esa foto")
            return
        }
        guard activo.mediaType == .image else {
            call.reject("video")
            return
        }
        guard let dir = try? carpeta() else {
            call.reject("No se pudo preparar la carpeta")
            return
        }
        let pide = PHImageRequestOptions()
        pide.isNetworkAccessAllowed = true
        pide.deliveryMode = .highQualityFormat
        pide.version = .current
        PHImageManager.default().requestImageDataAndOrientation(for: activo, options: pide) { datos, _, _, _ in
            self.cola.async {
                guard let datos = datos, let imagen = UIImage(data: datos) else {
                    call.reject("No se pudo leer la foto")
                    return
                }
                // Derecha y en JPEG, a 4 MP como mucho: `draw` aplica la orientación de la foto.
                let ancho = imagen.size.width * imagen.scale
                let alto = imagen.size.height * imagen.scale
                let k = min(1, sqrt(Self.maxPixeles / max(1, ancho * alto)))
                let tam = CGSize(width: floor(ancho * k), height: floor(alto * k))
                let formato = UIGraphicsImageRendererFormat()
                formato.scale = 1
                let jpg = UIGraphicsImageRenderer(size: tam, format: formato).jpegData(withCompressionQuality: 0.9) { _ in
                    imagen.draw(in: CGRect(origin: .zero, size: tam))
                }
                let destino = dir.appendingPathComponent("o-\(Self.limpio(id)).jpg")
                do {
                    try jpg.write(to: destino)
                    call.resolve(["ruta": destino.absoluteString, "tipo": "foto"])
                } catch {
                    call.reject("No se pudo preparar la foto")
                }
            }
        }
    }

    @objc func guarda(_ call: CAPPluginCall) {
        guard let base64 = call.getString("datos"), let datos = Data(base64Encoded: base64) else {
            call.reject("Sin imagen")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { s in
            guard s == .authorized || s == .limited else {
                call.reject("negado")
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: datos, options: nil)
            }) { ok, error in
                if ok { call.resolve() } else { call.reject(error?.localizedDescription ?? "No se pudo guardar") }
            }
        }
    }

    @objc func eligeMas(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let pantalla = self.bridge?.viewController else {
                call.reject("Sin pantalla")
                return
            }
            PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: pantalla) { _ in
                call.resolve()
            }
        }
    }

    @objc func video(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let activo = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject, activo.mediaType == .video else {
            call.reject("No está ese video")
            return
        }
        guard let dir = try? carpeta() else {
            call.reject("No se pudo preparar la carpeta")
            return
        }
        let destino = dir.appendingPathComponent("v-\(Self.limpio(id)).mov")
        let poster = dir.appendingPathComponent("p-\(Self.limpio(id)).jpg")
        let termina: () -> Void = {
            self.cola.async {
                let a = AVURLAsset(url: destino)
                let gen = AVAssetImageGenerator(asset: a)
                gen.appliesPreferredTrackTransform = true
                gen.maximumSize = CGSize(width: 1600, height: 1600)
                if !FileManager.default.fileExists(atPath: poster.path),
                   let cg = try? gen.copyCGImage(at: CMTime(seconds: 0.1, preferredTimescale: 600), actualTime: nil),
                   let jpg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.85) {
                    try? jpg.write(to: poster)
                }
                let hdr = a.tracks(withMediaType: .video).first.map { ComponeVideo.colorDe($0).hdr } ?? false
                call.resolve(["ruta": destino.absoluteString, "poster": poster.absoluteString, "duracion": activo.duration, "hdr": hdr])
            }
        }
        if FileManager.default.fileExists(atPath: destino.path) { termina(); return }
        let pide = PHVideoRequestOptions()
        pide.isNetworkAccessAllowed = true
        pide.version = .current
        pide.deliveryMode = .highQualityFormat
        // «Passthrough»: el video se copia tal cual, sin volver a codificarlo (el color HDR se queda).
        PHImageManager.default().requestExportSession(forVideo: activo, options: pide, exportPreset: AVAssetExportPresetPassthrough) { sesion, _ in
            guard let sesion = sesion else {
                call.reject("No se pudo leer el video")
                return
            }
            let tmp = dir.appendingPathComponent("v-\(Self.limpio(id))-tmp.mov")
            try? FileManager.default.removeItem(at: tmp)
            sesion.outputURL = tmp
            sesion.outputFileType = .mov
            sesion.exportAsynchronously {
                guard sesion.status == .completed, (try? FileManager.default.moveItem(at: tmp, to: destino)) != nil else {
                    call.reject("No se pudo leer el video")
                    return
                }
                termina()
            }
        }
    }

    @objc func armaVideo(_ call: CAPPluginCall) {
        guard let ruta = call.getString("ruta"), let fuente = URL(string: ruta),
              let base64 = call.getString("capa"), let datos = Data(base64Encoded: base64), let capa = CIImage(data: datos) else {
            call.reject("Sin video")
            return
        }
        guard let dir = try? carpeta() else {
            call.reject("No se pudo preparar la carpeta")
            return
        }
        let destino = dir.appendingPathComponent("historia-\(UUID().uuidString.prefix(8)).mp4")
        ComponeVideo.arma(fuente: fuente, capa: capa, destino: destino) { r in
            switch r {
            case .success(let (u, hdr)): call.resolve(["ruta": u.absoluteString, "hdr": hdr])
            case .failure(let e): call.reject("\(e)")
            }
        }
    }

    @objc func guardaVideo(_ call: CAPPluginCall) {
        guard let ruta = call.getString("ruta"), let u = URL(string: ruta) else {
            call.reject("Sin video")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { s in
            guard s == .authorized || s == .limited else {
                call.reject("negado")
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: u, options: nil)
            }) { ok, error in
                if ok { call.resolve() } else { call.reject(error?.localizedDescription ?? "No se pudo guardar") }
            }
        }
    }

    @objc func historiaDeInstagram(_ call: CAPPluginCall) {
        if let ruta = call.getString("video"), let u = URL(string: ruta), let datos = try? Data(contentsOf: u),
           let appId = call.getString("appId"), !appId.isEmpty,
           let url = URL(string: "instagram-stories://share?source_application=\(appId)") {
            DispatchQueue.main.async {
                guard UIApplication.shared.canOpenURL(url) else {
                    call.reject("sin_instagram")
                    return
                }
                UIPasteboard.general.setItems([["com.instagram.sharedSticker.backgroundVideo": datos]], options: [.expirationDate: Date().addingTimeInterval(300)])
                UIApplication.shared.open(url, options: [:]) { abrio in
                    if abrio { call.resolve() } else { call.reject("no_abrio") }
                }
            }
            return
        }
        guard let base64 = call.getString("datos"), let datos = Data(base64Encoded: base64),
              let appId = call.getString("appId"), !appId.isEmpty,
              let url = URL(string: "instagram-stories://share?source_application=\(appId)") else {
            call.reject("Sin imagen")
            return
        }
        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(url) else {
                call.reject("sin_instagram")
                return
            }
            let cosas: [[String: Any]] = [["com.instagram.sharedSticker.backgroundImage": datos]]
            UIPasteboard.general.setItems(cosas, options: [.expirationDate: Date().addingTimeInterval(300)])
            UIApplication.shared.open(url, options: [:]) { abrio in
                if abrio { call.resolve() } else { call.reject("no_abrio") }
            }
        }
    }

    @objc func ajustes(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }
}
