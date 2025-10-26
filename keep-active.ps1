# Keep Active - Simulates coding work for 1 hour
# Creates files, writes code, moves mouse, and simulates development activity
# Automatically cleans up files when stopped

Write-Host "🚀 Starting 1-hour coding simulator..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop and clean up" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$endTime = $startTime.AddMinutes(60)
$iteration = 0

# Load Windows Forms for mouse simulation
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Create work directory
$workDir = ".\simulator-work"
if (-not (Test-Path $workDir)) {
    New-Item -ItemType Directory -Path $workDir | Out-Null
}

# Cleanup function
function Cleanup-Files {
    Write-Host "`n`n🧹 Cleaning up simulator files..." -ForegroundColor Yellow
    
    if (Test-Path $workDir) {
        $fileCount = (Get-ChildItem $workDir -File).Count
        Remove-Item -Path $workDir -Recurse -Force
        Write-Host "✅ Deleted $fileCount files and removed $workDir" -ForegroundColor Green
    }
    
    Write-Host "👋 Cleanup complete. Goodbye!" -ForegroundColor Cyan
    exit 0
}

# Register cleanup on Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Cleanup-Files
}

# Trap Ctrl+C
trap {
    Cleanup-Files
}

# Also handle regular script interruption
try {

# Code snippets to add
$codeSnippets = @(
    "// TODO: Implement feature",
    "const express = require('express');",
    "function processData(input) {",
    "  return input.map(item => item.value);",
    "}",
    "// Bug fix: Handle edge case",
    "async function fetchData(url) {",
    "  const response = await fetch(url);",
    "  return response.json();",
    "}",
    "// Add validation logic",
    "if (data && data.length > 0) {",
    "  console.log('Processing...');",
    "}",
    "// Performance optimization",
    "const memoize = (fn) => {",
    "  const cache = new Map();",
    "  return (...args) => {",
    "    const key = JSON.stringify(args);",
    "    if (cache.has(key)) return cache.get(key);",
    "    const result = fn(...args);",
    "    cache.set(key, result);",
    "    return result;",
    "  };",
    "};",
    "// Error handling",
    "try {",
    "  // Implementation here",
    "} catch (error) {",
    "  console.error('Error:', error);",
    "}",
    "// Update dependencies",
    "npm install lodash",
    "// Test coverage improvement",
    "describe('Component', () => {",
    "  it('should render correctly', () => {",
    "    expect(component).toBeDefined();",
    "  });",
    "});"
)

$fileTypes = @('.js', '.ts', '.jsx', '.tsx', '.css', '.html', '.md', '.json')
$currentFiles = @()

function Move-MouseRandomly {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $x = Get-Random -Minimum 100 -Maximum ($screen.Width - 100)
    $y = Get-Random -Minimum 100 -Maximum ($screen.Height - 100)
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
}

function Create-CodeFile {
    $fileExt = $fileTypes | Get-Random
    $fileName = "component_$(Get-Random -Minimum 1000 -Maximum 9999)$fileExt"
    $filePath = Join-Path $workDir $fileName
    
    $header = "// Generated at $(Get-Date -Format 'HH:mm:ss')`n// File: $fileName`n`n"
    Set-Content -Path $filePath -Value $header
    
    return $filePath
}

function Add-CodeToFile {
    param([string]$filePath)
    
    if (Test-Path $filePath) {
        $snippet = $codeSnippets | Get-Random
        Add-Content -Path $filePath -Value "`n$snippet"
        return $snippet
    }
    return $null
}

function Simulate-Typing {
    # Simulate key presses
    $wsh = New-Object -ComObject WScript.Shell
    $keys = @("{SCROLLLOCK}", "{NUMLOCK}{NUMLOCK}", "{CAPSLOCK}{CAPSLOCK}")
    $key = $keys | Get-Random
    $wsh.SendKeys($key)
}

Write-Host "Activity started at: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "Will run until: $($endTime.ToString('HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "Work directory: $workDir" -ForegroundColor Cyan
Write-Host "Files will be auto-deleted when stopped" -ForegroundColor Yellow
Write-Host ""

$filesCreated = 0
$linesWritten = 0

while ((Get-Date) -lt $endTime) {
    $iteration++
    $timeRemaining = ($endTime - (Get-Date)).TotalMinutes
    $timeElapsed = ((Get-Date) - $startTime).TotalMinutes
    
    # Update status every 5 iterations
    if ($iteration % 5 -eq 0) {
        Clear-Host
        Write-Host "Code Simulator Running (1 hour)" -ForegroundColor Green
        Write-Host "================================" -ForegroundColor Gray
        Write-Host "Elapsed:   $([math]::Round($timeElapsed, 1)) minutes" -ForegroundColor Yellow
        Write-Host "Remaining: $([math]::Round($timeRemaining, 1)) minutes" -ForegroundColor Cyan
        Write-Host "Files:     $filesCreated" -ForegroundColor Magenta
        Write-Host "Lines:     $linesWritten" -ForegroundColor White
        Write-Host ""
        $progress = [math]::Round(($timeElapsed / 60) * 100)
        $progressBar = "[" + ("=" * [math]::Floor($progress / 5)) + (" " * (20 - [math]::Floor($progress / 5))) + "]"
        Write-Host "$progressBar $progress%" -ForegroundColor Green
        Write-Host ""
        Write-Host "Press Ctrl+C to stop and cleanup" -ForegroundColor DarkGray
    }
        Write-Host "Elapsed:   $([math]::Round($timeElapsed, 1)) minutes" -ForegroundColor Yellow
        Write-Host "Remaining: $([math]::Round($timeRemaining, 1)) minutes" -ForegroundColor Cyan
        Write-Host "Files:     $filesCreated" -ForegroundColor Magenta
        Write-Host "Lines:     $linesWritten" -ForegroundColor White
        Write-Host ""
        $progress = [math]::Round(($timeElapsed / 30) * 100)
        $progressBar = "[" + ("=" * [math]::Floor($progress / 5)) + (" " * (20 - [math]::Floor($progress / 5))) + "]"
        Write-Host "$progressBar $progress%" -ForegroundColor Green
        Write-Host ""
        Write-Host "Press Ctrl+C to stop" -ForegroundColor DarkGray
    }
    
    # Decide what activity to perform
    $activityPattern = Get-Random -Minimum 1 -Maximum 100
    
    if ($activityPattern -le 30) {
        # 30% - Create new file
        $newFile = Create-CodeFile
        $currentFiles += $newFile
        $filesCreated++
        Write-Host "📄 Created: $(Split-Path $newFile -Leaf)" -ForegroundColor Green
    }
    elseif ($activityPattern -le 70 -and $currentFiles.Count -gt 0) {
        # 40% - Add code to existing file
        $file = $currentFiles | Get-Random
        $snippet = Add-CodeToFile -filePath $file
        if ($snippet) {
            $linesWritten += ($snippet -split "`n").Count
            Write-Host "✏️  Added code to: $(Split-Path $file -Leaf)" -ForegroundColor Cyan
        }
    }
    elseif ($activityPattern -le 85) {
        # 15% - Mouse movement
        Move-MouseRandomly
        Write-Host "🖱️  Mouse moved" -ForegroundColor Yellow
    }
    else {
        # 15% - Simulate typing
        Simulate-Typing
        Write-Host "⌨️  Typing simulated" -ForegroundColor Blue
    }
    
    # Vary the delay between actions
    $randomValue = Get-Random -Minimum 1 -Maximum 10
    if ($randomValue -le 5) {
        $delaySeconds = Get-Random -Minimum 2 -Maximum 4
    }
    elseif ($randomValue -le 8) {
        $delaySeconds = Get-Random -Minimum 4 -Maximum 7
    }
    else {
        $delaySeconds = Get-Random -Minimum 7 -Maximum 10
    }
    
    Start-Sleep -Seconds $delaySeconds
}

# Normal completion - cleanup and exit
Clear-Host
Write-Host ""
Write-Host "1-hour coding simulation complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Gray
Write-Host "Files created: $filesCreated" -ForegroundColor Magenta
Write-Host "Lines written: $linesWritten" -ForegroundColor White
Write-Host "Session ended at: $((Get-Date).ToString('HH:mm:ss'))" -ForegroundColor Cyan
Write-Host ""

# Cleanup files after normal completion
Cleanup-Files

} catch {
    # Handle any errors and cleanup
    Write-Host "`nError occurred: $_" -ForegroundColor Red
    Cleanup-Files
} finally {
    # Ensure cleanup always happens
    if (Test-Path $workDir) {
        Cleanup-Files
    }
}
