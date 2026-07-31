param(
  [int]$Port = 8123
)

$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:$Port/"

Write-Host "Starting local server at $baseUrl"
Write-Host "Press Ctrl+C to stop."
python -m http.server $Port --bind 127.0.0.1
