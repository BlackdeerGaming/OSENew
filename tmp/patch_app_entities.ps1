$path = "src/App.jsx"
$content = Get-Content $path -Raw

# Update context to include userEntities as 'entidades'
$content = $content -replace '\{ dependencias, series, subseries, trdRecords \}', '{ dependencias, series, subseries, trdRecords, entidades: userEntities }'

set-content $path $content
Write-Host "App.jsx updated with entities context."
