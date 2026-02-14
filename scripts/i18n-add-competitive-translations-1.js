#!/usr/bin/env node
/**
 * i18n-add-competitive-translations-1.js
 *
 * Adds the first batch (~80 keys) of missing competitive report translations
 * for all 7 non-English languages: de, es, fr, ja, pt, zh, ru.
 *
 * Keys live under reports.competitive.* namespace.
 * In the translations object we use "competitive.*" (no "reports." prefix).
 *
 * Usage: node scripts/i18n-add-competitive-translations-1.js
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
// Each language maps flat keys (under "competitive.") to translated values.
// These get merged into reports.competitive.* in each language file.
// ============================================================

const translations = {
  de: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "Wettbewerber {{num}} URL",
    "competitive.analysisFailed": "Analyse fehlgeschlagen",
    "competitive.errorMissingYourSite": "Ungültige Antwortstruktur: Daten Ihrer Website fehlen",
    "competitive.errorMissingScores": "Ungültige Antwortstruktur: Bewertungsdaten fehlen",
    "competitive.unlockToSeeRecommendations": "Freischalten, um detaillierte Empfehlungen zu sehen",
    "competitive.proFeature1": "Priorisierte Maßnahmen",
    "competitive.proFeature2": "Details zur Lückenanalyse",
    "competitive.proFeature3": "Implementierungsleitfaden",
    "competitive.compareMetricsCharts": "Vergleichen Sie die Leistung über alle Metriken mit interaktiven Diagrammen",
    "competitive.radarView": "Radaransicht",
    "competitive.barChart": "Balkendiagramm",
    "competitive.completeScoreBreakdown": "Vollständige Bewertungsaufschlüsselung mit individuellen Metrikdetails für jede Website",
    "competitive.site": "Website",
    "competitive.you": "SIE",
    "competitive.analysisError": "Analysefehler",
    "competitive.analyzerFailureNote": "Mit X markierte Bewertungen weisen auf Analysefehler hin (typischerweise durch Lighthouse-Timeouts oder Website-Einschränkungen). Diese Metriken werden von der Gesamtbewertung ausgeschlossen, um Genauigkeit zu gewährleisten.",
    "competitive.missingDataExecutiveSummary": "Fehlende Daten für die Zusammenfassung",
    "competitive.noValidCompetitorScores": "Keine gültigen Wettbewerberbewertungen verfügbar",

    // --- Rankings & Scores ---
    "competitive.competitive": "WETTBEWERB",
    "competitive.grade": "Bewertung",
    "competitive.ranked": "Platziert",
    "competitive.outOf": "von",
    "competitive.competitorsAnalyzed": "analysierte Wettbewerber",
    "competitive.winningIn": "Führend in",
    "competitive.categories": "Kategorien",
    "competitive.avgCompetitor": "Durchschn. Wettbewerber",
    "competitive.score": "Punktzahl",
    "competitive.gapToLeader": "Abstand zum Führenden",
    "competitive.points": "Punkte",
    "competitive.priorityFocus": "Prioritätsfokus",
    "competitive.fixWeaknesses": "{{count}} Schwachstelle beheben",
    "competitive.maintainLead": "Vorsprung halten",
    "competitive.analysis": "Analyse",

    // --- Your Rankings table ---
    "competitive.yourRankings": "Ihre Platzierungen",
    "competitive.metric": "Metrik",
    "competitive.medal": "Medaille",
    "competitive.rank": "Rang",
    "competitive.status": "Status",
    "competitive.recommendedAction": "Empfohlene Maßnahme",
    "competitive.allFailed": "Alle fehlgeschlagen",
    "competitive.fixAnalysisErrors": "Analysefehler beheben – Zugänglichkeit der Website prüfen",
    "competitive.leading": "Führend!",
    "competitive.maintainPosition": "Position halten – Wettbewerber beobachten",
    "competitive.strong": "Stark",
    "competitive.pushToFirst": "Auf Platz 1 vorstoßen – kleinere Optimierungen nötig",
    "competitive.competitiveStatus": "Wettbewerbsfähig",
    "competitive.improveGapClosing": "{{metric}} verbessern – Chance zur Lückenverkleinerung",
    "competitive.behind": "Zurückliegend",
    "competitive.priorityOverhaul": "Priorität: {{metric}}-Überarbeitung erforderlich",
    "competitive.midPack": "Mittelfeld",
    "competitive.targetImprovements": "{{metric}}-Verbesserungen für Rangaufstieg anstreben",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "Allseitige Exzellenz beibehalten",
    "competitive.rec.overallLast": "Verbesserung mehrerer Metriken nötig – mit dem schwächsten Bereich beginnen",
    "competitive.rec.overallMid": "Auf die am schlechtesten bewerteten Einzelmetriken konzentrieren",
    "competitive.rec.seoFirst": "Keyword-Rankings überwachen und halten",
    "competitive.rec.seoImprove": "Meta-Tags, Inhalte und interne Verlinkung optimieren",
    "competitive.rec.performanceFirst": "Ladezeiten optimiert halten",
    "competitive.rec.performanceImprove": "Seitengröße reduzieren, Bilder optimieren, Caching aktivieren",
    "competitive.rec.cwvFirst": "LCP-/FCP-/CLS-Werte beibehalten",
    "competitive.rec.cwvImprove": "LCP (<2,5s), FCP (<1,8s), CLS (<0,1) verbessern",
    "competitive.rec.a11yFirst": "Hohe Barrierefreiheitsstandards beibehalten",
    "competitive.rec.a11yImprove": "Alt-Texte hinzufügen, Kontrast verbessern, ARIA-Labels korrigieren",
    "competitive.rec.securityFirst": "Bewährte Sicherheitspraktiken beibehalten",
    "competitive.rec.securityImprove": "HTTPS aktivieren, Sicherheitsheader hinzufügen, Protokolle aktualisieren",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "Keine Einblicke verfügbar.",
    "competitive.allSitesFailed": "Alle Websites fehlgeschlagen",
    "competitive.seeWhereYouStand": "Sehen Sie genau, wie Sie im Vergleich zu jedem Wettbewerber in jeder Kategorie abschneiden",
    "competitive.behindLeader": "hinter dem Führenden",
    "competitive.ahead": "voraus!",
    "competitive.yourRank": "Ihr Rang",
    "competitive.winning": "FÜHREND",
    "competitive.tied": "GLEICHAUF",
    "competitive.losing": "ZURÜCKLIEGEND",
    "competitive.avg": "Durchschn.",
    "competitive.best": "Beste",
    "competitive.thPercentile": ". Perzentil",
    "competitive.clickEachMetric": "Klicken Sie auf jede Metrik unten, um eine detaillierte Wettbewerbsanalyse und umsetzbare Einblicke zu erhalten.",
    "competitive.website": "Website",
    "competitive.detailedMetricAnalysis": "Detaillierte Metrikanalyse",
    "competitive.youreLeading": "Sie",
    "competitive.pointsBehind": "{{gap}} Punkte hinter {{leader}}",
    "competitive.yourScore": "Ihre Punktzahl",
    "competitive.opportunity": "CHANCE",
    "competitive.actionSteps": "Maßnahmen",
    "competitive.bestCompetitor": "Bester Wettbewerber",
    "competitive.competitiveAdvantage": "Wettbewerbsvorteil",
    "competitive.improvementOpportunity": "Verbesserungsmöglichkeit",
    "competitive.outperformingCompetitors": "Sie",
    "competitive.closingGapHelp": "Das Schließen dieser {{gap}}-Punkte-Lücke könnte Ihre Wettbewerbsposition erheblich verbessern. {{leader}} setzt hier den Maßstab.",
    "competitive.leaderboard": "Rangliste",
    "competitive.whatThisMeans": "Was das bedeutet",
    "competitive.maintainYourLead": "Ihren Vorsprung halten",
    "competitive.closeTheGap": "Die Lücke schließen",
    "competitive.proTip": "Profi-Tipp",
  },

  es: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "URL del competidor {{num}}",
    "competitive.analysisFailed": "Análisis fallido",
    "competitive.errorMissingYourSite": "Estructura de respuesta inválida: faltan datos de su sitio",
    "competitive.errorMissingScores": "Estructura de respuesta inválida: faltan datos de puntuación",
    "competitive.unlockToSeeRecommendations": "Desbloquear para ver recomendaciones detalladas",
    "competitive.proFeature1": "Acciones priorizadas",
    "competitive.proFeature2": "Detalles del análisis de brechas",
    "competitive.proFeature3": "Guía de implementación",
    "competitive.compareMetricsCharts": "Compare el rendimiento en todas las métricas con gráficos interactivos",
    "competitive.radarView": "Vista de radar",
    "competitive.barChart": "Gráfico de barras",
    "competitive.completeScoreBreakdown": "Desglose completo de puntuaciones con detalles de métricas individuales para cada sitio",
    "competitive.site": "Sitio",
    "competitive.you": "TÚ",
    "competitive.analysisError": "Error de análisis",
    "competitive.analyzerFailureNote": "Las puntuaciones marcadas con X indican fallos del analizador (generalmente por timeouts de Lighthouse o restricciones del sitio). Estas métricas se excluyen del cálculo de la puntuación general para garantizar la precisión.",
    "competitive.missingDataExecutiveSummary": "Faltan datos para el resumen ejecutivo",
    "competitive.noValidCompetitorScores": "No hay puntuaciones válidas de competidores disponibles",

    // --- Rankings & Scores ---
    "competitive.competitive": "COMPETITIVO",
    "competitive.grade": "Calificación",
    "competitive.ranked": "Clasificado",
    "competitive.outOf": "de",
    "competitive.competitorsAnalyzed": "competidores analizados",
    "competitive.winningIn": "Ganando en",
    "competitive.categories": "categorías",
    "competitive.avgCompetitor": "Competidor promedio",
    "competitive.score": "puntuación",
    "competitive.gapToLeader": "Brecha con el líder",
    "competitive.points": "puntos",
    "competitive.priorityFocus": "Enfoque prioritario",
    "competitive.fixWeaknesses": "Corregir {{count}} debilidad",
    "competitive.maintainLead": "Mantener ventaja",
    "competitive.analysis": "análisis",

    // --- Your Rankings table ---
    "competitive.yourRankings": "Tus clasificaciones",
    "competitive.metric": "Métrica",
    "competitive.medal": "Medalla",
    "competitive.rank": "Rango",
    "competitive.status": "Estado",
    "competitive.recommendedAction": "Acción recomendada",
    "competitive.allFailed": "Todos fallaron",
    "competitive.fixAnalysisErrors": "Corregir errores de análisis – verificar accesibilidad del sitio",
    "competitive.leading": "¡Liderando!",
    "competitive.maintainPosition": "Mantener posición – monitorear competidores",
    "competitive.strong": "Fuerte",
    "competitive.pushToFirst": "Impulsar al #1 – se necesitan optimizaciones menores",
    "competitive.competitiveStatus": "Competitivo",
    "competitive.improveGapClosing": "Mejorar {{metric}} – oportunidad de cerrar brecha",
    "competitive.behind": "Rezagado",
    "competitive.priorityOverhaul": "Prioridad: revisión de {{metric}} necesaria",
    "competitive.midPack": "En el medio",
    "competitive.targetImprovements": "Apuntar mejoras en {{metric}} para ganar posiciones",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "Mantener la excelencia general",
    "competitive.rec.overallLast": "Se necesita mejora en múltiples métricas – comenzar por el área más débil",
    "competitive.rec.overallMid": "Enfocarse en las métricas individuales con menor puntuación",
    "competitive.rec.seoFirst": "Monitorear rankings de palabras clave y mantener",
    "competitive.rec.seoImprove": "Optimizar meta tags, contenido y enlaces internos",
    "competitive.rec.performanceFirst": "Mantener los tiempos de carga optimizados",
    "competitive.rec.performanceImprove": "Reducir tamaño de página, optimizar imágenes, habilitar caché",
    "competitive.rec.cwvFirst": "Mantener puntuaciones de LCP/FCP/CLS",
    "competitive.rec.cwvImprove": "Mejorar LCP (<2.5s), FCP (<1.8s), CLS (<0.1)",
    "competitive.rec.a11yFirst": "Mantener altos estándares de accesibilidad",
    "competitive.rec.a11yImprove": "Agregar texto alternativo, mejorar contraste, corregir etiquetas ARIA",
    "competitive.rec.securityFirst": "Mantener las mejores prácticas de seguridad",
    "competitive.rec.securityImprove": "Habilitar HTTPS, agregar encabezados de seguridad, actualizar protocolos",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "No hay información disponible.",
    "competitive.allSitesFailed": "Todos los sitios fallaron",
    "competitive.seeWhereYouStand": "Vea exactamente cómo se posiciona frente a cada competidor en cada categoría",
    "competitive.behindLeader": "detrás del líder",
    "competitive.ahead": "¡adelante!",
    "competitive.yourRank": "Tu clasificación",
    "competitive.winning": "GANANDO",
    "competitive.tied": "EMPATADO",
    "competitive.losing": "PERDIENDO",
    "competitive.avg": "Prom.",
    "competitive.best": "Mejor",
    "competitive.thPercentile": "° percentil",
    "competitive.clickEachMetric": "Haz clic en cada métrica a continuación para ver el análisis competitivo detallado y las recomendaciones prácticas.",
    "competitive.website": "Sitio web",
    "competitive.detailedMetricAnalysis": "Análisis detallado de métricas",
    "competitive.youreLeading": "Tú",
    "competitive.pointsBehind": "{{gap}} puntos detrás de {{leader}}",
    "competitive.yourScore": "Tu puntuación",
    "competitive.opportunity": "OPORTUNIDAD",
    "competitive.actionSteps": "Pasos de acción",
    "competitive.bestCompetitor": "Mejor competidor",
    "competitive.competitiveAdvantage": "Ventaja competitiva",
    "competitive.improvementOpportunity": "Oportunidad de mejora",
    "competitive.outperformingCompetitors": "Tú",
    "competitive.closingGapHelp": "Cerrar esta brecha de {{gap}} puntos podría mejorar significativamente tu posición competitiva. {{leader}} está estableciendo el estándar aquí.",
    "competitive.leaderboard": "Tabla de posiciones",
    "competitive.whatThisMeans": "Qué significa esto",
    "competitive.maintainYourLead": "Mantén tu ventaja",
    "competitive.closeTheGap": "Cierra la brecha",
    "competitive.proTip": "Consejo profesional",
  },

  fr: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "URL du concurrent {{num}}",
    "competitive.analysisFailed": "Analyse échouée",
    "competitive.errorMissingYourSite": "Structure de réponse invalide : données de votre site manquantes",
    "competitive.errorMissingScores": "Structure de réponse invalide : données de scores manquantes",
    "competitive.unlockToSeeRecommendations": "Débloquer pour voir les recommandations détaillées",
    "competitive.proFeature1": "Actions prioritaires",
    "competitive.proFeature2": "Détails de l'analyse des écarts",
    "competitive.proFeature3": "Guide d'implémentation",
    "competitive.compareMetricsCharts": "Comparez les performances sur toutes les métriques avec des graphiques interactifs",
    "competitive.radarView": "Vue radar",
    "competitive.barChart": "Graphique en barres",
    "competitive.completeScoreBreakdown": "Détail complet des scores avec les métriques individuelles pour chaque site",
    "competitive.site": "Site",
    "competitive.you": "VOUS",
    "competitive.analysisError": "Erreur d'analyse",
    "competitive.analyzerFailureNote": "Les scores marqués d'un X indiquent des échecs d'analyse (généralement dus à des timeouts Lighthouse ou des restrictions du site). Ces métriques sont exclues du calcul du score global pour garantir la précision.",
    "competitive.missingDataExecutiveSummary": "Données manquantes pour le résumé exécutif",
    "competitive.noValidCompetitorScores": "Aucun score de concurrent valide disponible",

    // --- Rankings & Scores ---
    "competitive.competitive": "COMPÉTITIF",
    "competitive.grade": "Note",
    "competitive.ranked": "Classé",
    "competitive.outOf": "sur",
    "competitive.competitorsAnalyzed": "concurrents analysés",
    "competitive.winningIn": "En tête dans",
    "competitive.categories": "catégories",
    "competitive.avgCompetitor": "Concurrent moyen",
    "competitive.score": "score",
    "competitive.gapToLeader": "Écart avec le leader",
    "competitive.points": "points",
    "competitive.priorityFocus": "Priorité principale",
    "competitive.fixWeaknesses": "Corriger {{count}} faiblesse",
    "competitive.maintainLead": "Maintenir l'avance",
    "competitive.analysis": "analyse",

    // --- Your Rankings table ---
    "competitive.yourRankings": "Vos classements",
    "competitive.metric": "Métrique",
    "competitive.medal": "Médaille",
    "competitive.rank": "Rang",
    "competitive.status": "Statut",
    "competitive.recommendedAction": "Action recommandée",
    "competitive.allFailed": "Tous échoués",
    "competitive.fixAnalysisErrors": "Corriger les erreurs d'analyse – vérifier l'accessibilité du site",
    "competitive.leading": "En tête !",
    "competitive.maintainPosition": "Maintenir la position – surveiller les concurrents",
    "competitive.strong": "Fort",
    "competitive.pushToFirst": "Viser le #1 – optimisations mineures nécessaires",
    "competitive.competitiveStatus": "Compétitif",
    "competitive.improveGapClosing": "Améliorer {{metric}} – opportunité de réduction d'écart",
    "competitive.behind": "En retard",
    "competitive.priorityOverhaul": "Priorité : refonte de {{metric}} requise",
    "competitive.midPack": "Milieu de peloton",
    "competitive.targetImprovements": "Cibler les améliorations de {{metric}} pour gagner des places",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "Maintenir l'excellence globale",
    "competitive.rec.overallLast": "Amélioration multi-métriques nécessaire – commencer par le point le plus faible",
    "competitive.rec.overallMid": "Se concentrer sur les métriques individuelles les plus faibles",
    "competitive.rec.seoFirst": "Surveiller les classements de mots-clés et maintenir",
    "competitive.rec.seoImprove": "Optimiser les balises meta, le contenu et le maillage interne",
    "competitive.rec.performanceFirst": "Maintenir les temps de chargement optimisés",
    "competitive.rec.performanceImprove": "Réduire la taille de la page, optimiser les images, activer le cache",
    "competitive.rec.cwvFirst": "Maintenir les scores LCP/FCP/CLS",
    "competitive.rec.cwvImprove": "Améliorer LCP (<2,5s), FCP (<1,8s), CLS (<0,1)",
    "competitive.rec.a11yFirst": "Maintenir des standards d'accessibilité élevés",
    "competitive.rec.a11yImprove": "Ajouter du texte alternatif, améliorer le contraste, corriger les labels ARIA",
    "competitive.rec.securityFirst": "Maintenir les meilleures pratiques de sécurité",
    "competitive.rec.securityImprove": "Activer HTTPS, ajouter des en-têtes de sécurité, mettre à jour les protocoles",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "Aucune information disponible.",
    "competitive.allSitesFailed": "Tous les sites ont échoué",
    "competitive.seeWhereYouStand": "Voyez exactement où vous vous situez par rapport à chaque concurrent dans chaque catégorie",
    "competitive.behindLeader": "derrière le leader",
    "competitive.ahead": "en avance !",
    "competitive.yourRank": "Votre rang",
    "competitive.winning": "EN TÊTE",
    "competitive.tied": "ÉGALITÉ",
    "competitive.losing": "EN RETARD",
    "competitive.avg": "Moy.",
    "competitive.best": "Meilleur",
    "competitive.thPercentile": "e percentile",
    "competitive.clickEachMetric": "Cliquez sur chaque métrique ci-dessous pour voir l'analyse concurrentielle détaillée et les recommandations pratiques.",
    "competitive.website": "Site web",
    "competitive.detailedMetricAnalysis": "Analyse détaillée des métriques",
    "competitive.youreLeading": "Vous",
    "competitive.pointsBehind": "{{gap}} points derrière {{leader}}",
    "competitive.yourScore": "Votre score",
    "competitive.opportunity": "OPPORTUNITÉ",
    "competitive.actionSteps": "Étapes d'action",
    "competitive.bestCompetitor": "Meilleur concurrent",
    "competitive.competitiveAdvantage": "Avantage concurrentiel",
    "competitive.improvementOpportunity": "Opportunité d'amélioration",
    "competitive.outperformingCompetitors": "Vous",
    "competitive.closingGapHelp": "Combler cet écart de {{gap}} points pourrait améliorer considérablement votre position concurrentielle. {{leader}} établit la référence ici.",
    "competitive.leaderboard": "Classement",
    "competitive.whatThisMeans": "Ce que cela signifie",
    "competitive.maintainYourLead": "Maintenez votre avance",
    "competitive.closeTheGap": "Comblez l'écart",
    "competitive.proTip": "Conseil pro",
  },

  ja: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "競合サイト {{num}} URL",
    "competitive.analysisFailed": "分析に失敗しました",
    "competitive.errorMissingYourSite": "無効なレスポンス構造：あなたのサイトのデータがありません",
    "competitive.errorMissingScores": "無効なレスポンス構造：スコアデータがありません",
    "competitive.unlockToSeeRecommendations": "ロックを解除して詳細な推奨事項を確認",
    "competitive.proFeature1": "優先度付きアクションアイテム",
    "competitive.proFeature2": "ギャップ分析の詳細",
    "competitive.proFeature3": "実装ガイダンス",
    "competitive.compareMetricsCharts": "インタラクティブなチャートですべてのメトリクスのパフォーマンスを比較",
    "competitive.radarView": "レーダービュー",
    "competitive.barChart": "棒グラフ",
    "competitive.completeScoreBreakdown": "すべてのサイトの個別メトリクス詳細を含む完全なスコア内訳",
    "competitive.site": "サイト",
    "competitive.you": "あなた",
    "competitive.analysisError": "分析エラー",
    "competitive.analyzerFailureNote": "Xが付いたスコアはアナライザーの障害（通常はLighthouseのタイムアウトまたはサイトの制限）を示します。正確性を確保するため、これらのメトリクスは総合スコアの計算から除外されます。",
    "competitive.missingDataExecutiveSummary": "エグゼクティブサマリーのデータがありません",
    "competitive.noValidCompetitorScores": "有効な競合スコアがありません",

    // --- Rankings & Scores ---
    "competitive.competitive": "競合分析",
    "competitive.grade": "グレード",
    "competitive.ranked": "順位",
    "competitive.outOf": "/",
    "competitive.competitorsAnalyzed": "社の競合を分析",
    "competitive.winningIn": "リード中",
    "competitive.categories": "カテゴリー",
    "competitive.avgCompetitor": "競合平均",
    "competitive.score": "スコア",
    "competitive.gapToLeader": "リーダーとの差",
    "competitive.points": "ポイント",
    "competitive.priorityFocus": "優先フォーカス",
    "competitive.fixWeaknesses": "{{count}}件の弱点を修正",
    "competitive.maintainLead": "リードを維持",
    "competitive.analysis": "分析",

    // --- Your Rankings table ---
    "competitive.yourRankings": "あなたのランキング",
    "competitive.metric": "メトリクス",
    "competitive.medal": "メダル",
    "competitive.rank": "順位",
    "competitive.status": "ステータス",
    "competitive.recommendedAction": "推奨アクション",
    "competitive.allFailed": "すべて失敗",
    "competitive.fixAnalysisErrors": "分析エラーを修正 – サイトのアクセシビリティを確認",
    "competitive.leading": "リード中！",
    "competitive.maintainPosition": "ポジションを維持 – 競合を監視",
    "competitive.strong": "強い",
    "competitive.pushToFirst": "1位を目指す – 軽微な最適化が必要",
    "competitive.competitiveStatus": "競合的",
    "competitive.improveGapClosing": "{{metric}}を改善 – ギャップを縮める機会",
    "competitive.behind": "遅れている",
    "competitive.priorityOverhaul": "優先：{{metric}}の全面的な改善が必要",
    "competitive.midPack": "中位",
    "competitive.targetImprovements": "順位向上のため{{metric}}の改善を目指す",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "全体的な優秀さを維持",
    "competitive.rec.overallLast": "複数のメトリクスの改善が必要 – 最も弱い分野から開始",
    "competitive.rec.overallMid": "最もスコアの低い個別メトリクスに集中",
    "competitive.rec.seoFirst": "キーワードランキングを監視し維持",
    "competitive.rec.seoImprove": "メタタグ、コンテンツ、内部リンクを最適化",
    "competitive.rec.performanceFirst": "ロード時間の最適化を維持",
    "competitive.rec.performanceImprove": "ページサイズの削減、画像の最適化、キャッシュの有効化",
    "competitive.rec.cwvFirst": "LCP/FCP/CLSスコアを維持",
    "competitive.rec.cwvImprove": "LCP (<2.5秒)、FCP (<1.8秒)、CLS (<0.1) を改善",
    "competitive.rec.a11yFirst": "高いアクセシビリティ基準を維持",
    "competitive.rec.a11yImprove": "代替テキストの追加、コントラストの改善、ARIAラベルの修正",
    "competitive.rec.securityFirst": "セキュリティのベストプラクティスを維持",
    "competitive.rec.securityImprove": "HTTPSの有効化、セキュリティヘッダーの追加、プロトコルの更新",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "インサイトはありません。",
    "competitive.allSitesFailed": "すべてのサイトが失敗",
    "competitive.seeWhereYouStand": "各カテゴリーで各競合に対してどの位置にいるかを正確に確認",
    "competitive.behindLeader": "リーダーに遅れ",
    "competitive.ahead": "リード中！",
    "competitive.yourRank": "あなたの順位",
    "competitive.winning": "リード中",
    "competitive.tied": "同点",
    "competitive.losing": "遅れている",
    "competitive.avg": "平均",
    "competitive.best": "最高",
    "competitive.thPercentile": "パーセンタイル",
    "competitive.clickEachMetric": "以下の各メトリクスをクリックして、詳細な競合分析と実用的なインサイトをご覧ください。",
    "competitive.website": "ウェブサイト",
    "competitive.detailedMetricAnalysis": "詳細なメトリクス分析",
    "competitive.youreLeading": "あなた",
    "competitive.pointsBehind": "{{leader}}に{{gap}}ポイント差",
    "competitive.yourScore": "あなたのスコア",
    "competitive.opportunity": "改善機会",
    "competitive.actionSteps": "アクションステップ",
    "competitive.bestCompetitor": "最良の競合",
    "competitive.competitiveAdvantage": "競争優位性",
    "competitive.improvementOpportunity": "改善の機会",
    "competitive.outperformingCompetitors": "あなた",
    "competitive.closingGapHelp": "この{{gap}}ポイントのギャップを埋めることで、競争力を大幅に向上できます。{{leader}}がここでベンチマークを設定しています。",
    "competitive.leaderboard": "リーダーボード",
    "competitive.whatThisMeans": "これが意味すること",
    "competitive.maintainYourLead": "リードを維持する",
    "competitive.closeTheGap": "ギャップを埋める",
    "competitive.proTip": "プロのヒント",
  },

  pt: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "URL do concorrente {{num}}",
    "competitive.analysisFailed": "Análise falhou",
    "competitive.errorMissingYourSite": "Estrutura de resposta inválida: dados do seu site ausentes",
    "competitive.errorMissingScores": "Estrutura de resposta inválida: dados de pontuação ausentes",
    "competitive.unlockToSeeRecommendations": "Desbloquear para ver recomendações detalhadas",
    "competitive.proFeature1": "Itens de ação priorizados",
    "competitive.proFeature2": "Detalhes da análise de lacunas",
    "competitive.proFeature3": "Orientação de implementação",
    "competitive.compareMetricsCharts": "Compare o desempenho em todas as métricas com gráficos interativos",
    "competitive.radarView": "Visão radar",
    "competitive.barChart": "Gráfico de barras",
    "competitive.completeScoreBreakdown": "Detalhamento completo das pontuações com métricas individuais para cada site",
    "competitive.site": "Site",
    "competitive.you": "VOCÊ",
    "competitive.analysisError": "Erro de análise",
    "competitive.analyzerFailureNote": "Pontuações marcadas com X indicam falhas do analisador (geralmente por timeouts do Lighthouse ou restrições do site). Essas métricas são excluídas do cálculo da pontuação geral para garantir precisão.",
    "competitive.missingDataExecutiveSummary": "Dados ausentes para o resumo executivo",
    "competitive.noValidCompetitorScores": "Nenhuma pontuação válida de concorrentes disponível",

    // --- Rankings & Scores ---
    "competitive.competitive": "COMPETITIVO",
    "competitive.grade": "Nota",
    "competitive.ranked": "Classificado",
    "competitive.outOf": "de",
    "competitive.competitorsAnalyzed": "concorrentes analisados",
    "competitive.winningIn": "Liderando em",
    "competitive.categories": "categorias",
    "competitive.avgCompetitor": "Concorrente médio",
    "competitive.score": "pontuação",
    "competitive.gapToLeader": "Distância do líder",
    "competitive.points": "pontos",
    "competitive.priorityFocus": "Foco prioritário",
    "competitive.fixWeaknesses": "Corrigir {{count}} fraqueza",
    "competitive.maintainLead": "Manter liderança",
    "competitive.analysis": "análise",

    // --- Your Rankings table ---
    "competitive.yourRankings": "Suas classificações",
    "competitive.metric": "Métrica",
    "competitive.medal": "Medalha",
    "competitive.rank": "Posição",
    "competitive.status": "Status",
    "competitive.recommendedAction": "Ação recomendada",
    "competitive.allFailed": "Todos falharam",
    "competitive.fixAnalysisErrors": "Corrigir erros de análise – verificar acessibilidade do site",
    "competitive.leading": "Liderando!",
    "competitive.maintainPosition": "Manter posição – monitorar concorrentes",
    "competitive.strong": "Forte",
    "competitive.pushToFirst": "Buscar o #1 – otimizações menores necessárias",
    "competitive.competitiveStatus": "Competitivo",
    "competitive.improveGapClosing": "Melhorar {{metric}} – oportunidade de fechar a lacuna",
    "competitive.behind": "Atrás",
    "competitive.priorityOverhaul": "Prioridade: revisão completa de {{metric}} necessária",
    "competitive.midPack": "No meio do grupo",
    "competitive.targetImprovements": "Buscar melhorias em {{metric}} para ganhar posições",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "Manter a excelência geral",
    "competitive.rec.overallLast": "Melhoria em múltiplas métricas necessária – começar pela área mais fraca",
    "competitive.rec.overallMid": "Focar nas métricas individuais com menor pontuação",
    "competitive.rec.seoFirst": "Monitorar rankings de palavras-chave e manter",
    "competitive.rec.seoImprove": "Otimizar meta tags, conteúdo e links internos",
    "competitive.rec.performanceFirst": "Manter tempos de carregamento otimizados",
    "competitive.rec.performanceImprove": "Reduzir tamanho da página, otimizar imagens, habilitar cache",
    "competitive.rec.cwvFirst": "Manter pontuações de LCP/FCP/CLS",
    "competitive.rec.cwvImprove": "Melhorar LCP (<2.5s), FCP (<1.8s), CLS (<0.1)",
    "competitive.rec.a11yFirst": "Manter altos padrões de acessibilidade",
    "competitive.rec.a11yImprove": "Adicionar texto alternativo, melhorar contraste, corrigir labels ARIA",
    "competitive.rec.securityFirst": "Manter as melhores práticas de segurança",
    "competitive.rec.securityImprove": "Habilitar HTTPS, adicionar cabeçalhos de segurança, atualizar protocolos",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "Nenhuma informação disponível.",
    "competitive.allSitesFailed": "Todos os sites falharam",
    "competitive.seeWhereYouStand": "Veja exatamente onde você se posiciona em relação a cada concorrente em cada categoria",
    "competitive.behindLeader": "atrás do líder",
    "competitive.ahead": "à frente!",
    "competitive.yourRank": "Sua posição",
    "competitive.winning": "VENCENDO",
    "competitive.tied": "EMPATADO",
    "competitive.losing": "PERDENDO",
    "competitive.avg": "Média",
    "competitive.best": "Melhor",
    "competitive.thPercentile": "° percentil",
    "competitive.clickEachMetric": "Clique em cada métrica abaixo para ver a análise competitiva detalhada e insights acionáveis.",
    "competitive.website": "Site",
    "competitive.detailedMetricAnalysis": "Análise detalhada de métricas",
    "competitive.youreLeading": "Você",
    "competitive.pointsBehind": "{{gap}} pontos atrás de {{leader}}",
    "competitive.yourScore": "Sua pontuação",
    "competitive.opportunity": "OPORTUNIDADE",
    "competitive.actionSteps": "Passos de ação",
    "competitive.bestCompetitor": "Melhor concorrente",
    "competitive.competitiveAdvantage": "Vantagem competitiva",
    "competitive.improvementOpportunity": "Oportunidade de melhoria",
    "competitive.outperformingCompetitors": "Você",
    "competitive.closingGapHelp": "Fechar essa lacuna de {{gap}} pontos pode melhorar significativamente sua posição competitiva. {{leader}} está definindo o benchmark aqui.",
    "competitive.leaderboard": "Classificação",
    "competitive.whatThisMeans": "O que isso significa",
    "competitive.maintainYourLead": "Mantenha sua liderança",
    "competitive.closeTheGap": "Feche a lacuna",
    "competitive.proTip": "Dica profissional",
  },

  zh: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "竞争对手 {{num}} URL",
    "competitive.analysisFailed": "分析失败",
    "competitive.errorMissingYourSite": "无效的响应结构：缺少您的网站数据",
    "competitive.errorMissingScores": "无效的响应结构：缺少评分数据",
    "competitive.unlockToSeeRecommendations": "解锁以查看详细建议",
    "competitive.proFeature1": "优先行动项目",
    "competitive.proFeature2": "差距分析详情",
    "competitive.proFeature3": "实施指导",
    "competitive.compareMetricsCharts": "通过交互式图表比较所有指标的表现",
    "competitive.radarView": "雷达图",
    "competitive.barChart": "柱状图",
    "competitive.completeScoreBreakdown": "包含每个网站各项指标详情的完整评分分析",
    "competitive.site": "网站",
    "competitive.you": "您",
    "competitive.analysisError": "分析错误",
    "competitive.analyzerFailureNote": "标有X的评分表示分析器故障（通常由Lighthouse超时或网站限制引起）。为确保准确性，这些指标已从总分计算中排除。",
    "competitive.missingDataExecutiveSummary": "缺少执行摘要数据",
    "competitive.noValidCompetitorScores": "没有可用的有效竞争对手评分",

    // --- Rankings & Scores ---
    "competitive.competitive": "竞争分析",
    "competitive.grade": "等级",
    "competitive.ranked": "排名",
    "competitive.outOf": "/",
    "competitive.competitorsAnalyzed": "个竞争对手已分析",
    "competitive.winningIn": "领先于",
    "competitive.categories": "个类别",
    "competitive.avgCompetitor": "竞争对手平均",
    "competitive.score": "分",
    "competitive.gapToLeader": "与领先者的差距",
    "competitive.points": "分",
    "competitive.priorityFocus": "优先关注",
    "competitive.fixWeaknesses": "修复 {{count}} 个弱点",
    "competitive.maintainLead": "保持领先",
    "competitive.analysis": "分析",

    // --- Your Rankings table ---
    "competitive.yourRankings": "您的排名",
    "competitive.metric": "指标",
    "competitive.medal": "奖牌",
    "competitive.rank": "排名",
    "competitive.status": "状态",
    "competitive.recommendedAction": "建议操作",
    "competitive.allFailed": "全部失败",
    "competitive.fixAnalysisErrors": "修复分析错误 – 检查网站可访问性",
    "competitive.leading": "领先！",
    "competitive.maintainPosition": "保持位置 – 监控竞争对手",
    "competitive.strong": "强劲",
    "competitive.pushToFirst": "冲击第一名 – 需要小幅优化",
    "competitive.competitiveStatus": "有竞争力",
    "competitive.improveGapClosing": "改善{{metric}} – 缩小差距的机会",
    "competitive.behind": "落后",
    "competitive.priorityOverhaul": "优先：需要全面改进{{metric}}",
    "competitive.midPack": "中游",
    "competitive.targetImprovements": "针对{{metric}}进行改进以提升排名",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "保持全方位的卓越表现",
    "competitive.rec.overallLast": "需要多项指标改进 – 从最薄弱的领域开始",
    "competitive.rec.overallMid": "专注于得分最低的各项指标",
    "competitive.rec.seoFirst": "监控关键词排名并保持",
    "competitive.rec.seoImprove": "优化meta标签、内容和内部链接",
    "competitive.rec.performanceFirst": "保持加载时间优化",
    "competitive.rec.performanceImprove": "减小页面大小、优化图片、启用缓存",
    "competitive.rec.cwvFirst": "保持LCP/FCP/CLS分数",
    "competitive.rec.cwvImprove": "改善LCP (<2.5秒)、FCP (<1.8秒)、CLS (<0.1)",
    "competitive.rec.a11yFirst": "保持高无障碍标准",
    "competitive.rec.a11yImprove": "添加替代文本、改善对比度、修复ARIA标签",
    "competitive.rec.securityFirst": "保持安全最佳实践",
    "competitive.rec.securityImprove": "启用HTTPS、添加安全头、更新协议",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "没有可用的洞察。",
    "competitive.allSitesFailed": "所有网站均失败",
    "competitive.seeWhereYouStand": "准确了解您在每个类别中与每个竞争对手的对比情况",
    "competitive.behindLeader": "落后于领先者",
    "competitive.ahead": "领先！",
    "competitive.yourRank": "您的排名",
    "competitive.winning": "领先",
    "competitive.tied": "持平",
    "competitive.losing": "落后",
    "competitive.avg": "平均",
    "competitive.best": "最佳",
    "competitive.thPercentile": "百分位",
    "competitive.clickEachMetric": "点击下方每个指标查看详细的竞争分析和可操作的建议。",
    "competitive.website": "网站",
    "competitive.detailedMetricAnalysis": "详细指标分析",
    "competitive.youreLeading": "您",
    "competitive.pointsBehind": "落后{{leader}} {{gap}}分",
    "competitive.yourScore": "您的分数",
    "competitive.opportunity": "改进机会",
    "competitive.actionSteps": "行动步骤",
    "competitive.bestCompetitor": "最佳竞争对手",
    "competitive.competitiveAdvantage": "竞争优势",
    "competitive.improvementOpportunity": "改进机会",
    "competitive.outperformingCompetitors": "您",
    "competitive.closingGapHelp": "缩小这{{gap}}分的差距可以显著提升您的竞争地位。{{leader}}在此设定了基准。",
    "competitive.leaderboard": "排行榜",
    "competitive.whatThisMeans": "这意味着什么",
    "competitive.maintainYourLead": "保持您的领先地位",
    "competitive.closeTheGap": "缩小差距",
    "competitive.proTip": "专业提示",
  },

  ru: {
    // --- Basic UI ---
    "competitive.competitorUrlLabel": "URL конкурента {{num}}",
    "competitive.analysisFailed": "Анализ не удался",
    "competitive.errorMissingYourSite": "Недопустимая структура ответа: отсутствуют данные вашего сайта",
    "competitive.errorMissingScores": "Недопустимая структура ответа: отсутствуют данные оценок",
    "competitive.unlockToSeeRecommendations": "Разблокировать для просмотра подробных рекомендаций",
    "competitive.proFeature1": "Приоритизированные действия",
    "competitive.proFeature2": "Подробности анализа разрывов",
    "competitive.proFeature3": "Руководство по внедрению",
    "competitive.compareMetricsCharts": "Сравните показатели по всем метрикам с помощью интерактивных графиков",
    "competitive.radarView": "Радарная диаграмма",
    "competitive.barChart": "Столбчатая диаграмма",
    "competitive.completeScoreBreakdown": "Полная детализация оценок с индивидуальными метриками для каждого сайта",
    "competitive.site": "Сайт",
    "competitive.you": "ВЫ",
    "competitive.analysisError": "Ошибка анализа",
    "competitive.analyzerFailureNote": "Оценки, отмеченные X, указывают на сбои анализатора (обычно из-за таймаутов Lighthouse или ограничений сайта). Эти метрики исключены из расчёта общей оценки для обеспечения точности.",
    "competitive.missingDataExecutiveSummary": "Отсутствуют данные для сводки",
    "competitive.noValidCompetitorScores": "Нет доступных действительных оценок конкурентов",

    // --- Rankings & Scores ---
    "competitive.competitive": "КОНКУРЕНТНЫЙ АНАЛИЗ",
    "competitive.grade": "Оценка",
    "competitive.ranked": "Позиция",
    "competitive.outOf": "из",
    "competitive.competitorsAnalyzed": "конкурентов проанализировано",
    "competitive.winningIn": "Лидирует в",
    "competitive.categories": "категориях",
    "competitive.avgCompetitor": "Средний конкурент",
    "competitive.score": "баллов",
    "competitive.gapToLeader": "Отставание от лидера",
    "competitive.points": "баллов",
    "competitive.priorityFocus": "Приоритетный фокус",
    "competitive.fixWeaknesses": "Исправить {{count}} слабое место",
    "competitive.maintainLead": "Удержать лидерство",
    "competitive.analysis": "анализ",

    // --- Your Rankings table ---
    "competitive.yourRankings": "Ваши позиции",
    "competitive.metric": "Метрика",
    "competitive.medal": "Медаль",
    "competitive.rank": "Ранг",
    "competitive.status": "Статус",
    "competitive.recommendedAction": "Рекомендуемое действие",
    "competitive.allFailed": "Все не пройдены",
    "competitive.fixAnalysisErrors": "Исправить ошибки анализа – проверить доступность сайта",
    "competitive.leading": "Лидирует!",
    "competitive.maintainPosition": "Удерживать позицию – мониторить конкурентов",
    "competitive.strong": "Сильная позиция",
    "competitive.pushToFirst": "Стремиться к #1 – нужны незначительные оптимизации",
    "competitive.competitiveStatus": "Конкурентоспособный",
    "competitive.improveGapClosing": "Улучшить {{metric}} – возможность сократить разрыв",
    "competitive.behind": "Отстаёт",
    "competitive.priorityOverhaul": "Приоритет: требуется переработка {{metric}}",
    "competitive.midPack": "Середина",
    "competitive.targetImprovements": "Нацелить улучшения {{metric}} для повышения позиции",

    // --- Recommendations ---
    "competitive.rec.overallFirst": "Поддерживать всестороннее превосходство",
    "competitive.rec.overallLast": "Необходимо улучшение нескольких метрик – начните с самой слабой области",
    "competitive.rec.overallMid": "Сосредоточиться на метриках с наименьшими баллами",
    "competitive.rec.seoFirst": "Отслеживать позиции ключевых слов и поддерживать",
    "competitive.rec.seoImprove": "Оптимизировать мета-теги, контент и внутреннюю перелинковку",
    "competitive.rec.performanceFirst": "Поддерживать оптимизированное время загрузки",
    "competitive.rec.performanceImprove": "Уменьшить размер страницы, оптимизировать изображения, включить кэширование",
    "competitive.rec.cwvFirst": "Поддерживать показатели LCP/FCP/CLS",
    "competitive.rec.cwvImprove": "Улучшить LCP (<2,5 с), FCP (<1,8 с), CLS (<0,1)",
    "competitive.rec.a11yFirst": "Поддерживать высокие стандарты доступности",
    "competitive.rec.a11yImprove": "Добавить альтернативный текст, улучшить контрастность, исправить метки ARIA",
    "competitive.rec.securityFirst": "Поддерживать лучшие практики безопасности",
    "competitive.rec.securityImprove": "Включить HTTPS, добавить заголовки безопасности, обновить протоколы",

    // --- Insights & Comparison ---
    "competitive.noInsightsAvailable": "Нет доступных данных.",
    "competitive.allSitesFailed": "Все сайты не прошли проверку",
    "competitive.seeWhereYouStand": "Узнайте точно, как вы выглядите на фоне каждого конкурента в каждой категории",
    "competitive.behindLeader": "позади лидера",
    "competitive.ahead": "впереди!",
    "competitive.yourRank": "Ваша позиция",
    "competitive.winning": "ЛИДИРУЕТ",
    "competitive.tied": "НАРАВНЕ",
    "competitive.losing": "ОТСТАЁТ",
    "competitive.avg": "Средн.",
    "competitive.best": "Лучший",
    "competitive.thPercentile": "-й процентиль",
    "competitive.clickEachMetric": "Нажмите на каждую метрику ниже, чтобы увидеть подробный конкурентный анализ и практические рекомендации.",
    "competitive.website": "Веб-сайт",
    "competitive.detailedMetricAnalysis": "Подробный анализ метрик",
    "competitive.youreLeading": "Вы",
    "competitive.pointsBehind": "{{gap}} баллов позади {{leader}}",
    "competitive.yourScore": "Ваш балл",
    "competitive.opportunity": "ВОЗМОЖНОСТЬ",
    "competitive.actionSteps": "Шаги действий",
    "competitive.bestCompetitor": "Лучший конкурент",
    "competitive.competitiveAdvantage": "Конкурентное преимущество",
    "competitive.improvementOpportunity": "Возможность улучшения",
    "competitive.outperformingCompetitors": "Вы",
    "competitive.closingGapHelp": "Сокращение этого разрыва в {{gap}} баллов может значительно улучшить вашу конкурентную позицию. {{leader}} устанавливает здесь эталон.",
    "competitive.leaderboard": "Таблица лидеров",
    "competitive.whatThisMeans": "Что это значит",
    "competitive.maintainYourLead": "Удерживайте лидерство",
    "competitive.closeTheGap": "Сократите разрыв",
    "competitive.proTip": "Совет профессионала",
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
  console.log(`${lang}.json: added ${addedCount} competitive translations`);
}

// Verify
console.log('\n=== Post-merge verification ===');
for (const lang of langs) {
  const data = JSON.parse(fs.readFileSync(path.join(i18nDir, lang + '.json'), 'utf8'));
  const competitive = data.reports && data.reports.competitive ? data.reports.competitive : {};
  const competitiveKeys = flattenKeys(competitive, 'competitive');
  console.log(`${lang}: ${Object.keys(competitiveKeys).length} competitive keys present`);
}
