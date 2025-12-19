# Test Script for HND Gateway Backend Endpoints
# Run this after starting the server with: npm start

$baseUrl = "http://localhost:5000"
$adminToken = ""  # Will be set after login

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "HND Gateway Backend - Endpoint Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Helper function to make API calls
function Invoke-ApiTest {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [object]$Body = $null,
        [string]$Token = "",
        [string]$Description = ""
    )
    
    Write-Host "`n--- $Description ---" -ForegroundColor Yellow
    Write-Host "$Method $Endpoint" -ForegroundColor Gray
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            Headers = $headers
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params
        $content = $response.Content | ConvertFrom-Json
        
        Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Gray
        $content | ConvertTo-Json -Depth 5
        
        return $content
    }
    catch {
        Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error Body: $errorBody" -ForegroundColor Red
        }
        return $null
    }
}

# Test 1: Health Check
Invoke-ApiTest -Endpoint "/health" -Description "1. Health Check"

# Test 2: Get All Tests (should work without auth)
Invoke-ApiTest -Endpoint "/api/tests" -Description "2. Get All Tests"

# Test 3: Get All Study Materials
Invoke-ApiTest -Endpoint "/api/study-materials" -Description "3. Get All Study Materials"

# Test 4: Get Departments
Invoke-ApiTest -Endpoint "/api/papers/departments" -Description "4. Get Departments"

Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "Basic Tests Completed!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "To test admin endpoints, you need to:" -ForegroundColor Yellow
Write-Host "1. Login as admin to get a token" -ForegroundColor Yellow
Write-Host "2. Set `$adminToken variable" -ForegroundColor Yellow
Write-Host "3. Run admin-specific tests`n" -ForegroundColor Yellow

# Admin Login Example (uncomment and modify with actual credentials)
# $loginBody = @{
#     email = "admin@example.com"
#     password = "YourPassword123"
# }
# $loginResponse = Invoke-ApiTest -Endpoint "/api/auth/login" -Method "POST" -Body $loginBody -Description "Admin Login"
# if ($loginResponse) {
#     $adminToken = $loginResponse.token
#     Write-Host "Admin token set: $adminToken" -ForegroundColor Green
# }
