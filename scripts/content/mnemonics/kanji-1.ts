// Batch 10: kanji 1–50 in path order. Meaning mnemonics build a story from the
// component names (meaning in CAPITALS). Reading notes point to a common word
// rather than an invented story, or name a sound part (青 → せい) where one
// predicts the reading.

import type { MnemonicBatch } from "./index.ts";

export const KANJI_1: MnemonicBatch = {
  "kanji:日": {
    meaning: "The DAY component on its own: the sun, rising on a new DAY. It also means sun, and 日本 (Japan) means \"origin of the sun\".",
    reading: "In words it's usually にち, as in 毎日 (まいにち, every day). On its own it's ひ (sun, day).",
  },
  "kanji:一": {
    meaning: "The ONE component on its own: a single line, ONE.",
    reading: "いち when counting: いち、に、さん. For one thing or one person it's ひと: 一つ (ひとつ), 一人 (ひとり).",
  },
  "kanji:国": {
    meaning: "A KING (王) inside a walled BOX (囗), guarding a DOT of treasure: the king's COUNTRY.",
    reading: "こく in words, as in 外国 (がいこく, foreign country). On its own it's くに.",
  },
  "kanji:会": {
    meaning: "People in HATs (𠆢) gathering TWO (二) by two, swapping PRIVATE (厶) secrets: a MEETING.",
    reading: "かい, as in 会社 (かいしゃ, company). As a verb, 会う (あう, to meet).",
  },
  "kanji:人": {
    meaning: "The PERSON component on its own: a PERSON walking.",
    reading: "じん for nationality: 日本人 (にほんじん, Japanese person). にん when counting people: 三人 (さんにん). On its own it's ひと.",
  },
  "kanji:年": {
    meaning: "A HOOK (𠂉) above a rack where the laundry hangs to DRY (干): you only wash that winter coat once a YEAR.",
    reading: "ねん, as in 来年 (らいねん, next year). On its own it's とし.",
  },
  "kanji:大": {
    meaning: "The LARGE component on its own: arms stretched wide, \"It was THIS LARGE!\"",
    reading: "だい, as in 大学 (だいがく, university); たい in 大会 (たいかい, tournament); おお in 大きい (おおきい, big).",
  },
  "kanji:十": {
    meaning: "The TEN component on its own: a cross like an upright X, TEN.",
    reading: "じゅう (ten).",
  },
  "kanji:二": {
    meaning: "The TWO component on its own: two lines, TWO.",
    reading: "に (two). For two things or two people it's ふた: 二つ (ふたつ), 二人 (ふたり).",
  },
  "kanji:本": {
    meaning: "A TREE (木) with ONE (一) line marking where its trunk meets the root: the ORIGIN, the MAIN part. Books are made from trees, so it's also BOOK.",
    reading: "ほん, as in 日本 (にほん, Japan) and 本 (ほん, book).",
  },
  "kanji:中": {
    meaning: "A STICK (丨) skewered through the middle of a MOUTH (口): right in the MIDDLE.",
    reading: "ちゅう, as in 中国 (ちゅうごく, China, the \"middle country\"). On its own it's なか (inside).",
  },
  "kanji:長": {
    meaning: "The LONG component on its own: the old man with LONG hair. Being the eldest, he's also the LEADER.",
    reading: "ちょう, as in 社長 (しゃちょう, company president); なが in 長い (ながい, long).",
  },
  "kanji:出": {
    meaning: "A MOUNTAIN (山) on top of an OPEN BOX (凵), with a STICK through both: climbing up and out of the box. EXIT.",
    reading: "で in 出る (でる, to go out) and 出口 (でぐち, the exit on every station sign); だ in 出す (だす, to take out).",
  },
  "kanji:三": {
    meaning: "ONE (一) plus TWO (二): three lines, THREE.",
    reading: "さん (three). For three things it's 三つ (みっつ).",
  },
  "kanji:時": {
    meaning: "SOIL (土) and a MEASUREMENT (寸) beside the DAY (日): measuring the sun's shadow on the ground, like a sundial telling the TIME.",
    reading: "じ, as in 一時 (いちじ, one o'clock). On its own it's とき.",
  },
  "kanji:行": {
    meaning: "The GOING component on its own: STEPs (彳) toward a crossroads, GOING somewhere.",
    reading: "い in 行く (いく, to go); こう in 銀行 (ぎんこう, bank) and 旅行 (りょこう, travel).",
  },
  "kanji:社": {
    meaning: "SPIRIT (礻) over SOIL (土): a shrine on its own land. A COMPANY is where people worship work.",
    reading: "しゃ, as in 会社 (かいしゃ, company) and 社長 (しゃちょう, company president).",
  },
  "kanji:見": {
    meaning: "The SEE component on its own: an EYE (目) on LEGS (儿), walking around to SEE things.",
    reading: "み in 見る (みる, to see); けん in 見学 (けんがく, a study visit).",
  },
  "kanji:月": {
    meaning: "The MONTH component on its own: the crescent moon. One cycle of the moon is a MONTH.",
    reading: "がつ for the months: 一月 (いちがつ, January). げつ in 月曜日 (げつようび, Monday). On its own it's つき (moon).",
  },
  "kanji:分": {
    meaning: "A SWORD (刀) slicing between two FINS (ハ): cutting something into PARTs. An hour cut up is MINUTEs.",
    reading: "ふん / ぷん for minutes: 五分 (ごふん, five minutes). ぶん in 自分 (じぶん, oneself). わ in 分かる (わかる, to understand).",
  },
  "kanji:後": {
    meaning: "Taking a STEP (彳) with a SHORT THREAD (幺) tying your feet together, you're running LATE (夂): you fall BEHIND and arrive LATER.",
    reading: "ご, as in 午後 (ごご, afternoon); あと (after); うしろ (behind).",
  },
  "kanji:前": {
    meaning: "HORNS (丷) over ONE (一), with a MONTH (月) and a KNIFE (刂) below: a bull charging IN FRONT of you, horns first.",
    reading: "まえ (in front, before); ぜん, as in 午前 (ごぜん, morning: before noon).",
  },
  "kanji:生": {
    meaning: "The LIFE component on its own: a sprout pushing up through the soil, LIFE.",
    reading: "It has many readings; learn them from words. せい, as in 学生 (がくせい, student) and 先生 (せんせい, teacher); い in 生きる (いきる, to live).",
  },
  "kanji:五": {
    meaning: "The FIVE component on its own: FIVE.",
    reading: "ご (five). For five things it's 五つ (いつつ).",
  },
  "kanji:間": {
    meaning: "The DAY (日) shining through a GATE (門): sunlight through the gap between the doors. An INTERVAL, a SPACE.",
    reading: "かん, as in 時間 (じかん, time); あいだ (between).",
  },
  "kanji:上": {
    meaning: "A DIVINING crack (卜) pointing UP from ONE (一) line, the ground: ABOVE.",
    reading: "うえ (above); じょう, as in 上手 (じょうず, skilled); あ in 上がる (あがる, to rise).",
  },
  "kanji:東": {
    meaning: "The sun (日, DAY) rising behind a TREE (木): the EAST, where the sun comes up.",
    reading: "ひがし (east); とう, as in 東京 (とうきょう, Tokyo), the \"eastern capital\".",
  },
  "kanji:四": {
    meaning: "A BOX (囗) with LEGS (儿) inside: a table with FOUR legs in a room with four walls.",
    reading: "よん and し. し sounds like 死 (death), so people often say よん instead.",
  },
  "kanji:今": {
    meaning: "A HAT (𠆢) over ONE (一) and a hook: put your hat on, we're leaving NOW.",
    reading: "いま (now); こん, as in こんにちは (今日は, hello) and 今月 (こんげつ, this month).",
  },
  "kanji:新": {
    meaning: "STAND UP (立) on a TREE (木) stump and swing your AXE (斤): freshly chopped wood. NEW.",
    reading: "しん, as in 新幹線 (しんかんせん, bullet train) and 新聞 (しんぶん, newspaper); あたら in 新しい (あたらしい, new).",
  },
  "kanji:金": {
    meaning: "The GOLD component on its own: the king's GOLD vault. It also means money.",
    reading: "きん (gold), as in 金曜日 (きんようび, Friday); かね (money), as in お金 (おかね).",
  },
  "kanji:九": {
    meaning: "The NINE component on its own: a hook like the tail of a 9.",
    reading: "きゅう and く. く sounds like 苦 (suffering), so nine is a bit unlucky, like four.",
  },
  "kanji:入": {
    meaning: "The ENTER component on its own: a person leaning in to ENTER.",
    reading: "いり in 入口 (いりぐち, the entrance on every station sign); はい in 入る (はいる, to enter); にゅう in 入学 (にゅうがく, starting school).",
  },
  "kanji:立": {
    meaning: "The STAND UP component on its own: a person standing tall on the ground.",
    reading: "た in 立つ (たつ, to stand); りつ, as in 国立 (こくりつ, national).",
  },
  "kanji:手": {
    meaning: "The HAND component on its own: fingers and a wrist, a HAND.",
    reading: "て (hand); しゅ, as in 歌手 (かしゅ, singer) and 選手 (せんしゅ, athlete).",
  },
  "kanji:学": {
    meaning: "A CHILD (子) under a CROWN (冖), with SMALL (⺌) sparks of ideas flying off the top: the child is STUDYing hard.",
    reading: "がく, as in 学生 (がくせい, student) and 大学 (だいがく, university).",
  },
  "kanji:高": {
    meaning: "The TALL component on its own: a TALL tower. Tall things cost more, so it also means EXPENSIVE.",
    reading: "たか in 高い (たかい, tall, expensive); こう, as in 高校 (こうこう, high school).",
  },
  "kanji:円": {
    meaning: "A coin standing up inside an UPSIDE-DOWN BOX (冂), like a coin purse: YEN. Coins are round, so it also means CIRCLE.",
    reading: "えん (yen), as in 百円 (ひゃくえん, 100 yen).",
  },
  "kanji:子": {
    meaning: "The CHILD component on its own: a swaddled baby, a CHILD.",
    reading: "こ, as in 子供 (こども, child) and 女の子 (おんなのこ, girl). Many girls' names used to end in -子 (-こ), like はなこ.",
  },
  "kanji:目": {
    meaning: "The EYE component on its own: an EYE turned on its side.",
    reading: "め (eye), also for \"the Nth\": 一つ目 (ひとつめ, the first one); もく, as in 目的 (もくてき, purpose).",
  },
  "kanji:外": {
    meaning: "EVENING (夕) next to a DIVINING crack (卜): fortune tellers set up OUTSIDE in the evening.",
    reading: "がい, as in 外国人 (がいこくじん, foreigner); そと (outside).",
  },
  "kanji:言": {
    meaning: "The SAY component on its own: a mouth with words floating up, SAY.",
    reading: "い in 言う (いう, to say); げん, as in 言語 (げんご, language).",
  },
  "kanji:八": {
    meaning: "The two FINS (ハ) spreading apart: EIGHT.",
    reading: "はち (eight). Eight counts as lucky, because the shape widens toward the bottom like a future that keeps opening up (末広がり).",
  },
  "kanji:六": {
    meaning: "A LID (亠) over two FINS (ハ), like a little stool with splayed legs: SIX of them fit round the table.",
    reading: "ろく (six). For six things it's 六つ (むっつ).",
  },
  "kanji:下": {
    meaning: "A DIVINING crack (卜) hanging DOWN from ONE (一) line: BELOW.",
    reading: "した (below); か, as in 地下鉄 (ちかてつ, subway); くだ in 下さい (ください, please give me).",
  },
  "kanji:来": {
    meaning: "A stalk of RICE (米) with ONE (一) extra line across it: next season's harvest is COMING.",
    reading: "く in 来る (くる, to come); らい, as in 来年 (らいねん, next year) and 来週 (らいしゅう, next week).",
  },
  "kanji:気": {
    meaning: "STEAM (气) rising from a pot of rice: you can feel its SPIRIT, the energy in the AIR.",
    reading: "き, as in 元気 (げんき, healthy), 天気 (てんき, weather) and 人気 (にんき, popular).",
  },
  "kanji:小": {
    meaning: "The LITTLE component on its own: a hook with a LITTLE crumb on either side.",
    reading: "しょう, as in 小学校 (しょうがっこう, elementary school); ちい in 小さい (ちいさい, small).",
  },
  "kanji:七": {
    meaning: "Flip it over and it looks like a 7 with a line through it: SEVEN.",
    reading: "なな and しち (seven).",
  },
  "kanji:山": {
    meaning: "The MOUNTAIN component on its own: three peaks, a MOUNTAIN.",
    reading: "やま (mountain); さん in mountain names: 富士山 (ふじさん, Mount Fuji).",
  },
};
