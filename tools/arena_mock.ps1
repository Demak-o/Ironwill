# Dev-only helper: mock up one arena camera view exactly like src/arena.js does it
# (water surround, seamless interior grass, shoreline, decor at its measured base offset)
# so the composition can be eyeballed without a browser.
Add-Type -AssemblyName System.Drawing
$root = 'D:\Code\IW\Ironwill\Assets'
$out = 'D:\Code\IW\Ironwill\tools\_inspect\arena_mock.png'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null

$TILE = 48
$INSET = 96
$worldW = 40 * $TILE
$worldH = 28 * $TILE
$ax = $INSET; $ay = $INSET
$aw = $worldW - $INSET * 2
$ah = $worldH - $INSET * 2
$camX = 300; $camY = 250
$vw = 1280; $vh = 720

$world = New-Object System.Drawing.Bitmap -ArgumentList @($worldW, $worldH)
$g = [System.Drawing.Graphics]::FromImage($world)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor

function DrawRegion {
    param($img, [int]$sx, [int]$sy, [int]$sw, [int]$sh, [int]$dx, [int]$dy, [int]$dw, [int]$dh)
    $src = New-Object System.Drawing.Rectangle -ArgumentList @($sx, $sy, $sw, $sh)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList @($dx, $dy, $dw, $dh)
    $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}

# 1) water everywhere
$water = [System.Drawing.Image]::FromFile("$root\Terrain\Tileset\Water Background color.png")
for ($y = 0; $y -lt $worldH; $y += 64) {
    for ($x = 0; $x -lt $worldW; $x += 64) { DrawRegion $water 0 0 64 64 $x $y 64 64 }
}
$water.Dispose()

# 2) arena floor: interior grass tiles, variant 2 (Greenwood) - mirrored from arena.js
$tileset = [System.Drawing.Image]::FromFile("$root\Terrain\Tileset\Tilemap_color2.png")
$interior = @(@(1, 1), @(2, 1), @(1, 2), @(2, 2))
$cols = [int]($aw / $TILE); $rows = [int]($ah / $TILE)
for ($r = 0; $r -lt $rows; $r++) {
    for ($c = 0; $c -lt $cols; $c++) {
        $h = ($c * 374761393 + $r * 668265263 + 2 * 2246822519) -band 0x7fffffff
        $t = $interior[($h % 4)]
        DrawRegion $tileset ([int]$t[0] * $TILE) ([int]$t[1] * $TILE) $TILE $TILE ($ax + $c * $TILE) ($ay + $r * $TILE) $TILE $TILE
    }
}
$tileset.Dispose()

# soft grass patches (same idea as paintGround) to break up the tile repeat
foreach ($i in 1..60) {
    $px = $ax + 30 + ($i * 137) % ($aw - 60)
    $py = $ay + 30 + ($i * 211) % ($ah - 60)
    $rad = 60 + ($i * 29) % 130
    $dark = ($i % 2) -eq 0
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(($px - $rad), ($py - $rad), ($rad * 2), ($rad * 2))
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush -ArgumentList @($path)
    $brush.CenterColor = if ($dark) { [System.Drawing.Color]::FromArgb(80, 38, 56, 20) } else { [System.Drawing.Color]::FromArgb(50, 196, 214, 110) }
    $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
}

# 3) shoreline: dark lip + foam line + soft inner darkening
$penDark = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(140, 12, 32, 30), 10)
$g.DrawRectangle($penDark, $ax + 1, $ay + 1, $aw - 2, $ah - 2)
$penFoam = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 236, 255, 238), 3)
$g.DrawRectangle($penFoam, $ax + 4, $ay + 4, $aw - 8, $ah - 8)
$penInner = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 24, 52, 36), 26)
$g.DrawRectangle($penInner, $ax + 18, $ay + 18, $aw - 36, $ah - 36)
$penDark.Dispose(); $penFoam.Dispose(); $penInner.Dispose()

# 4) water rocks in the band + animated foam markers on the shoreline
foreach ($i in 1..26) {
    $rk = [System.Drawing.Image]::FromFile("$root\Terrain\Decorations\Rocks in the Water\Water Rocks_0$(($i % 2) + 1).png")
    $side = $i % 4
    if ($side -eq 0) { $x = 60 + ($i * 97) % ($worldW - 200); $y = 20 + ($i * 31) % ($INSET - 60) }
    elseif ($side -eq 1) { $x = 60 + ($i * 89) % ($worldW - 200); $y = $worldH - $INSET + 10 + ($i * 17) % 60 }
    elseif ($side -eq 2) { $x = 10 + ($i * 23) % ($INSET - 70); $y = 40 + ($i * 61) % ($worldH - 160) }
    else { $x = $worldW - $INSET + 10 + ($i * 19) % 60; $y = 40 + ($i * 53) % ($worldH - 160) }
    DrawRegion $rk (($i % 16) * 64) 0 64 64 $x $y 64 64
    $rk.Dispose()
}
$foam = [System.Drawing.Image]::FromFile("$root\Terrain\Tileset\Water Foam.png")
$fi = 0
$fsize = [int](192 * 0.75)
foreach ($px in ($ax + 60)..($ax + $aw - 60)) {
    if ((($px - $ax - 60) % 150) -ne 0) { continue }
    foreach ($py in @(($ay + 2), ($ay + $ah - 2))) {
        DrawRegion $foam (($fi % 16) * 192) 0 192 192 ($px - $fsize / 2) ($py - $fsize / 2) $fsize $fsize
        $fi++
    }
}
$foam.Dispose()
$g.Dispose()
$world.Save("$out.tmp.png", [System.Drawing.Imaging.ImageFormat]::Png)
# 5) decorations at their measured base offsets, scaled like arena.js
$world2 = [System.Drawing.Image]::FromFile("$out.tmp.png")
$final = New-Object System.Drawing.Bitmap -ArgumentList @($worldW, $worldH)
$g2 = [System.Drawing.Graphics]::FromImage($final)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g2.DrawImage($world2, 0, 0)

