# حروف (Huroof) - لعبة الأحرف التنافسية

![Huroof Logo](https://via.placeholder.com/150x150/4F46E5/FFFFFF?text=حروف)

[![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

لعبة تفاعلية متعددة اللاعبين تعتمد على الأحرف العربية والأسئلة المتنوعة، مصممة لتكون تعليمية وترفيهية في نفس الوقت.

## � Quick Start (Windows)

للتشغيل السريع على ويندوز:
```bash
# 1. تثبيت المتطلبات
# - .NET 10.0: https://dotnet.microsoft.com/download
# - Node.js: https://nodejs.org

# 2. تشغيل اللعبة
double-click deploy-windows.bat

# 3. أرسل الرابط الذي يظهر لأصدقائك
```

للتعليمات التفصيلية، انظر [WINDOWS_README.md](WINDOWS_README.md)

## 📋 محتويات

- [نظرة عامة](#نظرة-عامة)
- [المميزات](#المميزات)
- [التشغيل السريع](#quick-start-windows)
- [التثبيت والتشغيل المحلي](#التثبيت-والتشغيل-المحلي)
- [التشغيل باستخدام Docker](#التشغيل-باستخدام-docker)
- [النشر على الإنترنت](#النشر-على-الإنترنت)
- [هيكل المشروع](#هيكل-المشروع)
- [رفع ملفات الأسئلة (JSON)](#رفع-ملفات-الأسئلة-json)
- [تخصيص أصوات المؤقت والجرس](#تخصيص-أصوات-المؤقت-والجرس)
- [واجهة برمجة التطبيقات (API)](#واجهة-برمجة-التطبيقات-api)
- [المساهمة في المشروع](#المساهمة-في-المشروع)
- [الترخيص](#الترخيص)

## 🎯 نظرة عامة

حروف هي لعبة جماعية حيث يتنافس فريقان (البرتقالي والأخضر) للإجابة على أسئلة تبدأ بحروف معينة. يتميز اللعبة بواجهة عصرية وتجربة مستخدم سلسة مع دعم كامل للغة العربية.

### كيفية اللعب:
1. ينضم اللاعبون إلى غرفة اللعب
2. يقوم مدير اللعبة ببدء الجولة
3. يختار مدير اللعبة خلية من الشبكة لتحديد الحرف والسؤال
4. يتنافس الفريقان للضغط على الجسر أولاً
5. الفريق الذي يضغط الجسر أولاً يحصل على فرصة الإجابة
6. الإجابة الصحيحة تكسب الفريق نقطة والخلية

## ✨ المميزات

### 🎮 مميزات اللعبة
- **شبكة تفاعلية**: شبكة من الخلايا السداسية (4x4, 5x5, 6x6)
- **نظام جسر ذكي**: جهاز جسر إلكتروني مع مؤقتات متعددة
- **أسئلة متنوعة**: مكتبة أسئلة ضخمة مقسمة حسب الفئات والصعوبة
- **نظام نقاط**: تتبع تلقائي للنقاط والفائزين
- **جولات متعددة**: إمكانية اللعب بعدة جولات

### 👥 مميزات متعددة اللاعبين
- **غرف لعب خاصة**: إنشاء غرف بكود دخول خاص
- **أدوار متعددة**: مدير لعبة، لاعبون، ومشاهدون
- **اتصال حقيقي**: استخدام SignalR للاتصال الفوري
- **إدارة اللاعبين**: طرد ونقل اللاعبين بين الفرق

### 🎨 مميزات الواجهة
- **تصميم عصري**: واجهة مستخدم جميلة بألوان متدرجة
- **دعم كامل للعربية**: واجهة بالكامل باللغة العربية
- **وضع ليلي**: دعم الوضع الليلي والنهاري
- **تصميم متجاوب**: يعمل على جميع أحجام الشاشات
- **رسوم متحركة سلسة**: انتقالات وحركات جذابة

### 🔊 مميزات إضافية
- **مؤثرات صوتية**: أصوات عند الضغط على الجسر وانتهاء الوقت
- **مؤقتات مرئية**: عرض الوقت المتبقي بشكل واضح
- **تخصيص الإعدادات**: تغيير حجم الشبكة وعدد الجولات

## 💻 متطلبات النظام

### للتشغيل المحلي:
- **Node.js**: الإصدار 18 أو أحدث
- **.NET**: الإصدار 10.0 أو أحدث
- **npm**: الإصدار 9 أو أحدث
- **Git**: لنسخ المشروع

### للنشر:
- **Docker**: الإصدار 20 أو أحدث (اختياري)
- **خادم ويب**: أي خادم يدعم Node.js أو .NET

## 🚀 التثبيت والتشغيل المحلي

### 1. نسخ المشروع

```bash
git clone https://github.com/yourusername/huroof.git
cd huroof
```

### 2. تثبيت الواجهة الخلفية (Backend)

```bash
cd backend
dotnet restore
dotnet ef database update
dotnet run
```

الواجهة الخلفية ستعمل على `http://localhost:5062`

### 3. تثبيت الواجهة الأمامية (Frontend)

افتح محطة جديدة وانتقل إلى مجلد frontend:

```bash
cd frontend
npm install
npm run dev
```

الواجهة الأمامية ستعمل على `http://localhost:5173`

### 4. الوصول إلى اللعبة

افتح المتصفح وانتقل إلى `http://localhost:5173`

## 🐳 التشغيل باستخدام Docker

### بناء الصور

```bash
# بناء صورة الواجهة الأمامية
cd frontend
docker build -t huroof-frontend .

# بناء صورة الواجهة الخلفية
cd ../backend
docker build -t huroof-backend .
```

### تشغيل الحاويات

```bash
# تشغيل الواجهة الخلفية
docker run -d -p 5062:5062 --name huroof-backend huroof-backend

# تشغيل الواجهة الأمامية
docker run -d -p 5173:5173 --name huroof-frontend huroof-frontend
```

### استخدام Docker Compose

أنشئ ملف `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5062:5062"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
    volumes:
      - ./backend/Data:/app/Data

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:5062
```

ثم قم بتشغيل:

```bash
docker-compose up -d
```

## 🌐 النشر على الإنترنت

### 1. النشر على Vercel (موصى به للواجهة الأمامية)

```bash
# تثبيت Vercel CLI
npm i -g vercel

# النشر
cd frontend
vercel --prod
```

### 2. النشر على Railway (للواجهة الخلفية)

```bash
# تثبيت Railway CLI
npm install -g @railway/cli

# تسجيل الدخول
railway login

# النشر
cd backend
railway up
```

### 3. النشر على Azure

#### للواجهة الخلفية:
```bash
# تثبيت Azure CLI
# إنشاء Resource Group
az group create --name huroof-rg --location eastus

# إنشاء App Service Plan
az appservice plan create --name huroof-plan --resource-group huroof-rg --sku B1

# إنشاء Web App
az webapp create --name huroof-backend --resource-group huroof-rg --plan huroof-plan --runtime "DOTNETCORE|10.0"

# النشر
az webapp up --name huroof-backend --resource-group huroof-rg
```

#### للواجهة الأمامية:
```bash
# بناء المشروع للإنتاج
cd frontend
npm run build

# نشر الملفات إلى Azure Storage
az storage blob upload-batch --destination <storage-account>/web --source build/client
```

### 4. النشر على AWS

#### باستخدام AWS Amplify (للواجهة الأمامية):
```bash
# تثبيت Amplify CLI
npm install -g @aws-amplify/cli

# تهيئة المشروع
cd frontend
amplify init

# النشر
amplify publish
```

#### باستخدام AWS ECS (للواجهة الخلفية):
```bash
# بناء صورة Docker ودفعها إلى ECR
docker build -t huroof-backend .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag huroof-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/huroof-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/huroof-backend:latest
```

### 5. النشر على DigitalOcean

```bash
# إنشاء Droplet
# تثبيت Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# نسخ الملفات ونشرها
docker-compose up -d
```

### 6. النشر على Heroku

```bash
# تثبيت Heroku CLI
# إنشاء تطبيق
heroku create huroof-backend

# إضافة buildpacks
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add jincod/dotcore

# النشر
git subtree push --prefix backend heroku main
```

## 📁 هيكل المشروع

```
huroof/
├── backend/                    # الواجهة الخلفية (.NET)
│   ├── Controllers/           # متحكمات API
│   ├── Data/                  # قاعدة البيانات والأسئلة
│   ├── Hubs/                  # SignalR Hubs
│   ├── Models/                # نماذج البيانات
│   ├── Services/              # خدمات الأعمال
│   ├── Migrations/            # ترحيلات قاعدة البيانات
│   └── Properties/            # إعدادات المشروع
├── frontend/                  # الواجهة الأمامية (React)
│   ├── app/                   # مكونات التطبيق
│   │   ├── components/        # المكونات القابلة لإعادة الاستخدام
│   │   ├── contexts/          # React Contexts
│   │   ├── lib/               # مكتبات مساعدة
│   │   └── routes/            # مسارات التطبيق
│   ├── public/                # ملفات ثابتة
│   └── src/                   # كود المصدر
├── referance/                 # مراجع ومصادر إضافية
└── README.md                  # هذا الملف
```

## 📤 رفع ملفات الأسئلة (JSON)

يمكنك إضافة أسئلة مخصصة للعبة من خلال رفع ملف JSON بصيغة محددة:

### صيغة ملف JSON

يجب أن يكون الملف بتنسيق مصفوفة من الكائنات، حيث كل كائن يمثل سؤالاً واحداً:

```json
[
  {
    "Id": "a01",
    "Letter": "أ",
    "Question": "ما اسم أول إنسان خُلق وفق الديانات الإبراهيمية؟",
    "Answer": "آدم",
    "Category": "دين",
    "Difficulty": "easy"
  },
  {
    "Id": "a02",
    "Letter": "أ",
    "Question": "ما أكبر قارة في العالم؟",
    "Answer": "آسيا",
    "Category": "جغرافيا",
    "Difficulty": "easy"
  }
]
```

### حقول السؤال

- **Id**: معرف فريد للسؤال (نص)
- **Letter**: حرف السؤال (حرف عربي واحد)
- **Question**: نص السؤال (نص)
- **Answer**: نص الإجابة الصحيحة (نص)
- **Category**: فئة السؤال (مثال: دين، جغرافيا، علوم، تاريخ، أدب)
- **Difficulty**: مستوى الصعوبة (easy, medium, hard)

### خطوات رفع الملف

1. اذهب إلى لوحة التحكم في اللعبة
2. سجل الدخول باستخدام كلمة المرور
3. من قسم الأسئلة، اضغط على زر "رفع ملف JSON"
4. اختر ملف JSON من جهازك
5. سيتم التحقق من صيغة الملف وإضافة الأسئلة تلقائياً

### ملاحظات هامة

- يجب أن يكون الملف بامتداد `.json`
- يتم إضافة الأسئلة الموجودة في الملف إلى الأسئلة الحالية (لا يتم استبدالها)
- يجب التأكد من أن جميع الحقول الإلزامية موجودة في كل سؤال
- يدعم الملف ترميز UTF-8 للغة العربية

## 🔊 تخصيص أصوات المؤقت والجرس

يمكنك تخصيص أصوات اللعبة (صوت الجرس وصوت انتهاء الوقت) باستخدام ملفات صوتية مخصصة:

### تغيير أصوات اللعبة

1. **اذهب إلى مجلد الواجهة الأمامية:**
   ```bash
   cd frontend/public
   ```

2. **ملفات الصوت المتاحة:**
   - `buzzer.mp3`: صوت الجرس عند الضغط (موجود افتراضياً)
   - `timer-end.mp3`: صوت انتهاء الوقت (يمكنك إضافته)

3. **إضافة ملفات صوتية مخصصة:**
   - يمكنك استخدام الصيغ المدعومة:
     - MP3 (موصى به)
     - WAV
     - OGG
     - AAC
   - ضع ملفات الصوت في مجلد `frontend/public/`

4. **ملاحظة حول الملفات المفقودة:**
   - إذا لم يتم العثور على ملف الصوت، لن يتم تشغيل أي صوت
   - لن يظهر أي خطأ للمستخدم، فقط رسالة في console المطور
   - اللعبة ستستمر في العمل بشكل طبيعي بدون أصوات

5. **تعديل الكود لاستخدام ملفات صوتية مخصصة (اختياري):**
   
   افتح الملف `frontend/app/routes/game.tsx` وابحث عن الدوال:
   - `playBuzzerSound()`: لتغيير صوت الجرس
   - `playTimerEndSound()`: لتغيير صوت انتهاء الوقت

   مثال لتغيير صوت الجرس:
   ```javascript
   const playBuzzerSound = useCallback(() => {
       try {
           const audio = new Audio('/my-custom-buzzer.mp3'); // استبدل باسم ملفك
           audio.volume = 0.3;
           audio.play().catch((error) => {
               console.log('Failed to play buzzer sound:', error);
           });
       } catch (error) {
           console.log('Error creating buzzer audio:', error);
       }
   }, []);
   ```

6. **ضبط مستوى الصوت:**
   - يمكنك تعديل قيمة `audio.volume` (بين 0.0 و 1.0)
   - الصوت الافتراضي: 0.3 للجرس، 0.5 لانتهاء الوقت

### نصائح هامة

- **حجم الملف:** استخدم ملفات صوتية صغيرة الحجم (أقل من 100 كيلوبايت) لضمان سرعة التحميل
- **الصيغة:** MP3 هي الأكثر توافقياً مع المتصفحات
- **الجودة:** استخدم جودة صوت متوسطة (128 kbps) كتوازن بين الجودة والحجم
- **الترخيص:** تأكد من أن الملفات الصوتية المستخدمة مرخصة للاستخدام التجاري إذا لزم الأمر
- **الاختبار:** اختبر الأصوات في متصفحات مختلفة للتأكد من التوافق

## �� واجهة برمجة التطبيقات (API)

### نقاط النهاية الرئيسية

#### اللعب والجلسات
- `POST /api/sessions/create` - إنشاء جلسة جديدة
- `POST /api/sessions/join` - الانضمام إلى جلسة
- `POST /api/sessions/start` - بدء اللعبة

#### إدارة اللعبة
- `POST /api/game/selectCell` - اختيار خلية
- `POST /api/game/answer` - تقديم إجابة
- `POST /api/game/buzz` - الضغط على الجسر
- `POST /api/game/skip` - تخطي السؤال

#### إدارة اللاعبين
- `POST /api/players/kick` - طرد لاعب
- `POST /api/players/changeRole` - تغيير دور اللاعب

### استخدام SignalR

الاتصال بالـ Hub للتحديثات الحية:
```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/gameHub")
    .build();

connection.on("StateUpdated", (state) => {
    // تحديث واجهة المستخدم
});
```

## 🤝 المساهمة في المشروع

نرحب بالمساهمات! اتبع الخطوات التالية:

1. Fork المشروع
2. إنشاء فرع جديد (`git checkout -b feature/AmazingFeature`)
3. إجراء التغييرات
4. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
5. الدفع إلى الفرع (`git push origin feature/AmazingFeature`)
6. إنشاء Pull Request

### قواعد المساهمة:
- احترام نمط الكود الحالي
- إضافة تعليقات للكود الجديد
- تحديث الوثائق عند الضرورة
- اختبار التغييرات جيداً

## 📝 الترخيص

هذا المشروع مرخص تحت ترخيص MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## 🙏 الشكر والتقدير

- جميع المساهمين في المشروع
- مجتمع المصادر المفتوحة
- مستخدمي اللعبة القيمين

## 📞 للتواصل

- البريد الإلكتروني: huroof@example.com
- موقع الويب: https://huroof.example.com
- تويتر: [@HuroofGame](https://twitter.com/HuroofGame)

---

**ملاحظة**: هذا المشروع لا يزال قيد التطوير وقد تتغير بعض المميزات.
