# Dev-only helper: builds contact sheets so we can eyeball sprite sheet layouts.
Add-Type -AssemblyName System.Drawing

function New-ContactSheet {
    param(
        [string]$OutPath,
        [string[]]$Paths,
        [int]$Cell = 96,
        [int]$Cols = 8,
        [string[]]$Labels = @()
    )
    $rows = [Math]::Ceiling($Paths.Count / $Cols)
    $bmp = New-Object System.Drawing.Bitmap(($Cell * $Cols), ([Math]::Max(1, $rows) * $Cell))
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 40, 40, 48))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $font = New-Object System.Drawing.Font('Consolas', 8)
    $brush = [System.Drawing.Brushes]::White
    for ($i = 0; $i -lt $Paths.Count; $i++) {
        $p = $Paths[$i]
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $img = [System.Drawing.Image]::FromFile($p)
        $x = ($i % $Cols) * $Cell
        $y = [Math]::Floor($i / $Cols) * $Cell
        $scale = [Math]::Min(($Cell - 18) / $img.Width, ($Cell - 18) / $img.Height)
        if ($scale -gt 4) { $scale = 4 }
        $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
        $g.DrawImage($img, $x + [int](($Cell - $w) / 2), $y + [int](($Cell - $h) / 2), $w, $h)
        if ($Labels.Count -gt $i) { $g.DrawString($Labels[$i], $font, $brush, $x + 2, $y + $Cell - 14) }
        $img.Dispose()
    }
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "wrote $OutPath"
}

$root = 'D:\Code\IW\Ironwill\Assets'
$tmp = 'D:\Code\IW\Ironwill\tools\_inspect'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# 1. UI icons + small resources
$files = @()
$labels = @()
1..12 | ForEach-Object { $n = '{0:d2}' -f $_; $files += "$root\UI Elements\UI Elements\Icons\Icon_$n.png"; $labels += "Icon_$n" }
4..1 | ForEach-Object { $files += "$root\Terrain\Resources\Tools\Tool_0$_.png"; $labels += "Tool_0$_" }
$files += "$root\Terrain\Resources\Gold\Gold Resource\Gold_Resource.png"; $labels += 'Gold'
$files += "$root\Terrain\Resources\Meat\Meat Resource\Meat Resource.png"; $labels += 'Meat'
$files += "$root\Terrain\Resources\Wood\Wood Resource\Wood Resource.png"; $labels += 'Wood'
1..4 | ForEach-Object { $files += "$root\Terrain\Decorations\Rocks\Rock$_.png"; $labels += "Rock$_" }
$files += "$root\Terrain\Decorations\Rubber Duck\Rubber duck.png"; $labels += 'Duck'
$files += "$root\Units\Blue Units\Archer\Arrow.png"; $labels += 'Arrow'
$files += "$root\Terrain\Tileset\Shadow.png"; $labels += 'Shadow'
$files += "$root\Terrain\Tileset\Water Background color.png"; $labels += 'WaterBG'
New-ContactSheet -OutPath "$tmp\icons.png" -Paths $files -Labels $labels -Cell 96 -Cols 8

# 2. First idle frame of every unit, colour x type
$types = @('Pawn', 'Warrior', 'Archer', 'Lancer', 'Monk')
$cols = @('Black', 'Red', 'Yellow', 'Purple', 'Blue')
$tmpDir = "$tmp\unitframes"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$files = @(); $labels = @()
foreach ($c in $cols) {
    foreach ($t in $types) {
        $dir = "$root\Units\$c Units\$t"
        $f = Get-ChildItem -LiteralPath $dir -Filter '*.png' | Where-Object { $_.Name -match 'Idle' } | Select-Object -First 1
        if (-not $f) { continue }
        $src = [System.Drawing.Image]::FromFile($f.FullName)
        $fw = $src.Height
        $crop = New-Object System.Drawing.Bitmap($fw, $fw)
        $cg = [System.Drawing.Graphics]::FromImage($crop)
        $cg.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $fw, $fw)), (New-Object System.Drawing.Rectangle(0, 0, $fw, $fw)), [System.Drawing.GraphicsUnit]::Pixel)
        $cg.Dispose(); $src.Dispose()
        $out = "$tmpDir\$c`_$t.png"
        $crop.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
        $crop.Dispose()
        $files += $out; $labels += "$c $t"
    }
}
New-ContactSheet -OutPath "$tmp\units.png" -Paths $files -Labels $labels -Cell 128 -Cols 5