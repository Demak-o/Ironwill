# Dev-only: score every tile of every tileset variant for "seamless interior grass".
# A seamless interior tile has no near-white / near-black shore trim along its top and
# bottom edge rows. This is what found the INTERIOR list in src/arena.js.
Add-Type -AssemblyName System.Drawing
$root = 'D:\Code\IW\Ironwill\Assets\Terrain\Tileset'
$TILE = 48

foreach ($v in 1..2) {
    $img = New-Object System.Drawing.Bitmap("$root\Tilemap_color$v.png")
    Write-Output "--- Tilemap_color$v.png ($($img.Width)x$($img.Height)) ---"
    $rowsOut = @()
    for ($row = 0; $row -lt [int]($img.Height / $TILE); $row++) {
        $line = ''
        for ($col = 0; $col -lt [int]($img.Width / $TILE); $col++) {
            $trim = 0; $total = 0
            foreach ($yy in @(0, 1, ($TILE - 2), ($TILE - 1))) {
                for ($xx = 0; $xx -lt $TILE; $xx++) {
                    $c = $img.GetPixel(($col * $TILE) + $xx, ($row * $TILE) + $yy)
                    if ($c.A -lt 24) { $trim++; $total++; continue }
                    $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
                    if ($lum -gt 200 -or $lum -lt 60) { $trim++ }
                    $total++
                }
            }
            $score = [int](100 * $trim / [Math]::Max(1, $total))
            if ($score -le 6) { $line += ' .' } else { $line += (' {0,2}' -f $score) }
        }
        $rowsOut += ('row {0,2}: {1}' -f $row, $line)
    }
    $rowsOut | ForEach-Object { Write-Output $_ }
    $img.Dispose()
}

# Water-rock frames and foam frames, at a glance.
$wrPath = 'D:\Code\IW\Ironwill\Assets\Terrain\Decorations\Rocks in the Water\Water Rocks_01.png'
$wr = New-Object System.Drawing.Bitmap($wrPath)
Write-Output "Water Rocks_01: $($wr.Width)x$($wr.Height) -> 16 frames of $($wr.Height)px"
$foamPath = "$root\Water Foam.png"
$foam = New-Object System.Drawing.Bitmap($foamPath)
Write-Output "Water Foam: $($foam.Width)x$($foam.Height) -> frames of $($foam.Height)px"

$out = 'D:\Code\IW\Ironwill\tools\_inspect\water_sheets.png'
$sheet = New-Object System.Drawing.Bitmap -ArgumentList @(1500, 560)
$sg = [System.Drawing.Graphics]::FromImage($sheet)
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$sg.Clear([System.Drawing.Color]::FromArgb(255, 30, 30, 36))
$font = New-Object System.Drawing.Font('Consolas', 11)
$sg.DrawString('water rocks sheet (1024x64)', $font, [System.Drawing.Brushes]::White, 4, 4)
$sg.DrawImage($wr, (New-Object System.Drawing.Rectangle -ArgumentList @(4, 24, 1024, 64)),
    (New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, 1024, 64)), [System.Drawing.GraphicsUnit]::Pixel)
$sg.DrawString('water rocks frames 3x', $font, [System.Drawing.Brushes]::White, 4, 96)
for ($i = 0; $i -lt 8; $i++) {
    $src = New-Object System.Drawing.Rectangle -ArgumentList @(($i * 64), 0, 64, 64)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList @((4 + $i * 130), 116, 120, 120)
    $sg.DrawImage($wr, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}
$sg.DrawString('water foam frames 2x', $font, [System.Drawing.Brushes]::White, 4, 250)
for ($i = 0; $i -lt 5; $i++) {
    $src = New-Object System.Drawing.Rectangle -ArgumentList @(($i * 192), 0, 192, 192)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList @((4 + $i * 160), 270, 150, 150)
    $sg.DrawImage($foam, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}
$wr.Dispose(); $foam.Dispose(); $font.Dispose(); $sg.Dispose()
$sheet.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
Write-Output "wrote $out"
