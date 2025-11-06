# Icon Update Script - Replace ALL emoji icons with minimalist alternatives
# This script updates 800+ emoji icons across the entire application

Write-Host "Starting icon update process..." -ForegroundColor Cyan

# Define all icon replacements
$replacements = @{
    # Document/File icons
    '📄' = 'D'
    '📝' = 'E' # Edit
    
    # Chart/Analytics icons
    '📊' = 'C' # Chart
    '📈' = 'U' # Up/Growth
    '📉' = 'G' # Down/Decline
    
    # Performance icons
    '⚡' = 'P' # Performance (already partially done)
    '🚀' = '→' # Launch/Start (already partially done)
    
    # Target/Goal icons  
    '🎯' = 'T' # Target
    '🏆' = 'W' # Winner/Trophy
    
    # Time icons
    '⏱️' = '⧗' # Timer
    '⏳' = '⧗' # Hourglass
    
    # Design/Style icons
    '🎨' = 'Y' # stYle/CSS
    '🖼️' = 'I' # Image
    '🖥️' = 'D' # Desktop (already done)
    '📱' = 'M' # Mobile (already done)
    '💻' = 'C' # Computer/Code
    
    # Resource icons
    '📦' = 'R' # Resources/Package
    
    # Status icons (most already done)
    '✅' = '✓'
    '⚠️' = '~'
    '❌' = '✗'
    
    # Priority icons
    '🔴' = 'H' # High priority
    '🟡' = 'M' # Medium priority
    '🔵' = 'L' # Low priority
    '🚨' = '!' # Alert/Critical
    
    # Info/Help icons
    '💡' = 'ⓘ' # Info/Idea
    'ℹ️' = 'ⓘ' # Keep as-is
    
    # Web/Network icons
    '🌐' = 'W' # World/Web
    '🔗' = 'K' # Link
    '🔍' = 'S' # Search (already done in some places)
    
    # Security icons
    '🔒' = '◈' # Lock/Security (already done)
    '🛡️' = '◈' # Shield
    '🔐' = '◈' # Locked with key
    
    # Other common icons
    '⭐' = '*' # Star
    '❓' = '?' # Question
    '🌍' = 'W' # Globe
    '📍' = '↓' # Location
    '💯' = '100' # Perfect score
    '🔔' = 'B' # Bell/Notification
    '📢' = 'A' # Announcement
    '💬' = 'Q' # Comment/Chat
    '🗨️' = 'Q' # Speech bubble
    '❗' = '!' # Exclamation
    '🎭' = 'V' # Visual/Display
}

# Files to update
$files = @(
    'src\public\performance-script.js',
    'src\public\seo-script.js',
    'src\public\seo-visualizations.js',
    'src\public\accessibility-script.js',
    'src\public\security-script.js',
    'src\public\cwv-script.js',
    'src\public\competitive-script.js',
    'src\public\broken-links-script.js',
    'src\public\cro-script.js',
    'src\public\script.js',
    'src\public\dashboard-script.js',
    'src\public\pdf-payment-modal.js',
    'src\public\analyzer-loader.js',
    'src\public\nav-template.js',
    'src\public\health-timeline.js',
    'src\public\health-timeline-demo.js'
)

$totalReplacements = 0

foreach ($file in $files) {
    $filePath = Join-Path $PSScriptRoot $file
    
    if (Test-Path $filePath) {
        Write-Host "`nProcessing: $file" -ForegroundColor Yellow
        
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $originalContent = $content
        $fileReplacements = 0
        
        foreach ($emoji in $replacements.Keys) {
            $replacement = $replacements[$emoji]
            $count = ([regex]::Matches($content, [regex]::Escape($emoji))).Count
            
            if ($count -gt 0) {
                $content = $content -replace [regex]::Escape($emoji), $replacement
                $fileReplacements += $count
                Write-Host "  ✓ Replaced $count instances of $emoji → $replacement" -ForegroundColor Green
            }
        }
        
        if ($fileReplacements -gt 0) {
            Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
            $totalReplacements += $fileReplacements
            Write-Host "  📝 Updated $file ($fileReplacements replacements)" -ForegroundColor Cyan
        } else {
            Write-Host "  ⏭️  No changes needed" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️  File not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "`n✅ Icon update complete!" -ForegroundColor Green
Write-Host "Total replacements made: $totalReplacements" -ForegroundColor Cyan
Write-Host "`nPlease review the changes and test the application." -ForegroundColor Yellow
