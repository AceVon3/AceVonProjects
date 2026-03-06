@echo off
powershell -Command "& 'C:\Users\ryanc\AppData\Local\Programs\Python\Python39\python.exe' -u '%~dp0server.py' 2>&1 | Tee-Object -FilePath '%~dp0server.log'"
pause
