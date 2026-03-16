@echo off
echo ========================================
echo   Initialize Git Repository
echo ========================================
echo.

:: Initialize git repository
git init

:: Add all files
git add .

:: Initial commit
git commit -m "Initial commit: Huroof game with full features

- Interactive hexagonal grid game board
- Real-time multiplayer with SignalR
- Buzzer system with timers
- Arabic language support
- Team-based gameplay
- Game master controls
- Sound effects
- Windows deployment scripts
- Docker configuration"

:: Instructions
echo.
echo ========================================
echo   Repository initialized successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Create a repository on GitHub
echo 2. Add remote: git remote add origin https://github.com/YOUR_USERNAME/huroof.git
echo 3. Push: git push -u origin main
echo.
echo Don't forget to:
echo - Update the README with your repository URL
echo - Configure GitHub Actions if needed
echo.
pause
