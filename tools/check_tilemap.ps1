# Dev-only helper: check tileset colour variants + seamless tiling of an interior grass tile.
Add-Type -AssemblyName System.Drawing
$src = 'D:\Code\IW\Ironwill\Assets\Terrain\Tileset'
$out = 'D:\Code\IW\Ironwill\tools\_inspect'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# A) side by side full tilesets
$names = 1..5 | ForEach-Object { "Tilemap_color$_.png" }
$w = 576; $h = 384
$bmp = New-Object System.Drawing.Bitmap(($w * 5), $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(255, 30, 30, 36))
for ($i = 0; $i -lt 5; $i++) {
    $img = [System.Drawing.Image]::FromFile("$src\$($names[$i])")
    $g.DrawImage($img, $i * $w, 0, $w, $h)
    $img.Dispose()
}
$g.Dispose(); $bmp.Save("$out\tilemap_variants.png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()

# B) tile several candidate interior tiles to test seamlessness (6x4 tiles of 48px at 3x)
$candidates = @(@(48, 48), @(96, 48), @(48, 96), @(96, 96), @(48, 144), @(96, 144), @(0, 0), @(144, 48))
$tile = 48; $cols = 8; $rows = 4; $zoom = 2
$bmp = New-Object System.Drawing.Bitmap(($tile * $cols * $zoom), ($tile * $rows * $zoom))
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$img = [System.Drawing.Image]::FromFile("$src\Tilemap_color1.png")
$labels = @()
for ($ci = 0; $ci -lt $candidates.Count; $ci++) {
    $cx = $candidates[$ci][0]; $cy = $candidates[$ci][1]
    $col = $ci % 4; $row = [Math]::Floor($ci / 4)
    for ($ty = 0; $ty -lt $rows; $ty++) {
        for ($tx = 0; $tx -lt $cols; $tx++) {
            $dx = (($row * 2) + $ty) * $tile * $zoom + 0
            $px = ($col * $cols + $tx) * $tile * $zoom
            # canvas is cols*4 wide; we lay 2 candidates vertically per column group
            $null = $dx
        }
    }
    $labels += "$cx,$cy"
}
# simpler: one candidate full-width row strip each
$bmp.Dispose(); $g.Dispose()
$tileN = 48
$zoomN = 2
$strips = $candidates.Count
$canvasW = $tileN * 10 * $zoomN
$canvasH = $tileN * $strips * $zoomN
$bmp = New-Object System.Drawing.Bitmap -ArgumentList @($canvasW, $canvasH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$tsz = $tileN * $zoomN
for ($ci = 0; $ci -lt $strips; $ci++) {
    $cx = [int]$candidates[$ci][0]
    $cy = [int]$candidates[$ci][1]
    for ($tx = 0; $tx -lt 10; $tx++) {
        $dx = $tx * $tsz
        $dy = $ci * $tsz
        $dst = New-Object System.Drawing.Rectangle -ArgumentList @($dx, $dy, $tsz, $tsz)
        $sr = New-Object System.Drawing.Rectangle -ArgumentList @($cx, $cy, $tileN, $tileN)
        $g.DrawImage($img, $dst, $sr, [System.Drawing.GraphicsUnit]::Pixel)
    }
}
$g.Dispose()
$bmp.Save("$out\tile_seams.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $img.Dispose()
Write-Output "wrote $out\tilemap_variants.png and $out\tile_seams.png"
Write-Output ("candidate order (top->bottom): " + ($labels -join ' | '))