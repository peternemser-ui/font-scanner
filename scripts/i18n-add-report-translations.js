#!/usr/bin/env node
/**
 * i18n-add-report-translations.js
 *
 * Adds missing report translations for all 7 non-English languages.
 * Reads en.json for the source keys, checks what's missing per language,
 * and deep-merges translated values.
 *
 * Usage: node scripts/i18n-add-report-translations.js
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

// Load EN as source of truth
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
const enFlat = flattenKeys(en.reports, 'reports');
const enKeys = Object.keys(enFlat);

// ============================================================
// TRANSLATIONS
// Each language maps flat keys (under "reports.") to translated values.
// Only keys that are missing from that language file need entries here.
// We include ALL potentially missing keys for comprehensive coverage.
// ============================================================

const translations = {
  de: {
    // --- reports.common ---
    "common.runNewScan": "Neuen Scan starten",
    "common.result": "Ergebnis",
    "common.showingSavedReport": "Gespeicherter Bericht vom",
    "common.refresh": "Aktualisieren",
    "common.desktop": "Desktop",
    "common.mobile": "Mobil",
    "common.scanTimeout": "Zeitüberschreitung beim Scan. Die Website ist möglicherweise zu langsam. Bitte versuchen Sie es erneut.",
    "common.whyThisMatters": "Warum das wichtig ist",
    "common.technicalDetails": "Technische Details",
    "common.whatsTheIssue": "Was ist das Problem?",
    "common.recommendedImplementation": "Empfohlene Implementierung",
    "common.overview": "Übersicht",
    "common.analyzing": "Analyse läuft...",
    "common.componentLoadError": "Fehler: Berichtskomponenten konnten nicht geladen werden. Bitte aktualisieren Sie die Seite.",
    "common.mayTake20to30Seconds": "Dies kann 20-30 Sekunden dauern",
    "common.export": "Exportieren",
    "common.exportToExcel": "Nach Excel exportieren",
    "common.proFeatureUnlock": "PRO-Funktion – Zum Exportieren freischalten",
    "common.grade": "Bewertung",
    "common.none": "Keine",
    "common.unlockToView": "Freischalten zum Anzeigen:",
    "common.unlockSubtitle": "PDF-Export, Link teilen, Datenexport und Fix-Pakete für diesen Scan.",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "Erwägen Sie variable Schriften für flexiblere Typografie mit weniger Dateien.",
    "fonts.excellentTypography": "Hervorragende Typografie!",
    "fonts.fontFixes": "Schrift-Korrekturen",
    "fonts.improvementsFound": "Verbesserungen gefunden",
    "fonts.fontDisplayIssueDetected": "Schriftanzeige-Problem erkannt",
    "fonts.moreIssues": "weitere Probleme",

    // --- reports.metrics ---
    "metrics.overall": "Gesamt",
    "metrics.security": "Sicherheit",
    "metrics.accessibility": "Barrierefreiheit",
    "metrics.performance": "Leistung",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "Verbesserung nötig",
    "status.failed": "Fehlgeschlagen",
    "status.good": "Gut",
    "status.poor": "Schlecht",

    // --- reports.security (49 keys) ---
    "security.cookieIssues.missingHttpOnly": "Fehlendes HttpOnly-Flag",
    "security.cookieIssues.missingSecure": "Fehlendes Secure-Flag",
    "security.cookieIssues.missingSameSite": "Fehlendes SameSite-Attribut",
    "security.cookieIssues.sameSiteNoneSecure": "SameSite=None erfordert Secure",
    "security.cookieIssues.sessionNoHttpOnly": "Session-Cookie ohne HttpOnly",
    "security.cookieIssues.insecureSameSite": "Unsicherer SameSite-Wert",
    "security.implemented": "Implementiert",
    "security.vulnerabilityStatus": "Schwachstellenstatus",
    "security.criticalIssues": "Kritische Probleme",
    "security.grade": "Bewertung",
    "security.owaspControlsImplemented": "der OWASP Top 10 Sicherheitskontrollen implementiert",
    "security.goodSecurityPosture": "Gute Sicherheitslage!",
    "security.criticalRemediationSteps": "Kritische Behebungsschritte",
    "security.owaspAlignedFixes": "OWASP-konforme Korrekturen",
    "security.desktopVsMobileAnalysis": "Desktop- vs. Mobil-Sicherheitsanalyse",
    "security.platformSecurityGap": "Plattform-Sicherheitslücke",
    "security.desktopSecurityHigher": "Desktop-Sicherheit ist höher",
    "security.mobileSecurityHigher": "Mobile Sicherheit ist höher",
    "security.consistentSecurity": "Konsistente Sicherheit",
    "security.crossPlatformConsistency": "Plattformübergreifende Konsistenz",
    "security.desktopGrade": "Desktop-Bewertung",
    "security.mobileGrade": "Mobil-Bewertung",
    "security.headersImplemented": "Header implementiert",
    "security.securityFixes": "Sicherheitskorrekturen",
    "security.noIssuesFound": "Keine Sicherheitsprobleme gefunden.",
    "security.securityIssue": "Sicherheitsproblem",
    "security.howToFix": "So beheben Sie es:",
    "security.implementHeader": "Header implementieren",
    "security.currentValue": "Aktueller Wert",
    "security.recommendedValue": "Empfohlener Wert",
    "security.steps.reviewHeader": "Überprüfen Sie den aktuellen Header-Status",
    "security.steps.addToConfig": "Zur Server-Konfiguration hinzufügen",
    "security.steps.testChanges": "Änderungen testen",
    "security.steps.verifyDeployment": "Bereitstellung überprüfen",
    "security.quickStats": "Kurzstatistik",
    "security.headersFound": "Gefundene Header",
    "security.missingHeaders": "Fehlende Header",
    "security.cookiesAnalyzed": "Analysierte Cookies",
    "security.overallGrade": "Gesamtbewertung",
    "security.headerAnalysis": "Header-Analyse",
    "security.headerPresent": "Header vorhanden",
    "security.headerMissing": "Header fehlt",
    "security.headerValue": "Header-Wert",
    "security.cookieSecurityAnalysis": "Cookie-Sicherheitsanalyse",
    "security.securityScore": "Sicherheitsbewertung",
    "security.bestPracticesScore": "Best-Practices-Bewertung",
    "security.vulnerabilities": "Schwachstellen",
    "security.owaspCompliance": "OWASP-Konformität",
    "security.protocolSecurity": "Protokollsicherheit",
    "security.certificateInfo": "Zertifikatsinformationen",
  },

  es: {
    // --- reports.common ---
    "common.runNewScan": "Ejecutar nuevo análisis",
    "common.result": "Resultado",
    "common.showingSavedReport": "Mostrando informe guardado del",
    "common.refresh": "Actualizar",
    "common.desktop": "Escritorio",
    "common.mobile": "Móvil",
    "common.scanTimeout": "Tiempo de espera agotado. El sitio web puede ser demasiado lento. Inténtelo de nuevo.",
    "common.whyThisMatters": "Por qué es importante",
    "common.technicalDetails": "Detalles técnicos",
    "common.whatsTheIssue": "¿Cuál es el problema?",
    "common.recommendedImplementation": "Implementación recomendada",
    "common.overview": "Resumen",
    "common.analyzing": "Analizando...",
    "common.componentLoadError": "Error: Los componentes del informe no se cargaron. Actualice la página.",
    "common.mayTake20to30Seconds": "Esto puede tardar 20-30 segundos",
    "common.export": "Exportar",
    "common.exportToExcel": "Exportar a Excel",
    "common.proFeatureUnlock": "Función PRO – Desbloquear para exportar",
    "common.grade": "Calificación",
    "common.none": "Ninguno",
    "common.unlockToView": "Desbloquear para ver:",
    "common.unlockSubtitle": "Exportación PDF, enlace compartido, exportación de datos y paquetes de corrección para este análisis.",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "Considere usar fuentes variables para una tipografía más flexible con menos archivos.",
    "fonts.excellentTypography": "¡Tipografía excelente!",
    "fonts.fontFixes": "Correcciones de fuentes",
    "fonts.improvementsFound": "mejoras encontradas",
    "fonts.fontDisplayIssueDetected": "Problema de visualización de fuente detectado",
    "fonts.moreIssues": "más problemas",

    // --- reports.metrics ---
    "metrics.overall": "General",
    "metrics.security": "Seguridad",
    "metrics.accessibility": "Accesibilidad",
    "metrics.performance": "Rendimiento",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "Necesita mejora",
    "status.failed": "Fallido",
    "status.good": "Bueno",
    "status.poor": "Deficiente",

    // --- reports.security ---
    "security.cookieIssues.missingHttpOnly": "Falta el flag HttpOnly",
    "security.cookieIssues.missingSecure": "Falta el flag Secure",
    "security.cookieIssues.missingSameSite": "Falta el atributo SameSite",
    "security.cookieIssues.sameSiteNoneSecure": "SameSite=None requiere Secure",
    "security.cookieIssues.sessionNoHttpOnly": "Cookie de sesión sin HttpOnly",
    "security.cookieIssues.insecureSameSite": "Valor SameSite inseguro",
    "security.implemented": "Implementado",
    "security.vulnerabilityStatus": "Estado de vulnerabilidades",
    "security.criticalIssues": "Problemas críticos",
    "security.grade": "Calificación",
    "security.owaspControlsImplemented": "controles de seguridad OWASP Top 10 implementados",
    "security.goodSecurityPosture": "¡Buena postura de seguridad!",
    "security.criticalRemediationSteps": "Pasos de corrección críticos",
    "security.owaspAlignedFixes": "Correcciones alineadas con OWASP",
    "security.desktopVsMobileAnalysis": "Análisis de seguridad escritorio vs móvil",
    "security.platformSecurityGap": "Brecha de seguridad entre plataformas",
    "security.desktopSecurityHigher": "La seguridad de escritorio es mayor",
    "security.mobileSecurityHigher": "La seguridad móvil es mayor",
    "security.consistentSecurity": "Seguridad consistente",
    "security.crossPlatformConsistency": "Consistencia multiplataforma",
    "security.desktopGrade": "Calificación escritorio",
    "security.mobileGrade": "Calificación móvil",
    "security.headersImplemented": "Encabezados implementados",
    "security.securityFixes": "Correcciones de seguridad",
    "security.noIssuesFound": "No se encontraron problemas de seguridad.",
    "security.securityIssue": "Problema de seguridad",
    "security.howToFix": "Cómo solucionarlo:",
    "security.implementHeader": "Implementar encabezado",
    "security.currentValue": "Valor actual",
    "security.recommendedValue": "Valor recomendado",
    "security.steps.reviewHeader": "Revisar el estado actual del encabezado",
    "security.steps.addToConfig": "Agregar a la configuración del servidor",
    "security.steps.testChanges": "Probar los cambios",
    "security.steps.verifyDeployment": "Verificar la implementación",
    "security.quickStats": "Estadísticas rápidas",
    "security.headersFound": "Encabezados encontrados",
    "security.missingHeaders": "Encabezados faltantes",
    "security.cookiesAnalyzed": "Cookies analizadas",
    "security.overallGrade": "Calificación general",
    "security.headerAnalysis": "Análisis de encabezados",
    "security.headerPresent": "Encabezado presente",
    "security.headerMissing": "Encabezado faltante",
    "security.headerValue": "Valor del encabezado",
    "security.cookieSecurityAnalysis": "Análisis de seguridad de cookies",
    "security.securityScore": "Puntuación de seguridad",
    "security.bestPracticesScore": "Puntuación de mejores prácticas",
    "security.vulnerabilities": "Vulnerabilidades",
    "security.owaspCompliance": "Conformidad OWASP",
    "security.protocolSecurity": "Seguridad de protocolo",
    "security.certificateInfo": "Información del certificado",
  },

  fr: {
    // --- reports.common ---
    "common.runNewScan": "Lancer une nouvelle analyse",
    "common.result": "Résultat",
    "common.showingSavedReport": "Affichage du rapport enregistré du",
    "common.refresh": "Actualiser",
    "common.desktop": "Bureau",
    "common.mobile": "Mobile",
    "common.scanTimeout": "Délai d'attente dépassé. Le site web est peut-être trop lent. Veuillez réessayer.",
    "common.whyThisMatters": "Pourquoi c'est important",
    "common.technicalDetails": "Détails techniques",
    "common.whatsTheIssue": "Quel est le problème ?",
    "common.recommendedImplementation": "Implémentation recommandée",
    "common.overview": "Aperçu",
    "common.analyzing": "Analyse en cours...",
    "common.componentLoadError": "Erreur : Les composants du rapport n'ont pas pu être chargés. Veuillez actualiser la page.",
    "common.mayTake20to30Seconds": "Cela peut prendre 20 à 30 secondes",
    "common.export": "Exporter",
    "common.exportToExcel": "Exporter vers Excel",
    "common.proFeatureUnlock": "Fonctionnalité PRO – Débloquer pour exporter",
    "common.grade": "Note",
    "common.none": "Aucun",
    "common.unlockToView": "Débloquer pour voir :",
    "common.unlockSubtitle": "Export PDF, lien de partage, export de données et packs de corrections pour cette analyse.",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "Envisagez d'utiliser des polices variables pour une typographie plus flexible avec moins de fichiers.",
    "fonts.excellentTypography": "Typographie excellente !",
    "fonts.fontFixes": "Corrections de polices",
    "fonts.improvementsFound": "améliorations trouvées",
    "fonts.fontDisplayIssueDetected": "Problème d'affichage de police détecté",
    "fonts.moreIssues": "autres problèmes",

    // --- reports.metrics ---
    "metrics.overall": "Global",
    "metrics.security": "Sécurité",
    "metrics.accessibility": "Accessibilité",
    "metrics.performance": "Performance",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "À améliorer",
    "status.failed": "Échoué",
    "status.good": "Bon",
    "status.poor": "Mauvais",

    // --- reports.security ---
    "security.cookieIssues.missingHttpOnly": "Flag HttpOnly manquant",
    "security.cookieIssues.missingSecure": "Flag Secure manquant",
    "security.cookieIssues.missingSameSite": "Attribut SameSite manquant",
    "security.cookieIssues.sameSiteNoneSecure": "SameSite=None nécessite Secure",
    "security.cookieIssues.sessionNoHttpOnly": "Cookie de session sans HttpOnly",
    "security.cookieIssues.insecureSameSite": "Valeur SameSite non sécurisée",
    "security.implemented": "Implémenté",
    "security.vulnerabilityStatus": "État des vulnérabilités",
    "security.criticalIssues": "Problèmes critiques",
    "security.grade": "Note",
    "security.owaspControlsImplemented": "des contrôles de sécurité OWASP Top 10 implémentés",
    "security.goodSecurityPosture": "Bonne posture de sécurité !",
    "security.criticalRemediationSteps": "Étapes de correction critiques",
    "security.owaspAlignedFixes": "Corrections alignées OWASP",
    "security.desktopVsMobileAnalysis": "Analyse de sécurité bureau vs mobile",
    "security.platformSecurityGap": "Écart de sécurité entre plateformes",
    "security.desktopSecurityHigher": "La sécurité bureau est plus élevée",
    "security.mobileSecurityHigher": "La sécurité mobile est plus élevée",
    "security.consistentSecurity": "Sécurité cohérente",
    "security.crossPlatformConsistency": "Cohérence multiplateforme",
    "security.desktopGrade": "Note bureau",
    "security.mobileGrade": "Note mobile",
    "security.headersImplemented": "En-têtes implémentés",
    "security.securityFixes": "Corrections de sécurité",
    "security.noIssuesFound": "Aucun problème de sécurité trouvé.",
    "security.securityIssue": "Problème de sécurité",
    "security.howToFix": "Comment corriger :",
    "security.implementHeader": "Implémenter l'en-tête",
    "security.currentValue": "Valeur actuelle",
    "security.recommendedValue": "Valeur recommandée",
    "security.steps.reviewHeader": "Vérifier l'état actuel de l'en-tête",
    "security.steps.addToConfig": "Ajouter à la configuration du serveur",
    "security.steps.testChanges": "Tester les modifications",
    "security.steps.verifyDeployment": "Vérifier le déploiement",
    "security.quickStats": "Statistiques rapides",
    "security.headersFound": "En-têtes trouvés",
    "security.missingHeaders": "En-têtes manquants",
    "security.cookiesAnalyzed": "Cookies analysés",
    "security.overallGrade": "Note globale",
    "security.headerAnalysis": "Analyse des en-têtes",
    "security.headerPresent": "En-tête présent",
    "security.headerMissing": "En-tête manquant",
    "security.headerValue": "Valeur de l'en-tête",
    "security.cookieSecurityAnalysis": "Analyse de sécurité des cookies",
    "security.securityScore": "Score de sécurité",
    "security.bestPracticesScore": "Score des bonnes pratiques",
    "security.vulnerabilities": "Vulnérabilités",
    "security.owaspCompliance": "Conformité OWASP",
    "security.protocolSecurity": "Sécurité du protocole",
    "security.certificateInfo": "Informations sur le certificat",

    // --- reports.ipReputation (90 keys for fr) ---
    "ipReputation.noKnownThreatsDesc": "Aucune activité malveillante connue ou menace de sécurité associée à cette IP/domaine.",
    "ipReputation.spfRecord": "SPF (Sender Policy Framework)",
    "ipReputation.dkimRecord": "DKIM (DomainKeys Identified Mail)",
    "ipReputation.dmarcRecord": "DMARC (Domain-based Message Authentication)",
    "ipReputation.configured": "Configuré",
    "ipReputation.notConfigured": "Non configuré",
    "ipReputation.emailAuthentication": "Authentification des e-mails",
    "ipReputation.emailAuthDescription": "Vérifiez la configuration des protocoles d'authentification des e-mails pour prévenir l'usurpation d'identité.",
    "ipReputation.domainReputation": "Réputation du domaine",
    "ipReputation.ipAddress": "Adresse IP",
    "ipReputation.reverseDns": "DNS inverse",
    "ipReputation.geolocation": "Géolocalisation",
    "ipReputation.asnInfo": "Informations ASN",
    "ipReputation.threatIntelligence": "Renseignements sur les menaces",
    "ipReputation.blacklistStatus": "Statut de la liste noire",
    "ipReputation.notBlacklisted": "Non listé en liste noire",
    "ipReputation.blacklisted": "Listé en liste noire",
    "ipReputation.reputationScore": "Score de réputation",
    "ipReputation.clean": "Propre",
    "ipReputation.suspicious": "Suspect",
    "ipReputation.malicious": "Malveillant",
    "ipReputation.overallReputation": "Réputation globale",
    "ipReputation.sslCertificate": "Certificat SSL",
    "ipReputation.issuer": "Émetteur",
    "ipReputation.validFrom": "Valide depuis",
    "ipReputation.validUntil": "Valide jusqu'au",
    "ipReputation.daysRemaining": "Jours restants",
    "ipReputation.protocol": "Protocole",
    "ipReputation.serverInfo": "Informations sur le serveur",
    "ipReputation.hostingProvider": "Hébergeur",
    "ipReputation.serverSoftware": "Logiciel serveur",
    "ipReputation.openPorts": "Ports ouverts",
    "ipReputation.dnsRecords": "Enregistrements DNS",
    "ipReputation.aRecord": "Enregistrement A",
    "ipReputation.aaaaRecord": "Enregistrement AAAA",
    "ipReputation.mxRecord": "Enregistrement MX",
    "ipReputation.nsRecord": "Enregistrement NS",
    "ipReputation.txtRecord": "Enregistrement TXT",
    "ipReputation.cnameRecord": "Enregistrement CNAME",
    "ipReputation.securityHeaders": "En-têtes de sécurité",
    "ipReputation.headerPresent": "En-tête présent",
    "ipReputation.headerMissing": "En-tête manquant",
    "ipReputation.ipReputationFixes": "Corrections de réputation IP",
    "ipReputation.improvementsFound": "{{count}} améliorations trouvées",
    "ipReputation.noReputationIssues": "Aucun problème de réputation trouvé.",
    "ipReputation.emailSecurityIssue": "Problème de sécurité des e-mails",
    "ipReputation.dnsIssue": "Problème DNS",
    "ipReputation.sslIssue": "Problème SSL",
    "ipReputation.securityHeaderIssue": "Problème d'en-tête de sécurité",
  },

  ja: {
    // --- reports.accessibility (10 missing) ---
    "accessibility.wrongReportType": "保存されたレポートは別のアナライザーのものです。新しいアクセシビリティスキャンを実行してください。",
    "accessibility.wcag21Compliance": "WCAG 2.1 準拠",
    "accessibility.usingAxeCore": "影響を受けるプラットフォームにaxe-coreの代替アクセシビリティ指標を使用しています。",
    "accessibility.colorContrastAnalysis": "カラーコントラスト分析",
    "accessibility.score": "スコア",
    "accessibility.reqColorContrast": "十分な色のコントラスト（4.5:1）",
    "accessibility.reqFocusIndicators": "視認可能なフォーカスインジケーター",
    "accessibility.reqContentReflows": "コンテンツが適切にリフロー",
    "accessibility.reqAllLevelA": "すべてのレベルA要件",
    "accessibility.reqAudioDescriptions": "拡張音声解説",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "より柔軟なタイポグラフィのためにバリアブルフォントの使用を検討してください。",
    "fonts.excellentTypography": "優れたタイポグラフィ！",
    "fonts.fontFixes": "フォントの修正",
    "fonts.improvementsFound": "件の改善点が見つかりました",
    "fonts.fontDisplayIssueDetected": "フォント表示の問題を検出",
    "fonts.moreIssues": "件のその他の問題",

    // --- reports.metrics ---
    "metrics.overall": "全体",
    "metrics.security": "セキュリティ",
    "metrics.accessibility": "アクセシビリティ",
    "metrics.performance": "パフォーマンス",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "改善が必要",
    "status.failed": "失敗",
  },

  pt: {
    // --- reports.common ---
    "common.runNewScan": "Executar nova análise",
    "common.result": "Resultado",
    "common.showingSavedReport": "Mostrando relatório salvo de",
    "common.refresh": "Atualizar",
    "common.desktop": "Desktop",
    "common.mobile": "Móvel",
    "common.scanTimeout": "Tempo esgotado. O site pode estar lento demais. Tente novamente.",
    "common.whyThisMatters": "Por que isso importa",
    "common.technicalDetails": "Detalhes técnicos",
    "common.whatsTheIssue": "Qual é o problema?",
    "common.recommendedImplementation": "Implementação recomendada",
    "common.overview": "Visão geral",
    "common.analyzing": "Analisando...",
    "common.componentLoadError": "Erro: Componentes do relatório não carregaram. Atualize a página.",
    "common.mayTake20to30Seconds": "Isso pode levar 20-30 segundos",
    "common.export": "Exportar",
    "common.exportToExcel": "Exportar para Excel",
    "common.proFeatureUnlock": "Recurso PRO – Desbloquear para exportar",
    "common.grade": "Nota",
    "common.none": "Nenhum",
    "common.unlockToView": "Desbloquear para ver:",
    "common.unlockSubtitle": "Exportação PDF, link compartilhável, exportação de dados e pacotes de correção para esta análise.",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "Considere usar fontes variáveis para tipografia mais flexível com menos arquivos.",
    "fonts.excellentTypography": "Tipografia excelente!",
    "fonts.fontFixes": "Correções de fontes",
    "fonts.improvementsFound": "melhorias encontradas",
    "fonts.fontDisplayIssueDetected": "Problema de exibição de fonte detectado",
    "fonts.moreIssues": "mais problemas",

    // --- reports.metrics ---
    "metrics.overall": "Geral",
    "metrics.security": "Segurança",
    "metrics.accessibility": "Acessibilidade",
    "metrics.performance": "Desempenho",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "Precisa melhorar",
    "status.failed": "Falhou",

    // --- reports.security ---
    "security.cookieIssues.missingHttpOnly": "Flag HttpOnly ausente",
    "security.cookieIssues.missingSecure": "Flag Secure ausente",
    "security.cookieIssues.missingSameSite": "Atributo SameSite ausente",
    "security.cookieIssues.sameSiteNoneSecure": "SameSite=None requer Secure",
    "security.cookieIssues.sessionNoHttpOnly": "Cookie de sessão sem HttpOnly",
    "security.cookieIssues.insecureSameSite": "Valor SameSite inseguro",
    "security.implemented": "Implementado",
    "security.vulnerabilityStatus": "Status de vulnerabilidades",
    "security.criticalIssues": "Problemas críticos",
    "security.grade": "Nota",
    "security.owaspControlsImplemented": "dos controles de segurança OWASP Top 10 implementados",
    "security.goodSecurityPosture": "Boa postura de segurança!",
    "security.criticalRemediationSteps": "Passos de correção críticos",
    "security.owaspAlignedFixes": "Correções alinhadas com OWASP",
    "security.desktopVsMobileAnalysis": "Análise de segurança desktop vs móvel",
    "security.platformSecurityGap": "Lacuna de segurança entre plataformas",
    "security.desktopSecurityHigher": "Segurança desktop é maior",
    "security.mobileSecurityHigher": "Segurança móvel é maior",
    "security.consistentSecurity": "Segurança consistente",
    "security.crossPlatformConsistency": "Consistência multiplataforma",
    "security.desktopGrade": "Nota desktop",
    "security.mobileGrade": "Nota móvel",
    "security.headersImplemented": "Cabeçalhos implementados",
    "security.securityFixes": "Correções de segurança",
    "security.noIssuesFound": "Nenhum problema de segurança encontrado.",
    "security.securityIssue": "Problema de segurança",
    "security.howToFix": "Como corrigir:",
    "security.implementHeader": "Implementar cabeçalho",
    "security.currentValue": "Valor atual",
    "security.recommendedValue": "Valor recomendado",
    "security.steps.reviewHeader": "Verificar o status atual do cabeçalho",
    "security.steps.addToConfig": "Adicionar à configuração do servidor",
    "security.steps.testChanges": "Testar as alterações",
    "security.steps.verifyDeployment": "Verificar a implantação",
  },

  zh: {
    // --- reports.common ---
    "common.runNewScan": "\u8FD0\u884C\u65B0\u626B\u63CF",
    "common.result": "\u7ED3\u679C",
    "common.showingSavedReport": "\u663E\u793A\u4FDD\u5B58\u7684\u62A5\u544A",
    "common.refresh": "\u5237\u65B0",
    "common.desktop": "\u684C\u9762\u7AEF",
    "common.mobile": "\u79FB\u52A8\u7AEF",
    "common.scanTimeout": "\u626B\u63CF\u8D85\u65F6\u3002\u7F51\u7AD9\u53EF\u80FD\u592A\u6162\u3002\u8BF7\u91CD\u8BD5\u3002",
    "common.whyThisMatters": "\u4E3A\u4EC0\u4E48\u8FD9\u5F88\u91CD\u8981",
    "common.technicalDetails": "\u6280\u672F\u8BE6\u60C5",
    "common.whatsTheIssue": "\u95EE\u9898\u662F\u4EC0\u4E48\uFF1F",
    "common.recommendedImplementation": "\u63A8\u8350\u5B9E\u65BD\u65B9\u6848",
    "common.overview": "\u6982\u89C8",
    "common.analyzing": "\u5206\u6790\u4E2D...",
    "common.componentLoadError": "\u9519\u8BEF\uFF1A\u62A5\u544A\u7EC4\u4EF6\u52A0\u8F7D\u5931\u8D25\u3002\u8BF7\u5237\u65B0\u9875\u9762\u3002",
    "common.mayTake20to30Seconds": "\u8FD9\u53EF\u80FD\u9700\u898120-30\u79D2",
    "common.export": "\u5BFC\u51FA",
    "common.exportToExcel": "\u5BFC\u51FA\u5230Excel",
    "common.proFeatureUnlock": "PRO\u529F\u80FD \u2013 \u89E3\u9501\u4EE5\u5BFC\u51FA",
    "common.grade": "\u7B49\u7EA7",
    "common.none": "\u65E0",
    "common.unlockToView": "\u89E3\u9501\u67E5\u770B\uFF1A",
    "common.unlockSubtitle": "PDF\u5BFC\u51FA\u3001\u5206\u4EAB\u94FE\u63A5\u3001\u6570\u636E\u5BFC\u51FA\u548C\u4FEE\u590D\u5305\u3002",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "\u8003\u8651\u4F7F\u7528\u53EF\u53D8\u5B57\u4F53\u4EE5\u83B7\u5F97\u66F4\u7075\u6D3B\u7684\u6392\u7248\u548C\u66F4\u5C11\u7684\u6587\u4EF6\u3002",
    "fonts.excellentTypography": "\u4F18\u79C0\u7684\u6392\u7248\uFF01",
    "fonts.fontFixes": "\u5B57\u4F53\u4FEE\u590D",
    "fonts.improvementsFound": "\u9879\u6539\u8FDB",
    "fonts.fontDisplayIssueDetected": "\u68C0\u6D4B\u5230\u5B57\u4F53\u663E\u793A\u95EE\u9898",
    "fonts.moreIssues": "\u4E2A\u5176\u4ED6\u95EE\u9898",

    // --- reports.metrics ---
    "metrics.overall": "\u603B\u4F53",
    "metrics.security": "\u5B89\u5168",
    "metrics.accessibility": "\u65E0\u969C\u788D",
    "metrics.performance": "\u6027\u80FD",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "\u9700\u8981\u6539\u8FDB",
    "status.failed": "\u5931\u8D25",

    // --- reports.security ---
    "security.cookieIssues.missingHttpOnly": "\u7F3A\u5C11HttpOnly\u6807\u5FD7",
    "security.cookieIssues.missingSecure": "\u7F3A\u5C11Secure\u6807\u5FD7",
    "security.cookieIssues.missingSameSite": "\u7F3A\u5C11SameSite\u5C5E\u6027",
    "security.cookieIssues.sameSiteNoneSecure": "SameSite=None\u9700\u8981Secure",
    "security.cookieIssues.sessionNoHttpOnly": "\u4F1A\u8BDD\u7F3A\u5C11HttpOnly",
    "security.cookieIssues.insecureSameSite": "\u4E0D\u5B89\u5168\u7684SameSite\u503C",
    "security.implemented": "\u5DF2\u5B9E\u65BD",
    "security.vulnerabilityStatus": "\u6F0F\u6D1E\u72B6\u6001",
    "security.criticalIssues": "\u4E25\u91CD\u95EE\u9898",
    "security.grade": "\u7B49\u7EA7",
    "security.owaspControlsImplemented": "\u7684OWASP Top 10\u5B89\u5168\u63A7\u5236\u5DF2\u5B9E\u65BD",
    "security.goodSecurityPosture": "\u826F\u597D\u7684\u5B89\u5168\u6001\u52BF\uFF01",
    "security.criticalRemediationSteps": "\u5173\u952E\u4FEE\u590D\u6B65\u9AA4",
    "security.owaspAlignedFixes": "OWASP\u5BF9\u9F50\u7684\u4FEE\u590D",
    "security.desktopVsMobileAnalysis": "\u684C\u9762\u7AEFvs\u79FB\u52A8\u7AEF\u5B89\u5168\u5206\u6790",
    "security.platformSecurityGap": "\u5E73\u53F0\u5B89\u5168\u5DEE\u8DDD",
    "security.desktopSecurityHigher": "\u684C\u9762\u7AEF\u5B89\u5168\u6027\u66F4\u9AD8",
    "security.mobileSecurityHigher": "\u79FB\u52A8\u7AEF\u5B89\u5168\u6027\u66F4\u9AD8",
    "security.consistentSecurity": "\u4E00\u81F4\u7684\u5B89\u5168\u6027",
    "security.crossPlatformConsistency": "\u8DE8\u5E73\u53F0\u4E00\u81F4\u6027",
    "security.desktopGrade": "\u684C\u9762\u7AEF\u7B49\u7EA7",
    "security.mobileGrade": "\u79FB\u52A8\u7AEF\u7B49\u7EA7",
    "security.headersImplemented": "\u5DF2\u5B9E\u65BD\u7684\u5934\u90E8",
    "security.securityFixes": "\u5B89\u5168\u4FEE\u590D",
    "security.noIssuesFound": "\u672A\u53D1\u73B0\u5B89\u5168\u95EE\u9898\u3002",
    "security.securityIssue": "\u5B89\u5168\u95EE\u9898",
    "security.howToFix": "\u5982\u4F55\u4FEE\u590D\uFF1A",
    "security.implementHeader": "\u5B9E\u65BD\u5934\u90E8",
    "security.currentValue": "\u5F53\u524D\u503C",
    "security.recommendedValue": "\u63A8\u8350\u503C",
    "security.steps.reviewHeader": "\u68C0\u67E5\u5F53\u524D\u5934\u90E8\u72B6\u6001",
    "security.steps.addToConfig": "\u6DFB\u52A0\u5230\u670D\u52A1\u5668\u914D\u7F6E",
    "security.steps.testChanges": "\u6D4B\u8BD5\u66F4\u6539",
    "security.steps.verifyDeployment": "\u9A8C\u8BC1\u90E8\u7F72",
  },

  ru: {
    // --- reports.common (22 keys) ---
    "common.runNewScan": "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0435 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435",
    "common.result": "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
    "common.showingSavedReport": "\u041F\u043E\u043A\u0430\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0433\u043E \u043E\u0442\u0447\u0451\u0442\u0430 \u043E\u0442",
    "common.refresh": "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",
    "common.desktop": "\u041A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440",
    "common.mobile": "\u041C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0439",
    "common.scanTimeout": "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0435\u0432\u044B\u0441\u0438\u043B\u043E \u0432\u0440\u0435\u043C\u044F \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F. \u0421\u0430\u0439\u0442 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u044B\u043C. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430.",
    "common.whyThisMatters": "\u041F\u043E\u0447\u0435\u043C\u0443 \u044D\u0442\u043E \u0432\u0430\u0436\u043D\u043E",
    "common.technicalDetails": "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0434\u0435\u0442\u0430\u043B\u0438",
    "common.whatsTheIssue": "\u0412 \u0447\u0451\u043C \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430?",
    "common.recommendedImplementation": "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C\u0430\u044F \u0440\u0435\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F",
    "common.overview": "\u041E\u0431\u0437\u043E\u0440",
    "common.analyzing": "\u0410\u043D\u0430\u043B\u0438\u0437...",
    "common.componentLoadError": "\u041E\u0448\u0438\u0431\u043A\u0430: \u041A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B \u043E\u0442\u0447\u0451\u0442\u0430 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0438\u0441\u044C. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443.",
    "common.mayTake20to30Seconds": "\u042D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C 20-30 \u0441\u0435\u043A\u0443\u043D\u0434",
    "common.export": "\u042D\u043A\u0441\u043F\u043E\u0440\u0442",
    "common.exportToExcel": "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432 Excel",
    "common.proFeatureUnlock": "PRO-\u0444\u0443\u043D\u043A\u0446\u0438\u044F \u2013 \u0420\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430",
    "common.grade": "\u041E\u0446\u0435\u043D\u043A\u0430",
    "common.none": "\u041D\u0435\u0442",
    "common.unlockToView": "\u0420\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430:",
    "common.unlockSubtitle": "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 PDF, \u0441\u0441\u044B\u043B\u043A\u0430 \u0434\u043B\u044F \u043E\u0431\u043C\u0435\u043D\u0430, \u044D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u043F\u0430\u043A\u0435\u0442\u044B \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0439.",

    // --- reports.fonts ---
    "fonts.considerVariableFonts": "\u0420\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435 \u0432\u0430\u0440\u0438\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u0448\u0440\u0438\u0444\u0442\u044B \u0434\u043B\u044F \u0431\u043E\u043B\u0435\u0435 \u0433\u0438\u0431\u043A\u043E\u0439 \u0442\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0441 \u043C\u0435\u043D\u044C\u0448\u0438\u043C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E\u043C \u0444\u0430\u0439\u043B\u043E\u0432.",
    "fonts.excellentTypography": "\u041E\u0442\u043B\u0438\u0447\u043D\u0430\u044F \u0442\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0430!",
    "fonts.fontFixes": "\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0448\u0440\u0438\u0444\u0442\u043E\u0432",
    "fonts.improvementsFound": "\u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0439 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
    "fonts.fontDisplayIssueDetected": "\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0430 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0448\u0440\u0438\u0444\u0442\u0430",
    "fonts.moreIssues": "\u0434\u0440\u0443\u0433\u0438\u0445 \u043F\u0440\u043E\u0431\u043B\u0435\u043C",

    // --- reports.metrics ---
    "metrics.overall": "\u041E\u0431\u0449\u0438\u0439",
    "metrics.security": "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C",
    "metrics.accessibility": "\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u044C",
    "metrics.performance": "\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
    "metrics.seo": "SEO",

    // --- reports.status ---
    "status.needsImprovement": "\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F",
    "status.failed": "\u041D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E",
    "status.good": "\u0425\u043E\u0440\u043E\u0448\u043E",
    "status.poor": "\u041F\u043B\u043E\u0445\u043E",

    // --- reports.security ---
    "security.cookieIssues.missingHttpOnly": "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0444\u043B\u0430\u0433 HttpOnly",
    "security.cookieIssues.missingSecure": "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0444\u043B\u0430\u0433 Secure",
    "security.cookieIssues.missingSameSite": "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0430\u0442\u0440\u0438\u0431\u0443\u0442 SameSite",
    "security.cookieIssues.sameSiteNoneSecure": "SameSite=None \u0442\u0440\u0435\u0431\u0443\u0435\u0442 Secure",
    "security.cookieIssues.sessionNoHttpOnly": "\u0421\u0435\u0441\u0441\u0438\u043E\u043D\u043D\u044B\u0439 cookie \u0431\u0435\u0437 HttpOnly",
    "security.cookieIssues.insecureSameSite": "\u041D\u0435\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 SameSite",
    "security.implemented": "\u0420\u0435\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u043E",
    "security.vulnerabilityStatus": "\u0421\u0442\u0430\u0442\u0443\u0441 \u0443\u044F\u0437\u0432\u0438\u043C\u043E\u0441\u0442\u0435\u0439",
    "security.criticalIssues": "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B",
    "security.grade": "\u041E\u0446\u0435\u043D\u043A\u0430",
    "security.owaspControlsImplemented": "\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0435\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 OWASP Top 10 \u0440\u0435\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u043E",
    "security.goodSecurityPosture": "\u0425\u043E\u0440\u043E\u0448\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438!",
    "security.criticalRemediationSteps": "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0448\u0430\u0433\u0438 \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F",
    "security.owaspAlignedFixes": "\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u043E OWASP",
    "security.desktopVsMobileAnalysis": "\u0410\u043D\u0430\u043B\u0438\u0437 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438: \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440 vs \u043C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0439",
    "security.platformSecurityGap": "\u0420\u0430\u0437\u0440\u044B\u0432 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u043C\u0435\u0436\u0434\u0443 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0430\u043C\u0438",
    "security.desktopSecurityHigher": "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0430 \u0432\u044B\u0448\u0435",
    "security.mobileSecurityHigher": "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C \u043C\u043E\u0431\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u044B\u0448\u0435",
    "security.consistentSecurity": "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C",
    "security.crossPlatformConsistency": "\u041A\u0440\u043E\u0441\u0441\u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435\u043D\u043D\u0430\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0441\u0442\u044C",
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
const enReports = flattenKeys(en.reports, 'reports');
const enKeySet = Object.keys(enReports);

for (const lang of langs) {
  const data = JSON.parse(fs.readFileSync(path.join(i18nDir, lang + '.json'), 'utf8'));
  const langKeys = flattenKeys(data.reports || {}, 'reports');
  const langSet = new Set(Object.keys(langKeys));
  const missing = enKeySet.filter(k => !langSet.has(k));
  console.log(`${lang}: ${Object.keys(langKeys).length}/${enKeySet.length} keys (${missing.length} still missing)`);
}
