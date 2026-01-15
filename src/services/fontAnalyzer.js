const { createLogger } = require('../utils/logger');
const { roundTo } = require('../utils/formatHelpers');

const logger = createLogger('FontAnalyzer');

class FontAnalyzer {
  async analyzeFonts(page) {
    logger.info('Analyzing fonts');

    try {
      const fontData = await page.evaluate(() => {
        const fonts = new Set();
        const fontFaces = new Map();
        const fontSources = new Set();
        const fontMetrics = [];

        // ENHANCED: Check for Google Fonts link elements FIRST
        const allLinks = document.querySelectorAll('link');
        allLinks.forEach((link, index) => {
          if (link.href.includes('googleapis.com') || link.href.includes('fonts.google')) {
            fontSources.add(link.href);
            
            // Try to extract font family from href
            try {
              const url = new URL(link.href);
              const family = url.searchParams.get('family');
              if (family) {
                const fontFamilies = family.split('|').map(f => {
                  const cleanName = f.split(':')[0].replace(/\+/g, ' ');
                  return cleanName;
                });
                fontFamilies.forEach(fontName => {
                  if (fontName && fontName.trim()) {
                    fonts.add(fontName.trim());
                  }
                });
              }
            } catch (e) {
            }
          }
        });

        // Check @import statements in all stylesheets and style elements
        const styleElements = document.querySelectorAll('style');
        styleElements.forEach((style, index) => {
          const content = style.textContent || '';
          
          const importMatches = content.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/g);
          if (importMatches) {
            importMatches.forEach((match) => {
              const url = match.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/)?.[1];
              if (url && (url.includes('fonts.googleapis.com') || url.includes('fonts.google.com'))) {
                fontSources.add(url);
                
                try {
                  const urlObj = new URL(url);
                  const family = urlObj.searchParams.get('family');
                  if (family) {
                    const fontFamilies = family.split('|').map(f => {
                      const cleanName = f.split(':')[0].replace(/\+/g, ' ');
                      return cleanName;
                    });
                    fontFamilies.forEach(fontName => {
                      if (fontName && fontName.trim()) {
                        fonts.add(fontName.trim());
                      }
                    });
                  }
                } catch (e) {
                }
              }
            });
          }
        });

        // Get computed styles for all elements (optimized sampling)
        const allElements = document.querySelectorAll('*');
        // Sample first 200 elements for better performance (reduced from 500)
        const sampleElements = Array.from(allElements).slice(0, 200);
        sampleElements.forEach((element, index) => {
          const styles = window.getComputedStyle(element);
          const fontFamily = styles.fontFamily;
          
          if (index < 10) { // Only log first 10 for debugging
          }
          
          if (fontFamily && fontFamily !== 'initial') {
            // Split font-family string into individual fonts
            // Font families can be separated by commas, e.g., "Mulish", sans-serif
            const individualFonts = fontFamily.split(',').map(f => f.trim().replace(/['"]/g, ''));
            
            individualFonts.forEach(individualFont => {
              if (individualFont && individualFont !== 'initial') {
                fonts.add(individualFont);
              }
            });
            
            // Store detailed font metrics for visual content elements only
            const tagName = element.tagName.toLowerCase();
            const visualElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'td', 'th', 'label', 'button', 'input', 'textarea', 'blockquote', 'figcaption', 'strong', 'em', 'b', 'i', 'small', 'mark', 'cite', 'q', 'code', 'pre', 'nav', 'article', 'section', 'aside', 'footer', 'header', 'main', 'div'];
            const excludedElements = ['html', 'head', 'body', 'style', 'script', 'link', 'meta', 'title', 'noscript', 'template', 'svg', 'path', 'g', 'defs', 'symbol', 'use', 'clippath', 'mask', 'iframe', 'object', 'embed', 'param', 'source', 'track', 'wbr', 'br', 'hr'];
            
            const hasVisibleText = element.textContent && element.textContent.trim().length > 0;
            const isVisualElement = visualElements.includes(tagName) || (!excludedElements.includes(tagName) && hasVisibleText);
            
            if (fontMetrics.length < 30 && isVisualElement && hasVisibleText) {
              // Get direct text content only (not from children)
              const directText = Array.from(element.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join(' ')
                .trim();
              
              if (directText.length > 0 || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'button', 'label'].includes(tagName)) {
                fontMetrics.push({
                  fontFamily: individualFonts[0] || fontFamily,
                  fontSize: styles.fontSize,
                  fontWeight: styles.fontWeight,
                  fontStyle: styles.fontStyle,
                  fontDisplay: styles.fontDisplay,
                  lineHeight: styles.lineHeight,
                  letterSpacing: styles.letterSpacing,
                  element: tagName,
                  textContent: (directText || element.textContent.trim()).substring(0, 80),
                  className: element.className ? element.className.toString().substring(0, 50) : '',
                });
              }
            }
          }
        });

        // ENHANCED: Check pseudo-elements for icon fonts (::before, ::after)
        const pseudoSampleElements = Array.from(allElements).slice(0, 200);
        pseudoSampleElements.forEach((element, index) => {
          try {
            // Check ::before pseudo-element
            const beforeStyles = window.getComputedStyle(element, '::before');
            const beforeFont = beforeStyles.fontFamily;
            if (beforeFont && beforeFont !== 'initial' && beforeStyles.content && beforeStyles.content !== 'none') {
              const individualFonts = beforeFont.split(',').map(f => f.trim().replace(/['"]/g, ''));
              individualFonts.forEach(font => {
                if (font && font !== 'initial') {
                  fonts.add(font);
                }
              });
            }

            // Check ::after pseudo-element
            const afterStyles = window.getComputedStyle(element, '::after');
            const afterFont = afterStyles.fontFamily;
            if (afterFont && afterFont !== 'initial' && afterStyles.content && afterStyles.content !== 'none') {
              const individualFonts = afterFont.split(',').map(f => f.trim().replace(/['"]/g, ''));
              individualFonts.forEach(font => {
                if (font && font !== 'initial') {
                  fonts.add(font);
                }
              });
            }
          } catch (e) {
            // Silently ignore errors accessing pseudo-elements
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
            }
          });
        } catch (e) {
        }

        // Check for Google Fonts and other web font services
        const linkElements = document.querySelectorAll('link[href*="fonts"]');
        linkElements.forEach((link) => {
          fontSources.add(link.href);
          
          // Extract Google Font family names from URLs
          if (link.href.includes('fonts.googleapis.com') || link.href.includes('fonts.google.com')) {
            const urlParams = new URLSearchParams(link.href.split('?')[1] || '');
            const family = urlParams.get('family');
            if (family) {
              // Parse Google Fonts family parameter (e.g., "Mulish:wght@400;700" -> "Mulish")
              const fontFamilies = family.split('|').map(f => {
                const cleanName = f.split(':')[0].replace(/\+/g, ' ');
                return cleanName;
              });
              fontFamilies.forEach(fontName => {
                if (fontName && fontName.trim()) {
                  fonts.add(`"${fontName.trim()}"`);
                }
              });
            }
          }
        });

        // Also check for @import statements in stylesheets
        try {
          const styleElements = document.querySelectorAll('style');
          styleElements.forEach((style) => {
            const content = style.textContent || '';
            const importMatches = content.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/g);
            if (importMatches) {
              importMatches.forEach((match) => {
                const url = match.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/)?.[1];
                if (url && (url.includes('fonts.googleapis.com') || url.includes('fonts.google.com'))) {
                  fontSources.add(url);
                  
                  // Extract font family from Google Fonts @import URL
                  try {
                    const urlObj = new URL(url);
                    const family = urlObj.searchParams.get('family');
                    if (family) {
                      const fontFamilies = family.split('|').map(f => {
                        const cleanName = f.split(':')[0].replace(/\+/g, ' ');
                        return cleanName;
                      });
                      fontFamilies.forEach(fontName => {
                        if (fontName && fontName.trim()) {
                          fonts.add(`"${fontName.trim()}"`);
                        }
                      });
                    }
                  } catch (e) {
                  }
                }
              });
            }
          });
        } catch (e) {
        }
        return {
          fonts: Array.from(fonts),
          fontFaces: Array.from(fontFaces.values()),
          fontSources: Array.from(fontSources),
          fontMetrics: fontMetrics.slice(0, 100), // Limit to prevent large payloads
        };
      });

      // Analyze font loading performance
      const fontLoadingData = await this.analyzeFontLoading(page);

      // Process fonts into objects with metadata first
      const processedFonts = fontData.fonts.map(fontName => {
        const cleanFont = fontName.replace(/['"]/g, '').trim();
        
        // Find matching font face rule for this font
        const matchingFontFace = fontData.fontFaces.find(ff => 
          ff.fontFamily.toLowerCase() === cleanFont.toLowerCase()
        );

        // Find matching font sources (URLs)
        const matchingSources = fontData.fontSources.filter(src => 
          src.toLowerCase().includes(cleanFont.toLowerCase().replace(/ /g, '+')) ||
          src.toLowerCase().includes(cleanFont.toLowerCase().replace(/ /g, '-')) ||
          src.toLowerCase().includes(cleanFont.toLowerCase().replace(/ /g, ''))
        );

        // Extract URLs from font face src property
        let fontUrls = [];
        if (matchingFontFace && matchingFontFace.src) {
          const srcMatches = matchingFontFace.src.match(/url\(['"]?([^'"]+)['"]?\)/g);
          if (srcMatches) {
            fontUrls = srcMatches.map(match => {
              const url = match.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
              return url;
            }).filter(Boolean);
          }
        }

        return {
          fontFamily: cleanFont,
          name: cleanFont,
          source: this.isGoogleFont(cleanFont) ? 'google' : 
                  this.isSystemFont(cleanFont) ? 'system' : 'web',
          isSystemFont: this.isSystemFont(cleanFont),
          isGoogleFont: this.isGoogleFont(cleanFont),
          isIconFont: this.isIconFont(cleanFont, matchingFontFace),
          isWebFont: this.isWebFont(cleanFont),
          fontWeight: matchingFontFace?.fontWeight || 'normal',
          fontStyle: matchingFontFace?.fontStyle || 'normal',
          fontDisplay: matchingFontFace?.fontDisplay || 'auto',
          url: fontUrls.length > 0 ? fontUrls[0] : null, // Primary URL
          sources: fontUrls.length > 0 ? fontUrls : matchingSources, // All URLs
          unicodeRange: matchingFontFace?.unicodeRange || null
        };
      });

      // Categorize fonts after processing (now we have full metadata)
      const categorizedFonts = this.categorizeFontsFromProcessed(processedFonts);

      logger.info('Font analysis completed:', {
        totalFonts: processedFonts.length,
        fonts: processedFonts,
        categorized: categorizedFonts
      });

      // Log icon fonts detected
      const iconFonts = processedFonts.filter(f => f.isIconFont);
      if (iconFonts.length > 0) {
        logger.info(`🎨 Icon fonts detected: ${iconFonts.map(f => f.fontFamily).join(', ')}`);
      }

      // Run best-in-class analysis
      logger.info('Running advanced font analysis...');
      const formatAnalysis = this.analyzeFontFormats(fontData.fontSources, fontData.fontFaces);
      const fontDisplayAnalysis = this.analyzeFontDisplay(fontData.fontFaces);
      const accessibilityAnalysis = this.analyzeTypographyAccessibility(fontData.fontMetrics);
      const fallbackAnalysis = this.analyzeFallbackStacks(fontData.fontMetrics);
      const variableFontAnalysis = await this.analyzeVariableFonts(page);
      const clsRiskAnalysis = this.analyzeCLSRisk(fontData.fontFaces, fontData.fontMetrics);
      
      logger.info('Advanced analysis complete:', {
        formats: formatAnalysis.summary,
        fontDisplay: fontDisplayAnalysis.summary,
        accessibility: accessibilityAnalysis.summary,
        fallbacks: fallbackAnalysis.summary,
        variableFonts: variableFontAnalysis.hasVariableFonts,
        clsRisk: clsRiskAnalysis.level
      });

      return {
        totalFonts: processedFonts.length,
        fonts: processedFonts,
        fontFaces: fontData.fontFaces,
        fontSources: fontData.fontSources,
        fontMetrics: fontData.fontMetrics,
        categorizedFonts: categorizedFonts,
        fontLoading: fontLoadingData,
        // Best-in-class analysis results
        advancedAnalysis: {
          formats: formatAnalysis,
          fontDisplay: fontDisplayAnalysis,
          accessibility: accessibilityAnalysis,
          fallbackStacks: fallbackAnalysis,
          variableFonts: variableFontAnalysis,
          clsRisk: clsRiskAnalysis
        }
      };

    } catch (error) {
      logger.error('Font analysis failed:', error);
      return {
        totalFonts: 0,
        fonts: [],
        fontFaces: [],
        fontSources: [],
        fontMetrics: [],
        categorizedFonts: { system: [], webFonts: [], googleFonts: [], iconFonts: [], customFonts: [] },
        fontLoading: { supported: false, error: error.message },
        error: error.message
      };
    }
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

  // New method to categorize processed font objects
  categorizeFontsFromProcessed(processedFonts) {
    const categories = {
      system: [],
      webFonts: [],
      googleFonts: [],
      iconFonts: [],
      customFonts: [],
    };

    processedFonts.forEach((font) => {
      if (font.isIconFont) {
        categories.iconFonts.push(font.fontFamily);
      } else if (font.isSystemFont) {
        categories.system.push(font.fontFamily);
      } else if (font.isGoogleFont || font.source === 'google') {
        categories.googleFonts.push(font.fontFamily);
      } else if (font.isWebFont) {
        categories.webFonts.push(font.fontFamily);
      } else {
        categories.customFonts.push(font.fontFamily);
      }
    });

    return categories;
  }

  isSystemFont(fontName) {
    const systemFonts = [
      'Arial', 'Helvetica', 'Times', 'Times New Roman', 'Courier', 'Courier New',
      'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Trebuchet MS',
      'Arial Black', 'Impact', 'Comic Sans MS', 'Tahoma', 'Lucida Console',
      'Monaco', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
    ];
    
    const cleanFont = fontName.replace(/['"]/g, '').trim();
    return systemFonts.some((sysFont) => 
      cleanFont.toLowerCase().includes(sysFont.toLowerCase())
    );
  }

  isGoogleFont(fontName) {
    // Extended list of popular Google Fonts
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
      'Mulish',  // Added Mulish
      'Inter',
      'Playfair Display',
      'Merriweather',
      'PT Sans',
      'Libre Baskerville',
      'Work Sans',
      'Fira Sans',
      'Rubik',
      'Karla',
      'Hind',
      'Barlow',
      'DM Sans',
      'Manrope',
      'Plus Jakarta Sans',
      'Space Grotesk',
      'Epilogue',
      'Lexend',
      'Outfit',
      'Public Sans',
      'IBM Plex Sans',
      'Noto Sans',
      'Source Serif Pro',
      'Crimson Text',
      'Lora',
      'PT Serif',
      'Abril Fatface',
      'Quicksand',
      'Titillium Web',
      'Cabin',
      'Oxygen',
      'Comfortaa',
      'Anton',
      'Dancing Script',
      'Pacifico',
      'Righteous',
      'Bebas Neue',
      'Fjalla One',
      'Arimo',
      'Tinos',
      'Cousine'
    ];

    const fontLower = fontName.toLowerCase();
    return googleFonts.some((gFont) => {
      const gFontLower = gFont.toLowerCase();
      return fontLower.includes(gFontLower) || 
             fontLower === gFontLower ||
             fontLower.replace(/\s+/g, '') === gFontLower.replace(/\s+/g, '');
    });
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

  isIconFont(fontName, fontData = {}) {
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
      'genericons',
      'eleganticons',
      'typicons',
      'entypo',
      'maki',
      'mapbox',
      'octicons',
      'socicon',
      'weather-icons',
      'payment-icons',
      'cryptocurrency-icons',
      // Groundworks and common custom icon fonts
      'icomoon',
      'custom-icons',
      'site-icons',
      'brand-icons',
      'ui-icons'
    ];

    const lowerFontName = fontName.toLowerCase();
    
    // Check font name patterns
    const matchesPattern = iconFontPatterns.some(pattern => 
      lowerFontName.includes(pattern) || 
      (lowerFontName.includes('icon') && (
        lowerFontName.includes('font') || 
        lowerFontName.includes('glyph') ||
        lowerFontName.includes('symbol')
      ))
    );

    if (matchesPattern) return true;

    // Check unicode range - icon fonts often use Private Use Area (PUA)
    // PUA ranges: U+E000-F8FF, U+F0000-FFFFD, U+100000-10FFFD
    if (fontData.unicodeRange) {
      const unicodeStr = fontData.unicodeRange.toLowerCase();
      const iconRanges = ['e000', 'e001', 'e002', 'e003', 'e004', 'e005', 'f000', 'f001'];
      if (iconRanges.some(range => unicodeStr.includes(range))) {
        return true;
      }
    }

    // Check if font family contains ligatures or specific icon indicators
    if (fontData.src) {
      const srcLower = fontData.src.toLowerCase();
      if (srcLower.includes('icon') || srcLower.includes('glyph') || srcLower.includes('symbol')) {
        return true;
      }
    }

    return false;
  }

  // ============================================
  // BEST-IN-CLASS ANALYSIS METHODS
  // ============================================

  /**
   * Analyze font formats (WOFF2, WOFF, TTF, etc.)
   */
  analyzeFontFormats(fontSources, fontFaces) {
    const formats = {
      woff2: [],
      woff: [],
      ttf: [],
      otf: [],
      eot: [],
      svg: [],
      unknown: []
    };

    const allSources = [...fontSources];
    
    // Also extract from fontFaces src
    fontFaces.forEach(face => {
      if (face.src) {
        const urlMatches = face.src.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
        if (urlMatches) {
          urlMatches.forEach(match => {
            const url = match.match(/url\(['"]?([^'")\s]+)['"]?\)/)?.[1];
            if (url) allSources.push(url);
          });
        }
      }
    });

    allSources.forEach(src => {
      const srcLower = src.toLowerCase();
      if (srcLower.includes('.woff2') || srcLower.includes('format("woff2")') || srcLower.includes("format('woff2')")) {
        formats.woff2.push(src);
      } else if (srcLower.includes('.woff') || srcLower.includes('format("woff")') || srcLower.includes("format('woff')")) {
        formats.woff.push(src);
      } else if (srcLower.includes('.ttf') || srcLower.includes('format("truetype")')) {
        formats.ttf.push(src);
      } else if (srcLower.includes('.otf') || srcLower.includes('format("opentype")')) {
        formats.otf.push(src);
      } else if (srcLower.includes('.eot')) {
        formats.eot.push(src);
      } else if (srcLower.includes('.svg')) {
        formats.svg.push(src);
      } else if (srcLower.includes('fonts.googleapis.com') || srcLower.includes('fonts.gstatic.com')) {
        // Google Fonts serve WOFF2 by default to modern browsers
        formats.woff2.push(src);
      }
    });

    const total = Object.values(formats).reduce((sum, arr) => sum + arr.length, 0);
    const woff2Percentage = total > 0 ? roundTo((formats.woff2.length / total) * 100, 0) : 0;

    return {
      formats,
      summary: {
        total,
        woff2Count: formats.woff2.length,
        woff2Percentage,
        hasModernFormats: formats.woff2.length > 0,
        hasLegacyFormats: formats.eot.length > 0 || formats.svg.length > 0,
        recommendation: woff2Percentage >= 80 ? 'excellent' : woff2Percentage >= 50 ? 'good' : 'needs-improvement'
      }
    };
  }

  /**
   * Analyze font-display property usage
   */
  analyzeFontDisplay(fontFaces) {
    const displayValues = {
      swap: [],
      block: [],
      fallback: [],
      optional: [],
      auto: [],
      notSet: []
    };

    fontFaces.forEach(face => {
      const display = (face.fontDisplay || '').toLowerCase().trim();
      const fontName = face.fontFamily || 'Unknown';
      
      if (display === 'swap') {
        displayValues.swap.push(fontName);
      } else if (display === 'block') {
        displayValues.block.push(fontName);
      } else if (display === 'fallback') {
        displayValues.fallback.push(fontName);
      } else if (display === 'optional') {
        displayValues.optional.push(fontName);
      } else if (display === 'auto') {
        displayValues.auto.push(fontName);
      } else {
        displayValues.notSet.push(fontName);
      }
    });

    const total = fontFaces.length;
    const optimalCount = displayValues.swap.length + displayValues.optional.length + displayValues.fallback.length;
    const problematicCount = displayValues.block.length + displayValues.auto.length + displayValues.notSet.length;
    
    return {
      values: displayValues,
      summary: {
        total,
        optimalCount,
        problematicCount,
        score: total > 0 ? roundTo((optimalCount / total) * 100, 0) : 100,
        recommendation: problematicCount === 0 ? 'excellent' : problematicCount <= 2 ? 'good' : 'needs-improvement'
      }
    };
  }

  /**
   * Analyze typography accessibility
   */
  analyzeTypographyAccessibility(fontMetrics) {
    const issues = [];
    const passed = [];
    
    // Check body text sizes
    const textElements = fontMetrics.filter(m => 
      ['p', 'span', 'div', 'li', 'td', 'th', 'label', 'a'].includes(m.element?.toLowerCase())
    );
    
    const headingElements = fontMetrics.filter(m => 
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(m.element?.toLowerCase())
    );

    // Body text minimum size check (16px)
    const smallTextElements = textElements.filter(m => {
      const size = parseFloat(m.fontSize);
      return size > 0 && size < 16;
    });
    
    if (smallTextElements.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Small body text detected',
        detail: `${smallTextElements.length} element(s) have text smaller than 16px. Consider increasing for better readability.`,
        elements: smallTextElements.slice(0, 3).map(e => `<${e.element}>: ${e.fontSize}`)
      });
    } else if (textElements.length > 0) {
      passed.push({
        type: 'success',
        title: 'Body text size is adequate',
        detail: 'All body text is 16px or larger'
      });
    }

    // Line-height check (1.5+ for body text)
    const poorLineHeight = textElements.filter(m => {
      if (!m.lineHeight || m.lineHeight === 'normal') return false;
      const fontSize = parseFloat(m.fontSize);
      const lineHeight = parseFloat(m.lineHeight);
      if (fontSize > 0 && lineHeight > 0) {
        const ratio = lineHeight / fontSize;
        return ratio < 1.4;
      }
      return false;
    });

    if (poorLineHeight.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Tight line-height detected',
        detail: `${poorLineHeight.length} element(s) have line-height below 1.4. Recommended: 1.5+ for body text.`,
        elements: poorLineHeight.slice(0, 3).map(e => `<${e.element}>: ${e.lineHeight}`)
      });
    } else if (textElements.length > 0) {
      passed.push({
        type: 'success',
        title: 'Line-height is accessible',
        detail: 'Line-height ratios are 1.4 or higher'
      });
    }

    // Heading hierarchy check
    if (headingElements.length > 0) {
      const headingSizes = {};
      headingElements.forEach(h => {
        const tag = h.element?.toLowerCase();
        if (!headingSizes[tag]) {
          headingSizes[tag] = parseFloat(h.fontSize);
        }
      });
      
      // Check if heading sizes follow hierarchy (h1 > h2 > h3, etc.)
      const sortedHeadings = Object.entries(headingSizes).sort((a, b) => {
        const numA = parseInt(a[0].replace('h', ''));
        const numB = parseInt(b[0].replace('h', ''));
        return numA - numB;
      });
      
      let hierarchyBroken = false;
      for (let i = 1; i < sortedHeadings.length; i++) {
        if (sortedHeadings[i][1] >= sortedHeadings[i-1][1]) {
          hierarchyBroken = true;
          break;
        }
      }

      if (hierarchyBroken) {
        issues.push({
          type: 'info',
          title: 'Heading hierarchy may need review',
          detail: 'Heading sizes don\'t follow a consistent h1>h2>h3 pattern',
          elements: sortedHeadings.map(([tag, size]) => `${tag}: ${size}px`)
        });
      } else {
        passed.push({
          type: 'success',
          title: 'Heading hierarchy is correct',
          detail: 'Font sizes decrease appropriately from h1 to h6'
        });
      }
    }

    // Font weight variety check
    const weights = new Set(fontMetrics.map(m => m.fontWeight).filter(Boolean));
    if (weights.size >= 3) {
      passed.push({
        type: 'success',
        title: 'Good font weight variety',
        detail: `${weights.size} different font weights used for visual hierarchy`
      });
    }

    const score = Math.max(0, 100 - (issues.filter(i => i.type === 'warning').length * 15) - (issues.filter(i => i.type === 'error').length * 25));
    
    return {
      issues,
      passed,
      score,
      summary: {
        issueCount: issues.length,
        passedCount: passed.length,
        recommendation: score >= 90 ? 'excellent' : score >= 70 ? 'good' : 'needs-improvement'
      }
    };
  }

  /**
   * Analyze fallback font stack quality
   */
  analyzeFallbackStacks(fontMetrics) {
    const stacks = [];
    const seenStacks = new Set();

    fontMetrics.forEach(m => {
      if (!m.fontFamily || seenStacks.has(m.fontFamily)) return;
      seenStacks.add(m.fontFamily);

      const fonts = m.fontFamily.split(',').map(f => f.trim().replace(/['"]/g, ''));
      
      if (fonts.length <= 1) {
        stacks.push({
          stack: m.fontFamily,
          fonts,
          quality: 'poor',
          issue: 'No fallback fonts defined',
          recommendation: 'Add system font fallbacks'
        });
      } else {
        const hasGenericFallback = fonts.some(f => 
          ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', '-apple-system'].includes(f.toLowerCase())
        );
        
        const hasSystemFallback = fonts.some(f => 
          ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Tahoma'].some(sys => 
            f.toLowerCase().includes(sys.toLowerCase())
          )
        );

        let quality = 'poor';
        let issue = '';
        let recommendation = '';

        if (hasGenericFallback && hasSystemFallback && fonts.length >= 3) {
          quality = 'excellent';
          issue = 'Well-defined fallback stack';
          recommendation = 'No changes needed';
        } else if (hasGenericFallback) {
          quality = 'good';
          issue = 'Has generic fallback';
          recommendation = 'Consider adding intermediate system fonts';
        } else {
          quality = 'poor';
          issue = 'Missing generic fallback';
          recommendation = 'Add sans-serif, serif, or monospace at the end';
        }

        stacks.push({
          stack: m.fontFamily,
          fonts,
          quality,
          issue,
          recommendation
        });
      }
    });

    const excellent = stacks.filter(s => s.quality === 'excellent').length;
    const good = stacks.filter(s => s.quality === 'good').length;
    const poor = stacks.filter(s => s.quality === 'poor').length;
    const total = stacks.length;

    const score = total > 0 ? roundTo(((excellent * 100 + good * 70 + poor * 30) / total), 0) : 100;

    return {
      stacks: stacks.slice(0, 10), // Limit to 10
      summary: {
        total,
        excellent,
        good,
        poor,
        score,
        recommendation: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-improvement'
      }
    };
  }

  /**
   * Detect variable fonts
   */
  async analyzeVariableFonts(page) {
    try {
      return await page.evaluate(() => {
        const variableFonts = [];
        const regularFonts = [];
        
        // Check CSS for font-variation-settings
        const allElements = document.querySelectorAll('*');
        const checkedFamilies = new Set();
        
        Array.from(allElements).slice(0, 100).forEach(el => {
          const styles = window.getComputedStyle(el);
          const fontFamily = styles.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim();
          
          if (fontFamily && !checkedFamilies.has(fontFamily)) {
            checkedFamilies.add(fontFamily);
            
            const variationSettings = styles.fontVariationSettings;
            const fontStretch = styles.fontStretch;
            const fontWeight = styles.fontWeight;
            
            // Variable fonts often have font-variation-settings or non-keyword font-stretch
            const hasVariationSettings = variationSettings && variationSettings !== 'normal';
            const hasVariableWeight = fontWeight && !['normal', 'bold', '400', '700'].includes(fontWeight);
            
            if (hasVariationSettings) {
              variableFonts.push({
                fontFamily,
                variationSettings,
                axes: variationSettings
              });
            } else {
              regularFonts.push(fontFamily);
            }
          }
        });

        // Check @font-face for variable font indicators
        try {
          const styleSheets = Array.from(document.styleSheets);
          styleSheets.forEach(sheet => {
            try {
              const rules = Array.from(sheet.cssRules || []);
              rules.forEach(rule => {
                if (rule.type === CSSRule.FONT_FACE_RULE) {
                  const fontFamily = rule.style.fontFamily?.replace(/['"]/g, '');
                  const src = rule.style.src || '';
                  
                  // Variable fonts often have format("woff2-variations") or weight ranges like "100 900"
                  const isVariable = src.includes('variations') || 
                                    src.includes('variable') ||
                                    (rule.style.fontWeight && rule.style.fontWeight.includes(' '));
                  
                  if (isVariable && fontFamily && !variableFonts.find(v => v.fontFamily === fontFamily)) {
                    variableFonts.push({
                      fontFamily,
                      variationSettings: 'Variable font detected from @font-face',
                      axes: rule.style.fontWeight || 'wght'
                    });
                  }
                }
              });
            } catch (e) {
              // Cross-origin access may fail
            }
          });
        } catch (e) {
          // Ignore stylesheet access errors
        }

        return {
          variableFonts,
          regularFonts: regularFonts.filter(f => !variableFonts.find(v => v.fontFamily === f)),
          hasVariableFonts: variableFonts.length > 0,
          potentialSavings: variableFonts.length > 0 
            ? 'Variable fonts can replace multiple static font files'
            : regularFonts.length > 3 
              ? 'Consider variable fonts to reduce HTTP requests'
              : null
        };
      });
    } catch (error) {
      logger.warn('Variable font analysis failed:', error.message);
      return {
        variableFonts: [],
        regularFonts: [],
        hasVariableFonts: false,
        error: error.message
      };
    }
  }

  /**
   * Estimate CLS (Cumulative Layout Shift) risk from fonts
   */
  analyzeCLSRisk(fontFaces, fontMetrics) {
    let riskScore = 0;
    const risks = [];

    // Check font-display values
    const blockingFonts = fontFaces.filter(f => 
      !f.fontDisplay || f.fontDisplay === 'auto' || f.fontDisplay === 'block'
    );
    
    if (blockingFonts.length > 0) {
      riskScore += blockingFonts.length * 15;
      risks.push({
        type: 'high',
        title: 'Blocking font-display values',
        detail: `${blockingFonts.length} font(s) use 'block' or 'auto' which can cause FOIT`,
        fonts: blockingFonts.map(f => f.fontFamily).slice(0, 5)
      });
    }

    // Check for web fonts without fallbacks
    const noFallbackStacks = fontMetrics.filter(m => {
      const fonts = (m.fontFamily || '').split(',');
      return fonts.length === 1 && !['sans-serif', 'serif', 'monospace'].includes(fonts[0]?.trim().toLowerCase());
    });

    if (noFallbackStacks.length > 0) {
      riskScore += noFallbackStacks.length * 10;
      risks.push({
        type: 'medium',
        title: 'Missing fallback fonts',
        detail: `${noFallbackStacks.length} element(s) have no fallback fonts defined`,
        fonts: [...new Set(noFallbackStacks.map(m => m.fontFamily))].slice(0, 5)
      });
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);
    
    return {
      risks,
      score: 100 - riskScore,
      level: riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
      summary: {
        riskCount: risks.length,
        recommendation: riskScore === 0 ? 'excellent' : riskScore < 30 ? 'good' : 'needs-improvement'
      }
    };
  }
}

module.exports = FontAnalyzer;
