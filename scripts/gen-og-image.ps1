# One-off asset generator — run manually, not part of the build:
#   powershell -ExecutionPolicy Bypass -File scripts/gen-og-image.ps1
# Produces public/og-image.png (1200x630) for social link previews: a real
# Laroche jewelry photograph, darkened for legibility, with a gold glow behind
# the centered LAROCHE BIJOUX wordmark and a French tagline. Swap $sourceImage
# to re-cut it from a different brand photo.

Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot ".."
$sourceImage = Join-Path $root "public\images\1785265197468.png" # sapphire & diamond necklace, dark
$outPath = Join-Path $root "public\og-image.png"

$width = 1200
$height = 630
$gold = [System.Drawing.Color]::FromArgb(255, 212, 175, 55)

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# 1) base photo, scaled to COVER the 1200x630 frame, centered
$src = [System.Drawing.Image]::FromFile($sourceImage)
$scale = [Math]::Max($width / $src.Width, $height / $src.Height)
$drawW = $src.Width * $scale
$drawH = $src.Height * $scale
$offX = ($width - $drawW) / 2
$offY = ($height - $drawH) / 2
$g.DrawImage($src, $offX, $offY, $drawW, $drawH)

# 2) global dark scrim so the wordmark reads over any part of the photo
$scrim = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 8, 8, 8))
$g.FillRectangle($scrim, 0, 0, $width, $height)

# 3) stronger gradient toward the bottom for the tagline band
$gradRect = New-Object System.Drawing.Rectangle(0, 330, $width, 300)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $gradRect,
  [System.Drawing.Color]::FromArgb(0, 8, 8, 8),
  [System.Drawing.Color]::FromArgb(205, 8, 8, 8),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillRectangle($grad, $gradRect)

# 4) soft gold radial glow behind the wordmark
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(($width / 2) - 360, ($height / 2) - 300, 720, 560)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(90, 212, 175, 55)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 212, 175, 55))
$g.FillPath($glowBrush, $glowPath)

# 5) wordmark + gold subtitle + tagline
$wordmarkFont = New-Object System.Drawing.Font("Georgia", 66, [System.Drawing.FontStyle]::Regular)
$subFont = New-Object System.Drawing.Font("Georgia", 21, [System.Drawing.FontStyle]::Regular)
$taglineFont = New-Object System.Drawing.Font("Georgia", 22, [System.Drawing.FontStyle]::Italic)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$goldBrush = New-Object System.Drawing.SolidBrush($gold)
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 235, 230, 220))

$center = New-Object System.Drawing.StringFormat
$center.Alignment = [System.Drawing.StringAlignment]::Center

$g.DrawString("LAROCHE", $wordmarkFont, $whiteBrush, [System.Drawing.RectangleF]::new(0, 232, $width, 100), $center)
$g.DrawString("B I J O U X", $subFont, $goldBrush, [System.Drawing.RectangleF]::new(0, 330, $width, 40), $center)

# thin gold rule between wordmark and tagline
$pen = New-Object System.Drawing.Pen($gold, 1.5)
$g.DrawLine($pen, ($width / 2) - 70, 388, ($width / 2) + 70, 388)

$g.DrawString("Bijouterie & Horlogerie de Luxe - Livraison 69 wilayas", $taglineFont, $mutedBrush, [System.Drawing.RectangleF]::new(0, 545, $width, 40), $center)

$bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$src.Dispose()
$g.Dispose()
$bitmap.Dispose()
Write-Host "Wrote $outPath"