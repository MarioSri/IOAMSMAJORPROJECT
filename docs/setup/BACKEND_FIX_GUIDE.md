# Backend Connection Error - Quick Fix Guide

## Problem
Your backend server crashed, causing the frontend to show `ECONNREFUSED` errors when trying to connect to the API.

## Quick Fix (Recommended)

### Option 1: Use the Automated Restart Script
1. Close all terminal windows
2. Run `START_ALL.bat` from the IAOMS-MAIN folder
3. Wait 10 seconds for both servers to start
4. Refresh your browser

### Option 2: Manual Restart
1. **Kill all Node processes:**
   ```cmd
   taskkill /F /IM node.exe
   ```

2. **Start backend first:**
   ```cmd
   cd backend
   npm run dev
   ```
   Wait until you see "Server running on port 3001"

3. **Start frontend in a new terminal:**
   ```cmd
   npm run dev
   ```

## Troubleshooting

### If backend still crashes:

1. **Run diagnostics:**
   ```cmd
   DIAGNOSE_BACKEND.bat
   ```

2. **Check for missing dependencies:**
   ```cmd
   cd backend
   npm install
   ```

3. **Check the error logs:**
   - Look at the terminal where backend crashed
   - Check `backend/error.log` if it exists

### Common Issues:

#### Port 3001 already in use
```cmd
# Find what's using the port
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

#### Missing environment variables
- Ensure `backend/.env` exists and has all required variables
- Copy from `backend/.env.example` if needed

#### Database connection issues
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`
- Verify Supabase project is running

## What Was Fixed

1. **Added error handling** to prevent crashes when services fail to start
2. **Created startup scripts** for easier server management
3. **Added diagnostics** to identify issues quickly
4. **Improved graceful shutdown** to clean up resources properly

## Files Created

- `START_ALL.bat` - Starts both frontend and backend
- `RESTART_BACKEND.bat` - Restarts only the backend
- `DIAGNOSE_BACKEND.bat` - Runs diagnostics
- `docs/setup/BACKEND_FIX_GUIDE.md` - This file

## Prevention

To avoid this issue in the future:
1. Always use `START_ALL.bat` to start the application
2. Use Ctrl+C to stop servers gracefully (don't just close windows)
3. Check logs regularly for warnings
4. Keep dependencies updated

## Still Having Issues?

If the problem persists:
1. Check the backend terminal for specific error messages
2. Look for TypeScript compilation errors
3. Verify all services (Supabase, Resend, etc.) are configured
4. Check if any required services (like Rekor) are failing to start

The server will now continue running even if optional services fail to start.
