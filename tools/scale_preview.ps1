# Dev-only helper: preview units at the scales the game will use, over the real tile floor.
Add-Type -AssemblyName System.Drawing
$root = 'D:\Code\IW\Ironwill\Assets'
$out = 'D:\Code\IW\Ironwill\tools\_inspect\scale_preview.png'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null

$canvas = New-Object System.Drawing.Bitmap -ArgumentList @(1100, 420)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.Clear([System.Drawing.Color]::FromArgb(255, 22, 26, 22))

# tile the real interior grass (tilemap_color1, interior tiles are seamless, 48px)
$tiles = [System.Drawing.Image]::FromFile("$root\Terrain\Tileset\Tilemap_color1.png")
$grass = @(@(48, 0), @(96, 48), @(48, 96))
for ($ty = 0; $ty -lt 420; $ty += 48) {
    for ($tx = 0; $tx -lt 1100; $tx += 48) {
        $t = $grass[(($tx / 48) + ($ty / 48)) % 3]
        $dst = New-Object System.Drawing.Rectangle -ArgumentList @($tx, $ty, 48, 48)
        $src = New-Object System.Drawing.Rectangle -ArgumentList @([int]$t[0], [int]$t[1], 48, 48)
        $g.DrawImage($tiles, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
    }
}
$tiles.Dispose()

# [image path, scale, label]
$units = @(
    @('Units\Blue Units\Warrior\Warrior_Idle.png', 0.70, 'Knight 0.70'),
    @('Units\Blue Units\Archer\Archer_Idle.png', 0.70, 'Archer 0.70'),
    @('Units\Blue Units\Monk\Idle.png', 0.75, 'Monk 0.75'),
    @('Units\Blue Units\Pawn\Pawn_Idle.png', 0.70, 'Pawn 0.70'),
    @('Units\Black Units\Warrior\Warrior_Idle.png', 0.70, 'Shade War 0.70'),
    @('Units\Red Units\Archer\Archer_Idle.png', 0.70, 'Crimson Arch 0.70'),
    @('Units\Purple Units\Monk\Idle.png', 0.75, 'Void Monk 0.75'),
    @('Units\Blue Units\Lancer\Lancer_Idle.png', 0.50, 'Lancer 0.50'),
    @('Units\Blue Units\Lancer\Lancer_Idle.png', 0.72, 'Lancer 0.72'),
    @('Units\Blue Units\Lancer\Lancer_Idle.png', 0.95, 'Lancer 0.95'),
    @('Units\Yellow Units\Lancer\Lancer_Idle.png', 0.72, 'Gilded Lancer 0.72')
)

$font = New-Object System.Drawing.Font('Consolas', 9)
$groundY = 200
$x = 30
foreach ($u in $units) {
    $img = [System.Drawing.Image]::FromFile("$root\$($u[0])")
    $scale = [double]$u[1]
    $w = [int]($img.Height * $scale)
    $h = [int]($img.Height * $scale)
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle -ArgumentList @(([int]($x - $w / 2)), ([int]($groundY - $h / 2)), $w, $h)), (New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, $img.Height, $img.Height)), [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawLine([System.Drawing.Pens]::Cyan, $x - 30, $groundY, $x + 30, $groundY)
    $g.DrawString($u[2], $font, [System.Drawing.Brushes]::White, $x - 30, 10)
    $img.Dispose()
    $x += 95
}
$g.Dispose()
$canvas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()
Write-Output "wrote $out"