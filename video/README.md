# סרטון קידום — DRAY·AI

כלי בנייה לסרטון הקידום (1920×1080, 30fps). לא חלק מהאפליקציה עצמה.
כל הסצנות נבנות מצילומי מסך אמיתיים של האפליקציה הרצה מקומית.

## התקנה
```bash
cd video
npm init -y
npm i three@0.128.0 @fontsource/heebo@5 @fontsource/share-tech-mono@5
cp node_modules/three/build/three.min.js ./three.min.js
```

## הפקה (צעד אחר צעד)
```bash
# 1. להריץ את האפליקציה מקומית (משורש הפרויקט)
python -m http.server 4325 --directory .

# 2. צילומי מסך של כל המסכים → shots/
node video/capture.js        # מזריק נתוני הדגמה ומצלם את ה-UI האמיתי
                             # (מיירט את ה-three.js מה-CDN ומגיש עותק מקומי)

# 3. תצוגה מקדימה של פריימים מה-stage
node video/preview.js

# 4. רינדור מלא → video/silent.mp4
node video/render.js

# 5. מוזיקה + מיזוג → video/DRAYAI_Promo.mp4
python3 -I video/music.py
ffmpeg -y -i video/silent.mp4 -i video/music.wav \
  -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart video/DRAYAI_Promo.mp4
```

## קבצים
| קובץ | תפקיד |
|---|---|
| `capture.js` | מזריק נתוני הדגמה בעברית ומצלם את מסכי האפליקציה |
| `stage.html` | במה דטרמיניסטית — `window.render(t)` מצייר כל פריים (רקע, כרטיס, הדגשות, סמן, כתוביות) |
| `preview.js` | מרנדר פריימים לדגימה לבדיקת פריסה |
| `render.js` | מרנדר את כל הפריימים ומצנרת ל-ffmpeg (H.264) |
| `music.py` | מסנתז פס רקע אמביינטי (Am-F-C-G) תואם אורך |

נבנה על ידי DrayApps.
