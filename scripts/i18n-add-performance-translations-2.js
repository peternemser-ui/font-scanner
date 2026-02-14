#!/usr/bin/env node
/**
 * i18n-add-performance-translations-2.js
 *
 * Adds the SECOND HALF of missing performance report translations
 * (code comments, action items, CSV keys) for all 7 non-English languages.
 *
 * Keys live under reports.performance.* namespace.
 * In the translations object we use "performance.*" (no "reports." prefix).
 *
 * Usage: node scripts/i18n-add-performance-translations-2.js
 */

const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '..', 'src', 'public', 'i18n');

// Deep merge utility
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function flattenKeys(obj, prefix) {
  prefix = prefix || '';
  let result = {};
  for (const k of Object.keys(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      Object.assign(result, flattenKeys(obj[k], key));
    } else {
      result[key] = obj[k];
    }
  }
  return result;
}

// Set a nested key on an object from a dot-path
function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// ============================================================
// TRANSLATIONS
// Each language maps flat keys (under "performance.") to translated values.
// These get merged into reports.performance.* in each language file.
// ============================================================

const translations = {
  de: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "Aktuell: Großes unoptimiertes Bundle",
    "performance.codeComments.jsBlockingRender": "500KB+ JavaScript blockiert das Rendering",
    "performance.codeComments.noCodeSplitting": "Kein Code-Splitting",
    "performance.codeComments.noTreeShaking": "Kein Tree Shaking",
    "performance.codeComments.vendorBundled": "Vendor-Code mit App gebündelt",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "Ergebnis: Kleinere, aufgeteilte Bundles",
    "performance.codeComments.currentUnoptimizedImages": "Aktuell: Unoptimierte Bilder",
    "performance.codeComments.pngInsteadOfWebp": "PNG anstelle von WebP/AVIF",
    "performance.codeComments.noSrcset": "Kein srcset für responsive Darstellung",
    "performance.codeComments.noLazyLoading": "Kein Lazy Loading",
    "performance.codeComments.largeImageFile": "2MB Bilddatei",
    "performance.codeComments.optimizedModernFormats": "Optimiert mit modernen Formaten",
    "performance.codeComments.modernFormatsSmaller": "Moderne Formate (90% kleiner)",
    "performance.codeComments.responsiveImages": "Responsive Bilder",
    "performance.codeComments.lazyLoading": "Lazy Loading",
    "performance.codeComments.currentLargeCss": "Aktuell: Große CSS-Datei",
    "performance.codeComments.largeCssFile": "200KB+ CSS-Datei",
    "performance.codeComments.unusedStyles": "Ungenutzte Styles enthalten",
    "performance.codeComments.renderBlocking": "Render-blockierend",
    "performance.codeComments.criticalCssInline": "Kritisches CSS inline",
    "performance.codeComments.aboveTheFold": "Nur Above-the-Fold-Styles",
    "performance.codeComments.nonCriticalAsync": "Nicht-kritisches CSS asynchron",
    "performance.codeComments.criticalInlined": "Kritisches CSS eingebettet",
    "performance.codeComments.nonBlockingLoad": "Nicht-blockierendes Laden",
    "performance.codeComments.currentNoCaching": "Aktuell: Keine Caching-Header",
    "performance.codeComments.assetsRedownloaded": "Assets werden bei jedem Besuch erneut heruntergeladen",
    "performance.codeComments.slowRepeatVisits": "Langsame wiederholte Besuche",
    "performance.codeComments.nginxConfig": "Nginx-Konfiguration",
    "performance.codeComments.staticCached1Year": "Statische Assets 1 Jahr gecacht",
    "performance.codeComments.htmlRevalidated": "HTML stündlich revalidiert",
    "performance.codeComments.currentNoCompression": "Aktuell: Keine Komprimierung",
    "performance.codeComments.largeTransfer": "500KB übertragen",
    "performance.codeComments.slowMobile": "Langsam in mobilen Netzwerken",
    "performance.codeComments.enableGzip": "Gzip in Nginx aktivieren",
    "performance.codeComments.result": "Ergebnis",
    "performance.codeComments.smallerTransfer": "100KB übertragen (80% kleiner)",
    "performance.codeComments.commonIssue": "Häufiges Leistungsproblem",
    "performance.codeComments.unoptimizedLoading": "Unoptimiertes Laden von Ressourcen",
    "performance.codeComments.blockingRender": "Blockiert das Rendering",
    "performance.codeComments.optimizedImpl": "Optimierte Implementierung",
    "performance.codeComments.asyncDefer": "Asynchrones/defer Laden",
    "performance.codeComments.properCaching": "Korrektes Caching",
    "performance.codeComments.compressionEnabled": "Komprimierung aktiviert",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "Code-Splitting in Ihrem Bundler aktivieren (webpack/vite)",
    "performance.actionItems.useTreeShaking": "Tree Shaking verwenden, um ungenutzten Code zu entfernen",
    "performance.actionItems.splitVendorCode": "Vendor-Code vom Anwendungscode trennen",
    "performance.actionItems.addDeferAttribute": "defer-Attribut zu nicht-kritischen Scripts hinzufügen",
    "performance.actionItems.convertToWebp": "Bilder in WebP- oder AVIF-Format konvertieren",
    "performance.actionItems.implementSrcset": "Responsive Bilder mit srcset implementieren",
    "performance.actionItems.addLazyLoading": "loading=\"lazy\" zu Bildern unterhalb des sichtbaren Bereichs hinzufügen",
    "performance.actionItems.useImageCdn": "Ein Bild-CDN für automatische Optimierung verwenden",
    "performance.actionItems.extractCriticalCss": "Kritisches CSS extrahieren und inline einbetten",
    "performance.actionItems.removeUnusedCss": "Ungenutztes CSS mit PurgeCSS entfernen",
    "performance.actionItems.loadCssAsync": "Nicht-kritisches CSS asynchron laden",
    "performance.actionItems.setCacheHeaders": "Cache-Control-Header für statische Assets setzen",
    "performance.actionItems.useContentHashing": "Inhaltsbasiertes Hashing in Dateinamen verwenden",
    "performance.actionItems.configure1YearCache": "1-Jahres-Cache für unveränderliche Assets konfigurieren",
    "performance.actionItems.enableGzipBrotli": "Gzip- oder Brotli-Komprimierung auf dem Server aktivieren",
    "performance.actionItems.verifyCompression": "Komprimierung mit den Browser-DevTools überprüfen",
    "performance.actionItems.setMinSizeThreshold": "Mindestgrößenschwelle festlegen (1KB)",
    "performance.actionItems.analyzeImplementation": "Aktuelle Implementierung analysieren",
    "performance.actionItems.applyOptimizations": "Empfohlene Optimierungen anwenden",
    "performance.actionItems.testAndMeasure": "Verbesserungen testen und messen",

    // --- performance.csv ---
    "performance.csv.metric": "Metrik",
    "performance.csv.value": "Wert",
    "performance.csv.unit": "Einheit",
    "performance.csv.status": "Status",
    "performance.csv.scanDate": "Scan-Datum",
    "performance.csv.performanceScore": "Leistungsbewertung",
    "performance.csv.points": "Punkte",
    "performance.csv.totalBlockingTime": "Gesamte Blockierungszeit (TBT)",
    "performance.csv.bytes": "Bytes",
    "performance.csv.scripts": "Scripts",
    "performance.csv.stylesheets": "Stylesheets",
    "performance.csv.recommendation": "Empfehlung",
  },

  es: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "Actual: Paquete grande sin optimizar",
    "performance.codeComments.jsBlockingRender": "500KB+ de JavaScript bloqueando el renderizado",
    "performance.codeComments.noCodeSplitting": "Sin división de código",
    "performance.codeComments.noTreeShaking": "Sin Tree Shaking",
    "performance.codeComments.vendorBundled": "Código de terceros empaquetado con la app",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "Resultado: Paquetes más pequeños y divididos",
    "performance.codeComments.currentUnoptimizedImages": "Actual: Imágenes sin optimizar",
    "performance.codeComments.pngInsteadOfWebp": "PNG en lugar de WebP/AVIF",
    "performance.codeComments.noSrcset": "Sin srcset para responsive",
    "performance.codeComments.noLazyLoading": "Sin lazy loading",
    "performance.codeComments.largeImageFile": "Archivo de imagen de 2MB",
    "performance.codeComments.optimizedModernFormats": "Optimizado con formatos modernos",
    "performance.codeComments.modernFormatsSmaller": "Formatos modernos (90% más pequeños)",
    "performance.codeComments.responsiveImages": "Imágenes responsive",
    "performance.codeComments.lazyLoading": "Lazy loading",
    "performance.codeComments.currentLargeCss": "Actual: Archivo CSS grande",
    "performance.codeComments.largeCssFile": "Archivo CSS de 200KB+",
    "performance.codeComments.unusedStyles": "Estilos no utilizados incluidos",
    "performance.codeComments.renderBlocking": "Bloquea el renderizado",
    "performance.codeComments.criticalCssInline": "CSS crítico en línea",
    "performance.codeComments.aboveTheFold": "Solo estilos visibles inicialmente",
    "performance.codeComments.nonCriticalAsync": "CSS no crítico asíncrono",
    "performance.codeComments.criticalInlined": "CSS crítico integrado",
    "performance.codeComments.nonBlockingLoad": "Carga no bloqueante",
    "performance.codeComments.currentNoCaching": "Actual: Sin encabezados de caché",
    "performance.codeComments.assetsRedownloaded": "Los recursos se descargan en cada visita",
    "performance.codeComments.slowRepeatVisits": "Visitas repetidas lentas",
    "performance.codeComments.nginxConfig": "Configuración de Nginx",
    "performance.codeComments.staticCached1Year": "Recursos estáticos en caché por 1 año",
    "performance.codeComments.htmlRevalidated": "HTML revalidado cada hora",
    "performance.codeComments.currentNoCompression": "Actual: Sin compresión",
    "performance.codeComments.largeTransfer": "500KB transferidos",
    "performance.codeComments.slowMobile": "Lento en redes móviles",
    "performance.codeComments.enableGzip": "Habilitar Gzip en Nginx",
    "performance.codeComments.result": "Resultado",
    "performance.codeComments.smallerTransfer": "100KB transferidos (80% más pequeño)",
    "performance.codeComments.commonIssue": "Problema de rendimiento común",
    "performance.codeComments.unoptimizedLoading": "Carga de recursos sin optimizar",
    "performance.codeComments.blockingRender": "Bloquea el renderizado",
    "performance.codeComments.optimizedImpl": "Implementación optimizada",
    "performance.codeComments.asyncDefer": "Carga asíncrona/defer",
    "performance.codeComments.properCaching": "Caché adecuado",
    "performance.codeComments.compressionEnabled": "Compresión habilitada",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "Habilitar la división de código en su empaquetador (webpack/vite)",
    "performance.actionItems.useTreeShaking": "Usar Tree Shaking para eliminar código no utilizado",
    "performance.actionItems.splitVendorCode": "Separar el código de terceros del código de la aplicación",
    "performance.actionItems.addDeferAttribute": "Agregar el atributo defer a scripts no críticos",
    "performance.actionItems.convertToWebp": "Convertir imágenes a formato WebP o AVIF",
    "performance.actionItems.implementSrcset": "Implementar imágenes responsive con srcset",
    "performance.actionItems.addLazyLoading": "Agregar loading=\"lazy\" a imágenes fuera de la vista inicial",
    "performance.actionItems.useImageCdn": "Usar un CDN de imágenes para optimización automática",
    "performance.actionItems.extractCriticalCss": "Extraer e integrar el CSS crítico en línea",
    "performance.actionItems.removeUnusedCss": "Eliminar CSS no utilizado con PurgeCSS",
    "performance.actionItems.loadCssAsync": "Cargar CSS no crítico de forma asíncrona",
    "performance.actionItems.setCacheHeaders": "Configurar encabezados Cache-Control para recursos estáticos",
    "performance.actionItems.useContentHashing": "Usar hashing basado en contenido en nombres de archivo",
    "performance.actionItems.configure1YearCache": "Configurar caché de 1 año para recursos inmutables",
    "performance.actionItems.enableGzipBrotli": "Habilitar compresión Gzip o Brotli en el servidor",
    "performance.actionItems.verifyCompression": "Verificar la compresión con las DevTools del navegador",
    "performance.actionItems.setMinSizeThreshold": "Establecer umbral de tamaño mínimo (1KB)",
    "performance.actionItems.analyzeImplementation": "Analizar la implementación actual",
    "performance.actionItems.applyOptimizations": "Aplicar las optimizaciones recomendadas",
    "performance.actionItems.testAndMeasure": "Probar y medir las mejoras",

    // --- performance.csv ---
    "performance.csv.metric": "Métrica",
    "performance.csv.value": "Valor",
    "performance.csv.unit": "Unidad",
    "performance.csv.status": "Estado",
    "performance.csv.scanDate": "Fecha de análisis",
    "performance.csv.performanceScore": "Puntuación de rendimiento",
    "performance.csv.points": "puntos",
    "performance.csv.totalBlockingTime": "Tiempo total de bloqueo (TBT)",
    "performance.csv.bytes": "bytes",
    "performance.csv.scripts": "Scripts",
    "performance.csv.stylesheets": "Hojas de estilo",
    "performance.csv.recommendation": "Recomendación",
  },

  fr: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "Actuel : Bundle volumineux non optimisé",
    "performance.codeComments.jsBlockingRender": "500Ko+ de JavaScript bloquant le rendu",
    "performance.codeComments.noCodeSplitting": "Pas de code splitting",
    "performance.codeComments.noTreeShaking": "Pas de Tree Shaking",
    "performance.codeComments.vendorBundled": "Code tiers intégré avec l'application",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "Résultat : Bundles plus petits et découpés",
    "performance.codeComments.currentUnoptimizedImages": "Actuel : Images non optimisées",
    "performance.codeComments.pngInsteadOfWebp": "PNG au lieu de WebP/AVIF",
    "performance.codeComments.noSrcset": "Pas de srcset pour le responsive",
    "performance.codeComments.noLazyLoading": "Pas de lazy loading",
    "performance.codeComments.largeImageFile": "Fichier image de 2Mo",
    "performance.codeComments.optimizedModernFormats": "Optimisé avec des formats modernes",
    "performance.codeComments.modernFormatsSmaller": "Formats modernes (90% plus petits)",
    "performance.codeComments.responsiveImages": "Images responsive",
    "performance.codeComments.lazyLoading": "Lazy loading",
    "performance.codeComments.currentLargeCss": "Actuel : Fichier CSS volumineux",
    "performance.codeComments.largeCssFile": "Fichier CSS de 200Ko+",
    "performance.codeComments.unusedStyles": "Styles inutilisés inclus",
    "performance.codeComments.renderBlocking": "Bloquant le rendu",
    "performance.codeComments.criticalCssInline": "CSS critique en ligne",
    "performance.codeComments.aboveTheFold": "Styles au-dessus de la ligne de flottaison uniquement",
    "performance.codeComments.nonCriticalAsync": "CSS non critique asynchrone",
    "performance.codeComments.criticalInlined": "CSS critique intégré",
    "performance.codeComments.nonBlockingLoad": "Chargement non bloquant",
    "performance.codeComments.currentNoCaching": "Actuel : Pas d'en-têtes de cache",
    "performance.codeComments.assetsRedownloaded": "Les ressources sont retéléchargées à chaque visite",
    "performance.codeComments.slowRepeatVisits": "Visites répétées lentes",
    "performance.codeComments.nginxConfig": "Configuration Nginx",
    "performance.codeComments.staticCached1Year": "Ressources statiques en cache pendant 1 an",
    "performance.codeComments.htmlRevalidated": "HTML revalidé toutes les heures",
    "performance.codeComments.currentNoCompression": "Actuel : Pas de compression",
    "performance.codeComments.largeTransfer": "500Ko transférés",
    "performance.codeComments.slowMobile": "Lent sur les réseaux mobiles",
    "performance.codeComments.enableGzip": "Activer Gzip dans Nginx",
    "performance.codeComments.result": "Résultat",
    "performance.codeComments.smallerTransfer": "100Ko transférés (80% plus petit)",
    "performance.codeComments.commonIssue": "Problème de performance courant",
    "performance.codeComments.unoptimizedLoading": "Chargement de ressources non optimisé",
    "performance.codeComments.blockingRender": "Bloque le rendu",
    "performance.codeComments.optimizedImpl": "Implémentation optimisée",
    "performance.codeComments.asyncDefer": "Chargement asynchrone/defer",
    "performance.codeComments.properCaching": "Mise en cache appropriée",
    "performance.codeComments.compressionEnabled": "Compression activée",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "Activer le code splitting dans votre bundler (webpack/vite)",
    "performance.actionItems.useTreeShaking": "Utiliser le Tree Shaking pour supprimer le code inutilisé",
    "performance.actionItems.splitVendorCode": "Séparer le code tiers du code de l'application",
    "performance.actionItems.addDeferAttribute": "Ajouter l'attribut defer aux scripts non critiques",
    "performance.actionItems.convertToWebp": "Convertir les images au format WebP ou AVIF",
    "performance.actionItems.implementSrcset": "Implémenter les images responsive avec srcset",
    "performance.actionItems.addLazyLoading": "Ajouter loading=\"lazy\" aux images hors écran",
    "performance.actionItems.useImageCdn": "Utiliser un CDN d'images pour l'optimisation automatique",
    "performance.actionItems.extractCriticalCss": "Extraire et intégrer le CSS critique en ligne",
    "performance.actionItems.removeUnusedCss": "Supprimer le CSS inutilisé avec PurgeCSS",
    "performance.actionItems.loadCssAsync": "Charger le CSS non critique de manière asynchrone",
    "performance.actionItems.setCacheHeaders": "Définir les en-têtes Cache-Control pour les ressources statiques",
    "performance.actionItems.useContentHashing": "Utiliser le hachage basé sur le contenu dans les noms de fichiers",
    "performance.actionItems.configure1YearCache": "Configurer un cache d'1 an pour les ressources immuables",
    "performance.actionItems.enableGzipBrotli": "Activer la compression Gzip ou Brotli sur le serveur",
    "performance.actionItems.verifyCompression": "Vérifier la compression avec les DevTools du navigateur",
    "performance.actionItems.setMinSizeThreshold": "Définir un seuil de taille minimum (1Ko)",
    "performance.actionItems.analyzeImplementation": "Analyser l'implémentation actuelle",
    "performance.actionItems.applyOptimizations": "Appliquer les optimisations recommandées",
    "performance.actionItems.testAndMeasure": "Tester et mesurer les améliorations",

    // --- performance.csv ---
    "performance.csv.metric": "Métrique",
    "performance.csv.value": "Valeur",
    "performance.csv.unit": "Unité",
    "performance.csv.status": "Statut",
    "performance.csv.scanDate": "Date de l'analyse",
    "performance.csv.performanceScore": "Score de performance",
    "performance.csv.points": "points",
    "performance.csv.totalBlockingTime": "Temps de blocage total (TBT)",
    "performance.csv.bytes": "octets",
    "performance.csv.scripts": "Scripts",
    "performance.csv.stylesheets": "Feuilles de style",
    "performance.csv.recommendation": "Recommandation",
  },

  ja: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "現状: 大きな未最適化バンドル",
    "performance.codeComments.jsBlockingRender": "500KB以上のJavaScriptがレンダリングをブロック",
    "performance.codeComments.noCodeSplitting": "コードスプリッティングなし",
    "performance.codeComments.noTreeShaking": "Tree Shakingなし",
    "performance.codeComments.vendorBundled": "ベンダーコードがアプリにバンドル",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "結果: より小さく分割されたバンドル",
    "performance.codeComments.currentUnoptimizedImages": "現状: 未最適化の画像",
    "performance.codeComments.pngInsteadOfWebp": "WebP/AVIFの代わりにPNG",
    "performance.codeComments.noSrcset": "レスポンシブ用のsrcsetなし",
    "performance.codeComments.noLazyLoading": "レイジーローディングなし",
    "performance.codeComments.largeImageFile": "2MBの画像ファイル",
    "performance.codeComments.optimizedModernFormats": "モダンフォーマットで最適化",
    "performance.codeComments.modernFormatsSmaller": "モダンフォーマット（90%小さい）",
    "performance.codeComments.responsiveImages": "レスポンシブ画像",
    "performance.codeComments.lazyLoading": "レイジーローディング",
    "performance.codeComments.currentLargeCss": "現状: 大きなCSSファイル",
    "performance.codeComments.largeCssFile": "200KB以上のCSSファイル",
    "performance.codeComments.unusedStyles": "未使用のスタイルが含まれている",
    "performance.codeComments.renderBlocking": "レンダリングをブロック",
    "performance.codeComments.criticalCssInline": "クリティカルCSSをインライン化",
    "performance.codeComments.aboveTheFold": "ファーストビューのスタイルのみ",
    "performance.codeComments.nonCriticalAsync": "非クリティカルCSSを非同期で",
    "performance.codeComments.criticalInlined": "クリティカルCSSがインライン化済み",
    "performance.codeComments.nonBlockingLoad": "非ブロッキング読み込み",
    "performance.codeComments.currentNoCaching": "現状: キャッシュヘッダーなし",
    "performance.codeComments.assetsRedownloaded": "アセットが毎回再ダウンロードされる",
    "performance.codeComments.slowRepeatVisits": "再訪問が遅い",
    "performance.codeComments.nginxConfig": "Nginx設定",
    "performance.codeComments.staticCached1Year": "静的アセットを1年間キャッシュ",
    "performance.codeComments.htmlRevalidated": "HTMLを1時間ごとに再検証",
    "performance.codeComments.currentNoCompression": "現状: 圧縮なし",
    "performance.codeComments.largeTransfer": "500KB転送",
    "performance.codeComments.slowMobile": "モバイルネットワークで遅い",
    "performance.codeComments.enableGzip": "NginxでGzipを有効化",
    "performance.codeComments.result": "結果",
    "performance.codeComments.smallerTransfer": "100KB転送（80%小さい）",
    "performance.codeComments.commonIssue": "一般的なパフォーマンスの問題",
    "performance.codeComments.unoptimizedLoading": "リソースの未最適化な読み込み",
    "performance.codeComments.blockingRender": "レンダリングをブロック",
    "performance.codeComments.optimizedImpl": "最適化された実装",
    "performance.codeComments.asyncDefer": "非同期/deferローディング",
    "performance.codeComments.properCaching": "適切なキャッシュ",
    "performance.codeComments.compressionEnabled": "圧縮が有効",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "バンドラーでコードスプリッティングを有効にする（webpack/vite）",
    "performance.actionItems.useTreeShaking": "Tree Shakingを使用して未使用コードを削除する",
    "performance.actionItems.splitVendorCode": "ベンダーコードをアプリケーションコードから分離する",
    "performance.actionItems.addDeferAttribute": "非クリティカルなスクリプトにdefer属性を追加する",
    "performance.actionItems.convertToWebp": "画像をWebPまたはAVIF形式に変換する",
    "performance.actionItems.implementSrcset": "srcsetを使用してレスポンシブ画像を実装する",
    "performance.actionItems.addLazyLoading": "画面外の画像にloading=\"lazy\"を追加する",
    "performance.actionItems.useImageCdn": "自動最適化のために画像CDNを使用する",
    "performance.actionItems.extractCriticalCss": "クリティカルCSSを抽出してインライン化する",
    "performance.actionItems.removeUnusedCss": "PurgeCSSで未使用のCSSを削除する",
    "performance.actionItems.loadCssAsync": "非クリティカルCSSを非同期で読み込む",
    "performance.actionItems.setCacheHeaders": "静的アセットにCache-Controlヘッダーを設定する",
    "performance.actionItems.useContentHashing": "ファイル名にコンテンツベースのハッシュを使用する",
    "performance.actionItems.configure1YearCache": "不変アセットに1年間のキャッシュを設定する",
    "performance.actionItems.enableGzipBrotli": "サーバーでGzipまたはBrotli圧縮を有効にする",
    "performance.actionItems.verifyCompression": "ブラウザのDevToolsで圧縮を確認する",
    "performance.actionItems.setMinSizeThreshold": "最小サイズしきい値を設定する（1KB）",
    "performance.actionItems.analyzeImplementation": "現在の実装を分析する",
    "performance.actionItems.applyOptimizations": "推奨される最適化を適用する",
    "performance.actionItems.testAndMeasure": "改善をテストして測定する",

    // --- performance.csv ---
    "performance.csv.metric": "メトリクス",
    "performance.csv.value": "値",
    "performance.csv.unit": "単位",
    "performance.csv.status": "ステータス",
    "performance.csv.scanDate": "スキャン日",
    "performance.csv.performanceScore": "パフォーマンススコア",
    "performance.csv.points": "ポイント",
    "performance.csv.totalBlockingTime": "合計ブロッキング時間（TBT）",
    "performance.csv.bytes": "バイト",
    "performance.csv.scripts": "スクリプト",
    "performance.csv.stylesheets": "スタイルシート",
    "performance.csv.recommendation": "推奨事項",
  },

  pt: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "Atual: Bundle grande sem otimização",
    "performance.codeComments.jsBlockingRender": "500KB+ de JavaScript bloqueando a renderização",
    "performance.codeComments.noCodeSplitting": "Sem divisão de código",
    "performance.codeComments.noTreeShaking": "Sem Tree Shaking",
    "performance.codeComments.vendorBundled": "Código de terceiros empacotado com a aplicação",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "Resultado: Bundles menores e divididos",
    "performance.codeComments.currentUnoptimizedImages": "Atual: Imagens sem otimização",
    "performance.codeComments.pngInsteadOfWebp": "PNG em vez de WebP/AVIF",
    "performance.codeComments.noSrcset": "Sem srcset para responsivo",
    "performance.codeComments.noLazyLoading": "Sem lazy loading",
    "performance.codeComments.largeImageFile": "Arquivo de imagem de 2MB",
    "performance.codeComments.optimizedModernFormats": "Otimizado com formatos modernos",
    "performance.codeComments.modernFormatsSmaller": "Formatos modernos (90% menores)",
    "performance.codeComments.responsiveImages": "Imagens responsivas",
    "performance.codeComments.lazyLoading": "Lazy loading",
    "performance.codeComments.currentLargeCss": "Atual: Arquivo CSS grande",
    "performance.codeComments.largeCssFile": "Arquivo CSS de 200KB+",
    "performance.codeComments.unusedStyles": "Estilos não utilizados incluídos",
    "performance.codeComments.renderBlocking": "Bloqueia a renderização",
    "performance.codeComments.criticalCssInline": "CSS crítico inline",
    "performance.codeComments.aboveTheFold": "Apenas estilos acima da dobra",
    "performance.codeComments.nonCriticalAsync": "CSS não crítico assíncrono",
    "performance.codeComments.criticalInlined": "CSS crítico incorporado",
    "performance.codeComments.nonBlockingLoad": "Carregamento não bloqueante",
    "performance.codeComments.currentNoCaching": "Atual: Sem cabeçalhos de cache",
    "performance.codeComments.assetsRedownloaded": "Recursos são baixados novamente em cada visita",
    "performance.codeComments.slowRepeatVisits": "Visitas repetidas lentas",
    "performance.codeComments.nginxConfig": "Configuração do Nginx",
    "performance.codeComments.staticCached1Year": "Recursos estáticos em cache por 1 ano",
    "performance.codeComments.htmlRevalidated": "HTML revalidado a cada hora",
    "performance.codeComments.currentNoCompression": "Atual: Sem compressão",
    "performance.codeComments.largeTransfer": "500KB transferidos",
    "performance.codeComments.slowMobile": "Lento em redes móveis",
    "performance.codeComments.enableGzip": "Habilitar Gzip no Nginx",
    "performance.codeComments.result": "Resultado",
    "performance.codeComments.smallerTransfer": "100KB transferidos (80% menor)",
    "performance.codeComments.commonIssue": "Problema de desempenho comum",
    "performance.codeComments.unoptimizedLoading": "Carregamento de recursos sem otimização",
    "performance.codeComments.blockingRender": "Bloqueia a renderização",
    "performance.codeComments.optimizedImpl": "Implementação otimizada",
    "performance.codeComments.asyncDefer": "Carregamento assíncrono/defer",
    "performance.codeComments.properCaching": "Cache adequado",
    "performance.codeComments.compressionEnabled": "Compressão habilitada",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "Habilitar a divisão de código no seu empacotador (webpack/vite)",
    "performance.actionItems.useTreeShaking": "Usar Tree Shaking para remover código não utilizado",
    "performance.actionItems.splitVendorCode": "Separar o código de terceiros do código da aplicação",
    "performance.actionItems.addDeferAttribute": "Adicionar o atributo defer a scripts não críticos",
    "performance.actionItems.convertToWebp": "Converter imagens para formato WebP ou AVIF",
    "performance.actionItems.implementSrcset": "Implementar imagens responsivas com srcset",
    "performance.actionItems.addLazyLoading": "Adicionar loading=\"lazy\" a imagens fora da tela",
    "performance.actionItems.useImageCdn": "Usar um CDN de imagens para otimização automática",
    "performance.actionItems.extractCriticalCss": "Extrair e incorporar o CSS crítico inline",
    "performance.actionItems.removeUnusedCss": "Remover CSS não utilizado com PurgeCSS",
    "performance.actionItems.loadCssAsync": "Carregar CSS não crítico de forma assíncrona",
    "performance.actionItems.setCacheHeaders": "Definir cabeçalhos Cache-Control para recursos estáticos",
    "performance.actionItems.useContentHashing": "Usar hashing baseado em conteúdo nos nomes de arquivos",
    "performance.actionItems.configure1YearCache": "Configurar cache de 1 ano para recursos imutáveis",
    "performance.actionItems.enableGzipBrotli": "Habilitar compressão Gzip ou Brotli no servidor",
    "performance.actionItems.verifyCompression": "Verificar a compressão com as DevTools do navegador",
    "performance.actionItems.setMinSizeThreshold": "Definir limite mínimo de tamanho (1KB)",
    "performance.actionItems.analyzeImplementation": "Analisar a implementação atual",
    "performance.actionItems.applyOptimizations": "Aplicar as otimizações recomendadas",
    "performance.actionItems.testAndMeasure": "Testar e medir as melhorias",

    // --- performance.csv ---
    "performance.csv.metric": "Métrica",
    "performance.csv.value": "Valor",
    "performance.csv.unit": "Unidade",
    "performance.csv.status": "Status",
    "performance.csv.scanDate": "Data da análise",
    "performance.csv.performanceScore": "Pontuação de desempenho",
    "performance.csv.points": "pontos",
    "performance.csv.totalBlockingTime": "Tempo total de bloqueio (TBT)",
    "performance.csv.bytes": "bytes",
    "performance.csv.scripts": "Scripts",
    "performance.csv.stylesheets": "Folhas de estilo",
    "performance.csv.recommendation": "Recomendação",
  },

  zh: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "当前：大型未优化包",
    "performance.codeComments.jsBlockingRender": "500KB以上JavaScript阻塞渲染",
    "performance.codeComments.noCodeSplitting": "没有代码分割",
    "performance.codeComments.noTreeShaking": "没有Tree Shaking",
    "performance.codeComments.vendorBundled": "第三方代码与应用捆绑",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "结果：更小的分割包",
    "performance.codeComments.currentUnoptimizedImages": "当前：未优化的图片",
    "performance.codeComments.pngInsteadOfWebp": "使用PNG而非WebP/AVIF",
    "performance.codeComments.noSrcset": "没有用于响应式的srcset",
    "performance.codeComments.noLazyLoading": "没有懒加载",
    "performance.codeComments.largeImageFile": "2MB图片文件",
    "performance.codeComments.optimizedModernFormats": "使用现代格式优化",
    "performance.codeComments.modernFormatsSmaller": "现代格式（小90%）",
    "performance.codeComments.responsiveImages": "响应式图片",
    "performance.codeComments.lazyLoading": "懒加载",
    "performance.codeComments.currentLargeCss": "当前：大型CSS文件",
    "performance.codeComments.largeCssFile": "200KB以上CSS文件",
    "performance.codeComments.unusedStyles": "包含未使用的样式",
    "performance.codeComments.renderBlocking": "阻塞渲染",
    "performance.codeComments.criticalCssInline": "关键CSS内联",
    "performance.codeComments.aboveTheFold": "仅首屏样式",
    "performance.codeComments.nonCriticalAsync": "非关键CSS异步加载",
    "performance.codeComments.criticalInlined": "关键CSS已内联",
    "performance.codeComments.nonBlockingLoad": "非阻塞加载",
    "performance.codeComments.currentNoCaching": "当前：没有缓存头",
    "performance.codeComments.assetsRedownloaded": "每次访问都重新下载资源",
    "performance.codeComments.slowRepeatVisits": "重复访问缓慢",
    "performance.codeComments.nginxConfig": "Nginx配置",
    "performance.codeComments.staticCached1Year": "静态资源缓存1年",
    "performance.codeComments.htmlRevalidated": "HTML每小时重新验证",
    "performance.codeComments.currentNoCompression": "当前：没有压缩",
    "performance.codeComments.largeTransfer": "传输500KB",
    "performance.codeComments.slowMobile": "在移动网络上缓慢",
    "performance.codeComments.enableGzip": "在Nginx中启用Gzip",
    "performance.codeComments.result": "结果",
    "performance.codeComments.smallerTransfer": "传输100KB（小80%）",
    "performance.codeComments.commonIssue": "常见性能问题",
    "performance.codeComments.unoptimizedLoading": "未优化的资源加载",
    "performance.codeComments.blockingRender": "阻塞渲染",
    "performance.codeComments.optimizedImpl": "优化的实现",
    "performance.codeComments.asyncDefer": "异步/defer加载",
    "performance.codeComments.properCaching": "适当的缓存",
    "performance.codeComments.compressionEnabled": "压缩已启用",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "在打包工具中启用代码分割（webpack/vite）",
    "performance.actionItems.useTreeShaking": "使用Tree Shaking移除未使用的代码",
    "performance.actionItems.splitVendorCode": "将第三方代码与应用代码分离",
    "performance.actionItems.addDeferAttribute": "为非关键脚本添加defer属性",
    "performance.actionItems.convertToWebp": "将图片转换为WebP或AVIF格式",
    "performance.actionItems.implementSrcset": "使用srcset实现响应式图片",
    "performance.actionItems.addLazyLoading": "为屏幕外的图片添加loading=\"lazy\"",
    "performance.actionItems.useImageCdn": "使用图片CDN进行自动优化",
    "performance.actionItems.extractCriticalCss": "提取并内联关键CSS",
    "performance.actionItems.removeUnusedCss": "使用PurgeCSS移除未使用的CSS",
    "performance.actionItems.loadCssAsync": "异步加载非关键CSS",
    "performance.actionItems.setCacheHeaders": "为静态资源设置Cache-Control头",
    "performance.actionItems.useContentHashing": "在文件名中使用基于内容的哈希",
    "performance.actionItems.configure1YearCache": "为不可变资源配置1年缓存",
    "performance.actionItems.enableGzipBrotli": "在服务器上启用Gzip或Brotli压缩",
    "performance.actionItems.verifyCompression": "使用浏览器DevTools验证压缩",
    "performance.actionItems.setMinSizeThreshold": "设置最小大小阈值（1KB）",
    "performance.actionItems.analyzeImplementation": "分析当前实现",
    "performance.actionItems.applyOptimizations": "应用推荐的优化",
    "performance.actionItems.testAndMeasure": "测试并衡量改进效果",

    // --- performance.csv ---
    "performance.csv.metric": "指标",
    "performance.csv.value": "值",
    "performance.csv.unit": "单位",
    "performance.csv.status": "状态",
    "performance.csv.scanDate": "扫描日期",
    "performance.csv.performanceScore": "性能评分",
    "performance.csv.points": "分",
    "performance.csv.totalBlockingTime": "总阻塞时间（TBT）",
    "performance.csv.bytes": "字节",
    "performance.csv.scripts": "脚本",
    "performance.csv.stylesheets": "样式表",
    "performance.csv.recommendation": "建议",
  },

  ru: {
    // --- performance.codeComments ---
    "performance.codeComments.currentLargeBundle": "Текущее состояние: Большой неоптимизированный бандл",
    "performance.codeComments.jsBlockingRender": "500КБ+ JavaScript блокирует рендеринг",
    "performance.codeComments.noCodeSplitting": "Нет разделения кода",
    "performance.codeComments.noTreeShaking": "Нет Tree Shaking",
    "performance.codeComments.vendorBundled": "Код библиотек в одном бандле с приложением",
    "performance.codeComments.treeShaking": "Tree Shaking",
    "performance.codeComments.resultSmallerBundles": "Результат: Меньшие, разделённые бандлы",
    "performance.codeComments.currentUnoptimizedImages": "Текущее состояние: Неоптимизированные изображения",
    "performance.codeComments.pngInsteadOfWebp": "PNG вместо WebP/AVIF",
    "performance.codeComments.noSrcset": "Нет srcset для адаптивности",
    "performance.codeComments.noLazyLoading": "Нет отложенной загрузки",
    "performance.codeComments.largeImageFile": "Файл изображения 2МБ",
    "performance.codeComments.optimizedModernFormats": "Оптимизировано с современными форматами",
    "performance.codeComments.modernFormatsSmaller": "Современные форматы (на 90% меньше)",
    "performance.codeComments.responsiveImages": "Адаптивные изображения",
    "performance.codeComments.lazyLoading": "Отложенная загрузка",
    "performance.codeComments.currentLargeCss": "Текущее состояние: Большой CSS-файл",
    "performance.codeComments.largeCssFile": "CSS-файл 200КБ+",
    "performance.codeComments.unusedStyles": "Неиспользуемые стили включены",
    "performance.codeComments.renderBlocking": "Блокирует рендеринг",
    "performance.codeComments.criticalCssInline": "Критический CSS встроен",
    "performance.codeComments.aboveTheFold": "Только стили первого экрана",
    "performance.codeComments.nonCriticalAsync": "Некритический CSS загружается асинхронно",
    "performance.codeComments.criticalInlined": "Критический CSS встроен",
    "performance.codeComments.nonBlockingLoad": "Неблокирующая загрузка",
    "performance.codeComments.currentNoCaching": "Текущее состояние: Нет заголовков кэширования",
    "performance.codeComments.assetsRedownloaded": "Ресурсы загружаются заново при каждом посещении",
    "performance.codeComments.slowRepeatVisits": "Медленные повторные посещения",
    "performance.codeComments.nginxConfig": "Конфигурация Nginx",
    "performance.codeComments.staticCached1Year": "Статические ресурсы кэшированы на 1 год",
    "performance.codeComments.htmlRevalidated": "HTML перепроверяется каждый час",
    "performance.codeComments.currentNoCompression": "Текущее состояние: Нет сжатия",
    "performance.codeComments.largeTransfer": "Передано 500КБ",
    "performance.codeComments.slowMobile": "Медленно в мобильных сетях",
    "performance.codeComments.enableGzip": "Включить Gzip в Nginx",
    "performance.codeComments.result": "Результат",
    "performance.codeComments.smallerTransfer": "Передано 100КБ (на 80% меньше)",
    "performance.codeComments.commonIssue": "Распространённая проблема производительности",
    "performance.codeComments.unoptimizedLoading": "Неоптимизированная загрузка ресурсов",
    "performance.codeComments.blockingRender": "Блокирует рендеринг",
    "performance.codeComments.optimizedImpl": "Оптимизированная реализация",
    "performance.codeComments.asyncDefer": "Асинхронная/defer загрузка",
    "performance.codeComments.properCaching": "Правильное кэширование",
    "performance.codeComments.compressionEnabled": "Сжатие включено",

    // --- performance.actionItems ---
    "performance.actionItems.enableCodeSplitting": "Включите разделение кода в вашем сборщике (webpack/vite)",
    "performance.actionItems.useTreeShaking": "Используйте Tree Shaking для удаления неиспользуемого кода",
    "performance.actionItems.splitVendorCode": "Отделите код библиотек от кода приложения",
    "performance.actionItems.addDeferAttribute": "Добавьте атрибут defer к некритичным скриптам",
    "performance.actionItems.convertToWebp": "Конвертируйте изображения в формат WebP или AVIF",
    "performance.actionItems.implementSrcset": "Реализуйте адаптивные изображения с помощью srcset",
    "performance.actionItems.addLazyLoading": "Добавьте loading=\"lazy\" к изображениям за пределами экрана",
    "performance.actionItems.useImageCdn": "Используйте CDN для изображений для автоматической оптимизации",
    "performance.actionItems.extractCriticalCss": "Извлеките и встройте критический CSS",
    "performance.actionItems.removeUnusedCss": "Удалите неиспользуемый CSS с помощью PurgeCSS",
    "performance.actionItems.loadCssAsync": "Загружайте некритический CSS асинхронно",
    "performance.actionItems.setCacheHeaders": "Установите заголовки Cache-Control для статических ресурсов",
    "performance.actionItems.useContentHashing": "Используйте хэширование на основе содержимого в именах файлов",
    "performance.actionItems.configure1YearCache": "Настройте кэш на 1 год для неизменяемых ресурсов",
    "performance.actionItems.enableGzipBrotli": "Включите сжатие Gzip или Brotli на сервере",
    "performance.actionItems.verifyCompression": "Проверьте сжатие с помощью DevTools браузера",
    "performance.actionItems.setMinSizeThreshold": "Установите минимальный порог размера (1КБ)",
    "performance.actionItems.analyzeImplementation": "Проанализируйте текущую реализацию",
    "performance.actionItems.applyOptimizations": "Примените рекомендуемые оптимизации",
    "performance.actionItems.testAndMeasure": "Протестируйте и измерьте улучшения",

    // --- performance.csv ---
    "performance.csv.metric": "Метрика",
    "performance.csv.value": "Значение",
    "performance.csv.unit": "Единица",
    "performance.csv.status": "Статус",
    "performance.csv.scanDate": "Дата сканирования",
    "performance.csv.performanceScore": "Оценка производительности",
    "performance.csv.points": "баллов",
    "performance.csv.totalBlockingTime": "Общее время блокировки (TBT)",
    "performance.csv.bytes": "байт",
    "performance.csv.scripts": "Скрипты",
    "performance.csv.stylesheets": "Таблицы стилей",
    "performance.csv.recommendation": "Рекомендация",
  },
};

