import Foundation
import AVFoundation
import CoreImage

/* TU VIDEO CON STICKERS (27 nov 2026, «parte 2b» del editor de Carrete). Andrés eligió que el fondo pueda ser foto O video.

   Lo arma el propio iPhone (AVFoundation), no la página: así el color se queda como en su galería. Los videos del iPhone son HDR (HLG, 10 bits); si se pasaran por
   un lienzo de la página saldrían convertidos a SDR (oscuros y rojizos, lo que ya le pasó en sus reels). Aquí cada cuadro va por Core Image en su espacio lineal
   extendido, se le pone ENCIMA la capa de stickers (un PNG transparente de 1080 × 1920 que dibuja la página, con la marca) y se exporta:
   - video HDR → HEVC 10 bits con la MISMA etiqueta de color del original (HLG / BT.2020);
   - video normal → H.264, sin tocar su color.
   El cuadro se recorta al centro para llenar 9:16 (como `object-fit: cover` en el editor) y se endereza si el video viene girado. Sale solo el pedazo que se
   eligió en «Recortar» (`inicio`, `fin`), 60 s como mucho (una historia). El audio va tal cual.

   Este archivo no usa UIKit a propósito: el mismo código se prueba en la Mac con un video real del iPhone antes de subirlo (ver docs/stickers.md). */

enum ComponeVideo {
    static let ancho: CGFloat = 1080
    static let alto: CGFloat = 1920
    static let maxSegundos: Double = 60

    enum Falla: Error { case sinVideo, sinSesion, exporto(String) }

    /// La orientación de un video según su `preferredTransform` (el iPhone guarda los videos verticales acostados, con un giro de 90°).
    static func orientacion(_ t: CGAffineTransform) -> CGImagePropertyOrientation {
        if t.a == 0 && t.b == 1 && t.c == -1 && t.d == 0 { return .right }
        if t.a == 0 && t.b == -1 && t.c == 1 && t.d == 0 { return .left }
        if t.a == -1 && t.b == 0 && t.c == 0 && t.d == -1 { return .down }
        return .up
    }

    /// ¿El video es HDR? Y, si sí, su etiqueta de color (primarios, transferencia, matriz) para copiarla igual a la salida.
    static func colorDe(_ pista: AVAssetTrack) -> (hdr: Bool, primarios: String, transferencia: String, matriz: String) {
        var hdr = pista.hasMediaCharacteristic(.containsHDRVideo)
        var primarios = AVVideoColorPrimaries_ITU_R_2020
        var transferencia = AVVideoTransferFunction_ITU_R_2100_HLG
        let matriz = AVVideoYCbCrMatrix_ITU_R_2020
        if let desc = (pista.formatDescriptions as? [CMFormatDescription])?.first {
            let ext = CMFormatDescriptionGetExtensions(desc) as? [String: Any] ?? [:]
            let tf = ext[kCVImageBufferTransferFunctionKey as String] as? String
            if tf == (kCVImageBufferTransferFunction_ITU_R_2100_HLG as String) { hdr = true; transferencia = AVVideoTransferFunction_ITU_R_2100_HLG }
            if tf == (kCVImageBufferTransferFunction_SMPTE_ST_2084_PQ as String) { hdr = true; transferencia = AVVideoTransferFunction_SMPTE_ST_2084_PQ }
            if let p = ext[kCVImageBufferColorPrimariesKey as String] as? String, p == (kCVImageBufferColorPrimaries_P3_D65 as String) { primarios = AVVideoColorPrimaries_P3_D65 }
        }
        return (hdr, primarios, transferencia, matriz)
    }

    /// Arma el video. `capa`: la imagen de los stickers (transparente, 9:16). Llama `listo` con el archivo terminado o con el error.
    static func arma(fuente: URL, capa: CIImage, destino: URL, inicio: Double = 0, fin: Double? = nil, listo: @escaping (Result<(URL, Bool), Error>) -> Void) {
        let activo = AVURLAsset(url: fuente)
        guard let pista = activo.tracks(withMediaType: .video).first else { listo(.failure(Falla.sinVideo)); return }
        let color = colorDe(pista)
        let giro = orientacion(pista.preferredTransform)
        let natural = pista.naturalSize
        let derecho = CGRect(origin: .zero, size: natural).applying(pista.preferredTransform).size
        let W = ancho, H = alto
        // La capa, a 1080 × 1920 exactos (la página ya la manda así; por si acaso).
        let ce = capa.extent
        let capaLista = (ce.width == W && ce.height == H) ? capa
            : capa.transformed(by: CGAffineTransform(scaleX: W / ce.width, y: H / ce.height)).transformed(by: CGAffineTransform(translationX: -ce.minX * W / ce.width, y: -ce.minY * H / ce.height))

        let composicion = AVMutableVideoComposition(asset: activo) { pide in
            var cuadro = pide.sourceImage
            // Si el cuadro llega acostado (mide como el natural y no como el derecho), se endereza.
            let e = cuadro.extent.size
            if giro != .up && abs(e.width - abs(derecho.width)) > 1 && abs(e.width - natural.width) <= 1 {
                cuadro = cuadro.oriented(giro)
            }
            cuadro = cuadro.transformed(by: CGAffineTransform(translationX: -cuadro.extent.minX, y: -cuadro.extent.minY))
            // Llenar 9:16 recortando al centro.
            let k = max(W / cuadro.extent.width, H / cuadro.extent.height)
            cuadro = cuadro.applyingFilter("CILanczosScaleTransform", parameters: [kCIInputScaleKey: k, kCIInputAspectRatioKey: 1])
            let x = (W - cuadro.extent.width) / 2 - cuadro.extent.minX
            let y = (H - cuadro.extent.height) / 2 - cuadro.extent.minY
            cuadro = cuadro.transformed(by: CGAffineTransform(translationX: x, y: y)).cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
            pide.finish(with: capaLista.composited(over: cuadro), context: nil)
        }
        composicion.renderSize = CGSize(width: W, height: H)
        if color.hdr {
            composicion.colorPrimaries = color.primarios
            composicion.colorTransferFunction = color.transferencia
            composicion.colorYCbCrMatrix = color.matriz
        } else {
            composicion.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
            composicion.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
            composicion.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
        }

        // HEVC conserva el HDR (10 bits); H.264 para los normales (lo abre cualquier app).
        let preset = color.hdr ? AVAssetExportPresetHEVCHighestQuality : AVAssetExportPresetHighestQuality
        guard let sesion = AVAssetExportSession(asset: activo, presetName: preset) else { listo(.failure(Falla.sinSesion)); return }
        try? FileManager.default.removeItem(at: destino)
        sesion.outputURL = destino
        sesion.outputFileType = .mp4
        sesion.shouldOptimizeForNetworkUse = true
        sesion.videoComposition = composicion
        // El pedazo que se eligió al recortar (de `inicio` a `fin`), 60 s como mucho.
        let dura = CMTimeGetSeconds(activo.duration)
        let desde = max(0, min(inicio, dura))
        let hasta = min(dura, fin ?? dura, desde + maxSegundos)
        if desde > 0 || hasta < dura {
            sesion.timeRange = CMTimeRange(start: CMTime(seconds: desde, preferredTimescale: 600), end: CMTime(seconds: hasta, preferredTimescale: 600))
        }
        sesion.exportAsynchronously {
            if sesion.status == .completed { listo(.success((destino, color.hdr))) }
            else { listo(.failure(Falla.exporto(sesion.error?.localizedDescription ?? "No se pudo armar el video"))) }
        }
    }
}
