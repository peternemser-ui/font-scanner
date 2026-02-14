/**
 * i18n Complete Coverage Sync Script
 * Adds all missing translation keys to all 7 non-English locale files.
 * Run once: node scripts/i18n-complete-coverage.js
 *
 * Strategy: Walk en.json recursively. For each leaf key, check if the locale
 * file has the same key at the same structural position. If not, add it
 * with a translated value (from the translations map) or the English fallback.
 */
const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '..', 'src', 'public', 'i18n');

function readLocale(name) {
  return JSON.parse(fs.readFileSync(path.join(i18nDir, `${name}.json`), 'utf8'));
}

function writeLocale(name, data) {
  fs.writeFileSync(path.join(i18nDir, `${name}.json`), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Recursively sync enObj structure into localeObj.
 * For every leaf in enObj, ensure localeObj has the same key.
 * keyPath tracks the flattened path for translation lookups.
 */
function syncObject(enObj, localeObj, keyPath, translationsMap, locale, stats) {
  for (const key of Object.keys(enObj)) {
    const enVal = enObj[key];
    const fullKey = keyPath ? keyPath + '.' + key : key;

    if (Array.isArray(enVal)) {
      // Arrays are treated as leaf values (e.g., steps arrays)
      if (localeObj[key] === undefined) {
        localeObj[key] = enVal; // Copy English array as fallback
        stats.added++;
      }
    } else if (typeof enVal === 'object' && enVal !== null) {
      // Ensure locale has this as an object too
      if (localeObj[key] === undefined || localeObj[key] === null) {
        localeObj[key] = {};
      } else if (typeof localeObj[key] !== 'object') {
        // locale has a string where en has an object - keep the string, skip nesting
        // This happens with dot-notation keys like "consent" being a string
        // Don't overwrite
      }
      if (typeof localeObj[key] === 'object') {
        syncObject(enVal, localeObj[key], fullKey, translationsMap, locale, stats);
      }
    } else {
      // Leaf value - check if locale has it
      if (localeObj[key] === undefined) {
        // Missing! Add it.
        const translated = translationsMap[fullKey] && translationsMap[fullKey][locale];
        if (translated) {
          localeObj[key] = translated;
        } else {
          // Use English as fallback
          localeObj[key] = enVal;
        }
        stats.added++;
      }
    }
  }
}

// ============================================================
// TRANSLATIONS MAP
// ============================================================

const T = {};

function addT(key, ja, es, fr, de, pt, zh, ru) {
  T[key] = { ja, es, fr, de, pt, zh, ru };
}

// ----- dashboard -----
addT('dashboard.contact.sending', '送信中...', 'Enviando...', 'Envoi en cours...', 'Wird gesendet...', 'Enviando...', '发送中...', 'Отправка...');
addT('dashboard.runningAudit', '監査を実行中...', 'Ejecutando auditoría...', 'Audit en cours...', 'Audit wird ausgeführt...', 'Executando auditoria...', '正在运行审计...', 'Выполняется аудит...');

// ----- auth -----
addT('auth.sending', '送信中...', 'Enviando...', 'Envoi en cours...', 'Wird gesendet...', 'Enviando...', '发送中...', 'Отправка...');
addT('auth.sendResetLink', 'リセットリンクを送信', 'Enviar enlace de restablecimiento', 'Envoyer le lien de réinitialisation', 'Link zum Zurücksetzen senden', 'Enviar link de redefinição', '发送重置链接', 'Отправить ссылку для сброса');
addT('auth.resetting', 'リセット中...', 'Restableciendo...', 'Réinitialisation...', 'Wird zurückgesetzt...', 'Redefinindo...', '重置中...', 'Сброс...');

// ----- reports.common.difficulty -----
addT('reports.common.difficulty.beginner', '初級', 'Principiante', 'Débutant', 'Anfänger', 'Iniciante', '初级', 'Начальный');
addT('reports.common.difficulty.intermediate', '中級', 'Intermedio', 'Intermédiaire', 'Mittel', 'Intermediário', '中级', 'Средний');
addT('reports.common.difficulty.advanced', '上級', 'Avanzado', 'Avancé', 'Fortgeschritten', 'Avançado', '高级', 'Продвинутый');

// ----- reports.fonts -----
addT('reports.fonts.report.recommendationsHeading', '推奨事項', 'Recomendaciones', 'Recommandations', 'Empfehlungen', 'Recomendações', '建议', 'Рекомендации');
addT('reports.fonts.report.recommendationsNoneTitle', '最適化されたタイポグラフィ', 'Tipografía bien optimizada', 'Typographie bien optimisée', 'Gut optimierte Typografie', 'Tipografia bem otimizada', '优化良好的排版', 'Хорошо оптимизированная типографика');
addT('reports.fonts.report.recommendationsNoneBody', 'フォントスタックはベストプラクティスに従っています。最適化の機会を引き続き監視してください。', 'Tu pila de fuentes sigue las mejores prácticas. Continúa monitoreando.', 'Votre pile de polices suit les bonnes pratiques. Continuez à surveiller.', 'Ihr Schriftstapel folgt den Best Practices. Überwachen Sie weiterhin.', 'Sua pilha de fontes segue as melhores práticas. Continue monitorando.', '您的字体栈遵循最佳实践。请继续监控优化机会。', 'Ваш набор шрифтов соответствует лучшим практикам. Продолжайте мониторинг.');

// ----- reports.accessibility.fixTitles -----
addT('reports.accessibility.fixTitles.colorContrast', '複数のカラーコントラストの問題', 'Múltiples problemas de contraste de color', 'Problèmes de contraste de couleur multiples', 'Mehrere Farbkontrastprobleme', 'Múltiplos problemas de contraste de cor', '多个颜色对比度问题', 'Множественные проблемы с цветовым контрастом');
addT('reports.accessibility.fixTitles.focusIndicators', 'フォーカスインジケーターの欠如', 'Indicadores de enfoque faltantes', 'Indicateurs de focus manquants', 'Fehlende Fokusindikatoren', 'Indicadores de foco ausentes', '缺少焦点指示器', 'Отсутствующие индикаторы фокуса');
addT('reports.accessibility.fixTitles.formLabels', 'フォームラベルの欠如', 'Etiquetas de formulario faltantes', 'Étiquettes de formulaire manquantes', 'Fehlende Formular-Labels', 'Rótulos de formulário ausentes', '缺少表单标签', 'Отсутствующие метки форм');
addT('reports.accessibility.fixTitles.headingStructure', '不適切な見出し構造', 'Estructura de encabezados incorrecta', 'Structure de titres incorrecte', 'Fehlerhafte Überschriftenstruktur', 'Estrutura de cabeçalhos inadequada', '标题结构不当', 'Неправильная структура заголовков');
addT('reports.accessibility.fixTitles.ariaLandmarks', 'ARIAランドマークの欠如', 'Puntos de referencia ARIA faltantes', 'Points de repère ARIA manquants', 'Fehlende ARIA-Landmarks', 'Marcos ARIA ausentes', '缺少ARIA地标', 'Отсутствующие ориентиры ARIA');
addT('reports.accessibility.fixTitles.mobileGap', 'モバイルアクセシビリティの格差', 'Brecha de accesibilidad móvil', 'Écart d\'accessibilité mobile', 'Mobile Barrierefreiheitslücke', 'Lacuna de acessibilidade móvel', '移动端无障碍差距', 'Разрыв мобильной доступности');

// ----- reports.accessibility.fixDescriptions -----
addT('reports.accessibility.fixDescriptions.colorContrast', '{{count}}個の要素でカラーコントラストが不十分です。WCAG 2.1の達成基準1.4.3では、通常サイズのテキストには最低4.5:1、大きなテキストには3:1のコントラスト比が必要です。', 'Se encontraron {{count}} elementos con contraste de color insuficiente. WCAG 2.1 Criterio 1.4.3 requiere una relación de contraste mínima de 4.5:1 para texto normal y 3:1 para texto grande.', '{{count}} éléments ont un contraste de couleur insuffisant. Le critère WCAG 2.1 1.4.3 exige un rapport de contraste minimum de 4,5:1 pour le texte normal et 3:1 pour le grand texte.', '{{count}} Elemente mit unzureichendem Farbkontrast gefunden. WCAG 2.1 Erfolgskriterium 1.4.3 erfordert ein Mindestkontrasthältnis von 4,5:1 für normalen Text und 3:1 für großen Text.', 'Encontrados {{count}} elementos com contraste de cor insuficiente. O critério WCAG 2.1 1.4.3 requer uma relação de contraste mínima de 4,5:1 para texto normal e 3:1 para texto grande.', '发现{{count}}个元素的颜色对比度不足。WCAG 2.1成功标准1.4.3要求普通文本的最低对比度为4.5:1，大文本为3:1。', 'Обнаружено {{count}} элементов с недостаточным цветовым контрастом. Критерий WCAG 2.1 1.4.3 требует минимального контраста 4,5:1 для обычного текста и 3:1 для крупного текста.');
addT('reports.accessibility.fixDescriptions.focusIndicators', '{{count}}個のインタラクティブ要素にフォーカスインジケーターがありません。', '{{count}} elementos interactivos carecen de indicadores de enfoque visibles.', '{{count}} éléments interactifs n\'ont pas d\'indicateurs de focus visibles.', '{{count}} interaktive Elemente haben keine sichtbaren Fokusindikatoren.', '{{count}} elementos interativos não possuem indicadores de foco visíveis.', '{{count}}个交互元素缺少可见的焦点指示器。', '{{count}} интерактивных элементов не имеют видимых индикаторов фокуса.');
addT('reports.accessibility.fixDescriptions.formLabels', '{{count}}個のフォーム要素にアクセシブルなラベルがありません。', '{{count}} elementos de formulario no tienen etiquetas accesibles.', '{{count}} éléments de formulaire n\'ont pas d\'étiquettes accessibles.', '{{count}} Formularelemente haben keine zugänglichen Labels.', '{{count}} elementos de formulário não possuem rótulos acessíveis.', '{{count}}个表单元素缺少无障碍标签。', '{{count}} элементов форм не имеют доступных меток.');
addT('reports.accessibility.fixDescriptions.headingStructure', '見出し構造が{{structure}}です。見出しはページコンテンツの階層的なアウトラインを作成します。', 'La estructura de encabezados es {{structure}}. Los encabezados crean un esquema jerárquico del contenido.', 'La structure des titres est {{structure}}. Les titres créent un plan hiérarchique du contenu.', 'Die Überschriftenstruktur ist {{structure}}. Überschriften erstellen eine hierarchische Gliederung.', 'A estrutura de cabeçalhos é {{structure}}. Os cabeçalhos criam um esquema hierárquico do conteúdo.', '标题结构为{{structure}}。标题为页面内容创建层次大纲。', 'Структура заголовков {{structure}}. Заголовки создают иерархическую структуру содержимого.');
addT('reports.accessibility.fixDescriptions.ariaLandmarks', 'このページにセマンティックランドマークが見つかりませんでした。', 'No se encontraron puntos de referencia semánticos en esta página.', 'Aucun point de repère sémantique n\'a été trouvé sur cette page.', 'Auf dieser Seite wurden keine semantischen Landmarken gefunden.', 'Nenhum marco semântico foi encontrado nesta página.', '在此页面上未找到语义地标。', 'На этой странице не найдены семантические ориентиры.');
addT('reports.accessibility.fixDescriptions.mobileGap', 'モバイルのアクセシビリティスコアがデスクトップより{{diff}}ポイント低いです。', 'La puntuación de accesibilidad móvil es {{diff}} puntos inferior a la de escritorio.', 'Le score d\'accessibilité mobile est inférieur de {{diff}} points par rapport au bureau.', 'Der mobile Barrierefreiheitswert ist {{diff}} Punkte niedriger als auf dem Desktop.', 'A pontuação de acessibilidade móvel é {{diff}} pontos inferior à do desktop.', '移动端无障碍评分比桌面端低{{diff}}分。', 'Оценка доступности мобильной версии на {{diff}} баллов ниже десктопной.');

// ----- reports.accessibility.fixImpacts -----
addT('reports.accessibility.fixImpacts.colorContrast', '弱視や色覚異常のユーザーがコンテンツを読みにくい場合があります。', 'Los usuarios con baja visión o daltonismo pueden tener dificultad para leer el contenido.', 'Les utilisateurs malvoyants ou daltoniens peuvent avoir des difficultés à lire le contenu.', 'Benutzer mit Sehschwäche oder Farbenblindheit können Schwierigkeiten beim Lesen haben.', 'Usuários com baixa visão ou daltonismo podem ter dificuldade para ler o conteúdo.', '视力低下或色盲用户可能难以阅读内容。', 'Пользователи с плохим зрением или дальтонизмом могут испытывать трудности при чтении.');
addT('reports.accessibility.fixImpacts.focusIndicators', 'キーボードのみのユーザーはどの要素にフォーカスがあるか確認できません。', 'Los usuarios de solo teclado no pueden ver qué elemento tiene el enfoque.', 'Les utilisateurs au clavier seul ne peuvent pas voir quel élément a le focus.', 'Tastaturnutzer können nicht sehen, welches Element fokussiert ist.', 'Usuários que usam apenas teclado não conseguem ver qual elemento está em foco.', '仅使用键盘的用户无法看到哪个元素获得焦点。', 'Пользователи клавиатуры не могут видеть, какой элемент в фокусе.');
addT('reports.accessibility.fixImpacts.formLabels', 'スクリーンリーダーユーザーがフォーム入力の目的を理解できません。', 'Los usuarios de lectores de pantalla no pueden entender el propósito de los campos.', 'Les utilisateurs de lecteurs d\'écran ne peuvent pas comprendre le but des champs.', 'Screenreader-Benutzer können den Zweck der Formulareingaben nicht verstehen.', 'Usuários de leitores de tela não conseguem entender o propósito dos campos.', '屏幕阅读器用户无法理解表单输入的用途。', 'Пользователи экранных считывателей не могут понять назначение полей формы.');
addT('reports.accessibility.fixImpacts.headingStructure', 'スクリーンリーダーユーザーは見出し構造に依存してページ階層を理解します。', 'Los usuarios de lectores de pantalla dependen de la estructura de encabezados para navegar.', 'Les utilisateurs de lecteurs d\'écran dépendent de la structure des titres pour naviguer.', 'Screenreader-Benutzer sind auf die Überschriftenstruktur angewiesen.', 'Usuários de leitores de tela dependem da estrutura de cabeçalhos para navegar.', '屏幕阅读器用户依赖标题结构来导航和理解页面层次。', 'Пользователи экранных считывателей полагаются на структуру заголовков.');
addT('reports.accessibility.fixImpacts.ariaLandmarks', 'スクリーンリーダーユーザーはページの主要セクションに素早くナビゲートできません。', 'Los usuarios de lectores de pantalla no pueden navegar rápidamente a las secciones principales.', 'Les utilisateurs de lecteurs d\'écran ne peuvent pas naviguer rapidement vers les sections principales.', 'Screenreader-Benutzer können nicht schnell zu den Hauptbereichen navigieren.', 'Usuários de leitores de tela não conseguem navegar rapidamente para as seções principais.', '屏幕阅读器用户无法快速导航到页面的主要部分。', 'Пользователи экранных считывателей не могут быстро перейти к основным разделам.');
addT('reports.accessibility.fixImpacts.mobileGap', '障害のあるモバイルユーザーは劣化した体験をしています。', 'Los usuarios móviles con discapacidades experimentan una experiencia degradada.', 'Les utilisateurs mobiles handicapés subissent une expérience dégradée.', 'Mobile Nutzer mit Behinderungen erleben ein verschlechtertes Erlebnis.', 'Usuários móveis com deficiências experimentam uma experiência inferior.', '有残障的移动用户与桌面用户相比体验较差。', 'Мобильные пользователи с инвалидностью испытывают ухудшенный опыт.');

// ----- reports.accessibility.fixSolutions -----
addT('reports.accessibility.fixSolutions.colorContrast', 'テキストと背景色のコントラストを上げてください。', 'Aumenta el contraste entre el texto y los colores de fondo.', 'Augmentez le contraste entre le texte et les couleurs de fond.', 'Erhöhen Sie den Kontrast zwischen Text- und Hintergrundfarben.', 'Aumente o contraste entre texto e cores de fundo.', '增加文本和背景颜色之间的对比度。', 'Увеличьте контраст между текстом и фоном.');
addT('reports.accessibility.fixSolutions.focusIndicators', 'CSS :focusの擬似クラスを使用してフォーカススタイルを追加してください。', 'Agrega estilos de enfoque visibles usando la pseudo-clase CSS :focus.', 'Ajoutez des styles de focus visibles en utilisant la pseudo-classe CSS :focus.', 'Fügen Sie sichtbare Fokus-Stile mit der CSS-Pseudoklasse :focus hinzu.', 'Adicione estilos de foco visíveis usando a pseudo-classe CSS :focus.', '使用CSS :focus伪类添加可见的焦点样式。', 'Добавьте видимые стили фокуса с помощью CSS-псевдокласса :focus.');
addT('reports.accessibility.fixSolutions.formLabels', 'aria-label属性を追加するか、label要素をフォーム入力に関連付けてください。', 'Agrega atributos aria-label o asocia elementos label con los campos de formulario.', 'Ajoutez des attributs aria-label ou associez des éléments label aux champs de formulaire.', 'Fügen Sie aria-label-Attribute hinzu oder verknüpfen Sie Label-Elemente mit Formulareingaben.', 'Adicione atributos aria-label ou associe elementos label aos campos de formulário.', '添加aria-label属性或使用for/id属性将label元素与表单输入关联。', 'Добавьте атрибуты aria-label или свяжите элементы label с полями формы.');
addT('reports.accessibility.fixSolutions.headingStructure', '見出しが論理的な順序（h1 > h2 > h3）に従うようにしてください。', 'Asegúrate de que los encabezados sigan una secuencia lógica (h1 > h2 > h3).', 'Assurez-vous que les titres suivent une séquence logique (h1 > h2 > h3).', 'Stellen Sie sicher, dass Überschriften einer logischen Reihenfolge folgen (h1 > h2 > h3).', 'Certifique-se de que os cabeçalhos sigam uma sequência lógica (h1 > h2 > h3).', '确保标题遵循逻辑顺序（h1 > h2 > h3），不跳过级别。', 'Убедитесь, что заголовки следуют логической последовательности (h1 > h2 > h3).');
addT('reports.accessibility.fixSolutions.ariaLandmarks', 'セマンティックHTML5要素（header, nav, main, aside, footer）を使用してください。', 'Usa elementos semánticos HTML5 (header, nav, main, aside, footer).', 'Utilisez des éléments sémantiques HTML5 (header, nav, main, aside, footer).', 'Verwenden Sie semantische HTML5-Elemente (header, nav, main, aside, footer).', 'Use elementos semânticos HTML5 (header, nav, main, aside, footer).', '使用语义化HTML5元素（header、nav、main、aside、footer）。', 'Используйте семантические элементы HTML5 (header, nav, main, aside, footer).');
addT('reports.accessibility.fixSolutions.mobileGap', 'タッチターゲットのサイズとビューポートの設定を確認してください。最小44x44ピクセルを確保してください。', 'Revisa los tamaños de los objetivos táctiles y la configuración del viewport. Mínimo 44x44 píxeles.', 'Vérifiez les tailles des cibles tactiles et la configuration du viewport. Minimum 44x44 pixels.', 'Überprüfen Sie Touch-Zielgrößen und Viewport-Konfiguration. Minimum 44x44 Pixel.', 'Revise os tamanhos dos alvos de toque e a configuração do viewport. Mínimo 44x44 pixels.', '检查触摸目标大小和视口配置。确保最小尺寸为44x44像素。', 'Проверьте размеры областей касания и конфигурацию viewport. Минимум 44x44 пикселя.');

// ============================================================
// MAIN: Apply translations to all locale files
// ============================================================

console.log('Starting i18n complete coverage sync...\n');

const en = readLocale('en');
const locales = ['ja', 'es', 'fr', 'de', 'pt', 'zh', 'ru'];

for (const locale of locales) {
  const localeData = readLocale(locale);
  const stats = { added: 0 };

  syncObject(en, localeData, '', T, locale, stats);

  writeLocale(locale, localeData);
  console.log(`  ${locale}.json: +${stats.added} keys added`);
}

console.log('\nDone! All locale files updated.');
