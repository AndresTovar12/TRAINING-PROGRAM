import Foundation
import Capacitor
import StoreKit

/// COMPRAR CON APPLE (Advanced Commerce API, encargo «Compra y dinero», 26 nov 2026).
///
/// El servidor (`supabase/functions/apple`) arma y FIRMA la petición con el nombre del plan y el precio que puso el coach; aquí solo se la pasamos a StoreKit sobre el
/// producto genérico, como dice Apple («Sending Advanced Commerce API requests from your app»):
///   product.purchase(options: [.custom(key: "advancedCommerceData", value: datos), .appAccountToken(cuenta)])
/// La hoja de pago la pone Apple. Al terminar devolvemos el id de la transacción; el servidor la vuelve a pedir a Apple antes de activar nada (no se le cree al teléfono).
///
///   comprar({ producto, datos, cuenta }) → { transaccion } | { cancelada: true } | { pendiente: true }
@objc(CompraApplePlugin)
public class CompraApplePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CompraApplePlugin"
    public let jsName = "CompraApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "comprar", returnType: CAPPluginReturnPromise),
    ]

    @objc func comprar(_ call: CAPPluginCall) {
        guard let producto = call.getString("producto"), !producto.isEmpty,
              let datos = call.getString("datos"), !datos.isEmpty else {
            call.reject("Faltan datos de la compra.")
            return
        }
        let cuenta = call.getString("cuenta").flatMap { UUID(uuidString: $0) }
        Task {
            do {
                let productos = try await Product.products(for: [producto])
                guard let p = productos.first else {
                    call.reject("Apple no encontró el producto de compra.")
                    return
                }
                var opciones: Set<Product.PurchaseOption> = [.custom(key: "advancedCommerceData", value: Data(datos.utf8))]
                if let cuenta { opciones.insert(.appAccountToken(cuenta)) }
                let resultado = try await p.purchase(options: opciones)
                switch resultado {
                case .success(let verificacion):
                    switch verificacion {
                    case .verified(let t):
                        await t.finish()
                        call.resolve(["transaccion": String(t.id)])
                    case .unverified(let t, _):
                        // El servidor la revisa con Apple de todos modos; se termina para que StoreKit no la repita.
                        await t.finish()
                        call.resolve(["transaccion": String(t.id), "sinVerificar": true])
                    }
                case .userCancelled:
                    call.resolve(["cancelada": true])
                case .pending:
                    call.resolve(["pendiente": true])
                @unknown default:
                    call.resolve(["cancelada": true])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
