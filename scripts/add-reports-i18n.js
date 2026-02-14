#!/usr/bin/env node
/**
 * Add translated reports namespace to language files
 * Usage: node scripts/add-reports-i18n.js <lang>
 * Example: node scripts/add-reports-i18n.js es
 */

const fs = require('fs');
const path = require('path');

const lang = process.argv[2];
if (!lang || !['es', 'fr', 'de', 'pt', 'zh', 'ja'].includes(lang)) {
  console.error('Usage: node scripts/add-reports-i18n.js <lang>');
  console.error('Languages: es, fr, de, pt, zh, ja');
  process.exit(1);
}

const i18nDir = path.join(__dirname, '..', 'src', 'public', 'i18n');
const targetFile = path.join(i18nDir, `${lang}.json`);

// Read current file
const current = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

// Common translations (keys will be prefixed with "common.")
const commonTranslations = {
  es: {
    pageScreenshot: "Captura de Pantalla",
    screenshotUnavailable: "Captura no disponible",
    exportShare: "Exportar y Compartir",
    downloadReports: "Descarga informes, exporta datos y comparte resultados.",
    exportPdf: "Exportar PDF",
    exportCsv: "Exportar CSV",
    shareLink: "Compartir Enlace",
    clientReadyReport: "Informe listo para clientes",
    rawDataExport: "Exportación de datos crudos",
    shareableUrl: "URL compartible",
    unlockReport: "Desbloquear Informe",
    unlockReportSubtitle: "Exportación PDF, enlace compartido, exportar datos y paquetes de corrección.",
    summary: "Resumen",
    recommendations: "Recomendaciones",
    issuesFound: "Problemas Encontrados",
    checksPassed: "Verificaciones Aprobadas",
    reportRecommendations: "Informe y Recomendaciones",
    fixCode: "Código de Corrección + Recomendaciones",
    takeAction: "Tomar Acción",
    improvementsFound: "{{count}} mejoras encontradas",
    issuesDetected: "{{count}} problemas detectados",
    noIssuesFound: "No se encontraron problemas",
    excellentScore: "¡Excelente! Tu sitio sigue las mejores prácticas.",
    source: "fuente",
    sources: "fuentes",
    issue: "problema",
    issues: "problemas",
    item: "elemento",
    items: "elementos",
    new: "NUEVO",
    review: "Revisar",
    na: "N/D",
    optimal: "Óptimo",
    acceptable: "Aceptable",
    tooMany: "Demasiados",
    noDataAvailable: "No hay datos disponibles",
    viewMore: "Ver Más",
    viewLess: "Ver Menos",
    tabs: { summary: "Resumen", code: "Código", guide: "Guía de Corrección" },
    priority: { critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo" },
    status: { excellent: "Excelente", good: "Bueno", fair: "Regular", poor: "Deficiente", critical: "Crítico", passing: "Aprobado", failing: "Fallando" },
    fix: { currentIssue: "Problema Actual", recommendedFix: "Corrección Recomendada", stepByStepFix: "Corrección Paso a Paso:", expectedImpact: "Impacto Esperado", howToFix: "Cómo corregir:" },
    loading: { analyzing: "Analizando...", mayTake: "Esto puede tomar {{seconds}} segundos" }
  },
  fr: {
    pageScreenshot: "Capture d'Écran",
    screenshotUnavailable: "Capture non disponible",
    exportShare: "Exporter et Partager",
    downloadReports: "Téléchargez des rapports, exportez des données et partagez les résultats.",
    exportPdf: "Exporter PDF",
    exportCsv: "Exporter CSV",
    shareLink: "Partager le Lien",
    clientReadyReport: "Rapport prêt pour le client",
    rawDataExport: "Export de données brutes",
    shareableUrl: "URL partageable",
    unlockReport: "Débloquer le Rapport",
    unlockReportSubtitle: "Export PDF, lien de partage, export de données et packs de correction.",
    summary: "Résumé",
    recommendations: "Recommandations",
    issuesFound: "Problèmes Trouvés",
    checksPassed: "Vérifications Réussies",
    reportRecommendations: "Rapport et Recommandations",
    fixCode: "Code de Correction + Recommandations",
    takeAction: "Agir",
    improvementsFound: "{{count}} améliorations trouvées",
    issuesDetected: "{{count}} problèmes détectés",
    noIssuesFound: "Aucun problème trouvé",
    excellentScore: "Excellent ! Votre site suit les meilleures pratiques.",
    source: "source",
    sources: "sources",
    issue: "problème",
    issues: "problèmes",
    item: "élément",
    items: "éléments",
    new: "NOUVEAU",
    review: "Examiner",
    na: "N/D",
    optimal: "Optimal",
    acceptable: "Acceptable",
    tooMany: "Trop nombreux",
    noDataAvailable: "Aucune donnée disponible",
    viewMore: "Voir Plus",
    viewLess: "Voir Moins",
    tabs: { summary: "Résumé", code: "Code", guide: "Guide de Correction" },
    priority: { critical: "Critique", high: "Élevé", medium: "Moyen", low: "Faible" },
    status: { excellent: "Excellent", good: "Bon", fair: "Passable", poor: "Médiocre", critical: "Critique", passing: "Réussi", failing: "Échoué" },
    fix: { currentIssue: "Problème Actuel", recommendedFix: "Correction Recommandée", stepByStepFix: "Correction Étape par Étape :", expectedImpact: "Impact Attendu", howToFix: "Comment corriger :" },
    loading: { analyzing: "Analyse en cours...", mayTake: "Cela peut prendre {{seconds}} secondes" }
  },
  de: {
    pageScreenshot: "Seitenvorschau",
    screenshotUnavailable: "Screenshot nicht verfügbar",
    exportShare: "Exportieren & Teilen",
    downloadReports: "Berichte herunterladen, Daten exportieren und Ergebnisse teilen.",
    exportPdf: "PDF Exportieren",
    exportCsv: "CSV Exportieren",
    shareLink: "Link Teilen",
    clientReadyReport: "Kundenfertiger Bericht",
    rawDataExport: "Rohdaten-Export",
    shareableUrl: "Teilbare URL",
    unlockReport: "Bericht Freischalten",
    unlockReportSubtitle: "PDF-Export, Share-Link, Datenexport und Fix-Pakete.",
    summary: "Zusammenfassung",
    recommendations: "Empfehlungen",
    issuesFound: "Probleme Gefunden",
    checksPassed: "Prüfungen Bestanden",
    reportRecommendations: "Bericht und Empfehlungen",
    fixCode: "Fix-Code + Empfehlungen",
    takeAction: "Handeln",
    improvementsFound: "{{count}} Verbesserungen gefunden",
    issuesDetected: "{{count}} Probleme erkannt",
    noIssuesFound: "Keine Probleme gefunden",
    excellentScore: "Ausgezeichnet! Ihre Website folgt Best Practices.",
    source: "Quelle",
    sources: "Quellen",
    issue: "Problem",
    issues: "Probleme",
    item: "Element",
    items: "Elemente",
    new: "NEU",
    review: "Überprüfen",
    na: "K.A.",
    optimal: "Optimal",
    acceptable: "Akzeptabel",
    tooMany: "Zu Viele",
    noDataAvailable: "Keine Daten verfügbar",
    viewMore: "Mehr Anzeigen",
    viewLess: "Weniger Anzeigen",
    tabs: { summary: "Zusammenfassung", code: "Code", guide: "Anleitung" },
    priority: { critical: "Kritisch", high: "Hoch", medium: "Mittel", low: "Niedrig" },
    status: { excellent: "Ausgezeichnet", good: "Gut", fair: "Befriedigend", poor: "Schlecht", critical: "Kritisch", passing: "Bestanden", failing: "Fehlgeschlagen" },
    fix: { currentIssue: "Aktuelles Problem", recommendedFix: "Empfohlene Lösung", stepByStepFix: "Schritt-für-Schritt-Lösung:", expectedImpact: "Erwartete Auswirkung", howToFix: "So beheben Sie es:" },
    loading: { analyzing: "Analysiere...", mayTake: "Dies kann {{seconds}} Sekunden dauern" }
  },
  pt: {
    pageScreenshot: "Captura de Tela",
    screenshotUnavailable: "Captura não disponível",
    exportShare: "Exportar e Compartilhar",
    downloadReports: "Baixe relatórios, exporte dados e compartilhe resultados.",
    exportPdf: "Exportar PDF",
    exportCsv: "Exportar CSV",
    shareLink: "Compartilhar Link",
    clientReadyReport: "Relatório pronto para cliente",
    rawDataExport: "Exportação de dados brutos",
    shareableUrl: "URL compartilhável",
    unlockReport: "Desbloquear Relatório",
    unlockReportSubtitle: "Exportação PDF, link de compartilhamento, exportar dados e pacotes de correção.",
    summary: "Resumo",
    recommendations: "Recomendações",
    issuesFound: "Problemas Encontrados",
    checksPassed: "Verificações Aprovadas",
    reportRecommendations: "Relatório e Recomendações",
    fixCode: "Código de Correção + Recomendações",
    takeAction: "Tomar Ação",
    improvementsFound: "{{count}} melhorias encontradas",
    issuesDetected: "{{count}} problemas detectados",
    noIssuesFound: "Nenhum problema encontrado",
    excellentScore: "Excelente! Seu site segue as melhores práticas.",
    source: "fonte",
    sources: "fontes",
    issue: "problema",
    issues: "problemas",
    item: "item",
    items: "itens",
    new: "NOVO",
    review: "Revisar",
    na: "N/D",
    optimal: "Ótimo",
    acceptable: "Aceitável",
    tooMany: "Muitos",
    noDataAvailable: "Nenhum dado disponível",
    viewMore: "Ver Mais",
    viewLess: "Ver Menos",
    tabs: { summary: "Resumo", code: "Código", guide: "Guia de Correção" },
    priority: { critical: "Crítico", high: "Alto", medium: "Médio", low: "Baixo" },
    status: { excellent: "Excelente", good: "Bom", fair: "Regular", poor: "Ruim", critical: "Crítico", passing: "Aprovado", failing: "Falhando" },
    fix: { currentIssue: "Problema Atual", recommendedFix: "Correção Recomendada", stepByStepFix: "Correção Passo a Passo:", expectedImpact: "Impacto Esperado", howToFix: "Como corrigir:" },
    loading: { analyzing: "Analisando...", mayTake: "Isso pode levar {{seconds}} segundos" }
  },
  zh: {
    pageScreenshot: "页面截图",
    screenshotUnavailable: "截图不可用",
    exportShare: "导出与分享",
    downloadReports: "下载报告、导出数据并分享结果。",
    exportPdf: "导出PDF",
    exportCsv: "导出CSV",
    shareLink: "分享链接",
    clientReadyReport: "客户就绪报告",
    rawDataExport: "原始数据导出",
    shareableUrl: "可分享URL",
    unlockReport: "解锁报告",
    unlockReportSubtitle: "PDF导出、分享链接、数据导出和修复包。",
    summary: "摘要",
    recommendations: "建议",
    issuesFound: "发现问题",
    checksPassed: "检查通过",
    reportRecommendations: "报告与建议",
    fixCode: "修复代码 + 建议",
    takeAction: "采取行动",
    improvementsFound: "发现 {{count}} 项改进",
    issuesDetected: "检测到 {{count}} 个问题",
    noIssuesFound: "未发现问题",
    excellentScore: "太棒了！您的网站遵循最佳实践。",
    source: "来源",
    sources: "来源",
    issue: "问题",
    issues: "问题",
    item: "项目",
    items: "项目",
    new: "新",
    review: "审核",
    na: "不适用",
    optimal: "最佳",
    acceptable: "可接受",
    tooMany: "过多",
    noDataAvailable: "无可用数据",
    viewMore: "查看更多",
    viewLess: "收起",
    tabs: { summary: "摘要", code: "代码", guide: "修复指南" },
    priority: { critical: "严重", high: "高", medium: "中", low: "低" },
    status: { excellent: "优秀", good: "良好", fair: "一般", poor: "较差", critical: "严重", passing: "通过", failing: "失败" },
    fix: { currentIssue: "当前问题", recommendedFix: "建议修复", stepByStepFix: "逐步修复：", expectedImpact: "预期影响", howToFix: "修复方法：" },
    loading: { analyzing: "分析中...", mayTake: "这可能需要 {{seconds}} 秒" }
  },
  ja: {
    pageScreenshot: "ページスクリーンショット",
    screenshotUnavailable: "スクリーンショットが利用できません",
    exportShare: "エクスポートと共有",
    downloadReports: "レポートのダウンロード、データのエクスポート、結果の共有。",
    exportPdf: "PDFエクスポート",
    exportCsv: "CSVエクスポート",
    shareLink: "リンクを共有",
    clientReadyReport: "クライアント向けレポート",
    rawDataExport: "生データエクスポート",
    shareableUrl: "共有可能なURL",
    unlockReport: "レポートをアンロック",
    unlockReportSubtitle: "PDFエクスポート、共有リンク、データエクスポート、修正パック。",
    summary: "概要",
    recommendations: "推奨事項",
    issuesFound: "発見された問題",
    checksPassed: "合格したチェック",
    reportRecommendations: "レポートと推奨事項",
    fixCode: "修正コード + 推奨事項",
    takeAction: "アクションを実行",
    improvementsFound: "{{count}}件の改善点が見つかりました",
    issuesDetected: "{{count}}件の問題が検出されました",
    noIssuesFound: "問題は見つかりませんでした",
    excellentScore: "素晴らしい！サイトはベストプラクティスに従っています。",
    source: "ソース",
    sources: "ソース",
    issue: "問題",
    issues: "問題",
    item: "項目",
    items: "項目",
    new: "新規",
    review: "レビュー",
    na: "該当なし",
    optimal: "最適",
    acceptable: "許容範囲",
    tooMany: "多すぎます",
    noDataAvailable: "データがありません",
    viewMore: "もっと見る",
    viewLess: "閉じる",
    tabs: { summary: "概要", code: "コード", guide: "修正ガイド" },
    priority: { critical: "重大", high: "高", medium: "中", low: "低" },
    status: { excellent: "優秀", good: "良好", fair: "普通", poor: "不良", critical: "重大", passing: "合格", failing: "不合格" },
    fix: { currentIssue: "現在の問題", recommendedFix: "推奨される修正", stepByStepFix: "ステップバイステップの修正：", expectedImpact: "期待される影響", howToFix: "修正方法：" },
    loading: { analyzing: "分析中...", mayTake: "{{seconds}}秒かかる場合があります" }
  }
};

// Analyzer-specific translations
const analyzerTranslations = {
  es: {
    fonts: { title: "Informe de Fuentes y Tipografía", fontFamilies: "Familias de Fuentes", fontLoading: "Carga de Fuentes", fontWeights: "Pesos de Fuentes", fontStyles: "Estilos de Fuentes", fontSizes: "Tamaños de Fuentes", lineHeights: "Alturas de Línea", letterSpacing: "Espaciado de Letras", fallbacks: "Fuentes de Respaldo", webFonts: "Fuentes Web", systemFonts: "Fuentes del Sistema", customFonts: "Fuentes Personalizadas", fontDisplay: "Visualización de Fuentes", fontOptimization: "Optimización de Fuentes", fontSubsetting: "Subconjuntos de Fuentes", fontPreloading: "Precarga de Fuentes" },
    seo: { title: "Informe de Análisis SEO", metaTags: "Etiquetas Meta", headings: "Encabezados", links: "Enlaces", images: "Imágenes", structuredData: "Datos Estructurados", content: "Contenido", mobile: "Móvil", performance: "Rendimiento", security: "Seguridad", titleTag: "Etiqueta de Título", metaDescription: "Meta Descripción", canonicalUrl: "URL Canónica", robotsTxt: "Robots.txt", sitemap: "Mapa del Sitio", openGraph: "Open Graph", twitterCards: "Twitter Cards" },
    security: { title: "Informe de Análisis de Seguridad", headers: "Cabeceras de Seguridad", ssl: "Certificado SSL", https: "HTTPS", mixedContent: "Contenido Mixto", csp: "Política de Seguridad de Contenido", xss: "Protección XSS", clickjacking: "Protección Clickjacking", cookies: "Seguridad de Cookies" },
    accessibility: { title: "Informe de Accesibilidad", wcag: "Conformidad WCAG", ariaLabels: "Etiquetas ARIA", altText: "Texto Alternativo", colorContrast: "Contraste de Color", keyboardNav: "Navegación por Teclado", focusIndicators: "Indicadores de Enfoque", formLabels: "Etiquetas de Formulario", headingStructure: "Estructura de Encabezados" },
    performance: { title: "Informe de Rendimiento", loadTime: "Tiempo de Carga", ttfb: "Time to First Byte", fcp: "First Contentful Paint", lcp: "Largest Contentful Paint", cls: "Cumulative Layout Shift", tbt: "Total Blocking Time", tti: "Time to Interactive", resourceSize: "Tamaño de Recursos", caching: "Caché", compression: "Compresión" },
    cwv: { title: "Informe de Core Web Vitals", lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift", good: "Bueno", needsImprovement: "Necesita Mejora", poor: "Deficiente" },
    mobile: { title: "Informe de Pruebas Móviles", responsive: "Diseño Responsivo", viewport: "Configuración del Viewport", touchTargets: "Objetivos Táctiles", fontSizes: "Tamaños de Fuente" },
    brokenLinks: { title: "Análisis de Enlaces Rotos", total: "Total de Enlaces", broken: "Enlaces Rotos", working: "Enlaces Funcionando", redirects: "Redirecciones" },
    brand: { title: "Informe de Análisis de Marca", colors: "Colores", typography: "Tipografía", consistency: "Consistencia" },
    competitive: { title: "Informe de Análisis Competitivo", comparison: "Comparación", rankings: "Rankings" },
    cro: { title: "Informe CRO: Optimización de Conversiones", callsToAction: "Llamadas a la Acción", forms: "Formularios", navigation: "Navegación" },
    gdpr: { title: "Análisis de Cumplimiento de Privacidad", cookies: "Consentimiento de Cookies", tracking: "Rastreo", dataCollection: "Recopilación de Datos" },
    hosting: { title: "Resultados del Análisis de Alojamiento", server: "Servidor", cdn: "CDN", dns: "DNS" },
    ipReputation: { title: "Análisis de Reputación IP", status: "Estado", blacklists: "Listas Negras" },
    localSeo: { title: "Informe de SEO Local", nap: "NAP (Nombre, Dirección, Teléfono)", schema: "Schema Local" },
    siteCrawler: { title: "Informe del Rastreador de Sitios", pages: "Páginas", depth: "Profundidad" },
    tagIntelligence: { title: "Informe de Inteligencia de Etiquetas", scripts: "Scripts", tracking: "Rastreo", analytics: "Analíticas" }
  },
  fr: {
    fonts: { title: "Rapport Polices et Typographie", fontFamilies: "Familles de Polices", fontLoading: "Chargement des Polices", fontWeights: "Graisses de Police", fontStyles: "Styles de Police", fontSizes: "Tailles de Police", lineHeights: "Hauteurs de Ligne", letterSpacing: "Espacement des Lettres", fallbacks: "Polices de Secours", webFonts: "Polices Web", systemFonts: "Polices Système", customFonts: "Polices Personnalisées", fontDisplay: "Affichage des Polices", fontOptimization: "Optimisation des Polices", fontSubsetting: "Sous-ensemble de Polices", fontPreloading: "Préchargement des Polices" },
    seo: { title: "Rapport d'Analyse SEO", metaTags: "Balises Meta", headings: "Titres", links: "Liens", images: "Images", structuredData: "Données Structurées", content: "Contenu", mobile: "Mobile", performance: "Performance", security: "Sécurité", titleTag: "Balise Titre", metaDescription: "Meta Description", canonicalUrl: "URL Canonique", robotsTxt: "Robots.txt", sitemap: "Plan du Site", openGraph: "Open Graph", twitterCards: "Twitter Cards" },
    security: { title: "Rapport d'Analyse de Sécurité", headers: "En-têtes de Sécurité", ssl: "Certificat SSL", https: "HTTPS", mixedContent: "Contenu Mixte", csp: "Politique de Sécurité du Contenu", xss: "Protection XSS", clickjacking: "Protection Clickjacking", cookies: "Sécurité des Cookies" },
    accessibility: { title: "Rapport d'Accessibilité", wcag: "Conformité WCAG", ariaLabels: "Labels ARIA", altText: "Texte Alternatif", colorContrast: "Contraste des Couleurs", keyboardNav: "Navigation Clavier", focusIndicators: "Indicateurs de Focus", formLabels: "Labels de Formulaire", headingStructure: "Structure des Titres" },
    performance: { title: "Rapport de Performance", loadTime: "Temps de Chargement", ttfb: "Time to First Byte", fcp: "First Contentful Paint", lcp: "Largest Contentful Paint", cls: "Cumulative Layout Shift", tbt: "Total Blocking Time", tti: "Time to Interactive", resourceSize: "Taille des Ressources", caching: "Cache", compression: "Compression" },
    cwv: { title: "Rapport Core Web Vitals", lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift", good: "Bon", needsImprovement: "À Améliorer", poor: "Médiocre" },
    mobile: { title: "Rapport de Test Mobile", responsive: "Design Responsive", viewport: "Configuration du Viewport", touchTargets: "Cibles Tactiles", fontSizes: "Tailles de Police" },
    brokenLinks: { title: "Analyse des Liens Cassés", total: "Total des Liens", broken: "Liens Cassés", working: "Liens Fonctionnels", redirects: "Redirections" },
    brand: { title: "Rapport d'Analyse de Marque", colors: "Couleurs", typography: "Typographie", consistency: "Cohérence" },
    competitive: { title: "Rapport d'Analyse Concurrentielle", comparison: "Comparaison", rankings: "Classements" },
    cro: { title: "Rapport CRO : Optimisation des Conversions", callsToAction: "Appels à l'Action", forms: "Formulaires", navigation: "Navigation" },
    gdpr: { title: "Analyse de Conformité RGPD", cookies: "Consentement aux Cookies", tracking: "Suivi", dataCollection: "Collecte de Données" },
    hosting: { title: "Résultats d'Analyse d'Hébergement", server: "Serveur", cdn: "CDN", dns: "DNS" },
    ipReputation: { title: "Analyse de Réputation IP", status: "Statut", blacklists: "Listes Noires" },
    localSeo: { title: "Rapport SEO Local", nap: "NAP (Nom, Adresse, Téléphone)", schema: "Schema Local" },
    siteCrawler: { title: "Rapport du Crawler", pages: "Pages", depth: "Profondeur" },
    tagIntelligence: { title: "Rapport Tag Intelligence", scripts: "Scripts", tracking: "Suivi", analytics: "Analytics" }
  },
  de: {
    fonts: { title: "Schriften & Typografie Bericht", fontFamilies: "Schriftfamilien", fontLoading: "Schriftladung", fontWeights: "Schriftstärken", fontStyles: "Schriftstile", fontSizes: "Schriftgrößen", lineHeights: "Zeilenhöhen", letterSpacing: "Buchstabenabstand", fallbacks: "Ersatzschriften", webFonts: "Webschriften", systemFonts: "Systemschriften", customFonts: "Benutzerdefinierte Schriften", fontDisplay: "Schriftanzeige", fontOptimization: "Schriftoptimierung", fontSubsetting: "Schrift-Subsetting", fontPreloading: "Schrift-Preloading" },
    seo: { title: "SEO-Analyse Bericht", metaTags: "Meta-Tags", headings: "Überschriften", links: "Links", images: "Bilder", structuredData: "Strukturierte Daten", content: "Inhalt", mobile: "Mobil", performance: "Leistung", security: "Sicherheit", titleTag: "Title-Tag", metaDescription: "Meta-Beschreibung", canonicalUrl: "Kanonische URL", robotsTxt: "Robots.txt", sitemap: "Sitemap", openGraph: "Open Graph", twitterCards: "Twitter Cards" },
    security: { title: "Sicherheitsanalyse Bericht", headers: "Sicherheits-Header", ssl: "SSL-Zertifikat", https: "HTTPS", mixedContent: "Gemischter Inhalt", csp: "Content Security Policy", xss: "XSS-Schutz", clickjacking: "Clickjacking-Schutz", cookies: "Cookie-Sicherheit" },
    accessibility: { title: "Barrierefreiheitsbericht", wcag: "WCAG-Konformität", ariaLabels: "ARIA-Labels", altText: "Alternativtext", colorContrast: "Farbkontrast", keyboardNav: "Tastaturnavigation", focusIndicators: "Fokusindikatoren", formLabels: "Formularlabels", headingStructure: "Überschriftenstruktur" },
    performance: { title: "Leistungsbericht", loadTime: "Ladezeit", ttfb: "Time to First Byte", fcp: "First Contentful Paint", lcp: "Largest Contentful Paint", cls: "Cumulative Layout Shift", tbt: "Total Blocking Time", tti: "Time to Interactive", resourceSize: "Ressourcengröße", caching: "Caching", compression: "Komprimierung" },
    cwv: { title: "Core Web Vitals Bericht", lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift", good: "Gut", needsImprovement: "Verbesserungsbedarf", poor: "Schlecht" },
    mobile: { title: "Mobiltest-Bericht", responsive: "Responsives Design", viewport: "Viewport-Einstellung", touchTargets: "Touch-Ziele", fontSizes: "Schriftgrößen" },
    brokenLinks: { title: "Analyse Defekter Links", total: "Gesamtlinks", broken: "Defekte Links", working: "Funktionierende Links", redirects: "Weiterleitungen" },
    brand: { title: "Markenanalyse-Bericht", colors: "Farben", typography: "Typografie", consistency: "Konsistenz" },
    competitive: { title: "Wettbewerbsanalyse-Bericht", comparison: "Vergleich", rankings: "Rankings" },
    cro: { title: "CRO-Bericht: Conversion-Optimierung", callsToAction: "Handlungsaufforderungen", forms: "Formulare", navigation: "Navigation" },
    gdpr: { title: "DSGVO-Konformitätsanalyse", cookies: "Cookie-Einwilligung", tracking: "Tracking", dataCollection: "Datenerfassung" },
    hosting: { title: "Hosting-Analyse Ergebnisse", server: "Server", cdn: "CDN", dns: "DNS" },
    ipReputation: { title: "IP-Reputationsanalyse", status: "Status", blacklists: "Blacklists" },
    localSeo: { title: "Lokaler SEO-Bericht", nap: "NAP (Name, Adresse, Telefon)", schema: "Lokales Schema" },
    siteCrawler: { title: "Site-Crawler-Bericht", pages: "Seiten", depth: "Tiefe" },
    tagIntelligence: { title: "Tag Intelligence Bericht", scripts: "Skripte", tracking: "Tracking", analytics: "Analytics" }
  },
  pt: {
    fonts: { title: "Relatório de Fontes e Tipografia", fontFamilies: "Famílias de Fontes", fontLoading: "Carregamento de Fontes", fontWeights: "Pesos de Fonte", fontStyles: "Estilos de Fonte", fontSizes: "Tamanhos de Fonte", lineHeights: "Alturas de Linha", letterSpacing: "Espaçamento de Letras", fallbacks: "Fontes de Fallback", webFonts: "Fontes Web", systemFonts: "Fontes do Sistema", customFonts: "Fontes Personalizadas", fontDisplay: "Exibição de Fonte", fontOptimization: "Otimização de Fonte", fontSubsetting: "Subsetting de Fonte", fontPreloading: "Preloading de Fonte" },
    seo: { title: "Relatório de Análise SEO", metaTags: "Meta Tags", headings: "Cabeçalhos", links: "Links", images: "Imagens", structuredData: "Dados Estruturados", content: "Conteúdo", mobile: "Mobile", performance: "Performance", security: "Segurança", titleTag: "Tag de Título", metaDescription: "Meta Descrição", canonicalUrl: "URL Canônica", robotsTxt: "Robots.txt", sitemap: "Mapa do Site", openGraph: "Open Graph", twitterCards: "Twitter Cards" },
    security: { title: "Relatório de Análise de Segurança", headers: "Cabeçalhos de Segurança", ssl: "Certificado SSL", https: "HTTPS", mixedContent: "Conteúdo Misto", csp: "Política de Segurança de Conteúdo", xss: "Proteção XSS", clickjacking: "Proteção Clickjacking", cookies: "Segurança de Cookies" },
    accessibility: { title: "Relatório de Acessibilidade", wcag: "Conformidade WCAG", ariaLabels: "Labels ARIA", altText: "Texto Alternativo", colorContrast: "Contraste de Cores", keyboardNav: "Navegação por Teclado", focusIndicators: "Indicadores de Foco", formLabels: "Labels de Formulário", headingStructure: "Estrutura de Cabeçalhos" },
    performance: { title: "Relatório de Performance", loadTime: "Tempo de Carregamento", ttfb: "Time to First Byte", fcp: "First Contentful Paint", lcp: "Largest Contentful Paint", cls: "Cumulative Layout Shift", tbt: "Total Blocking Time", tti: "Time to Interactive", resourceSize: "Tamanho dos Recursos", caching: "Cache", compression: "Compressão" },
    cwv: { title: "Relatório Core Web Vitals", lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift", good: "Bom", needsImprovement: "Precisa Melhorar", poor: "Ruim" },
    mobile: { title: "Relatório de Teste Mobile", responsive: "Design Responsivo", viewport: "Configuração do Viewport", touchTargets: "Alvos de Toque", fontSizes: "Tamanhos de Fonte" },
    brokenLinks: { title: "Análise de Links Quebrados", total: "Total de Links", broken: "Links Quebrados", working: "Links Funcionando", redirects: "Redirecionamentos" },
    brand: { title: "Relatório de Análise de Marca", colors: "Cores", typography: "Tipografia", consistency: "Consistência" },
    competitive: { title: "Relatório de Análise Competitiva", comparison: "Comparação", rankings: "Rankings" },
    cro: { title: "Relatório CRO: Otimização de Conversões", callsToAction: "Chamadas para Ação", forms: "Formulários", navigation: "Navegação" },
    gdpr: { title: "Análise de Conformidade LGPD/GDPR", cookies: "Consentimento de Cookies", tracking: "Rastreamento", dataCollection: "Coleta de Dados" },
    hosting: { title: "Resultados da Análise de Hospedagem", server: "Servidor", cdn: "CDN", dns: "DNS" },
    ipReputation: { title: "Análise de Reputação IP", status: "Status", blacklists: "Blacklists" },
    localSeo: { title: "Relatório de SEO Local", nap: "NAP (Nome, Endereço, Telefone)", schema: "Schema Local" },
    siteCrawler: { title: "Relatório do Crawler", pages: "Páginas", depth: "Profundidade" },
    tagIntelligence: { title: "Relatório Tag Intelligence", scripts: "Scripts", tracking: "Rastreamento", analytics: "Analytics" }
  },
  zh: {
    fonts: { title: "字体与排版报告", fontFamilies: "字体系列", fontLoading: "字体加载", fontWeights: "字体粗细", fontStyles: "字体样式", fontSizes: "字体大小", lineHeights: "行高", letterSpacing: "字母间距", fallbacks: "后备字体", webFonts: "网页字体", systemFonts: "系统字体", customFonts: "自定义字体", fontDisplay: "字体显示", fontOptimization: "字体优化", fontSubsetting: "字体子集", fontPreloading: "字体预加载" },
    seo: { title: "SEO分析报告", metaTags: "Meta标签", headings: "标题", links: "链接", images: "图片", structuredData: "结构化数据", content: "内容", mobile: "移动端", performance: "性能", security: "安全", titleTag: "标题标签", metaDescription: "Meta描述", canonicalUrl: "规范URL", robotsTxt: "Robots.txt", sitemap: "网站地图", openGraph: "Open Graph", twitterCards: "Twitter Cards" },
    security: { title: "安全分析报告", headers: "安全标头", ssl: "SSL证书", https: "HTTPS", mixedContent: "混合内容", csp: "内容安全策略", xss: "XSS防护", clickjacking: "点击劫持防护", cookies: "Cookie安全" },
    accessibility: { title: "无障碍报告", wcag: "WCAG合规", ariaLabels: "ARIA标签", altText: "替代文本", colorContrast: "颜色对比度", keyboardNav: "键盘导航", focusIndicators: "焦点指示器", formLabels: "表单标签", headingStructure: "标题结构" },
    performance: { title: "性能报告", loadTime: "加载时间", ttfb: "首字节时间", fcp: "首次内容绘制", lcp: "最大内容绘制", cls: "累积布局偏移", tbt: "总阻塞时间", tti: "可交互时间", resourceSize: "资源大小", caching: "缓存", compression: "压缩" },
    cwv: { title: "核心Web指标报告", lcp: "最大内容绘制", inp: "交互到下一次绘制", cls: "累积布局偏移", good: "良好", needsImprovement: "需要改进", poor: "较差" },
    mobile: { title: "移动端测试报告", responsive: "响应式设计", viewport: "视口设置", touchTargets: "触摸目标", fontSizes: "字体大小" },
    brokenLinks: { title: "死链分析", total: "链接总数", broken: "死链", working: "正常链接", redirects: "重定向" },
    brand: { title: "品牌分析报告", colors: "颜色", typography: "排版", consistency: "一致性" },
    competitive: { title: "竞争分析报告", comparison: "对比", rankings: "排名" },
    cro: { title: "CRO报告：转化优化", callsToAction: "行动号召", forms: "表单", navigation: "导航" },
    gdpr: { title: "隐私合规分析", cookies: "Cookie同意", tracking: "跟踪", dataCollection: "数据收集" },
    hosting: { title: "托管分析结果", server: "服务器", cdn: "CDN", dns: "DNS" },
    ipReputation: { title: "IP信誉分析", status: "状态", blacklists: "黑名单" },
    localSeo: { title: "本地SEO报告", nap: "NAP（名称、地址、电话）", schema: "本地Schema" },
    siteCrawler: { title: "网站爬虫报告", pages: "页面", depth: "深度" },
    tagIntelligence: { title: "标签智能报告", scripts: "脚本", tracking: "跟踪", analytics: "分析" }
  },
  ja: {
    fonts: { title: "フォント＆タイポグラフィレポート", fontFamilies: "フォントファミリー", fontLoading: "フォント読み込み", fontWeights: "フォントウェイト", fontStyles: "フォントスタイル", fontSizes: "フォントサイズ", lineHeights: "行の高さ", letterSpacing: "文字間隔", fallbacks: "フォールバックフォント", webFonts: "Webフォント", systemFonts: "システムフォント", customFonts: "カスタムフォント", fontDisplay: "フォント表示", fontOptimization: "フォント最適化", fontSubsetting: "フォントサブセット", fontPreloading: "フォントプリロード" },
    seo: { title: "SEO分析レポート", metaTags: "メタタグ", headings: "見出し", links: "リンク", images: "画像", structuredData: "構造化データ", content: "コンテンツ", mobile: "モバイル", performance: "パフォーマンス", security: "セキュリティ", titleTag: "タイトルタグ", metaDescription: "メタディスクリプション", canonicalUrl: "正規URL", robotsTxt: "Robots.txt", sitemap: "サイトマップ", openGraph: "Open Graph", twitterCards: "Twitterカード" },
    security: { title: "セキュリティ分析レポート", headers: "セキュリティヘッダー", ssl: "SSL証明書", https: "HTTPS", mixedContent: "混合コンテンツ", csp: "コンテンツセキュリティポリシー", xss: "XSS保護", clickjacking: "クリックジャッキング保護", cookies: "Cookie セキュリティ" },
    accessibility: { title: "アクセシビリティレポート", wcag: "WCAG準拠", ariaLabels: "ARIAラベル", altText: "代替テキスト", colorContrast: "色のコントラスト", keyboardNav: "キーボードナビゲーション", focusIndicators: "フォーカスインジケーター", formLabels: "フォームラベル", headingStructure: "見出し構造" },
    performance: { title: "パフォーマンスレポート", loadTime: "読み込み時間", ttfb: "Time to First Byte", fcp: "First Contentful Paint", lcp: "Largest Contentful Paint", cls: "Cumulative Layout Shift", tbt: "Total Blocking Time", tti: "Time to Interactive", resourceSize: "リソースサイズ", caching: "キャッシング", compression: "圧縮" },
    cwv: { title: "Core Web Vitalsレポート", lcp: "Largest Contentful Paint", inp: "Interaction to Next Paint", cls: "Cumulative Layout Shift", good: "良好", needsImprovement: "改善が必要", poor: "不良" },
    mobile: { title: "モバイルテストレポート", responsive: "レスポンシブデザイン", viewport: "ビューポート設定", touchTargets: "タッチターゲット", fontSizes: "フォントサイズ" },
    brokenLinks: { title: "リンク切れ分析", total: "リンク合計", broken: "リンク切れ", working: "正常なリンク", redirects: "リダイレクト" },
    brand: { title: "ブランド分析レポート", colors: "カラー", typography: "タイポグラフィ", consistency: "一貫性" },
    competitive: { title: "競合分析レポート", comparison: "比較", rankings: "ランキング" },
    cro: { title: "CROレポート：コンバージョン最適化", callsToAction: "コールトゥアクション", forms: "フォーム", navigation: "ナビゲーション" },
    gdpr: { title: "プライバシーコンプライアンス分析", cookies: "Cookieの同意", tracking: "トラッキング", dataCollection: "データ収集" },
    hosting: { title: "ホスティング分析結果", server: "サーバー", cdn: "CDN", dns: "DNS" },
    ipReputation: { title: "IP評価分析", status: "ステータス", blacklists: "ブラックリスト" },
    localSeo: { title: "ローカルSEOレポート", nap: "NAP（名前、住所、電話番号）", schema: "ローカルSchema" },
    siteCrawler: { title: "サイトクローラーレポート", pages: "ページ", depth: "深度" },
    tagIntelligence: { title: "タグインテリジェンスレポート", scripts: "スクリプト", tracking: "トラッキング", analytics: "アナリティクス" }
  }
};

// Mode labels translations
const modeLabelsTranslations = {
  es: { full: "Auditoría Lighthouse", cwv: "Core Web Vitals", quick: "Escaneo Rápido", performance: "Análisis de Rendimiento", seo: "Análisis SEO", accessibility: "Auditoría de Accesibilidad", security: "Análisis de Seguridad", mobile: "Prueba Móvil", cro: "Optimización de Conversión", fonts: "Análisis de Fuentes", brand: "Consistencia de Marca", competitive: "Análisis Competitivo", hosting: "Análisis de Alojamiento", crawler: "Rastreador de Sitios", brokenLinks: "Enlaces Rotos", gdpr: "Cumplimiento RGPD", localSeo: "SEO Local", tagIntelligence: "Inteligencia de Etiquetas", ipReputation: "Reputación IP" },
  fr: { full: "Audit Lighthouse", cwv: "Core Web Vitals", quick: "Scan Rapide", performance: "Analyse de Performance", seo: "Analyse SEO", accessibility: "Audit d'Accessibilité", security: "Analyse de Sécurité", mobile: "Test Mobile", cro: "Optimisation des Conversions", fonts: "Analyse des Polices", brand: "Cohérence de Marque", competitive: "Analyse Concurrentielle", hosting: "Analyse d'Hébergement", crawler: "Crawler de Site", brokenLinks: "Liens Cassés", gdpr: "Conformité RGPD", localSeo: "SEO Local", tagIntelligence: "Intelligence de Tags", ipReputation: "Réputation IP" },
  de: { full: "Lighthouse-Audit", cwv: "Core Web Vitals", quick: "Schnellscan", performance: "Leistungsanalyse", seo: "SEO-Analyse", accessibility: "Barrierefreiheits-Audit", security: "Sicherheitsanalyse", mobile: "Mobiltest", cro: "Conversion-Optimierung", fonts: "Schriftanalyse", brand: "Markenkonsistenz", competitive: "Wettbewerbsanalyse", hosting: "Hosting-Analyse", crawler: "Site-Crawler", brokenLinks: "Defekte Links", gdpr: "DSGVO-Konformität", localSeo: "Lokales SEO", tagIntelligence: "Tag-Intelligence", ipReputation: "IP-Reputation" },
  pt: { full: "Auditoria Lighthouse", cwv: "Core Web Vitals", quick: "Verificação Rápida", performance: "Análise de Performance", seo: "Análise SEO", accessibility: "Auditoria de Acessibilidade", security: "Análise de Segurança", mobile: "Teste Mobile", cro: "Otimização de Conversão", fonts: "Análise de Fontes", brand: "Consistência de Marca", competitive: "Análise Competitiva", hosting: "Análise de Hospedagem", crawler: "Crawler de Site", brokenLinks: "Links Quebrados", gdpr: "Conformidade LGPD", localSeo: "SEO Local", tagIntelligence: "Inteligência de Tags", ipReputation: "Reputação IP" },
  zh: { full: "Lighthouse审计", cwv: "核心Web指标", quick: "快速扫描", performance: "性能分析", seo: "SEO分析", accessibility: "无障碍审计", security: "安全分析", mobile: "移动端测试", cro: "转化优化", fonts: "字体分析", brand: "品牌一致性", competitive: "竞争分析", hosting: "托管分析", crawler: "网站爬虫", brokenLinks: "死链", gdpr: "GDPR合规", localSeo: "本地SEO", tagIntelligence: "标签智能", ipReputation: "IP信誉" },
  ja: { full: "Lighthouse監査", cwv: "Core Web Vitals", quick: "クイックスキャン", performance: "パフォーマンス分析", seo: "SEO分析", accessibility: "アクセシビリティ監査", security: "セキュリティ分析", mobile: "モバイルテスト", cro: "コンバージョン最適化", fonts: "フォント分析", brand: "ブランド一貫性", competitive: "競合分析", hosting: "ホスティング分析", crawler: "サイトクローラー", brokenLinks: "リンク切れ", gdpr: "GDPR準拠", localSeo: "ローカルSEO", tagIntelligence: "タグインテリジェンス", ipReputation: "IP評価" }
};

// Deep merge helper
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Build reports namespace
if (!current.reports) current.reports = {};
if (!current.reports.common) current.reports.common = {};
if (!current.reports.modeLabels) current.reports.modeLabels = {};

// Add common translations
deepMerge(current.reports.common, commonTranslations[lang]);

// Add analyzer translations
deepMerge(current.reports, analyzerTranslations[lang]);

// Add mode labels
Object.assign(current.reports.modeLabels, modeLabelsTranslations[lang]);

// Write back
fs.writeFileSync(targetFile, JSON.stringify(current, null, 2) + '\n', 'utf8');

const commonCount = Object.keys(commonTranslations[lang]).length;
const analyzerCount = Object.keys(analyzerTranslations[lang]).length;
console.log(`✓ Updated ${targetFile}`);
console.log(`  - ${commonCount} common translations`);
console.log(`  - ${analyzerCount} analyzer sections`);
console.log(`  - ${Object.keys(modeLabelsTranslations[lang]).length} mode labels`);
