// Batch 1: the 46 basic hiragana. Each ties the character's shape to its sound;
// the sound is in CAPITAL romaji, matching the AI workshop's style.

import type { MnemonicBatch } from "./index.ts";

export const HIRAGANA_BASIC: MnemonicBatch = {
  "kana:あ": { reading: "A cross with a big loop tangled underneath: someone tripped over the cross and is tumbling through the loop yelling \"AAAH!\" (A)" },
  "kana:い": { reading: "Two short strokes standing side by side, like a pair of eels poking up out of the water. Eels say \"EE\" (I)." },
  "kana:う": { reading: "A little head (the dash) over a body bent double: someone just got punched in the stomach. \"OOF!\" (U)" },
  "kana:え": { reading: "A dancer with a tiny hat (the dash) kicking one leg out to the side: \"EH-hey!\" (E)" },
  "kana:お": { reading: "A golfer (the cross) swings all the way round in a loop, and the ball (the dot) flies off to the top right. \"OH!\" (O)" },

  "kana:か": { reading: "A karate chop slicing down, with a spark flying off to the right: \"KA!\" (KA)" },
  "kana:き": { reading: "Two bars across a stem with a curl at the bottom: an old-fashioned KEY (KI)." },
  "kana:く": { reading: "An open bird's beak, mid-call: the CUckoo going \"KU, KU\" (KU)." },
  "kana:け": { reading: "A tall stave on the left and a tap on the right with beer dripping down: a KEG (KE)." },
  "kana:こ": { reading: "Two KOi fish swimming one above the other in a pond (KO)." },

  "kana:さ": { reading: "A cross with a curl hanging underneath, like a SAmurai bowing so low that his sword hilt sticks up behind him (SA)." },
  "kana:し": { reading: "One long lock of hair curling up at the end: SHE has a single, very long strand of hair (SHI)." },
  "kana:す": { reading: "A rope hanging from a bar with a loop for a seat: a swing going \"SWOOSH\" (SU)." },
  "kana:せ": { reading: "A wide-open mouth with one big buck tooth sticking up: \"SAY what?!\" (SE)" },
  "kana:そ": { reading: "A zigzag stitch, like a needle SEWing back and forth (SO)." },

  "kana:た": { reading: "It looks like the letters t and a squeezed together: TA (TA)." },
  "kana:ち": { reading: "A cheerleader with arms crossed overhead (the cross) and one leg kicked out in a big curve: \"CHEER!\" (CHI)" },
  "kana:つ": { reading: "One big wave curling over: a TSUnami (TSU)." },
  "kana:て": { reading: "A long arm with the hand curling down at the end. Fittingly, \"TE\" (手) is the Japanese word for hand (TE)." },
  "kana:と": { reading: "A TOE with a splinter jammed into it at an angle: \"Ow, my TOE!\" (TO)" },

  "kana:な": { reading: "A cross, a dot, and a rope with a KNOT tied in the end. \"NAh, I'm not untying that\" (NA)." },
  "kana:に": { reading: "A leg (the long line) with two marks beside it, right where the KNEE is (NI)." },
  "kana:ぬ": { reading: "A tangle of NOOdles with chopsticks stuck through, and the last noodle curling into a loop (NU)." },
  "kana:ね": { reading: "A line with a curly tail ending in a loop, like a cat's tail. Cat is ねこ (NEko) in Japanese (NE)." },
  "kana:の": { reading: "One big swirl, like a \"NO\" sign drawn in a single stroke (NO). You'll see の everywhere: it works like \"of\" or 's in English." },

  "kana:は": { reading: "A person (the line on the left) next to someone laughing so hard they've curled up into a loop: \"HA HA!\" (HA). Heads-up: as a particle, は is read \"wa\"." },
  "kana:ひ": { reading: "A wide, sneaky grin: \"HEE HEE!\" (HI)" },
  "kana:ふ": { reading: "A little peak with its slopes splashing out to either side: Mount FUji (FU)." },
  "kana:へ": { reading: "A simple hill. When you reach the top you shout \"HEY!\" (HE). Heads-up: as a particle meaning \"towards\", へ is read \"e\"." },
  "kana:ほ": { reading: "The same laughing person as は, but with an extra bar on top like the brim of Santa's hat: \"HO HO HO!\" (HO)" },

  "kana:ま": { reading: "Two bars over a loop: MAma balancing two trays, with the baby on her hip (MA)." },
  "kana:み": { reading: "It looks like a curly number 21: \"That's ME at 21!\" (MI)" },
  "kana:む": { reading: "A cow's face: the cross is its head, the loop is its nose ring, the dot is an ear. \"MOO!\" (MU)" },
  "kana:め": { reading: "A crossed loop like an eye with lashes. ME (目) is the Japanese word for eye (ME). Unlike ぬ, there's no little loop at the end." },
  "kana:も": { reading: "A fish hook with two bits of bait on it: the more bait, the MORE fish (MO)." },

  "kana:や": { reading: "A YAk's head from the side: one big curved horn, and the line through it is the other horn (YA)." },
  "kana:ゆ": { reading: "A loop with a line through it, like steam curling up from hot water: YUmmy hot water (YU)." },
  "kana:よ": { reading: "A YO-yo hanging from a finger: the bar on top is the finger, the loop at the bottom is the yo-yo (YO)." },

  "kana:ら": { reading: "A RAbbit sitting up: the dash is its ear sticking up, the curve is its round body (RA)." },
  "kana:り": { reading: "Two REEds growing beside a river, one long and one short (RI)." },
  "kana:る": { reading: "A ROUte that zigzags and then curls into a loop-de-loop at the end (RU). Without the loop, it's ろ." },
  "kana:れ": { reading: "A line, and someone crouching beside it with one leg kicking back, READY to sprint off (RE). ね has a loop at the end, わ curls in; れ kicks out." },
  "kana:ろ": { reading: "A ROad that zigzags and just ends, no loop (RO). With a loop at the end, it's る." },

  "kana:わ": { reading: "Like ね, but the cat has lost the loop on its tail and it's WAiling \"WAH!\" (WA)." },
  "kana:を": { reading: "Someone hunched over a walking stick, about to topple: \"WHOA!\" (WO). In practice を is read \"o\": it's the object particle, and almost never used anywhere else." },
  "kana:ん": { reading: "It looks like a lowercase n with a little tail: N (N). It's the only kana that's just a consonant with no vowel." },
};
