/**
 * Competitive Analysis Service
 * Compare your site against up to 5 competitors across all metrics
 * Target: $500-2000 per competitive analysis report
 */

const seoAnalyzer = require('./seoAnalyzer');
const securityAnalyzerService = require('./securityAnalyzerService');

// Use fast, competitive-optimized analyzers (no Lighthouse)
const competitiveAccessibilityAnalyzer = require('./competitiveAccessibilityAnalyzer');
const competitiveCWVAnalyzer = require('./competitiveCoreWebVitalsAnalyzer');
const competitivePerformanceAnalyzer = require('./competitivePerformanceAnalyzer');

const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('CompetitiveAnalysisService');

class CompetitiveAnalysisService {
  constructor() {
    this.io = null; // Will be set by the server
  }

  /**
   * Set the Socket.IO instance for real-time updates
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Emit progress update via WebSocket
   */
  emitProgress(sessionId, data) {
    if (this.io && sessionId) {
      this.io.to(sessionId).emit('analysis:progress', data);
    }
  }

  /**
   * Analyze your site vs competitors
   * CRITICAL: All operations run sequentially to prevent system overload
   * @param {string} yourUrl - Your website URL
   * @param {string[]} competitorUrls - Array of competitor URLs (max 3)
   * @param {string} sessionId - WebSocket session ID for real-time updates
   * @returns {Promise<Object>} Competitive analysis report
   */
  async analyzeCompetitors(yourUrl, competitorUrls, sessionId = null) {
    logger.info(`Starting competitive analysis: ${yourUrl} vs ${competitorUrls.length} competitors`);
    const startTime = Date.now();

    // Emit start event
    this.emitProgress(sessionId, {
      status: 'started',
      totalSites: 1 + competitorUrls.length,
      currentSite: 0,
      message: 'Starting competitive analysis...'
    });

    // Strict limits to prevent resource exhaustion
    if (competitorUrls.length > 3) {
      logger.warn(`Limiting competitors from ${competitorUrls.length} to 3 to prevent system overload`);
      competitorUrls = competitorUrls.slice(0, 3);
    }

    // Circuit breaker: Track consecutive failures
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 2;

    try {
      // Analyze sites SEQUENTIALLY to avoid browser pool exhaustion
      // First analyze your site
      logger.info('═══════════════════════════════════════════════');
      logger.info('ANALYZING YOUR SITE...');
      logger.info('═══════════════════════════════════════════════');
      
      this.emitProgress(sessionId, {
        status: 'analyzing',
        currentSite: 1,
        totalSites: 1 + competitorUrls.length,
        siteName: yourUrl,
        message: `Analyzing your site: ${yourUrl}`,
        stage: 'your-site'
      });
      
      const yourSite = await this.analyzeSingleSite(yourUrl, sessionId, 'your-site');
      
      this.emitProgress(sessionId, {
        status: 'site-complete',
        currentSite: 1,
        totalSites: 1 + competitorUrls.length,
        siteName: yourUrl,
        message: `Completed analyzing ${yourUrl}`,
        result: {
          url: yourUrl,
          scores: yourSite.scores,
          grade: yourSite.grade
        }
      });
      
      if (yourSite.error) {
        consecutiveFailures++;
        logger.error(`Your site analysis failed. Continuing with competitors...`);
      } else {
        consecutiveFailures = 0;
      }
      
      // Delay before competitors
      logger.info('⏳ Waiting 3 seconds before analyzing competitors...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Then analyze competitors one at a time with circuit breaker
      logger.info(`\nAnalyzing ${competitorUrls.length} competitors sequentially...`);
      const competitors = [];
      
      for (let i = 0; i < competitorUrls.length; i++) {
        // Circuit breaker: Stop if too many consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logger.error(`⚠️ CIRCUIT BREAKER TRIGGERED: ${consecutiveFailures} consecutive failures`);
          logger.error(`Stopping analysis to prevent further system overload`);
          break;
        }

        logger.info('═══════════════════════════════════════════════');
        logger.info(`COMPETITOR ${i + 1}/${competitorUrls.length}: ${competitorUrls[i]}`);
        logger.info('═══════════════════════════════════════════════');
        
        this.emitProgress(sessionId, {
          status: 'analyzing',
          currentSite: i + 2,
          totalSites: 1 + competitorUrls.length,
          siteName: competitorUrls[i],
          message: `Analyzing competitor ${i + 1}/${competitorUrls.length}: ${competitorUrls[i]}`,
          stage: 'competitor'
        });
        
        try {
          const result = await this.analyzeSingleSite(competitorUrls[i], sessionId, `competitor-${i + 1}`);
          competitors.push(result);
          
          this.emitProgress(sessionId, {
            status: 'site-complete',
            currentSite: i + 2,
            totalSites: 1 + competitorUrls.length,
            siteName: competitorUrls[i],
            message: `Completed analyzing ${competitorUrls[i]}`,
            result: {
              url: competitorUrls[i],
              scores: result.scores,
              grade: result.grade
            }
          });
          
          if (result.error) {
            consecutiveFailures++;
            logger.warn(`Competitor ${i + 1} analysis failed (consecutive failures: ${consecutiveFailures})`);
          } else {
            consecutiveFailures = 0; // Reset on success
          }
          
        } catch (error) {
          consecutiveFailures++;
          logger.error(`Competitor ${i + 1} threw exception:`, error.message);
          competitors.push({
            scores: { seo: 0, performance: 0, accessibility: 0, security: 0, coreWebVitals: 0, overall: 0 },
            details: null,
            grade: 'F',
            error: error.message
          });
        }
        
        // Longer delay between competitors (increased from 2s to 5s)
        if (i < competitorUrls.length - 1 && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
          logger.info('⏳ Waiting 5 seconds before next competitor (browser cleanup)...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // Check if we have enough data to generate report
      const successfulCompetitors = competitors.filter(c => !c.error);
      if (successfulCompetitors.length === 0 && yourSite.error) {
        throw new Error('No sites could be analyzed successfully. Please try again later.');
      }

      // Calculate rankings and insights
      const results = {
        yourSite: {
          url: yourUrl,
          ...yourSite
        },
        competitors: competitors.map((comp, idx) => ({
          url: competitorUrls[idx],
          ...comp
        })),
        comparison: this.generateComparison(yourSite, competitors.filter(c => !c.error)),
        rankings: this.calculateRankings(yourSite, competitors.filter(c => !c.error)),
        insights: this.generateInsights(yourSite, competitors.filter(c => !c.error)),
        recommendations: this.generateCompetitiveRecommendations(yourSite, competitors.filter(c => !c.error)),
        metadata: {
          totalSitesRequested: 1 + competitorUrls.length,
          totalSitesAnalyzed: 1 + competitors.length,
          successfulAnalyses: (yourSite.error ? 0 : 1) + successfulCompetitors.length,
          failedAnalyses: (yourSite.error ? 1 : 0) + (competitors.length - successfulCompetitors.length),
          circuitBreakerTriggered: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
        },
        timestamp: new Date().toISOString(),
        analysisTime: formatDuration(Date.now() - startTime, 2)
      };

      logger.info('═══════════════════════════════════════════════');
      logger.info(`✅ COMPETITIVE ANALYSIS COMPLETED in ${results.analysisTime}s`);
      logger.info(`   Successful: ${results.metadata.successfulAnalyses}/${results.metadata.totalSitesAnalyzed}`);
      logger.info('═══════════════════════════════════════════════');
      
      return results;

    } catch (error) {
      logger.error('Competitive analysis failed:', error);
      throw new Error(`Competitive analysis failed: ${error.message}`);
    }
  }

  /**
   * Emit metric progress
   */
  emitMetricProgress(sessionId, stage, metric, status, score = null) {
    this.emitProgress(sessionId, {
      status: status === 'start' ? 'metric' : 'metric-complete',
      stage,
      metric,
      score,
      message: status === 'start' ? `Analyzing ${metric}...` : `${metric} complete (${score})`
    });
  }

  /**
   * Analyze a single site across all metrics
   * CRITICAL: Run analyzers SEQUENTIALLY to prevent browser pool exhaustion
   * @param {string} url - Site URL to analyze
   * @param {string} sessionId - WebSocket session ID
   * @param {string} stage - Analysis stage (your-site, competitor-1, etc)
   * @private
   */
  async analyzeSingleSite(url, sessionId = null, stage = 'site') {
    logger.info(`Analyzing site: ${url}`);

    // Initialize results object
    const results = {
      seo: null,
      security: null,
      performance: null,
      accessibility: null,
      cwv: null
    };

    const scores = {
      seo: 0,
      performance: 0,
      accessibility: 0,
      security: 0,
      coreWebVitals: 0,
      overall: 0
    };

    try {
      // Run analyzers SEQUENTIALLY with timeouts and cleanup delays
      // This prevents browser pool exhaustion and memory leaks

      // 1. SEO Analysis (lightweight, text-based)
      try {
        logger.info(`${url}: Running SEO analysis...`);
        this.emitProgress(sessionId, {
          status: 'metric',
          stage,
          metric: 'SEO',
          message: 'Analyzing SEO...'
        });
        
        results.seo = await this.runWithTimeout(
          seoAnalyzer.analyzeSEO(url),
          30000,
          'SEO'
        );
        scores.seo = results.seo?.score?.overall || results.seo?.score || 0;
        logger.info(`${url}: SEO completed (score: ${scores.seo})`);
        
        this.emitProgress(sessionId, {
          status: 'metric-complete',
          stage,
          metric: 'SEO',
          score: scores.seo,
          message: `SEO complete (${scores.seo})`
        });
        
        await this.cleanup(500); // Small delay
      } catch (error) {
        logger.warn(`${url}: SEO analysis failed:`, error.message);
        results.seo = { error: error.message };
      }

      // 2. Security Analysis (lightweight, header checks)
      try {
        logger.info(`${url}: Running Security analysis...`);
        this.emitMetricProgress(sessionId, stage, 'Security', 'start');
        
        results.security = await this.runWithTimeout(
          securityAnalyzerService.analyzeSecurity(url),
          30000,
          'Security'
        );
        scores.security = results.security?.overallScore || 0;
        logger.info(`${url}: Security completed (score: ${scores.security})`);
        
        this.emitMetricProgress(sessionId, stage, 'Security', 'complete', scores.security);
        await this.cleanup(500);
      } catch (error) {
        logger.warn(`${url}: Security analysis failed:`, error.message);
        results.security = { error: error.message };
      }

      // 3. Accessibility Analysis (fast - Puppeteer only, no Lighthouse)
      try {
        logger.info(`${url}: Running Accessibility analysis...`);
        this.emitMetricProgress(sessionId, stage, 'Accessibility', 'start');
        
        results.accessibility = await this.runWithTimeout(
          competitiveAccessibilityAnalyzer.analyzeAccessibility(url),
          20000,  // Much faster without Lighthouse
          'Accessibility'
        );
        scores.accessibility = results.accessibility?.accessibilityScore || 0;
        logger.info(`${url}: Accessibility completed (score: ${scores.accessibility})`);
        
        this.emitMetricProgress(sessionId, stage, 'Accessibility', 'complete', scores.accessibility);
        await this.cleanup(500); // Shorter delay - no Lighthouse cleanup needed
      } catch (error) {
        logger.warn(`${url}: Accessibility analysis failed:`, error.message);
        results.accessibility = { error: error.message };
      }

      // 4. Core Web Vitals (fast - Puppeteer Performance API only)
      try {
        logger.info(`${url}: Running Core Web Vitals analysis...`);
        this.emitMetricProgress(sessionId, stage, 'Core Web Vitals', 'start');
        
        results.cwv = await this.runWithTimeout(
          competitiveCWVAnalyzer.analyzeCoreWebVitals(url),
          20000,  // Much faster without Lighthouse
          'CoreWebVitals'
        );
        scores.coreWebVitals = results.cwv?.score || 0;
        logger.info(`${url}: Core Web Vitals completed (score: ${scores.coreWebVitals})`);
        
        this.emitMetricProgress(sessionId, stage, 'Core Web Vitals', 'complete', scores.coreWebVitals);
        await this.cleanup(500);
      } catch (error) {
        logger.warn(`${url}: Core Web Vitals analysis failed:`, error.message);
        results.cwv = { error: error.message };
      }

      // 5. Performance Analysis (fast - Puppeteer resource metrics only)
      try {
        logger.info(`${url}: Running Performance analysis...`);
        this.emitMetricProgress(sessionId, stage, 'Performance', 'start');
        
        results.performance = await this.runWithTimeout(
          competitivePerformanceAnalyzer.analyzePerformance(url),
          20000,  // Much faster without Lighthouse
          'Performance'
        );
        // Performance analyzer returns performanceScore at top level
        scores.performance = results.performance?.performanceScore || 
                           results.performance?.desktop?.performanceScore || 
                           results.performance?.mobile?.performanceScore || 
                           0;
        logger.info(`${url}: Performance completed (score: ${scores.performance})`);
        
        this.emitMetricProgress(sessionId, stage, 'Performance', 'complete', scores.performance);
        await this.cleanup(500); // Shorter delay - no Lighthouse
      } catch (error) {
        logger.warn(`${url}: Performance analysis failed:`, error.message);
        results.performance = { error: error.message };
      }

      // Calculate overall score (only from successful analyzers)
      const successfulScores = Object.values(scores).filter(s => s > 0);
      const overallScore = successfulScores.length > 0
        ? roundTo(successfulScores.reduce((sum, s) => sum + s, 0) / successfulScores.length, 0)
        : 0;

      scores.overall = overallScore;

      return {
        scores,
        details: {
          seo: results.seo && !results.seo.error ? this.extractSEODetails(results.seo) : null,
          performance: results.performance && !results.performance.error ? this.extractPerfDetails(results.performance) : null,
          accessibility: scores.accessibility,
          security: scores.security,
          coreWebVitals: results.cwv && !results.cwv.error ? this.extractCWVDetails(results.cwv) : null
        },
        grade: this.getGrade(overallScore),
        analysisWarnings: this.getAnalysisWarnings(results),
        url: url // ADD URL TO RESPONSE
      };

    } catch (error) {
      logger.error(`Failed to analyze ${url}:`, error);
      return {
        scores: { seo: 0, performance: 0, accessibility: 0, security: 0, coreWebVitals: 0, overall: 0 },
        details: null,
        grade: 'F',
        error: error.message,
        analysisWarnings: ['Complete analysis failure']
      };
    }
  }

  /**
   * Run analyzer with timeout protection
   * @private
   */
  async runWithTimeout(promise, timeout, analyzerName) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${analyzerName} timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Cleanup delay to allow browser resources to be released
   * @private
   */
  async cleanup(delayMs) {
    logger.debug(`Cleanup delay: ${delayMs}ms`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    // Hint to garbage collector (doesn't force it, just suggests)
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get warnings about failed analyzers
   * @private
   */
  getAnalysisWarnings(results) {
    const warnings = [];
    
    if (results.seo?.error) warnings.push(`SEO analysis failed: ${results.seo.error}`);
    if (results.security?.error) warnings.push(`Security analysis failed: ${results.security.error}`);
    if (results.accessibility?.error) warnings.push(`Accessibility analysis failed: ${results.accessibility.error}`);
    if (results.cwv?.error) warnings.push(`Core Web Vitals analysis failed: ${results.cwv.error}`);
    if (results.performance?.error) warnings.push(`Performance analysis failed: ${results.performance.error}`);
    
    return warnings;
  }

  /**
   * Extract key SEO details for comparison
   * @private
   */
  extractSEODetails(seoData) {
    return {
      metaTags: seoData.results?.metaTags?.score || 0,
      headings: seoData.results?.headings?.score || 0,
      content: seoData.results?.content?.score || 0,
      images: seoData.results?.images?.score || 0,
      links: seoData.results?.links?.score || 0
    };
  }

  /**
   * Extract key performance details
   * @private
   */
  extractPerfDetails(perfData) {
    return {
      desktop: perfData.desktop?.performanceScore || 0,
      mobile: perfData.mobile?.performanceScore || 0,
      loadTime: perfData.desktop?.metrics?.['first-contentful-paint'] || 'N/A',
      resources: perfData.resources?.summary?.totalResources || 0
    };
  }

  /**
   * Extract CWV details
   * @private
   */
  extractCWVDetails(cwvData) {
    return {
      lcp: cwvData.mobile?.lcp?.rating || 'unknown',
      inp: cwvData.mobile?.inp?.rating || 'unknown',
      cls: cwvData.mobile?.cls?.rating || 'unknown',
      passed: cwvData.mobile?.passedCWV || false
    };
  }

  /**
   * Generate comparison matrix
   * @private
   */
  generateComparison(yourSite, competitors) {
    const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
    const comparison = {};

    metrics.forEach(metric => {
      const yourScore = yourSite.scores[metric];
      
      // Filter out failed scores (0 means analyzer failed)
      const validCompetitorScores = competitors
        .map(c => c.scores[metric])
        .filter(score => score > 0);
      
      // If your score is 0 (failed) or no valid competitor scores, mark as unavailable
      if (yourScore === 0 || validCompetitorScores.length === 0) {
        comparison[metric] = {
          yourScore: yourScore,
          avgCompetitor: 0,
          maxCompetitor: 0,
          diff: 0,
          percentile: 0,
          status: 'unavailable',
          failed: yourScore === 0
        };
        return;
      }
      
      const avgCompetitor = validCompetitorScores.reduce((a, b) => a + b, 0) / validCompetitorScores.length;
      const maxCompetitor = Math.max(...validCompetitorScores);
      
      comparison[metric] = {
        yourScore,
        avgCompetitor: roundTo(avgCompetitor, 0),
        maxCompetitor,
        diff: roundTo(yourScore - avgCompetitor, 0),
        percentile: this.calculatePercentile(yourScore, validCompetitorScores),
        status: yourScore > avgCompetitor ? 'winning' : yourScore === avgCompetitor ? 'tied' : 'losing',
        failed: false
      };
    });

    return comparison;
  }

  /**
   * Calculate rankings (1st place = best)
   * @private
   */
  calculateRankings(yourSite, competitors) {
    const allSites = [yourSite, ...competitors];
    const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals', 'overall'];
    const rankings = {};

    metrics.forEach(metric => {
      // Log all site scores for this metric
      logger.info(`\n🔍 Calculating rankings for ${metric}:`);
      allSites.forEach((site, idx) => {
        logger.info(`   Site ${idx}: ${site.url} - ${metric} score = ${site.scores[metric]}`);
      });
      
      // Filter out sites with failed analyzers (score = 0) EXCEPT for overall
      const validSites = metric === 'overall' 
        ? allSites // Overall score is already calculated from working analyzers
        : allSites.filter(site => site.scores[metric] > 0);
      
      logger.info(`   Valid sites after filtering (score > 0): ${validSites.length}`);
      
      // If no valid sites (all failed), mark as unavailable
      if (validSites.length === 0) {
        logger.info(`⚠️ All sites failed for ${metric} - marking as unavailable`);
        rankings[metric] = {
          rank: 0,
          total: 0,
          position: 'N/A',
          medal: '',
          failed: true
        };
        return;
      }
      
      // Sort valid sites by score (descending)
      const sorted = validSites
        .map(site => ({ 
          site, 
          score: site.scores[metric], 
          isYourSite: site === yourSite 
        }))
        .sort((a, b) => b.score - a.score);

      // Find your ranking
      const yourRanking = sorted.findIndex(item => item.isYourSite);
      const totalSites = sorted.length;
      
      // If your site was filtered out (score = 0), mark as failed
      if (yourRanking === -1) {
        logger.info(`⚠️ Your site failed ${metric} (score=0), but ${totalSites} competitors succeeded`);
        rankings[metric] = {
          rank: 0,
          total: totalSites,
          position: `Failed`,
          medal: '❌',
          failed: true
        };
        return;
      }

      const actualRank = yourRanking + 1;
      logger.info(`✅ ${metric} ranking: ${actualRank}/${totalSites}`);
      rankings[metric] = {
        rank: actualRank,
        total: totalSites,
        position: `${actualRank}/${totalSites}`,
        medal: actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : actualRank === 3 ? '🥉' : '',
        failed: false
      };
    });

    logger.info('📊 Final rankings object:', JSON.stringify(rankings, null, 2));
    return rankings;
  }

  /**
   * Calculate percentile rank
   * @private
   */
  calculatePercentile(yourScore, competitorScores) {
    const allScores = [...competitorScores, yourScore].sort((a, b) => a - b);
    const rank = allScores.indexOf(yourScore) + 1;
    return roundTo((rank / allScores.length) * 100, 0);
  }

  /**
   * Generate actionable insights
   * @private
   */
  generateInsights(yourSite, competitors) {
    const insights = [];
    const avgScores = {
      seo: roundTo(competitors.reduce((sum, c) => sum + c.scores.seo, 0) / competitors.length, 0),
      performance: roundTo(competitors.reduce((sum, c) => sum + c.scores.performance, 0) / competitors.length, 0),
      accessibility: roundTo(competitors.reduce((sum, c) => sum + c.scores.accessibility, 0) / competitors.length, 0),
      security: roundTo(competitors.reduce((sum, c) => sum + c.scores.security, 0) / competitors.length, 0),
      coreWebVitals: roundTo(competitors.reduce((sum, c) => sum + c.scores.coreWebVitals, 0) / competitors.length, 0)
    };

    // Overall performance
    if (yourSite.scores.overall > avgScores.seo + avgScores.performance + avgScores.accessibility + avgScores.security + avgScores.coreWebVitals) {
      insights.push({
        type: 'success',
        category: 'Overall',
        message: '🎉 You\'re outperforming the competition!',
        detail: `Your overall score is above the competitive average`
      });
    } else {
      insights.push({
        type: 'warning',
        category: 'Overall',
        message: '⚠️ Competitors are ahead',
        detail: `Focus on areas where you're falling behind to gain competitive advantage`
      });
    }

    // SEO insights
    if (yourSite.scores.seo < avgScores.seo) {
      insights.push({
        type: 'critical',
        category: 'SEO',
        message: '❌ Losing SEO battle',
        detail: `Your SEO score (${yourSite.scores.seo}) is below competitor average (${avgScores.seo}). This hurts organic visibility.`
      });
    }

    // Core Web Vitals insights
    if (yourSite.scores.coreWebVitals < avgScores.coreWebVitals) {
      insights.push({
        type: 'critical',
        category: 'Core Web Vitals',
        message: '⚠️ Google rankings at risk',
        detail: `Competitors have better Core Web Vitals (${avgScores.coreWebVitals} vs your ${yourSite.scores.coreWebVitals}). Google may rank them higher.`
      });
    }

    // Performance insights
    if (yourSite.scores.performance < avgScores.performance) {
      insights.push({
        type: 'warning',
        category: 'Performance',
        message: '🐌 Slower than competitors',
        detail: `Users may choose faster competitor sites. Average competitor performance: ${avgScores.performance}`
      });
    }

    // Security insights
    if (yourSite.scores.security < avgScores.security) {
      insights.push({
        type: 'warning',
        category: 'Security',
        message: '🔓 Security gap detected',
        detail: `Competitors have stronger security measures. This affects user trust.`
      });
    }

    return insights;
  }

  /**
   * Generate competitive recommendations
   * @private
   */
  generateCompetitiveRecommendations(yourSite, competitors) {
    const recommendations = [];

    // Find areas where you're significantly behind
    const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
    metrics.forEach(metric => {
      const yourScore = yourSite.scores[metric];
      const maxCompetitor = Math.max(...competitors.map(c => c.scores[metric]));
      const gap = maxCompetitor - yourScore;

      if (gap > 20) {
        recommendations.push({
          priority: 'high',
          metric: metric.toUpperCase(),
          gap: gap,
          recommendation: `Close the ${gap}-point gap in ${metric}. Top competitor scores ${maxCompetitor} vs your ${yourScore}.`,
          impact: 'Closing this gap could help you outrank competitors'
        });
      } else if (gap > 10) {
        recommendations.push({
          priority: 'medium',
          metric: metric.toUpperCase(),
          gap: gap,
          recommendation: `Small ${gap}-point improvement needed in ${metric}.`,
          impact: 'Quick wins to match competition'
        });
      }
    });

    // Sort by gap size (biggest gaps first)
    recommendations.sort((a, b) => b.gap - a.gap);

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Get letter grade from score
   * @private
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }
}

module.exports = new CompetitiveAnalysisService();
