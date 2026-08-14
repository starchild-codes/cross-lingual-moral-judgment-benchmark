$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Root = (Get-Location).Path
$OutDir = Join-Path $Root "results\figures"
$DataDir = Join-Path $OutDir "data"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Palette = @(
  [System.Drawing.ColorTranslator]::FromHtml("#0072B2"),
  [System.Drawing.ColorTranslator]::FromHtml("#E69F00"),
  [System.Drawing.ColorTranslator]::FromHtml("#009E73"),
  [System.Drawing.ColorTranslator]::FromHtml("#CC79A7"),
  [System.Drawing.ColorTranslator]::FromHtml("#56B4E9")
)
$Languages = @("hi","bn","ta","es","ja","ar")
$Models = @("chatgpt","claude","gemini_flash")
$Foundations = @("Care/Harm","Loyalty/Betrayal","Authority/Subversion","Fairness/Cheating","Sanctity/Degradation")

function New-Canvas($title) {
  $bmp = New-Object System.Drawing.Bitmap 1200, 760
  $bmp.SetResolution(300, 300)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font "Arial", 18, ([System.Drawing.FontStyle]::Bold)
  $g.DrawString($title, $font, [System.Drawing.Brushes]::Black, 55, 26)
  $font.Dispose()
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Canvas($canvas, $name) {
  $canvas.Bitmap.Save((Join-Path $OutDir "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function Draw-Text($g, $text, $x, $y, $size = 11, $align = "Near") {
  $font = New-Object System.Drawing.Font "Arial", $size
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $g.DrawString([string]$text, $font, [System.Drawing.Brushes]::Black, [single]$x, [single]$y, $format)
  $font.Dispose()
  $format.Dispose()
}

function Draw-GroupedBars($csv, $name, $title) {
  $rows = Import-Csv (Join-Path $DataDir $csv)
  $canvas = New-Canvas $title
  $g = $canvas.Graphics
  $left = 120; $top = 90; $plotW = 820; $plotH = 470
  $values = $rows | ForEach-Object { [double]$_.mean_diff }
  $maxAbs = [Math]::Max(0.25, (($values | ForEach-Object { [Math]::Abs($_) } | Measure-Object -Maximum).Maximum))
  $yMax = [Math]::Ceiling($maxAbs * 4) / 4
  function Y($v) { $top + (($yMax - $v) / (2 * $yMax)) * $plotH }
  $zeroY = Y 0
  $penZero = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80,80,80)), 1.5
  $penZero.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  $g.DrawLine($penZero, $left, $zeroY, $left + $plotW, $zeroY)
  $groupW = $plotW / $Languages.Count
  $barW = 28
  for ($li=0; $li -lt $Languages.Count; $li++) {
    $lang = $Languages[$li]
    $cx = $left + $li * $groupW + $groupW / 2
    Draw-Text $g $lang ($cx - 8) ($top + $plotH + 20) 12
    for ($mi=0; $mi -lt $Models.Count; $mi++) {
      $model = $Models[$mi]
      $row = $rows | Where-Object { $_.language -eq $lang -and $_.model_key -eq $model } | Select-Object -First 1
      if ($null -eq $row) { continue }
      $value = [double]$row.mean_diff
      $lo = [double]$row.ci_lower
      $hi = [double]$row.ci_upper
      $x = $cx + ($mi - 1) * ($barW + 8) - $barW / 2
      $barY = [Math]::Min((Y $value), $zeroY)
      $barH = [Math]::Abs((Y $value) - $zeroY)
      $brush = New-Object System.Drawing.SolidBrush $Palette[$mi]
      $g.FillRectangle($brush, [single]$x, [single]$barY, [single]$barW, [single]([Math]::Max(1,$barH)))
      $g.DrawLine([System.Drawing.Pens]::Black, $x + $barW/2, (Y $lo), $x + $barW/2, (Y $hi))
      $brush.Dispose()
    }
  }
  for ($mi=0; $mi -lt $Models.Count; $mi++) {
    $brush = New-Object System.Drawing.SolidBrush $Palette[$mi]
    $g.FillRectangle($brush, 985, (105 + $mi*30), 18, 18)
    Draw-Text $g $Models[$mi] 1012 (102 + $mi*30) 11
    $brush.Dispose()
  }
  Save-Canvas $canvas $name
}

function HeatColor($value, $maxAbs) {
  $t = [Math]::Max(-1, [Math]::Min(1, $value / $maxAbs))
  $blue = @(44,123,182); $red = @(215,48,39); $white = @(247,247,247)
  if ($t -lt 0) { $a=$blue; $b=$white; $mix=[Math]::Abs($t) } else { $a=$white; $b=$red; $mix=$t }
  return [System.Drawing.Color]::FromArgb(
    [int]($a[0]+($b[0]-$a[0])*$mix),
    [int]($a[1]+($b[1]-$a[1])*$mix),
    [int]($a[2]+($b[2]-$a[2])*$mix)
  )
}

function Draw-Heatmap() {
  $rows = Import-Csv (Join-Path $DataDir "figure2_framing_heatmap.csv")
  $canvas = New-Canvas "Cultural adaptation effect on blameworthiness ratings by language and moral foundation."
  $g = $canvas.Graphics
  $left = 160; $top = 130; $cellW = 165; $cellH = 68
  $maxAbs = (($rows | ForEach-Object { [Math]::Abs([double]$_.mean_diff) } | Measure-Object -Maximum).Maximum)
  for ($ci=0; $ci -lt $Foundations.Count; $ci++) { Draw-Text $g ($Foundations[$ci].Split('/')[0]) ($left + $ci*$cellW + 35) ($top-30) 10 }
  for ($li=0; $li -lt $Languages.Count; $li++) {
    $lang = $Languages[$li]
    Draw-Text $g $lang ($left-35) ($top + $li*$cellH + 22) 12
    for ($ci=0; $ci -lt $Foundations.Count; $ci++) {
      $f = $Foundations[$ci]
      $vals = $rows | Where-Object { $_.language -eq $lang -and $_.mft_foundation -eq $f } | ForEach-Object { [double]$_.mean_diff }
      $mean = if ($vals.Count) { ($vals | Measure-Object -Average).Average } else { 0 }
      $brush = New-Object System.Drawing.SolidBrush (HeatColor $mean $maxAbs)
      $x = $left + $ci*$cellW; $y = $top + $li*$cellH
      $g.FillRectangle($brush, $x, $y, $cellW-4, $cellH-4)
      Draw-Text $g ([string]::Format("{0:N2}", $mean)) ($x+62) ($y+22) 12
      $brush.Dispose()
    }
  }
  Save-Canvas $canvas "figure2_framing_effect_heatmap"
}

function Draw-Divergence() {
  $rows = Import-Csv (Join-Path $DataDir "figure4_reference_divergence.csv")
  $canvas = New-Canvas "Mean divergence from Gemini Pro reference model by evaluated model and condition type."
  $g = $canvas.Graphics
  $left = 120; $top = 100; $plotW = 820; $plotH = 470
  $conditions = @("en_en","translation_reason_en","translation_reason_l2","adapted_reason_en","adapted_reason_l2")
  $max = (($rows | ForEach-Object { [double]$_.mean_absolute_difference } | Measure-Object -Maximum).Maximum) * 1.15
  function Y2($v) { $top + $plotH - ($v / $max) * $plotH }
  $groupW = $plotW / $Models.Count; $barW = 22
  for ($mi=0; $mi -lt $Models.Count; $mi++) {
    $model = $Models[$mi]; $cx = $left + $mi*$groupW + $groupW/2
    Draw-Text $g $model ($cx-50) ($top+$plotH+20) 12
    for ($ci=0; $ci -lt $conditions.Count; $ci++) {
      $row = $rows | Where-Object { $_.model_key -eq $model -and $_.condition_type -eq $conditions[$ci] } | Select-Object -First 1
      if ($null -eq $row) { continue }
      $value = [double]$row.mean_absolute_difference
      $x = $cx + ($ci-2)*($barW+5) - $barW/2
      $brush = New-Object System.Drawing.SolidBrush $Palette[$ci]
      $g.FillRectangle($brush, $x, (Y2 $value), $barW, $top+$plotH-(Y2 $value))
      $brush.Dispose()
    }
  }
  for ($ci=0; $ci -lt $conditions.Count; $ci++) {
    $brush = New-Object System.Drawing.SolidBrush $Palette[$ci]
    $g.FillRectangle($brush, 960, (105+$ci*30), 18, 18)
    Draw-Text $g $conditions[$ci] 987 (102+$ci*30) 10
    $brush.Dispose()
  }
  Save-Canvas $canvas "figure4_reference_model_divergence"
}

Draw-GroupedBars "figure1_language_effect_by_model.csv" "figure1_language_effect_by_model" "Mean blameworthiness rating shift by input language relative to English baseline."
Draw-Heatmap
Draw-GroupedBars "figure3_reasoning_effect_by_model.csv" "figure3_reasoning_language_effect_by_model" "Effect of reasoning language on blameworthiness ratings by language."
Draw-Divergence
Write-Host "Wrote PNG figures to $OutDir"
