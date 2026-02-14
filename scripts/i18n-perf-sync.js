#!/usr/bin/env node
/**
 * i18n-perf-sync.js
 * Adds missing reports.performance keys to all non-English locale files.
 * Run: node scripts/i18n-perf-sync.js
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'public', 'i18n');

// New quick-scan keys that need to be added to reports.performance
const newQuickScanKeys = {
  zh: {
    quickScore: '快速评分',
    scoreUnavailable: '评分不可用',
    scoreUnavailableDesc: '此次扫描无法计算评分，但以下指标和问题仍可参考。',
    externalInlineCount: '{{external}} 个外部, {{inline}} 个内联',
    estimatedSize: '估计大小: {{size}}',
    asyncDeferCount: '异步: {{async}} | 延迟: {{defer}}',
    imageCount: '{{count}} 张图片',
    missingAltLazy: '缺少alt: {{alt}} | 懒加载: {{lazy}}',
    resourceCount: '{{count}} 个资源',
    preloadedCount: '{{count}} 个预加载',
    missingFontDisplayCount: '缺少 font-display: {{count}}',
    noMajorIssuesDesc: '您的页面资源已经过良好优化。',
    causeImageBloat: '图片过大',
    causeHeavyJavascript: 'JavaScript过重',
    causeThirdPartyScripts: '第三方脚本过多',
  },
  de: {
    quickScore: 'Schnellbewertung',
    scoreUnavailable: 'Bewertung nicht verfügbar',
    scoreUnavailableDesc: 'Für diesen Scan konnte keine Bewertung berechnet werden, aber die Metriken und Probleme unten sind dennoch verwertbar.',
    externalInlineCount: '{{external}} extern, {{inline}} inline',
    estimatedSize: 'Geschätzt: {{size}}',
    asyncDeferCount: 'Async: {{async}} | Defer: {{defer}}',
    imageCount: '{{count}} Bilder',
    missingAltLazy: 'Fehlendes Alt: {{alt}} | Lazy: {{lazy}}',
    resourceCount: '{{count}} Ressourcen',
    preloadedCount: '{{count}} vorgeladen',
    missingFontDisplayCount: 'Fehlendes font-display: {{count}}',
    noMajorIssuesDesc: 'Ihre Seitenressourcen sind gut optimiert.',
    causeImageBloat: 'Bildüberladung',
    causeHeavyJavascript: 'Schweres JavaScript',
    causeThirdPartyScripts: 'Drittanbieter-Skripte',
  },
  es: {
    quickScore: 'Puntuación rápida',
    scoreUnavailable: 'Puntuación no disponible',
    scoreUnavailableDesc: 'No pudimos calcular una puntuación para este escaneo, pero las métricas y problemas a continuación siguen siendo útiles.',
    externalInlineCount: '{{external}} externos, {{inline}} en línea',
    estimatedSize: 'Estimado: {{size}}',
    asyncDeferCount: 'Async: {{async}} | Defer: {{defer}}',
    imageCount: '{{count}} imágenes',
    missingAltLazy: 'Sin alt: {{alt}} | Lazy: {{lazy}}',
    resourceCount: '{{count}} recursos',
    preloadedCount: '{{count}} precargados',
    missingFontDisplayCount: 'Sin font-display: {{count}}',
    noMajorIssuesDesc: 'Los recursos de su página están bien optimizados.',
    causeImageBloat: 'Exceso de imágenes',
    causeHeavyJavascript: 'JavaScript pesado',
    causeThirdPartyScripts: 'Scripts de terceros',
  },
  fr: {
    quickScore: 'Score rapide',
    scoreUnavailable: 'Score indisponible',
    scoreUnavailableDesc: "Nous n'avons pas pu calculer un score pour cette analyse, mais les métriques et problèmes ci-dessous restent exploitables.",
    externalInlineCount: '{{external}} externes, {{inline}} en ligne',
    estimatedSize: 'Estimé : {{size}}',
    asyncDeferCount: 'Async : {{async}} | Defer : {{defer}}',
    imageCount: '{{count}} images',
    missingAltLazy: 'Alt manquant : {{alt}} | Lazy : {{lazy}}',
    resourceCount: '{{count}} ressources',
    preloadedCount: '{{count}} préchargées',
    missingFontDisplayCount: 'Font-display manquant : {{count}}',
    noMajorIssuesDesc: 'Les ressources de votre page sont bien optimisées.',
    causeImageBloat: "Surcharge d'images",
    causeHeavyJavascript: 'JavaScript lourd',
    causeThirdPartyScripts: 'Scripts tiers',
  },
  ja: {
    quickScore: 'クイックスコア',
    scoreUnavailable: 'スコア利用不可',
    scoreUnavailableDesc: 'このスキャンではスコアを算出できませんでしたが、以下のメトリクスと問題は引き続き有効です。',
    externalInlineCount: '{{external}} 外部, {{inline}} インライン',
    estimatedSize: '推定: {{size}}',
    asyncDeferCount: 'Async: {{async}} | Defer: {{defer}}',
    imageCount: '{{count}} 画像',
    missingAltLazy: 'alt欠落: {{alt}} | 遅延読込: {{lazy}}',
    resourceCount: '{{count}} リソース',
    preloadedCount: '{{count}} プリロード済み',
    missingFontDisplayCount: 'font-display欠落: {{count}}',
    noMajorIssuesDesc: 'ページリソースは適切に最適化されています。',
    causeImageBloat: '画像の肥大化',
    causeHeavyJavascript: '重いJavaScript',
    causeThirdPartyScripts: 'サードパーティスクリプト',
  },
  pt: {
    quickScore: 'Pontuação rápida',
    scoreUnavailable: 'Pontuação indisponível',
    scoreUnavailableDesc: 'Não foi possível calcular uma pontuação para esta análise, mas as métricas e problemas abaixo ainda são acionáveis.',
    externalInlineCount: '{{external}} externos, {{inline}} inline',
    estimatedSize: 'Estimado: {{size}}',
    asyncDeferCount: 'Async: {{async}} | Defer: {{defer}}',
    imageCount: '{{count}} imagens',
    missingAltLazy: 'Sem alt: {{alt}} | Lazy: {{lazy}}',
    resourceCount: '{{count}} recursos',
    preloadedCount: '{{count}} pré-carregados',
    missingFontDisplayCount: 'Sem font-display: {{count}}',
    noMajorIssuesDesc: 'Os recursos da sua página estão bem otimizados.',
    causeImageBloat: 'Excesso de imagens',
    causeHeavyJavascript: 'JavaScript pesado',
    causeThirdPartyScripts: 'Scripts de terceiros',
  },
  ru: {
    quickScore: 'Быстрая оценка',
    scoreUnavailable: 'Оценка недоступна',
    scoreUnavailableDesc: 'Не удалось вычислить оценку для этого сканирования, но метрики и проблемы ниже по-прежнему актуальны.',
    externalInlineCount: '{{external}} внешних, {{inline}} встроенных',
    estimatedSize: 'Приблизительно: {{size}}',
    asyncDeferCount: 'Async: {{async}} | Defer: {{defer}}',
    imageCount: '{{count}} изображений',
    missingAltLazy: 'Без alt: {{alt}} | Lazy: {{lazy}}',
    resourceCount: '{{count}} ресурсов',
    preloadedCount: '{{count}} предзагруженных',
    missingFontDisplayCount: 'Без font-display: {{count}}',
    noMajorIssuesDesc: 'Ресурсы вашей страницы хорошо оптимизированы.',
    causeImageBloat: 'Раздутые изображения',
    causeHeavyJavascript: 'Тяжёлый JavaScript',
    causeThirdPartyScripts: 'Сторонние скрипты',
  },
};

// Translated report sub-section keys (replacing English in non-English files)
const reportSubSection = {
  zh: {
    sectionIntros: {
      cwv: '核心Web指标是Google衡量真实用户体验的关键指标。它们评估加载速度（LCP）、交互性（INP/FID）和视觉稳定性（CLS）。这些指标通过Google的页面体验信号直接影响搜索排名。本节展示桌面端和移动端的核心Web指标评分，评级基于Google发布的阈值。',
      lighthouse: 'Google Lighthouse在四个类别中提供自动化审计：性能、可访问性、最佳实践和SEO。分数由数十个按影响加权的独立审计计算得出。本节展示桌面端和移动端的Lighthouse分数。90+为良好，50-89需要改进，50以下为较差。',
      resources: '资源分析检查页面加载的所有资产，包括JavaScript、CSS、图片和字体。过多的资源会增加加载时间和带宽消耗。本节按类型分解资源数量和大小，帮助识别优化机会。',
      network: '网络性能衡量浏览器与服务器之间的通信速度。首字节时间（TTFB）是服务器响应速度的关键指标。本节分析连接时序、DNS解析、SSL协商和DOM处理里程碑。',
      caching: '有效的缓存减少服务器负载，显著改善回访用户的页面加载时间。浏览器缓存将资产存储在本地，避免后续访问时重新下载。本节评估缓存命中率、缓存控制指令和可缓存资源比例。',
      recommendations: '基于性能分析，本节提供可操作的建议以改善网站速度和用户体验。每项建议包括受影响的指标、当前问题和建议的解决方案。',
    },
    lighthouse: {
      title: 'Lighthouse 类别评分',
      bestPractices: '最佳实践',
    },
    resources: {
      breakdownHeading: '资源分解',
      table: { type: '类型', count: '文件', size: '大小' },
    },
    network: {
      title: '网络性能',
      ttfb: '首字节时间',
      dns: 'DNS查询',
      ssl: 'SSL协商',
      connection: '连接时间',
      domInteractive: 'DOM可交互',
      domContentLoaded: 'DOM内容加载',
    },
    caching: {
      title: '缓存与优化',
      hitRateLabel: '缓存命中率',
      cachedLabel: '已缓存资源',
      notCachedLabel: '未缓存',
    },
    recommendations: '建议',
    'recommendations.noneTitle': '性能优秀',
    'recommendations.noneBody': '您的网站在所有指标上表现良好。继续监控以防退步。',
  },
  de: {
    sectionIntros: {
      cwv: 'Core Web Vitals sind Googles Schlüsselmetriken zur Messung der realen Nutzererfahrung. Sie bewerten Ladegeschwindigkeit (LCP), Interaktivität (INP/FID) und visuelle Stabilität (CLS). Diese Metriken beeinflussen direkt das Suchranking über Googles Page-Experience-Signale.',
      lighthouse: 'Google Lighthouse bietet automatisierte Audits in vier Kategorien: Performance, Barrierefreiheit, Best Practices und SEO. Die Bewertungen werden aus Dutzenden einzelner Audits berechnet, die nach Auswirkung gewichtet werden.',
      resources: 'Die Ressourcenanalyse untersucht alle von Ihrer Seite geladenen Assets, einschließlich JavaScript, CSS, Bilder und Schriften. Übermäßige Ressourcen erhöhen Ladezeiten und Bandbreitenverbrauch.',
      network: 'Die Netzwerkperformance misst die Geschwindigkeit der Kommunikation zwischen Browser und Server. Time To First Byte (TTFB) ist ein kritischer Indikator für die Serverreaktionsfähigkeit.',
      caching: 'Effektives Caching reduziert die Serverlast und verbessert die Seitenladezeiten für wiederkehrende Besucher erheblich. Browser-Caching speichert Assets lokal, sodass sie bei nachfolgenden Besuchen nicht erneut heruntergeladen werden müssen.',
      recommendations: 'Basierend auf der Performanceanalyse bietet dieser Abschnitt umsetzbare Empfehlungen zur Verbesserung der Geschwindigkeit und Nutzererfahrung Ihrer Website.',
    },
    lighthouse: {
      title: 'Lighthouse-Kategoriebewertungen',
      bestPractices: 'Best Practices',
    },
    resources: {
      breakdownHeading: 'Ressourcenaufschlüsselung',
      table: { type: 'Typ', count: 'Dateien', size: 'Größe' },
    },
    network: {
      title: 'Netzwerkperformance',
      ttfb: 'Time To First Byte',
      dns: 'DNS-Auflösung',
      ssl: 'SSL-Verhandlung',
      connection: 'Verbindungszeit',
      domInteractive: 'DOM Interaktiv',
      domContentLoaded: 'DOM Inhalt Geladen',
    },
    caching: {
      title: 'Caching & Optimierung',
      hitRateLabel: 'Cache-Trefferquote',
      cachedLabel: 'Gecachte Ressourcen',
      notCachedLabel: 'Nicht gecacht',
    },
    recommendations: 'Empfehlungen',
    'recommendations.noneTitle': 'Ausgezeichnete Performance',
    'recommendations.noneBody': 'Ihre Website funktioniert in allen Metriken gut. Überwachen Sie weiterhin auf Regressionen.',
  },
  es: {
    sectionIntros: {
      cwv: 'Los Core Web Vitals son las métricas clave de Google para medir la experiencia real del usuario. Evalúan la velocidad de carga (LCP), la interactividad (INP/FID) y la estabilidad visual (CLS). Estas métricas influyen directamente en el ranking de búsqueda.',
      lighthouse: 'Google Lighthouse proporciona auditorías automatizadas en cuatro categorías: Rendimiento, Accesibilidad, Mejores Prácticas y SEO. Las puntuaciones se calculan a partir de docenas de auditorías individuales ponderadas por impacto.',
      resources: 'El análisis de recursos examina todos los activos cargados por su página, incluyendo JavaScript, CSS, imágenes y fuentes. Los recursos excesivos aumentan los tiempos de carga y el consumo de ancho de banda.',
      network: 'El rendimiento de red mide la velocidad de comunicación entre el navegador y su servidor. El Time To First Byte (TTFB) es un indicador crítico de la capacidad de respuesta del servidor.',
      caching: 'El almacenamiento en caché efectivo reduce la carga del servidor y mejora dramáticamente los tiempos de carga para visitantes recurrentes.',
      recommendations: 'Basado en el análisis de rendimiento, esta sección proporciona recomendaciones prácticas para mejorar la velocidad y experiencia del usuario de su sitio.',
    },
    lighthouse: {
      title: 'Puntuaciones por categoría de Lighthouse',
      bestPractices: 'Mejores Prácticas',
    },
    resources: {
      breakdownHeading: 'Desglose de recursos',
      table: { type: 'Tipo', count: 'Archivos', size: 'Tamaño' },
    },
    network: {
      title: 'Rendimiento de red',
      ttfb: 'Time To First Byte',
      dns: 'Consulta DNS',
      ssl: 'Negociación SSL',
      connection: 'Tiempo de conexión',
      domInteractive: 'DOM Interactivo',
      domContentLoaded: 'DOM Contenido Cargado',
    },
    caching: {
      title: 'Caché y optimización',
      hitRateLabel: 'Tasa de aciertos de caché',
      cachedLabel: 'Recursos en caché',
      notCachedLabel: 'Sin caché',
    },
    recommendations: 'Recomendaciones',
    'recommendations.noneTitle': 'Rendimiento excelente',
    'recommendations.noneBody': 'Su sitio funciona bien en todas las métricas. Continúe monitoreando para detectar regresiones.',
  },
  fr: {
    sectionIntros: {
      cwv: "Les Core Web Vitals sont les métriques clés de Google pour mesurer l'expérience utilisateur réelle. Ils évaluent la vitesse de chargement (LCP), l'interactivité (INP/FID) et la stabilité visuelle (CLS). Ces métriques influencent directement le classement dans les résultats de recherche.",
      lighthouse: "Google Lighthouse fournit des audits automatisés dans quatre catégories : Performance, Accessibilité, Bonnes Pratiques et SEO. Les scores sont calculés à partir de dizaines d'audits individuels pondérés par impact.",
      resources: "L'analyse des ressources examine tous les actifs chargés par votre page, y compris JavaScript, CSS, images et polices. Des ressources excessives augmentent les temps de chargement et la consommation de bande passante.",
      network: "La performance réseau mesure la vitesse de communication entre le navigateur et votre serveur. Le Time To First Byte (TTFB) est un indicateur critique de la réactivité du serveur.",
      caching: "Un cache efficace réduit la charge serveur et améliore considérablement les temps de chargement pour les visiteurs récurrents.",
      recommendations: "Sur la base de l'analyse de performance, cette section fournit des recommandations concrètes pour améliorer la vitesse et l'expérience utilisateur de votre site.",
    },
    lighthouse: {
      title: 'Scores par catégorie Lighthouse',
      bestPractices: 'Bonnes Pratiques',
    },
    resources: {
      breakdownHeading: 'Répartition des ressources',
      table: { type: 'Type', count: 'Fichiers', size: 'Taille' },
    },
    network: {
      title: 'Performance réseau',
      ttfb: 'Time To First Byte',
      dns: 'Résolution DNS',
      ssl: 'Négociation SSL',
      connection: 'Temps de connexion',
      domInteractive: 'DOM Interactif',
      domContentLoaded: 'DOM Contenu Chargé',
    },
    caching: {
      title: 'Cache et optimisation',
      hitRateLabel: 'Taux de cache',
      cachedLabel: 'Ressources en cache',
      notCachedLabel: 'Non mis en cache',
    },
    recommendations: 'Recommandations',
    'recommendations.noneTitle': 'Performance excellente',
    'recommendations.noneBody': 'Votre site fonctionne bien sur toutes les métriques. Continuez à surveiller les régressions.',
  },
  ja: {
    sectionIntros: {
      cwv: 'Core Web Vitalsは、実際のユーザー体験を測定するためのGoogleの主要指標です。読み込み速度（LCP）、インタラクティブ性（INP/FID）、視覚的安定性（CLS）を評価します。これらの指標は検索ランキングに直接影響します。',
      lighthouse: 'Google Lighthouseは、パフォーマンス、アクセシビリティ、ベストプラクティス、SEOの4カテゴリーで自動監査を提供します。スコアは影響度で重み付けされた数十の個別監査から算出されます。',
      resources: 'リソース分析では、JavaScript、CSS、画像、フォントを含むページが読み込むすべてのアセットを調査します。過剰なリソースは読み込み時間と帯域幅の消費を増加させます。',
      network: 'ネットワークパフォーマンスは、ブラウザとサーバー間の通信速度を測定します。Time To First Byte（TTFB）はサーバーの応答性の重要な指標です。',
      caching: '効果的なキャッシュはサーバー負荷を軽減し、リピーターのページ読み込み時間を大幅に改善します。',
      recommendations: 'パフォーマンス分析に基づき、サイトの速度とユーザー体験を改善するための実用的な推奨事項を提供します。',
    },
    lighthouse: {
      title: 'Lighthouseカテゴリースコア',
      bestPractices: 'ベストプラクティス',
    },
    resources: {
      breakdownHeading: 'リソース内訳',
      table: { type: 'タイプ', count: 'ファイル', size: 'サイズ' },
    },
    network: {
      title: 'ネットワークパフォーマンス',
      ttfb: 'Time To First Byte',
      dns: 'DNS検索',
      ssl: 'SSLネゴシエーション',
      connection: '接続時間',
      domInteractive: 'DOM Interactive',
      domContentLoaded: 'DOM Content Loaded',
    },
    caching: {
      title: 'キャッシュと最適化',
      hitRateLabel: 'キャッシュヒット率',
      cachedLabel: 'キャッシュ済みリソース',
      notCachedLabel: '未キャッシュ',
    },
    recommendations: '推奨事項',
    'recommendations.noneTitle': '優秀なパフォーマンス',
    'recommendations.noneBody': 'すべての指標で良好なパフォーマンスです。引き続き監視を続けてください。',
  },
  pt: {
    sectionIntros: {
      cwv: 'Os Core Web Vitals são as métricas-chave do Google para medir a experiência real do utilizador. Avaliam a velocidade de carregamento (LCP), interatividade (INP/FID) e estabilidade visual (CLS). Estas métricas influenciam diretamente o ranking de pesquisa.',
      lighthouse: 'O Google Lighthouse fornece auditorias automatizadas em quatro categorias: Desempenho, Acessibilidade, Melhores Práticas e SEO. As pontuações são calculadas a partir de dezenas de auditorias individuais ponderadas por impacto.',
      resources: 'A análise de recursos examina todos os ativos carregados pela sua página, incluindo JavaScript, CSS, imagens e fontes. Recursos excessivos aumentam os tempos de carregamento e o consumo de largura de banda.',
      network: 'O desempenho de rede mede a velocidade de comunicação entre o navegador e o seu servidor. O Time To First Byte (TTFB) é um indicador crítico da capacidade de resposta do servidor.',
      caching: 'O cache eficaz reduz a carga do servidor e melhora dramaticamente os tempos de carregamento para visitantes recorrentes.',
      recommendations: 'Com base na análise de desempenho, esta secção fornece recomendações práticas para melhorar a velocidade e experiência do utilizador do seu site.',
    },
    lighthouse: {
      title: 'Pontuações por categoria Lighthouse',
      bestPractices: 'Melhores Práticas',
    },
    resources: {
      breakdownHeading: 'Distribuição de recursos',
      table: { type: 'Tipo', count: 'Ficheiros', size: 'Tamanho' },
    },
    network: {
      title: 'Desempenho de rede',
      ttfb: 'Time To First Byte',
      dns: 'Consulta DNS',
      ssl: 'Negociação SSL',
      connection: 'Tempo de conexão',
      domInteractive: 'DOM Interativo',
      domContentLoaded: 'DOM Conteúdo Carregado',
    },
    caching: {
      title: 'Cache e otimização',
      hitRateLabel: 'Taxa de acerto de cache',
      cachedLabel: 'Recursos em cache',
      notCachedLabel: 'Não armazenado em cache',
    },
    recommendations: 'Recomendações',
    'recommendations.noneTitle': 'Desempenho excelente',
    'recommendations.noneBody': 'O seu site tem bom desempenho em todas as métricas. Continue a monitorizar para detetar regressões.',
  },
  ru: {
    sectionIntros: {
      cwv: 'Core Web Vitals — ключевые метрики Google для измерения реального пользовательского опыта. Они оценивают скорость загрузки (LCP), интерактивность (INP/FID) и визуальную стабильность (CLS). Эти метрики напрямую влияют на поисковый рейтинг.',
      lighthouse: 'Google Lighthouse обеспечивает автоматизированный аудит в четырёх категориях: Производительность, Доступность, Лучшие практики и SEO. Оценки рассчитываются на основе десятков отдельных аудитов, взвешенных по влиянию.',
      resources: 'Анализ ресурсов исследует все ассеты, загружаемые вашей страницей, включая JavaScript, CSS, изображения и шрифты. Избыточные ресурсы увеличивают время загрузки и потребление трафика.',
      network: 'Производительность сети измеряет скорость связи между браузером и вашим сервером. Time To First Byte (TTFB) — критический показатель отзывчивости сервера.',
      caching: 'Эффективное кэширование снижает нагрузку на сервер и значительно улучшает время загрузки страниц для повторных посетителей.',
      recommendations: 'На основе анализа производительности этот раздел предоставляет практические рекомендации по улучшению скорости и пользовательского опыта вашего сайта.',
    },
    lighthouse: {
      title: 'Оценки по категориям Lighthouse',
      bestPractices: 'Лучшие практики',
    },
    resources: {
      breakdownHeading: 'Распределение ресурсов',
      table: { type: 'Тип', count: 'Файлы', size: 'Размер' },
    },
    network: {
      title: 'Производительность сети',
      ttfb: 'Time To First Byte',
      dns: 'DNS-запрос',
      ssl: 'SSL-согласование',
      connection: 'Время соединения',
      domInteractive: 'DOM Интерактивен',
      domContentLoaded: 'DOM Контент Загружен',
    },
    caching: {
      title: 'Кэширование и оптимизация',
      hitRateLabel: 'Коэффициент попадания в кэш',
      cachedLabel: 'Кэшированные ресурсы',
      notCachedLabel: 'Не кэшировано',
    },
    recommendations: 'Рекомендации',
    'recommendations.noneTitle': 'Отличная производительность',
    'recommendations.noneBody': 'Ваш сайт хорошо работает по всем метрикам. Продолжайте мониторинг для обнаружения регрессий.',
  },
};

const locales = ['zh', 'de', 'es', 'fr', 'ja', 'pt', 'ru'];

function deepGet(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function deepSet(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function processLocale(locale) {
  const filePath = path.join(I18N_DIR, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Find the reports.performance section
  const perfSection = deepGet(data, 'reports.performance');
  if (!perfSection) {
    console.log(`  [WARN] reports.performance not found in ${locale}.json - skipping`);
    return;
  }

  let addedCount = 0;

  // 1. Add new quick-scan keys
  const quickKeys = newQuickScanKeys[locale];
  if (quickKeys) {
    for (const [key, value] of Object.entries(quickKeys)) {
      if (perfSection[key] === undefined) {
        perfSection[key] = value;
        addedCount++;
      }
    }
  }

  // 2. Replace English strings in report sub-section
  const reportTranslations = reportSubSection[locale];
  if (reportTranslations && perfSection.report) {
    for (const [key, value] of Object.entries(reportTranslations)) {
      if (typeof value === 'object' && value !== null) {
        if (!perfSection.report[key] || typeof perfSection.report[key] !== 'object') {
          perfSection.report[key] = {};
        }
        // Deep merge
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === 'object' && subValue !== null) {
            if (!perfSection.report[key][subKey] || typeof perfSection.report[key][subKey] !== 'object') {
              perfSection.report[key][subKey] = {};
            }
            for (const [subSubKey, subSubValue] of Object.entries(subValue)) {
              perfSection.report[key][subKey][subSubKey] = subSubValue;
              addedCount++;
            }
          } else {
            perfSection.report[key][subKey] = subValue;
            addedCount++;
          }
        }
      } else {
        perfSection.report[key] = value;
        addedCount++;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  [OK] ${locale}.json — ${addedCount} keys added/updated`);
}

console.log('i18n Performance Report Sync');
console.log('============================\n');

for (const locale of locales) {
  console.log(`Processing ${locale}...`);
  try {
    processLocale(locale);
  } catch (err) {
    console.error(`  [ERR] ${locale}: ${err.message}`);
  }
}

console.log('\nDone!');
