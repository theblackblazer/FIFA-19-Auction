[System.Reflection.Assembly]::LoadFrom("C:\Program Files (x86)\Fifa Master\RDBM 19\FifaControls.dll") | Out-Null
[System.Reflection.Assembly]::LoadFrom("C:\Program Files (x86)\Fifa Master\RDBM 19\FifaLibrary19.dll") | Out-Null

$xmlPath = "C:\Program Files (x86)\Fifa Master\RDBM 19\Templates\FIFA 19\fifa_ng_db-meta.xml"
$dbPath = "C:\Users\singh\OneDrive\Desktop\Squads20260826131251_DB1.db"
$outDir = "C:\Users\singh\.gemini\antigravity\scratch\fifa19-auction-app\data"

$db = New-Object FifaLibrary.DbFile
$null = $db.LoadXml($xmlPath)
$loaded = $db.LoadDb($dbPath)
if (-not $loaded) {
    Write-Error "Failed to load DB file"
    exit 1
}

$ds = $db.ConvertToDataSet()
$tables = @("players", "teams", "teamplayerlinks", "leagues", "leagueteamlinks", "editedplayernames", "playerloans", "dcplayernames")

foreach ($tName in $tables) {
    if ($ds.Tables.Contains($tName)) {
        $dt = $ds.Tables[$tName]
        $outFile = Join-Path $outDir "$tName.csv"
        Write-Host "Exporting $tName ($($dt.Rows.Count) rows)..."
        
        # Fast .NET export using StringBuilder and StreamWriter
        $sw = New-Object System.IO.StreamWriter($outFile, $false, [System.Text.Encoding]::UTF8, 65536)
        
        $colNames = [System.Collections.Generic.List[string]]::new()
        foreach ($col in $dt.Columns) { $colNames.Add($col.ColumnName) }
        $sw.WriteLine([string]::Join(",", $colNames))
        
        $sb = New-Object System.Text.StringBuilder
        $colCount = $dt.Columns.Count
        
        for ($r = 0; $r -lt $dt.Rows.Count; $r++) {
            $row = $dt.Rows[$r]
            $sb.Clear() | Out-Null
            for ($c = 0; $c -lt $colCount; $c++) {
                if ($c -gt 0) { $sb.Append(",") | Out-Null }
                $val = $row[$c]
                if ($val -ne $null -and $val -ne [DBNull]::Value) {
                    $s = [string]$val
                    if ($s.IndexOf(',') -ge 0 -or $s.IndexOf('"') -ge 0 -or $s.IndexOf("`n") -ge 0 -or $s.IndexOf("`r") -ge 0) {
                        $sb.Append('"').Append($s.Replace('"', '""')).Append('"') | Out-Null
                    } else {
                        $sb.Append($s) | Out-Null
                    }
                }
            }
            $sw.WriteLine($sb.ToString())
        }
        $sw.Close()
        Write-Host "Exported $tName done."
    }
}
Write-Host "ALL CSV TABLES EXPORTED SUCCESSFULLY!"
