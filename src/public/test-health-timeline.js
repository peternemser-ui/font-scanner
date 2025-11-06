/**
 * Health Timeline Integration Test
 * Quick test to verify the timeline system works end-to-end
 */

console.log('🧪 Starting Health Timeline Integration Test...\n');

// Test 1: HealthTimeline Class
console.log('Test 1: HealthTimeline Class');
try {
  if (typeof healthTimeline === 'undefined') {
    throw new Error('healthTimeline not found!');
  }
  console.log('✅ HealthTimeline singleton exists');
  console.log('   History length:', healthTimeline.history.length);
  console.log('   Storage key:', healthTimeline.storageKey);
} catch (error) {
  console.error('❌ HealthTimeline test failed:', error.message);
}

// Test 2: TimelineVisualizer Class
console.log('\nTest 2: TimelineVisualizer Class');
try {
  if (typeof timelineVisualizer === 'undefined') {
    throw new Error('timelineVisualizer not found!');
  }
  console.log('✅ TimelineVisualizer singleton exists');
  console.log('   Color palette:', Object.keys(timelineVisualizer.colors).length, 'colors');
} catch (error) {
  console.error('❌ TimelineVisualizer test failed:', error.message);
}

// Test 3: Add Sample Scan
console.log('\nTest 3: Add Sample Scan');
try {
  const sampleResults = {
    executiveSummary: {
      overallScore: 85
    },
    lighthouse: {
      categories: {
        performance: { score: 0.88 },
        accessibility: { score: 0.92 },
        seo: { score: 0.86 }
      }
    },
    fonts: {
      summary: {
        totalFonts: 4,
        totalSize: 120000,
        systemFonts: 1
      }
    }
  };
  
  const scan = healthTimeline.addScan('https://test.example.com', sampleResults);
  console.log('✅ Sample scan added successfully');
  console.log('   Scan ID:', scan.id);
  console.log('   Overall score:', scan.scores.overall);
  console.log('   Performance score:', scan.scores.performance);
} catch (error) {
  console.error('❌ Add scan test failed:', error.message);
}

// Test 4: Create Visualizations
console.log('\nTest 4: Create Visualizations');
try {
  const history = healthTimeline.getUrlHistory('https://test.example.com', 5);
  
  if (history.length > 0) {
    // Test timeline overview
    const overview = timelineVisualizer.createTimelineOverview(history, 3);
    console.log('✅ Timeline overview created');
    console.log('   Element type:', overview.tagName);
    console.log('   Has content:', overview.children.length > 0);
    
    // Test trend chart
    if (history.length >= 2) {
      const trendChart = timelineVisualizer.createTrendChart(history, ['overall', 'performance']);
      console.log('✅ Trend chart created');
      console.log('   Element type:', trendChart.tagName);
      
      // Test comparison panel
      const comparisonPanel = timelineVisualizer.createComparisonPanel(history[0], history[1]);
      console.log('✅ Comparison panel created');
      console.log('   Element type:', comparisonPanel.tagName);
    }
  } else {
    console.log('⚠️ No history found for visualization tests');
  }
} catch (error) {
  console.error('❌ Visualization test failed:', error.message);
}

// Test 5: Score Extraction
console.log('\nTest 5: Score Extraction');
try {
  const testResults = {
    lighthouse: {
      categories: {
        performance: { score: 0.75 },
        accessibility: { score: 0.88 }
      }
    }
  };
  
  const scores = healthTimeline.extractScores(testResults);
  console.log('✅ Scores extracted successfully');
  console.log('   Performance:', scores.performance);
  console.log('   Accessibility:', scores.accessibility);
  
  if (scores.performance === 75 && scores.accessibility === 88) {
    console.log('✅ Score values are correct');
  } else {
    console.error('❌ Score values incorrect!');
  }
} catch (error) {
  console.error('❌ Score extraction test failed:', error.message);
}

// Test 6: Improvement Calculation
console.log('\nTest 6: Improvement Calculation');
try {
  const current = {
    scores: { overall: 85, performance: 88 },
    metrics: { lcp: 2200 }
  };
  const previous = {
    scores: { overall: 72, performance: 75 },
    metrics: { lcp: 2800 }
  };
  
  const improvements = healthTimeline.calculateImprovement(current, previous);
  console.log('✅ Improvements calculated');
  console.log('   Overall: +' + improvements.overall.diff, '(' + improvements.overall.percentChange + '%)');
  console.log('   Performance: +' + improvements.performance.diff, '(' + improvements.performance.percentChange + '%)');
  console.log('   LCP: ' + improvements.metric_lcp.diff + 'ms (improved:', improvements.metric_lcp.improved + ')');
} catch (error) {
  console.error('❌ Improvement calculation test failed:', error.message);
}

// Test 7: Export/Import
console.log('\nTest 7: Export/Import');
try {
  const exported = healthTimeline.exportHistory();
  console.log('✅ History exported');
  console.log('   Data length:', exported.length, 'bytes');
  
  if (exported.length > 0) {
    const imported = healthTimeline.importHistory(exported);
    console.log('✅ History imported:', imported ? 'success' : 'failed');
  }
} catch (error) {
  console.error('❌ Export/import test failed:', error.message);
}

// Test 8: CSS Classes Exist
console.log('\nTest 8: CSS Classes Loaded');
try {
  const testDiv = document.createElement('div');
  testDiv.className = 'health-timeline-container';
  document.body.appendChild(testDiv);
  
  const styles = window.getComputedStyle(testDiv);
  const hasStyles = styles.padding !== '0px';
  
  console.log(hasStyles ? '✅ CSS loaded correctly' : '⚠️ CSS may not be loaded');
  console.log('   Padding:', styles.padding);
  
  document.body.removeChild(testDiv);
} catch (error) {
  console.error('❌ CSS test failed:', error.message);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('🎉 Health Timeline Integration Tests Complete!');
console.log('='.repeat(50));
console.log('\nTo test in production:');
console.log('1. Open http://localhost:3000');
console.log('2. Run a scan on any website');
console.log('3. Check for timeline section after executive summary');
console.log('4. Run another scan to see comparison panel');
console.log('\nOr visit the demo:');
console.log('http://localhost:3000/health-timeline-demo.html');
console.log('\n');
