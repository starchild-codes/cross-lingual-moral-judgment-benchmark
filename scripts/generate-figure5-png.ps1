$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Root = (Get-Location).Path
$OutDir = Join-Path $Root "results\figures"
$DataFile = Join-Path $OutDir "data\figure5_foundation_transitions.csv"
$Rows = Import-Csv $DataFile

$Foundations = @("Care/Harm","Loyalty/Betrayal","Authority/Subversion","Fairness/Cheating","Sanctity/Degradation")
$Models = @("chatgpt","claude","gemini_flash","gemini_pro")

function Short-Foundation($value) {
  switch ($value) {
    "Care/Harm" { "Care" }
    "Loyalty/Betrayal" { "Loyalty" }
    "Authority/Subversion" { "Authority" }
    "Fairness/Cheating" { "Fairness" }
    "Sanctity/Degradation" { "Sanctity" }
    default { $value }
  }
}

function Sequential-Blue($value) {
  $t = [Math]::Max(0, [Math]::Min(1, [double]$value))
  $low = @(239,246,255)
  $high = @(30,64,175)
  return [System.Drawing.Color]::FromArgb(
    [int]($low[0] + ($high[0] - $low[0]) * $t),
    [int]($low[1] + ($high[1] - $low[1]) * $t),
    [int]($low[2] + ($high[2] - $low[2]) * $t)
  )
}

function Draw-Text($g, $text, $x, $y, $size = 11, $bold = $false, $align = "Near", $color = [System.Drawing.Color]::Black) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $font = New-Object System.Drawing.Font "Arial", $size, $style, ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush $color
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $g.DrawString([string]$text, $font, $brush, [single]$x, [single]$y, $format)
  $font.Dispose()
  $brush.Dispose()
  $format.Dispose()
}

$bmp = New-Object System.Drawing.Bitmap 1500, 1080
$bmp.SetResolution(300, 300)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::White)

Draw-Text $g "Figure 5. Designed-to-invoked moral foundation transitions by source model." 60 24 24 $true
Draw-Text $g "Rows are designed foundations; columns are coded foundations. Cell shade is row percentage; numbers are counts." 60 58 15 $false "Near" ([System.Drawing.ColorTranslator]::FromHtml("#374151"))

$PanelOrigins = @(
  @(72, 145),
  @(790, 145),
  @(72, 620),
  @(790, 620)
)
$LeftPad = 155
$TopPad = 92
$Cell = 62

for ($mi = 0; $mi -lt $Models.Count; $mi++) {
  $model = $Models[$mi]
  $originX = $PanelOrigins[$mi][0]
  $originY = $PanelOrigins[$mi][1]
  Draw-Text $g $model $originX ($originY - 48) 18 $true
  Draw-Text $g "Invoked foundation" ($originX + $LeftPad + 95) ($originY - 2) 13
  Draw-Text $g "Designed" ($originX + 4) ($originY + $TopPad + 145) 13

  for ($ci = 0; $ci -lt $Foundations.Count; $ci++) {
    Draw-Text $g (Short-Foundation $Foundations[$ci]) ($originX + $LeftPad + $ci * $Cell + 4) ($originY + 42) 11
  }

  for ($ri = 0; $ri -lt $Foundations.Count; $ri++) {
    $designed = $Foundations[$ri]
    Draw-Text $g (Short-Foundation $designed) ($originX + $LeftPad - 82) ($originY + $TopPad + $ri * $Cell + 20) 12
    for ($ci = 0; $ci -lt $Foundations.Count; $ci++) {
      $invoked = $Foundations[$ci]
      $cellRow = $Rows | Where-Object { $_.model_key -eq $model -and $_.designed_foundation -eq $designed -and $_.invoked_foundation -eq $invoked } | Select-Object -First 1
      $count = if ($null -eq $cellRow) { 0 } else { [int]$cellRow.count }
      $pct = if ($null -eq $cellRow -or [string]::IsNullOrWhiteSpace($cellRow.row_percentage)) { 0 } else { [double]$cellRow.row_percentage }
      $x = $originX + $LeftPad + $ci * $Cell
      $y = $originY + $TopPad + $ri * $Cell
      $brush = New-Object System.Drawing.SolidBrush (Sequential-Blue $pct)
      $g.FillRectangle($brush, $x, $y, $Cell - 3, $Cell - 3)
      $brush.Dispose()
      $textColor = if ($pct -gt 0.55) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::Black }
      Draw-Text $g ([string]$count) ($x + 24) ($y + 20) 15 ($count -gt 0) "Near" $textColor
    }
  }
}

$legendX = 1240
$legendY = 82
Draw-Text $g "Row %" $legendX ($legendY - 20) 12 $true
for ($i = 0; $i -le 5; $i++) {
  $brush = New-Object System.Drawing.SolidBrush (Sequential-Blue ($i / 5))
  $g.FillRectangle($brush, ($legendX + $i * 32), $legendY, 32, 16)
  $brush.Dispose()
}
Draw-Text $g "0%" $legendX ($legendY + 24) 11
Draw-Text $g "100%" ($legendX + 168) ($legendY + 24) 11

$bmp.Save((Join-Path $OutDir "figure5_foundation_transition_heatmap.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Host "Wrote Figure 5 PNG to $OutDir"
