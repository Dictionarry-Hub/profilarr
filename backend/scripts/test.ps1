#!/usr/bin/env pwsh
# Run regex tests against a pattern

# Set output encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# Read from stdin
$inputText = $input
if (-not $inputText) {
    $inputText = [System.Console]::In.ReadToEnd()
}

if (-not $inputText) {
    Write-Output (ConvertTo-Json @{
        success = $false
        message = "No input provided"
    } -Compress)
    exit 0
}

try {
    $data = $inputText | ConvertFrom-Json
    $Pattern = $data.pattern
    $tests = $data.tests
}
catch {
    Write-Output (ConvertTo-Json @{
        success = $false
        message = "Failed to parse input JSON: $_"
    } -Compress)
    exit 0
}

# Ensure we have required inputs
if ([string]::IsNullOrWhiteSpace($Pattern)) {
    Write-Output (ConvertTo-Json @{
        success = $false
        message = "No pattern provided"
    } -Compress)
    exit 0
}

if (-not $tests -or $tests.Count -eq 0) {
    Write-Output (ConvertTo-Json @{
        success = $false
        message = "No tests provided"
    } -Compress)
    exit 0
}

try {
    
    # Create the regex object with case-insensitive option
    $regex = [System.Text.RegularExpressions.Regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    
    # Process each test
    $results = @()
    
    foreach ($test in $tests) {
        $match = $regex.Match($test.input)
        $passes = ($match.Success -eq $test.expected)
        
        $result = @{
            id = $test.id
            input = $test.input
            expected = $test.expected
            passes = $passes
        }
        
        if ($match.Success) {
            # Include match details for highlighting (using original format)
            $result.matchedContent = $match.Value
            $result.matchSpan = @{
                start = $match.Index
                end = $match.Index + $match.Length
            }
            
            # Include capture groups if any
            $groups = @()
            for ($i = 1; $i -lt $match.Groups.Count; $i++) {
                if ($match.Groups[$i].Success) {
                    $groups += $match.Groups[$i].Value
                }
            }
            $result.matchedGroups = $groups
        }
        else {
            $result.matchedContent = $null
            $result.matchSpan = $null
            $result.matchedGroups = @()
        }
        
        $results += $result
    }
    
    Write-Output (ConvertTo-Json @{
        success = $true
        tests = $results
    } -Compress -Depth 10)
}
catch {
    Write-Output (ConvertTo-Json @{
        success = $false
        message = $_.Exception.Message
    } -Compress)
}