#!/usr/bin/env pwsh
# Validate a .NET regex pattern

param(
    [Parameter(Mandatory=$false)]
    [string]$Pattern
)

# Set output encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# Read pattern from stdin if not provided as parameter
if (-not $Pattern) {
    $Pattern = [System.Console]::In.ReadToEnd()
}

# Ensure we have a pattern
if ([string]::IsNullOrWhiteSpace($Pattern)) {
    $result = @{
        valid = $false
        error = "No pattern provided"
    }
    Write-Output (ConvertTo-Json $result -Compress)
    exit 0
}

try {
    # Attempt to create a .NET Regex object with the pattern
    # Using IgnoreCase option as per requirement
    $regex = [System.Text.RegularExpressions.Regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    
    # If we get here, the pattern is valid
    $result = @{
        valid = $true
        message = "Pattern is valid .NET regex"
    }
    
    Write-Output (ConvertTo-Json $result -Compress)
    exit 0
}
catch {
    # Pattern is invalid, extract the meaningful part of the error message
    $errorMessage = $_.Exception.Message
    
    # Try to extract just the useful part of .NET regex errors
    if ($errorMessage -match "Invalid pattern '.*?' at offset (\d+)\. (.+)") {
        $errorMessage = "At position $($matches[1]): $($matches[2])"
    }
    elseif ($errorMessage -match 'parsing ".*?" - (.+)') {
        $errorMessage = $matches[1]
    }
    elseif ($errorMessage -match 'Exception calling .* with .* argument\(s\): "(.+)"') {
        $innerError = $matches[1]
        if ($innerError -match "Invalid pattern '.*?' at offset (\d+)\. (.+)") {
            $errorMessage = "At position $($matches[1]): $($matches[2])"
        }
        else {
            $errorMessage = $innerError
        }
    }
    
    # Remove any trailing quotes or periods followed by quotes
    $errorMessage = $errorMessage -replace '\."$', '.' -replace '"$', ''
    
    $result = @{
        valid = $false
        error = $errorMessage
    }
    
    Write-Output (ConvertTo-Json $result -Compress)
    exit 0
}