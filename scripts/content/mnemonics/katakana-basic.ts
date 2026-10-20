// Batch 2: the 46 basic katakana. Where a katakana looks like its hiragana
// (both often come from the same kanji), the mnemonic reuses batch 1's image
// so one picture covers both. Look-alike pairs (シ/ツ, ソ/ン, ク/タ/ケ…) get a
// tie-breaker.

import type { MnemonicBatch } from "./index.ts";

export const KATAKANA_BASIC: MnemonicBatch = {
  "kana:ア": { reading: "An AXE: the bar across the top is the blade, the long curve is the handle swinging down. \"AH!\" (A) Its look-alike マ has a short stub instead of the long handle." },
  "kana:イ": { reading: "An EAsel: one short leg leaning in against one straight leg (I)." },
  "kana:ウ": { reading: "The \"OOF!\" from う, now with a lid on top: they got punched and bonked their head on the ceiling (U)." },
  "kana:エ": { reading: "A steel girder seen from the end, like a capital I. \"EH? That's an I!\" (E)" },
  "kana:オ": { reading: "The golfer from お, but the loop is gone: just the club swinging down. \"OH no, I missed!\" (O)" },

  "kana:カ": { reading: "The same karate chop as か, without the spark: \"KA!\" (KA). Both come from the same kanji, 加." },
  "kana:キ": { reading: "The same old KEY as き, without the curl at the bottom (KI)." },
  "kana:ク": { reading: "A CUckoo poking its head and beak out of a clock (KU). With a line inside the beak it's タ; with a long tail it's ケ." },
  "kana:ケ": { reading: "A tilted K for KEtchup: one arm bent over, with a long drip running down (KE)." },
  "kana:コ": { reading: "The two KOi from こ, now in the corner of a tank: the right side joins them up (KO). Its look-alike ユ has the long line at the bottom." },

  "kana:サ": { reading: "A rack with two SAbres stuck through it, the right one longer and curving (SA)." },
  "kana:シ": { reading: "Two winks and a smile that sweeps up from the bottom left: SHE's smiling at you (SHI). Its twin ツ has its marks along the top, falling down." },
  "kana:ス": { reading: "A SUmo wrestler mid-stomp: one leg swept wide, the other kicking out (SU)." },
  "kana:セ": { reading: "The buck-tooth mouth from せ, one tooth short: \"SAY what?!\" (SE)" },
  "kana:ソ": { reading: "A needle diving down from the top, SEWing, with a little stitch beside it (SO). Its twin ン sweeps up from the bottom instead." },

  "kana:タ": { reading: "ク with a line inside, like a TAco with a slice of meat in it (TA)." },
  "kana:チ": { reading: "A CHEErleader: a pompom on top, arms out (the bar), one leg sweeping down (CHI)." },
  "kana:ツ": { reading: "Three drops falling from the top: TSUnami spray crashing down (TSU). Its twin シ smiles upward from the bottom." },
  "kana:テ": { reading: "A TElegraph pole: two crossbars on top and the pole bending down (TE)." },
  "kana:ト": { reading: "The TOE from と, seen from the side, with the splinter sticking out (TO)." },

  "kana:ナ": { reading: "A cross with a bent leg: a NAil hammered in crooked (NA)." },
  "kana:ニ": { reading: "Two lines, just like 二, the kanji for two, which is read NI (NI)." },
  "kana:ヌ": { reading: "Chopsticks crossed over a bowl of NOOdles, like ぬ without the tangle (NU)." },
  "kana:ネ": { reading: "A NEcktie on a hanger: the dot is the hook, the rest is the tie hanging down (NE)." },
  "kana:ノ": { reading: "One slash, like the line through a \"NO\" sign (NO)." },

  "kana:ハ": { reading: "Two lines spreading apart, like a mouth wide open laughing: \"HA!\" (HA)" },
  "kana:ヒ": { reading: "A HEEl kicked out sideways from a leg (HI)." },
  "kana:フ": { reading: "One hooked stroke, like the left slope of Mount FUji from ふ (FU)." },
  "kana:ヘ": { reading: "The same hill as へ: reach the top and shout \"HEY!\" (HE). It's one of the kana that look the same in both scripts." },
  "kana:ホ": { reading: "A scarecrow with its arms out and little legs, shouting \"HO!\" at the crows (HO)." },

  "kana:マ": { reading: "A cup turned upside down for a MAgic trick, with a tiny tail: \"MAgic! Nothing under it!\" (MA) ア has a long handle instead." },
  "kana:ミ": { reading: "Three slanted lines: ME, ME, ME! (MI)" },
  "kana:ム": { reading: "A big cow's nose with a nostril: \"MOO!\" (MU)" },
  "kana:メ": { reading: "An X, like the crossing strokes of め without the loop: X marks the spot, ME (ME)." },
  "kana:モ": { reading: "The fish hook from も, now straightened out, still with MORE bait (MO)." },

  "kana:ヤ": { reading: "The YAk from や: one big horn and the other horn through it (YA)." },
  "kana:ユ": { reading: "A U-shaped cup lying on its side with a long base: \"YOU drank it all!\" (YU) In コ the base doesn't stick out, and the box is closed on the right." },
  "kana:ヨ": { reading: "A backwards E: \"YO, that E is backwards!\" (YO)" },

  "kana:ラ": { reading: "The RAbbit from ら, now with its ear lying flat on top (RA)." },
  "kana:リ": { reading: "The same two REEds as り, one short and one long (RI)." },
  "kana:ル": { reading: "Two legs walking a ROUte, the right one kicking up at the end (RU)." },
  "kana:レ": { reading: "A check mark: \"READY!\" (RE)" },
  "kana:ロ": { reading: "A square mouth wide open: \"ROAR!\" (RO)" },

  "kana:ワ": { reading: "Like わ without the loop: the cat's tail is just a hook now, and it's WAiling \"WAH!\" (WA). Add a dot on top and you get ウ." },
  "kana:ヲ": { reading: "A hook with an extra bar, someone grabbing the rail to stop falling: \"WHOA!\" (WO). Like を, it's read \"o\", and you'll rarely see it." },
  "kana:ン": { reading: "One dot and a stroke sweeping up from the bottom, like a lowercase n with a flick: N (N). ソ's long stroke falls from the top instead." },
};
