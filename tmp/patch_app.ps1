$path = "src/App.jsx"
$content = Get-Content $path -Raw

# Replace context
$content = $content -replace '\{ dependencias, series, subseries \}', '{ dependencias, series, subseries, trdRecords }'

# Replace .then(data => { with .then(async data => { and add logging
$content = $content -replace '\.then\(data => \{', '.then(async data => { console.log("🤖 Orianna Response:", data);'

# Replace executeAgentActions(data.actions); with await executeAgentActions(data.actions);
$content = $content -replace 'executeAgentActions\(data\.actions\);', 'await executeAgentActions(data.actions);'

set-content $path $content
Write-Host "App.jsx updated successfully."