function Blit {
    param($img, [int]$frameIndex, [double]$scaleX, [double]$base, [int]$groundX, [int]$groundY)
    $fh = $img.Height
    $w = [int]($fh * $scaleX)
    $sx = $frameIndex * $fh
    $drawY = [int]($groundY - $fh * $scaleX * $base)
    $src = New-Object System.Drawing.Rectangle -ArgumentList @($sx, 0, $fh, $fh)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList @([int]($groundX - $w / 2), $drawY, $w, $w)
    $g2.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}

$shadow = [System.Drawing.Image]::FromFile("$root\Terrain\Tileset\Shadow.png")
function BlitShadow {
    param([int]$x, [int]$y, [double]$s)
    $size = [int](192 * $s)
    $src = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, 192, 192)
    $dst = New-Object System.Drawing.Rectangle -ArgumentList @([int]($x - $size / 2), [int]($y - $size / 2 + 2), $size, $size)
    $g2.DrawImage($shadow, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
}

$decor = @(
    @('Resources\Wood\Trees\Tree1.png', 0, 0.85, 0.438, 520, 300),
    @('Resources\Wood\Trees\Tree3.png', 0, 0.95, 0.380, 900, 380),
    @('Decorations\Bushes\Bushe1.png', 3, 0.9, 0.109, 1150, 300),
    @('Decorations\Bushes\Bushe3.png', 1, 0.8, 0.109, 380, 620),
    @('Decorations\Rocks\Rock1.png', 0, 1.4, 0.281, 700, 700),
    @('Decorations\Rocks\Rock3.png', 0, 1.1, 0.281, 1300, 620),
    @('Resources\Wood\Trees\Stump 1.png', 0, 0.95, 0.434, 1000, 800),
    @('Resources\Meat\Sheep\Sheep_Idle.png', 2, 1.0, 0.148, 620, 520),
    @('Decorations\Rubber Duck\Rubber duck.png', 0, 1.0, 0.344, 860, 640)
)
foreach ($d in $decor) {
    $img = [System.Drawing.Image]::FromFile("$root\Terrain\$($d[0])")
    Blit $img ([int]$d[1]) ([double]$d[2]) ([double]$d[3]) ([int]$d[4]) ([int]$d[5])
    $img.Dispose()
}

# 6) units standing on the ground, scaled + offset exactly like the game
$units = @(
    @('Units\Blue Units\Warrior\Warrior_Idle.png', 0.70, 0.208, 560, 360, 0.41),
    @('Units\Red Units\Archer\Archer_Idle.png', 0.70, 0.203, 780, 430, 0.37),
    @('Units\Yellow Units\Warrior\Warrior_Idle.png', 0.70, 0.208, 950, 330, 0.41),
    @('Units\Purple Units\Monk\Idle.png', 0.75, 0.193, 1150, 500, 0.35),
    @('Units\Black Units\Pawn\Pawn_Idle.png', 0.70, 0.198, 320, 430, 0.33),
    @('Units\Blue Units\Lancer\Lancer_Idle.png', 0.72, 0.116, 430, 520, 0.39),
    @('Units\Purple Units\Lancer\Lancer_Idle.png', 0.72, 0.116, 1080, 620, 0.39)
)
foreach ($u in $units) {
    BlitShadow ([int]$u[3]) ([int]$u[4]) ([double]$u[5])
    $img = [System.Drawing.Image]::FromFile("$root\$($u[0])")
    Blit $img 0 ([double]$u[1]) ([double]$u[2]) ([int]$u[3]) ([int]$u[4])
    $img.Dispose()
}
$shadow.Dispose(); $g2.Dispose()

# 7) crop the camera view
$view = New-Object System.Drawing.Bitmap -ArgumentList @($vw, $vh)
$vg = [System.Drawing.Graphics]::FromImage($view)
$vg.DrawImage($final, (New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, $vw, $vh)), (New-Object System.Drawing.Rectangle -ArgumentList @($camX, $camY, $vw, $vh)), [System.Drawing.GraphicsUnit]::Pixel)
$font = New-Object System.Drawing.Font('Consolas', 12)
$vg.DrawString('arena illustration: water + seamless interior grass + shoreline + decor + units (Greenwood)', $font, [System.Drawing.Brushes]::White, 12, 10)
$vg.DrawString('units/scales match src/data/characters.js; decor bases match tools/measure_decor.ps1', $font, [System.Drawing.Brushes]::LightGray, 12, 30)
$vg.Dispose()
$view.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$view.Dispose(); $final.Dispose(); $world2.Dispose()
Remove-Item "$out.tmp.png" -ErrorAction SilentlyContinue
Write-Output "wrote $out"
Write-Output "ground painted ($worldW x $worldH)"