/**
 * Icon Replacement Script
 * Replaces all emoji icons with minimalist alternatives across JavaScript files
 */

const fs = require('fs');
const path = require('path');

// Icon replacement mapping
const replacements = {
    // Document icons
    '📄': 'D', // Document
    '📊': 'C', // Chart
    '📈': 'U', // Up trend
    '📉': 'D', // Down trend
    
    // Performance icons
    '⚡': 'P', // Performance/Fast
    '🎯': 'T', // Target
    '🏆': 'W', // Winner/Trophy
    
    // Time icons
    '⏱️': '⧗', // Timer
    '⏳': '⧗', // Hourglass
    
    // Design/Style icons
    '🎨': 'Y', // stYle/CSS
    '🖼️': 'I', // Image
    '🖥️': 'D', // Desktop
    '📱': 'M', // Mobile
    '💻': 'C', // Computer/Code
    
    // Resource icons
    '📦': 'R', // Resources/Package
    
    // Status icons
    '✅': '✓',
    '⚠️': '~',
    '❌': '✗',
    
    // Priority icons
    '🔴': 'H', // High priority
    '🟡': 'M', // Medium priority
    '🔵': 'L', // Low priority
    '🚨': '!', // Alert/Critical
    
    // Info/Help icons
    '💡': 'ⓘ', // Info/Idea
    'ℹ️': 'ⓘ',
    
    // Web/Network icons
    '🌐': 'W', // World/Web
    '🔗': 'K', // Link
    '🔍': 'S', // Search
    
    // Security icons
    '🔒': '◈', // Lock/Security
    '🛡️': '◈', // Shield
    '🔐': '◈', // Locked with key
    
    // Other common icons
    '⭐': '*', // Star
    '❓': '?', // Question
    '🌍': 'W', // Globe
    '📍': '↕', // Location
    '💯': '100', // Perfect score
    '🔔': 'B', // Bell/Notification
    '📢': 'A', // Announcement
    '💬': 'Q', // Speech bubble
    '◀': '!', // Exclamation
    
    // Rocket and other
    '🚀': '→', // Rocket/Launch
    '✨': '*', // Sparkles
    '🎉': '!', // Celebration
    '👍': '+', // Thumbs up
    '👎': '-', // Thumbs down
    '♿': 'A', // Accessibility
    '🔁': '↻', // Repeat/Reload
};

// Files to update
const files = [
    'src/public/performance-script.js',
    'src/public/seo-script.js',
    'src/public/seo-visualizations.js',
    'src/public/accessibility-script.js',
    'src/public/security-script.js',
    'src/public/cwv-script.js',
    'src/public/competitive-script.js',
    'src/public/broken-links-script.js',
    'src/public/cro-script.js',
    'src/public/script.js',
    'src/public/dashboard-script.js',
    'src/public/pdf-payment-modal.js',
    'src/public/analyzer-loader.js',
    'src/public/nav-template.js',
    'src/public/health-timeline.js',
    'src/public/health-timeline-demo.js'
];

let totalReplacements = 0;
let filesUpdated = 0;

console.log('\n🔄 Starting icon replacement across all files...\n');

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${file}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fileReplacements = 0;
    
    // Replace each emoji
    Object.entries(replacements).forEach(([emoji, replacement]) => {
        const regex = new RegExp(emoji, 'g');
        const matches = content.match(regex);
        
        if (matches) {
            const count = matches.length;
            content = content.replace(regex, replacement);
            fileReplacements += count;
            
            if (count > 0) {
                console.log(`   ${emoji} → ${replacement} : ${count} instance(s)`);
            }
        }
    });
    
    if (fileReplacements > 0) {
        // Write updated content back to file
        fs.writeFileSync(filePath, content, 'utf8');
        filesUpdated++;
        totalReplacements += fileReplacements;
        console.log(`✅ Updated ${file}: ${fileReplacements} replacements\n`);
    } else {
        console.log(`⏭️  No changes needed: ${file}\n`);
    }
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Icon replacement complete!`);
console.log(`   Files updated: ${filesUpdated}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log('='.repeat(60) + '\n');
