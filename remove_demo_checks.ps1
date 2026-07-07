# PowerShell script to remove all isAllowedMockData references

$files = @(
    "src\hooks\useAnalytics.ts",
    "src\hooks\useDepartmentChat.ts",
    "src\hooks\useLiveMeeting.ts",
    "src\hooks\useNotesReminders.ts",
    "src\hooks\useSocket.ts",
    "src\hooks\useSupabaseApprovals.ts",
    "src\hooks\useSupabaseBypass.ts",
    "src\hooks\useSupabaseDocuments.ts",
    "src\hooks\useSupabaseEmergency.ts",
    "src\hooks\useSupabaseNotifications.ts",
    "src\hooks\useSupabaseRecentDocuments.ts",
    "src\hooks\useSupabaseTrackDocuments.ts",
    "src\hooks\useSupabaseUniversalSearch.ts",
    "src\components\approval\RecipientSelector.tsx",
    "src\components\dashboard\RoleDashboard.tsx",
    "src\pages\Documents.tsx",
    "src\pages\Profile.tsx",
    "src\services\LiveMeetingService.ts",
    "src\services\SocketChatService.ts"
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file"
        $content = Get-Content $fullPath -Raw
        
        # Remove import statement
        $content = $content -replace "import\s+\{[^}]*isAllowedMockData[^}]*\}\s+from\s+'[^']+';?\s*\n?", ""
        
        # Save
        Set-Content -Path $fullPath -Value $content -NoNewline
    }
}

Write-Host "Done!"
