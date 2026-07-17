# One-off asset generator — run manually, not part of the build.
# Produces public/og-image.png (1200x630): dark brand background, a soft
# gold radial glow (PathGradientBrush — plain concentric circles band
# visibly at this size), and the Laroche Bijoux wordmark.

Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630
$bg = [System.Drawing.Color]::FromArgb(255, 13, 13, 13)
$gold = [System.Drawing.Color]::FromArgb(255, 212, 175, 55)
$goldSoft = [System.Drawing.Color]::FromArgb(0, 212, 175, 55)

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$g.Clear($bg)

# radial glow via PathGradientBrush centered on the composition
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(($width / 2) - 420, ($height / 2) - 420, 840, 840)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 212, 175, 55)
$glowBrush.SurroundColors = @($goldSoft)
$g.FillPath($glowBrush, $glowPath)

$wordmarkFont = New-Object System.Drawing.Font("Georgia", 64, [System.Drawing.FontStyle]::Regular)
$subFont = New-Object System.Drawing.Font("Georgia", 20, [System.Drawing.FontStyle]::Regular)
$goldBrush = New-Object System.Drawing.SolidBrush($gold)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center

$g.DrawString("LAROCHE", $wordmarkFont, $whiteBrush, [System.Drawing.RectangleF]::new(0, 260, $width, 90), $format)
$g.DrawString("B I J O U X", $subFont, $goldBrush, [System.Drawing.RectangleF]::new(0, 350, $width, 40), $format)

$outPath = Join-Path $PSScriptRoot "..\public\og-image.png"
$bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bitmap.Dispose()

Write-Host "Wrote $outPath"
