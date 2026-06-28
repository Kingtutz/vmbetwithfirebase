$base='https://vm2026-2f0da-default-rtdb.europe-west1.firebasedatabase.app'
$predByUser=Invoke-RestMethod -Uri ($base + '/knockout_predictions.json') -TimeoutSec 30
$results=Invoke-RestMethod -Uri ($base + '/matchResults.json') -TimeoutSec 30
$users=Invoke-RestMethod -Uri ($base + '/users.json') -TimeoutSec 30
$targets=@('unbuiltcastle','mackan','silentkiller','correb')
function ToNum($v){ $s=([string]$v).Trim(); if($s -match '^-?\d+$'){ return [int]$s }; return $null }
function Norm($v){ $c=([string]$v).Trim().ToLower(); if($c -in @('1','team1','home')){return 'team1'}; if($c -in @('2','team2','away')){return 'team2'}; if($c -in @('draw','x')){return 'draw'}; return $c }
function Derive($a,$b){ if($null -eq $a -or $null -eq $b){return ''}; if($a -gt $b){return 'team1'}; if($b -gt $a){return 'team2'}; return 'draw' }
function ResolveWinner($ws,$wf){ if($ws -eq 'draw'){ if($wf -in @('team1','team2')){ return $wf }; return 'draw' }; if($ws){ return $ws }; return $wf }
function GetResult([string]$matchId){ $d=$results.('knockout-'+$matchId); if($null -ne $d){ return @{ key=('knockout-'+$matchId); val=$d } }; $u=$results.$matchId; if($null -ne $u){ return @{ key=$matchId; val=$u } }; return $null }
foreach($u in $users.PSObject.Properties){ $nick=[string]$u.Value.nickname; if(-not $nick){ continue }; if(-not ($targets -contains $nick.ToLower())){ continue }; $uid=$u.Name; $preds=$predByUser.$uid; $sum=0; foreach($kv in $preds.PSObject.Properties){ $mid=$kv.Name; $pred=$kv.Value; $rf=GetResult $mid; if($null -eq $rf){ continue }; $res=$rf.val; $ps1=ToNum $pred.score1; $ps2=ToNum $pred.score2; $rs1=ToNum $res.score1; $rs2=ToNum $res.score2; $pw=ResolveWinner (Derive $ps1 $ps2) (Norm $pred.winner); $ow=ResolveWinner (Derive $rs1 $rs2) (Norm $res.winner); if(-not $ow){ continue }; $p1=0; if($null -ne $ps1){$p1=$ps1}; $p2=0; if($null -ne $ps2){$p2=$ps2}; $pts=0; if($pw -and $pw -eq $ow){$pts++}; if($null -ne $rs1 -and $p1 -eq $rs1){$pts++}; if($null -ne $rs2 -and $p2 -eq $rs2){$pts++}; $sum += $pts }; Write-Output ($nick + ' => ' + $sum) }
