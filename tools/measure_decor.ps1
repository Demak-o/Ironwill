# Dev-only helper: alpha bounding box of frame 0 of the decoration / FX / UI sheets.
Add-Type -AssemblyName System.Drawing
$root = 'D:\Code\IW\Ironwill\Assets'

function Get-BBox {
    param([string]$Path, [int]$Frame)
    $img = New-Object System.Drawing.Bitmap($Path)
    $fh = $img.Height
    $x0 = $Frame * $fh
    $minX = $fh; $minY = $fh; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $fh; $y++) {
        for ($x = $x0; $x -lt ($x0 + $fh); $x++) {
            if ($img.GetPixel($x, $y).A -gt 24) {
                if ($x -lt ($minX + $x0)) { $minX = $x - $x0 }
                if ($x - $x0 -gt $maxX) { $maxX = $x - $x0 }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    $frames = [int]($img.Width / $fh)
    Write-Output ("{0,-22} frame={1,4} frames={2,3} body={3}x{4} baseFrac={5:N3} widthFrac={6:N3}" -f `
        (Split-Path $Path -Leaf), $fh, $frames, ($maxX - $minX + 1), ($maxY - $minY + 1), (($maxY - $fh / 2) / $fh), ((($maxX - $minX + 1) ) / $fh))
    $img.Dispose()
}

Get-BBox "$root\Terrain\Resources\Wood\Trees\Tree1.png" 0
Get-BBox "$root\Terrain\Resources\Wood\Trees\Tree3.png" 0
Get-BBox "$root\Terrain\Decorations\Bushes\Bushe1.png" 0
Get-BBox "$root\Terrain\Decorations\Rocks\Rock1.png" 0
Get-BBox "$root\Terrain\Resources\Wood\Trees\Stump 1.png" 0
Get-BBox "$root\Terrain\Resources\Meat\Sheep\Sheep_Idle.png" 0
Get-BBox "$root\Terrain\Decorations\Rubber Duck\Rubber duck.png" 0
Get-BBox "$root\Particle FX\Explosion_01.png" 3
Get-BBox "$root\Particle FX\Dust_01.png" 0
Get-BBox "$root\Terrain\Tileset\Shadow.png" 0
Get-BBox "$root\Terrain\Resources\Gold\Gold Resource\Gold_Resource.png" 0
Get-BBox "$root\Terrain\Tileset\Water Foam.png" 0
Get-BBox "$root\Terrain\Decorations\Rocks in the Water\Water Rocks_01.png" 0
Get-BBox "$root\Units\Blue Units\Warrior\Warrior_Attack1.png" 0
Get-BBox "$root\Units\Blue Units\Monk\Heal_Effect.png" 5
