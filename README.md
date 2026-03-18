# حروف (Huroof)  لعبة الأحرف التنافسية

[![.NET](https://img.shields.io/badge/.NET-10.0-purple.svg)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![SignalR](https://img.shields.io/badge/SignalR-Realtime-green.svg)](https://learn.microsoft.com/aspnet/core/signalr/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

لعبة جماعية تفاعلية متعددة اللاعبين تعتمد على الأحرف العربية والأسئلة الثقافية المتنوعة.

---

##  التشغيل السريع (Windows)

```bash
# 1. تأكد من تثبيت: .NET 10 + Node.js
# 2. شغل السكريبت
double-click deploy-windows.bat
# 3. أرسل الرابط الظاهر لأصدقائك
```

للتعليمات التفصيلية انظر [WINDOWS_README.md](WINDOWS_README.md)

---

##  محتويات

- [نظرة عامة](#-نظرة-عامة)
- [المميزات](#-المميزات)
- [التثبيت المحلي](#-التثبيت-والتشغيل-المحلي)
- [Docker](#-التشغيل-باستخدام-docker)
- [هيكل المشروع](#-هيكل-المشروع)
- [نظام الحسابات](#-نظام-الحسابات-والمصادقة)
- [لوحة الإدارة](#-لوحة-الإدارة-admin)
- [الأصوات المخصصة](#-تخصيص-الأصوات)
- [رفع الأسئلة](#-رفع-ملفات-الأسئلة-json)
- [API](#-واجهة-برمجة-التطبيقات)
- [المساهمة](#-المساهمة)
- [سجل التغييرات](#-سجل-التغييرات-الرئيسية)

---

##  نظرة عامة

فريقان (البرتقالي  والأخضر ) يتنافسان للإجابة على أسئلة تبدأ بحروف معينة على شبكة سداسية. الفائز هو من يوصل مساره عبر الشبكة أولا.

### كيفية اللعب:
1. أنشئ جلسة أو انضم بالرمز
2. اختر فريقك  يعين مدير اللعبة من المضيف
3. مدير اللعبة يختار خلية من الشبكة لتحديد الحرف والسؤال
4. اضغط الجرس أولا  **ماوس** أو **Space** أو **Enter**
5. الفريق الذي يضغط أولا يجيب  الإجابة الصحيحة تمنحه الخلية
6. أول فريق يربط مساره عبر الشبكة يفوز!

---

##  المميزات

###  اللعب
- شبكة سداسية تفاعلية (44 55 66)
- **جرس بلوحة المفاتيح**: Space أو Enter أو نقر الماوس
- أسئلة مصنفة بحسب الحرف والفئة والصعوبة
- مؤقت مرئي لكل مرحلة (إجابة أولى إجابة ثانية وقت مفتوح)
- مدير لعبة يختار الخلايا ويحكم على الإجابات
- شاشة فوز احتفالية بالفريق الرابح

###  تعدد اللاعبين
- غرف لعب خاصة برمز ست أحرف
- حماية اختيارية بكلمة مرور للجلسة
- أدوار: مدير لعبة  لاعب برتقالي  لاعب أخضر  مشاهد
- تغيير الفريق أثناء اللعب
- طرد اللاعبين وإعادة تعيينهم
- اتصال فوري عبر SignalR + MessagePack

###  نظام الحسابات
- **تسجيل مبسط**: 3 حقول فقط (بريد + اسم + كلمة مرور)
- اسم المستخدم الداخلي يشتق تلقائيا من البريد الإلكتروني
- **وضع الضيف**: العب فورا بدون حساب (24 ساعة)
- JWT آمن  7 أيام للمستخدمين 24 ساعة للضيوف
- ملف شخصي قابل للتعديل (اسم بريد كلمة مرور)
- إحصائيات لكل مستخدم (مباريات وانتصارات)

###  الإدارة
- لوحة إدارة `/admin` متكاملة
- إدارة المستخدمين: عرض تعديل تعطيل حذف
- رفع ملفات أسئلة JSON وإدارة بنك الأسئلة
- إحصائيات عامة للخادم
- بحث وتصفية في قائمة المستخدمين وتعيين الأدوار

###  الواجهة
- تصميم عصري (glassmorphism + ألوان متدرجة)
- دعم كامل للغة العربية (RTL)
- وضع ليلي / نهاري قابل للتبديل
- تصميم متجاوب: موبايل + تابلت + ديسكتوب
- رسوم متحركة ناعمة

###  الأصوات
- صوت الجرس عند الضغط
- صوت انتهاء الوقت
- ضع ملفاتك في `/sounds/`  يكتشف تلقائيا بدون تعديل كود
- يدعم MP3 و WAV

---

##  متطلبات النظام

| المكون | الإصدار المطلوب |
|---------|----------------|
| .NET    | 10.0+          |
| Node.js | 18+            |
| npm     | 9+             |
| Docker  | 20+ (اختياري)  |

---

##  التثبيت والتشغيل المحلي

### 1. نسخ المشروع
```bash
git clone https://github.com/yourusername/huroof.git
cd huroof
```

### 2. الواجهة الخلفية
```bash
cd backend
dotnet restore
dotnet ef database update
dotnet run
# http://localhost:5062
```

### 3. الواجهة الأمامية
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

---

##  التشغيل باستخدام Docker

```bash
docker-compose up -d
```

أو يدويا:
```bash
cd backend && docker build -t huroof-backend . && docker run -d -p 5062:5062 huroof-backend
cd frontend && docker build -t huroof-frontend . && docker run -d -p 80:80 huroof-frontend
```

---

##  هيكل المشروع

```
huroof/
 backend/
    Data/               # SQLite + ملفات الأسئلة
    Hubs/GameHub.cs     # SignalR Hub
    Models/             # User, Question, PersistedSession
    Migrations/         # EF Core
    Services/
       AuthService.cs  # JWT + تسجيل + ضيف
       QuestionStore.cs
       SessionManager.cs
    Program.cs          # كل نقاط API

 frontend/
    app/
       components/     # Buzzer, HexGrid, ScoreBoard, ...
       contexts/       # AuthContext, ThemeContext
       lib/            # api.ts, signalr.ts, tokenStore.ts
       routes/         # home, game, lobby, admin, profile, login, register
    public/
        sounds/         #  ضع ملفات الصوت هنا (buzzer.mp3, timeup.mp3)

 deploy-windows.bat
 deploy-windows.ps1
 docker-compose.yml
 README.md
```

---

##  نظام الحسابات والمصادقة

### التسجيل (3 حقول فقط)
| الحقل | الوصف |
|-------|-------|
| البريد الإلكتروني | للدخول والتعريف |
| الاسم في اللعبة | يظهر للاعبين |
| كلمة المرور | 6 أحرف على الأقل |

> اسم المستخدم يشتق تلقائيا من البريد: `ahmed@mail.com`  `ahmed`

### وضع الضيف
- أدخل اسمك وابدأ فورا
- جلسة مؤقتة 24 ساعة
- الإحصائيات لا تحفظ

### الأدوار
| الدور | الصلاحيات |
|-------|-----------|
| `Admin` | لوحة الإدارة + كل شيء |
| `Player` | اللعب + الملف الشخصي |
| `Guest` | اللعب فقط (مؤقت 24 ساعة) |

---

##  لوحة الإدارة (Admin)

الوصول عبر `/admin`  يتطلب حسابا بدور `Admin`.

**الميزات:**
- جدول المستخدمين مع بحث وتصفية وفرز
- تعديل الاسم والبريد والدور وحالة التفعيل
- إعادة تعيين كلمة المرور
- إدارة بنك الأسئلة (عرض / حذف / رفع JSON)
- إحصائيات الخادم

---

##  تخصيص الأصوات

ضع ملفاتك في `frontend/public/sounds/`  الكشف تلقائي:

| الملف | الحدث |
|-------|-------|
| `buzzer.mp3` أو `buzzer.wav` | ضغط الجرس |
| `timeup.mp3` أو `timeup.wav` | انتهاء الوقت |

> ملفات بديلة مدعومة أيضا: `timer-end.mp3`, `timer-end.wav`

```bash
# تحويل من WAV إلى MP3
ffmpeg -i input.wav -ab 128k buzzer.mp3
```

**نصائح:** MP3 أفضل توافقا  حجم < 100KB  جودة 128kbps

---

##  رفع ملفات الأسئلة (JSON)

### صيغة الملف
```json
[
  {
    "Id": "a01",
    "Letter": "أ",
    "Question": "ما اسم أول إنسان خلق وفق الديانات الإبراهيمية",
    "Answer": "آدم",
    "Category": "دين",
    "Difficulty": "easy"
  }
]
```

| الحقل | القيم |
|-------|-------|
| `Difficulty` | `easy`  `medium`  `hard` |
| `Letter` | حرف عربي واحد |
| `Category` | نص حر |

### طريقة الرفع
1. افتح `/admin`
2. قسم الأسئلة  "رفع ملف JSON"
3. اختر الملف  يضاف دون حذف الموجود

---

##  واجهة برمجة التطبيقات (API)

### المصادقة
| الطريقة | المسار | الوصف |
|--------|--------|-------|
| POST | `/api/auth/register` | تسجيل (email, inGameName, password) |
| POST | `/api/auth/login` | دخول (emailOrUsername, password) |
| POST | `/api/auth/guest` | دخول كضيف (name) |
| GET  | `/api/auth/me` | بيانات المستخدم الحالي |
| PUT  | `/api/auth/profile` | تحديث الملف الشخصي |
| POST | `/api/auth/change-password` | تغيير كلمة المرور |

### SignalR (GameHub)
```javascript
const conn = new signalR.HubConnectionBuilder()
    .withUrl("/gameHub", { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build();

conn.on("StateUpdated", (state) => { /* تحديث الواجهة */ });

// أوامر اللاعب
conn.invoke("Buzz");
conn.invoke("JoinSession", sessionId, password, displayName);

// أوامر مدير اللعبة
conn.invoke("SelectCell", cellId);
conn.invoke("SetQuestion", letter, question, answer, category, difficulty);
conn.invoke("MarkCorrect");
conn.invoke("MarkWrong");
conn.invoke("ResetBuzzer");
conn.invoke("OpenBuzzer");
```

---

##  المساهمة

```bash
git checkout -b feature/my-feature
git commit -m "feat: وصف التغيير"
git push origin feature/my-feature
# افتح Pull Request
```

---

##  سجل التغييرات الرئيسية

| التغيير | الوصف |
|---------|-------|
| تسجيل مبسط | 3 حقول فقط  بدون تأكيد كلمة المرور بدون إدخال اسم مستخدم |
| جرس بلوحة المفاتيح | Space أو Enter يضغطان الجرس إضافة للماوس |
| أصوات مخصصة | ضع MP3/WAV في `/sounds/`  يكتشف تلقائيا |
| وضع الضيف | العب فورا بدون تسجيل اسم واحد فقط |
| إصلاح تجميد تسجيل الخروج | SignalR يوقف الاتصال عند الخروج |
| إصلاح الملف الشخصي | تحميل البيانات الصحيحة بعد المصادقة |
| نظام JWT | رموز آمنة لكل دور (Admin / Player / Guest) |
| لوحة الإدارة | إدارة المستخدمين والأسئلة والإحصائيات |
| تصميم متجاوب | يعمل على الموبايل والتابلت والديسكتوب |
| وضع ليلي | تبديل سهل بين الوضع الليلي والنهاري |

---

##  الترخيص

MIT  انظر [LICENSE](LICENSE)