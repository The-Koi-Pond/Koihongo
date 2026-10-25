import assert from "node:assert/strict";
import { test } from "node:test";
import { strokePaths } from "../../src/strokes.ts";
import { partSvg } from "./strokeParts.ts";

// 乞 as KanjiVG draws it: 𠂉 on top (strokes 1–2), 乙 below (stroke 3), then stroke numbers.
const QI = `<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_04e5e" style="fill:none;stroke:#000000;stroke-width:3;">
<g id="kvg:04e5e" kvg:element="乞">
	<g id="kvg:04e5e-g1" kvg:element="𠂉" kvg:position="top">
		<path id="kvg:04e5e-s1" kvg:type="㇒" d="M40,11c0,1-1,2-1,3"/>
		<path id="kvg:04e5e-s2" kvg:type="㇐" d="M36,27c3,0,5,0,8,-1"/>
	</g>
	<g id="kvg:04e5e-g2" kvg:element="乙" kvg:position="bottom" kvg:radical="general">
		<path id="kvg:04e5e-s3" kvg:type="㇈" d="M30,49c2,1,5,1,8,0"/>
	</g>
</g>
</g>
<g id="kvg:StrokeNumbers_04e5e" style="font-size:8;fill:#808080">
	<text transform="matrix(1 0 0 1 30.50 14.13)">1</text>
</g>
</svg>`;

test("a labelled part is cut out with only its own strokes", () => {
  assert.deepEqual(strokePaths(partSvg(QI, "𠂉")!), ["M40,11c0,1-1,2-1,3", "M36,27c3,0,5,0,8,-1"]);
  assert.deepEqual(strokePaths(partSvg(QI, "乙")!), ["M30,49c2,1,5,1,8,0"]);
  assert.equal(strokePaths(partSvg(QI, "乞")!).length, 3, "the whole character is a part too");
});

test("no such part: nothing, rather than the whole character", () => {
  assert.equal(partSvg(QI, "亻"), null);
  assert.equal(partSvg("", "𠂉"), null);
});
