param(
  [int]$Port = 8123
)

$baseUrl = "http://127.0.0.1:$Port/"
$states = @(
  @("Empty", $baseUrl, "No uploaded track results; mix empty state visible; copy report disabled."),
  @("Voice result", "$baseUrl`?preview=voice", "Voice tab active; voice result visible; copy report enabled."),
  @("BGM result", "$baseUrl`?preview=bgm", "BGM tab active; preview-bgm.wav visible; copy report enabled."),
  @("Both results", "$baseUrl`?preview=both", "Voice and BGM data present; mix section visible; copy report enabled."),
  @("Voice error", "$baseUrl`?preview=error-voice", "Voice tab active; error state visible; copy report disabled."),
  @("BGM error", "$baseUrl`?preview=error-bgm", "BGM tab active; error state visible; copy report disabled."),
  @("Loading", "$baseUrl`?preview=loading", "Loading overlay visible; no completed report treated as ready.")
)

Write-Host "Manual preview smoke check"
Write-Host ""
Write-Host "Start server first:"
Write-Host "  .\scripts\serve.ps1"
Write-Host ""
Write-Host "Recommended mobile viewport: 390x844"
Write-Host ""
Write-Host "Preview URLs:"

foreach ($state in $states) {
  Write-Host "- $($state[0]): $($state[1])"
  Write-Host "  Check: $($state[2])"
}

Write-Host ""
Write-Host "This command only lists manual check targets. It does not automate browser UI verification."
