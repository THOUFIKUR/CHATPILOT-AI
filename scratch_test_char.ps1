$arabicName = [char]0x0645 + [char]0x0648 + [char]0x0645 + [char]0x064A + [char]0x0627 + [char]0x0621
$testSender = "❤️❤️‍🔥" + $arabicName
Write-Host "Constructed name: $arabicName"
Write-Host "Matches: $($testSender -like ('*' + $arabicName + '*'))"
