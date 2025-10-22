const { createLogger } = require('../utils/logger');

const logger = createLogger('FontAnalyzer');

class FontAnalyzer {
  async analyzeFonts(page) {
    logger.info('Analyzing fonts');

    try {
      const fontData = await page.evaluate(() => {
        console.log('🔍 FontAnalyzer: Starting font detection in browser context');
        const fonts = new Set();
        const fontFaces = new Map();
        const fontSources = new Set();
        const fontMetrics = [];

        // ENHANCED: Check for Google Fonts link elements FIRST
        console.log('🔍 FontAnalyzer: Checking for Google Fonts links...');
        const allLinks = document.querySelectorAll('link');
        console.log('🔍 FontAnalyzer: Found', allLinks.length, 'total link elements');
        
        allLinks.forEach((link, index) => {
          console.log(`🔍 FontAnalyzer: Link ${index}:`, link.href);
          if (link.href.includes('googleapis.com') || link.href.includes('fonts.google')) {
            console.log('🔍 FontAnalyzer: ✅ Google Fonts link found:', link.href);
            fontSources.add(link.href);
            
            // Try to extract font family from href
            try {
              const url = new URL(link.href);
              const family = url.searchParams.get('family');
              if (family) {
                console.log('🔍 FontAnalyzer: Extracted family parameter:', family);
                const fontFamilies = family.split('|').map(f => {
                  const cleanName = f.split(':')[0].replace(/\+/g, ' ');
                  return cleanName;
                });
                fontFamilies.forEach(fontName => {
                  if (fontName && fontName.trim()) {
                    console.log('🔍 FontAnalyzer: Adding Google Font from link:', fontName.trim());
                    fonts.add(fontName.trim());
                  }
                });
              }
            } catch (e) {
              console.log('🔍 FontAnalyzer: Error parsing Google Fonts URL:', e);
            }
          }
        });

        // Check @import statements in all stylesheets and style elements
        console.log('🔍 FontAnalyzer: Checking for @import statements...');
        const styleElements = document.querySelectorAll('style');
        styleElements.forEach((style, index) => {
          const content = style.textContent || '';
          console.log(`🔍 FontAnalyzer: Style element ${index} content:`, content.substring(0, 200));
          
          const importMatches = content.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/g);
          if (importMatches) {
            console.log('🔍 FontAnalyzer: Found @import statements:', importMatches);
            importMatches.forEach((match) => {
              const url = match.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/)?.[1];
              if (url && (url.includes('fonts.googleapis.com') || url.includes('fonts.google.com'))) {
                console.log('🔍 FontAnalyzer: Google Fonts @import found:', url);
                fontSources.add(url);
                
                try {
                  const urlObj = new URL(url);
                  const family = urlObj.searchParams.get('family');
                  if (family) {
                    console.log('🔍 FontAnalyzer: Extracted family from @import:', family);
                    const fontFamilies = family.split('|').map(f => {
                      const cleanName = f.split(':')[0].replace(/\+/g, ' ');
                      return cleanName;
                    });
                    fontFamilies.forEach(fontName => {
                      if (fontName && fontName.trim()) {
                        console.log('🔍 FontAnalyzer: Adding Google Font from @import:', fontName.trim());
                        fonts.add(fontName.trim());
                      }
                    });
                  }
                } catch (e) {
                  console.log('🔍 FontAnalyzer: Error parsing Google Fonts @import URL:', e);
                }
              }
            });
          }
        });

        // Get computed styles for all elements (optimized sampling)
        const allElements = document.querySelectorAll('*');
        console.log('🔍 FontAnalyzer: Found', allElements.length, 'elements to analyze');
        
        // Sample first 200 elements for better performance (reduced from 500)
        const sampleElements = Array.from(allElements).slice(0, 200);
        sampleElements.forEach((element, index) => {
          const styles = window.getComputedStyle(element);
          const fontFamily = styles.fontFamily;
          
          if (index < 10) { // Only log first 10 for debugging
            console.log(`🔍 FontAnalyzer: Element ${index} (${element.tagName}) font-family:`, fontFamily);
          }
          
          if (fontFamily && fontFamily !== 'initial') {
            // Split font-family string into individual fonts
            // Font families can be separated by commas, e.g., "Mulish", sans-serif
            const individualFonts = fontFamily.split(',').map(f => f.trim().replace(/['"]/g, ''));
            
            individualFonts.forEach(individualFont => {
              if (individualFont && individualFont !== 'initial') {
                console.log('🔍 FontAnalyzer: Adding individual font:', individualFont);
                fonts.add(individualFont);
              }
            });
            
            // Store detailed font metrics for first few elements
            if (index < 20 && element.textContent && element.textContent.trim()) {
              fontMetrics.push({
                fontFamily: individualFonts[0] || fontFamily, // Use first font as primary
                fontSize: styles.fontSize,
                fontWeight: styles.fontWeight,
                fontStyle: styles.fontStyle,
                fontDisplay: styles.fontDisplay,
                lineHeight: styles.lineHeight,
                element: element.tagName.toLowerCase(),
                textContent: element.textContent.trim().substring(0, 100),
              });
            }
          }
        });

        // ENHANCED: Check pseudo-elements for icon fonts (::before, ::after)
        console.log('🔍 FontAnalyzer: Checking pseudo-elements for icon fonts...');
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
                  console.log('🔍 FontAnalyzer: Adding font from ::before:', font);
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
                  console.log('🔍 FontAnalyzer: Adding font from ::after:', font);
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
              console.warn('Could not access stylesheet rules:', e.message);
            }
          });
        } catch (e) {
          console.warn('Error analyzing stylesheets:', e.message);
        }

        // Check for Google Fonts and other web font services
        const linkElements = document.querySelectorAll('link[href*="fonts"]');
        console.log('🔍 FontAnalyzer: Found', linkElements.length, 'font links');
        linkElements.forEach((link) => {
          console.log('🔍 FontAnalyzer: Processing font link:', link.href);
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
                  console.log('🔍 FontAnalyzer: Adding Google Font from link:', fontName.trim());
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
                    console.warn('Error parsing Google Fonts URL:', e);
                  }
                }
              });
            }
          });
        } catch (e) {
          console.warn('Error analyzing style elements:', e);
        }

        console.log('🔍 FontAnalyzer: Final font detection results:');
        console.log('  - Total fonts found:', fonts.size);
        console.log('  - Fonts list:', Array.from(fonts));
        console.log('  - Font sources:', Array.from(fontSources));
        console.log('  - Font faces:', fontFaces.size);

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

      return {
        totalFonts: processedFonts.length,
        fonts: processedFonts,
        fontFaces: fontData.fontFaces,
        fontSources: fontData.fontSources,
        fontMetrics: fontData.fontMetrics,
        categorizedFonts: categorizedFonts,
        fontLoading: fontLoadingData,
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
}

module.exports = FontAnalyzer;
