# Agrega al proyecto de Xcode las piezas que Capacitor no trae: la extensión de pantalla bloqueada (Live Activity) y, si existe, la app del Apple Watch.
# Se corre en la nube justo antes de compilar (ver .github/workflows/ios-testflight.yml). Es idempotente: si ya están, no las repite.
# Usa la librería `xcodeproj` (la misma de CocoaPods).
require 'xcodeproj'

RUTA = 'ios/App/App.xcodeproj'
EQUIPO = 'UQ99Q69ULQ'
BUNDLE = 'com.traininglabapp.app'

proj = Xcodeproj::Project.open(RUTA)
app = proj.targets.find { |t| t.name == 'App' } or abort 'No encuentro el objetivo App'
grupo_app = proj.main_group['App'] or abort 'No encuentro el grupo App'

# --- Archivos nuevos del objetivo App (la app) -------------------------------------------------
def agrega_fuente(grupo, objetivo, nombre)
  return grupo.files.find { |f| f.path == nombre } if grupo.files.any? { |f| f.path == nombre }
  ref = grupo.new_file(nombre)
  objetivo.add_file_references([ref])
  ref
end

compartido = nil
%w[EntrenoLiveActivity.swift EntrenoLivePlugin.swift MainViewController.swift].each do |n|
  ref = agrega_fuente(grupo_app, app, n)
  compartido = ref if n == 'EntrenoLiveActivity.swift'
end

# --- La extensión de pantalla bloqueada --------------------------------------------------------
unless proj.targets.any? { |t| t.name == 'EntrenoWidget' }
  ext = proj.new_target(:app_extension, 'EntrenoWidget', :ios, '16.2', proj.products_group, :swift)
  grupo_ext = proj.main_group.new_group('EntrenoWidget', 'EntrenoWidget')
  grupo_ext.new_file('Info.plist')
  fuente = grupo_ext.new_file('EntrenoWidget.swift')
  ext.add_file_references([fuente, compartido])
  ext.build_configurations.each do |c|
    s = c.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{BUNDLE}.EntrenoWidget"
    s['PRODUCT_NAME'] = '$(TARGET_NAME)'
    s['INFOPLIST_FILE'] = 'EntrenoWidget/Info.plist'
    s['SWIFT_VERSION'] = '5.0'
    s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.2'
    s['TARGETED_DEVICE_FAMILY'] = '1'
    s['DEVELOPMENT_TEAM'] = EQUIPO
    s['CODE_SIGN_STYLE'] = 'Automatic'
    s['SKIP_INSTALL'] = 'YES'
    s['MARKETING_VERSION'] = '1.0'
    s['CURRENT_PROJECT_VERSION'] = '1'
    s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  end
  app.add_dependency(ext)
  embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
  embed.symbol_dst_subfolder_spec = :plug_ins
  bf = embed.add_file_reference(ext.product_reference, true)
  bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts 'Extensión EntrenoWidget agregada'
end

proj.save
puts 'Proyecto guardado'
