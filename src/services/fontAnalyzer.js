const { createLogger } = require('../utils/logger');

const logger = createLogger('FontAnalyzer');

class FontAnalyzer {
  async analyzeFonts(page) {
    logger.info('Analyzing fonts');

    const fontData = await page.evaluate(() => {
      const fonts = new Set();
      const fontFaces = new Map();
      const fontSources = new Set();
      const fontMetrics = [];

      // Get computed styles for all elements
      const allElements = document.querySelectorAll('*');

      allElements.forEach((element) => {
        const styles = window.getComputedStyle(element);
        const fontFamily = styles.fontFamily;
        const fontSize = styles.fontSize;
        const fontWeight = styles.fontWeight;
        const fontStyle = styles.fontStyle;
        const fontDisplay = styles.fontDisplay;
        const lineHeight = styles.lineHeight;

        if (fontFamily && fontFamily !== 'initial') {
          fonts.add(fontFamily);

          // Store detailed font metrics
          if (element.textContent && element.textContent.trim()) {
            fontMetrics.push({
              fontFamily: fontFamily,
              fontSize: fontSize,
              fontWeight: fontWeight,
              fontStyle: fontStyle,
              fontDisplay: fontDisplay,
              lineHeight: lineHeight,
              element: element.tagName.toLowerCase(),
              textContent: element.textContent.trim().substring(0, 100),
            });
          }
        }
      });

      // Analyze CSS font-face rules
      try {
        const styleSheets = Array.from(document.styleSheets);
        styleSheets.forEach((sheet) => {
          try {
            const rules = Array.from(sheet.cssRules || sheet.rules || []);
            rules.forEach((rule) => {
              if (rule.type === CSSRule.FONT_FACE_RULE) {
                const fontFace = {
                  fontFamily: rule.style.fontFamily?.replace(/['"]/g, '') || 'unknown',
                  fontWeight: rule.style.fontWeight || 'normal',
                  fontStyle: rule.style.fontStyle || 'normal',
                  fontDisplay: rule.style.fontDisplay || 'auto',
                  src: rule.style.src || '',
                  unicodeRange: rule.style.unicodeRange || '',
                };

                fontFaces.set(fontFace.fontFamily, fontFace);

                // Extract font sources from src property
                if (fontFace.src) {
                  const srcMatches = fontFace.src.match(/url\(['"]?([^'"]+)['"]?\)/g);
                  if (srcMatches) {
                    srcMatches.forEach((match) => {
                      const url = match.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
                      if (url) {
                        fontSources.add(url);
                      }
                    });
                  }
                }
              }
            });
          } catch (e) {
            // Cross-origin stylesheet access might fail
            console.warn('Could not access stylesheet rules:', e.message);
          }
        });
      } catch (e) {
        console.warn('Error analyzing stylesheets:', e.message);
      }

      // Check for Google Fonts and other web font services
      const linkElements = document.querySelectorAll('link[href*="fonts"]');
      linkElements.forEach((link) => {
        fontSources.add(link.href);
      });

      return {
        fonts: Array.from(fonts),
        fontFaces: Array.from(fontFaces.values()),
        fontSources: Array.from(fontSources),
        fontMetrics: fontMetrics.slice(0, 100), // Limit to prevent large payloads
      };
    });

    // Analyze font loading performance
    const fontLoadingData = await this.analyzeFontLoading(page);

    // Categorize fonts
    const categorizedFonts = this.categorizeFonts(fontData.fonts);

    return {
      totalFonts: fontData.fonts.length,
      fonts: fontData.fonts,
      fontFaces: fontData.fontFaces,
      fontSources: fontData.fontSources,
      fontMetrics: fontData.fontMetrics,
      categorizedFonts: categorizedFonts,
      fontLoading: fontLoadingData,
    };
  }

  async analyzeFontLoading(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const fontLoadPromises = [];
        const fontLoadResults = [];

        // Check if document.fonts API is available
        if ('fonts' in document) {
          // Monitor font loading
          document.fonts.forEach((font) => {
            const startTime = performance.now();

            fontLoadPromises.push(
              font
                .load()
                .then(() => {
                  const endTime = performance.now();
                  fontLoadResults.push({
                    family: font.family,
                    style: font.style,
                    weight: font.weight,
                    status: 'loaded',
                    loadTime: endTime - startTime,
                  });
                })
                .catch((error) => {
                  fontLoadResults.push({
                    family: font.family,
                    style: font.style,
                    weight: font.weight,
                    status: 'failed',
                    error: error.message,
                  });
                })
            );
          });

          Promise.all(fontLoadPromises).then(() => {
            resolve({
              supported: true,
              fonts: fontLoadResults,
              totalLoadTime: fontLoadResults.reduce((total, font) => {
                return total + (font.loadTime || 0);
              }, 0),
            });
          });

          // Timeout after 5 seconds
          setTimeout(() => {
            resolve({
              supported: true,
              fonts: fontLoadResults,
              totalLoadTime: fontLoadResults.reduce((total, font) => {
                return total + (font.loadTime || 0);
              }, 0),
              timeout: true,
            });
          }, 5000);
        } else {
          resolve({
            supported: false,
            message: 'Font Loading API not supported',
          });
        }
      });
    });
  }

  categorizeFonts(fonts) {
    const categories = {
      system: [],
      webFonts: [],
      googleFonts: [],
      iconFonts: [],
      customFonts: [],
    };

    const systemFonts = [
      'Arial',
      'Helvetica',
      'Times',
      'Times New Roman',
      'Courier',
      'Courier New',
      'Verdana',
      'Georgia',
      'Palatino',
      'Garamond',
      'Bookman',
      'Trebuchet MS',
      'Arial Black',
      'Impact',
      'Comic Sans MS',
      'Tahoma',
      'Lucida Console',
      'Monaco',
      'sans-serif',
      'serif',
      'monospace',
      'cursive',
      'fantasy',
    ];

    fonts.forEach((font) => {
      const cleanFont = font.replace(/['"]/g, '').trim();

      if (this.isIconFont(cleanFont)) {
        categories.iconFonts.push(cleanFont);
      } else if (systemFonts.some((sysFont) => cleanFont.toLowerCase().includes(sysFont.toLowerCase()))) {
        categories.system.push(cleanFont);
      } else if (cleanFont.toLowerCase().includes('google') || this.isGoogleFont(cleanFont)) {
        categories.googleFonts.push(cleanFont);
      } else if (this.isWebFont(cleanFont)) {
        categories.webFonts.push(cleanFont);
      } else {
        categories.customFonts.push(cleanFont);
      }
    });

    return categories;
  }

  isGoogleFont(fontName) {
    // Common Google Fonts (subset)
    const googleFonts = [
      'Open Sans',
      'Roboto',
      'Lato',
      'Montserrat',
      'Source Sans Pro',
      'Raleway',
      'Poppins',
      'Oswald',
      'Nunito',
      'Ubuntu',
    ];

    return googleFonts.some((gFont) => fontName.toLowerCase().includes(gFont.toLowerCase()));
  }

  isWebFont(fontName) {
    // Check for common web font indicators
    return (
      fontName.includes('@') ||
      fontName.includes('woff') ||
      fontName.includes('ttf') ||
      fontName.includes('eot')
    );
  }

  isIconFont(fontName) {
    // Common icon font names and patterns
    const iconFontPatterns = [
      'fontawesome',
      'font-awesome',
      'fa-',
      'glyphicon',
      'material-icons',
      'material icons',
      'icomoon',
      'foundation-icons',
      'ionicons',
      'feather',
      'lucide',
      'heroicons',
      'phosphor',
      'tabler-icons',
      'bootstrap-icons',
      'remixicon',
      'iconify',
      'flaticon',
      'linearicons',
      'stroke-7',
      'simple-line-icons',
      'themify',
      'et-line',
      'pe-7s',
      'dashicons',
      'genericons'
    ];

    const lowerFontName = fontName.toLowerCase();
    return iconFontPatterns.some(pattern => 
      lowerFontName.includes(pattern) || 
      lowerFontName.includes('icon') && (
        lowerFontName.includes('font') || 
        lowerFontName.includes('glyph') ||
        lowerFontName.includes('symbol')
      )
    );
  }
}

module.exports = FontAnalyzer;
