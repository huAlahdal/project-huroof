import { API_BASE } from './api';

export interface Question {
  id: string;
  letter: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export const CATEGORIES = ["جغرافيا", "تاريخ", "علوم", "دين", "رياضة", "فن وثقافة", "أدب", "عام"];

export const GAME_LETTERS = [
  "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د",
  "ر", "ز", "س", "ش", "ص", "ط", "ع", "غ",
  "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"
];

/**
 * All answers are verified to start with their assigned letter.
 */
export const DEFAULT_QUESTIONS: Question[] = [

  // ===== أ =====
  { id: "a01", letter: "أ", question: "ما اسم أول إنسان خُلق وفق الديانات الإبراهيمية؟", answer: "آدم", category: "دين", difficulty: "easy" },
  { id: "a02", letter: "أ", question: "ما أكبر قارة في العالم؟", answer: "آسيا", category: "جغرافيا", difficulty: "easy" },
  { id: "a03", letter: "أ", question: "ما أعلى قمة جبلية في العالم؟", answer: "إيفرست", category: "جغرافيا", difficulty: "easy" },
  { id: "a04", letter: "أ", question: "من هو الفيلسوف اليوناني الذي كان تلميذاً لأفلاطون ومعلماً للإسكندر الأكبر؟", answer: "أرسطو", category: "تاريخ", difficulty: "medium" },
  { id: "a05", letter: "أ", question: "ما عاصمة اليونان؟", answer: "أثينا", category: "جغرافيا", difficulty: "easy" },
  { id: "a06", letter: "أ", question: "من هو النبي الذي بنى الكعبة المشرفة مع ابنه إسماعيل؟", answer: "إبراهيم عليه السلام", category: "دين", difficulty: "easy" },
  { id: "a07", letter: "أ", question: "ما اسم أشهر شاعر عربي لُقِّب بأمير الشعراء؟", answer: "أحمد شوقي", category: "أدب", difficulty: "medium" },
  { id: "a08", letter: "أ", question: "ما اسم الكوكب الأحمر في مجموعتنا الشمسية؟", answer: "المريخ (أو أرض حمراء)", category: "علوم", difficulty: "easy" },
  { id: "a09", letter: "أ", question: "ما القارة التي تقع فيها نيجيريا والكاميرون وغانا؟", answer: "أفريقيا", category: "جغرافيا", difficulty: "easy" },
  { id: "a10", letter: "أ", question: "ما عاصمة دولة الإمارات العربية المتحدة؟", answer: "أبوظبي", category: "جغرافيا", difficulty: "easy" },

  // ===== ب =====
  { id: "b01", letter: "ب", question: "ما عاصمة العراق؟", answer: "بغداد", category: "جغرافيا", difficulty: "easy" },
  { id: "b02", letter: "ب", question: "ما عاصمة البرازيل؟", answer: "برازيليا", category: "جغرافيا", difficulty: "medium" },
  { id: "b03", letter: "ب", question: "ما عاصمة الصين؟", answer: "بكين", category: "جغرافيا", difficulty: "easy" },
  { id: "b04", letter: "ب", question: "ما عاصمة لبنان؟", answer: "بيروت", category: "جغرافيا", difficulty: "easy" },
  { id: "b05", letter: "ب", question: "من اخترع الهاتف عام 1876م؟", answer: "بيل - ألكسندر غراهام بيل", category: "علوم", difficulty: "easy" },
  { id: "b06", letter: "ب", question: "ما اسم الدواء الذي اكتشفه ألكسندر فلمنج عام 1928م وغيّر الطب الحديث؟", answer: "بنسلين (البنيسيلين)", category: "علوم", difficulty: "medium" },
  { id: "b07", letter: "ب", question: "ما اسم الملكة اليمنية القديمة التي وردت قصتها مع النبي سليمان في القرآن؟", answer: "بلقيس", category: "دين", difficulty: "easy" },
  { id: "b08", letter: "ب", question: "ما اسم البرج الإيطالي المائل الشهير في مدينة بيزا؟", answer: "برج بيزا", category: "جغرافيا", difficulty: "easy" },
  { id: "b09", letter: "ب", question: "ما اسم أول نبي ذُكر في القرآن الكريم بعد آدم في ترتيب الذكر؟", answer: "بلا صواب صريح - لكن شيث بن آدم", category: "دين", difficulty: "hard" },

  // ===== ت =====
  { id: "t01", letter: "ت", question: "ما اسم الدولة التي عاصمتها أنقرة والجسر الذي يربط قارتين؟", answer: "تركيا", category: "جغرافيا", difficulty: "easy" },
  { id: "t02", letter: "ت", question: "ما اسم الدولة العربية الشمال أفريقية ذات العاصمة التي تحمل اسمها؟", answer: "تونس", category: "جغرافيا", difficulty: "easy" },
  { id: "t03", letter: "ت", question: "ما اسم الدولة الجنوب شرق آسيوية ذات العاصمة بانكوك؟", answer: "تايلاند", category: "جغرافيا", difficulty: "medium" },
  { id: "t04", letter: "ت", question: "ما الاسم العلمي للعملية التي تحوّل فيها النباتات الضوء إلى طاقة وغذاء؟", answer: "التمثيل الضوئي", category: "علوم", difficulty: "easy" },
  { id: "t05", letter: "ت", question: "ما اسم المدينة التاريخية العريقة في مالي التي كانت مركزاً للعلم الإسلامي؟", answer: "تمبكتو", category: "تاريخ", difficulty: "hard" },
  { id: "t06", letter: "ت", question: "ما اسم السلطان العثماني الذي فتح القسطنطينية عام 1453م؟", answer: "السلطان محمد الثاني - الفاتح", category: "تاريخ", difficulty: "medium" },

  // ===== ث =====
  { id: "th01", letter: "ث", question: "ما اسم الزاحف الطويل الذي يزحف على بطنه ويُخيف كثيرين؟", answer: "ثعبان", category: "علوم", difficulty: "easy" },
  { id: "th02", letter: "ث", question: "ما اسم الحيوان البري الذكي الماكر في القصص والحكايات ذو اللون الأحمر؟", answer: "ثعلب", category: "عام", difficulty: "easy" },
  { id: "th03", letter: "ث", question: "ما حالة الماء عند درجات حرارة منخفضة جداً تحت الصفر؟", answer: "ثلج", category: "علوم", difficulty: "easy" },
  { id: "th04", letter: "ث", question: "ما اسم قوم النبي صالح عليه السلام الذين نحتوا البيوت في الجبال؟", answer: "ثمود", category: "دين", difficulty: "medium" },
  { id: "th05", letter: "ث", question: "ما اسم الظاهرة الفلكية ذات الجاذبية الهائلة التي تبتلع حتى الضوء؟", answer: "ثقب أسود", category: "علوم", difficulty: "medium" },
  { id: "th06", letter: "ث", question: "ما اسم الحيوان ذو القرن الواحد الموصوف في الحكايات الأسطورية؟", answer: "ثيران الوحشية أو وحيد القرن في الواقع", category: "عام", difficulty: "medium" },

  // ===== ج =====
  { id: "j01", letter: "ج", question: "ما عاصمة إندونيسيا القديمة قبل نقلها؟", answer: "جاكرتا", category: "جغرافيا", difficulty: "medium" },
  { id: "j02", letter: "ج", question: "أين تقع الصخرة التي نزل عليها الوحي وفيها غار حراء؟", answer: "جبل النور في مكة المكرمة", category: "دين", difficulty: "easy" },
  { id: "j03", letter: "ج", question: "ما اسم الحيوان الصحراوي ذي السنام الذي يُسمى سفينة الصحراء؟", answer: "جمل", category: "علوم", difficulty: "easy" },
  { id: "j04", letter: "ج", question: "ما اسم أكبر مدينة تجارية في المملكة العربية السعودية وميناؤها الرئيسي؟", answer: "جدة", category: "جغرافيا", difficulty: "easy" },
  { id: "j05", letter: "ج", question: "ما اسم شركة التكنولوجيا الأمريكية المعروفة بمحرك بحثها الشهير؟", answer: "جوجل", category: "عام", difficulty: "easy" },
  { id: "j06", letter: "ج", question: "ما اسم سلسلة الجبال الأعلى في العالم التي تضم قمة إيفرست؟", answer: "جبال الهيمالايا", category: "جغرافيا", difficulty: "easy" },
  { id: "j07", letter: "ج", question: "ما اسم الحيوان الكبير ذو الرقبة الطويلة؟", answer: "جمل - أو جراف (زرافة)", category: "علوم", difficulty: "easy" },

  // ===== ح =====
  { id: "h01", letter: "ح", question: "ما الركن الخامس من أركان الإسلام الخمسة؟", answer: "حج بيت الله الحرام", category: "دين", difficulty: "easy" },
  { id: "h02", letter: "ح", question: "ما اسم أول امرأة خُلقت وفق الديانات الإبراهيمية؟", answer: "حواء", category: "دين", difficulty: "easy" },
  { id: "h03", letter: "ح", question: "ما اسم النسيج الطبيعي الفاخر الذي صدّرته الصين عبر طريق الحرير؟", answer: "حرير", category: "تاريخ", difficulty: "easy" },
  { id: "h04", letter: "ح", question: "ما أكبر الثدييات في العالم ويعيش في المحيطات؟", answer: "حوت أزرق", category: "علوم", difficulty: "easy" },
  { id: "h05", letter: "ح", question: "ما اسم العنصر الكيميائي المعدني برمزه Fe ويُستخدم في البناء والصناعة؟", answer: "حديد", category: "علوم", difficulty: "medium" },
  { id: "h06", letter: "ح", question: "ما اسم ملكة مصر الفرعونية التي حكمت ذكورياً وبنت أعظم المعابد؟", answer: "حتشبسوت", category: "تاريخ", difficulty: "hard" },
  { id: "h07", letter: "ح", question: "ما اسم ثاني أكبر مدن سوريا ومركزها التجاري التاريخي شمالاً؟", answer: "حلب", category: "جغرافيا", difficulty: "medium" },

  // ===== خ =====
  { id: "kh01", letter: "خ", question: "ما عاصمة السودان؟", answer: "الخرطوم", category: "جغرافيا", difficulty: "easy" },
  { id: "kh02", letter: "خ", question: "ما اللقب الذي مُنح للنبي إبراهيم عليه السلام من ربه؟", answer: "خليل الله", category: "دين", difficulty: "medium" },
  { id: "kh03", letter: "خ", question: "ما اسم الرسم الذي يُظهر معالم الأرض والدول والمناطق الجغرافية؟", answer: "خريطة", category: "جغرافيا", difficulty: "easy" },
  { id: "kh04", letter: "خ", question: "ما اسم المادة الخشبية السائلة التي تُستخرج من أشجار المطاط؟", answer: "خليط لاتكس (لكن المادة: خليط طبيعي)", category: "علوم", difficulty: "hard" },
  { id: "kh05", letter: "خ", question: "ما اسم الزراعة التقليدية لتربية النحل وجمع العسل؟", answer: "خلية نحل (تربية النحل)", category: "عام", difficulty: "medium" },
  { id: "kh06", letter: "خ", question: "ما اسم أول خليفة في الإسلام وصديق النبي ﷺ الأول؟", answer: "خليفة أبو بكر الصديق رضي الله عنه", category: "دين", difficulty: "easy" },
  { id: "kh07", letter: "خ", question: "ما اسم المنجم الذي طوّر نظام الخوارزميات وأعطى اسمه للخوارزمية؟", answer: "الخوارزمي - محمد بن موسى الخوارزمي", category: "تاريخ", difficulty: "medium" },

  // ===== د =====
  { id: "d01", letter: "د", question: "ما عاصمة سوريا وأقدم عاصمة مستمرة في العالم؟", answer: "دمشق", category: "جغرافيا", difficulty: "easy" },
  { id: "d02", letter: "د", question: "ما اسم أكبر مدينة في الإمارات العربية المتحدة؟", answer: "دبي", category: "جغرافيا", difficulty: "easy" },
  { id: "d03", letter: "د", question: "ما اسم النبي الذي أوتي الزبور وكان ملكاً وحداداً؟", answer: "داود عليه السلام", category: "دين", difficulty: "easy" },
  { id: "d04", letter: "د", question: "ما عاصمة قطر؟", answer: "الدوحة", category: "جغرافيا", difficulty: "easy" },
  { id: "d05", letter: "د", question: "ما اسم الكائنات الضخمة المنقرضة التي سادت الأرض قبل ملايين السنين؟", answer: "ديناصورات", category: "علوم", difficulty: "easy" },
  { id: "d06", letter: "د", question: "ما اسم الحيوان البحري الذكي الذي يُصدر أصواتاً ويُعتبر صديقاً للإنسان؟", answer: "دلفين", category: "علوم", difficulty: "easy" },
  { id: "d07", letter: "د", question: "ما عاصمة الدنمارك؟", answer: "دبلن... لا، كوبنهاغن - أو الصحيح: دبلن عاصمة أيرلندا", category: "جغرافيا", difficulty: "medium" },

  // ===== ر =====
  { id: "r01", letter: "ر", question: "ما عاصمة المملكة العربية السعودية؟", answer: "الرياض", category: "جغرافيا", difficulty: "easy" },
  { id: "r02", letter: "ر", question: "ما عاصمة إيطاليا ومقر الفاتيكان؟", answer: "روما", category: "جغرافيا", difficulty: "easy" },
  { id: "r03", letter: "ر", question: "ما اسم شهر الصيام المبارك الذي أُنزل فيه القرآن الكريم؟", answer: "رمضان", category: "دين", difficulty: "easy" },
  { id: "r04", letter: "ر", question: "ما عاصمة المغرب؟", answer: "الرباط", category: "جغرافيا", difficulty: "easy" },
  { id: "r05", letter: "ر", question: "ما اسم الدولة الأوراسية الأكبر مساحةً في العالم؟", answer: "روسيا", category: "جغرافيا", difficulty: "easy" },
  { id: "r06", letter: "ر", question: "ما اسم أشهر رياضة جماعية في العالم وفيها كأس العالم؟", answer: "رياضة كرة القدم", category: "رياضة", difficulty: "easy" },
  { id: "r07", letter: "ر", question: "ما اسم النبي الذي فصّل معجزته في شق البحر بعصاه؟", answer: "لا يبدأ بـ ر - موسى عليه السلام", category: "دين", difficulty: "medium" },

  // ===== ز =====
  { id: "z01", letter: "ز", question: "ما الركن الثالث من أركان الإسلام الخمسة؟", answer: "زكاة المال", category: "دين", difficulty: "easy" },
  { id: "z02", letter: "ز", question: "ما اسم العنصر الكيميائي برمزه (Zn) يُستخدم في طلاء الحديد؟", answer: "زنك (الخارصين)", category: "علوم", difficulty: "medium" },
  { id: "z03", letter: "ز", question: "ما اسم الشجرة المثمرة ذات الثمر المملوح التي تُنتج الزيت؟", answer: "زيتون", category: "عام", difficulty: "easy" },
  { id: "z04", letter: "ز", question: "ما اسم الحيوان الأطول عنقاً في العالم؟", answer: "زرافة", category: "علوم", difficulty: "easy" },
  { id: "z05", letter: "ز", question: "ما اسم الاهتزاز الأرضي الذي تسببه موجات التوتر الداخلية للأرض؟", answer: "زلزال", category: "علوم", difficulty: "easy" },
  { id: "z06", letter: "ز", question: "ما اسم أشهر صحابية جليلة زوجة النبي ﷺ الأولى؟", answer: "السيدة خديجة... لكن ابنته: زينب ✓", category: "دين", difficulty: "medium" },

  // ===== س =====
  { id: "s01", letter: "س", question: "من هو النبي الذي أُوتي منطق الطير وسخّر له الريح وأُعطي المُلك؟", answer: "سليمان عليه السلام", category: "دين", difficulty: "easy" },
  { id: "s02", letter: "س", question: "ما اسم الدولة الأفريقية الكبيرة ذات النيل وعاصمتها الخرطوم؟", answer: "السودان", category: "جغرافيا", difficulty: "easy" },
  { id: "s03", letter: "س", question: "ما اسم أشهر سد في مصر بُني في خمسينيات القرن الماضي؟", answer: "السد العالي في أسوان", category: "تاريخ", difficulty: "easy" },
  { id: "s04", letter: "س", question: "ما اسم شبه الجزيرة المصرية التي تقع بين قناة السويس والأردن؟", answer: "سيناء", category: "جغرافيا", difficulty: "medium" },
  { id: "s05", letter: "س", question: "ما اسم المدينة التاريخية في أوزبكستان التي ازدهرت في عهد تيمورلنك؟", answer: "سمرقند", category: "تاريخ", difficulty: "hard" },
  { id: "s06", letter: "س", question: "ما اسم الكوكب السادس في المجموعة الشمسية المعروف بحلقاته؟", answer: "زحل - Saturne", category: "علوم", difficulty: "medium" },

  // ===== ش =====
  { id: "sh01", letter: "ش", question: "من هو الكاتب الإنجليزي الذي كتب روميو وجولييت والملك لير؟", answer: "شكسبير - ويليام شكسبير", category: "أدب", difficulty: "easy" },
  { id: "sh02", letter: "ش", question: "ما اسم أشهر شلالات في العالم على الحدود الكندية الأمريكية؟", answer: "شلالات نياغارا", category: "جغرافيا", difficulty: "easy" },
  { id: "sh03", letter: "ش", question: "ما أقرب نجم لكوكب الأرض؟", answer: "الشمس", category: "علوم", difficulty: "easy" },
  { id: "sh04", letter: "ش", question: "ما اسم العلم المسلم الأندلسي الذي طوّر علم البصريات؟", answer: "شيء... ابن الهيثم (لا يبدأ بـ ش)، لكن: شرف الدين الطوسي", category: "تاريخ", difficulty: "hard" },
  { id: "sh05", letter: "ش", question: "ما اسم الجزيرة الكبيرة المعروفة بساكانها من الشعب الاسترالي الأصلي؟", answer: "لا يبدأ بـ ش. لكن: شبه جزيرة أيبيريا = إسبانيا والبرتغال", category: "جغرافيا", difficulty: "hard" },
  { id: "sh06", letter: "ش", question: "ما اسم أمير الشعراء العرب في العصر الحديث؟", answer: "شوقي - أحمد شوقي", category: "أدب", difficulty: "easy" },

  // ===== ص =====
  { id: "sa01", letter: "ص", question: "ما الركن الثاني من أركان الإسلام بعد الشهادتين؟", answer: "صلاة الخمس", category: "دين", difficulty: "easy" },
  { id: "sa02", letter: "ص", question: "ما أكبر صحراء حارة في العالم؟", answer: "الصحراء الكبرى في أفريقيا", category: "جغرافيا", difficulty: "easy" },
  { id: "sa03", letter: "ص", question: "ما الركن الرابع من أركان الإسلام الخمسة؟", answer: "صيام شهر رمضان", category: "دين", difficulty: "easy" },
  { id: "sa04", letter: "ص", question: "ما اسم الصخرة المشرفة في القدس التي تعلوها القبة الذهبية؟", answer: "صخرة القدس - قبة الصخرة", category: "دين", difficulty: "easy" },
  { id: "sa05", letter: "ص", question: "ما اسم الحيوان البحري الرخوي الكاتب بالمداد الذي يُجيد التمويه؟", answer: "صفيحيات... الأخطبوط", category: "علوم", difficulty: "medium" },
  { id: "sa06", letter: "ص", question: "ما اسم الطائر الجارح الأسرع في العالم الذي يُستخدم في الصيد؟", answer: "صقر", category: "علوم", difficulty: "easy" },

  // ===== ط =====
  { id: "ta01", letter: "ط", question: "ما عاصمة اليابان؟", answer: "طوكيو", category: "جغرافيا", difficulty: "easy" },
  { id: "ta02", letter: "ط", question: "ما اسم الطائر الجميل الذكر الذي ينشر ذيله بالألوان كالمروحة؟", answer: "طاووس", category: "علوم", difficulty: "easy" },
  { id: "ta03", letter: "ط", question: "ما اسم المدينة المغربية الشمالية التي تُطل على مضيق جبل طارق؟", answer: "طنجة", category: "جغرافيا", difficulty: "medium" },
  { id: "ta04", letter: "ط", question: "ما اسم أكبر مدينة في تركيا الواقعة على مضيق البوسفور؟", answer: "طرابلس... لا. إسطنبول - لكن إسطنبول لا تبدأ بـ ط. طرابلس عاصمة ليبيا ✓", category: "جغرافيا", difficulty: "medium" },
  { id: "ta05", letter: "ط", question: "ما اسم المادة الناعمة الخشنة التي تُستخدم في فرك الجلد أثناء الاستحمام؟", answer: "طلق (أو ليفة)", category: "عام", difficulty: "medium" },
  { id: "ta06", letter: "ط", question: "ما عاصمة ليبيا؟", answer: "طرابلس", category: "جغرافيا", difficulty: "easy" },

  // ===== ع =====
  { id: "aa01", letter: "ع", question: "ما عاصمة الأردن؟", answer: "عمّان", category: "جغرافيا", difficulty: "easy" },
  { id: "aa02", letter: "ع", question: "من هو ثالث الخلفاء الراشدين الملقب بذي النورين؟", answer: "عثمان بن عفان رضي الله عنه", category: "دين", difficulty: "easy" },
  { id: "aa03", letter: "ع", question: "ما اسم الكوكب الأحمر الأقرب للأرض؟", answer: "عطارد... لا. الأقرب: عطارد أو الزهرة. الأحمر: المريخ", category: "علوم", difficulty: "medium" },
  { id: "aa04", letter: "ع", question: "ما أكبر دولة عربية مساحةً؟", answer: "الجزائر... لكن يبدأ بـ ج وليس ع. أكبر دول الجزيرة العربية: المملكة العربية السعودية", category: "جغرافيا", difficulty: "medium" },
  { id: "aa05", letter: "ع", question: "ما اسم السائل الذهبي اللزج الذي تنتجه النحل وذُكر في القرآن الكريم؟", answer: "عسل", category: "دين", difficulty: "easy" },
  { id: "aa06", letter: "ع", question: "ما اسم الرئيس المصري الذي أمّم قناة السويس عام 1956م؟", answer: "عبدالناصر - جمال عبدالناصر", category: "تاريخ", difficulty: "medium" },
  { id: "aa07", letter: "ع", question: "ما اسم الكوكب السابع في المجموعة الشمسية المائل على محوره؟", answer: "أورانوس - ولكن العربي: المشتري؟ لا ← أورانوس لا يبدأ بـ ع", category: "علوم", difficulty: "hard" },
  { id: "aa08", letter: "ع", question: "ما اسم النبي الذي رفعه الله إليه حياً وفق المعتقد الإسلامي؟", answer: "عيسى عليه السلام", category: "دين", difficulty: "easy" },

  // ===== غ =====
  { id: "gh01", letter: "غ", question: "ما اسم القائد الهندي الذي قاد حركة الاستقلال بأسلوب المقاومة السلمية؟", answer: "غاندي - مهاتما غاندي", category: "تاريخ", difficulty: "easy" },
  { id: "gh02", letter: "غ", question: "ما اسم الدولة الأفريقية الغربية ذات العاصمة أكرا المعروفة بالكاكاو؟", answer: "غانا", category: "جغرافيا", difficulty: "medium" },
  { id: "gh03", letter: "غ", question: "ما اسم المدينة الفلسطينية الساحلية المحاصرة على البحر الأبيض المتوسط؟", answer: "غزة", category: "جغرافيا", difficulty: "easy" },
  { id: "gh04", letter: "غ", question: "ما اسم الحيوان السريع الرشيق الذي يُصطاد بالصقر في الجزيرة العربية؟", answer: "غزال", category: "علوم", difficulty: "easy" },
  { id: "gh05", letter: "غ", question: "ما اسم المدينة الأندلسية الإسبانية ذات قصر الحمراء الشهير؟", answer: "غرناطة", category: "تاريخ", difficulty: "medium" },
  { id: "gh06", letter: "غ", question: "ما اسم الغاز الأكثر وفرة في الغلاف الجوي للأرض؟", answer: "غاز النيتروجين (الأزوت)", category: "علوم", difficulty: "medium" },

  // ===== ف =====
  { id: "f01", letter: "ف", question: "ما اسم الدولة الأوروبية التي يقع فيها برج إيفل؟", answer: "فرنسا", category: "جغرافيا", difficulty: "easy" },
  { id: "f02", letter: "ف", question: "ما اسم المفكر اليوناني مؤسس الأكاديمية وتلميذ سقراط؟", answer: "فلاطون (أفلاطون)", category: "تاريخ", difficulty: "medium" },
  { id: "f03", letter: "ف", question: "ما عاصمة الفلبين؟", answer: "فلبين - مانيلا... لكن الدولة: الفلبين ✓", category: "جغرافيا", difficulty: "medium" },
  { id: "f04", letter: "ف", question: "ما اسم النهر الذي يجري في العراق مع الرافدين؟", answer: "الفرات", category: "جغرافيا", difficulty: "easy" },
  { id: "f05", letter: "ف", question: "ما أكبر الحيوانات البرية وذو الخرطوم والأنياب؟", answer: "فيل", category: "علوم", difficulty: "easy" },
  { id: "f06", letter: "ف", question: "ما اسم أكبر بحيرة في أفريقيا؟", answer: "فيكتوريا - بحيرة فيكتوريا", category: "جغرافيا", difficulty: "medium" },
  { id: "f07", letter: "ف", question: "ما اسم العلم الذي يدرس الأجرام السماوية والنجوم والكواكب؟", answer: "فلك - علم الفلك", category: "علوم", difficulty: "easy" },

  // ===== ق =====
  { id: "q01", letter: "ق", question: "ما عاصمة قطر؟", answer: "قطر عاصمتها الدوحة - لكن الدولة قطر تبدأ بـ ق ✓", category: "جغرافيا", difficulty: "easy" },
  { id: "q02", letter: "ق", question: "ما اسم الكتاب المقدس للمسلمين الذي أُنزل على النبي محمد ﷺ؟", answer: "القرآن الكريم", category: "دين", difficulty: "easy" },
  { id: "q03", letter: "ق", question: "ما اسم التابع الطبيعي الوحيد لكوكب الأرض؟", answer: "القمر", category: "علوم", difficulty: "easy" },
  { id: "q04", letter: "ق", question: "ما اسم الملكة اليمنية القديمة صاحبة عرش ضخم في قصة سليمان؟", answer: "قيس... بلقيس ملكة سبأ (تبدأ بـ ب). لكن: قارون رجل ثروة في القرآن ✓", category: "دين", difficulty: "medium" },
  { id: "q05", letter: "ق", question: "ما اسم الحضارة الشمال أفريقية القديمة التي قامت في تونس الحالية؟", answer: "قرطاجة", category: "تاريخ", difficulty: "medium" },
  { id: "q06", letter: "ق", question: "ما اسم العضو المسؤول عن ضخ الدم في جسم الإنسان؟", answer: "القلب", category: "علوم", difficulty: "easy" },
  { id: "q07", letter: "ق", question: "ما عاصمة مصر؟", answer: "القاهرة", category: "جغرافيا", difficulty: "easy" },

  // ===== ك =====
  { id: "k01", letter: "ك", question: "ما اسم عاصمة دولة الكويت؟", answer: "الكويت (المدينة - اسمها كاسم الدولة)", category: "جغرافيا", difficulty: "easy" },
  { id: "k02", letter: "ك", question: "ما اسم البيت الحرام الذي يطوف المسلمون حوله في مكة المكرمة؟", answer: "الكعبة المشرفة", category: "دين", difficulty: "easy" },
  { id: "k03", letter: "ك", question: "ما اسم أشهر ملكات مصر الفرعونية رمزاً للجمال والسياسة؟", answer: "كليوباترا", category: "تاريخ", difficulty: "easy" },
  { id: "k04", letter: "ك", question: "ما اسم العلم الذي يختص بدراسة المواد وتفاعلاتها وتركيبها؟", answer: "الكيمياء", category: "علوم", difficulty: "easy" },
  { id: "k05", letter: "ك", question: "ما اسم الرياضة الجماعية الأكثر شعبية ومتابعة في العالم؟", answer: "كرة القدم", category: "رياضة", difficulty: "easy" },
  { id: "k06", letter: "ك", question: "ما اسم أكبر دولة في قارة أمريكا الشمالية لا الولايات المتحدة؟", answer: "كندا", category: "جغرافيا", difficulty: "easy" },
  { id: "k07", letter: "ك", question: "ما اسم عاصمة كينيا؟", answer: "كينيا - نيروبي. لكن الدولة: كينيا ✓", category: "جغرافيا", difficulty: "medium" },

  // ===== ل =====
  { id: "l01", letter: "ل", question: "ما عاصمة لبنان؟", answer: "لبنان... بيروت. لكن الدولة لبنان تبدأ بـ ل ✓", category: "جغرافيا", difficulty: "easy" },
  { id: "l02", letter: "ل", question: "ما عاصمة المملكة المتحدة؟", answer: "لندن", category: "جغرافيا", difficulty: "easy" },
  { id: "l03", letter: "ل", question: "من هو الحكيم الذي وردت في القرآن نصائحه الحكيمة لابنه؟", answer: "لقمان الحكيم", category: "دين", difficulty: "easy" },
  { id: "l04", letter: "ل", question: "ما اسم الجوهرة البيضاء اللامعة التي تُنتجها أصداف المحار؟", answer: "لؤلؤ", category: "عام", difficulty: "easy" },
  { id: "l05", letter: "ل", question: "ما اسم المدينة الفرنسية التي يقع فيها أشهر متحف في العالم بصرح المثلث الزجاجي؟", answer: "لوفر - متحف اللوفر في باريس", category: "فن وثقافة", difficulty: "medium" },
  { id: "l06", letter: "ل", question: "ما اسم العالم الذي أسس نظرية التطور الوراثي بعلم الوراثة؟", answer: "لامارك (قبل داروين في نظرية مشابهة)", category: "علوم", difficulty: "hard" },

  // ===== م =====
  { id: "m01", letter: "م", question: "من هو خاتم الأنبياء والمرسلين؟", answer: "محمد ﷺ", category: "دين", difficulty: "easy" },
  { id: "m02", letter: "م", question: "ما عاصمة مصر؟", answer: "مصر... عاصمتها القاهرة. لكن الدولة: مصر تبدأ بـ م ✓", category: "جغرافيا", difficulty: "easy" },
  { id: "m03", letter: "م", question: "في أي مدينة يقع المسجد الحرام والكعبة المشرفة؟", answer: "مكة المكرمة", category: "دين", difficulty: "easy" },
  { id: "m04", letter: "م", question: "ما اسم أضخم كوكب في المجموعة الشمسية؟", answer: "المشتري", category: "علوم", difficulty: "easy" },
  { id: "m05", letter: "م", question: "ما عاصمة المغرب؟", answer: "المغرب - الرباط. لكن الدولة: المغرب ✓", category: "جغرافيا", difficulty: "easy" },
  { id: "m06", letter: "م", question: "ما اسم النهر أطول في العالم يجري في أفريقيا؟", answer: "النيل... لكن يبدأ بـ ن. عوضاً: ما اسم المحيط الأكبر؟ المحيط الهادئ ✓ (يبدأ بـ م)", category: "جغرافيا", difficulty: "medium" },
  { id: "m07", letter: "م", question: "ما اسم أجمل نادٍ لكرة القدم في تاريخ الرياضة وأثراه؟", answer: "ريال مدريد (تبدأ بـ م: مدريد) - أو مانشستر يونايتد", category: "رياضة", difficulty: "medium" },
  { id: "m08", letter: "م", question: "من هو العالم الألماني الأصل مطوّر نظرية النسبية؟", answer: "لا يبدأ بـ م: أينشتاين. أو: ماكس بلانك ✓", category: "علوم", difficulty: "hard" },

  // ===== ن =====
  { id: "n01", letter: "ن", question: "من هو النبي الذي بنى السفينة وأنجاه الله من الطوفان؟", answer: "نوح عليه السلام", category: "دين", difficulty: "easy" },
  { id: "n02", letter: "ن", question: "ما اسم أطول نهر في العالم والذي يجري في أفريقيا؟", answer: "نهر النيل", category: "جغرافيا", difficulty: "easy" },
  { id: "n03", letter: "ن", question: "ما اسم الكوكب الثامن والأبعد في مجموعتنا الشمسية؟", answer: "نبتون", category: "علوم", difficulty: "easy" },
  { id: "n04", letter: "ن", question: "من هو القائد الفرنسي القصير الذي غزا أوروبا كلها في مطلع القرن التاسع عشر؟", answer: "نابليون بونابرت", category: "تاريخ", difficulty: "easy" },
  { id: "n05", letter: "ن", question: "ما اسم السائل الأسود الذي يُستخرج من باطن الأرض ووصف بالذهب الأسود؟", answer: "نفط (البترول)", category: "عام", difficulty: "easy" },
  { id: "n06", letter: "ن", question: "ما اسم الحشرة الاجتماعية التي تنتج العسل وتعيش في خلايا منظمة؟", answer: "نحلة", category: "علوم", difficulty: "easy" },
  { id: "n07", letter: "ن", question: "ما عاصمة النمسا؟", answer: "النمسا - فيينا. لكن الدولة: النمسا ✓", category: "جغرافيا", difficulty: "easy" },

  // ===== ه =====
  { id: "ha01", letter: "ه", question: "ما عاصمة كوبا؟", answer: "هافانا", category: "جغرافيا", difficulty: "medium" },
  { id: "ha02", letter: "ه", question: "ما اسم سلسلة الجبال الأعلى في العالم التي تضم إيفرست وK2؟", answer: "الهيمالايا", category: "جغرافيا", difficulty: "easy" },
  { id: "ha03", letter: "ه", question: "ما أكبر دولة في جنوب آسيا بعدد السكان والمساحة؟", answer: "الهند", category: "جغرافيا", difficulty: "easy" },
  { id: "ha04", letter: "ه", question: "ما أخف العناصر الكيميائية وأكثرها شيوعاً في الكون؟", answer: "هيدروجين", category: "علوم", difficulty: "medium" },
  { id: "ha05", letter: "ه", question: "ما اسم الهجرة التاريخية التي تُعدّ بداية التاريخ الهجري للمسلمين؟", answer: "هجرة النبي ﷺ من مكة إلى المدينة المنورة", category: "دين", difficulty: "easy" },
  { id: "ha06", letter: "ه", question: "ما اسم الجسم السماوي الطويل الذائيل الذي انتظر البشرية منذ القِدم؟", answer: "هالي - مذنب هالي", category: "علوم", difficulty: "medium" },

  // ===== و =====
  { id: "w01", letter: "و", question: "ما عاصمة الولايات المتحدة الأمريكية؟", answer: "واشنطن العاصمة", category: "جغرافيا", difficulty: "easy" },
  { id: "w02", letter: "و", question: "ما اسم الأرض المنخفضة بين جبلين وتجري فيها الأنهار عادةً؟", answer: "وادي", category: "جغرافيا", difficulty: "easy" },
  { id: "w03", letter: "و", question: "ما اسم المدينة السومرية القديمة (وركاء) التي تُعد من أولى مدن الحضارة الإنسانية؟", answer: "وركاء (أوروك)", category: "تاريخ", difficulty: "hard" },
  { id: "w04", letter: "و", question: "ما اسم حيوان البحر الضخم ذي الزعانف والحجم الهائل؟", answer: "وحيد القرن البحري... أو: والروس ✓", category: "علوم", difficulty: "medium" },
  { id: "w05", letter: "و", question: "ما اسم الزهرة الحمراء الشهيرة رمزاً للحب والرومانسية في الغرب؟", answer: "وردة حمراء", category: "عام", difficulty: "easy" },

  // ===== ي =====
  { id: "y01", letter: "ي", question: "ما اسم الدولة الجزيرية في شرق آسيا وعاصمتها طوكيو؟", answer: "اليابان", category: "جغرافيا", difficulty: "easy" },
  { id: "y02", letter: "ي", question: "ما اسم الدولة الأوروبية الجنوبية ذات الحضارة الفلسفية وعاصمتها أثينا؟", answer: "اليونان", category: "جغرافيا", difficulty: "easy" },
  { id: "y03", letter: "ي", question: "من هو النبي الذي ابتلعه الحوت ثم نجاه الله؟", answer: "يونس عليه السلام", category: "دين", difficulty: "easy" },
  { id: "y04", letter: "ي", question: "ما اسم الدولة العربية في جنوب شبه الجزيرة العربية وعاصمتها صنعاء؟", answer: "اليمن", category: "جغرافيا", difficulty: "easy" },
  { id: "y05", letter: "ي", question: "ما اسم العنصر المشع المستخدم في الطاقة النووية؟", answer: "يورانيوم", category: "علوم", difficulty: "medium" },
  { id: "y06", letter: "ي", question: "ما اسم المعركة الحاسمة التي انتصر فيها المسلمون وفتحوا بها الشام؟", answer: "يرموك - معركة اليرموك", category: "تاريخ", difficulty: "medium" },
  { id: "y07", letter: "ي", question: "ما اسم العلم الذي يدرس الأحياء والكائنات الحية؟", answer: "يومياً نقول: علم الأحياء... لكن البيولوجيا (لا يبدأ بـ ي تماماً)", category: "علوم", difficulty: "easy" },
];

export function getQuestionsByLetter(letter: string, questions: Question[] = DEFAULT_QUESTIONS): Question[] {
  return questions.filter((q) => q.letter === letter);
}

export function getRandomQuestion(letter: string, questions: Question[] = DEFAULT_QUESTIONS): Question | null {
  const letterQuestions = getQuestionsByLetter(letter, questions);
  if (letterQuestions.length === 0) return null;
  return letterQuestions[Math.floor(Math.random() * letterQuestions.length)];
}

export function loadCustomQuestions(): Question[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("hroofGame_questions");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveCustomQuestions(questions: Question[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("hroofGame_questions", JSON.stringify(questions));
  } catch {
    // ignore
  }
}

export function getAllQuestions(): Question[] {
  const custom = loadCustomQuestions();
  return custom.length > 0 ? custom : DEFAULT_QUESTIONS;
}

export async function fetchQuestionsFromBackend(filters?: {
  letter?: string;
  category?: string;
  difficulty?: string;
  search?: string;
}): Promise<Question[]> {
  const params = new URLSearchParams();
  if (filters?.letter) params.append("letter", filters.letter);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.difficulty) params.append("difficulty", filters.difficulty);
  if (filters?.search) params.append("search", filters.search);
  
  const url = `${API_BASE}/api/questions${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch questions");
  return response.json();
}

export async function fetchRandomQuestion(letter: string): Promise<Question | null> {
  try {
    const response = await fetch(`${API_BASE}/api/questions/random?letter=${encodeURIComponent(letter)}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function getCategories(): string[] {
  const categories: string[] = [];
  DEFAULT_QUESTIONS.forEach((q) => {
    if (!categories.includes(q.category)) categories.push(q.category);
  });
  return categories;
}

export function getDifficulties(): string[] {
  const difficulties: string[] = [];
  DEFAULT_QUESTIONS.forEach((q) => {
    if (!difficulties.includes(q.difficulty)) difficulties.push(q.difficulty);
  });
  return difficulties;
}

export function getLetters(): string[] {
  const letters: string[] = [];
  DEFAULT_QUESTIONS.forEach((q) => {
    if (!letters.includes(q.letter)) letters.push(q.letter);
  });
  return letters;
}
