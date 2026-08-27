param (
    [string]$dbPath = "C:\Users\singh\OneDrive\Desktop\Squads20260826131251_DB1.db",
    [string]$xmlPath = "C:\Program Files (x86)\Fifa Master\RDBM 19\Templates\FIFA 19\fifa_ng_db-meta.xml",
    [string]$outDir = "C:\Users\singh\.gemini\antigravity\scratch\fifa19-auction-app\data"
)

Add-Type -Path "C:\Program Files (x86)\Fifa Master\RDBM 19\FifaLibrary19.dll"

Write-Host "Loading XML descriptor from $xmlPath ..."
$db = New-Object FifaLibrary.DbFile
$null = $db.LoadXml($xmlPath)

Write-Host "Loading Squad DB from $dbPath ..."
$loaded = $db.LoadDb($dbPath)
if (-not $loaded) {
    Write-Error "Failed to load squad database file!"
    exit 1
}

Write-Host "Converting DB to DataSet ..."
$dataSet = $db.ConvertToDataSet()

$tablesToExport = @("players", "teams", "teamplayerlinks", "leagues", "leagueteamlinks", "editedplayernames", "playerloans")

foreach ($tName in $tablesToExport) {
    if ($dataSet.Tables.Contains($tName)) {
        $t = $dataSet.Tables[$tName]
        $csvFile = Join-Path $outDir "$tName.csv"
        Write-Host "Exporting table $tName ($($t.Rows.Count) rows) to $csvFile ..."
        
        $sw = New-Object System.IO.StreamWriter($csvFile, $false, [System.Text.Encoding]::UTF8)
        
        # Write header
        $colNames = @()
        foreach ($c in $t.Columns) { $colNames += $c.ColumnName }
        $sw.WriteLine(($colNames -join ","))
        
        # Write rows
        foreach ($r in $t.Rows) {
            $rowVals = @()
            foreach ($c in $t.Columns) {
                $val = $r[$c]
                if ($val -eq $null) {
                    $rowVals += ""
                } else {
                    $strVal = [string]$val
                    if ($strVal.Contains(",") -or $strVal.Contains('"') -or $strVal.Contains("`n")) {
                        $strVal = '"' + $strVal.Replace('"', '""') + '"'
                    }
                    $rowVals += $strVal
                }
            }
            $sw.WriteLine(($rowVals -join ","))
        }
        $sw.Close()
        Write-Host "Exported $tName successfully."
    } else {
        Write-Warning "Table $tName not found in DB."
    }
}

Write-Host "`nAll tables exported successfully!"
