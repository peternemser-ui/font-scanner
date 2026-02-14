#!/usr/bin/env node
/**
 * i18n-add-hosting-translations.js
 *
 * Adds missing hosting report translations for all 7 non-English languages.
 * Reads en.json for the source keys, checks what's missing per language,
 * and deep-merges translated values.
 *
 * Usage: node scripts/i18n-add-hosting-translations.js
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
// Each language maps flat keys (under "reports.hosting.") to translated values.
// Keys here do NOT have the "reports." prefix - just "hosting.*".
// ============================================================

const translations = {
  de: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "Managed WordPress",
    "hosting.categories.jamstackEdge": "JAMstack/Edge",
    "hosting.categories.cloudVps": "Cloud VPS",
    "hosting.categories.ecommercePlatform": "E-Commerce-Plattform",
    "hosting.categories.sharedHosting": "Shared Hosting",
    "hosting.categories.managedCloud": "Managed Cloud",
    "hosting.categories.ecommerceWordPress": "E-Commerce WordPress",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "Beste WordPress-Leistung",
    "hosting.highlights.freeMigrations": "Kostenlose Migrationen",
    "hosting.highlights.support247": "24/7-Support",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "Schnellster WordPress-Host",
    "hosting.highlights.dataCenters35": "35+ Rechenzentren",
    "hosting.highlights.bestNextjs": "Ideal für Next.js",
    "hosting.highlights.edgeFunctions": "Edge Functions",
    "hosting.highlights.instantDeploy": "Sofortige Bereitstellungen",
    "hosting.highlights.jamstackPioneer": "Pionier von JAMstack",
    "hosting.highlights.greatDx": "Hervorragende Entwicklererfahrung",
    "hosting.highlights.builtInCiCd": "Integrierte CI/CD",
    "hosting.highlights.developerFriendly": "Entwicklerfreundlich",
    "hosting.highlights.simplePricing": "Einfache Preisgestaltung",
    "hosting.highlights.kubernetesSupport": "Kubernetes-Unterstützung",
    "hosting.highlights.cheapestCloudVps": "Günstigstes Cloud VPS",
    "hosting.highlights.locations32": "32 Standorte",
    "hosting.highlights.highPerfNvme": "Hochleistungs-NVMe",
    "hosting.highlights.bestValueEurope": "Bestes Preis-Leistungs-Verhältnis in Europa",
    "hosting.highlights.carbonNeutral": "Klimaneutral",
    "hosting.highlights.germanDataProtection": "Deutscher Datenschutz",
    "hosting.highlights.bestDropshipping": "Ideal für Dropshipping",
    "hosting.highlights.appEcosystem": "App-Ökosystem",
    "hosting.highlights.posIntegration": "POS-Integration",
    "hosting.highlights.unlimitedBandwidthFree": "Unbegrenzte Bandbreite kostenlos",
    "hosting.highlights.fastestEdgeNetwork": "Schnellstes Edge-Netzwerk",
    "hosting.highlights.workersIntegration": "Workers-Integration",
    "hosting.highlights.excellentSupport": "Exzellenter Support",
    "hosting.highlights.freeCdnEmail": "Kostenloses CDN & E-Mail",
    "hosting.highlights.bestBudgetOption": "Beste Budget-Option",
    "hosting.highlights.fastLiteSpeed": "Schnelle LiteSpeed-Server",
    "hosting.highlights.hPanelControl": "hPanel-Kontrollpanel",
    "hosting.highlights.chooseYourCloud": "Wählen Sie Ihre Cloud",
    "hosting.highlights.payAsYouGo": "Nutzungsbasierte Abrechnung",
    "hosting.highlights.noTransactionFees": "Keine Transaktionsgebühren",
    "hosting.highlights.builtInSeo": "Integriertes SEO",
    "hosting.highlights.multiChannelSelling": "Multichannel-Verkauf",
    "hosting.highlights.wooPreInstalled": "WooCommerce vorinstalliert",
    "hosting.highlights.freeDomain": "Kostenlose Domain",
    "hosting.highlights.sslIncluded": "SSL inklusive",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "Unternehmen",
    "hosting.bestFor.highTraffic": "Websites mit hohem Traffic",
    "hosting.bestFor.staticSites": "Statische Websites",
    "hosting.bestFor.gameServers": "Game-Server",
    "hosting.bestFor.europeFocused": "Europa-fokussiert",
    "hosting.bestFor.ecommerce": "E-Commerce",
    "hosting.bestFor.dropshipping": "Dropshipping",
    "hosting.bestFor.retail": "Einzelhandel",
    "hosting.bestFor.globalDelivery": "Globale Bereitstellung",
    "hosting.bestFor.smallBusiness": "Kleine Unternehmen",
    "hosting.bestFor.beginners": "Einsteiger",
    "hosting.bestFor.budgetSites": "Budget-Websites",
    "hosting.bestFor.agencies": "Agenturen",
    "hosting.bestFor.growingStores": "Wachsende Shops",
    "hosting.bestFor.smallStores": "Kleine Shops",
    "hosting.bestFor.wordPressUsers": "WordPress-Nutzer",

    // --- hosting.filters ---
    "hosting.filters.all": "Alle",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "Startpreis ($/Monat)",
    "hosting.charts.userRating": "Nutzerbewertung",
    "hosting.charts.valueScore": "Preis-Leistungs-Bewertung",
    "hosting.charts.higherBetterValue": "Höher = Besseres Preis-Leistungs-Verhältnis",

    // --- hosting.pricing ---
    "hosting.pricing.free": "KOSTENLOS",
    "hosting.pricing.mo": "Monat",
    "hosting.pricing.startingAt": "Ab",
    "hosting.pricing.month": "Monat",
    "hosting.pricing.year": "Jahr",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "Keine Anbieter entsprechen diesem Filter. Versuchen Sie eine andere Kategorie.",
    "hosting.badges.topPick": "TOP-AUSWAHL",
    "hosting.badges.runnerUp": "ZWEITER PLATZ",
    "hosting.bestForLabel": "Ideal für",
    "hosting.visitProvider": "{{name}} besuchen",
    "hosting.analysisFailedSimple": "Hosting-Analyse fehlgeschlagen",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "Priorität",
    "hosting.filterLabels.region": "Region",
    "hosting.filterLabels.ecommerce": "E-Commerce",
    "hosting.filterLabels.requiredFeatures": "Erforderliche Funktionen",
    "hosting.filterLabels.storage": "Speicher",
    "hosting.filterLabels.billing": "Abrechnung",

    // --- hosting.regions ---
    "hosting.regions.us": "Vereinigte Staaten",
    "hosting.regions.eu": "Europa",
    "hosting.regions.uk": "Vereinigtes Königreich",
    "hosting.regions.asia": "Asien-Pazifik",
    "hosting.regions.au": "Australien",
    "hosting.regions.latam": "Lateinamerika",
    "hosting.regions.plural": "Regionen",
    "hosting.regions.singular": "Region",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "Einfach (<100 Produkte)",
    "hosting.ecomLevels.medium": "Mittel (100–1.000)",
    "hosting.ecomLevels.large": "Groß (1.000+)",
    "hosting.ecomLevels.enterprise": "Unternehmen",

    // --- hosting.features ---
    "hosting.features.backups": "Backups",
    "hosting.features.staging": "Staging",
    "hosting.features.email": "E-Mail",
    "hosting.features.migration": "Migration",
    "hosting.features.support247": "24/7-Support",
    "hosting.features.uptime99": "99,9%+ Verfügbarkeit",

    // --- hosting.billing ---
    "hosting.billing.annual": "Jährlich",
    "hosting.billing.monthly": "Monatlich",
    "hosting.billing.multiYear": "Mehrjährig",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "Geschwindigkeit",
    "hosting.priorities.budget": "Budget",
    "hosting.priorities.support": "Support",
    "hosting.priorities.uptime": "Verfügbarkeit",
    "hosting.priorities.scalability": "Skalierbarkeit",
    "hosting.priorities.security": "Sicherheit",
    "hosting.priorities.ecommerceReady": "E-Commerce-bereit",

    // --- hosting analysis results ---
    "hosting.analysisResults": "Ergebnisse der Hosting-Analyse",
    "hosting.appliedFilters": "Angewandte Filter",
    "hosting.estimatedWebsiteTier": "Geschätzte Website-Stufe",
    "hosting.confidence": "Zuverlässigkeit",
    "hosting.detectionSignals": "Erkennungssignale",
    "hosting.recommendedBudget": "Empfohlenes Hosting-Budget",
    "hosting.typicalFor": "Typisch für",
    "hosting.trafficAppropriateRecommendations": "Verkehrsgerechte Empfehlungen",
    "hosting.unknownCustom": "Unbekannt / Benutzerdefiniert",
    "hosting.marketShare": "Marktanteil",
    "hosting.noCmsDetected": "Es konnte kein bekanntes CMS erkannt werden. Diese Website verwendet möglicherweise eine maßgeschneiderte Plattform oder ein CMS, das nicht in unserer Datenbank enthalten ist.",
    "hosting.notDetected": "Nicht erkannt",
    "hosting.category": "Kategorie",
    "hosting.detectedVia": "Erkannt über",
    "hosting.noHostDetected": "Der aktuelle Hosting-Anbieter konnte nicht anhand der DNS-Einträge ermittelt werden. Die Website befindet sich möglicherweise hinter einem CDN oder verwendet eine benutzerdefinierte Infrastruktur.",
    "hosting.tierMinimum": "Stufen-Minimum",
    "hosting.forHosting": "für {{name}} Hosting",
    "hosting.tierMinimumLabel": "Stufen-Minimum",
    "hosting.lowestPrice": "Niedrigster Preis",
    "hosting.averagePrice": "Durchschnittspreis",
    "hosting.premiumPrice": "Premium-Preis",
    "hosting.budgetOptions": "Budget-Optionen",
    "hosting.under5mo": "unter 5 $/Monat",
    "hosting.potentialSavings": "Mögliche Einsparungen",
    "hosting.savingsDescription": "Basierend auf Ihrem aktuellen Hosting gibt es Alternativen, die Ihnen Geld sparen könnten",
    "hosting.currentToNew": "Aktuell → Neu",
    "hosting.forPlatform": "für {{name}}",
    "hosting.match": "Übereinstimmung",
    "hosting.uptime": "Verfügbarkeit",
    "hosting.whyThisProvider": "Warum dieser Anbieter",
    "hosting.storage": "Speicher",

    // --- hosting.migration ---
    "hosting.migration.easy": "Einfache Migration",
    "hosting.migration.moderate": "Mittlere Migration",
    "hosting.migration.complex": "Komplexe Migration",

    "hosting.matchingProviders": "passende Anbieter",

    // --- hosting.table ---
    "hosting.table.provider": "Anbieter",
    "hosting.table.category": "Kategorie",
    "hosting.table.match": "Übereinstimmung",
    "hosting.table.rating": "Bewertung",
    "hosting.table.uptime": "Verfügbarkeit",
    "hosting.table.priceRange": "Preisspanne",
    "hosting.table.migration": "Migration",
    "hosting.table.link": "Link",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "Einfach",
    "hosting.migrationTable.medium": "Mittel",
    "hosting.migrationTable.hard": "Schwer",

    "hosting.visit": "Besuchen",
    "hosting.proTip": "Profi-Tipp",
    "hosting.proTipText": "Die angezeigten Preise sind Einstiegspreise bei jährlicher Abrechnung. Monatliche Abrechnung ist in der Regel 20–30 % teurer. Der Übereinstimmungswert zeigt an, wie gut der Anbieter zu Ihren Anforderungen passt. Berücksichtigen Sie Ihren Traffic-Bedarf, Support-Anforderungen und Skalierungspläne bei der Wahl eines Hosts.",
    "hosting.pdfSubtitle": "Hosting-Leistungs- & Infrastrukturanalyse",
  },

  es: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "WordPress administrado",
    "hosting.categories.jamstackEdge": "JAMstack/Edge",
    "hosting.categories.cloudVps": "Cloud VPS",
    "hosting.categories.ecommercePlatform": "Plataforma de comercio electrónico",
    "hosting.categories.sharedHosting": "Hosting compartido",
    "hosting.categories.managedCloud": "Cloud administrado",
    "hosting.categories.ecommerceWordPress": "WordPress para comercio electrónico",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "Mejor rendimiento de WordPress",
    "hosting.highlights.freeMigrations": "Migraciones gratuitas",
    "hosting.highlights.support247": "Soporte 24/7",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "Host WordPress más rápido",
    "hosting.highlights.dataCenters35": "35+ centros de datos",
    "hosting.highlights.bestNextjs": "Ideal para Next.js",
    "hosting.highlights.edgeFunctions": "Edge Functions",
    "hosting.highlights.instantDeploy": "Despliegues instantáneos",
    "hosting.highlights.jamstackPioneer": "Pionero de JAMstack",
    "hosting.highlights.greatDx": "Excelente experiencia de desarrollo",
    "hosting.highlights.builtInCiCd": "CI/CD integrado",
    "hosting.highlights.developerFriendly": "Amigable para desarrolladores",
    "hosting.highlights.simplePricing": "Precios simples",
    "hosting.highlights.kubernetesSupport": "Soporte para Kubernetes",
    "hosting.highlights.cheapestCloudVps": "Cloud VPS más económico",
    "hosting.highlights.locations32": "32 ubicaciones",
    "hosting.highlights.highPerfNvme": "NVMe de alto rendimiento",
    "hosting.highlights.bestValueEurope": "Mejor relación calidad-precio en Europa",
    "hosting.highlights.carbonNeutral": "Carbono neutral",
    "hosting.highlights.germanDataProtection": "Protección de datos alemana",
    "hosting.highlights.bestDropshipping": "Ideal para dropshipping",
    "hosting.highlights.appEcosystem": "Ecosistema de aplicaciones",
    "hosting.highlights.posIntegration": "Integración POS",
    "hosting.highlights.unlimitedBandwidthFree": "Ancho de banda ilimitado gratis",
    "hosting.highlights.fastestEdgeNetwork": "Red edge más rápida",
    "hosting.highlights.workersIntegration": "Integración con Workers",
    "hosting.highlights.excellentSupport": "Soporte excelente",
    "hosting.highlights.freeCdnEmail": "CDN y correo electrónico gratis",
    "hosting.highlights.bestBudgetOption": "Mejor opción económica",
    "hosting.highlights.fastLiteSpeed": "Servidores LiteSpeed rápidos",
    "hosting.highlights.hPanelControl": "Panel de control hPanel",
    "hosting.highlights.chooseYourCloud": "Elige tu nube",
    "hosting.highlights.payAsYouGo": "Pago por uso",
    "hosting.highlights.noTransactionFees": "Sin comisiones por transacción",
    "hosting.highlights.builtInSeo": "SEO integrado",
    "hosting.highlights.multiChannelSelling": "Venta multicanal",
    "hosting.highlights.wooPreInstalled": "WooCommerce preinstalado",
    "hosting.highlights.freeDomain": "Dominio gratis",
    "hosting.highlights.sslIncluded": "SSL incluido",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "Empresas",
    "hosting.bestFor.highTraffic": "Sitios de alto tráfico",
    "hosting.bestFor.staticSites": "Sitios estáticos",
    "hosting.bestFor.gameServers": "Servidores de juegos",
    "hosting.bestFor.europeFocused": "Enfocado en Europa",
    "hosting.bestFor.ecommerce": "Comercio electrónico",
    "hosting.bestFor.dropshipping": "Dropshipping",
    "hosting.bestFor.retail": "Retail",
    "hosting.bestFor.globalDelivery": "Distribución global",
    "hosting.bestFor.smallBusiness": "Pequeñas empresas",
    "hosting.bestFor.beginners": "Principiantes",
    "hosting.bestFor.budgetSites": "Sitios económicos",
    "hosting.bestFor.agencies": "Agencias",
    "hosting.bestFor.growingStores": "Tiendas en crecimiento",
    "hosting.bestFor.smallStores": "Tiendas pequeñas",
    "hosting.bestFor.wordPressUsers": "Usuarios de WordPress",

    // --- hosting.filters ---
    "hosting.filters.all": "Todos",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "Precio inicial ($/mes)",
    "hosting.charts.userRating": "Calificación de usuarios",
    "hosting.charts.valueScore": "Puntuación de valor",
    "hosting.charts.higherBetterValue": "Mayor = Mejor relación calidad-precio",

    // --- hosting.pricing ---
    "hosting.pricing.free": "GRATIS",
    "hosting.pricing.mo": "mes",
    "hosting.pricing.startingAt": "Desde",
    "hosting.pricing.month": "mes",
    "hosting.pricing.year": "año",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "Ningún proveedor coincide con este filtro. Prueba otra categoría.",
    "hosting.badges.topPick": "MEJOR OPCIÓN",
    "hosting.badges.runnerUp": "SEGUNDO LUGAR",
    "hosting.bestForLabel": "Ideal para",
    "hosting.visitProvider": "Visitar {{name}}",
    "hosting.analysisFailedSimple": "El análisis de hosting falló",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "Prioridad",
    "hosting.filterLabels.region": "Región",
    "hosting.filterLabels.ecommerce": "Comercio electrónico",
    "hosting.filterLabels.requiredFeatures": "Funciones requeridas",
    "hosting.filterLabels.storage": "Almacenamiento",
    "hosting.filterLabels.billing": "Facturación",

    // --- hosting.regions ---
    "hosting.regions.us": "Estados Unidos",
    "hosting.regions.eu": "Europa",
    "hosting.regions.uk": "Reino Unido",
    "hosting.regions.asia": "Asia Pacífico",
    "hosting.regions.au": "Australia",
    "hosting.regions.latam": "América Latina",
    "hosting.regions.plural": "regiones",
    "hosting.regions.singular": "región",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "Básico (<100 productos)",
    "hosting.ecomLevels.medium": "Medio (100–1K)",
    "hosting.ecomLevels.large": "Grande (1K+)",
    "hosting.ecomLevels.enterprise": "Empresarial",

    // --- hosting.features ---
    "hosting.features.backups": "Respaldos",
    "hosting.features.staging": "Staging",
    "hosting.features.email": "Correo electrónico",
    "hosting.features.migration": "Migración",
    "hosting.features.support247": "Soporte 24/7",
    "hosting.features.uptime99": "99.9%+ de disponibilidad",

    // --- hosting.billing ---
    "hosting.billing.annual": "Anual",
    "hosting.billing.monthly": "Mensual",
    "hosting.billing.multiYear": "Multianual",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "Velocidad",
    "hosting.priorities.budget": "Presupuesto",
    "hosting.priorities.support": "Soporte",
    "hosting.priorities.uptime": "Disponibilidad",
    "hosting.priorities.scalability": "Escalabilidad",
    "hosting.priorities.security": "Seguridad",
    "hosting.priorities.ecommerceReady": "Listo para comercio electrónico",

    // --- hosting analysis results ---
    "hosting.analysisResults": "Resultados del análisis de hosting",
    "hosting.appliedFilters": "Filtros aplicados",
    "hosting.estimatedWebsiteTier": "Nivel estimado del sitio web",
    "hosting.confidence": "Confianza",
    "hosting.detectionSignals": "Señales de detección",
    "hosting.recommendedBudget": "Presupuesto de hosting recomendado",
    "hosting.typicalFor": "Típico para",
    "hosting.trafficAppropriateRecommendations": "Recomendaciones según el tráfico",
    "hosting.unknownCustom": "Desconocido / Personalizado",
    "hosting.marketShare": "Cuota de mercado",
    "hosting.noCmsDetected": "No se pudo detectar un CMS conocido. Este sitio puede estar usando una plataforma personalizada o un CMS que no está en nuestra base de datos.",
    "hosting.notDetected": "No detectado",
    "hosting.category": "Categoría",
    "hosting.detectedVia": "Detectado mediante",
    "hosting.noHostDetected": "No se pudo determinar el proveedor de hosting actual a partir de los registros DNS. El sitio puede estar detrás de un CDN o usando infraestructura personalizada.",
    "hosting.tierMinimum": "mínimo del nivel",
    "hosting.forHosting": "para hosting de {{name}}",
    "hosting.tierMinimumLabel": "Mínimo del nivel",
    "hosting.lowestPrice": "Precio más bajo",
    "hosting.averagePrice": "Precio promedio",
    "hosting.premiumPrice": "Precio premium",
    "hosting.budgetOptions": "Opciones económicas",
    "hosting.under5mo": "menos de $5/mes",
    "hosting.potentialSavings": "Oportunidades de ahorro potencial",
    "hosting.savingsDescription": "Según tu hosting actual, aquí hay alternativas que podrían ahorrarte dinero",
    "hosting.currentToNew": "Actual → Nuevo",
    "hosting.forPlatform": "para {{name}}",
    "hosting.match": "Coincidencia",
    "hosting.uptime": "disponibilidad",
    "hosting.whyThisProvider": "Por qué este proveedor",
    "hosting.storage": "almacenamiento",

    // --- hosting.migration ---
    "hosting.migration.easy": "Migración fácil",
    "hosting.migration.moderate": "Migración moderada",
    "hosting.migration.complex": "Migración compleja",

    "hosting.matchingProviders": "proveedores coincidentes",

    // --- hosting.table ---
    "hosting.table.provider": "Proveedor",
    "hosting.table.category": "Categoría",
    "hosting.table.match": "Coincidencia",
    "hosting.table.rating": "Calificación",
    "hosting.table.uptime": "Disponibilidad",
    "hosting.table.priceRange": "Rango de precios",
    "hosting.table.migration": "Migración",
    "hosting.table.link": "Enlace",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "Fácil",
    "hosting.migrationTable.medium": "Medio",
    "hosting.migrationTable.hard": "Difícil",

    "hosting.visit": "Visitar",
    "hosting.proTip": "Consejo profesional",
    "hosting.proTipText": "Los precios mostrados son precios iniciales con facturación anual. La facturación mensual es típicamente 20-30% más cara. El porcentaje de coincidencia indica qué tan bien se adapta el proveedor a tus requisitos. Considera tus necesidades de tráfico, requisitos de soporte y planes de escalado al elegir un host.",
    "hosting.pdfSubtitle": "Análisis de rendimiento e infraestructura de hosting",
  },

  fr: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "WordPress géré",
    "hosting.categories.jamstackEdge": "JAMstack/Edge",
    "hosting.categories.cloudVps": "Cloud VPS",
    "hosting.categories.ecommercePlatform": "Plateforme e-commerce",
    "hosting.categories.sharedHosting": "Hébergement mutualisé",
    "hosting.categories.managedCloud": "Cloud géré",
    "hosting.categories.ecommerceWordPress": "WordPress e-commerce",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "Meilleures performances WordPress",
    "hosting.highlights.freeMigrations": "Migrations gratuites",
    "hosting.highlights.support247": "Support 24/7",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "Hébergeur WordPress le plus rapide",
    "hosting.highlights.dataCenters35": "35+ centres de données",
    "hosting.highlights.bestNextjs": "Idéal pour Next.js",
    "hosting.highlights.edgeFunctions": "Edge Functions",
    "hosting.highlights.instantDeploy": "Déploiements instantanés",
    "hosting.highlights.jamstackPioneer": "Pionnier du JAMstack",
    "hosting.highlights.greatDx": "Excellente expérience développeur",
    "hosting.highlights.builtInCiCd": "CI/CD intégré",
    "hosting.highlights.developerFriendly": "Adapté aux développeurs",
    "hosting.highlights.simplePricing": "Tarification simple",
    "hosting.highlights.kubernetesSupport": "Support Kubernetes",
    "hosting.highlights.cheapestCloudVps": "Cloud VPS le moins cher",
    "hosting.highlights.locations32": "32 emplacements",
    "hosting.highlights.highPerfNvme": "NVMe haute performance",
    "hosting.highlights.bestValueEurope": "Meilleur rapport qualité-prix en Europe",
    "hosting.highlights.carbonNeutral": "Neutre en carbone",
    "hosting.highlights.germanDataProtection": "Protection des données allemande",
    "hosting.highlights.bestDropshipping": "Idéal pour le dropshipping",
    "hosting.highlights.appEcosystem": "Écosystème d'applications",
    "hosting.highlights.posIntegration": "Intégration POS",
    "hosting.highlights.unlimitedBandwidthFree": "Bande passante illimitée gratuite",
    "hosting.highlights.fastestEdgeNetwork": "Réseau edge le plus rapide",
    "hosting.highlights.workersIntegration": "Intégration Workers",
    "hosting.highlights.excellentSupport": "Support excellent",
    "hosting.highlights.freeCdnEmail": "CDN et e-mail gratuits",
    "hosting.highlights.bestBudgetOption": "Meilleure option économique",
    "hosting.highlights.fastLiteSpeed": "Serveurs LiteSpeed rapides",
    "hosting.highlights.hPanelControl": "Panneau de contrôle hPanel",
    "hosting.highlights.chooseYourCloud": "Choisissez votre cloud",
    "hosting.highlights.payAsYouGo": "Paiement à l'utilisation",
    "hosting.highlights.noTransactionFees": "Aucuns frais de transaction",
    "hosting.highlights.builtInSeo": "SEO intégré",
    "hosting.highlights.multiChannelSelling": "Vente multicanal",
    "hosting.highlights.wooPreInstalled": "WooCommerce préinstallé",
    "hosting.highlights.freeDomain": "Domaine gratuit",
    "hosting.highlights.sslIncluded": "SSL inclus",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "Entreprises",
    "hosting.bestFor.highTraffic": "Sites à fort trafic",
    "hosting.bestFor.staticSites": "Sites statiques",
    "hosting.bestFor.gameServers": "Serveurs de jeux",
    "hosting.bestFor.europeFocused": "Orienté Europe",
    "hosting.bestFor.ecommerce": "E-commerce",
    "hosting.bestFor.dropshipping": "Dropshipping",
    "hosting.bestFor.retail": "Commerce de détail",
    "hosting.bestFor.globalDelivery": "Distribution mondiale",
    "hosting.bestFor.smallBusiness": "Petites entreprises",
    "hosting.bestFor.beginners": "Débutants",
    "hosting.bestFor.budgetSites": "Sites économiques",
    "hosting.bestFor.agencies": "Agences",
    "hosting.bestFor.growingStores": "Boutiques en croissance",
    "hosting.bestFor.smallStores": "Petites boutiques",
    "hosting.bestFor.wordPressUsers": "Utilisateurs WordPress",

    // --- hosting.filters ---
    "hosting.filters.all": "Tous",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "Prix de départ ($/mois)",
    "hosting.charts.userRating": "Évaluation des utilisateurs",
    "hosting.charts.valueScore": "Score de valeur",
    "hosting.charts.higherBetterValue": "Plus élevé = Meilleur rapport qualité-prix",

    // --- hosting.pricing ---
    "hosting.pricing.free": "GRATUIT",
    "hosting.pricing.mo": "mois",
    "hosting.pricing.startingAt": "À partir de",
    "hosting.pricing.month": "mois",
    "hosting.pricing.year": "an",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "Aucun fournisseur ne correspond à ce filtre. Essayez une autre catégorie.",
    "hosting.badges.topPick": "MEILLEUR CHOIX",
    "hosting.badges.runnerUp": "DEUXIÈME CHOIX",
    "hosting.bestForLabel": "Idéal pour",
    "hosting.visitProvider": "Visiter {{name}}",
    "hosting.analysisFailedSimple": "L'analyse d'hébergement a échoué",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "Priorité",
    "hosting.filterLabels.region": "Région",
    "hosting.filterLabels.ecommerce": "E-commerce",
    "hosting.filterLabels.requiredFeatures": "Fonctionnalités requises",
    "hosting.filterLabels.storage": "Stockage",
    "hosting.filterLabels.billing": "Facturation",

    // --- hosting.regions ---
    "hosting.regions.us": "États-Unis",
    "hosting.regions.eu": "Europe",
    "hosting.regions.uk": "Royaume-Uni",
    "hosting.regions.asia": "Asie-Pacifique",
    "hosting.regions.au": "Australie",
    "hosting.regions.latam": "Amérique latine",
    "hosting.regions.plural": "régions",
    "hosting.regions.singular": "région",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "Basique (<100 produits)",
    "hosting.ecomLevels.medium": "Moyen (100–1K)",
    "hosting.ecomLevels.large": "Grand (1K+)",
    "hosting.ecomLevels.enterprise": "Entreprise",

    // --- hosting.features ---
    "hosting.features.backups": "Sauvegardes",
    "hosting.features.staging": "Staging",
    "hosting.features.email": "E-mail",
    "hosting.features.migration": "Migration",
    "hosting.features.support247": "Support 24/7",
    "hosting.features.uptime99": "99,9%+ de disponibilité",

    // --- hosting.billing ---
    "hosting.billing.annual": "Annuel",
    "hosting.billing.monthly": "Mensuel",
    "hosting.billing.multiYear": "Pluriannuel",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "Vitesse",
    "hosting.priorities.budget": "Budget",
    "hosting.priorities.support": "Support",
    "hosting.priorities.uptime": "Disponibilité",
    "hosting.priorities.scalability": "Évolutivité",
    "hosting.priorities.security": "Sécurité",
    "hosting.priorities.ecommerceReady": "Prêt pour le e-commerce",

    // --- hosting analysis results ---
    "hosting.analysisResults": "Résultats de l'analyse d'hébergement",
    "hosting.appliedFilters": "Filtres appliqués",
    "hosting.estimatedWebsiteTier": "Niveau estimé du site web",
    "hosting.confidence": "Confiance",
    "hosting.detectionSignals": "Signaux de détection",
    "hosting.recommendedBudget": "Budget d'hébergement recommandé",
    "hosting.typicalFor": "Typique pour",
    "hosting.trafficAppropriateRecommendations": "Recommandations adaptées au trafic",
    "hosting.unknownCustom": "Inconnu / Personnalisé",
    "hosting.marketShare": "Part de marché",
    "hosting.noCmsDetected": "Impossible de détecter un CMS connu. Ce site utilise peut-être une plateforme sur mesure ou un CMS absent de notre base de données.",
    "hosting.notDetected": "Non détecté",
    "hosting.category": "Catégorie",
    "hosting.detectedVia": "Détecté via",
    "hosting.noHostDetected": "Impossible de déterminer le fournisseur d'hébergement actuel à partir des enregistrements DNS. Le site est peut-être derrière un CDN ou utilise une infrastructure personnalisée.",
    "hosting.tierMinimum": "minimum du niveau",
    "hosting.forHosting": "pour l'hébergement {{name}}",
    "hosting.tierMinimumLabel": "Minimum du niveau",
    "hosting.lowestPrice": "Prix le plus bas",
    "hosting.averagePrice": "Prix moyen",
    "hosting.premiumPrice": "Prix premium",
    "hosting.budgetOptions": "Options économiques",
    "hosting.under5mo": "moins de 5 $/mois",
    "hosting.potentialSavings": "Opportunités d'économies potentielles",
    "hosting.savingsDescription": "En fonction de votre hébergement actuel, voici des alternatives qui pourraient vous faire économiser",
    "hosting.currentToNew": "Actuel → Nouveau",
    "hosting.forPlatform": "pour {{name}}",
    "hosting.match": "Correspondance",
    "hosting.uptime": "disponibilité",
    "hosting.whyThisProvider": "Pourquoi ce fournisseur",
    "hosting.storage": "stockage",

    // --- hosting.migration ---
    "hosting.migration.easy": "Migration facile",
    "hosting.migration.moderate": "Migration modérée",
    "hosting.migration.complex": "Migration complexe",

    "hosting.matchingProviders": "fournisseurs correspondants",

    // --- hosting.table ---
    "hosting.table.provider": "Fournisseur",
    "hosting.table.category": "Catégorie",
    "hosting.table.match": "Correspondance",
    "hosting.table.rating": "Évaluation",
    "hosting.table.uptime": "Disponibilité",
    "hosting.table.priceRange": "Fourchette de prix",
    "hosting.table.migration": "Migration",
    "hosting.table.link": "Lien",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "Facile",
    "hosting.migrationTable.medium": "Moyen",
    "hosting.migrationTable.hard": "Difficile",

    "hosting.visit": "Visiter",
    "hosting.proTip": "Conseil de pro",
    "hosting.proTipText": "Les prix affichés sont des prix de départ avec facturation annuelle. La facturation mensuelle est généralement 20 à 30 % plus chère. Le pourcentage de correspondance indique dans quelle mesure le fournisseur répond à vos besoins. Tenez compte de vos besoins en trafic, de vos exigences en support et de vos plans de mise à l'échelle lors du choix d'un hébergeur.",
    "hosting.pdfSubtitle": "Analyse des performances et de l'infrastructure d'hébergement",
  },

  ja: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "マネージドWordPress",
    "hosting.categories.jamstackEdge": "JAMstack/エッジ",
    "hosting.categories.cloudVps": "クラウドVPS",
    "hosting.categories.ecommercePlatform": "ECプラットフォーム",
    "hosting.categories.sharedHosting": "共有ホスティング",
    "hosting.categories.managedCloud": "マネージドクラウド",
    "hosting.categories.ecommerceWordPress": "ECサイト向けWordPress",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "最高のWordPressパフォーマンス",
    "hosting.highlights.freeMigrations": "無料移行",
    "hosting.highlights.support247": "24時間365日サポート",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "最速のWordPressホスト",
    "hosting.highlights.dataCenters35": "35以上のデータセンター",
    "hosting.highlights.bestNextjs": "Next.jsに最適",
    "hosting.highlights.edgeFunctions": "エッジファンクション",
    "hosting.highlights.instantDeploy": "即時デプロイ",
    "hosting.highlights.jamstackPioneer": "JAMstackのパイオニア",
    "hosting.highlights.greatDx": "優れた開発者体験",
    "hosting.highlights.builtInCiCd": "CI/CD内蔵",
    "hosting.highlights.developerFriendly": "開発者フレンドリー",
    "hosting.highlights.simplePricing": "シンプルな料金体系",
    "hosting.highlights.kubernetesSupport": "Kubernetesサポート",
    "hosting.highlights.cheapestCloudVps": "最安値のクラウドVPS",
    "hosting.highlights.locations32": "32か所のロケーション",
    "hosting.highlights.highPerfNvme": "高性能NVMe",
    "hosting.highlights.bestValueEurope": "ヨーロッパで最高のコストパフォーマンス",
    "hosting.highlights.carbonNeutral": "カーボンニュートラル",
    "hosting.highlights.germanDataProtection": "ドイツのデータ保護基準",
    "hosting.highlights.bestDropshipping": "ドロップシッピングに最適",
    "hosting.highlights.appEcosystem": "アプリエコシステム",
    "hosting.highlights.posIntegration": "POS連携",
    "hosting.highlights.unlimitedBandwidthFree": "無制限帯域幅が無料",
    "hosting.highlights.fastestEdgeNetwork": "最速のエッジネットワーク",
    "hosting.highlights.workersIntegration": "Workers連携",
    "hosting.highlights.excellentSupport": "優れたサポート",
    "hosting.highlights.freeCdnEmail": "CDNとメールが無料",
    "hosting.highlights.bestBudgetOption": "最良の低価格オプション",
    "hosting.highlights.fastLiteSpeed": "高速LiteSpeedサーバー",
    "hosting.highlights.hPanelControl": "hPanelコントロールパネル",
    "hosting.highlights.chooseYourCloud": "クラウドを選択",
    "hosting.highlights.payAsYouGo": "従量課金制",
    "hosting.highlights.noTransactionFees": "取引手数料なし",
    "hosting.highlights.builtInSeo": "SEO内蔵",
    "hosting.highlights.multiChannelSelling": "マルチチャネル販売",
    "hosting.highlights.wooPreInstalled": "WooCommerceプリインストール済み",
    "hosting.highlights.freeDomain": "無料ドメイン",
    "hosting.highlights.sslIncluded": "SSL付き",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "エンタープライズ",
    "hosting.bestFor.highTraffic": "高トラフィックサイト",
    "hosting.bestFor.staticSites": "静的サイト",
    "hosting.bestFor.gameServers": "ゲームサーバー",
    "hosting.bestFor.europeFocused": "ヨーロッパ向け",
    "hosting.bestFor.ecommerce": "ECサイト",
    "hosting.bestFor.dropshipping": "ドロップシッピング",
    "hosting.bestFor.retail": "小売",
    "hosting.bestFor.globalDelivery": "グローバル配信",
    "hosting.bestFor.smallBusiness": "中小企業",
    "hosting.bestFor.beginners": "初心者",
    "hosting.bestFor.budgetSites": "低予算サイト",
    "hosting.bestFor.agencies": "エージェンシー",
    "hosting.bestFor.growingStores": "成長中のストア",
    "hosting.bestFor.smallStores": "小規模ストア",
    "hosting.bestFor.wordPressUsers": "WordPressユーザー",

    // --- hosting.filters ---
    "hosting.filters.all": "すべて",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "開始価格（$/月）",
    "hosting.charts.userRating": "ユーザー評価",
    "hosting.charts.valueScore": "バリュースコア",
    "hosting.charts.higherBetterValue": "高い = コストパフォーマンスが良い",

    // --- hosting.pricing ---
    "hosting.pricing.free": "無料",
    "hosting.pricing.mo": "月",
    "hosting.pricing.startingAt": "から",
    "hosting.pricing.month": "月",
    "hosting.pricing.year": "年",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "このフィルターに一致するプロバイダーがありません。別のカテゴリをお試しください。",
    "hosting.badges.topPick": "トップピック",
    "hosting.badges.runnerUp": "次点",
    "hosting.bestForLabel": "最適な用途",
    "hosting.visitProvider": "{{name}}を訪問",
    "hosting.analysisFailedSimple": "ホスティング分析に失敗しました",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "優先度",
    "hosting.filterLabels.region": "地域",
    "hosting.filterLabels.ecommerce": "ECサイト",
    "hosting.filterLabels.requiredFeatures": "必要な機能",
    "hosting.filterLabels.storage": "ストレージ",
    "hosting.filterLabels.billing": "請求",

    // --- hosting.regions ---
    "hosting.regions.us": "アメリカ合衆国",
    "hosting.regions.eu": "ヨーロッパ",
    "hosting.regions.uk": "イギリス",
    "hosting.regions.asia": "アジア太平洋",
    "hosting.regions.au": "オーストラリア",
    "hosting.regions.latam": "ラテンアメリカ",
    "hosting.regions.plural": "リージョン",
    "hosting.regions.singular": "リージョン",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "ベーシック（100商品未満）",
    "hosting.ecomLevels.medium": "ミディアム（100〜1,000）",
    "hosting.ecomLevels.large": "ラージ（1,000以上）",
    "hosting.ecomLevels.enterprise": "エンタープライズ",

    // --- hosting.features ---
    "hosting.features.backups": "バックアップ",
    "hosting.features.staging": "ステージング",
    "hosting.features.email": "メール",
    "hosting.features.migration": "移行",
    "hosting.features.support247": "24時間365日サポート",
    "hosting.features.uptime99": "99.9%以上の稼働率",

    // --- hosting.billing ---
    "hosting.billing.annual": "年間",
    "hosting.billing.monthly": "月間",
    "hosting.billing.multiYear": "複数年",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "速度",
    "hosting.priorities.budget": "予算",
    "hosting.priorities.support": "サポート",
    "hosting.priorities.uptime": "稼働率",
    "hosting.priorities.scalability": "スケーラビリティ",
    "hosting.priorities.security": "セキュリティ",
    "hosting.priorities.ecommerceReady": "EC対応",

    // --- hosting analysis results ---
    "hosting.analysisResults": "ホスティング分析結果",
    "hosting.appliedFilters": "適用中のフィルター",
    "hosting.estimatedWebsiteTier": "推定ウェブサイトティア",
    "hosting.confidence": "信頼度",
    "hosting.detectionSignals": "検出シグナル",
    "hosting.recommendedBudget": "推奨ホスティング予算",
    "hosting.typicalFor": "典型的な用途",
    "hosting.trafficAppropriateRecommendations": "トラフィックに適した推奨",
    "hosting.unknownCustom": "不明 / カスタム",
    "hosting.marketShare": "マーケットシェア",
    "hosting.noCmsDetected": "既知のCMSを検出できませんでした。このサイトはカスタムビルドのプラットフォームまたはデータベースにないCMSを使用している可能性があります。",
    "hosting.notDetected": "検出されませんでした",
    "hosting.category": "カテゴリ",
    "hosting.detectedVia": "検出方法",
    "hosting.noHostDetected": "DNSレコードから現在のホスティングプロバイダーを特定できませんでした。サイトがCDNの背後にあるか、カスタムインフラストラクチャを使用している可能性があります。",
    "hosting.tierMinimum": "ティア最低額",
    "hosting.forHosting": "{{name}}ホスティング向け",
    "hosting.tierMinimumLabel": "ティア最低額",
    "hosting.lowestPrice": "最低価格",
    "hosting.averagePrice": "平均価格",
    "hosting.premiumPrice": "プレミアム価格",
    "hosting.budgetOptions": "低価格オプション",
    "hosting.under5mo": "月額5ドル未満",
    "hosting.potentialSavings": "節約の可能性",
    "hosting.savingsDescription": "現在のホスティングに基づき、コスト削減が可能な代替サービスをご紹介します",
    "hosting.currentToNew": "現在 → 新規",
    "hosting.forPlatform": "{{name}}向け",
    "hosting.match": "適合度",
    "hosting.uptime": "稼働率",
    "hosting.whyThisProvider": "このプロバイダーを選ぶ理由",
    "hosting.storage": "ストレージ",

    // --- hosting.migration ---
    "hosting.migration.easy": "簡単な移行",
    "hosting.migration.moderate": "中程度の移行",
    "hosting.migration.complex": "複雑な移行",

    "hosting.matchingProviders": "件の一致するプロバイダー",

    // --- hosting.table ---
    "hosting.table.provider": "プロバイダー",
    "hosting.table.category": "カテゴリ",
    "hosting.table.match": "適合度",
    "hosting.table.rating": "評価",
    "hosting.table.uptime": "稼働率",
    "hosting.table.priceRange": "価格帯",
    "hosting.table.migration": "移行",
    "hosting.table.link": "リンク",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "簡単",
    "hosting.migrationTable.medium": "中程度",
    "hosting.migrationTable.hard": "困難",

    "hosting.visit": "訪問",
    "hosting.proTip": "プロのヒント",
    "hosting.proTipText": "表示価格は年間契約の開始価格です。月額契約は通常20〜30%高くなります。適合度はプロバイダーがお客様の要件にどれだけ合っているかを示します。ホストを選ぶ際は、トラフィックニーズ、サポート要件、スケーリング計画を考慮してください。",
    "hosting.pdfSubtitle": "ホスティングパフォーマンスとインフラストラクチャ分析",
  },

  pt: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "WordPress gerenciado",
    "hosting.categories.jamstackEdge": "JAMstack/Edge",
    "hosting.categories.cloudVps": "Cloud VPS",
    "hosting.categories.ecommercePlatform": "Plataforma de e-commerce",
    "hosting.categories.sharedHosting": "Hospedagem compartilhada",
    "hosting.categories.managedCloud": "Cloud gerenciado",
    "hosting.categories.ecommerceWordPress": "WordPress para e-commerce",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "Melhor desempenho WordPress",
    "hosting.highlights.freeMigrations": "Migrações gratuitas",
    "hosting.highlights.support247": "Suporte 24/7",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "Host WordPress mais rápido",
    "hosting.highlights.dataCenters35": "35+ data centers",
    "hosting.highlights.bestNextjs": "Ideal para Next.js",
    "hosting.highlights.edgeFunctions": "Edge Functions",
    "hosting.highlights.instantDeploy": "Implantações instantâneas",
    "hosting.highlights.jamstackPioneer": "Pioneiro do JAMstack",
    "hosting.highlights.greatDx": "Excelente experiência de desenvolvimento",
    "hosting.highlights.builtInCiCd": "CI/CD integrado",
    "hosting.highlights.developerFriendly": "Amigável para desenvolvedores",
    "hosting.highlights.simplePricing": "Preços simples",
    "hosting.highlights.kubernetesSupport": "Suporte a Kubernetes",
    "hosting.highlights.cheapestCloudVps": "Cloud VPS mais barato",
    "hosting.highlights.locations32": "32 localizações",
    "hosting.highlights.highPerfNvme": "NVMe de alto desempenho",
    "hosting.highlights.bestValueEurope": "Melhor custo-benefício na Europa",
    "hosting.highlights.carbonNeutral": "Carbono neutro",
    "hosting.highlights.germanDataProtection": "Proteção de dados alemã",
    "hosting.highlights.bestDropshipping": "Ideal para dropshipping",
    "hosting.highlights.appEcosystem": "Ecossistema de aplicativos",
    "hosting.highlights.posIntegration": "Integração POS",
    "hosting.highlights.unlimitedBandwidthFree": "Largura de banda ilimitada grátis",
    "hosting.highlights.fastestEdgeNetwork": "Rede edge mais rápida",
    "hosting.highlights.workersIntegration": "Integração com Workers",
    "hosting.highlights.excellentSupport": "Suporte excelente",
    "hosting.highlights.freeCdnEmail": "CDN e e-mail grátis",
    "hosting.highlights.bestBudgetOption": "Melhor opção econômica",
    "hosting.highlights.fastLiteSpeed": "Servidores LiteSpeed rápidos",
    "hosting.highlights.hPanelControl": "Painel de controle hPanel",
    "hosting.highlights.chooseYourCloud": "Escolha sua nuvem",
    "hosting.highlights.payAsYouGo": "Pague conforme o uso",
    "hosting.highlights.noTransactionFees": "Sem taxas de transação",
    "hosting.highlights.builtInSeo": "SEO integrado",
    "hosting.highlights.multiChannelSelling": "Venda multicanal",
    "hosting.highlights.wooPreInstalled": "WooCommerce pré-instalado",
    "hosting.highlights.freeDomain": "Domínio grátis",
    "hosting.highlights.sslIncluded": "SSL incluso",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "Empresas",
    "hosting.bestFor.highTraffic": "Sites de alto tráfego",
    "hosting.bestFor.staticSites": "Sites estáticos",
    "hosting.bestFor.gameServers": "Servidores de jogos",
    "hosting.bestFor.europeFocused": "Focado na Europa",
    "hosting.bestFor.ecommerce": "E-commerce",
    "hosting.bestFor.dropshipping": "Dropshipping",
    "hosting.bestFor.retail": "Varejo",
    "hosting.bestFor.globalDelivery": "Distribuição global",
    "hosting.bestFor.smallBusiness": "Pequenas empresas",
    "hosting.bestFor.beginners": "Iniciantes",
    "hosting.bestFor.budgetSites": "Sites econômicos",
    "hosting.bestFor.agencies": "Agências",
    "hosting.bestFor.growingStores": "Lojas em crescimento",
    "hosting.bestFor.smallStores": "Lojas pequenas",
    "hosting.bestFor.wordPressUsers": "Usuários WordPress",

    // --- hosting.filters ---
    "hosting.filters.all": "Todos",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "Preço inicial ($/mês)",
    "hosting.charts.userRating": "Avaliação dos usuários",
    "hosting.charts.valueScore": "Pontuação de valor",
    "hosting.charts.higherBetterValue": "Maior = Melhor custo-benefício",

    // --- hosting.pricing ---
    "hosting.pricing.free": "GRÁTIS",
    "hosting.pricing.mo": "mês",
    "hosting.pricing.startingAt": "A partir de",
    "hosting.pricing.month": "mês",
    "hosting.pricing.year": "ano",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "Nenhum provedor corresponde a este filtro. Tente outra categoria.",
    "hosting.badges.topPick": "MELHOR ESCOLHA",
    "hosting.badges.runnerUp": "SEGUNDO LUGAR",
    "hosting.bestForLabel": "Ideal para",
    "hosting.visitProvider": "Visitar {{name}}",
    "hosting.analysisFailedSimple": "A análise de hospedagem falhou",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "Prioridade",
    "hosting.filterLabels.region": "Região",
    "hosting.filterLabels.ecommerce": "E-commerce",
    "hosting.filterLabels.requiredFeatures": "Recursos necessários",
    "hosting.filterLabels.storage": "Armazenamento",
    "hosting.filterLabels.billing": "Faturamento",

    // --- hosting.regions ---
    "hosting.regions.us": "Estados Unidos",
    "hosting.regions.eu": "Europa",
    "hosting.regions.uk": "Reino Unido",
    "hosting.regions.asia": "Ásia-Pacífico",
    "hosting.regions.au": "Austrália",
    "hosting.regions.latam": "América Latina",
    "hosting.regions.plural": "regiões",
    "hosting.regions.singular": "região",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "Básico (<100 produtos)",
    "hosting.ecomLevels.medium": "Médio (100–1K)",
    "hosting.ecomLevels.large": "Grande (1K+)",
    "hosting.ecomLevels.enterprise": "Empresarial",

    // --- hosting.features ---
    "hosting.features.backups": "Backups",
    "hosting.features.staging": "Staging",
    "hosting.features.email": "E-mail",
    "hosting.features.migration": "Migração",
    "hosting.features.support247": "Suporte 24/7",
    "hosting.features.uptime99": "99,9%+ de disponibilidade",

    // --- hosting.billing ---
    "hosting.billing.annual": "Anual",
    "hosting.billing.monthly": "Mensal",
    "hosting.billing.multiYear": "Plurianual",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "Velocidade",
    "hosting.priorities.budget": "Orçamento",
    "hosting.priorities.support": "Suporte",
    "hosting.priorities.uptime": "Disponibilidade",
    "hosting.priorities.scalability": "Escalabilidade",
    "hosting.priorities.security": "Segurança",
    "hosting.priorities.ecommerceReady": "Pronto para e-commerce",

    // --- hosting analysis results ---
    "hosting.analysisResults": "Resultados da análise de hospedagem",
    "hosting.appliedFilters": "Filtros aplicados",
    "hosting.estimatedWebsiteTier": "Nível estimado do site",
    "hosting.confidence": "Confiança",
    "hosting.detectionSignals": "Sinais de detecção",
    "hosting.recommendedBudget": "Orçamento de hospedagem recomendado",
    "hosting.typicalFor": "Típico para",
    "hosting.trafficAppropriateRecommendations": "Recomendações adequadas ao tráfego",
    "hosting.unknownCustom": "Desconhecido / Personalizado",
    "hosting.marketShare": "Participação de mercado",
    "hosting.noCmsDetected": "Não foi possível detectar um CMS conhecido. Este site pode estar usando uma plataforma personalizada ou um CMS que não está em nosso banco de dados.",
    "hosting.notDetected": "Não detectado",
    "hosting.category": "Categoria",
    "hosting.detectedVia": "Detectado via",
    "hosting.noHostDetected": "Não foi possível determinar o provedor de hospedagem atual pelos registros DNS. O site pode estar atrás de um CDN ou usando infraestrutura personalizada.",
    "hosting.tierMinimum": "mínimo do nível",
    "hosting.forHosting": "para hospedagem {{name}}",
    "hosting.tierMinimumLabel": "Mínimo do nível",
    "hosting.lowestPrice": "Menor preço",
    "hosting.averagePrice": "Preço médio",
    "hosting.premiumPrice": "Preço premium",
    "hosting.budgetOptions": "Opções econômicas",
    "hosting.under5mo": "abaixo de US$ 5/mês",
    "hosting.potentialSavings": "Oportunidades de economia potencial",
    "hosting.savingsDescription": "Com base na sua hospedagem atual, aqui estão alternativas que podem economizar dinheiro",
    "hosting.currentToNew": "Atual → Novo",
    "hosting.forPlatform": "para {{name}}",
    "hosting.match": "Compatibilidade",
    "hosting.uptime": "disponibilidade",
    "hosting.whyThisProvider": "Por que este provedor",
    "hosting.storage": "armazenamento",

    // --- hosting.migration ---
    "hosting.migration.easy": "Migração fácil",
    "hosting.migration.moderate": "Migração moderada",
    "hosting.migration.complex": "Migração complexa",

    "hosting.matchingProviders": "provedores compatíveis",

    // --- hosting.table ---
    "hosting.table.provider": "Provedor",
    "hosting.table.category": "Categoria",
    "hosting.table.match": "Compatibilidade",
    "hosting.table.rating": "Avaliação",
    "hosting.table.uptime": "Disponibilidade",
    "hosting.table.priceRange": "Faixa de preço",
    "hosting.table.migration": "Migração",
    "hosting.table.link": "Link",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "Fácil",
    "hosting.migrationTable.medium": "Médio",
    "hosting.migrationTable.hard": "Difícil",

    "hosting.visit": "Visitar",
    "hosting.proTip": "Dica profissional",
    "hosting.proTipText": "Os preços mostrados são preços iniciais com cobrança anual. A cobrança mensal é normalmente 20-30% mais cara. A porcentagem de compatibilidade indica o quanto o provedor atende aos seus requisitos. Considere suas necessidades de tráfego, requisitos de suporte e planos de escalabilidade ao escolher um host.",
    "hosting.pdfSubtitle": "Análise de desempenho e infraestrutura de hospedagem",
  },

  zh: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "托管WordPress",
    "hosting.categories.jamstackEdge": "JAMstack/边缘",
    "hosting.categories.cloudVps": "云VPS",
    "hosting.categories.ecommercePlatform": "电商平台",
    "hosting.categories.sharedHosting": "共享主机",
    "hosting.categories.managedCloud": "托管云",
    "hosting.categories.ecommerceWordPress": "电商WordPress",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "最佳WordPress性能",
    "hosting.highlights.freeMigrations": "免费迁移",
    "hosting.highlights.support247": "全天候支持",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "最快的WordPress主机",
    "hosting.highlights.dataCenters35": "35+个数据中心",
    "hosting.highlights.bestNextjs": "最适合Next.js",
    "hosting.highlights.edgeFunctions": "边缘函数",
    "hosting.highlights.instantDeploy": "即时部署",
    "hosting.highlights.jamstackPioneer": "JAMstack先驱",
    "hosting.highlights.greatDx": "出色的开发者体验",
    "hosting.highlights.builtInCiCd": "内置CI/CD",
    "hosting.highlights.developerFriendly": "开发者友好",
    "hosting.highlights.simplePricing": "简单定价",
    "hosting.highlights.kubernetesSupport": "Kubernetes支持",
    "hosting.highlights.cheapestCloudVps": "最便宜的云VPS",
    "hosting.highlights.locations32": "32个位置",
    "hosting.highlights.highPerfNvme": "高性能NVMe",
    "hosting.highlights.bestValueEurope": "欧洲最佳性价比",
    "hosting.highlights.carbonNeutral": "碳中和",
    "hosting.highlights.germanDataProtection": "德国数据保护",
    "hosting.highlights.bestDropshipping": "最适合代发货",
    "hosting.highlights.appEcosystem": "应用生态系统",
    "hosting.highlights.posIntegration": "POS集成",
    "hosting.highlights.unlimitedBandwidthFree": "免费无限带宽",
    "hosting.highlights.fastestEdgeNetwork": "最快的边缘网络",
    "hosting.highlights.workersIntegration": "Workers集成",
    "hosting.highlights.excellentSupport": "优质支持",
    "hosting.highlights.freeCdnEmail": "免费CDN和邮箱",
    "hosting.highlights.bestBudgetOption": "最佳经济型选择",
    "hosting.highlights.fastLiteSpeed": "快速LiteSpeed服务器",
    "hosting.highlights.hPanelControl": "hPanel控制面板",
    "hosting.highlights.chooseYourCloud": "选择您的云",
    "hosting.highlights.payAsYouGo": "按量付费",
    "hosting.highlights.noTransactionFees": "无交易费用",
    "hosting.highlights.builtInSeo": "内置SEO",
    "hosting.highlights.multiChannelSelling": "多渠道销售",
    "hosting.highlights.wooPreInstalled": "WooCommerce预装",
    "hosting.highlights.freeDomain": "免费域名",
    "hosting.highlights.sslIncluded": "含SSL",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "企业",
    "hosting.bestFor.highTraffic": "高流量网站",
    "hosting.bestFor.staticSites": "静态网站",
    "hosting.bestFor.gameServers": "游戏服务器",
    "hosting.bestFor.europeFocused": "面向欧洲",
    "hosting.bestFor.ecommerce": "电子商务",
    "hosting.bestFor.dropshipping": "代发货",
    "hosting.bestFor.retail": "零售",
    "hosting.bestFor.globalDelivery": "全球分发",
    "hosting.bestFor.smallBusiness": "小型企业",
    "hosting.bestFor.beginners": "初学者",
    "hosting.bestFor.budgetSites": "经济型网站",
    "hosting.bestFor.agencies": "代理机构",
    "hosting.bestFor.growingStores": "成长中的商店",
    "hosting.bestFor.smallStores": "小型商店",
    "hosting.bestFor.wordPressUsers": "WordPress用户",

    // --- hosting.filters ---
    "hosting.filters.all": "全部",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "起始价格（$/月）",
    "hosting.charts.userRating": "用户评分",
    "hosting.charts.valueScore": "性价比评分",
    "hosting.charts.higherBetterValue": "越高 = 性价比越好",

    // --- hosting.pricing ---
    "hosting.pricing.free": "免费",
    "hosting.pricing.mo": "月",
    "hosting.pricing.startingAt": "起价",
    "hosting.pricing.month": "月",
    "hosting.pricing.year": "年",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "没有匹配此筛选条件的提供商。请尝试其他类别。",
    "hosting.badges.topPick": "首选",
    "hosting.badges.runnerUp": "亚军",
    "hosting.bestForLabel": "最适合",
    "hosting.visitProvider": "访问{{name}}",
    "hosting.analysisFailedSimple": "主机分析失败",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "优先级",
    "hosting.filterLabels.region": "地区",
    "hosting.filterLabels.ecommerce": "电子商务",
    "hosting.filterLabels.requiredFeatures": "所需功能",
    "hosting.filterLabels.storage": "存储",
    "hosting.filterLabels.billing": "计费",

    // --- hosting.regions ---
    "hosting.regions.us": "美国",
    "hosting.regions.eu": "欧洲",
    "hosting.regions.uk": "英国",
    "hosting.regions.asia": "亚太地区",
    "hosting.regions.au": "澳大利亚",
    "hosting.regions.latam": "拉丁美洲",
    "hosting.regions.plural": "个地区",
    "hosting.regions.singular": "个地区",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "基础（<100个产品）",
    "hosting.ecomLevels.medium": "中等（100–1K）",
    "hosting.ecomLevels.large": "大型（1K+）",
    "hosting.ecomLevels.enterprise": "企业级",

    // --- hosting.features ---
    "hosting.features.backups": "备份",
    "hosting.features.staging": "暂存环境",
    "hosting.features.email": "邮箱",
    "hosting.features.migration": "迁移",
    "hosting.features.support247": "全天候支持",
    "hosting.features.uptime99": "99.9%+正常运行时间",

    // --- hosting.billing ---
    "hosting.billing.annual": "年付",
    "hosting.billing.monthly": "月付",
    "hosting.billing.multiYear": "多年",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "速度",
    "hosting.priorities.budget": "预算",
    "hosting.priorities.support": "支持",
    "hosting.priorities.uptime": "正常运行时间",
    "hosting.priorities.scalability": "可扩展性",
    "hosting.priorities.security": "安全性",
    "hosting.priorities.ecommerceReady": "电商就绪",

    // --- hosting analysis results ---
    "hosting.analysisResults": "主机分析结果",
    "hosting.appliedFilters": "已应用的筛选条件",
    "hosting.estimatedWebsiteTier": "预估网站等级",
    "hosting.confidence": "置信度",
    "hosting.detectionSignals": "检测信号",
    "hosting.recommendedBudget": "推荐的主机预算",
    "hosting.typicalFor": "适用于",
    "hosting.trafficAppropriateRecommendations": "基于流量的推荐",
    "hosting.unknownCustom": "未知 / 自定义",
    "hosting.marketShare": "市场份额",
    "hosting.noCmsDetected": "无法检测到已知的CMS。该网站可能使用了自建平台或未收录在我们数据库中的CMS。",
    "hosting.notDetected": "未检测到",
    "hosting.category": "类别",
    "hosting.detectedVia": "检测方式",
    "hosting.noHostDetected": "无法从DNS记录中确定当前的主机提供商。该网站可能位于CDN后面或使用自定义基础设施。",
    "hosting.tierMinimum": "等级最低价",
    "hosting.forHosting": "{{name}}主机",
    "hosting.tierMinimumLabel": "等级最低价",
    "hosting.lowestPrice": "最低价格",
    "hosting.averagePrice": "平均价格",
    "hosting.premiumPrice": "高级价格",
    "hosting.budgetOptions": "经济型选项",
    "hosting.under5mo": "低于$5/月",
    "hosting.potentialSavings": "潜在的节省机会",
    "hosting.savingsDescription": "根据您当前的主机方案，以下替代方案可能帮您节省费用",
    "hosting.currentToNew": "当前 → 新方案",
    "hosting.forPlatform": "适用于{{name}}",
    "hosting.match": "匹配度",
    "hosting.uptime": "正常运行时间",
    "hosting.whyThisProvider": "为什么选择此提供商",
    "hosting.storage": "存储",

    // --- hosting.migration ---
    "hosting.migration.easy": "轻松迁移",
    "hosting.migration.moderate": "中等迁移",
    "hosting.migration.complex": "复杂迁移",

    "hosting.matchingProviders": "个匹配的提供商",

    // --- hosting.table ---
    "hosting.table.provider": "提供商",
    "hosting.table.category": "类别",
    "hosting.table.match": "匹配度",
    "hosting.table.rating": "评分",
    "hosting.table.uptime": "正常运行时间",
    "hosting.table.priceRange": "价格范围",
    "hosting.table.migration": "迁移",
    "hosting.table.link": "链接",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "简单",
    "hosting.migrationTable.medium": "中等",
    "hosting.migrationTable.hard": "困难",

    "hosting.visit": "访问",
    "hosting.proTip": "专业提示",
    "hosting.proTipText": "显示的价格为年付起始价格。月付通常贵20-30%。匹配百分比表示提供商与您的需求的契合程度。选择主机时，请考虑您的流量需求、支持要求和扩展计划。",
    "hosting.pdfSubtitle": "主机性能与基础设施分析",
  },

  ru: {
    // --- hosting.categories ---
    "hosting.categories.managedWordPress": "Управляемый WordPress",
    "hosting.categories.jamstackEdge": "JAMstack/Edge",
    "hosting.categories.cloudVps": "Облачный VPS",
    "hosting.categories.ecommercePlatform": "Платформа электронной коммерции",
    "hosting.categories.sharedHosting": "Виртуальный хостинг",
    "hosting.categories.managedCloud": "Управляемое облако",
    "hosting.categories.ecommerceWordPress": "WordPress для электронной коммерции",

    // --- hosting.highlights ---
    "hosting.highlights.bestWpPerformance": "Лучшая производительность WordPress",
    "hosting.highlights.freeMigrations": "Бесплатный перенос",
    "hosting.highlights.support247": "Поддержка 24/7",
    "hosting.highlights.googleCloud": "Google Cloud Platform",
    "hosting.highlights.fastestWpHost": "Самый быстрый хостинг WordPress",
    "hosting.highlights.dataCenters35": "35+ дата-центров",
    "hosting.highlights.bestNextjs": "Лучший для Next.js",
    "hosting.highlights.edgeFunctions": "Edge-функции",
    "hosting.highlights.instantDeploy": "Мгновенное развёртывание",
    "hosting.highlights.jamstackPioneer": "Пионер JAMstack",
    "hosting.highlights.greatDx": "Отличный опыт разработки",
    "hosting.highlights.builtInCiCd": "Встроенный CI/CD",
    "hosting.highlights.developerFriendly": "Удобен для разработчиков",
    "hosting.highlights.simplePricing": "Простое ценообразование",
    "hosting.highlights.kubernetesSupport": "Поддержка Kubernetes",
    "hosting.highlights.cheapestCloudVps": "Самый дешёвый облачный VPS",
    "hosting.highlights.locations32": "32 локации",
    "hosting.highlights.highPerfNvme": "Высокопроизводительные NVMe",
    "hosting.highlights.bestValueEurope": "Лучшее соотношение цена/качество в Европе",
    "hosting.highlights.carbonNeutral": "Углеродная нейтральность",
    "hosting.highlights.germanDataProtection": "Немецкая защита данных",
    "hosting.highlights.bestDropshipping": "Лучший для дропшиппинга",
    "hosting.highlights.appEcosystem": "Экосистема приложений",
    "hosting.highlights.posIntegration": "Интеграция с POS",
    "hosting.highlights.unlimitedBandwidthFree": "Безлимитная пропускная способность бесплатно",
    "hosting.highlights.fastestEdgeNetwork": "Самая быстрая пограничная сеть",
    "hosting.highlights.workersIntegration": "Интеграция с Workers",
    "hosting.highlights.excellentSupport": "Отличная поддержка",
    "hosting.highlights.freeCdnEmail": "Бесплатные CDN и почта",
    "hosting.highlights.bestBudgetOption": "Лучший бюджетный вариант",
    "hosting.highlights.fastLiteSpeed": "Быстрые серверы LiteSpeed",
    "hosting.highlights.hPanelControl": "Панель управления hPanel",
    "hosting.highlights.chooseYourCloud": "Выберите своё облако",
    "hosting.highlights.payAsYouGo": "Оплата по факту использования",
    "hosting.highlights.noTransactionFees": "Без комиссий за транзакции",
    "hosting.highlights.builtInSeo": "Встроенное SEO",
    "hosting.highlights.multiChannelSelling": "Мультиканальные продажи",
    "hosting.highlights.wooPreInstalled": "WooCommerce предустановлен",
    "hosting.highlights.freeDomain": "Бесплатный домен",
    "hosting.highlights.sslIncluded": "SSL включён",

    // --- hosting.bestFor ---
    "hosting.bestFor.enterprise": "Крупный бизнес",
    "hosting.bestFor.highTraffic": "Сайты с высоким трафиком",
    "hosting.bestFor.staticSites": "Статические сайты",
    "hosting.bestFor.gameServers": "Игровые серверы",
    "hosting.bestFor.europeFocused": "Ориентировано на Европу",
    "hosting.bestFor.ecommerce": "Электронная коммерция",
    "hosting.bestFor.dropshipping": "Дропшиппинг",
    "hosting.bestFor.retail": "Розничная торговля",
    "hosting.bestFor.globalDelivery": "Глобальная доставка",
    "hosting.bestFor.smallBusiness": "Малый бизнес",
    "hosting.bestFor.beginners": "Начинающие",
    "hosting.bestFor.budgetSites": "Бюджетные сайты",
    "hosting.bestFor.agencies": "Агентства",
    "hosting.bestFor.growingStores": "Растущие магазины",
    "hosting.bestFor.smallStores": "Небольшие магазины",
    "hosting.bestFor.wordPressUsers": "Пользователи WordPress",

    // --- hosting.filters ---
    "hosting.filters.all": "Все",

    // --- hosting.charts ---
    "hosting.charts.startingPrice": "Начальная цена ($/мес)",
    "hosting.charts.userRating": "Оценка пользователей",
    "hosting.charts.valueScore": "Оценка ценности",
    "hosting.charts.higherBetterValue": "Выше = Лучшее соотношение цена/качество",

    // --- hosting.pricing ---
    "hosting.pricing.free": "БЕСПЛАТНО",
    "hosting.pricing.mo": "мес",
    "hosting.pricing.startingAt": "От",
    "hosting.pricing.month": "месяц",
    "hosting.pricing.year": "год",

    // --- hosting misc ---
    "hosting.noProvidersMatch": "Ни один провайдер не соответствует этому фильтру. Попробуйте другую категорию.",
    "hosting.badges.topPick": "ЛУЧШИЙ ВЫБОР",
    "hosting.badges.runnerUp": "ВТОРОЕ МЕСТО",
    "hosting.bestForLabel": "Лучший для",
    "hosting.visitProvider": "Посетить {{name}}",
    "hosting.analysisFailedSimple": "Анализ хостинга не удался",

    // --- hosting.filterLabels ---
    "hosting.filterLabels.priority": "Приоритет",
    "hosting.filterLabels.region": "Регион",
    "hosting.filterLabels.ecommerce": "Электронная коммерция",
    "hosting.filterLabels.requiredFeatures": "Необходимые функции",
    "hosting.filterLabels.storage": "Хранилище",
    "hosting.filterLabels.billing": "Тарификация",

    // --- hosting.regions ---
    "hosting.regions.us": "Соединённые Штаты",
    "hosting.regions.eu": "Европа",
    "hosting.regions.uk": "Великобритания",
    "hosting.regions.asia": "Азиатско-Тихоокеанский регион",
    "hosting.regions.au": "Австралия",
    "hosting.regions.latam": "Латинская Америка",
    "hosting.regions.plural": "регионов",
    "hosting.regions.singular": "регион",

    // --- hosting.ecomLevels ---
    "hosting.ecomLevels.basic": "Базовый (<100 товаров)",
    "hosting.ecomLevels.medium": "Средний (100–1 000)",
    "hosting.ecomLevels.large": "Крупный (1 000+)",
    "hosting.ecomLevels.enterprise": "Корпоративный",

    // --- hosting.features ---
    "hosting.features.backups": "Резервные копии",
    "hosting.features.staging": "Staging",
    "hosting.features.email": "Электронная почта",
    "hosting.features.migration": "Миграция",
    "hosting.features.support247": "Поддержка 24/7",
    "hosting.features.uptime99": "99,9%+ времени безотказной работы",

    // --- hosting.billing ---
    "hosting.billing.annual": "Годовой",
    "hosting.billing.monthly": "Ежемесячный",
    "hosting.billing.multiYear": "Многолетний",

    // --- hosting.priorities ---
    "hosting.priorities.speed": "Скорость",
    "hosting.priorities.budget": "Бюджет",
    "hosting.priorities.support": "Поддержка",
    "hosting.priorities.uptime": "Время безотказной работы",
    "hosting.priorities.scalability": "Масштабируемость",
    "hosting.priorities.security": "Безопасность",
    "hosting.priorities.ecommerceReady": "Готов к электронной коммерции",

    // --- hosting analysis results ---
    "hosting.analysisResults": "Результаты анализа хостинга",
    "hosting.appliedFilters": "Применённые фильтры",
    "hosting.estimatedWebsiteTier": "Оценочный уровень сайта",
    "hosting.confidence": "Достоверность",
    "hosting.detectionSignals": "Сигналы обнаружения",
    "hosting.recommendedBudget": "Рекомендуемый бюджет на хостинг",
    "hosting.typicalFor": "Типично для",
    "hosting.trafficAppropriateRecommendations": "Рекомендации с учётом трафика",
    "hosting.unknownCustom": "Неизвестно / Пользовательское",
    "hosting.marketShare": "Доля рынка",
    "hosting.noCmsDetected": "Не удалось обнаружить известную CMS. Этот сайт может использовать собственную платформу или CMS, отсутствующую в нашей базе данных.",
    "hosting.notDetected": "Не обнаружено",
    "hosting.category": "Категория",
    "hosting.detectedVia": "Обнаружено через",
    "hosting.noHostDetected": "Не удалось определить текущего хостинг-провайдера по DNS-записям. Сайт может быть за CDN или использовать пользовательскую инфраструктуру.",
    "hosting.tierMinimum": "минимум уровня",
    "hosting.forHosting": "для хостинга {{name}}",
    "hosting.tierMinimumLabel": "Минимум уровня",
    "hosting.lowestPrice": "Самая низкая цена",
    "hosting.averagePrice": "Средняя цена",
    "hosting.premiumPrice": "Премиум-цена",
    "hosting.budgetOptions": "Бюджетные варианты",
    "hosting.under5mo": "менее $5/мес",
    "hosting.potentialSavings": "Возможности для экономии",
    "hosting.savingsDescription": "На основе вашего текущего хостинга — альтернативы, которые могут сэкономить вам деньги",
    "hosting.currentToNew": "Текущий → Новый",
    "hosting.forPlatform": "для {{name}}",
    "hosting.match": "Совпадение",
    "hosting.uptime": "время безотказной работы",
    "hosting.whyThisProvider": "Почему этот провайдер",
    "hosting.storage": "хранилище",

    // --- hosting.migration ---
    "hosting.migration.easy": "Лёгкая миграция",
    "hosting.migration.moderate": "Средняя миграция",
    "hosting.migration.complex": "Сложная миграция",

    "hosting.matchingProviders": "подходящих провайдеров",

    // --- hosting.table ---
    "hosting.table.provider": "Провайдер",
    "hosting.table.category": "Категория",
    "hosting.table.match": "Совпадение",
    "hosting.table.rating": "Рейтинг",
    "hosting.table.uptime": "Время работы",
    "hosting.table.priceRange": "Диапазон цен",
    "hosting.table.migration": "Миграция",
    "hosting.table.link": "Ссылка",

    // --- hosting.migrationTable ---
    "hosting.migrationTable.easy": "Просто",
    "hosting.migrationTable.medium": "Средне",
    "hosting.migrationTable.hard": "Сложно",

    "hosting.visit": "Посетить",
    "hosting.proTip": "Совет профессионала",
    "hosting.proTipText": "Указанные цены — стартовые при годовой оплате. Ежемесячная оплата обычно на 20–30% дороже. Процент совпадения показывает, насколько хорошо провайдер соответствует вашим требованиям. При выборе хостинга учитывайте потребности в трафике, требования к поддержке и планы масштабирования.",
    "hosting.pdfSubtitle": "Анализ производительности и инфраструктуры хостинга",
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