// ============================================================
// PROCESS: Apply translations to each language file
// ============================================================

const langs = ['de', 'es', 'fr', 'ja', 'pt', 'zh', 'ru'];

for (const lang of langs) {
  const filePath = path.join(i18nDir, lang + '.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!data.reports) data.reports = {};

  const langTranslations = translations[lang] || {};
  let addedCount = 0;

  // Build a nested object from flat keys
  const toMerge = {};
  for (const [flatKey, value] of Object.entries(langTranslations)) {
    setNestedKey(toMerge, flatKey, value);
    addedCount++;
  }

  // Deep merge into reports section
  deepMerge(data.reports, toMerge);

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: added ${addedCount} translations`);
}

// Verify
console.log('\n=== Post-merge verification ===');
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
const enFlat = flattenKeys(en.reports || {}, 'reports');
const enKeySet = Object.keys(enFlat);

for (const lang of langs) {
  const data = JSON.parse(fs.readFileSync(path.join(i18nDir, lang + '.json'), 'utf8'));
  const langKeys = flattenKeys(data.reports || {}, 'reports');
  const langSet = new Set(Object.keys(langKeys));
  const missing = enKeySet.filter(k => !langSet.has(k));
  console.log(`${lang}: ${Object.keys(langKeys).length}/${enKeySet.length} keys (${missing.length} still missing)`);
}
