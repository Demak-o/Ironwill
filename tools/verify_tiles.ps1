# Dev-only: verify the corrected interior tiles tile seamlessly, and eyeball the
# water-rock / foam sheets.
Add-Type -AssemblyName System.Drawing
$root = 'D:\Code\IW\Ironwill\Assets\Terrain\Tileset'
$out = 'D:\Code\IW\Ironwill\tools\_inspect\tiles_verified.png'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$TILE = 48

$bmp = New-Object System.Drawing.Bitmap -ArgumentList @(1100, 560)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255, 30, 30, 36))

function Blit {
    param($img, [int]$sx, [int]$sy, [int]$sw, [int]$sh, [int]$dx, [int]$dy, [int]$dw, [int]$dh)
    $src = New-Object System.Drawing.Rectangle -ArgumentList @($sx, $sy, $sw, $sh)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList @($dx, $dy, $dw, $dh)
    $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}

$tileset = [System.Drawing.Image]::FromFile("$root\Tilemap_color2.png")

# candidates that scored 0 on the trim metric
$candidates = @(@(2, 1), @(1, 2), @(2, 2), @(1, 1))
$titleFont = New-Object System.Drawing.Font('Consolas', 11)
for ($ci = 0; $ci -lt $candidates.Count; $ci++) {
    $c = $candidates[$ci]
    # 4x4 tiles of the same candidate (seam test)
    for ($ty = 0; $ty -lt 4; $ty++) {
        for ($tx = 0; $tx -lt 4; $tx++) {
            Blit $tileset ([int]$c[0] * $TILE) ([int]$c[1] * $TILE) $TILE $TILE (($ci % 2) * 560 + $tx * $TILE) ([int]([Math]::Floor($ci / 2)) * 280 + 20 + $ty * $TILE) $TILE $TILE
        }
    }
    $g.DrawString("tile col $($c[0]) row $($c[1])", $titleFont, [System.Drawing.Brushes]::White, ($ci % 2) * 560 + 4, [int]([Math]::Floor($ci / 2)) * 280 + 4)
}
$tileset.Dispose()

# water rocks: whole 1024x64 sheet, then 4 frames at 3x
$wrPath = 'D:\Code\IW\Ironwill\Assets\Terrain\Decorations\Rocks in the Water\Water Rocks_01.png'
$wr = [System.Drawing.Image]::FromFile($wrPath)
$g.DrawString('water rocks sheet (1024x64)', $titleFont, [System.Drawing.Brushes]::White, 4, 212)
Blit $wr 0 0 1024 64 4 216 1024 64
$wr.Dispose()
for ($k = 0; $k -lt 6; $k++) {
    $wr = [System.Drawing.Image]::FromFile($wrPath)
    Blit $wr ($k * 64) 0 64 64 (4 + $k * 92) 300 88 88
    $wr.Dispose()
}

# foam frames at 2x
$foam = [System.Drawing.Image]::FromFile("$root\Water Foam.png")
$g.DrawString('water foam frames (192px)', $titleFont, [System.Drawing.Brushes]::White, 4, 396)
for ($k = 0; $k -lt 5; $k++) {
    Blit $foam ($k * 192) 0 192 192 (4 + $k * 150) 400 140 140
}
$foam.Dispose()
$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "wrote $out"
