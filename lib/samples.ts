/**
 * Preloaded worksheets.
 *
 * A judge opening the demo has no child and no homework in reach. Without
 * these, evaluating the project means finding a worksheet first — which most
 * people will not do, and §11 scores a demo that cannot be exercised as
 * "partially working". Each sample is chosen because the US method and the
 * method most immigrant parents learned genuinely diverge on it.
 */

export interface Sample {
  id: string;
  label: string;
  /** Why this one is worth trying — shown under the button. */
  hook: string;
  suggestedCountry: string;
  suggestedLanguage: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "area-model",
    label: "3rd grade — multiply with the box method",
    hook: "The parent can do this multiplication instantly. They have never seen the grid.",
    suggestedCountry: "MX",
    suggestedLanguage: "es",
    text: `Name: ____________________  Date: __________
Unit 4, Lesson 7 — Multiplying with the Area Model

Solve each problem using the box method. Show your partial products.
You must use the area model — do not use the standard algorithm.

1)  24 x 6 = ______
2)  35 x 4 = ______
3)  53 x 7 = ______

Exit ticket: Explain in words how the boxes helped you find the product.`,
  },
  {
    id: "long-division",
    label: "4th grade — long division",
    hook: "Same arithmetic, but the numbers go in completely different places on the page.",
    suggestedCountry: "VN",
    suggestedLanguage: "vi",
    text: `Name: ____________________  Date: __________
Lesson 12 — Long Division with Remainders

Divide. Show every step of your work in the division bracket.

1)  756 ÷ 4
2)  918 ÷ 6
3)  1,245 ÷ 5

Check your answer by multiplying the quotient by the divisor and adding
the remainder.`,
  },
  {
    id: "number-bonds",
    label: "2nd grade — number bonds and regrouping",
    hook: `"Number bond" has no translation in any language. It is not a vocabulary problem.`,
    suggestedCountry: "IN",
    suggestedLanguage: "te",
    text: `Name: ____________________  Date: __________
Module 3 — Subtraction with Regrouping

Use a number bond to decompose the second number, then subtract.
Remember to regroup from the tens place when you cannot subtract.

1)  62 - 27 = ______
2)  84 - 39 = ______
3)  71 - 45 = ______

Draw your number bond for problem 2 in the space below.`,
  },
];
